import { z } from "zod";

// ---------------------------------------------------------------------------
// DevPlatformProject — project/workspace entity
// ---------------------------------------------------------------------------

/**
 * DevPlatformWorktree — a git worktree entry under a git repo.
 * Worktrees allow working on multiple branches of the same repo simultaneously.
 */
export const DevPlatformWorktreeSchema = z.object({
  /** Absolute path to the worktree directory on disk */
  path: z.string().trim().min(1),
  /** Current branch name checked out in this worktree */
  branch: z.string().trim().min(1),
});
export type DevPlatformWorktree = z.infer<typeof DevPlatformWorktreeSchema>;

/**
 * DevPlatformGitRepo — a git repository entry within a dev-platform project.
 *
 * Architecture: In dev-platform mode, one project = one workspace (at rootDirectory).
 * Git repos are NOT separate workspaces — they are sub-entries within the project.
 * Clicking a git repo in the sidebar only updates the right-side file explorer,
 * it does NOT change the workspace route or middle-area tabs.
 *
 * For single-repo projects, use relativePath: "." (the rootDirectory itself is a git repo).
 * For multi-repo (microservices) projects, each child git repo gets an entry with its
 * relative path from rootDirectory (e.g. "frontend-web", "services/user-service").
 */
export const DevPlatformGitRepoSchema = z.object({
  /** Git remote URL (optional — may be empty for local-only repos) */
  url: z.string().trim().min(1),
  /**
   * Path relative to project rootDirectory.
   * Use "." when rootDirectory itself is a git repo (single-repo project).
   * Use e.g. "frontend-web" for child repos in multi-repo projects.
   * Default "." handles migration from old schema where this field was absent.
   */
  relativePath: z.string().trim().min(1).default("."),
  /** Display label (defaults to directory basename if omitted) */
  label: z.string().optional(),
  /**
   * Git worktrees under this repo — allows parallel branch work.
   * Each worktree is shown as a sub-entry under the repo row in the sidebar.
   */
  worktrees: z.array(DevPlatformWorktreeSchema).default([]),
  // COMPAT(workspaceId): added in Phase 1, replaced by relativePath in Phase 2.
  // Keep optional for backward compat with existing persisted data. Remove when floor >= Phase 2.
  /** @deprecated Use relativePath instead. Retained for backward compat only. */
  workspaceId: z.string().optional(),
});
export type DevPlatformGitRepo = z.infer<typeof DevPlatformGitRepoSchema>;

export const CicdConfigSchema = z.object({
  type: z.enum(["jenkins", "github_actions", "gitlab_ci", "custom"]),
  url: z.string().trim().min(1),
  token: z.string().trim().min(1),
  uatJob: z.string().trim().min(1),
  prdJob: z.string().trim().min(1),
  autoTriggerUat: z.boolean().default(true),
  autoTriggerPrd: z.boolean().default(false),
});
export type CicdConfig = z.infer<typeof CicdConfigSchema>;

export const DevPlatformProjectSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1),
  /**
   * Project root directory — this is the single Paseo workspace for the entire project.
   * In dev-platform mode, one project = one workspace at rootDirectory.
   * All tabs, agents, and project-level state live under this workspace.
   * Child git repos (in gitRepos[]) are NOT separate workspaces.
   */
  rootDirectory: z.string().trim().min(1),
  description: z.string().optional(),
  /**
   * Git repositories within this project.
   * For single-repo projects: contains one entry with relativePath: "."
   * For multi-repo (microservices) projects: contains one entry per child git repo.
   * Auto-detected on project creation via recursive scan of rootDirectory.
   */
  gitRepos: z.array(DevPlatformGitRepoSchema).default([]),
  /**
   * Paseo workspace IDs associated with this project.
   * In dev-platform mode, typically contains one entry (the rootDirectory workspace).
   * Used for mapping workspaceId → projectId in the tab system.
   */
  workspaceIds: z.array(z.string()).default([]),
  zentaoProjectId: z.string().optional(),
  uatBranch: z.string().optional(),
  prdBranch: z.string().optional(),
  cicdConfig: CicdConfigSchema.nullable().default(null),
  archivedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DevPlatformProject = z.infer<typeof DevPlatformProjectSchema>;

// ---------------------------------------------------------------------------
// DevPlatformTask — unified work item
// ---------------------------------------------------------------------------

export const DevPlatformTaskTypeSchema = z.enum([
  "requirement",
  "design",
  "development",
  "bug",
  "testing",
  "documentation",
  "deployment",
]);
export type DevPlatformTaskType = z.infer<typeof DevPlatformTaskTypeSchema>;

export const DevPlatformTaskPrioritySchema = z.enum(["low", "medium", "high", "critical"]);
export type DevPlatformTaskPriority = z.infer<typeof DevPlatformTaskPrioritySchema>;

export const DevPlatformTaskStatusSchema = z.enum([
  "todo",
  "in_progress",
  "review",
  "done",
  "blocked",
  "merge_conflict",
  "archived",
]);
export type DevPlatformTaskStatus = z.infer<typeof DevPlatformTaskStatusSchema>;

export const DevPlatformInteractionModeSchema = z.enum(["step_by_step", "auto"]);
export type DevPlatformInteractionMode = z.infer<typeof DevPlatformInteractionModeSchema>;

export const DevPlatformDeploymentStatusSchema = z.enum(["not_deployed", "uat", "production"]);
export type DevPlatformDeploymentStatus = z.infer<typeof DevPlatformDeploymentStatusSchema>;

export const DevPlatformBuildStatusSchema = z.enum([
  "not_built",
  "building",
  "build_success",
  "build_failed",
]);
export type DevPlatformBuildStatus = z.infer<typeof DevPlatformBuildStatusSchema>;

export const DevPlatformProviderConfigSchema = z.object({
  provider: z.string().trim().min(1),
  model: z.string().trim().min(1).optional(),
  mode: z.string().trim().min(1).optional(),
});
export type DevPlatformProviderConfig = z.infer<typeof DevPlatformProviderConfigSchema>;

export const DevPlatformTaskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  type: DevPlatformTaskTypeSchema,
  title: z.string().trim().min(1),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: DevPlatformTaskStatusSchema.default("todo"),
  interactionMode: DevPlatformInteractionModeSchema.default("step_by_step"),
  parentTaskId: z.string().nullable().default(null),
  agentIds: z.array(z.string()).default([]),
  activeAgentId: z.string().nullable().default(null),
  syncToZentao: z.boolean().default(false),
  zentaoId: z.string().nullable().default(null),
  branchName: z.string().nullable().default(null),
  deploymentStatus: DevPlatformDeploymentStatusSchema.default("not_deployed"),
  buildStatus: DevPlatformBuildStatusSchema.default("not_built"),
  dependsOn: z.array(z.string()).default([]),
  contextIds: z.array(z.string()).default([]),
  skillIds: z.array(z.string()).default([]),
  outputDir: z.string().nullable().default(null),
  providerConfig: DevPlatformProviderConfigSchema.nullable().default(null),
  involvedRepos: z.array(z.string()).default([]),
  archivedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DevPlatformTask = z.infer<typeof DevPlatformTaskSchema>;

// ---------------------------------------------------------------------------
// DevPlatformContext — context injection entry
// ---------------------------------------------------------------------------

export const DevPlatformContextSourceTypeSchema = z.enum([
  "previous_output",
  "workspace_file",
  "task_background",
  "zentao_sync",
  "agent_conversation",
]);
export type DevPlatformContextSourceType = z.infer<typeof DevPlatformContextSourceTypeSchema>;

export const DevPlatformContextSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sourceType: DevPlatformContextSourceTypeSchema,
  sourceId: z.string().optional(),
  title: z.string().trim().min(1),
  filePath: z.string().optional(),
  contentPreview: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DevPlatformContext = z.infer<typeof DevPlatformContextSchema>;

// ---------------------------------------------------------------------------
// ZentaoConfig — Zentao connection configuration
// ---------------------------------------------------------------------------

export const ZentaoConfigSchema = z.object({
  url: z.string().trim().min(1),
  token: z.string(),
  account: z.string().trim().min(1),
  productId: z.string().optional(),
  lastSyncedAt: z.string().nullable().default(null),
});
export type ZentaoConfig = z.infer<typeof ZentaoConfigSchema>;

// ---------------------------------------------------------------------------
// ZentaoSyncMapping — Zentao sync record
// ---------------------------------------------------------------------------

export const ZentaoSyncDirectionSchema = z.enum(["push", "pull", "bidirectional"]);
export type ZentaoSyncDirection = z.infer<typeof ZentaoSyncDirectionSchema>;

export const ZentaoSyncStatusSchema = z.enum(["synced", "pending", "conflict"]);
export type ZentaoSyncStatus = z.infer<typeof ZentaoSyncStatusSchema>;

export const ZentaoSyncMappingSchema = z.object({
  localTaskId: z.string(),
  zentaoId: z.string().trim().min(1),
  zentaoType: z.enum(["story", "task", "bug"]),
  syncDirection: ZentaoSyncDirectionSchema,
  lastSyncedAt: z.string(),
  syncStatus: ZentaoSyncStatusSchema,
});
export type ZentaoSyncMapping = z.infer<typeof ZentaoSyncMappingSchema>;

// ---------------------------------------------------------------------------
// DevPlatformSkill — skill definition (Phase 1 reserved, Phase 4-5 UI)
// ---------------------------------------------------------------------------

export const DevPlatformSkillLevelSchema = z.enum(["global", "project", "task"]);
export type DevPlatformSkillLevel = z.infer<typeof DevPlatformSkillLevelSchema>;

export const DevPlatformSkillSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  level: DevPlatformSkillLevelSchema,
  projectId: z.string().nullable().default(null),
  filePath: z.string().trim().min(1),
  applicableProviders: z.array(z.string()).optional(),
  applicableTaskTypes: z.array(DevPlatformTaskTypeSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DevPlatformSkill = z.infer<typeof DevPlatformSkillSchema>;

// ---------------------------------------------------------------------------
// DefaultAgentConfig — default agent config per task type
// ---------------------------------------------------------------------------

export const DefaultAgentConfigSchema = z.object({
  type: DevPlatformTaskTypeSchema,
  provider: z.string().trim().min(1),
  model: z.string().trim().min(1),
  mode: z.string().trim().min(1),
  systemPromptTemplate: z.string().optional(),
  skillIds: z.array(z.string()).optional(),
});
export type DefaultAgentConfig = z.infer<typeof DefaultAgentConfigSchema>;

// ---------------------------------------------------------------------------
// TaskActivity — append-only operation history log
// ---------------------------------------------------------------------------

export const TaskActivityActorSchema = z.enum(["user", "agent", "system"]);
export type TaskActivityActor = z.infer<typeof TaskActivityActorSchema>;

export const TaskActivityActionSchema = z.enum([
  "created",
  "agent_created",
  "agent_linked",
  "agent_switched",
  "mode_changed",
  "context_added",
  "context_removed",
  "output_confirmed",
  "status_changed",
  "branch_set",
  "deployed_to_uat",
  "deployed_to_production",
  "zentao_synced",
  "zentao_sync_toggled",
  "split_suggested",
  "split_confirmed",
  "merge_conflict_detected",
  "merge_conflict_resolved",
  "archived",
]);
export type TaskActivityAction = z.infer<typeof TaskActivityActionSchema>;

export const TaskActivitySchema = z.object({
  id: z.string(),
  taskId: z.string(),
  timestamp: z.string(),
  actor: TaskActivityActorSchema,
  action: TaskActivityActionSchema,
  detail: z.string().optional(),
});
export type TaskActivity = z.infer<typeof TaskActivitySchema>;

// ---------------------------------------------------------------------------
// Plain TypeScript interfaces for service-level inputs
// ---------------------------------------------------------------------------

export interface CreateDevPlatformProjectInput {
  name: string;
  rootDirectory: string;
  description?: string;
  gitRepos?: DevPlatformGitRepo[];
  /** Paseo workspace IDs to associate. Typically [rootDirectory] for dev-platform projects. */
  workspaceIds?: string[];
  zentaoProjectId?: string;
  uatBranch?: string;
  prdBranch?: string;
  cicdConfig?: CicdConfig | null;
}

export interface UpdateDevPlatformProjectInput {
  id: string;
  name?: string;
  description?: string;
  gitRepos?: DevPlatformGitRepo[];
  /** Update associated workspace IDs. */
  workspaceIds?: string[];
  zentaoProjectId?: string;
  uatBranch?: string;
  prdBranch?: string;
  cicdConfig?: CicdConfig | null;
  archivedAt?: string | null;
}

export interface CreateDevPlatformTaskInput {
  projectId: string;
  type: DevPlatformTaskType;
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "critical";
  interactionMode?: DevPlatformInteractionMode;
  parentTaskId?: string | null;
  syncToZentao?: boolean;
  providerConfig?: DevPlatformProviderConfig | null;
  involvedRepos?: string[];
}

export interface UpdateDevPlatformTaskInput {
  id: string;
  title?: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "critical";
  status?: DevPlatformTaskStatus;
  interactionMode?: DevPlatformInteractionMode;
  parentTaskId?: string | null;
  branchName?: string | null;
  providerConfig?: DevPlatformProviderConfig | null;
  involvedRepos?: string[];
  archivedAt?: string | null;
}

export interface CreateDevPlatformContextInput {
  projectId: string;
  sourceType: DevPlatformContextSourceType;
  sourceId?: string;
  title: string;
  filePath?: string;
  contentPreview?: string;
}

export interface UpdateDefaultAgentConfigInput {
  type: DevPlatformTaskType;
  provider?: string;
  model?: string;
  mode?: string;
  systemPromptTemplate?: string;
  skillIds?: string[];
}
