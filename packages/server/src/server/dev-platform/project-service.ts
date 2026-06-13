import { join } from "node:path";
import { readdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import type { Logger } from "pino";
import type {
  CreateDevPlatformProjectInput,
  DevPlatformProject,
  DevPlatformGitRepo,
  UpdateDevPlatformProjectInput,
} from "@getpaseo/protocol/dev-platform/types";
import { DevPlatformProjectStore } from "./store.js";
import type { DevPlatformTaskService } from "./task-service.js";
import type { WorkspaceRegistry, ProjectRegistry } from "../workspace-registry.js";
import type { WorkspaceGitService } from "../workspace-git-service.js";
import {
  classifyDirectoryForProjectMembership,
  normalizeWorkspaceId,
} from "../workspace-registry-model.js";
import {
  createPersistedProjectRecord,
  createPersistedWorkspaceRecord,
} from "../workspace-registry.js";
import type { PersistedProjectRecord } from "../workspace-registry.js";

function scanGitRepos(rootDirectory: string, logger: Logger): DevPlatformGitRepo[] {
  const repos: DevPlatformGitRepo[] = [];
  if (!existsSync(rootDirectory)) {
    logger.warn("rootDirectory does not exist: %s", rootDirectory);
    return repos;
  }

  // Check if root itself is a git repo
  if (existsSync(join(rootDirectory, ".git"))) {
    const remoteUrl = getGitRemoteUrl(rootDirectory);
    if (remoteUrl) {
      repos.push({ url: remoteUrl, label: undefined });
    }
  }

  // Scan subdirectories for git repos
  try {
    const entries = readdirSync(rootDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const subDir = join(rootDirectory, entry.name);
      if (existsSync(join(subDir, ".git"))) {
        const remoteUrl = getGitRemoteUrl(subDir);
        if (remoteUrl) {
          repos.push({ url: remoteUrl, label: entry.name });
        } else {
          repos.push({ url: subDir, label: entry.name });
        }
      }
    }
  } catch (error) {
    logger.warn("Failed to scan rootDirectory: %s", String(error));
  }

  return repos;
}

function getGitRemoteUrl(dir: string): string | null {
  try {
    const result = execSync("git remote get-url origin", {
      cwd: dir,
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}

function resolveLocalDirectoriesForRemoteUrls(
  rootDirectory: string,
  remoteUrls: Set<string>,
  logger: Logger,
): Map<string, string> {
  const result = new Map<string, string>();

  if (!existsSync(rootDirectory)) {
    logger.warn("rootDirectory does not exist: %s", rootDirectory);
    return result;
  }

  // Check root itself
  if (existsSync(join(rootDirectory, ".git"))) {
    const remoteUrl = getGitRemoteUrl(rootDirectory);
    if (remoteUrl && remoteUrls.has(remoteUrl)) {
      result.set(remoteUrl, rootDirectory);
    }
  }

  // Scan subdirectories
  try {
    const entries = readdirSync(rootDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const subDir = join(rootDirectory, entry.name);
      if (existsSync(join(subDir, ".git"))) {
        const remoteUrl = getGitRemoteUrl(subDir);
        if (remoteUrl && remoteUrls.has(remoteUrl)) {
          result.set(remoteUrl, subDir);
        }
      }
    }
  } catch (error) {
    logger.warn("Failed to scan rootDirectory for local directory resolution: %s", String(error));
  }

  return result;
}

export interface DevPlatformProjectServiceOptions {
  paseoHome: string;
  logger: Logger;
  taskService?: DevPlatformTaskService;
  workspaceRegistry?: WorkspaceRegistry;
  projectRegistry?: ProjectRegistry;
  workspaceGitService?: WorkspaceGitService;
}

export class DevPlatformProjectService {
  private readonly store: DevPlatformProjectStore;
  private readonly logger: Logger;
  private taskService?: DevPlatformTaskService;
  private workspaceRegistry?: WorkspaceRegistry;
  private projectRegistry?: ProjectRegistry;
  private workspaceGitService?: WorkspaceGitService;

  constructor(options: DevPlatformProjectServiceOptions) {
    this.store = new DevPlatformProjectStore(join(options.paseoHome, "dev-platform", "projects"));
    this.logger = options.logger;
    this.taskService = options.taskService;
    this.workspaceRegistry = options.workspaceRegistry;
    this.projectRegistry = options.projectRegistry;
    this.workspaceGitService = options.workspaceGitService;
  }

  setTaskService(taskService: DevPlatformTaskService): void {
    this.taskService = taskService;
  }

  setWorkspaceServices(input: {
    workspaceRegistry: WorkspaceRegistry;
    projectRegistry: ProjectRegistry;
    workspaceGitService: WorkspaceGitService;
  }): void {
    this.workspaceRegistry = input.workspaceRegistry;
    this.projectRegistry = input.projectRegistry;
    this.workspaceGitService = input.workspaceGitService;
  }

  async create(input: CreateDevPlatformProjectInput): Promise<DevPlatformProject> {
    this.logger.info("Creating dev platform project: %s", input.name);
    // Auto-scan git repos if none provided
    const gitRepos =
      input.gitRepos && input.gitRepos.length > 0
        ? input.gitRepos
        : scanGitRepos(input.rootDirectory, this.logger);
    const project = await this.store.create({
      name: input.name,
      rootDirectory: input.rootDirectory,
      description: input.description ?? undefined,
      gitRepos,
      zentaoProjectId: input.zentaoProjectId ?? undefined,
      uatBranch: input.uatBranch ?? undefined,
      prdBranch: input.prdBranch ?? undefined,
      cicdConfig: input.cicdConfig ?? null,
      archivedAt: null,
    });

    // Create workspace records asynchronously — don't block the project creation response
    this.createWorkspaceRecordsForGitRepos(project).catch((error) => {
      this.logger.warn(
        { err: error, projectId: project.id },
        "Background workspace record creation failed for project",
      );
    });

    return project;
  }

  async list(): Promise<DevPlatformProject[]> {
    return this.store.list();
  }

  async inspect(projectId: string): Promise<DevPlatformProject | null> {
    return this.store.get(projectId);
  }

  async update(input: UpdateDevPlatformProjectInput): Promise<DevPlatformProject | null> {
    const existing = await this.store.get(input.id);
    if (!existing) {
      return null;
    }

    const updated: DevPlatformProject = {
      ...existing,
      updatedAt: new Date().toISOString(),
    };

    if (input.name !== undefined) {
      updated.name = input.name;
    }
    if (input.description !== undefined) {
      updated.description = input.description;
    }
    if (input.gitRepos !== undefined) {
      updated.gitRepos = input.gitRepos;
    }
    if (input.zentaoProjectId !== undefined) {
      updated.zentaoProjectId = input.zentaoProjectId;
    }
    if (input.uatBranch !== undefined) {
      updated.uatBranch = input.uatBranch;
    }
    if (input.prdBranch !== undefined) {
      updated.prdBranch = input.prdBranch;
    }
    if (input.cicdConfig !== undefined) {
      updated.cicdConfig = input.cicdConfig;
    }
    if (input.archivedAt !== undefined) {
      updated.archivedAt = input.archivedAt;
    }

    await this.store.put(updated);
    this.logger.info("Updated dev platform project: %s", updated.id);

    if (input.gitRepos !== undefined) {
      this.createWorkspaceRecordsForGitRepos(updated).catch((error) => {
        this.logger.warn(
          { err: error, projectId: updated.id },
          "Background workspace record creation failed for project update",
        );
      });
    }

    return updated;
  }

  async archive(projectId: string): Promise<DevPlatformProject | null> {
    const existing = await this.store.get(projectId);
    if (!existing) {
      return null;
    }
    const now = new Date().toISOString();
    const updated: DevPlatformProject = {
      ...existing,
      archivedAt: now,
      updatedAt: now,
    };
    await this.store.put(updated);

    if (this.taskService) {
      const tasks = await this.taskService.list(projectId);
      for (const task of tasks) {
        await this.taskService.archive(task.id);
      }
      this.logger.info(
        "Archived dev platform project %s (cascade archived %d tasks)",
        projectId,
        tasks.length,
      );
    } else {
      this.logger.info("Archived dev platform project: %s", projectId);
    }

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Workspace record creation for git repos
  // ---------------------------------------------------------------------------

  private async createWorkspaceRecordsForGitRepos(project: DevPlatformProject): Promise<void> {
    if (!this.workspaceRegistry || !this.projectRegistry || !this.workspaceGitService) {
      this.logger.info(
        "Workspace registry services not available; skipping workspace record creation for project %s",
        project.id,
      );
      return;
    }

    if (project.gitRepos.length === 0) {
      return;
    }

    const remoteUrls = new Set(project.gitRepos.map((repo) => repo.url));
    const localDirMap = resolveLocalDirectoriesForRemoteUrls(
      project.rootDirectory,
      remoteUrls,
      this.logger,
    );

    // First: create workspace for rootDirectory (appears first in sidebar)
    await this.ensureWorkspaceForDirectory(project.rootDirectory);

    // Then: create workspace for each gitRepo that has a local directory
    const updatedGitRepos: DevPlatformGitRepo[] = [];
    let workspaceCount = 0;
    let skippedCount = 0;

    for (const gitRepo of project.gitRepos) {
      const localDir = localDirMap.get(gitRepo.url);

      if (!localDir) {
        this.logger.info(
          "No local directory found for git repo %s; skipping workspace creation",
          gitRepo.url,
        );
        updatedGitRepos.push(gitRepo);
        skippedCount++;
        continue;
      }

      // Skip rootDirectory — already handled above
      const normalizedRoot = normalizeWorkspaceId(project.rootDirectory);
      const normalizedDir = normalizeWorkspaceId(localDir);
      if (normalizedDir === normalizedRoot) {
        // Root workspace already created, just link the workspaceId
        updatedGitRepos.push({ ...gitRepo, workspaceId: normalizedRoot });
        continue;
      }

      try {
        const workspaceId = await this.createWorkspaceForDirectory(localDir);
        updatedGitRepos.push({ ...gitRepo, workspaceId });
        workspaceCount++;
      } catch (error) {
        this.logger.warn(
          { err: error, url: gitRepo.url, dir: localDir },
          "Failed to create workspace record for git repo",
        );
        updatedGitRepos.push(gitRepo);
        skippedCount++;
      }
    }

    // Update project with workspaceIds if any were populated
    const hasWorkspaceIds = updatedGitRepos.some((repo) => repo.workspaceId !== undefined);
    if (hasWorkspaceIds) {
      const updatedProject: DevPlatformProject = {
        ...project,
        gitRepos: updatedGitRepos,
        updatedAt: new Date().toISOString(),
      };
      await this.store.put(updatedProject);
    }

    this.logger.info(
      "Created %d workspace records for project %s (%d skipped, rootDirectory handled separately)",
      workspaceCount,
      project.id,
      skippedCount,
    );
  }

  private async ensureWorkspaceForDirectory(cwd: string): Promise<string> {
    if (!this.workspaceRegistry || !this.projectRegistry || !this.workspaceGitService) {
      return normalizeWorkspaceId(cwd);
    }

    const normalizedCwd = normalizeWorkspaceId(cwd);
    const existing = await this.workspaceRegistry.get(normalizedCwd);
    if (existing && !existing.archivedAt) {
      return normalizedCwd;
    }

    const workspaceId = await this.createWorkspaceForDirectory(cwd);
    return workspaceId;
  }

  private async createWorkspaceForDirectory(cwd: string): Promise<string> {
    if (!this.workspaceRegistry || !this.projectRegistry || !this.workspaceGitService) {
      return normalizeWorkspaceId(cwd);
    }

    const normalizedCwd = normalizeWorkspaceId(cwd);
    const checkout = await this.workspaceGitService.getCheckout(normalizedCwd);
    const membership = classifyDirectoryForProjectMembership({ cwd: normalizedCwd, checkout });
    const timestamp = new Date().toISOString();

    const projectRecord = await this.resolveProjectRecordForPlacement({
      membership,
      timestamp,
    });
    await this.projectRegistry.upsert(projectRecord);

    const workspaceRecord = createPersistedWorkspaceRecord({
      workspaceId: membership.workspaceId,
      projectId: projectRecord.projectId,
      cwd: normalizedCwd,
      kind: membership.workspaceKind,
      displayName: membership.workspaceDisplayName,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await this.workspaceRegistry.upsert(workspaceRecord);

    return membership.workspaceId;
  }

  private async resolveProjectRecordForPlacement(input: {
    membership: ReturnType<typeof classifyDirectoryForProjectMembership>;
    timestamp: string;
  }): Promise<PersistedProjectRecord> {
    if (!this.projectRegistry) {
      // Should not happen — called only when services are available
      return createPersistedProjectRecord({
        projectId: input.membership.projectKey,
        rootPath: input.membership.projectRootPath,
        kind: input.membership.projectKind,
        displayName: input.membership.projectName,
        createdAt: input.timestamp,
        updatedAt: input.timestamp,
      });
    }

    const rootPath = input.membership.projectRootPath;
    const kind = input.membership.projectKind;
    const projects = await this.projectRegistry.list();
    const existingProject =
      projects.find((project) => !project.archivedAt && project.rootPath === rootPath) ??
      projects.find((project) => project.rootPath === rootPath) ??
      null;

    if (!existingProject) {
      return createPersistedProjectRecord({
        projectId: input.membership.projectKey,
        rootPath,
        kind,
        displayName: input.membership.projectName,
        createdAt: input.timestamp,
        updatedAt: input.timestamp,
      });
    }

    return {
      ...existingProject,
      rootPath,
      kind,
      archivedAt: null,
      updatedAt: input.timestamp,
    };
  }
}
