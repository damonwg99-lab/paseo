import { join } from "node:path";
import type { Logger } from "pino";
import type {
  CreateDevPlatformProjectInput,
  DevPlatformProject,
  UpdateDevPlatformProjectInput,
} from "@getpaseo/protocol/dev-platform/types";
import { DevPlatformProjectStore } from "./store.js";

export interface DevPlatformProjectServiceOptions {
  paseoHome: string;
  logger: Logger;
}

export class DevPlatformProjectService {
  private readonly store: DevPlatformProjectStore;
  private readonly logger: Logger;

  constructor(options: DevPlatformProjectServiceOptions) {
    this.store = new DevPlatformProjectStore(join(options.paseoHome, "dev-platform", "projects"));
    this.logger = options.logger;
  }

  async create(input: CreateDevPlatformProjectInput): Promise<DevPlatformProject> {
    this.logger.info("Creating dev platform project: %s", input.name);
    const project = await this.store.create({
      name: input.name,
      description: input.description ?? "",
      gitRepos: input.gitRepos ?? [],
      zentaoProjectId: input.zentaoProjectId ?? undefined,
      uatBranch: input.uatBranch ?? undefined,
      prdBranch: input.prdBranch ?? undefined,
      cicdConfig: input.cicdConfig ?? null,
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

    await this.store.put(updated);
    this.logger.info("Updated dev platform project: %s", updated.id);
    return updated;
  }

  async delete(projectId: string): Promise<boolean> {
    const existing = await this.store.get(projectId);
    if (!existing) {
      return false;
    }
    await this.store.delete(projectId);
    this.logger.info("Deleted dev platform project: %s", projectId);
    return true;
  }
}
