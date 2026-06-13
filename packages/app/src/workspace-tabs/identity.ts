import type { WorkspaceTabTarget } from "@/stores/workspace-tabs-store";
import { normalizeWorkspaceFileLocation, workspaceFileLocationsEqual } from "@/workspace/file-open";

type WorkspaceDraftTabSetup = NonNullable<Extract<WorkspaceTabTarget, { kind: "draft" }>["setup"]>;

export function normalizeWorkspaceTabTarget(
  value: WorkspaceTabTarget | null | undefined,
): WorkspaceTabTarget | null {
  if (!value || typeof value !== "object" || typeof value.kind !== "string") {
    return null;
  }
  if (value.kind === "draft") {
    const draftId = trimNonEmpty(value.draftId);
    if (!draftId) {
      return null;
    }
    const setup = normalizeWorkspaceDraftTabSetup(value.setup);
    return setup ? { kind: "draft", draftId, setup } : { kind: "draft", draftId };
  }
  if (value.kind === "file") {
    return normalizeFileTabTarget(value);
  }
  const singleIdKey = SINGLE_ID_KEYS[value.kind];
  if (singleIdKey && singleIdKey !== "kind") {
    const id = trimNonEmpty((value as Record<string, string | null | undefined>)[singleIdKey]);
    return id ? ({ kind: value.kind, [singleIdKey]: id } as WorkspaceTabTarget) : null;
  }
  if (value.kind === "create_project") {
    return { kind: "create_project" } as WorkspaceTabTarget;
  }
  if (value.kind === "project_list") {
    return { kind: "project_list" } as WorkspaceTabTarget;
  }
  return null;
}

export const SINGLE_ID_KEYS: Record<string, string> = {
  agent: "agentId",
  terminal: "terminalId",
  browser: "browserId",
  setup: "workspaceId",
  task: "taskId",
  kanban: "projectId",
  branches: "projectId",
  create_task: "projectId",
  task_detail: "taskId",
  task_activity: "taskId",
  archived_tasks: "projectId",
  project_settings: "projectId",
};

export function normalizeWorkspaceDraftTabSetup(
  value: unknown,
): WorkspaceDraftTabSetup | undefined {
  const record = isPlainRecord(value) ? value : null;
  if (!record) {
    return undefined;
  }
  const provider = trimNonEmpty(typeof record.provider === "string" ? record.provider : null);
  const cwd = trimNonEmpty(typeof record.cwd === "string" ? record.cwd : null);
  if (!provider || !cwd) {
    return undefined;
  }
  return {
    provider,
    cwd,
    modeId: trimOptionalString(typeof record.modeId === "string" ? record.modeId : null),
    model: trimOptionalString(typeof record.model === "string" ? record.model : null),
    thinkingOptionId: trimOptionalString(
      typeof record.thinkingOptionId === "string" ? record.thinkingOptionId : null,
    ),
    featureValues: isPlainRecord(record.featureValues) ? { ...record.featureValues } : {},
  };
}

export function workspaceTabTargetsEqual(
  left: WorkspaceTabTarget,
  right: WorkspaceTabTarget,
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  if (left.kind === "draft" && right.kind === "draft") {
    return left.draftId === right.draftId && workspaceDraftTabSetupsEqual(left.setup, right.setup);
  }
  if (left.kind === "file" && right.kind === "file") {
    return workspaceFileLocationsEqual(left, right);
  }
  const singleIdKey = SINGLE_ID_KEYS[left.kind];
  if (singleIdKey) {
    return (
      (left as Record<string, string>)[singleIdKey] ===
      (right as Record<string, string>)[singleIdKey]
    );
  }
  if (left.kind === "create_project" || left.kind === "project_list") {
    return true;
  }
  return false;
}

function workspaceDraftTabSetupsEqual(
  left: WorkspaceDraftTabSetup | undefined,
  right: WorkspaceDraftTabSetup | undefined,
): boolean {
  if (!left || !right) {
    return left === right;
  }
  return (
    left.provider === right.provider &&
    left.cwd === right.cwd &&
    left.modeId === right.modeId &&
    left.model === right.model &&
    left.thinkingOptionId === right.thinkingOptionId &&
    recordsShallowEqual(left.featureValues, right.featureValues)
  );
}

function recordsShallowEqual(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) {
    return false;
  }
  for (const key of leftKeys) {
    if (!Object.hasOwn(right, key) || !Object.is(left[key], right[key])) {
      return false;
    }
  }
  return true;
}

const TAB_ID_PREFIXES: Record<string, string> = {
  agent: "agent",
  terminal: "terminal",
  browser: "browser",
  setup: "setup",
  task: "task",
  kanban: "kanban",
  branches: "branches",
  create_project: "create_project",
  create_task: "create_task",
  task_detail: "task_detail",
  task_activity: "task_activity",
  archived_tasks: "archived_tasks",
  project_settings: "project_settings",
  project_list: "project_list",
};

export function buildDeterministicWorkspaceTabId(target: WorkspaceTabTarget): string {
  if (target.kind === "draft") {
    return target.draftId;
  }
  const prefix = TAB_ID_PREFIXES[target.kind];
  if (target.kind === "create_project") {
    return `create_project_${Date.now()}`;
  }
  if (target.kind === "project_list") {
    return `project_list`;
  }
  if (prefix) {
    const idKey = SINGLE_ID_KEYS[target.kind] as keyof typeof target;
    return `${prefix}_${(target as Record<string, string>)[idKey]}`;
  }
  if (target.kind === "file") {
    return `file_${target.path}`;
  }
  return `${prefix ?? target.kind}_${(target as Record<string, string>).projectId ?? ""}`;
}

function trimNonEmpty(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeFileTabTarget(
  value: Extract<WorkspaceTabTarget, { kind: "file" }>,
): WorkspaceTabTarget | null {
  const location = normalizeWorkspaceFileLocation(value);
  return location ? { kind: "file", ...location } : null;
}

function trimOptionalString(value: string | null | undefined): string | null {
  return value == null ? null : trimNonEmpty(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
