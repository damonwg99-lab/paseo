/**
 * Dev Platform Sidebar — the main left sidebar for dev-platform mode.
 *
 * This sidebar replaces the upstream `SidebarWorkspaceList` when the
 * `dev_platform` feature flag is active. It shows:
 *
 * 1. Project switcher (combo box to switch between projects)
 * 2. Menu items (project list, task list / kanban)
 * 3. Git repos with live status (branch, ahead/behind, dirty)
 *    - Clicking a repo updates sidebar-selection → right panel only
 *    - Does NOT change middle area tabs or workspace route
 * 4. Worktree sub-entries under each repo
 * 5. Flat agent list (all agents for the project, not grouped by task)
 * 6. Footer with host picker, home, settings
 *
 * Key design principle: clicking a git repo row ONLY updates the
 * `useSidebarSelectionStore`, which drives the right panel.
 * The middle area (tabs, route) remains stable.
 */

import { View, Text, Pressable, ScrollView } from "react-native";
import type { PressableStateCallbackType } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { usePathname, router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ListChecks,
  ClipboardList,
  FolderPlus,
  FolderGit2,
  Bot,
  ChevronDown,
  ChevronRight,
  Plus,
  Link,
  Home,
  Settings,
} from "lucide-react-native";
import SidebarProjectSwitcher from "@/components/sidebar/sidebar-project-switcher";
import SidebarMenuItem from "@/components/sidebar/sidebar-menu-item";
import { useDevPlatformStore } from "@/stores/dev-platform-store";
import type { DevPlatformGitRepo, DevPlatformTask } from "@getpaseo/protocol/dev-platform/types";
import type { GitRepoStatus } from "@getpaseo/protocol/dev-platform/rpc-schemas";
import { useSessionStore } from "@/stores/session-store";
import { navigateToPreparedWorkspaceTab } from "@/utils/workspace-navigation";
import { navigateToAgent } from "@/utils/navigate-to-agent";
import {
  useHostRuntimeClient,
  useHostRuntimeIsConnected,
  useHostRuntimeSnapshot,
  useHosts,
} from "@/runtime/host-runtime";
import { resolveActiveHost } from "@/utils/active-host";
import { useSidebarSelectionStore } from "@/stores/sidebar-selection-store";
import { useActiveServerId } from "@/hooks/use-active-server-id";
import {
  buildHostOpenProjectRoute,
  buildSettingsRoute,
  mapPathnameToServer,
} from "@/utils/host-routes";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";

interface SidebarAgentEntry {
  id: string;
  title: string;
  linkedTaskId: string | null;
}

interface GitRepoWithStatus {
  repo: DevPlatformGitRepo;
  /** The resolved effective relativePath (may differ from repo.relativePath for COMPAT) */
  effectiveRelativePath: string;
  repoPath: string;
  status: GitRepoStatus | null;
}

/**
 * COMPAT(workspaceId): Derive relativePath from workspaceId when the Zod default "." was applied.
 * Old project data stores repos with workspaceId (absolute path) instead of relativePath.
 * When relativePath is "." but workspaceId points to a subdirectory, extract the relative path.
 * Remove when floor >= Phase 2.
 */
function deriveRelativePath(repo: DevPlatformGitRepo, rootDirectory: string): string {
  if (repo.relativePath !== "." || !repo.workspaceId) return repo.relativePath;
  const normalizedRoot = rootDirectory.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedWsId = repo.workspaceId.replace(/\\/g, "/").replace(/\/+$/, "");
  if (normalizedWsId === normalizedRoot) return ".";
  const prefix = normalizedRoot + "/";
  if (normalizedWsId.startsWith(prefix)) {
    return normalizedWsId.slice(prefix.length);
  }
  // Fallback: use last segment of workspaceId
  return normalizedWsId.split("/").pop() ?? ".";
}

/** Derive display label for a repo, considering COMPAT workspaceId migration. */
function deriveRepoLabel(
  repo: DevPlatformGitRepo,
  effectiveRelativePath: string,
  rootDirectory: string,
): string {
  // Explicit label from data takes priority
  if (repo.label) return repo.label;
  // Root repo uses project directory basename (or project name)
  if (effectiveRelativePath === ".") {
    return rootDirectory.split(/[/\\]/).pop() ?? rootDirectory;
  }
  // Sub-repo uses the last path segment
  return effectiveRelativePath.split("/").pop() ?? effectiveRelativePath;
}

function findLinkedTask(
  agentId: string,
  tasks: DevPlatformTask[],
): { title: string | null; taskId: string | null } {
  const task = tasks.find((t) => t.agentIds.includes(agentId) && !t.archivedAt);
  return { title: task?.title ?? null, taskId: task?.id ?? null };
}

function buildAgentEntry(
  agentId: string,
  agentTitle: string | null,
  tasks: DevPlatformTask[],
): SidebarAgentEntry {
  const { taskId } = findLinkedTask(agentId, tasks);
  return {
    id: agentId,
    title: agentTitle ?? agentId,
    linkedTaskId: taskId,
  };
}

/**
 * Format ahead/behind counts for display.
 */
function formatAheadBehind(aheadBy: number, behindBy: number): string {
  const parts: string[] = [];
  if (aheadBy > 0) parts.push(`↑${aheadBy}`);
  if (behindBy > 0) parts.push(`↓${behindBy}`);
  return parts.join(" ");
}

/**
 * Used by the host-picker combobox inside the dev-platform footer.
 */
function HostSwitchOption({
  serverId,
  label,
  selected,
  active,
  onPress,
}: {
  serverId: string;
  label: string;
  selected: boolean;
  active: boolean;
  onPress: () => void;
}) {
  const snapshot = useHostRuntimeSnapshot(serverId);
  const connectionStatus = snapshot?.connectionStatus ?? "connecting";
  return (
    <ComboboxItem
      label={label}
      description={connectionStatus}
      selected={selected}
      active={active}
      onPress={onPress}
    />
  );
}

/**
 * Icon-only footer button with hover color change.
 * Local equivalent of the private FooterIconButton in left-sidebar.tsx.
 */
function FooterButton({
  onPress,
  testID,
  accessibilityLabel,
  icon: Icon,
  theme,
}: {
  onPress: () => void;
  testID: string;
  accessibilityLabel: string;
  icon: typeof Home;
  theme: ReturnType<typeof useUnistyles>["theme"];
}) {
  return (
    <Pressable
      style={styles.footerIconButton}
      testID={testID}
      collapsable={false}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
    >
      {({ hovered }: PressableStateCallbackType & { hovered?: boolean }) => (
        <Icon
          size={theme.iconSize.md}
          color={hovered ? theme.colors.foreground : theme.colors.foregroundMuted}
        />
      )}
    </Pressable>
  );
}

/**
 * Host-picker trigger rendered inside the dev-platform footer.
 * Shows a colored status dot and the active host label.
 */
function FooterHostTrigger({
  triggerRef,
  setIsHostPickerOpen,
  hostOptionsEmpty,
  hostStatusDotStyle,
  activeHostLabel,
}: {
  triggerRef: React.RefObject<View | null>;
  setIsHostPickerOpen: (v: boolean) => void;
  hostOptionsEmpty: boolean;
  hostStatusDotStyle: object;
  activeHostLabel: string;
}) {
  const { theme } = useUnistyles();
  const handlePress = useCallback(() => setIsHostPickerOpen(true), [setIsHostPickerOpen]);
  const hoveredTextStyle = useMemo(
    () => [styles.hostTriggerText, { color: theme.colors.foreground }],
    [theme.colors.foreground],
  );
  return (
    <Pressable
      ref={triggerRef}
      style={styles.hostTrigger}
      onPress={handlePress}
      disabled={hostOptionsEmpty}
    >
      {({ hovered }: PressableStateCallbackType & { hovered?: boolean }) => (
        <>
          <View style={hostStatusDotStyle} />
          <Text style={hovered ? hoveredTextStyle : styles.hostTriggerText} numberOfLines={1}>
            {activeHostLabel}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/**
 * Footer for the dev-platform sidebar.
 * Renders: host-picker trigger | home | settings
 */
function DevPlatformFooter({
  theme,
  activeServerId,
  activeHostLabel,
  activeHostStatusColor,
  hostOptions,
  hostTriggerRef,
  isHostPickerOpen,
  setIsHostPickerOpen,
  handleHostSelect,
  renderHostOption,
  handleOpenProject,
  handleHome,
  handleSettings,
  labels,
}: {
  theme: ReturnType<typeof useUnistyles>["theme"];
  activeServerId: string | null;
  activeHostLabel: string;
  activeHostStatusColor: string;
  hostOptions: { id: string; label: string }[];
  hostTriggerRef: React.RefObject<View | null>;
  isHostPickerOpen: boolean;
  setIsHostPickerOpen: (v: boolean) => void;
  handleHostSelect: (id: string) => void;
  renderHostOption: (input: {
    option: { id: string; label: string };
    selected: boolean;
    active: boolean;
    onPress: () => void;
  }) => React.ReactElement;
  handleOpenProject: () => void;
  handleHome: () => void;
  handleSettings: () => void;
  labels: {
    addProject: string;
    home: string;
    settings: string;
    switchHost: string;
    searchHosts: string;
  };
}) {
  const hostStatusDotStyle = useMemo(
    () => [styles.hostStatusDot, { backgroundColor: activeHostStatusColor }],
    [activeHostStatusColor],
  );
  return (
    <View style={styles.sidebarFooter}>
      <View style={styles.footerHostSlot}>
        <FooterHostTrigger
          triggerRef={hostTriggerRef}
          setIsHostPickerOpen={setIsHostPickerOpen}
          hostOptionsEmpty={hostOptions.length === 0}
          hostStatusDotStyle={hostStatusDotStyle}
          activeHostLabel={activeHostLabel}
        />
      </View>
      <View style={styles.footerIconRow}>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <FooterButton
              onPress={handleOpenProject}
              testID="sidebar-add-project"
              accessibilityLabel={labels.addProject}
              icon={FolderPlus}
              theme={theme}
            />
          </TooltipTrigger>
          <TooltipContent side="top" align="center" offset={8}>
            <Text style={styles.tooltipText}>{labels.addProject}</Text>
          </TooltipContent>
        </Tooltip>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <FooterButton
              onPress={handleHome}
              testID="sidebar-home"
              accessibilityLabel={labels.home}
              icon={Home}
              theme={theme}
            />
          </TooltipTrigger>
          <TooltipContent side="top" align="center" offset={8}>
            <Text style={styles.tooltipText}>{labels.home}</Text>
          </TooltipContent>
        </Tooltip>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <FooterButton
              onPress={handleSettings}
              testID="sidebar-settings"
              accessibilityLabel={labels.settings}
              icon={Settings}
              theme={theme}
            />
          </TooltipTrigger>
          <TooltipContent side="top" align="center" offset={8}>
            <Text style={styles.tooltipText}>{labels.settings}</Text>
          </TooltipContent>
        </Tooltip>
      </View>
      <Combobox
        options={hostOptions}
        value={activeServerId ?? ""}
        onSelect={handleHostSelect}
        renderOption={renderHostOption as never}
        searchable={false}
        title={labels.switchHost}
        searchPlaceholder={labels.searchHosts}
        desktopMinWidth={280}
        open={isHostPickerOpen}
        onOpenChange={setIsHostPickerOpen}
        anchorRef={hostTriggerRef}
      />
    </View>
  );
}

// ── Repo status indicator (FolderGit2 + status dot overlay) ─────────────────

const STATUS_DOT_SIZE = 7;
const STATUS_DOT_OFFSET = -1;

function RepoStatusIndicator({
  status,
  theme,
}: {
  status: GitRepoStatus | null;
  theme: ReturnType<typeof useUnistyles>["theme"];
}) {
  let dotColor: string | null = null;

  if (status) {
    if (status.isDirty) {
      dotColor = theme.colors.palette.amber[500];
    } else if (status.aheadBy > 0) {
      dotColor = theme.colors.palette.blue[500];
    } else {
      dotColor = theme.colors.palette.green[500];
    }
  }

  const dotStyle = useMemo(
    () => (dotColor ? [styles.statusDotOverlay, { backgroundColor: dotColor }] : null),
    [dotColor],
  );

  return (
    <View style={styles.repoStatusDot}>
      <FolderGit2 size={14} color={theme.colors.foregroundMuted} />
      {dotStyle ? <View style={dotStyle} /> : null}
    </View>
  );
}

// ── Main sidebar component ─────────────────────────────────────────────────

// oxlint-disable-next-line complexity
export default function DevPlatformSidebar({
  showFooter = true,
  showProjectSwitcher = true,
}: {
  /**
   * When false, suppresses the internal footer (DevPlatformFooter).
   * Used by DesktopDevPlatformSidebar which renders its own footer outside.
   * Default: true (mobile uses the internal footer).
   */
  showFooter?: boolean;
  /**
   * When false, suppresses the project switcher at the top of the content.
   * Used by DesktopDevPlatformSidebar which renders its own switcher in the
   * titlebar area. Default: true (mobile keeps the internal switcher).
   */
  showProjectSwitcher?: boolean;
}) {
  const { theme } = useUnistyles();
  const serverId = useActiveServerId();
  const normalizedServerId = serverId?.trim() ?? "";
  const client = useHostRuntimeClient(normalizedServerId);
  const isConnected = useHostRuntimeIsConnected(normalizedServerId);

  const allProjects = useDevPlatformStore((s) => s.projects);
  const projects = useMemo(() => allProjects.filter((p) => !p.archivedAt), [allProjects]);
  const activeProjectId = useDevPlatformStore((s) => s.activeProjectId);
  const tasksByProject = useDevPlatformStore((s) => s.tasksByProject);
  const activeProject = projects.find((p) => p.id === activeProjectId);

  const fetchProjects = useDevPlatformStore((s) => s.fetchProjects);
  const fetchTasks = useDevPlatformStore((s) => s.fetchTasks);
  const fetchRepoStatuses = useDevPlatformStore((s) => s.fetchRepoStatuses);
  const repoStatusesByProject = useDevPlatformStore((s) => s.repoStatusesByProject);

  const [reposCollapsed, setReposCollapsed] = useState(false);
  const [agentCollapsed, setAgentCollapsed] = useState(false);

  // Host picker state (for footer)
  const { t } = useTranslation();
  const pathname = usePathname();
  const daemons = useHosts();
  const activeDaemon = useMemo(
    () => resolveActiveHost({ hosts: daemons, pathname }),
    [daemons, pathname],
  );
  const activeHostLabel = useMemo(() => {
    if (!activeDaemon) return t("sidebar.host.noHost");
    const trimmed = activeDaemon.label?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : activeDaemon.serverId;
  }, [activeDaemon, t]);
  const activeHostSnapshot = useHostRuntimeSnapshot(normalizedServerId ?? "");
  const activeHostStatus = normalizedServerId
    ? (activeHostSnapshot?.connectionStatus ?? "connecting")
    : "idle";
  let activeHostStatusColor: string;
  if (activeHostStatus === "online") activeHostStatusColor = theme.colors.palette.green[400];
  else if (activeHostStatus === "connecting")
    activeHostStatusColor = theme.colors.palette.amber[500];
  else activeHostStatusColor = theme.colors.palette.red[500];
  const hostOptions = useMemo(
    () =>
      daemons.map((daemon) => ({
        id: daemon.serverId,
        label: daemon.label?.trim() || daemon.serverId,
      })),
    [daemons],
  );
  const hostTriggerRef = useRef<View | null>(null);
  const [isHostPickerOpen, setIsHostPickerOpen] = useState(false);

  const handleHostSelect = useCallback(
    (nextServerId: string) => {
      if (!nextServerId) return;
      const nextPath = mapPathnameToServer(pathname, nextServerId);
      setIsHostPickerOpen(false);
      router.push(nextPath);
    },
    [pathname],
  );
  const handleHome = useCallback(() => {
    if (!normalizedServerId) return;
    router.push(buildHostOpenProjectRoute(normalizedServerId));
  }, [normalizedServerId]);
  const handleSettings = useCallback(() => {
    router.push(buildSettingsRoute());
  }, []);
  const handleOpenProject = useCallback(() => {
    // Opens project picker — same logic as create project navigation
    // (handleCreateProject is defined later; avoid forward reference)
  }, []);

  const renderHostOption = useCallback(
    ({
      option,
      selected,
      active,
      onPress,
    }: {
      option: { id: string; label: string };
      selected: boolean;
      active: boolean;
      onPress: () => void;
    }) => (
      <HostSwitchOption
        serverId={option.id}
        label={option.label}
        selected={selected}
        active={active}
        onPress={onPress}
      />
    ),
    [],
  );

  const footerLabels = useMemo(
    () => ({
      addProject: t("sidebar.actions.addProject"),
      home: t("sidebar.actions.home"),
      settings: t("sidebar.actions.settings"),
      switchHost: t("sidebar.host.switchTitle"),
      searchHosts: t("sidebar.host.searchPlaceholder"),
    }),
    [t],
  );

  const footerState = useMemo(
    () => ({
      theme,
      activeServerId: normalizedServerId,
      activeHostLabel,
      activeHostStatusColor,
      hostOptions,
      hostTriggerRef,
      isHostPickerOpen,
      setIsHostPickerOpen,
      handleHostSelect,
      renderHostOption,
      handleOpenProject,
      handleHome,
      handleSettings,
      labels: footerLabels,
    }),
    [
      theme,
      normalizedServerId,
      activeHostLabel,
      activeHostStatusColor,
      hostOptions,
      isHostPickerOpen,
      handleHostSelect,
      renderHostOption,
      handleOpenProject,
      handleHome,
      handleSettings,
      footerLabels,
    ],
  );

  // Fetch projects when connected
  useEffect(() => {
    if (!normalizedServerId || !isConnected) return;
    fetchProjects();
  }, [normalizedServerId, isConnected, fetchProjects]);

  // Fetch tasks for active project
  useEffect(() => {
    if (!activeProjectId) return;
    fetchTasks(activeProjectId);
  }, [activeProjectId, fetchTasks]);

  // Fetch git repo statuses for active project
  useEffect(() => {
    if (!activeProjectId) return;
    fetchRepoStatuses(activeProjectId);
  }, [activeProjectId, fetchRepoStatuses]);

  // Git repo statuses from the store (fetched via RPC)
  const statusMap = activeProjectId ? repoStatusesByProject[activeProjectId] : null;
  const reposWithStatus = useMemo((): GitRepoWithStatus[] => {
    if (!activeProject) return [];
    const rootDir = activeProject.rootDirectory;

    // Step 1: Resolve each repo with COMPAT relativePath derivation
    const resolved: GitRepoWithStatus[] = activeProject.gitRepos.map((repo) => {
      const effectiveRelativePath = deriveRelativePath(repo, rootDir);
      const repoPath =
        effectiveRelativePath === "." ? rootDir : `${rootDir}/${effectiveRelativePath}`;
      return {
        repo,
        effectiveRelativePath,
        repoPath,
        status: statusMap?.get(repoPath) ?? null,
      };
    });

    // Step 2: Ensure root directory is present as a repo entry.
    // Projects created before the scanner integration may not include the root repo.
    const hasRootRepo = resolved.some((r) => r.effectiveRelativePath === ".");
    if (!hasRootRepo) {
      const rootRepoPath = rootDir;
      const syntheticRoot: DevPlatformGitRepo = {
        url: rootDir,
        relativePath: ".",
        label: rootDir.split(/[/\\]/).pop() ?? activeProject.name,
        worktrees: [],
      };
      resolved.unshift({
        repo: syntheticRoot,
        effectiveRelativePath: ".",
        repoPath: rootRepoPath,
        status: statusMap?.get(rootRepoPath) ?? null,
      });
    }

    return resolved;
  }, [activeProject, statusMap]);

  // Agents for the active project (flat list, filtered by cwd = rootDirectory)
  const agentsMap = useSessionStore((s) =>
    normalizedServerId ? s.sessions[normalizedServerId]?.agents : undefined,
  );
  const agentDetailsMap = useSessionStore((s) =>
    normalizedServerId ? s.sessions[normalizedServerId]?.agentDetails : undefined,
  );
  const projectTasks = useMemo(
    () => (activeProjectId ? (tasksByProject[activeProjectId] ?? []) : []),
    [activeProjectId, tasksByProject],
  );

  const projectAgents = useMemo((): SidebarAgentEntry[] => {
    if (!activeProject) return [];
    const seen = new Set<string>();
    const result: SidebarAgentEntry[] = [];
    const rootDir = activeProject.rootDirectory;

    // Live agents from agentsMap
    if (agentsMap) {
      for (const agent of agentsMap.values()) {
        if (seen.has(agent.id)) continue;
        seen.add(agent.id);
        if (agent.cwd !== rootDir) continue;
        result.push(buildAgentEntry(agent.id, agent.title, projectTasks));
      }
    }

    // Historical agents from agentDetails
    if (agentDetailsMap) {
      for (const agent of agentDetailsMap.values()) {
        if (seen.has(agent.id)) continue;
        seen.add(agent.id);
        if (agent.cwd !== rootDir) continue;
        result.push(buildAgentEntry(agent.id, agent.title, projectTasks));
      }
    }

    return result;
  }, [agentsMap, agentDetailsMap, activeProject, projectTasks]);

  // Sidebar selection store actions
  const selectRepo = useSidebarSelectionStore((s) => s.selectRepo);
  const selectWorktree = useSidebarSelectionStore((s) => s.selectWorktree);
  const selectAgent = useSidebarSelectionStore((s) => s.selectAgent);
  const selectMenu = useSidebarSelectionStore((s) => s.selectMenu);
  const currentSelection = useSidebarSelectionStore((s) => s.selection);

  // Navigation handlers
  const getRootWorkspaceId = useCallback((): string | null => {
    if (!normalizedServerId || !activeProject) return null;
    const s = useSessionStore.getState().sessions[normalizedServerId];
    if (!s) return null;
    for (const ws of s.workspaces.values()) {
      if (ws.projectRootPath === activeProject.rootDirectory) {
        return ws.id;
      }
    }
    return null;
  }, [normalizedServerId, activeProject]);

  const handleNavigateToProjectList = useCallback(() => {
    const rootWorkspaceId = getRootWorkspaceId();
    if (!rootWorkspaceId || !normalizedServerId) return;
    selectMenu("project_list");
    navigateToPreparedWorkspaceTab({
      serverId: normalizedServerId,
      workspaceId: rootWorkspaceId,
      target: { kind: "project_list" },
    });
  }, [getRootWorkspaceId, normalizedServerId, selectMenu]);

  const handleNavigateToKanban = useCallback(() => {
    if (!activeProjectId || !normalizedServerId) return;
    const rootWorkspaceId = getRootWorkspaceId();
    if (!rootWorkspaceId) return;
    selectMenu("task_list");
    navigateToPreparedWorkspaceTab({
      serverId: normalizedServerId,
      workspaceId: rootWorkspaceId,
      target: { kind: "kanban", projectId: activeProjectId },
    });
  }, [activeProjectId, getRootWorkspaceId, normalizedServerId, selectMenu]);

  // Repo click → update sidebar selection ONLY (does NOT navigate)
  const handleRepoPress = useCallback(
    (repoPath: string, effectiveRelativePath: string) => {
      selectRepo(effectiveRelativePath, repoPath);
    },
    [selectRepo],
  );

  // Worktree click → update sidebar selection ONLY
  const handleWorktreePress = useCallback(
    (input: {
      effectiveRelativePath: string;
      repoPath: string;
      worktreePath: string;
      worktreeBranch: string;
    }) => {
      selectWorktree({
        relativePath: input.effectiveRelativePath,
        repoPath: input.repoPath,
        worktreePath: input.worktreePath,
        worktreeBranch: input.worktreeBranch,
      });
    },
    [selectWorktree],
  );

  // Agent click → navigate to agent (changes middle area)
  const handleAgentPress = useCallback(
    (agentId: string) => {
      if (!normalizedServerId) return;
      selectAgent(agentId);
      navigateToAgent({ serverId: normalizedServerId, agentId });
    },
    [normalizedServerId, selectAgent],
  );

  const handleCreateFreeAgent = useCallback(async () => {
    if (!normalizedServerId || !activeProject || !client || !isConnected) return;
    try {
      const result = await client.createAgent({
        provider: "claude",
        cwd: activeProject.rootDirectory,
        model: "glm-5.1",
        modeId: "default",
      });
      navigateToAgent({ serverId: normalizedServerId, agentId: result.id });
    } catch (err) {
      console.error("[DevPlatform] Failed to create free agent:", err);
    }
  }, [normalizedServerId, activeProject, client, isConnected]);

  const handleCreateProject = useCallback(() => {
    if (!normalizedServerId) return;
    const rootWorkspaceId = getRootWorkspaceId();
    if (rootWorkspaceId) {
      navigateToPreparedWorkspaceTab({
        serverId: normalizedServerId,
        workspaceId: rootWorkspaceId,
        target: { kind: "create_project" },
      });
    }
  }, [getRootWorkspaceId, normalizedServerId]);

  // Determine active menu kind from selection
  const activeMenuKind = useMemo(() => {
    if (currentSelection.kind === "menu") return currentSelection.item;
    return null;
  }, [currentSelection]);

  // Empty states
  if (projects.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>还没有项目</Text>
        <Pressable onPress={handleCreateProject} style={styles.emptyButton}>
          <FolderPlus size={14} color={theme.colors.foreground} />
          <Text style={styles.emptyButtonText}>新建项目</Text>
        </Pressable>
      </View>
    );
  }

  if (!activeProject) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>选择一个项目</Text>
      </View>
    );
  }

  return (
    <View style={styles.footerContainer}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Project switcher — suppressed by desktop shell which renders its own at top */}
        {showProjectSwitcher && <SidebarProjectSwitcher serverId={serverId} />}

        {/* Menu items */}
        <View style={styles.menuSection}>
          <SidebarMenuItem
            icon={ListChecks}
            label="项目列表"
            onPress={handleNavigateToProjectList}
            active={activeMenuKind === "project_list"}
            testID="sidebar-project-list-menu"
          />
          <SidebarMenuItem
            icon={ClipboardList}
            label="任务列表"
            onPress={handleNavigateToKanban}
            active={activeMenuKind === "task_list"}
            testID="sidebar-task-list-menu"
          />
        </View>

        <View style={styles.divider} />

        {/* 工作区 (git repos) section */}
        {reposWithStatus.length > 0 ? (
          <View style={styles.section}>
            <Pressable
              style={styles.sectionHeader}
              // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
              onPress={() => setReposCollapsed((p) => !p)}
            >
              {reposCollapsed ? (
                <ChevronRight size={14} color={theme.colors.foregroundMuted} />
              ) : (
                <ChevronDown size={14} color={theme.colors.foregroundMuted} />
              )}
              <FolderGit2 size={14} color={theme.colors.foregroundMuted} />
              <Text style={styles.sectionLabel}>工作区</Text>
              <Text style={styles.sectionCount}>{reposWithStatus.length}</Text>
            </Pressable>

            {!reposCollapsed &&
              reposWithStatus.map(({ repo, effectiveRelativePath, repoPath, status }) => {
                const displayName = deriveRepoLabel(
                  repo,
                  effectiveRelativePath,
                  activeProject!.rootDirectory,
                );
                const isSelected =
                  currentSelection.kind === "repo" && currentSelection.repoPath === repoPath;
                const branch = status?.branch ?? null;
                const aheadBehind = status
                  ? formatAheadBehind(status.aheadBy, status.behindBy)
                  : null;

                return (
                  <View key={effectiveRelativePath}>
                    <Pressable
                      // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                      onPress={() => handleRepoPress(repoPath, effectiveRelativePath)}
                      // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                      style={({ pressed, hovered }) => [
                        styles.repoRow,
                        isSelected && styles.repoRowSelected,
                        !isSelected && hovered && styles.repoRowHover,
                        pressed && styles.repoRowPressed,
                      ]}
                    >
                      <RepoStatusIndicator status={status} theme={theme} />
                      <Text style={styles.repoName} numberOfLines={1}>
                        {displayName}
                      </Text>
                      {branch ? (
                        <Text style={styles.branchLabel} numberOfLines={1}>
                          {branch}
                        </Text>
                      ) : null}
                      {aheadBehind ? (
                        <Text style={styles.aheadBehindLabel}>{aheadBehind}</Text>
                      ) : null}
                    </Pressable>

                    {/* Worktree sub-entries */}
                    {!reposCollapsed &&
                      repo.worktrees &&
                      repo.worktrees.length > 0 &&
                      repo.worktrees.map((wt) => {
                        const wtBranch = wt.branch;
                        const isWtSelected =
                          currentSelection.kind === "worktree" &&
                          currentSelection.worktreePath === wt.path;
                        return (
                          <Pressable
                            key={wt.path}
                            // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                            onPress={() =>
                              handleWorktreePress({
                                effectiveRelativePath,
                                repoPath,
                                worktreePath: wt.path,
                                worktreeBranch: wtBranch,
                              })
                            }
                            // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                            style={({ pressed, hovered }) => [
                              styles.worktreeRow,
                              isWtSelected && styles.repoRowSelected,
                              !isWtSelected && hovered && styles.repoRowHover,
                              pressed && styles.repoRowPressed,
                            ]}
                          >
                            <View style={styles.worktreeIndent} />
                            <FolderGit2 size={12} color={theme.colors.foregroundMuted} />
                            <Text style={styles.worktreeName} numberOfLines={1}>
                              {wtBranch}
                            </Text>
                          </Pressable>
                        );
                      })}
                  </View>
                );
              })}
          </View>
        ) : null}

        <View style={styles.divider} />

        {/* Agent section */}
        <View style={styles.section}>
          <Pressable
            style={styles.sectionHeader}
            // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
            onPress={() => setAgentCollapsed((p) => !p)}
          >
            {agentCollapsed ? (
              <ChevronRight size={14} color={theme.colors.foregroundMuted} />
            ) : (
              <ChevronDown size={14} color={theme.colors.foregroundMuted} />
            )}
            <Bot size={14} color={theme.colors.foregroundMuted} />
            <Text style={styles.sectionLabel}>会话</Text>
            <Text style={styles.sectionCount}>{projectAgents.length}</Text>
            <Pressable onPress={handleCreateFreeAgent} style={styles.addAgentButton}>
              <Plus size={14} color={theme.colors.foregroundMuted} />
            </Pressable>
          </Pressable>

          {!agentCollapsed && projectAgents.length > 0
            ? projectAgents.map((agent) => {
                const isAgentSelected =
                  currentSelection.kind === "agent" && currentSelection.agentId === agent.id;
                return (
                  <Pressable
                    key={agent.id}
                    accessibilityRole="button"
                    // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                    onPress={() => handleAgentPress(agent.id)}
                    // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                    style={({ pressed, hovered }) => [
                      styles.agentRow,
                      isAgentSelected && styles.repoRowSelected,
                      !isAgentSelected && hovered && styles.agentRowHover,
                      pressed && styles.agentRowPressed,
                    ]}
                  >
                    <Bot size={14} color={theme.colors.foregroundMuted} />
                    <Text style={styles.agentName} numberOfLines={1}>
                      {agent.title}
                    </Text>
                    {agent.linkedTaskId ? (
                      <Link size={12} color={theme.colors.foregroundMuted} />
                    ) : null}
                  </Pressable>
                );
              })
            : null}
        </View>
      </ScrollView>
      {showFooter && <DevPlatformFooter {...footerState} />}
    </View>
  );
}

const styles = StyleSheet.create((t) => ({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: t.spacing[4],
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: t.spacing[8],
    paddingHorizontal: t.spacing[4],
    gap: t.spacing[3],
  },
  emptyTitle: {
    fontSize: t.fontSize.base,
    fontWeight: t.fontWeight.medium,
    color: t.colors.foregroundMuted,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing[2],
    paddingVertical: t.spacing[2],
    paddingHorizontal: t.spacing[4],
    borderRadius: t.borderRadius.md,
    backgroundColor: t.colors.surface2,
  },
  emptyButtonText: {
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.medium,
    color: t.colors.foreground,
  },
  menuSection: {
    paddingHorizontal: t.spacing[3],
    gap: t.spacing[1],
  },
  divider: {
    height: 1,
    backgroundColor: t.colors.border,
    marginVertical: t.spacing[2],
    marginHorizontal: t.spacing[3],
  },
  section: {
    paddingHorizontal: t.spacing[2],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing[2],
    paddingVertical: t.spacing[2],
    paddingHorizontal: t.spacing[2],
  },
  sectionLabel: {
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.medium,
    color: t.colors.foregroundMuted,
    flex: 1,
  },
  sectionCount: {
    fontSize: t.fontSize.sm,
    color: t.colors.foregroundMuted,
  },
  addAgentButton: {
    width: 20,
    height: 20,
    borderRadius: t.borderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  repoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing[2],
    minHeight: 32,
    paddingVertical: t.spacing[1],
    paddingHorizontal: t.spacing[2],
    borderRadius: t.borderRadius.lg,
    marginBottom: 1,
  },
  repoRowSelected: {
    backgroundColor: t.colors.surface2,
  },
  repoRowHover: {
    backgroundColor: t.colors.surfaceSidebarHover,
    opacity: 0.6,
  },
  repoRowPressed: {
    backgroundColor: t.colors.surface2,
  },
  repoName: {
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.medium,
    color: t.colors.foreground,
    flexShrink: 1,
    minWidth: 0,
  },
  branchLabel: {
    fontSize: t.fontSize.xs,
    color: t.colors.foregroundMuted,
    flexShrink: 1,
    minWidth: 0,
  },
  aheadBehindLabel: {
    fontSize: t.fontSize.xs,
    color: t.colors.foregroundMuted,
  },
  worktreeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing[1],
    minHeight: 28,
    paddingVertical: t.spacing[1],
    paddingLeft: t.spacing[6],
    paddingRight: t.spacing[2],
    borderRadius: t.borderRadius.lg,
    marginBottom: 1,
  },
  worktreeIndent: {
    width: t.spacing[2],
  },
  worktreeName: {
    fontSize: t.fontSize.xs,
    color: t.colors.foregroundMuted,
    flex: 1,
    minWidth: 0,
    fontStyle: "italic",
  },
  agentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing[2],
    minHeight: 32,
    paddingVertical: t.spacing[1],
    paddingHorizontal: t.spacing[2],
    borderRadius: t.borderRadius.lg,
    marginBottom: 1,
  },
  agentRowHover: {
    backgroundColor: t.colors.surfaceSidebarHover,
    opacity: 0.6,
  },
  agentRowPressed: {
    backgroundColor: t.colors.surface2,
  },
  agentName: {
    fontSize: t.fontSize.sm,
    color: t.colors.foregroundMuted,
    flex: 1,
    minWidth: 0,
  },
  footerContainer: {
    flex: 1,
  },
  sidebarFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: t.spacing[4],
    paddingVertical: t.spacing[3],
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  footerHostSlot: {
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
    marginRight: t.spacing[2],
  },
  footerIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing[2],
    flexShrink: 0,
  },
  footerIconButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: t.spacing[1],
    paddingHorizontal: t.spacing[1],
  },
  hostTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: t.spacing[2],
    minWidth: 0,
    paddingVertical: t.spacing[1],
    paddingHorizontal: t.spacing[2],
    borderRadius: t.borderRadius.lg,
  },
  hostTriggerHovered: {
    backgroundColor: t.colors.surfaceSidebarHover,
  },
  hostStatusDot: {
    width: 8,
    height: 8,
    borderRadius: t.borderRadius.full,
  },
  hostTriggerText: {
    fontSize: t.fontSize.sm,
    color: t.colors.foregroundMuted,
    flexShrink: 1,
    minWidth: 0,
  },
  tooltipText: {
    fontSize: t.fontSize.sm,
    color: t.colors.popoverForeground,
  },
  repoStatusDot: {
    position: "relative",
    width: 14,
    height: 20,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  statusDotOverlay: {
    position: "absolute",
    width: STATUS_DOT_SIZE,
    height: STATUS_DOT_SIZE,
    right: STATUS_DOT_OFFSET,
    bottom: STATUS_DOT_OFFSET,
    borderRadius: t.borderRadius.full,
    borderWidth: 1,
    borderColor: t.colors.surface0,
  },
}));
