import type { FetchAgentsEntry } from "@getpaseo/client/internal/daemon-client";
import { type Agent, useSessionStore } from "@/stores/session-store";
import { derivePendingPermissionKey, normalizeAgentSnapshot } from "@/utils/agent-snapshots";
import { resolveProjectPlacement } from "@/utils/project-placement";

type AgentDirectoryFetchEntry = FetchAgentsEntry;

interface PendingPermissionEntry {
  key: string;
  agentId: string;
  request: Agent["pendingPermissions"][number];
}

export function buildAgentDirectoryState(input: {
  serverId: string;
  entries: AgentDirectoryFetchEntry[];
}): {
  agents: Map<string, Agent>;
  pendingPermissions: Map<string, PendingPermissionEntry>;
} {
  const agents = new Map<string, Agent>();
  const pendingPermissions = new Map<string, PendingPermissionEntry>();

  for (const entry of input.entries) {
    const normalized = normalizeAgentSnapshot(entry.agent, input.serverId);
    const projectPlacement = resolveProjectPlacement({
      projectPlacement: entry.project,
      cwd: normalized.cwd,
    });
    const agent: Agent = {
      ...normalized,
      projectPlacement,
    };
    agents.set(agent.id, agent);

    for (const request of agent.pendingPermissions) {
      const key = derivePendingPermissionKey(agent.id, request);
      pendingPermissions.set(key, { key, agentId: agent.id, request });
    }
  }

  return { agents, pendingPermissions };
}

export function replaceFetchedAgentDirectory(input: {
  serverId: string;
  entries: FetchAgentsEntry[];
}): { agents: Map<string, Agent> } {
  const { agents: fetchedAgents, pendingPermissions } = buildAgentDirectoryState(input);
  const store = useSessionStore.getState();
  const previousAgents = store.sessions[input.serverId]?.agents ?? new Map<string, Agent>();

  store.setAgents(input.serverId, fetchedAgents);
  store.setAgentDetails(input.serverId, (prev) => {
    const next = new Map(prev);
    // Remove entries now covered by the live agents map (live data is fresher)
    for (const agentId of fetchedAgents.keys()) {
      next.delete(agentId);
    }
    // Preserve agents that are being removed from the live map — they may be
    // closed/archived and the sidebar still needs their data for navigation.
    for (const [agentId, agent] of previousAgents.entries()) {
      if (!fetchedAgents.has(agentId) && !next.has(agentId)) {
        next.set(agentId, agent);
      }
    }
    return next;
  });

  const lastActivityByAgentId = new Map<string, Date>();
  for (const agent of fetchedAgents.values()) {
    lastActivityByAgentId.set(agent.id, agent.lastActivityAt);
  }
  store.setAgentLastActivityBatch(lastActivityByAgentId);

  store.setPendingPermissions(input.serverId, new Map(pendingPermissions));
  store.setInitializingAgents(input.serverId, new Map());
  store.setHasHydratedAgents(input.serverId, true);
  return { agents: fetchedAgents };
}
