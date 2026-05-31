import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { Logger } from "pino";
import type {
  DefaultAgentConfig,
  DevPlatformTaskType,
  UpdateDefaultAgentConfigInput,
} from "@getpaseo/protocol/dev-platform/types";
import { DefaultAgentConfigSchema } from "@getpaseo/protocol/dev-platform/types";

const DEFAULT_CONFIGS_FILENAME = "default-agent-configs.json";

const TASK_TYPES: DevPlatformTaskType[] = [
  "requirement",
  "design",
  "development",
  "bug",
  "testing",
  "documentation",
  "deployment",
];

const DEFAULT_PROVIDER_PER_TYPE: Record<DevPlatformTaskType, string> = {
  requirement: "claude",
  design: "claude",
  development: "claude",
  bug: "claude",
  testing: "claude",
  documentation: "claude",
  deployment: "claude",
};

function createDefaultConfig(type: DevPlatformTaskType): DefaultAgentConfig {
  return {
    type,
    provider: DEFAULT_PROVIDER_PER_TYPE[type],
    model: "claude-sonnet-4-6",
    mode: "default",
    systemPromptTemplate: undefined,
    skillIds: undefined,
  };
}

function ensureAllTypesPresent(configs: DefaultAgentConfig[]): DefaultAgentConfig[] {
  const byType = new Map(configs.map((c) => [c.type, c]));
  for (const type of TASK_TYPES) {
    if (!byType.has(type)) {
      byType.set(type, createDefaultConfig(type));
    }
  }
  return [...byType.values()];
}

export interface DefaultAgentConfigServiceOptions {
  paseoHome: string;
  logger: Logger;
}

export class DefaultAgentConfigService {
  private readonly filePath: string;
  private readonly logger: Logger;

  constructor(private readonly options: DefaultAgentConfigServiceOptions) {
    this.filePath = join(options.paseoHome, "dev-platform", DEFAULT_CONFIGS_FILENAME);
    this.logger = options.logger;
  }

  private async ensureDir(): Promise<void> {
    await mkdir(join(this.options.paseoHome, "dev-platform"), { recursive: true });
  }

  async list(): Promise<DefaultAgentConfig[]> {
    await this.ensureDir();
    try {
      const content = await readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(content);
      const configs: DefaultAgentConfig[] = (parsed as unknown[]).map((c) =>
        DefaultAgentConfigSchema.parse(c),
      );
      return ensureAllTypesPresent(configs);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const defaults = ensureAllTypesPresent([]);
        await this.saveAll(defaults);
        return defaults;
      }
      throw error;
    }
  }

  async update(input: UpdateDefaultAgentConfigInput): Promise<DefaultAgentConfig> {
    const configs = await this.list();
    const existing = configs.find((c) => c.type === input.type);
    if (!existing) {
      throw new Error(`No default config for task type: ${input.type}`);
    }

    const updated: DefaultAgentConfig = {
      ...existing,
      ...(input.provider !== undefined ? { provider: input.provider } : {}),
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.mode !== undefined ? { mode: input.mode } : {}),
      ...(input.systemPromptTemplate !== undefined
        ? { systemPromptTemplate: input.systemPromptTemplate }
        : {}),
      ...(input.skillIds !== undefined ? { skillIds: input.skillIds } : {}),
    };

    const newConfigs = configs.map((c) => (c.type === input.type ? updated : c));
    await this.saveAll(newConfigs);
    this.logger.info("Updated default agent config for type: %s", input.type);
    return updated;
  }

  private async saveAll(configs: DefaultAgentConfig[]): Promise<void> {
    await this.ensureDir();
    await writeFile(this.filePath, JSON.stringify(configs, null, 2), "utf-8");
  }
}
