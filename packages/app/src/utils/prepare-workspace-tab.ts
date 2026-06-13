import { generateDraftId } from "@/stores/draft-keys";
import {
  buildWorkspaceTabPersistenceKey,
  type WorkspaceTabTarget,
} from "@/stores/workspace-tabs-store";
import {
  buildHostWorkspaceRoute,
  decodeWorkspaceIdFromPathSegment,
  parseHostWorkspaceRouteFromPathname,
} from "@/utils/host-routes";

export interface PrepareWorkspaceTabInput {
  serverId: string;
  workspaceId: string;
  target: WorkspaceTabTarget;
  pin?: boolean;
}

export interface NavigateToPreparedWorkspaceTabInput extends PrepareWorkspaceTabInput {
  currentPathname?: string | null;
}

export interface PrepareWorkspaceTabDeps {
  openTabFocused: (workspaceKey: string, target: WorkspaceTabTarget) => string | null;
  pinAgent: (workspaceKey: string, agentId: string) => void;
}

export interface NavigateToPreparedWorkspaceTabDeps extends PrepareWorkspaceTabDeps {
  navigateToWorkspace: (
    serverId: string,
    workspaceId: string,
    options: { currentPathname?: string | null },
  ) => void;
}

function getPreparedTarget(target: WorkspaceTabTarget): WorkspaceTabTarget {
  if (target.kind !== "draft" || target.draftId.trim() !== "new") {
    return target;
  }
  return { kind: "draft", draftId: generateDraftId() };
}

export function prepareWorkspaceTab(
  input: PrepareWorkspaceTabInput,
  deps: PrepareWorkspaceTabDeps,
): string {
  const target = getPreparedTarget(input.target);
  const key =
    buildWorkspaceTabPersistenceKey({
      serverId: input.serverId,
      workspaceId: input.workspaceId,
    }) ?? "";

  deps.openTabFocused(key, target);

  if (input.pin && target.kind === "agent") {
    deps.pinAgent(key, target.agentId);
  }

  return buildHostWorkspaceRoute(input.serverId, input.workspaceId);
}

export function navigateToPreparedWorkspaceTab(
  input: NavigateToPreparedWorkspaceTabInput,
  deps: NavigateToPreparedWorkspaceTabDeps,
): string {
  const route = prepareWorkspaceTab(input, deps);
  // Skip navigation if already on the same workspace page — tab was already focused.
  const parsed = parseHostWorkspaceRouteFromPathname(input.currentPathname ?? "");
  const currentWorkspaceId = parsed?.workspaceId
    ? decodeWorkspaceIdFromPathSegment(parsed.workspaceId)
    : null;
  if (parsed?.serverId === input.serverId && currentWorkspaceId === input.workspaceId) {
    return route;
  }
  deps.navigateToWorkspace(input.serverId, input.workspaceId, {
    currentPathname: input.currentPathname,
  });
  return route;
}
