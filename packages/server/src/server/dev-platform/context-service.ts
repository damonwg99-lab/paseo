import { join } from "node:path";
import type { Logger } from "pino";
import type {
  CreateDevPlatformContextInput,
  DevPlatformContext,
} from "@getpaseo/protocol/dev-platform/types";
import { DevPlatformContextStore, DevPlatformProjectStore } from "./store.js";

export interface DevPlatformContextServiceOptions {
  paseoHome: string;
  logger: Logger;
  projectStore?: DevPlatformProjectStore;
}

export class DevPlatformContextService {
  private readonly store: DevPlatformContextStore;
  private readonly projectStore?: DevPlatformProjectStore;
  private readonly logger: Logger;

  constructor(options: DevPlatformContextServiceOptions) {
    this.store = new DevPlatformContextStore(join(options.paseoHome, "dev-platform", "contexts"));
    this.projectStore = options.projectStore;
    this.logger = options.logger;
  }

  async list(projectId: string): Promise<DevPlatformContext[]> {
    const all = await this.store.list();
    return all.filter((ctx) => ctx.projectId === projectId);
  }

  async add(input: CreateDevPlatformContextInput): Promise<DevPlatformContext> {
    if (this.projectStore) {
      const project = await this.projectStore.get(input.projectId);
      if (!project) {
        throw new Error(`Project not found: ${input.projectId}`);
      }
    }
    this.logger.info("Adding dev platform context: %s (type=%s)", input.title, input.sourceType);
    const context = await this.store.create({
      projectId: input.projectId,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? undefined,
      title: input.title,
      filePath: input.filePath ?? undefined,
      contentPreview: input.contentPreview ?? undefined,
    });
    return context;
  }

  async remove(contextId: string): Promise<boolean> {
    const existing = await this.store.get(contextId);
    if (!existing) {
      return false;
    }
    await this.store.delete(contextId);
    this.logger.info("Removed dev platform context: %s", contextId);
    return true;
  }
}
