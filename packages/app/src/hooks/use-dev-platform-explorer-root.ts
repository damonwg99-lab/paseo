/**
 * Dev-platform explorer root override hook.
 *
 * In dev-platform mode, when the user selects a git repo or worktree in the
 * left sidebar, the right-side file explorer should show that repo's directory
 * instead of the workspace root.
 *
 * This hook checks the sidebar-selection store and returns the effective root
 * path for the file explorer. When not in dev-platform mode, or when no
 * repo/worktree is selected, it returns the original workspace root unchanged.
 */

import { useHasDevPlatformFeature } from "@/hooks/use-has-dev-platform-feature";
import { useSidebarSelectionStore } from "@/stores/sidebar-selection-store";

export function useDevPlatformExplorerRoot(originalRoot: string | null): string | null {
  const hasDevPlatform = useHasDevPlatformFeature();
  const selection = useSidebarSelectionStore((s) => s.selection);

  if (!hasDevPlatform || !originalRoot) return originalRoot;

  if (selection.kind === "repo") return selection.repoPath;
  if (selection.kind === "worktree") return selection.worktreePath;

  return originalRoot;
}
