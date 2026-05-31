import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  DevPlatformProjectSchema,
  DevPlatformTaskSchema,
  DevPlatformContextSchema,
  type DevPlatformProject,
  type DevPlatformTask,
  type DevPlatformContext,
} from "@getpaseo/protocol/dev-platform/types";

function generateId(): string {
  return randomBytes(8).toString("hex");
}

export class DevPlatformProjectStore {
  constructor(private readonly dir: string) {}

  private filePath(id: string): string {
    return join(this.dir, `${id}.json`);
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  async list(): Promise<DevPlatformProject[]> {
    await this.ensureDir();
    const entries = await readdir(this.dir, { withFileTypes: true });
    const projects = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
          const content = await readFile(join(this.dir, entry.name), "utf-8");
          return DevPlatformProjectSchema.parse(JSON.parse(content));
        }),
    );
    return projects.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async get(id: string): Promise<DevPlatformProject | null> {
    await this.ensureDir();
    try {
      const content = await readFile(this.filePath(id), "utf-8");
      return DevPlatformProjectSchema.parse(JSON.parse(content));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async create(
    project: Omit<DevPlatformProject, "id" | "createdAt" | "updatedAt">,
  ): Promise<DevPlatformProject> {
    const now = new Date().toISOString();
    const created: DevPlatformProject = {
      ...project,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    await this.put(created);
    return created;
  }

  async put(project: DevPlatformProject): Promise<void> {
    await this.ensureDir();
    await writeFile(this.filePath(project.id), JSON.stringify(project, null, 2), "utf-8");
  }

  async delete(id: string): Promise<void> {
    await this.ensureDir();
    await rm(this.filePath(id), { force: true });
  }
}

export class DevPlatformTaskStore {
  constructor(private readonly dir: string) {}

  private filePath(id: string): string {
    return join(this.dir, `${id}.json`);
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  async list(): Promise<DevPlatformTask[]> {
    await this.ensureDir();
    const entries = await readdir(this.dir, { withFileTypes: true });
    const tasks = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
          const content = await readFile(join(this.dir, entry.name), "utf-8");
          return DevPlatformTaskSchema.parse(JSON.parse(content));
        }),
    );
    return tasks.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async get(id: string): Promise<DevPlatformTask | null> {
    await this.ensureDir();
    try {
      const content = await readFile(this.filePath(id), "utf-8");
      return DevPlatformTaskSchema.parse(JSON.parse(content));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async create(
    task: Omit<DevPlatformTask, "id" | "createdAt" | "updatedAt">,
  ): Promise<DevPlatformTask> {
    const now = new Date().toISOString();
    const created: DevPlatformTask = {
      ...task,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    await this.put(created);
    return created;
  }

  async put(task: DevPlatformTask): Promise<void> {
    await this.ensureDir();
    await writeFile(this.filePath(task.id), JSON.stringify(task, null, 2), "utf-8");
  }

  async delete(id: string): Promise<void> {
    await this.ensureDir();
    await rm(this.filePath(id), { force: true });
  }
}

export class DevPlatformContextStore {
  constructor(private readonly dir: string) {}

  private filePath(id: string): string {
    return join(this.dir, `${id}.json`);
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  async list(): Promise<DevPlatformContext[]> {
    await this.ensureDir();
    const entries = await readdir(this.dir, { withFileTypes: true });
    const contexts = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
          const content = await readFile(join(this.dir, entry.name), "utf-8");
          return DevPlatformContextSchema.parse(JSON.parse(content));
        }),
    );
    return contexts.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async get(id: string): Promise<DevPlatformContext | null> {
    await this.ensureDir();
    try {
      const content = await readFile(this.filePath(id), "utf-8");
      return DevPlatformContextSchema.parse(JSON.parse(content));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async create(
    context: Omit<DevPlatformContext, "id" | "createdAt" | "updatedAt">,
  ): Promise<DevPlatformContext> {
    const now = new Date().toISOString();
    const created: DevPlatformContext = {
      ...context,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    await this.put(created);
    return created;
  }

  async put(context: DevPlatformContext): Promise<void> {
    await this.ensureDir();
    await writeFile(this.filePath(context.id), JSON.stringify(context, null, 2), "utf-8");
  }

  async delete(id: string): Promise<void> {
    await this.ensureDir();
    await rm(this.filePath(id), { force: true });
  }
}
