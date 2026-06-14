import { join } from "node:path";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * Git status for a single repository.
 * Used by the sidebar to display branch, ahead/behind, dirty state, etc.
 */
export interface GitRepoStatus {
  /** Absolute path to the repo working directory */
  repoPath: string;
  /** Current branch name, or null if detached HEAD */
  branch: string | null;
  /** Short commit hash of HEAD */
  headCommit: string | null;
  /** Number of commits ahead of upstream */
  aheadBy: number;
  /** Number of commits behind upstream */
  behindBy: number;
  /** Whether the working tree has uncommitted changes */
  isDirty: boolean;
  /** Number of untracked files */
  untrackedFiles: number;
  /** Number of modified files */
  modifiedFiles: number;
  /** Number of staged files */
  stagedFiles: number;
  /** Upstream branch name (e.g. "origin/main"), or null if no upstream */
  upstream: string | null;
  /** ISO timestamp of last status check */
  checkedAt: string;
}

/**
 * Get the full git status for a repository directory.
 *
 * @param repoPath Absolute path to the git repository working directory
 * @returns GitRepoStatus or null if the directory is not a git repo
 */
export function getGitRepoStatus(repoPath: string): GitRepoStatus | null {
  if (!existsSync(join(repoPath, ".git"))) {
    return null;
  }

  const branch = getBranch(repoPath);
  const headCommit = getHeadCommit(repoPath);
  const upstream = getUpstream(repoPath);
  const { aheadBy, behindBy } = getAheadBehind(repoPath);
  const { isDirty, untrackedFiles, modifiedFiles, stagedFiles } = getWorkingTreeStatus(repoPath);

  return {
    repoPath,
    branch,
    headCommit,
    aheadBy,
    behindBy,
    isDirty,
    untrackedFiles,
    modifiedFiles,
    stagedFiles,
    upstream,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Get the current branch name.
 * Returns null if in detached HEAD state.
 */
function getBranch(repoDir: string): string | null {
  try {
    const result = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: repoDir,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    // "HEAD" means detached HEAD state
    return result === "HEAD" ? null : result;
  } catch {
    return null;
  }
}

/**
 * Get the short hash of HEAD commit.
 */
function getHeadCommit(repoDir: string): string | null {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: repoDir,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Get the upstream tracking branch (e.g. "origin/main").
 * Returns null if no upstream is set.
 */
function getUpstream(repoDir: string): string | null {
  try {
    const result = execSync("git rev-parse --abbrev-ref @{upstream}", {
      cwd: repoDir,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return result || null;
  } catch {
    // No upstream configured — this is normal for new branches
    return null;
  }
}

/**
 * Get ahead/behind counts relative to upstream.
 * Returns {0, 0} if no upstream is set.
 */
function getAheadBehind(repoDir: string): { aheadBy: number; behindBy: number } {
  try {
    const result = execSync("git rev-list --left-right --count HEAD...@{upstream}", {
      cwd: repoDir,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const parts = result.split(/\s+/);
    if (parts.length === 2) {
      return {
        aheadBy: Number.parseInt(parts[0], 10) || 0,
        behindBy: Number.parseInt(parts[1], 10) || 0,
      };
    }
    return { aheadBy: 0, behindBy: 0 };
  } catch {
    // No upstream — can't compare
    return { aheadBy: 0, behindBy: 0 };
  }
}

/**
 * Get working tree status: dirty flag and file counts.
 *
 * Uses `git status --porcelain=v1` for machine-parseable output:
 * - Lines starting with `??` are untracked
 * - Lines with first column char (index changes) are staged
 * - Lines with second column char (worktree changes) are modified
 */
function getWorkingTreeStatus(repoDir: string): {
  isDirty: boolean;
  untrackedFiles: number;
  modifiedFiles: number;
  stagedFiles: number;
} {
  try {
    const result = execSync("git status --porcelain=v1", {
      cwd: repoDir,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (!result) {
      return { isDirty: false, untrackedFiles: 0, modifiedFiles: 0, stagedFiles: 0 };
    }

    const lines = result.split("\n");
    let untrackedFiles = 0;
    let modifiedFiles = 0;
    let stagedFiles = 0;

    for (const line of lines) {
      if (line.length < 2) continue;

      const indexStatus = line[0];
      const workTreeStatus = line[1];

      if (indexStatus === "?" && workTreeStatus === "?") {
        untrackedFiles++;
      } else {
        // Staged changes: first column is not space
        if (indexStatus !== " ") {
          stagedFiles++;
        }
        // Worktree changes: second column is not space
        if (workTreeStatus !== " ") {
          modifiedFiles++;
        }
      }
    }

    return {
      isDirty: untrackedFiles > 0 || modifiedFiles > 0 || stagedFiles > 0,
      untrackedFiles,
      modifiedFiles,
      stagedFiles,
    };
  } catch {
    return { isDirty: false, untrackedFiles: 0, modifiedFiles: 0, stagedFiles: 0 };
  }
}

/**
 * Get the last commit message subject line.
 */
export function getLastCommitMessage(repoDir: string): string | null {
  try {
    return execSync("git log -1 --format=%s", {
      cwd: repoDir,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}
