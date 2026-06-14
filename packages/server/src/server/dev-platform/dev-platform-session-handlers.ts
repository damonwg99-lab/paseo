import type { SessionInboundMessage } from "@getpaseo/protocol/messages";
import type { DevPlatformProjectService } from "./project-service.js";
import type { DevPlatformTaskService } from "./task-service.js";
import type { DevPlatformContextService } from "./context-service.js";
import type { DefaultAgentConfigService } from "./default-agent-config-service.js";
import type { ZentaoConfigService } from "./zentao-config-service.js";
import { getGitRepoStatus } from "./git-repo-monitor.js";
import type { Logger } from "pino";
import type {
  CreateDevPlatformProjectInput,
  UpdateDevPlatformProjectInput,
  CreateDevPlatformTaskInput,
  UpdateDevPlatformTaskInput,
} from "@getpaseo/protocol/dev-platform/types";

export interface DevPlatformServices {
  projectService: DevPlatformProjectService;
  taskService: DevPlatformTaskService;
  contextService: DevPlatformContextService;
  defaultAgentConfigService: DefaultAgentConfigService;
  zentaoConfigService: ZentaoConfigService;
  logger: Logger;
}

export function dispatchDevPlatformMessage(
  msg: SessionInboundMessage,
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> | undefined {
  return (
    dispatchDevProjectMessage(msg, services, emit) ??
    dispatchDevTaskMessage(msg, services, emit) ??
    dispatchDevContextMessage(msg, services, emit) ??
    dispatchDevDefaultConfigMessage(msg, services, emit) ??
    dispatchDevZentaoMessage(msg, services, emit) ??
    dispatchDevRepoMessage(msg, services, emit)
  );
}

function dispatchDevProjectMessage(
  msg: SessionInboundMessage,
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> | undefined {
  switch (msg.type) {
    case "dev.project.create":
      return handleDevProjectCreate(msg, services, emit);
    case "dev.project.list":
      return handleDevProjectList(msg, services, emit);
    case "dev.project.inspect":
      return handleDevProjectInspect(msg, services, emit);
    case "dev.project.update":
      return handleDevProjectUpdate(msg, services, emit);
    case "dev.project.archive":
      return handleDevProjectArchive(msg, services, emit);
    default:
      return undefined;
  }
}

function dispatchDevTaskMessage(
  msg: SessionInboundMessage,
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> | undefined {
  switch (msg.type) {
    case "dev.task.create":
      return handleDevTaskCreate(msg, services, emit);
    case "dev.task.list":
      return handleDevTaskList(msg, services, emit);
    case "dev.task.inspect":
      return handleDevTaskInspect(msg, services, emit);
    case "dev.task.update":
      return handleDevTaskUpdate(msg, services, emit);
    case "dev.task.toggle_zentao_sync":
      return handleDevTaskToggleZentaoSync(msg, services, emit);
    case "dev.task.set_interaction_mode":
      return handleDevTaskSetInteractionMode(msg, services, emit);
    case "dev.task.add_context":
      return handleDevTaskAddContext(msg, services, emit);
    case "dev.task.remove_context":
      return handleDevTaskRemoveContext(msg, services, emit);
    case "dev.task.link_agent":
      return handleDevTaskLinkAgent(msg, services, emit);
    case "dev.task.set_active_agent":
      return handleDevTaskSetActiveAgent(msg, services, emit);
    case "dev.task.set_branch":
      return handleDevTaskSetBranch(msg, services, emit);
    case "dev.task.archive":
      return handleDevTaskArchive(msg, services, emit);
    case "dev.task.activity.list":
      return handleDevTaskActivityList(msg, services, emit);
    default:
      return undefined;
  }
}

function dispatchDevContextMessage(
  msg: SessionInboundMessage,
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> | undefined {
  switch (msg.type) {
    case "dev.context.list":
      return handleDevContextList(msg, services, emit);
    case "dev.context.add":
      return handleDevContextAdd(msg, services, emit);
    case "dev.context.remove":
      return handleDevContextRemove(msg, services, emit);
    default:
      return undefined;
  }
}

function dispatchDevDefaultConfigMessage(
  msg: SessionInboundMessage,
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> | undefined {
  switch (msg.type) {
    case "dev.default_config.list":
      return handleDevDefaultConfigList(msg, services, emit);
    case "dev.default_config.update":
      return handleDevDefaultConfigUpdate(msg, services, emit);
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Helper to emit dev-platform responses
// ---------------------------------------------------------------------------

function emitError(
  msg: { requestId: string },
  responseType: string,
  error: string,
  emit: (msg: unknown) => void,
): void {
  emit({
    type: responseType,
    payload: { requestId: msg.requestId, error },
  });
}

// ---------------------------------------------------------------------------
// dev.project.* handlers
// ---------------------------------------------------------------------------

async function handleDevProjectCreate(
  msg: SessionInboundMessage & { type: "dev.project.create" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const project = await services.projectService.create({
      name: msg.name,
      rootDirectory: msg.rootDirectory,
      description: msg.description,
      gitRepos: msg.gitRepos,
      zentaoProjectId: msg.zentaoProjectId,
      uatBranch: msg.uatBranch,
      prdBranch: msg.prdBranch,
      cicdConfig: msg.cicdConfig,
    } satisfies CreateDevPlatformProjectInput);
    emit({
      type: "dev.project.create/response",
      payload: { requestId: msg.requestId, project, error: null },
    });
  } catch (error) {
    emitError(msg, "dev.project.create/response", String(error), emit);
  }
}

async function handleDevProjectList(
  msg: SessionInboundMessage & { type: "dev.project.list" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const projects = await services.projectService.list();
    emit({
      type: "dev.project.list/response",
      payload: { requestId: msg.requestId, projects, error: null },
    });
  } catch (error) {
    emitError(msg, "dev.project.list/response", String(error), emit);
  }
}

async function handleDevProjectInspect(
  msg: SessionInboundMessage & { type: "dev.project.inspect" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const project = await services.projectService.inspect(msg.projectId);
    emit({
      type: "dev.project.inspect/response",
      payload: { requestId: msg.requestId, project, error: null },
    });
  } catch (error) {
    emitError(msg, "dev.project.inspect/response", String(error), emit);
  }
}

async function handleDevProjectUpdate(
  msg: SessionInboundMessage & { type: "dev.project.update" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const project = await services.projectService.update({
      id: msg.projectId,
      name: msg.name,
      description: msg.description,
      gitRepos: msg.gitRepos,
      zentaoProjectId: msg.zentaoProjectId,
      uatBranch: msg.uatBranch,
      prdBranch: msg.prdBranch,
      cicdConfig: msg.cicdConfig,
      archivedAt: msg.archivedAt,
    } satisfies UpdateDevPlatformProjectInput);
    emit({
      type: "dev.project.update/response",
      payload: { requestId: msg.requestId, project, error: null },
    });
  } catch (error) {
    emitError(msg, "dev.project.update/response", String(error), emit);
  }
}

async function handleDevProjectArchive(
  msg: SessionInboundMessage & { type: "dev.project.archive" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const project = await services.projectService.archive(msg.projectId);
    emit({
      type: "dev.project.archive/response",
      payload: { requestId: msg.requestId, project, error: project ? null : "Project not found" },
    });
  } catch (error) {
    emitError(msg, "dev.project.archive/response", String(error), emit);
  }
}

// ---------------------------------------------------------------------------
// dev.task.* handlers
// ---------------------------------------------------------------------------

async function handleDevTaskCreate(
  msg: SessionInboundMessage & { type: "dev.task.create" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const task = await services.taskService.create({
      projectId: msg.projectId,
      type: msg.taskType,
      title: msg.title,
      description: msg.description,
      priority: msg.priority,
      interactionMode: msg.interactionMode,
      parentTaskId: msg.parentTaskId,
      syncToZentao: msg.syncToZentao,
      providerConfig: msg.providerConfig,
      involvedRepos: msg.involvedRepos,
    } satisfies CreateDevPlatformTaskInput);
    emit({
      type: "dev.task.create/response",
      payload: { requestId: msg.requestId, task, error: null },
    });
  } catch (error) {
    emitError(msg, "dev.task.create/response", String(error), emit);
  }
}

async function handleDevTaskList(
  msg: SessionInboundMessage & { type: "dev.task.list" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const tasks = await services.taskService.list(msg.projectId);
    emit({
      type: "dev.task.list/response",
      payload: { requestId: msg.requestId, tasks, error: null },
    });
  } catch (error) {
    emitError(msg, "dev.task.list/response", String(error), emit);
  }
}

async function handleDevTaskInspect(
  msg: SessionInboundMessage & { type: "dev.task.inspect" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const task = await services.taskService.inspect(msg.taskId);
    emit({
      type: "dev.task.inspect/response",
      payload: { requestId: msg.requestId, task, error: null },
    });
  } catch (error) {
    emitError(msg, "dev.task.inspect/response", String(error), emit);
  }
}

async function handleDevTaskUpdate(
  msg: SessionInboundMessage & { type: "dev.task.update" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const task = await services.taskService.update({
      id: msg.taskId,
      title: msg.title,
      description: msg.description,
      priority: msg.priority,
      status: msg.status,
      interactionMode: msg.interactionMode,
      parentTaskId: msg.parentTaskId,
      branchName: msg.branchName,
      providerConfig: msg.providerConfig,
      involvedRepos: msg.involvedRepos,
      archivedAt: msg.archivedAt,
    } satisfies UpdateDevPlatformTaskInput);
    emit({
      type: "dev.task.update/response",
      payload: { requestId: msg.requestId, task, error: null },
    });
  } catch (error) {
    emitError(msg, "dev.task.update/response", String(error), emit);
  }
}

async function handleDevTaskToggleZentaoSync(
  msg: SessionInboundMessage & { type: "dev.task.toggle_zentao_sync" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const task = await services.taskService.toggleZentaoSync(msg.taskId, msg.enabled);
    emit({
      type: "dev.task.toggle_zentao_sync/response",
      payload: { requestId: msg.requestId, task, error: task ? null : "Task not found" },
    });
  } catch (error) {
    emitError(msg, "dev.task.toggle_zentao_sync/response", String(error), emit);
  }
}

async function handleDevTaskSetInteractionMode(
  msg: SessionInboundMessage & { type: "dev.task.set_interaction_mode" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const task = await services.taskService.setInteractionMode(msg.taskId, msg.interactionMode);
    emit({
      type: "dev.task.set_interaction_mode/response",
      payload: { requestId: msg.requestId, task, error: task ? null : "Task not found" },
    });
  } catch (error) {
    emitError(msg, "dev.task.set_interaction_mode/response", String(error), emit);
  }
}

async function handleDevTaskAddContext(
  msg: SessionInboundMessage & { type: "dev.task.add_context" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const task = await services.taskService.addContext(msg.taskId, msg.contextIds);
    emit({
      type: "dev.task.add_context/response",
      payload: { requestId: msg.requestId, task, error: task ? null : "Task not found" },
    });
  } catch (error) {
    emitError(msg, "dev.task.add_context/response", String(error), emit);
  }
}

async function handleDevTaskRemoveContext(
  msg: SessionInboundMessage & { type: "dev.task.remove_context" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const task = await services.taskService.removeContext(msg.taskId, msg.contextIds);
    emit({
      type: "dev.task.remove_context/response",
      payload: { requestId: msg.requestId, task, error: task ? null : "Task not found" },
    });
  } catch (error) {
    emitError(msg, "dev.task.remove_context/response", String(error), emit);
  }
}

async function handleDevTaskLinkAgent(
  msg: SessionInboundMessage & { type: "dev.task.link_agent" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const task = await services.taskService.linkAgent(msg.taskId, msg.agentId);
    emit({
      type: "dev.task.link_agent/response",
      payload: { requestId: msg.requestId, task, error: task ? null : "Task not found" },
    });
  } catch (error) {
    emitError(msg, "dev.task.link_agent/response", String(error), emit);
  }
}

async function handleDevTaskSetActiveAgent(
  msg: SessionInboundMessage & { type: "dev.task.set_active_agent" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const task = await services.taskService.setActiveAgent(msg.taskId, msg.agentId);
    emit({
      type: "dev.task.set_active_agent/response",
      payload: { requestId: msg.requestId, task, error: task ? null : "Task or agent not found" },
    });
  } catch (error) {
    emitError(msg, "dev.task.set_active_agent/response", String(error), emit);
  }
}

async function handleDevTaskSetBranch(
  msg: SessionInboundMessage & { type: "dev.task.set_branch" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const task = await services.taskService.setBranch(msg.taskId, msg.branchName);
    emit({
      type: "dev.task.set_branch/response",
      payload: { requestId: msg.requestId, task, error: task ? null : "Task not found" },
    });
  } catch (error) {
    emitError(msg, "dev.task.set_branch/response", String(error), emit);
  }
}

async function handleDevTaskArchive(
  msg: SessionInboundMessage & { type: "dev.task.archive" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const task = await services.taskService.archive(msg.taskId);
    emit({
      type: "dev.task.archive/response",
      payload: { requestId: msg.requestId, task, error: task ? null : "Task not found" },
    });
  } catch (error) {
    emitError(msg, "dev.task.archive/response", String(error), emit);
  }
}

async function handleDevTaskActivityList(
  msg: SessionInboundMessage & { type: "dev.task.activity.list" },
  _services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  // Phase 1: return empty array (TaskActivity persistence comes in Phase 2)
  emit({
    type: "dev.task.activity.list/response",
    payload: { requestId: msg.requestId, activities: [], error: null },
  });
}

// ---------------------------------------------------------------------------
// dev.context.* handlers
// ---------------------------------------------------------------------------

async function handleDevContextList(
  msg: SessionInboundMessage & { type: "dev.context.list" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const contexts = await services.contextService.list(msg.projectId);
    emit({
      type: "dev.context.list/response",
      payload: { requestId: msg.requestId, contexts, error: null },
    });
  } catch (error) {
    emitError(msg, "dev.context.list/response", String(error), emit);
  }
}

async function handleDevContextAdd(
  msg: SessionInboundMessage & { type: "dev.context.add" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const context = await services.contextService.add({
      projectId: msg.projectId,
      sourceType: msg.sourceType,
      sourceId: msg.sourceId,
      title: msg.title,
      filePath: msg.filePath,
      contentPreview: msg.contentPreview,
    });
    emit({
      type: "dev.context.add/response",
      payload: { requestId: msg.requestId, context, error: null },
    });
  } catch (error) {
    emitError(msg, "dev.context.add/response", String(error), emit);
  }
}

async function handleDevContextRemove(
  msg: SessionInboundMessage & { type: "dev.context.remove" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    await services.contextService.remove(msg.contextId);
    emit({
      type: "dev.context.remove/response",
      payload: { requestId: msg.requestId, contextId: msg.contextId, error: null },
    });
  } catch (error) {
    emitError(msg, "dev.context.remove/response", String(error), emit);
  }
}

// ---------------------------------------------------------------------------
// dev.default_config.* handlers
// ---------------------------------------------------------------------------

async function handleDevDefaultConfigList(
  msg: SessionInboundMessage & { type: "dev.default_config.list" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const configs = await services.defaultAgentConfigService.list();
    emit({
      type: "dev.default_config.list/response",
      payload: { requestId: msg.requestId, configs, error: null },
    });
  } catch (error) {
    emitError(msg, "dev.default_config.list/response", String(error), emit);
  }
}

async function handleDevDefaultConfigUpdate(
  msg: SessionInboundMessage & { type: "dev.default_config.update" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const config = await services.defaultAgentConfigService.update({
      type: msg.taskType,
      provider: msg.provider,
      model: msg.model,
      mode: msg.mode,
      systemPromptTemplate: msg.systemPromptTemplate,
      skillIds: msg.skillIds,
    });
    emit({
      type: "dev.default_config.update/response",
      payload: { requestId: msg.requestId, config, error: null },
    });
  } catch (error) {
    emitError(msg, "dev.default_config.update/response", String(error), emit);
  }
}

// ---------------------------------------------------------------------------
// dev.repo.* handlers
// ---------------------------------------------------------------------------

function dispatchDevRepoMessage(
  msg: SessionInboundMessage,
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> | undefined {
  switch (msg.type) {
    case "dev.repo.status":
      return handleDevRepoStatus(msg, services, emit);
    case "dev.repo.status_all":
      return handleDevRepoStatusAll(msg, services, emit);
    default:
      return undefined;
  }
}

async function handleDevRepoStatus(
  msg: SessionInboundMessage & { type: "dev.repo.status" },
  _services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const status = getGitRepoStatus(msg.repoPath);
    emit({
      type: "dev.repo.status/response",
      payload: { requestId: msg.requestId, status, error: null },
    });
  } catch (error) {
    emitError(msg, "dev.repo.status/response", String(error), emit);
  }
}

async function handleDevRepoStatusAll(
  msg: SessionInboundMessage & { type: "dev.repo.status_all" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const project = await services.projectService.inspect(msg.projectId);
    if (!project) {
      emit({
        type: "dev.repo.status_all/response",
        payload: { requestId: msg.requestId, statuses: [], error: "Project not found" },
      });
      return;
    }

    const statuses: { repoPath: string; status: ReturnType<typeof getGitRepoStatus> }[] = [];

    // Get status for rootDirectory itself (if it's a git repo)
    const rootStatus = getGitRepoStatus(project.rootDirectory);
    if (rootStatus) {
      statuses.push({ repoPath: project.rootDirectory, status: rootStatus });
    }

    // Get status for each git repo
    for (const repo of project.gitRepos) {
      const repoPath =
        repo.relativePath === "."
          ? project.rootDirectory
          : `${project.rootDirectory}/${repo.relativePath}`;
      const status = getGitRepoStatus(repoPath);
      if (status) {
        statuses.push({ repoPath, status });
      }
    }

    emit({
      type: "dev.repo.status_all/response",
      payload: { requestId: msg.requestId, statuses, error: null },
    });
  } catch (error) {
    emitError(msg, "dev.repo.status_all/response", String(error), emit);
  }
}

// ---------------------------------------------------------------------------
// dev.zentao.* handlers
// ---------------------------------------------------------------------------

function dispatchDevZentaoMessage(
  msg: SessionInboundMessage,
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> | undefined {
  switch (msg.type) {
    case "dev.zentao.configure":
      return handleDevZentaoConfigure(msg, services, emit);
    case "dev.zentao.configure.status":
      return handleDevZentaoConfigureStatus(msg, services, emit);
    default:
      return undefined;
  }
}

async function handleDevZentaoConfigure(
  msg: SessionInboundMessage & { type: "dev.zentao.configure" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const config = await services.zentaoConfigService.save({
      url: msg.url,
      account: msg.account,
      token: msg.password,
      productId: msg.productId,
    });
    const { connected } = await services.zentaoConfigService.verifyConnection();
    emit({
      type: "dev.zentao.configure/response",
      payload: { requestId: msg.requestId, config, connected, error: null },
    });
  } catch (error) {
    emitError(msg, "dev.zentao.configure/response", String(error), emit);
  }
}

async function handleDevZentaoConfigureStatus(
  msg: SessionInboundMessage & { type: "dev.zentao.configure.status" },
  services: DevPlatformServices,
  emit: (msg: unknown) => void,
): Promise<void> {
  try {
    const config = await services.zentaoConfigService.read();
    const { connected } = await services.zentaoConfigService.verifyConnection();
    emit({
      type: "dev.zentao.configure.status/response",
      payload: { requestId: msg.requestId, config, connected, error: null },
    });
  } catch (error) {
    emitError(msg, "dev.zentao.configure.status/response", String(error), emit);
  }
}
