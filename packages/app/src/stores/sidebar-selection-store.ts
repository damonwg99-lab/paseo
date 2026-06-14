/**
 * Sidebar selection state for dev-platform mode.
 *
 * This store drives the right-side panel (file explorer / git status).
 * It is independent of the workspace route / middle area tabs.
 *
 * When the user clicks a git repo row in the sidebar, only this store updates —
 * the middle area tabs remain unchanged.
 */

import { create } from "zustand";

/**
 * What the user has selected in the dev-platform sidebar.
 * This drives the right panel content.
 */
export type SidebarSelection =
  | { kind: "repo"; relativePath: string; repoPath: string }
  | {
      kind: "worktree";
      relativePath: string;
      repoPath: string;
      worktreePath: string;
      worktreeBranch: string;
    }
  | { kind: "agent"; agentId: string }
  | { kind: "menu"; item: "project_list" | "task_list" }
  | { kind: "none" };

interface SidebarSelectionState {
  /** The currently selected sidebar item */
  selection: SidebarSelection;

  /** Set the selection (called when user clicks a sidebar row) */
  setSelection: (selection: SidebarSelection) => void;

  /** Reset selection to none */
  clearSelection: () => void;

  /** Select a git repo by relative path */
  selectRepo: (relativePath: string, repoPath: string) => void;

  /** Select a worktree */
  selectWorktree: (input: {
    relativePath: string;
    repoPath: string;
    worktreePath: string;
    worktreeBranch: string;
  }) => void;

  /** Select an agent */
  selectAgent: (agentId: string) => void;

  /** Select a menu item */
  selectMenu: (item: "project_list" | "task_list") => void;
}

export const useSidebarSelectionStore = create<SidebarSelectionState>((set) => ({
  selection: { kind: "none" },

  setSelection: (selection) => set({ selection }),

  clearSelection: () => set({ selection: { kind: "none" } }),

  selectRepo: (relativePath, repoPath) =>
    set({ selection: { kind: "repo", relativePath, repoPath } }),

  selectWorktree: ({ relativePath, repoPath, worktreePath, worktreeBranch }) =>
    set({
      selection: {
        kind: "worktree",
        relativePath,
        repoPath,
        worktreePath,
        worktreeBranch,
      },
    }),

  selectAgent: (agentId) => set({ selection: { kind: "agent", agentId } }),

  selectMenu: (item) => set({ selection: { kind: "menu", item } }),
}));
