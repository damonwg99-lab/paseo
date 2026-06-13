import { router, type Href } from "expo-router";
import { useSessionStore } from "@/stores/session-store";
import { resolveNavigateToAgent, type NavigateToAgentInput } from "./resolve";
import { navigateToPreparedWorkspaceTab } from "@/utils/workspace-navigation";

export type { NavigateToAgentInput } from "./resolve";

export function navigateToAgent(input: NavigateToAgentInput): string {
  const pathname = typeof window !== "undefined" ? window.location.pathname : null;
  return resolveNavigateToAgent(input, {
    readAgentNavTarget: ({ serverId, agentId }) => {
      const session = useSessionStore.getState().sessions[serverId];
      const agent = session?.agents.get(agentId) ?? session?.agentDetails.get(agentId);
      return {
        workspaces: session?.workspaces.values(),
        agentCwd: agent?.cwd,
      };
    },
    navigateToHostAgent: (route) => {
      router.navigate(route as Href);
    },
    navigateToPreparedWorkspaceTab: (navInput) =>
      navigateToPreparedWorkspaceTab({ ...navInput, currentPathname: pathname }),
  });
}
