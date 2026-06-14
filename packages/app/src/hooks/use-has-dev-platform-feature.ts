/**
 * Hook to check if the connected daemon supports dev-platform features.
 *
 * The server advertises `features.dev_platform: true` in its server_info response.
 * This hook reads that flag from the session store for the active server.
 */

import { useSessionStore } from "@/stores/session-store";
import { useActiveServerId } from "@/hooks/use-active-server-id";

/**
 * Returns true if the active daemon supports dev-platform features.
 */
export function useHasDevPlatformFeature(): boolean {
  const serverId = useActiveServerId();

  return useSessionStore(
    (state) => state.sessions[serverId ?? ""]?.serverInfo?.features?.dev_platform === true,
  );
}
