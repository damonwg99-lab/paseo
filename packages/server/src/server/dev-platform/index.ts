import type { Logger } from "pino";
import { DevPlatformProjectService } from "./project-service.js";
import { DevPlatformTaskService } from "./task-service.js";
import { DevPlatformContextService } from "./context-service.js";
import { DefaultAgentConfigService } from "./default-agent-config-service.js";
import type { DevPlatformServices } from "./dev-platform-session-handlers.js";

export { DevPlatformProjectService } from "./project-service.js";
export { DevPlatformTaskService } from "./task-service.js";
export { DevPlatformContextService } from "./context-service.js";
export { DefaultAgentConfigService } from "./default-agent-config-service.js";
export type { DevPlatformServices } from "./dev-platform-session-handlers.js";

export function createDevPlatformServices(paseoHome: string, logger: Logger): DevPlatformServices {
  const projectService = new DevPlatformProjectService({ paseoHome, logger });
  const taskService = new DevPlatformTaskService({ paseoHome, logger });
  const contextService = new DevPlatformContextService({ paseoHome, logger });
  const defaultAgentConfigService = new DefaultAgentConfigService({ paseoHome, logger });
  return { projectService, taskService, contextService, defaultAgentConfigService };
}
