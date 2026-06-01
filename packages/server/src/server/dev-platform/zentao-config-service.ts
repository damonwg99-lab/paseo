import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { Logger } from "pino";
import type { ZentaoConfig } from "@getpaseo/protocol/dev-platform/types";
import { ZentaoConfigSchema } from "@getpaseo/protocol/dev-platform/types";

const ZENTAO_CONFIG_FILENAME = "zentao-config.json";

export interface ZentaoConfigServiceOptions {
  paseoHome: string;
  logger: Logger;
}

export class ZentaoConfigService {
  private readonly filePath: string;
  private readonly logger: Logger;

  constructor(private readonly options: ZentaoConfigServiceOptions) {
    this.filePath = join(options.paseoHome, "dev-platform", ZENTAO_CONFIG_FILENAME);
    this.logger = options.logger;
  }

  private async ensureDir(): Promise<void> {
    await mkdir(join(this.options.paseoHome, "dev-platform"), { recursive: true });
  }

  async read(): Promise<ZentaoConfig | null> {
    await this.ensureDir();
    try {
      const content = await readFile(this.filePath, "utf-8");
      return ZentaoConfigSchema.parse(JSON.parse(content));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async save(input: {
    url: string;
    account: string;
    token: string;
    productId?: string;
  }): Promise<ZentaoConfig> {
    await this.ensureDir();
    const config: ZentaoConfig = {
      url: input.url,
      account: input.account,
      token: input.token,
      productId: input.productId ?? undefined,
      lastSyncedAt: null,
    };
    ZentaoConfigSchema.parse(config);
    await writeFile(this.filePath, JSON.stringify(config, null, 2), "utf-8");
    this.logger.info("Saved zentao config");
    return config;
  }

  async verifyConnection(): Promise<{ connected: boolean; error: string | null }> {
    const config = await this.read();
    if (!config) {
      return { connected: false, error: "No zentao configuration found" };
    }
    // Phase 1 stub: always return not connected (actual verification in Phase 2)
    return { connected: false, error: "Connection verification not yet implemented" };
  }
}
