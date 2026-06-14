/**
 * Hook to check if the connected daemon supports dev-platform features.
 *
 * The server advertises `features.dev_platform: true` in its server_info response.
 * This hook reads that flag from the session store for the active server.
 *
 * TEMP: Hard-disabled while dev-platform sidebar is under development.
 * Re-enable by restoring the original imports and logic below.
 */

// TEMP: imports disabled — uncomment when re-enabling dev-platform
// import { useSessionStore } from "@/stores/session-store";
// import { useActiveServerId } from "@/hooks/use-active-server-id";

/**
 * Returns true if the active daemon supports dev-platform features.
 * TEMP: always returns false to hide dev-platform sidebar and restore original.
 */
export function useHasDevPlatformFeature(): boolean {
  return false;

  // Original logic (uncomment imports + this when ready):
  // const serverId = useActiveServerId();
  // return useSessionStore(
  //   (state) => state.sessions[serverId ?? ""]?.serverInfo?.features?.dev_platform === true,
  // );
}
