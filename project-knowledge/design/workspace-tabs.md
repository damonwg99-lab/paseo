# Workspace Tab System Architecture

This document describes the workspace tab system in Paseo, covering tab navigation in the middle area and tab storage design between workspaces.

## Overview

The workspace system uses a **two-layer persistence architecture** with **per-workspace state isolation** and a **mount-and-hide deck pattern** for instant workspace switching.

### Core Concepts

- **Workspace Key**: All state is keyed by `"serverId:workspaceId"` for isolation
- **Two-Layer Persistence**: Tab metadata (workspace-tabs-store) + layout tree (workspace-layout-store)
- **Mount-and-Hide Deck**: Inactive workspaces stay mounted with `display: none`, preserving React state
- **Deterministic Tab IDs**: Tab IDs are derived from target content (e.g., `agent_${agentId}`)

## Tab Data Model

### WorkspaceTabTarget (workspace-tabs-store/state.ts)

Discriminated union with 16 tab kinds:

```typescript
type WorkspaceTabTarget =
  | { kind: "draft"; draftId: string }
  | { kind: "agent"; agentId: string }
  | { kind: "terminal"; terminalId: string }
  | { kind: "browser"; browserId: string }
  | { kind: "file"; filePath: string }
  | { kind: "setup" }
  | { kind: "task"; taskId: string }
  | { kind: "kanban"; projectId: string }
  | { kind: "branches"; projectId: string }
  | { kind: "create_project" }
  | { kind: "create_task"; projectId: string }
  | { kind: "task_detail"; taskId: string }
  | { kind: "task_activity"; taskId: string }
  | { kind: "archived_tasks"; projectId: string }
  | { kind: "project_settings"; projectId: string }
  | { kind: "project_list" };
```

### WorkspaceTab

```typescript
interface WorkspaceTab {
  tabId: string;
  target: WorkspaceTabTarget;
  createdAt: number;
}
```

### WorkspaceTabsCoreState

Three parallel maps keyed by workspace:

```typescript
interface WorkspaceTabsCoreState {
  uiTabsByWorkspace: Record<string, WorkspaceTab[]>;
  tabOrderByWorkspace: Record<string, string[]>;
  focusedTabIdByWorkspace: Record<string, string>;
}
```

## Tab Identity System (workspace-tabs/identity.ts)

### Deterministic ID Generation

```typescript
buildDeterministicWorkspaceTabId(target: WorkspaceTabTarget): string
```

Generates stable IDs from tab target:

- `agent_${agentId}` for agent tabs
- `terminal_${terminalId}` for terminal tabs
- `draft_${draftId}` for draft tabs
- Singletons (setup, create_project, project_list) use kind name directly

### Target Normalization & Equality

- `normalizeWorkspaceTabTarget()`: Validates and normalizes tab targets
- `workspaceTabTargetsEqual()`: Deep equality check for targets
- `SINGLE_ID_KEYS`: Maps tab kinds to their ID field names

## Tab Storage Layer 1: Metadata (workspace-tabs-store)

### Store Configuration

- **Zustand store** with persist middleware
- **Persistence key**: `workspace-tabs-state`
- **Version**: 5 (migration system handles schema evolution)
- **Backend**: AsyncStorage

### State Shape

```typescript
{
  uiTabsByWorkspace: Record<string, WorkspaceTab[]>,
  tabOrderByWorkspace: Record<string, string[]>,
  focusedTabIdByWorkspace: Record<string, string>
}
```

### Actions

- `openDraftTab(workspaceKey)`: Opens new draft tab
- `ensureTab(workspaceKey, target)`: Ensures tab exists (creates if missing)
- `openOrFocusTab(workspaceKey, target)`: Opens tab or focuses existing
- `focusTab(workspaceKey, tabId)`: Focuses specific tab
- `closeTab(workspaceKey, tabId)`: Closes tab
- `retargetTab(workspaceKey, tabId, newTarget)`: Changes tab content
- `reorderTabs(workspaceKey, tabIds)`: Reorders tabs
- `purgeWorkspace(workspaceKey)`: Removes all state for workspace

### Pure Reducers

All state transitions use pure `apply*` functions:

- `applyEnsureTab`, `applyFocusTab`, `applyCloseTab`
- `applyRetargetTab`, `applyReorderTabs`, `applyPurgeWorkspace`

## Layout Storage Layer 2: Pane Tree (workspace-layout-store)

### WorkspaceLayout Structure

```typescript
interface WorkspaceLayout {
  root: SplitNode;
  focusedPaneId: string | null;
  parentTabIdByTabId: Record<string, string>;
}
```

### SplitNode Tree

Discriminated union supporting nested splits (max depth 4):

```typescript
type SplitNode = { kind: "pane"; pane: SplitPane } | { kind: "group"; group: SplitGroup };

interface SplitPane {
  id: string;
  tabIds: string[];
  focusedTabId: string | null;
}

interface SplitGroup {
  id: string;
  direction: "horizontal" | "vertical";
  children: SplitNode[];
  sizes: number[];
}
```

### Store Configuration

- **Persistence key**: `workspace-layout-state`
- **Version**: 1
- **Backend**: AsyncStorage

### Per-Workspace State

```typescript
{
  layoutByWorkspace: Record<string, WorkspaceLayout>,
  splitSizesByWorkspace: Record<string, number[]>,
  pinnedAgentIdsByWorkspace: Record<string, string[]>,
  hiddenAgentIdsByWorkspace: Record<string, string[]>,
  focusRestorationByWorkspace: Record<string, string>
}
```

### Layout Actions

- `openTabFocused`, `openChildTabFocused`, `openTabInBackground`
- `closeTab`, `focusTab`, `retargetTab`
- `convertDraftToAgent`, `reconcileTabs`, `reorderTabs`
- `splitPane`, `splitPaneEmpty`, `moveTabToPane`
- `focusPane`, `unfocusPane`, `restorePaneFocus`
- `resizeSplit`, `reorderTabsInPane`
- `pinAgent`, `unpinAgent`, `hideAgent`, `unhideAgent`
- `purgeWorkspace`

## Workspace Switching: Mount-and-Hide Deck

### Route Structure

Expo Router file-based route at `app/h/[serverId]/workspace/[workspaceId]/index.tsx`

### WorkspaceDeck Component

The `WorkspaceDeck` implements a **mount-and-hide pattern**:

```typescript
function WorkspaceDeck() {
  const [mountedSelections, setMountedSelections] = useState<WorkspaceSelection[]>([])
  const activeSelection = useActiveWorkspaceSelection()

  // Track all visited workspaces
  useEffect(() => {
    if (!mountedSelections.some(s => equals(s, activeSelection))) {
      setMountedSelections(prev => [...prev, activeSelection])
    }
  }, [activeSelection])

  return (
    <>
      {mountedSelections.map(selection => {
        const isActive = equals(selection, activeSelection)
        return (
          <WorkspaceScreen
            key={buildKey(selection)}
            serverId={selection.serverId}
            workspaceId={selection.workspaceId}
            style={{ display: isActive ? 'flex' : 'none', flex: isActive ? 1 : 0 }}
          />
        )
      })}
    </>
  )
}
```

### Key Benefits

1. **Instant switching**: Inactive workspaces stay mounted, preserving all React state
2. **No re-renders**: Switching back doesn't reload data or re-render components
3. **State preservation**: Scroll positions, form inputs, split pane sizes all preserved
4. **Memory trade-off**: Uses more memory for instant UX

### Navigation Flow

1. **UI Trigger**: User taps workspace in `sidebar-workspace-list.tsx`
2. **Navigation**: `navigateToWorkspace(serverId, workspaceId)` called
3. **Attention Agent**: Picks running agent in workspace, opens its tab
4. **Route Change**: `router.dismissTo(buildHostWorkspaceRoute(serverId, workspaceId))`
5. **Deck Update**: `WorkspaceDeck` shows/hides mounted `WorkspaceScreen` instances

## Tab Navigation Flow

### End-to-End Flow

1. **User Action**: Triggers store action (e.g., `openTabFocused`)
2. **Store Update**: Layout tree updated for workspace key
3. **Persistence**: Zustand persist middleware saves to AsyncStorage
4. **React Re-render**: Components re-render based on store selectors
5. **Pane State Derivation**: `WorkspaceScreen` calls `deriveWorkspacePaneState()`
6. **Content Rendering**: `WorkspacePaneContent` renders component for tab target kind

### Tab Preparation (prepare-workspace-tab.ts)

```typescript
prepareWorkspaceTab(workspaceKey, target, options);
```

- Opens tab in layout store
- Optionally pins agent
- Returns prepared tab info

```typescript
navigateToPreparedWorkspaceTab(workspaceKey, target, options);
```

- Prepares tab + navigates to workspace route
- Skips navigation if already on same workspace

### Workspace Screen Rendering (workspace-screen.tsx)

~3800 lines, handles:

- **Three-pane layout**: Left sidebar, center tabs+content, right panels
- **Platform branching**: Mobile vs desktop via `useIsCompactFormFactor()`
- **Desktop**: `WorkspaceDesktopTabsRow` renders horizontal tab bar
- **Mobile**: `MobileWorkspaceTabSwitcher` with combobox dropdown
- **Pane content**: `WorkspacePaneContent` renders appropriate component per tab kind

### Pane State Derivation (workspace-pane-state.ts)

```typescript
deriveWorkspacePaneState(layout, paneId): PaneState
```

Extracts pane state from layout tree:

- Tab list for pane
- Focused tab
- Pane dimensions

```typescript
buildWorkspacePaneContentModel(tab): PaneContentModel
```

Maps tab target to renderable content:

- Agent tab → `AgentPaneContent`
- Terminal tab → `TerminalPaneContent`
- Browser tab → `BrowserPaneContent`
- File tab → `FileViewerPaneContent`
- etc.

## Workspace Selection Persistence (last-workspace-selection.ts)

### Store Design

- **Purpose**: Remember last active workspace for app restart
- **Backend**: AsyncStorage with external store pattern
- **Hook**: `useSyncExternalStore` for React integration

### State Shape

```typescript
interface LastWorkspaceSelection {
  serverId: string;
  workspaceId: string;
}
```

### Hydration Flow

1. App starts → `hydrateLastWorkspaceSelection()` called
2. Reads from AsyncStorage key `paseo:last-workspace-route-selection`
3. Updates external store
4. Components using `useLastWorkspaceSelection()` re-render

### Update Flow

1. User switches workspace → `navigateToWorkspace()` called
2. `lastWorkspaceSelectionStore.set({ serverId, workspaceId })` called
3. Persists to AsyncStorage
4. On next app start, this selection is restored

## Key Files Reference

### Core Stores

- `packages/app/src/stores/workspace-tabs-store/state.ts` — Tab data model
- `packages/app/src/stores/workspace-tabs-store/index.ts` — Tab store with persistence
- `packages/app/src/stores/workspace-layout-store.ts` — Layout tree store
- `packages/app/src/stores/workspace-layout-actions.ts` — Layout manipulation functions
- `packages/app/src/stores/last-workspace-selection.ts` — Last workspace persistence

### Identity & Navigation

- `packages/app/src/workspace-tabs/identity.ts` — Tab ID generation, normalization
- `packages/app/src/stores/navigation-active-workspace-store/index.ts` — Active workspace navigation
- `packages/app/src/stores/navigation-active-workspace-store/navigation.ts` — Navigation logic
- `packages/app/src/utils/prepare-workspace-tab.ts` — Tab preparation utilities
- `packages/app/src/utils/workspace-navigation.ts` — Workspace navigation helpers
- `packages/app/src/utils/host-routes.ts` — Route building/parsing

### UI Components

- `packages/app/src/screens/workspace/workspace-screen.tsx` — Main workspace screen (~3800 lines)
- `packages/app/src/screens/workspace/workspace-pane-state.ts` — Pane state derivation
- `packages/app/src/app/h/[serverId]/workspace/[workspaceId]/index.tsx` — Workspace route (WorkspaceDeck)
- `packages/app/src/components/sidebar-workspace-list.tsx` — Sidebar workspace list

### Data & Creation

- `packages/app/src/stores/session-store.ts` — Workspace descriptors
- `packages/app/src/screens/new-workspace-screen.tsx` — Workspace creation
- `packages/app/src/workspace/workspace-archive.ts` — Workspace archival

## Architectural Patterns

### Workspace Key Convention

All stores use `"serverId:workspaceId"` as the key format:

```typescript
const workspaceKey = `${serverId}:${workspaceId}`;
```

This ensures complete isolation between workspaces across all servers.

### Two-Layer Persistence

**Layer 1: Tab Metadata** (workspace-tabs-store)

- What tabs exist in each workspace
- Tab ordering
- Which tab is focused

**Layer 2: Layout Tree** (workspace-layout-store)

- How tabs are arranged (split panes)
- Pane sizes and focus
- Pinned/hidden agents

Both layers persist independently, allowing granular control and migration.

### Pure Function Architecture

All state mutations use pure reducer functions:

```typescript
// Pure function
function applyFocusTab(state, workspaceKey, tabId): State;

// Store action calls pure function
focusTab: (workspaceKey, tabId) => {
  set((state) => applyFocusTab(state, workspaceKey, tabId));
};
```

Benefits:

- Testable in isolation
- Predictable state transitions
- Easy to reason about

### Platform Gating

Platform-specific rendering uses hooks, not runtime checks:

```typescript
const isCompact = useIsCompactFormFactor()

return isCompact ? <MobileTabs /> : <DesktopTabs />
```

Metro file extensions (`.web.ts`, `.native.ts`) preferred over `if (Platform.OS === ...)` checks.

## Testing Considerations

### Unit Tests

- Test pure reducers (`apply*` functions) in isolation
- Test tab identity functions (`buildDeterministicWorkspaceTabId`, etc.)
- Test layout tree manipulation (`splitPane`, `moveTabToPane`, etc.)

### Integration Tests

- Test store actions with real Zustand store
- Test persistence hydration/dehydration
- Test navigation flow with mock router

### E2E Tests

- Test workspace switching preserves tab state
- Test tab creation/focus/close flows
- Test split pane resizing and reordering

## Performance Characteristics

### Memory Usage

- **Mount-and-hide deck**: Each visited workspace stays in memory
- **Trade-off**: Instant switching vs memory consumption
- **Mitigation**: Could implement LRU eviction for old workspaces (not currently implemented)

### Persistence

- **AsyncStorage**: Async writes, may lag behind state changes
- **Debounce**: Zustand persist middleware debounces writes
- **Migration**: Version-based migration system handles schema changes

### Rendering

- **Selector optimization**: Use granular selectors to minimize re-renders
- **Memoization**: `deriveWorkspacePaneState` results can be memoized
- **Virtualization**: Tab bars could virtualize if many tabs (not currently needed)

## Future Considerations

### Potential Enhancements

1. **Tab groups**: Group related tabs (e.g., all tabs for a project)
2. **Tab search**: Quick-jump to tab by name/content
3. **Tab history**: Navigate back through recently focused tabs
4. **Workspace templates**: Pre-configured workspace layouts
5. **Tab persistence policies**: Configurable which tabs survive restart
6. **LRU workspace eviction**: Limit memory usage for mount-and-hide deck

### Scaling Concerns

- **Many tabs**: Tab bar may need virtualization beyond ~50 tabs
- **Many workspaces**: Mount-and-hide deck may need eviction policy beyond ~20 workspaces
- **Large layouts**: Split tree depth limit (4) prevents pathological cases

## Conclusion

The workspace tab system uses a clean separation of concerns:

- **Tab metadata** (what tabs exist)
- **Layout tree** (how tabs are arranged)
- **Navigation** (which workspace is active)
- **Rendering** (how tabs display content)

The mount-and-hide deck pattern provides instant workspace switching at the cost of memory. The two-layer persistence design allows independent evolution of tab metadata and layout structure. Pure function architecture makes the system testable and predictable.
