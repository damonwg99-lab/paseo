import { join } from "node:path";
import type { Logger } from "pino";
import { DevPlatformProjectStore } from "./store.js";
import { DevPlatformProjectService } from "./project-service.js";
import { DevPlatformTaskService } from "./task-service.js";
import { DevPlatformContextService } from "./context-service.js";
import { DefaultAgentConfigService } from "./default-agent-config-service.js";
import { ZentaoConfigService } from "./zentao-config-service.js";
import type { DevPlatformServices } from "./dev-platform-session-handlers.js";

export { DevPlatformProjectService } from "./project-service.js";
export { DevPlatformTaskService } from "./task-service.js";
export { DevPlatformContextService } from "./context-service.js";
export { DefaultAgentConfigService } from "./default-agent-config-service.js";
export { ZentaoConfigService } from "./zentao-config-service.js";
export type { DevPlatformServices } from "./dev-platform-session-handlers.js";

export function createDevPlatformServices(paseoHome: string, logger: Logger): DevPlatformServices {
  const projectStore = new DevPlatformProjectStore(join(paseoHome, "dev-platform", "projects"));

  const projectService = new DevPlatformProjectService({ paseoHome, logger });
  const taskService = new DevPlatformTaskService({ paseoHome, logger, projectStore });
  const contextService = new DevPlatformContextService({ paseoHome, logger, projectStore });
  const defaultAgentConfigService = new DefaultAgentConfigService({ paseoHome, logger });
  const zentaoConfigService = new ZentaoConfigService({ paseoHome, logger });

  projectService.setTaskService(taskService);

  return {
    projectService,
    taskService,
    contextService,
    defaultAgentConfigService,
    zentaoConfigService,
  };
}
