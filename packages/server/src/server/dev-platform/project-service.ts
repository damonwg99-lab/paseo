import { join } from "node:path";
import type { Logger } from "pino";
import type {
  CreateDevPlatformProjectInput,
  DevPlatformProject,
  UpdateDevPlatformProjectInput,
} from "@getpaseo/protocol/dev-platform/types";
import { DevPlatformProjectStore } from "./store.js";
import type { DevPlatformTaskService } from "./task-service.js";

export interface DevPlatformProjectServiceOptions {
  paseoHome: string;
  logger: Logger;
  taskService?: DevPlatformTaskService;
}

export class DevPlatformProjectService {
  private readonly store: DevPlatformProjectStore;
  private readonly logger: Logger;
  private taskService?: DevPlatformTaskService;

  constructor(options: DevPlatformProjectServiceOptions) {
    this.store = new DevPlatformProjectStore(join(options.paseoHome, "dev-platform", "projects"));
    this.logger = options.logger;
    this.taskService = options.taskService;
  }

  setTaskService(taskService: DevPlatformTaskService): void {
    this.taskService = taskService;
  }

  async create(input: CreateDevPlatformProjectInput): Promise<DevPlatformProject> {
    this.logger.info("Creating dev platform project: %s", input.name);
    const project = await this.store.create({
      name: input.name,
      rootDirectory: input.rootDirectory,
      description: input.description ?? undefined,
      gitRepos: input.gitRepos ?? [],
      zentaoProjectId: input.zentaoProjectId ?? undefined,
      uatBranch: input.uatBranch ?? undefined,
      prdBranch: input.prdBranch ?? undefined,
      cicdConfig: input.cicdConfig ?? null,
      archivedAt: null,
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
}
