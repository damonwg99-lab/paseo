import { join, relative, sep } from "node:path";
import { readdirSync, existsSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import type { Logger } from "pino";
import type {
  DevPlatformGitRepo,
  DevPlatformWorktree,
} from "@getpaseo/protocol/dev-platform/types";

/**
 * Directories to skip when recursively scanning for git repos.
 * These are common build/dependency directories that should never contain
 * user-facing git repos.
 */
const SCAN_IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".cache",
  ".next",
  ".nuxt",
  ".turbo",
  ".gradle",
  "target",
  "vendor",
  "__pycache__",
  ".venv",
  "venv",
  ".git",
  ".svn",
  ".hg",
]);

/** Maximum depth to recurse when scanning for git repos. */
const SCAN_MAX_DEPTH = 5;

/** Maximum number of git repos to return from a scan. */
const SCAN_MAX_REPOS = 50;

export interface ScanGitReposOptions {
  /** Maximum recursion depth (default: 5) */
  maxDepth?: number;
  /** Maximum number of repos to return (default: 50) */
  maxRepos?: number;
  /** Additional directory names to skip */
  ignoreDirs?: string[];
}

interface ScanContext {
  rootDirectory: string;
  results: DevPlatformGitRepo[];
  ignoreDirs: Set<string>;
  maxDepth: number;
  maxRepos: number;
  logger: Logger;
}

/**
 * Recursively scan a directory for git repositories.
 *
 * Returns an array of DevPlatformGitRepo entries, one per discovered git repo.
 * Each entry includes the relative path from rootDirectory, which is "." when
 * rootDirectory itself is a git repo.
 *
 * Scan rules:
 * - Maximum depth: 5 levels by default
 * - Skips common build/dependency directories (node_modules, dist, etc.)
 * - Maximum 50 repos by default
 * - Detects git worktrees for each discovered repo
 */
export function scanGitRepos(
  rootDirectory: string,
  logger: Logger,
  options?: ScanGitReposOptions,
): DevPlatformGitRepo[] {
  const ignoreDirs = new Set([...SCAN_IGNORE_DIRS, ...(options?.ignoreDirs ?? [])]);
  const ctx: ScanContext = {
    rootDirectory,
    results: [],
    ignoreDirs,
    maxDepth: options?.maxDepth ?? SCAN_MAX_DEPTH,
    maxRepos: options?.maxRepos ?? SCAN_MAX_REPOS,
    logger,
  };

  if (!existsSync(rootDirectory)) {
    logger.warn("scanGitRepos: rootDirectory does not exist: %s", rootDirectory);
    return [];
  }

  scanDirectory(ctx, rootDirectory, 0);

  if (ctx.results.length > 0) {
    logger.info("scanGitRepos: found %d git repo(s) under %s", ctx.results.length, rootDirectory);
  }

  return ctx.results;
}

function scanDirectory(ctx: ScanContext, dir: string, depth: number): void {
  // Stop if we've hit the limit
  if (ctx.results.length >= ctx.maxRepos) {
    return;
  }
  // Stop if we've hit max depth
  if (depth > ctx.maxDepth) {
    return;
  }

  // Check if this directory itself is a git repo
  const gitDir = join(dir, ".git");
  if (existsSync(gitDir)) {
    const relPath = dir === ctx.rootDirectory ? "." : relative(ctx.rootDirectory, dir);
    const normalizedRelPath = relPath.split(sep).join("/");
    const repo = buildGitRepoEntry(dir, normalizedRelPath, ctx.logger);
    if (repo) {
      ctx.results.push(repo);
      // Don't recurse into a git repo's subdirectories — they would be
      // part of the same repo (unless they have their own .git, which
      // indicates submodules or nested repos).
      // We still scan subdirs for nested repos (monorepo with submodules case).
    }
  }

  // Recurse into subdirectories
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (ctx.results.length >= ctx.maxRepos) {
      return;
    }
    if (!entry.isDirectory()) {
      continue;
    }
    if (ctx.ignoreDirs.has(entry.name)) {
      continue;
    }
    // Skip hidden directories (starting with ".") except .git which we already handle
    if (entry.name.startsWith(".") && entry.name !== ".git") {
      continue;
    }
    const subDir = join(dir, entry.name);
    // Skip symlinks to avoid infinite loops
    try {
      if (statSync(subDir).isSymbolicLink()) {
        continue;
      }
    } catch {
      continue;
    }
    scanDirectory(ctx, subDir, depth + 1);
  }
}

function buildGitRepoEntry(
  repoDir: string,
  relativePath: string,
  logger: Logger,
): DevPlatformGitRepo | null {
  const remoteUrl = getGitRemoteUrl(repoDir);
  const url = remoteUrl ?? repoDir;
  const label = relativePath === "." ? undefined : relativePath.split("/").pop();
  const worktrees = scanWorktrees(repoDir, logger);

  return {
    url,
    relativePath,
    label,
    worktrees,
  };
}

/**
 * Get the git remote URL for a repository directory.
 * Returns null if the directory is not a git repo or has no "origin" remote.
 */
export function getGitRemoteUrl(dir: string): string | null {
  return getGitRemoteUrlInternal(dir);
}

function getGitRemoteUrlInternal(dir: string): string | null {
  try {
    const result = execSync("git remote get-url origin", {
      cwd: dir,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}

/**
 * Scan for git worktrees in a repository.
 * Uses `git worktree list --porcelain` to get worktree info.
 */
function scanWorktrees(repoDir: string, logger: Logger): DevPlatformWorktree[] {
  const worktrees: DevPlatformWorktree[] = [];
  try {
    const result = execSync("git worktree list --porcelain", {
      cwd: repoDir,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (!result) {
      return worktrees;
    }

    // Parse porcelain format:
    // worktree /path/to/worktree
    // HEAD abc123...
    // branch refs/heads/main
    //
    // worktree /path/to/other
    // HEAD def456...
    // branch refs/heads/feature
    // (detached HEAD detaches at abc123)
    const blocks = result.split(/\n\n+/);
    for (const block of blocks) {
      const lines = block.trim().split("\n");
      let worktreePath: string | null = null;
      let branch: string | null = null;

      for (const line of lines) {
        if (line.startsWith("worktree ")) {
          worktreePath = line.slice("worktree ".length).trim();
        } else if (line.startsWith("branch ")) {
          // Extract branch name from refs/heads/xxx
          const ref = line.slice("branch ".length).trim();
          const headPrefix = "refs/heads/";
          branch = ref.startsWith(headPrefix) ? ref.slice(headPrefix.length) : ref;
        }
      }

      if (worktreePath && branch) {
        // Skip the main worktree (same as repoDir)
        const normalizedRepoDir = repoDir.replace(/[/\\]+$/, "");
        const normalizedWorktreePath = worktreePath.replace(/[/\\]+$/, "");
        if (normalizedWorktreePath !== normalizedRepoDir) {
          worktrees.push({ path: worktreePath, branch });
        }
      }
    }
  } catch {
    // git worktree list may fail if not in a git repo — that's fine
    logger.debug("scanWorktrees: failed to list worktrees for %s", repoDir);
  }

  return worktrees;
}
