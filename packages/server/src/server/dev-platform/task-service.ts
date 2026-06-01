import { join } from "node:path";
import type { Logger } from "pino";
import type {
  CreateDevPlatformTaskInput,
  DevPlatformInteractionMode,
  DevPlatformTask,
  UpdateDevPlatformTaskInput,
} from "@getpaseo/protocol/dev-platform/types";
import { DevPlatformTaskStore, DevPlatformProjectStore } from "./store.js";

export interface DevPlatformTaskServiceOptions {
  paseoHome: string;
  logger: Logger;
  projectStore?: DevPlatformProjectStore;
}

export class DevPlatformTaskService {
  private readonly store: DevPlatformTaskStore;
  private readonly projectStore?: DevPlatformProjectStore;
  private readonly logger: Logger;

  constructor(options: DevPlatformTaskServiceOptions) {
    this.store = new DevPlatformTaskStore(join(options.paseoHome, "dev-platform", "tasks"));
    this.projectStore = options.projectStore;
    this.logger = options.logger;
  }

  async create(input: CreateDevPlatformTaskInput): Promise<DevPlatformTask> {
    if (this.projectStore) {
      const project = await this.projectStore.get(input.projectId);
      if (!project) {
        throw new Error(`Project not found: ${input.projectId}`);
      }
    }

    this.logger.info("Creating dev platform task: %s (type=%s)", input.title, input.type);
    const task = await this.store.create({
      projectId: input.projectId,
      type: input.type,
      title: input.title,
      description: input.description ?? undefined,
      priority: input.priority ?? "medium",
      status: "todo",
      interactionMode: input.interactionMode ?? "step_by_step",
      parentTaskId: input.parentTaskId ?? null,
      agentIds: [],
      activeAgentId: null,
      syncToZentao: input.syncToZentao ?? false,
      zentaoId: null,
      branchName: null,
      deploymentStatus: "not_deployed",
      buildStatus: "not_built",
      dependsOn: [],
      contextIds: [],
      skillIds: [],
      outputDir: null,
      providerConfig: input.providerConfig ?? null,
      involvedRepos: input.involvedRepos ?? [],
      archivedAt: null,
    });
    return task;
  }

  async list(projectId: string): Promise<DevPlatformTask[]> {
    const allTasks = await this.store.list();
    return allTasks.filter((task) => task.projectId === projectId);
  }

  async inspect(taskId: string): Promise<DevPlatformTask | null> {
    return this.store.get(taskId);
  }

  async update(input: UpdateDevPlatformTaskInput): Promise<DevPlatformTask | null> {
    const existing = await this.store.get(input.id);
    if (!existing) {
      return null;
    }

    const updated: DevPlatformTask = {
      ...existing,
      updatedAt: new Date().toISOString(),
    };

    if (input.title !== undefined) {
      updated.title = input.title;
    }
    if (input.description !== undefined) {
      updated.description = input.description;
    }
    if (input.priority !== undefined) {
      updated.priority = input.priority;
    }
    if (input.status !== undefined) {
      updated.status = input.status;
    }
    if (input.interactionMode !== undefined) {
      updated.interactionMode = input.interactionMode;
    }
    if (input.parentTaskId !== undefined) {
      updated.parentTaskId = input.parentTaskId;
    }
    if (input.branchName !== undefined) {
      updated.branchName = input.branchName;
    }
    if (input.providerConfig !== undefined) {
      updated.providerConfig = input.providerConfig;
    }
    if (input.involvedRepos !== undefined) {
      updated.involvedRepos = input.involvedRepos;
    }
    if (input.archivedAt !== undefined) {
      updated.archivedAt = input.archivedAt;
    }

    await this.store.put(updated);
    this.logger.info("Updated dev platform task: %s", updated.id);
    return updated;
  }

  async toggleZentaoSync(taskId: string, enabled: boolean): Promise<DevPlatformTask | null> {
    const existing = await this.store.get(taskId);
    if (!existing) {
      return null;
    }
    const updated: DevPlatformTask = {
      ...existing,
      syncToZentao: enabled,
      updatedAt: new Date().toISOString(),
    };
    await this.store.put(updated);
    this.logger.info("Toggled zentao sync for task %s: %s", taskId, enabled);
    return updated;
  }

  async setInteractionMode(
    taskId: string,
    mode: DevPlatformInteractionMode,
  ): Promise<DevPlatformTask | null> {
    const existing = await this.store.get(taskId);
    if (!existing) {
      return null;
    }
    const updated: DevPlatformTask = {
      ...existing,
      interactionMode: mode,
      updatedAt: new Date().toISOString(),
    };
    await this.store.put(updated);
    this.logger.info("Set interaction mode for task %s: %s", taskId, mode);
    return updated;
  }

  async addContext(taskId: string, contextIds: string[]): Promise<DevPlatformTask | null> {
    const existing = await this.store.get(taskId);
    if (!existing) {
      return null;
    }
    const merged = [...(existing.contextIds ?? []), ...contextIds];
    const unique = [...new Set(merged)];
    const updated: DevPlatformTask = {
      ...existing,
      contextIds: unique,
      updatedAt: new Date().toISOString(),
    };
    await this.store.put(updated);
    return updated;
  }

  async removeContext(taskId: string, contextIds: string[]): Promise<DevPlatformTask | null> {
    const existing = await this.store.get(taskId);
    if (!existing) {
      return null;
    }
    const remaining = (existing.contextIds ?? []).filter((id) => !contextIds.includes(id));
    const updated: DevPlatformTask = {
      ...existing,
      contextIds: remaining,
      updatedAt: new Date().toISOString(),
    };
    await this.store.put(updated);
    return updated;
  }

  async linkAgent(taskId: string, agentId: string): Promise<DevPlatformTask | null> {
    const existing = await this.store.get(taskId);
    if (!existing) {
      return null;
    }
    const agentIds = [...existing.agentIds];
    if (!agentIds.includes(agentId)) {
      agentIds.push(agentId);
    }
    const updated: DevPlatformTask = {
      ...existing,
      agentIds,
      activeAgentId: agentId,
      updatedAt: new Date().toISOString(),
    };
    await this.store.put(updated);
    this.logger.info("Linked agent %s to task %s", agentId, taskId);
    return updated;
  }

  async setActiveAgent(taskId: string, agentId: string): Promise<DevPlatformTask | null> {
    const existing = await this.store.get(taskId);
    if (!existing) {
      return null;
    }
    if (!existing.agentIds.includes(agentId)) {
      return null;
    }
    const updated: DevPlatformTask = {
      ...existing,
      activeAgentId: agentId,
      updatedAt: new Date().toISOString(),
    };
    await this.store.put(updated);
    this.logger.info("Set active agent for task %s: %s", taskId, agentId);
    return updated;
  }

  async setBranch(taskId: string, branchName: string): Promise<DevPlatformTask | null> {
    const existing = await this.store.get(taskId);
    if (!existing) {
      return null;
    }
    const updated: DevPlatformTask = {
      ...existing,
      branchName,
      updatedAt: new Date().toISOString(),
    };
    await this.store.put(updated);
    this.logger.info("Set branch for task %s: %s", taskId, branchName);
    return updated;
  }

  async archive(taskId: string): Promise<DevPlatformTask | null> {
    const existing = await this.store.get(taskId);
    if (!existing) {
      return null;
    }
    const now = new Date().toISOString();
    const updated: DevPlatformTask = {
      ...existing,
      status: "archived",
      archivedAt: now,
      activeAgentId: null,
      updatedAt: now,
    };
    await this.store.put(updated);
    this.logger.info("Archived task %s", taskId);
    return updated;
  }
}
