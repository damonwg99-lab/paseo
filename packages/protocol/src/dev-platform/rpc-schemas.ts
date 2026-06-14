import { z } from "zod";
import {
  DevPlatformProjectSchema,
  DevPlatformTaskSchema,
  DevPlatformContextSchema,
  ZentaoConfigSchema,
  ZentaoSyncMappingSchema,
  DefaultAgentConfigSchema,
  TaskActivitySchema,
  DevPlatformGitRepoSchema,
  CicdConfigSchema,
  DevPlatformTaskTypeSchema,
  DevPlatformTaskStatusSchema,
  DevPlatformInteractionModeSchema,
  DevPlatformDeploymentStatusSchema,
  DevPlatformBuildStatusSchema,
  DevPlatformProviderConfigSchema,
  ZentaoSyncStatusSchema,
} from "./types.js";

// ---------------------------------------------------------------------------
// dev.project.* — Project CRUD + branch status + CI/CD
// ---------------------------------------------------------------------------

export const DevProjectCreateRequestSchema = z.object({
  type: z.literal("dev.project.create"),
  requestId: z.string(),
  name: z.string().trim().min(1),
  rootDirectory: z.string().trim().min(1),
  description: z.string().optional(),
  gitRepos: z.array(DevPlatformGitRepoSchema).optional(),
  /** Paseo workspace IDs to associate. Typically [rootDirectory] for dev-platform projects. */
  workspaceIds: z.array(z.string()).optional(),
  zentaoProjectId: z.string().optional(),
  uatBranch: z.string().optional(),
  prdBranch: z.string().optional(),
  cicdConfig: CicdConfigSchema.nullable().optional(),
});

export const DevProjectCreateResponseSchema = z.object({
  type: z.literal("dev.project.create/response"),
  payload: z.object({
    requestId: z.string(),
    project: DevPlatformProjectSchema.nullable(),
    error: z.string().nullable(),
  }),
});

export const DevProjectListRequestSchema = z.object({
  type: z.literal("dev.project.list"),
  requestId: z.string(),
});

export const DevProjectListResponseSchema = z.object({
  type: z.literal("dev.project.list/response"),
  payload: z.object({
    requestId: z.string(),
    projects: z.array(DevPlatformProjectSchema),
    error: z.string().nullable(),
  }),
});

export const DevProjectInspectRequestSchema = z.object({
  type: z.literal("dev.project.inspect"),
  requestId: z.string(),
  projectId: z.string(),
});

export const DevProjectInspectResponseSchema = z.object({
  type: z.literal("dev.project.inspect/response"),
  payload: z.object({
    requestId: z.string(),
    project: DevPlatformProjectSchema.nullable(),
    error: z.string().nullable(),
  }),
});

export const DevProjectUpdateRequestSchema = z.object({
  type: z.literal("dev.project.update"),
  requestId: z.string(),
  projectId: z.string(),
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  gitRepos: z.array(DevPlatformGitRepoSchema).optional(),
  /** Update associated workspace IDs. */
  workspaceIds: z.array(z.string()).optional(),
  zentaoProjectId: z.string().optional(),
  uatBranch: z.string().optional(),
  prdBranch: z.string().optional(),
  cicdConfig: CicdConfigSchema.nullable().optional(),
  archivedAt: z.string().nullable().optional(),
});

export const DevProjectUpdateResponseSchema = z.object({
  type: z.literal("dev.project.update/response"),
  payload: z.object({
    requestId: z.string(),
    project: DevPlatformProjectSchema.nullable(),
    error: z.string().nullable(),
  }),
});

export const DevProjectArchiveRequestSchema = z.object({
  type: z.literal("dev.project.archive"),
  requestId: z.string(),
  projectId: z.string(),
});

export const DevProjectArchiveResponseSchema = z.object({
  type: z.literal("dev.project.archive/response"),
  payload: z.object({
    requestId: z.string(),
    project: DevPlatformProjectSchema.nullable(),
    error: z.string().nullable(),
  }),
});

// dev.project.branch_status.list — branch management view data

export const BranchStatusEntrySchema = z.object({
  branchName: z.string(),
  repoLabel: z.string().optional(),
  mergedToUat: z.boolean(),
  mergedToPrd: z.boolean(),
  associatedTaskIds: z.array(z.string()),
  aheadBy: z.number().int().nonnegative().optional(),
  behindBy: z.number().int().nonnegative().optional(),
  buildStatus: DevPlatformBuildStatusSchema.optional(),
  lastActiveAt: z.string().optional(),
});
export type BranchStatusEntry = z.infer<typeof BranchStatusEntrySchema>;

export const DevProjectBranchStatusListRequestSchema = z.object({
  type: z.literal("dev.project.branch_status.list"),
  requestId: z.string(),
  projectId: z.string(),
});

export const DevProjectBranchStatusListResponseSchema = z.object({
  type: z.literal("dev.project.branch_status.list/response"),
  payload: z.object({
    requestId: z.string(),
    branches: z.array(BranchStatusEntrySchema),
    error: z.string().nullable(),
  }),
});

// dev.project.cicd.* — CI/CD configuration and operations

export const DevProjectCicdConfigureRequestSchema = z.object({
  type: z.literal("dev.project.cicd.configure"),
  requestId: z.string(),
  projectId: z.string(),
  cicdConfig: CicdConfigSchema,
});

export const DevProjectCicdConfigureResponseSchema = z.object({
  type: z.literal("dev.project.cicd.configure/response"),
  payload: z.object({
    requestId: z.string(),
    project: DevPlatformProjectSchema.nullable(),
    error: z.string().nullable(),
  }),
});

export const DevProjectCicdStatusRequestSchema = z.object({
  type: z.literal("dev.project.cicd.status"),
  requestId: z.string(),
  projectId: z.string(),
});

export const DevProjectCicdStatusResponseSchema = z.object({
  type: z.literal("dev.project.cicd.status/response"),
  payload: z.object({
    requestId: z.string(),
    cicdConfig: CicdConfigSchema.nullable(),
    connected: z.boolean().optional(),
    error: z.string().nullable(),
  }),
});

export const DevProjectCicdTriggerBuildRequestSchema = z.object({
  type: z.literal("dev.project.cicd.trigger_build"),
  requestId: z.string(),
  projectId: z.string(),
  environment: z.enum(["uat", "production"]),
});

export const DevProjectCicdTriggerBuildResponseSchema = z.object({
  type: z.literal("dev.project.cicd.trigger_build/response"),
  payload: z.object({
    requestId: z.string(),
    triggered: z.boolean(),
    buildNumber: z.number().int().optional(),
    buildUrl: z.string().optional(),
    error: z.string().nullable(),
  }),
});

export const DevProjectCicdBuildStatusRequestSchema = z.object({
  type: z.literal("dev.project.cicd.build_status"),
  requestId: z.string(),
  projectId: z.string(),
  environment: z.enum(["uat", "production"]).optional(),
});

export const DevProjectCicdBuildStatusResponseSchema = z.object({
  type: z.literal("dev.project.cicd.build_status/response"),
  payload: z.object({
    requestId: z.string(),
    buildStatus: DevPlatformBuildStatusSchema,
    buildNumber: z.number().int().optional(),
    buildUrl: z.string().optional(),
    error: z.string().nullable(),
  }),
});

// ---------------------------------------------------------------------------
// dev.task.* — Task CRUD + agent lifecycle + deployment + context
// ---------------------------------------------------------------------------

export const DevTaskCreateRequestSchema = z.object({
  type: z.literal("dev.task.create"),
  requestId: z.string(),
  projectId: z.string(),
  taskType: DevPlatformTaskTypeSchema,
  title: z.string().trim().min(1),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  interactionMode: DevPlatformInteractionModeSchema.optional(),
  parentTaskId: z.string().nullable().optional(),
  syncToZentao: z.boolean().optional(),
  providerConfig: DevPlatformProviderConfigSchema.nullable().optional(),
  involvedRepos: z.array(z.string()).optional(),
});

export const DevTaskCreateResponseSchema = z.object({
  type: z.literal("dev.task.create/response"),
  payload: z.object({
    requestId: z.string(),
    task: DevPlatformTaskSchema.nullable(),
    error: z.string().nullable(),
  }),
});

export const DevTaskListRequestSchema = z.object({
  type: z.literal("dev.task.list"),
  requestId: z.string(),
  projectId: z.string(),
});

export const DevTaskListResponseSchema = z.object({
  type: z.literal("dev.task.list/response"),
  payload: z.object({
    requestId: z.string(),
    tasks: z.array(DevPlatformTaskSchema),
    error: z.string().nullable(),
  }),
});

export const DevTaskInspectRequestSchema = z.object({
  type: z.literal("dev.task.inspect"),
  requestId: z.string(),
  taskId: z.string(),
});

export const DevTaskInspectResponseSchema = z.object({
  type: z.literal("dev.task.inspect/response"),
  payload: z.object({
    requestId: z.string(),
    task: DevPlatformTaskSchema.nullable(),
    error: z.string().nullable(),
  }),
});

export const DevTaskUpdateRequestSchema = z.object({
  type: z.literal("dev.task.update"),
  requestId: z.string(),
  taskId: z.string(),
  title: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: DevPlatformTaskStatusSchema.optional(),
  interactionMode: DevPlatformInteractionModeSchema.optional(),
  parentTaskId: z.string().nullable().optional(),
  branchName: z.string().trim().min(1).nullable().optional(),
  providerConfig: DevPlatformProviderConfigSchema.nullable().optional(),
  involvedRepos: z.array(z.string()).optional(),
  archivedAt: z.string().nullable().optional(),
});

export const DevTaskUpdateResponseSchema = z.object({
  type: z.literal("dev.task.update/response"),
  payload: z.object({
    requestId: z.string(),
    task: DevPlatformTaskSchema.nullable(),
    error: z.string().nullable(),
  }),
});

export const DevTaskDeleteRequestSchema = z.object({
  type: z.literal("dev.task.delete"),
  requestId: z.string(),
  taskId: z.string(),
});

export const DevTaskDeleteResponseSchema = z.object({
  type: z.literal("dev.task.delete/response"),
  payload: z.object({
    requestId: z.string(),
    taskId: z.string(),
    error: z.string().nullable(),
  }),
});

// dev.task.assign_agent — create task-specific agent with context injection

export const DevTaskAssignAgentRequestSchema = z.object({
  type: z.literal("dev.task.assign_agent"),
  requestId: z.string(),
  taskId: z.string(),
  providerConfig: DevPlatformProviderConfigSchema.optional(),
  previewPrompt: z.boolean().optional(),
});

export const DevTaskAssignAgentResponseSchema = z.object({
  type: z.literal("dev.task.assign_agent/response"),
  payload: z.object({
    requestId: z.string(),
    agentId: z.string().nullable(),
    composedPrompt: z.string().optional(),
    error: z.string().nullable(),
  }),
});

// dev.task.set_active_agent — switch active agent

export const DevTaskSetActiveAgentRequestSchema = z.object({
  type: z.literal("dev.task.set_active_agent"),
  requestId: z.string(),
  taskId: z.string(),
  agentId: z.string(),
});

export const DevTaskSetActiveAgentResponseSchema = z.object({
  type: z.literal("dev.task.set_active_agent/response"),
  payload: z.object({
    requestId: z.string(),
    task: DevPlatformTaskSchema.nullable(),
    error: z.string().nullable(),
  }),
});

// dev.task.link_agent — manually link existing agent

export const DevTaskLinkAgentRequestSchema = z.object({
  type: z.literal("dev.task.link_agent"),
  requestId: z.string(),
  taskId: z.string(),
  agentId: z.string(),
});

export const DevTaskLinkAgentResponseSchema = z.object({
  type: z.literal("dev.task.link_agent/response"),
  payload: z.object({
    requestId: z.string(),
    task: DevPlatformTaskSchema.nullable(),
    error: z.string().nullable(),
  }),
});

// dev.task.set_interaction_mode — switch step_by_step / auto

export const DevTaskSetInteractionModeRequestSchema = z.object({
  type: z.literal("dev.task.set_interaction_mode"),
  requestId: z.string(),
  taskId: z.string(),
  interactionMode: DevPlatformInteractionModeSchema,
});

export const DevTaskSetInteractionModeResponseSchema = z.object({
  type: z.literal("dev.task.set_interaction_mode/response"),
  payload: z.object({
    requestId: z.string(),
    task: DevPlatformTaskSchema.nullable(),
    error: z.string().nullable(),
  }),
});

// dev.task.add_context / remove_context — context injection management

export const DevTaskAddContextRequestSchema = z.object({
  type: z.literal("dev.task.add_context"),
  requestId: z.string(),
  taskId: z.string(),
  contextIds: z.array(z.string()),
});

export const DevTaskAddContextResponseSchema = z.object({
  type: z.literal("dev.task.add_context/response"),
  payload: z.object({
    requestId: z.string(),
    task: DevPlatformTaskSchema.nullable(),
    error: z.string().nullable(),
  }),
});

export const DevTaskRemoveContextRequestSchema = z.object({
  type: z.literal("dev.task.remove_context"),
  requestId: z.string(),
  taskId: z.string(),
  contextIds: z.array(z.string()),
});

export const DevTaskRemoveContextResponseSchema = z.object({
  type: z.literal("dev.task.remove_context/response"),
  payload: z.object({
    requestId: z.string(),
    task: DevPlatformTaskSchema.nullable(),
    error: z.string().nullable(),
  }),
});

// dev.task.suggest_split — AI suggests split plan (no actual creation)

export const SuggestedSubTaskSchema = z.object({
  type: DevPlatformTaskTypeSchema,
  title: z.string().trim().min(1),
  description: z.string().optional(),
  interactionMode: DevPlatformInteractionModeSchema.optional(),
});
export type SuggestedSubTask = z.infer<typeof SuggestedSubTaskSchema>;

export const DevTaskSuggestSplitRequestSchema = z.object({
  type: z.literal("dev.task.suggest_split"),
  requestId: z.string(),
  taskId: z.string(),
});

export const DevTaskSuggestSplitResponseSchema = z.object({
  type: z.literal("dev.task.suggest_split/response"),
  payload: z.object({
    requestId: z.string(),
    suggestions: z.array(SuggestedSubTaskSchema),
    error: z.string().nullable(),
  }),
});

// dev.task.confirm_split — user confirms split plan, creates sub-tasks

export const DevTaskConfirmSplitRequestSchema = z.object({
  type: z.literal("dev.task.confirm_split"),
  requestId: z.string(),
  parentTaskId: z.string(),
  subTasks: z.array(SuggestedSubTaskSchema),
});

export const DevTaskConfirmSplitResponseSchema = z.object({
  type: z.literal("dev.task.confirm_split/response"),
  payload: z.object({
    requestId: z.string(),
    createdTasks: z.array(DevPlatformTaskSchema),
    error: z.string().nullable(),
  }),
});

// dev.task.toggle_zentao_sync — toggle syncToZentao flag

export const DevTaskToggleZentaoSyncRequestSchema = z.object({
  type: z.literal("dev.task.toggle_zentao_sync"),
  requestId: z.string(),
  taskId: z.string(),
  enabled: z.boolean(),
});

export const DevTaskToggleZentaoSyncResponseSchema = z.object({
  type: z.literal("dev.task.toggle_zentao_sync/response"),
  payload: z.object({
    requestId: z.string(),
    task: DevPlatformTaskSchema.nullable(),
    error: z.string().nullable(),
  }),
});

// dev.task.merge_to_uat — merge task branch to UAT

export const DevTaskMergeToUatRequestSchema = z.object({
  type: z.literal("dev.task.merge_to_uat"),
  requestId: z.string(),
  taskId: z.string(),
});

export const DevTaskMergeToUatResponseSchema = z.object({
  type: z.literal("dev.task.merge_to_uat/response"),
  payload: z.object({
    requestId: z.string(),
    success: z.boolean(),
    deploymentStatus: DevPlatformDeploymentStatusSchema.optional(),
    error: z.string().nullable(),
  }),
});

// dev.task.merge_to_production — merge task branch to production

export const DevTaskMergeToProductionRequestSchema = z.object({
  type: z.literal("dev.task.merge_to_production"),
  requestId: z.string(),
  taskId: z.string(),
});

export const DevTaskMergeToProductionResponseSchema = z.object({
  type: z.literal("dev.task.merge_to_production/response"),
  payload: z.object({
    requestId: z.string(),
    success: z.boolean(),
    deploymentStatus: DevPlatformDeploymentStatusSchema.optional(),
    error: z.string().nullable(),
  }),
});

// dev.task.resolve_merge_conflict — resolve merge conflict

export const DevTaskResolveMergeConflictRequestSchema = z.object({
  type: z.literal("dev.task.resolve_merge_conflict"),
  requestId: z.string(),
  taskId: z.string(),
  resolutionType: z.enum(["ai", "manual"]),
});

export const DevTaskResolveMergeConflictResponseSchema = z.object({
  type: z.literal("dev.task.resolve_merge_conflict/response"),
  payload: z.object({
    requestId: z.string(),
    resolved: z.boolean(),
    task: DevPlatformTaskSchema.nullable(),
    error: z.string().nullable(),
  }),
});

// dev.task.set_branch — set task branch

export const DevTaskSetBranchRequestSchema = z.object({
  type: z.literal("dev.task.set_branch"),
  requestId: z.string(),
  taskId: z.string(),
  branchName: z.string().trim().min(1),
});

export const DevTaskSetBranchResponseSchema = z.object({
  type: z.literal("dev.task.set_branch/response"),
  payload: z.object({
    requestId: z.string(),
    task: DevPlatformTaskSchema.nullable(),
    error: z.string().nullable(),
  }),
});

// dev.task.archive — archive task

export const DevTaskArchiveRequestSchema = z.object({
  type: z.literal("dev.task.archive"),
  requestId: z.string(),
  taskId: z.string(),
});

export const DevTaskArchiveResponseSchema = z.object({
  type: z.literal("dev.task.archive/response"),
  payload: z.object({
    requestId: z.string(),
    task: DevPlatformTaskSchema.nullable(),
    error: z.string().nullable(),
  }),
});

// dev.task.activity.list — task operation history log

export const DevTaskActivityListRequestSchema = z.object({
  type: z.literal("dev.task.activity.list"),
  requestId: z.string(),
  taskId: z.string(),
});

export const DevTaskActivityListResponseSchema = z.object({
  type: z.literal("dev.task.activity.list/response"),
  payload: z.object({
    requestId: z.string(),
    activities: z.array(TaskActivitySchema),
    error: z.string().nullable(),
  }),
});

// ---------------------------------------------------------------------------
// dev.context.* — Context CRUD
// ---------------------------------------------------------------------------

export const DevContextListRequestSchema = z.object({
  type: z.literal("dev.context.list"),
  requestId: z.string(),
  projectId: z.string(),
  taskId: z.string().optional(),
});

export const DevContextListResponseSchema = z.object({
  type: z.literal("dev.context.list/response"),
  payload: z.object({
    requestId: z.string(),
    contexts: z.array(DevPlatformContextSchema),
    error: z.string().nullable(),
  }),
});

export const DevContextAddRequestSchema = z.object({
  type: z.literal("dev.context.add"),
  requestId: z.string(),
  projectId: z.string(),
  sourceType: z.enum([
    "previous_output",
    "workspace_file",
    "task_background",
    "zentao_sync",
    "agent_conversation",
  ]),
  sourceId: z.string().optional(),
  title: z.string().trim().min(1),
  filePath: z.string().optional(),
  contentPreview: z.string().optional(),
});

export const DevContextAddResponseSchema = z.object({
  type: z.literal("dev.context.add/response"),
  payload: z.object({
    requestId: z.string(),
    context: DevPlatformContextSchema.nullable(),
    error: z.string().nullable(),
  }),
});

export const DevContextRemoveRequestSchema = z.object({
  type: z.literal("dev.context.remove"),
  requestId: z.string(),
  contextId: z.string(),
});

export const DevContextRemoveResponseSchema = z.object({
  type: z.literal("dev.context.remove/response"),
  payload: z.object({
    requestId: z.string(),
    contextId: z.string(),
    error: z.string().nullable(),
  }),
});

// ---------------------------------------------------------------------------
// dev.skill.* — Skill CRUD (Phase 1 reserved, Phase 4-5 UI)
// ---------------------------------------------------------------------------

export const DevSkillListRequestSchema = z.object({
  type: z.literal("dev.skill.list"),
  requestId: z.string(),
  projectId: z.string().optional(),
  level: z.enum(["global", "project", "task"]).optional(),
});

export const DevSkillListResponseSchema = z.object({
  type: z.literal("dev.skill.list/response"),
  payload: z.object({
    requestId: z.string(),
    skills: z.array(z.record(z.string(), z.unknown())),
    error: z.string().nullable(),
  }),
});

export const DevSkillAddRequestSchema = z.object({
  type: z.literal("dev.skill.add"),
  requestId: z.string(),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  level: z.enum(["global", "project", "task"]),
  projectId: z.string().optional(),
  filePath: z.string().trim().min(1),
  applicableProviders: z.array(z.string()).optional(),
  applicableTaskTypes: z.array(DevPlatformTaskTypeSchema).optional(),
});

export const DevSkillAddResponseSchema = z.object({
  type: z.literal("dev.skill.add/response"),
  payload: z.object({
    requestId: z.string(),
    skill: z.record(z.string(), z.unknown()).nullable(),
    error: z.string().nullable(),
  }),
});

export const DevSkillRemoveRequestSchema = z.object({
  type: z.literal("dev.skill.remove"),
  requestId: z.string(),
  skillId: z.string(),
});

export const DevSkillRemoveResponseSchema = z.object({
  type: z.literal("dev.skill.remove/response"),
  payload: z.object({
    requestId: z.string(),
    skillId: z.string(),
    error: z.string().nullable(),
  }),
});

export const DevSkillUpdateRequestSchema = z.object({
  type: z.literal("dev.skill.update"),
  requestId: z.string(),
  skillId: z.string(),
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  applicableProviders: z.array(z.string()).optional(),
  applicableTaskTypes: z.array(DevPlatformTaskTypeSchema).optional(),
});

export const DevSkillUpdateResponseSchema = z.object({
  type: z.literal("dev.skill.update/response"),
  payload: z.object({
    requestId: z.string(),
    skill: z.record(z.string(), z.unknown()).nullable(),
    error: z.string().nullable(),
  }),
});

// ---------------------------------------------------------------------------
// dev.default_config.* — Default agent config management
// ---------------------------------------------------------------------------

export const DevDefaultConfigListRequestSchema = z.object({
  type: z.literal("dev.default_config.list"),
  requestId: z.string(),
});

export const DevDefaultConfigListResponseSchema = z.object({
  type: z.literal("dev.default_config.list/response"),
  payload: z.object({
    requestId: z.string(),
    configs: z.array(DefaultAgentConfigSchema),
    error: z.string().nullable(),
  }),
});

export const DevDefaultConfigUpdateRequestSchema = z.object({
  type: z.literal("dev.default_config.update"),
  requestId: z.string(),
  taskType: DevPlatformTaskTypeSchema,
  provider: z.string().trim().min(1),
  model: z.string().trim().min(1),
  mode: z.string().trim().min(1),
  systemPromptTemplate: z.string().optional(),
  skillIds: z.array(z.string()).optional(),
});

export const DevDefaultConfigUpdateResponseSchema = z.object({
  type: z.literal("dev.default_config.update/response"),
  payload: z.object({
    requestId: z.string(),
    config: DefaultAgentConfigSchema.nullable(),
    error: z.string().nullable(),
  }),
});

// ---------------------------------------------------------------------------
// dev.zentao.* — Zentao configuration and sync
// ---------------------------------------------------------------------------

export const DevZentaoConfigureRequestSchema = z.object({
  type: z.literal("dev.zentao.configure"),
  requestId: z.string(),
  url: z.string().trim().min(1),
  account: z.string().trim().min(1),
  password: z.string(),
  productId: z.string().optional(),
});

export const DevZentaoConfigureResponseSchema = z.object({
  type: z.literal("dev.zentao.configure/response"),
  payload: z.object({
    requestId: z.string(),
    config: ZentaoConfigSchema.nullable(),
    connected: z.boolean().optional(),
    error: z.string().nullable(),
  }),
});

export const DevZentaoConfigureStatusRequestSchema = z.object({
  type: z.literal("dev.zentao.configure.status"),
  requestId: z.string(),
});

export const DevZentaoConfigureStatusResponseSchema = z.object({
  type: z.literal("dev.zentao.configure.status/response"),
  payload: z.object({
    requestId: z.string(),
    config: ZentaoConfigSchema.nullable(),
    connected: z.boolean().optional(),
    error: z.string().nullable(),
  }),
});

export const DevZentaoSyncPushRequestSchema = z.object({
  type: z.literal("dev.zentao.sync.push"),
  requestId: z.string(),
  projectId: z.string(),
});

export const DevZentaoSyncPushResponseSchema = z.object({
  type: z.literal("dev.zentao.sync.push/response"),
  payload: z.object({
    requestId: z.string(),
    syncedTaskIds: z.array(z.string()),
    conflictTaskIds: z.array(z.string()),
    error: z.string().nullable(),
  }),
});

export const DevZentaoSyncPullRequestSchema = z.object({
  type: z.literal("dev.zentao.sync.pull"),
  requestId: z.string(),
  projectId: z.string(),
});

export const DevZentaoSyncPullResponseSchema = z.object({
  type: z.literal("dev.zentao.sync.pull/response"),
  payload: z.object({
    requestId: z.string(),
    createdTaskIds: z.array(z.string()),
    updatedTaskIds: z.array(z.string()),
    error: z.string().nullable(),
  }),
});

export const DevZentaoSyncBidirectionalRequestSchema = z.object({
  type: z.literal("dev.zentao.sync.bidirectional"),
  requestId: z.string(),
  projectId: z.string(),
});

export const DevZentaoSyncBidirectionalResponseSchema = z.object({
  type: z.literal("dev.zentao.sync.bidirectional/response"),
  payload: z.object({
    requestId: z.string(),
    pushedTaskIds: z.array(z.string()),
    pulledTaskIds: z.array(z.string()),
    conflictTaskIds: z.array(z.string()),
    error: z.string().nullable(),
  }),
});

export const DevZentaoSyncStatusRequestSchema = z.object({
  type: z.literal("dev.zentao.sync.status"),
  requestId: z.string(),
  projectId: z.string(),
});

export const DevZentaoSyncStatusResponseSchema = z.object({
  type: z.literal("dev.zentao.sync.status/response"),
  payload: z.object({
    requestId: z.string(),
    mappings: z.array(ZentaoSyncMappingSchema),
    lastSyncedAt: z.string().nullable(),
    error: z.string().nullable(),
  }),
});

// dev.zentao.sync.conflict.list / resolve — conflict management

export const ZentaoConflictFieldSchema = z.object({
  field: z.string(),
  localValue: z.string(),
  zentaoValue: z.string(),
});
export type ZentaoConflictField = z.infer<typeof ZentaoConflictFieldSchema>;

export const DevZentaoSyncConflictListRequestSchema = z.object({
  type: z.literal("dev.zentao.sync.conflict.list"),
  requestId: z.string(),
  projectId: z.string(),
});

export const DevZentaoSyncConflictListResponseSchema = z.object({
  type: z.literal("dev.zentao.sync.conflict.list/response"),
  payload: z.object({
    requestId: z.string(),
    conflicts: z.array(
      z.object({
        taskId: z.string(),
        zentaoId: z.string(),
        fields: z.array(ZentaoConflictFieldSchema),
      }),
    ),
    error: z.string().nullable(),
  }),
});

export const DevZentaoSyncConflictResolveRequestSchema = z.object({
  type: z.literal("dev.zentao.sync.conflict.resolve"),
  requestId: z.string(),
  taskId: z.string(),
  resolutions: z.array(
    z.object({
      field: z.string(),
      keep: z.enum(["local", "zentao"]),
    }),
  ),
});

export const DevZentaoSyncConflictResolveResponseSchema = z.object({
  type: z.literal("dev.zentao.sync.conflict.resolve/response"),
  payload: z.object({
    requestId: z.string(),
    task: DevPlatformTaskSchema.nullable(),
    error: z.string().nullable(),
  }),
});

// ---------------------------------------------------------------------------
// Stream push events (outbound only, no request)
// ---------------------------------------------------------------------------

export const DevZentaoSyncUpdateMessageSchema = z.object({
  type: z.literal("dev.zentao.sync_update"),
  payload: z.object({
    projectId: z.string(),
    taskId: z.string(),
    syncStatus: ZentaoSyncStatusSchema,
  }),
});

export const DevCicdBuildUpdateMessageSchema = z.object({
  type: z.literal("dev.cicd.build_update"),
  payload: z.object({
    projectId: z.string(),
    environment: z.enum(["uat", "production"]),
    buildStatus: DevPlatformBuildStatusSchema,
    buildNumber: z.number().int().optional(),
    buildUrl: z.string().optional(),
  }),
});

// ---------------------------------------------------------------------------
// dev.repo.* — Git repository status (sidebar display)
// ---------------------------------------------------------------------------

export const GitRepoStatusSchema = z.object({
  repoPath: z.string(),
  branch: z.string().nullable(),
  headCommit: z.string().nullable(),
  aheadBy: z.number().int().nonnegative(),
  behindBy: z.number().int().nonnegative(),
  isDirty: z.boolean(),
  untrackedFiles: z.number().int().nonnegative(),
  modifiedFiles: z.number().int().nonnegative(),
  stagedFiles: z.number().int().nonnegative(),
  upstream: z.string().nullable(),
  checkedAt: z.string(),
});
export type GitRepoStatus = z.infer<typeof GitRepoStatusSchema>;

export const DevRepoStatusRequestSchema = z.object({
  type: z.literal("dev.repo.status"),
  requestId: z.string(),
  /** Absolute path to the git repo working directory */
  repoPath: z.string().trim().min(1),
});

export const DevRepoStatusResponseSchema = z.object({
  type: z.literal("dev.repo.status/response"),
  payload: z.object({
    requestId: z.string(),
    status: GitRepoStatusSchema.nullable(),
    error: z.string().nullable(),
  }),
});

// dev.repo.status_all — get status for all repos in a project at once

export const DevRepoStatusAllRequestSchema = z.object({
  type: z.literal("dev.repo.status_all"),
  requestId: z.string(),
  projectId: z.string(),
});

export const DevRepoStatusAllResponseSchema = z.object({
  type: z.literal("dev.repo.status_all/response"),
  payload: z.object({
    requestId: z.string(),
    /** Map of repoPath → GitRepoStatus */
    statuses: z.array(z.object({ repoPath: z.string(), status: GitRepoStatusSchema })),
    error: z.string().nullable(),
  }),
});

// dev.repo.status_update — push event for sidebar live updates

export const DevRepoStatusUpdateMessageSchema = z.object({
  type: z.literal("dev.repo.status_update"),
  payload: z.object({
    projectId: z.string(),
    repoPath: z.string(),
    status: GitRepoStatusSchema,
  }),
});
