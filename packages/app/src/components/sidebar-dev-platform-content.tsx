import { View, Text, Pressable, ScrollView } from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import {
  ListChecks,
  ClipboardList,
  FolderPlus,
  Bot,
  ChevronDown,
  ChevronRight,
  Plus,
  Link,
} from "lucide-react-native";
import { router, usePathname, type Href } from "expo-router";
import SidebarProjectSwitcher from "@/components/sidebar/sidebar-project-switcher";
import SidebarMenuItem from "@/components/sidebar/sidebar-menu-item";
import { useDevPlatformStore } from "@/stores/dev-platform-store";
import type { DevPlatformTask } from "@getpaseo/protocol/dev-platform/types";
import { useSessionStore } from "@/stores/session-store";
import { navigateToPreparedWorkspaceTab } from "@/utils/workspace-navigation";
import { navigateToAgent } from "@/utils/navigate-to-agent";
import { useActiveWorkspaceSelection } from "@/stores/navigation-active-workspace-store";
import { buildHostWorkspaceRoute } from "@/utils/host-routes";
import {
  useSidebarWorkspacesList,
  type SidebarWorkspaceEntry,
} from "@/hooks/use-sidebar-workspaces-list";
import { isWorkspaceSelected } from "@/components/sidebar-workspace-list";
import { useHostRuntimeClient, useHostRuntimeIsConnected } from "@/runtime/host-runtime";
import { useProjectIconQuery, projectIconToDataUri } from "@/hooks/use-project-icon-query";
import { ProjectIconView } from "@/components/project-icon-view";
import { projectIconPlaceholderLabelFromDisplayName } from "@/utils/project-display-name";

interface SidebarDevPlatformContentProps {
  serverId: string | null;
}

function extractDirectoryName(ws: SidebarWorkspaceEntry): string {
  const path = ws.workspaceDirectory ?? ws.projectRootPath ?? "";
  if (!path) return ws.name;
  const lastSegment =
    path
      .replace(/[/\\]+$/, "")
      .split(/[/\\]/)
      .pop() ?? "";
  if (!lastSegment) return ws.name;
  return lastSegment;
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
  const { title, taskId } = findLinkedTask(agentId, tasks);
  return {
    id: agentId,
    title: title ?? agentTitle ?? agentId,
    linkedTaskId: taskId,
  };
}

interface SidebarAgentEntry {
  id: string;
  title: string;
  linkedTaskId: string | null;
}

function SidebarDevPlatformContent({ serverId }: SidebarDevPlatformContentProps) {
  const { theme } = useUnistyles();
  const allProjects = useDevPlatformStore((s) => s.projects);
  const projects = useMemo(() => allProjects.filter((p) => !p.archivedAt), [allProjects]);
  const activeProjectId = useDevPlatformStore((s) => s.activeProjectId);
  const tasksByProject = useDevPlatformStore((s) => s.tasksByProject);
  const activeProject = projects.find((p) => p.id === activeProjectId);

  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false);
  const [agentCollapsed, setAgentCollapsed] = useState(false);

  const toggleWorkspaceCollapsed = useCallback(() => setWorkspaceCollapsed((prev) => !prev), []);
  const toggleAgentCollapsed = useCallback(() => setAgentCollapsed((prev) => !prev), []);

  const normalizedServerId = serverId?.trim() ?? "";
  const client = useHostRuntimeClient(normalizedServerId);
  const isConnected = useHostRuntimeIsConnected(normalizedServerId);

  const fetchProjects = useDevPlatformStore((s) => s.fetchProjects);
  const fetchTasks = useDevPlatformStore((s) => s.fetchTasks);

  // Fetch projects from server when connected, and tasks for active project
  useEffect(() => {
    if (!normalizedServerId || !isConnected) return;
    fetchProjects();
  }, [normalizedServerId, isConnected, fetchProjects]);

  useEffect(() => {
    if (!activeProjectId) return;
    fetchTasks(activeProjectId);
  }, [activeProjectId, fetchTasks]);

  const sidebarWorkspacesResult = useSidebarWorkspacesList({
    serverId: normalizedServerId,
    enabled: Boolean(normalizedServerId),
  });

  const activeWorkspaceSelection = useActiveWorkspaceSelection();

  // Project icon for workspace section header
  const projectIconQuery = useProjectIconQuery({
    serverId: normalizedServerId,
    cwd: activeProject?.rootDirectory ?? "",
  });
  const projectIconDataUri = projectIconToDataUri(projectIconQuery.icon);
  const projectPlaceholderInitial = activeProject
    ? projectIconPlaceholderLabelFromDisplayName(activeProject.name).charAt(0).toUpperCase()
    : "";

  // Track active panel kind from URL
  const pathname = usePathname();
  const activePanelKind = useMemo(() => {
    if (pathname.includes("/project_list")) return "project_list";
    if (pathname.includes("/kanban")) return "kanban";
    return null;
  }, [pathname]);

  // Filter Paseo workspaces to show only those under the active project
  const projectWorkspaceEntries = useMemo(() => {
    if (!activeProject) return [];
    const rootDir = activeProject.rootDirectory;
    const gitRepoUrls = new Set(activeProject.gitRepos.map((r) => r.url));
    const allSessions = useSessionStore.getState().sessions;
    const sess = normalizedServerId ? allSessions[normalizedServerId] : null;

    const matchingIds = new Set<string>();
    if (sess) {
      for (const ws of sess.workspaces.values()) {
        if (ws.projectRootPath === rootDir) {
          matchingIds.add(ws.id);
        }
        if (ws.projectRootPath && ws.projectRootPath.startsWith(rootDir + "/")) {
          matchingIds.add(ws.id);
        }
        const gitUrl = ws.gitRuntime?.remoteUrl;
        if (gitUrl && gitRepoUrls.has(gitUrl)) {
          matchingIds.add(ws.id);
        }
      }
    }

    const matched: SidebarWorkspaceEntry[] = [];
    for (const sidebarProject of sidebarWorkspacesResult.projects) {
      for (const ws of sidebarProject.workspaces) {
        if (matchingIds.has(ws.workspaceId)) {
          matched.push(ws);
        }
      }
    }

    const gitRepoUrlOrder = new Map<string, number>();
    for (let i = 0; i < activeProject.gitRepos.length; i++) {
      gitRepoUrlOrder.set(activeProject.gitRepos[i].url, i + 1);
    }

    matched.sort((a, b) => {
      const aIsRoot = a.projectRootPath === rootDir;
      const bIsRoot = b.projectRootPath === rootDir;
      if (aIsRoot && !bIsRoot) return -1;
      if (!aIsRoot && bIsRoot) return 1;
      if (aIsRoot && bIsRoot) return 0;

      const aOrder = a.gitRemoteUrl ? (gitRepoUrlOrder.get(a.gitRemoteUrl) ?? Infinity) : Infinity;
      const bOrder = b.gitRemoteUrl ? (gitRepoUrlOrder.get(b.gitRemoteUrl) ?? Infinity) : Infinity;
      return aOrder - bOrder;
    });

    return matched;
  }, [activeProject, normalizedServerId, sidebarWorkspacesResult.projects]);

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

  // Merge agentsMap (live) + agentDetails (historical) + projectTasks.agentIds (task-linked).
  // Priority: agentsMap > agentDetails > task-only. Dedup by agentId.
  // Only show agents with data in either store; skip unknown agentIds from tasks
  // (they'll be fetched by the agent panel when navigated to).
  const projectAgents = useMemo(() => {
    if (!activeProject) return [];
    const seen = new Set<string>();
    const result: SidebarAgentEntry[] = [];
    const rootDir = activeProject.rootDirectory;

    // 1. Live agents from agentsMap — track ALL ids for dedup, only include matching cwd
    if (agentsMap) {
      for (const agent of agentsMap.values()) {
        seen.add(agent.id);
        if (agent.cwd !== rootDir) continue;
        result.push(buildAgentEntry(agent.id, agent.title, projectTasks));
      }
    }

    // 2. Historical agents from agentDetails — same dedup strategy
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

  const getRootWorkspace = useCallback(() => {
    if (!normalizedServerId) return null;
    const s = useSessionStore.getState().sessions[normalizedServerId];
    if (!s) return null;
    if (activeProject) {
      for (const ws of s.workspaces.values()) {
        if (ws.projectRootPath === activeProject.rootDirectory) {
          return ws;
        }
      }
    }
    const allPaths = Array.from(s.workspaces.values())
      .map((ws) => ws.projectRootPath?.replace(/[/\\]+$/, ""))
      .filter(Boolean);
    for (const ws of s.workspaces.values()) {
      const path = ws.projectRootPath?.replace(/[/\\]+$/, "");
      if (!path) continue;
      const isSubdirectory = allPaths.some(
        (otherPath) =>
          otherPath !== path &&
          (path.startsWith(otherPath + "/") || path.startsWith(otherPath + "\\")),
      );
      if (!isSubdirectory) {
        return ws;
      }
    }
    return s.workspaces.values().next().value ?? null;
  }, [normalizedServerId, activeProject]);

  const handleNavigateToProjectList = useCallback(() => {
    const rootWorkspace = getRootWorkspace();
    if (!rootWorkspace || !normalizedServerId) return;
    navigateToPreparedWorkspaceTab({
      serverId: normalizedServerId,
      workspaceId: rootWorkspace.id,
      target: { kind: "project_list" },
    });
  }, [getRootWorkspace, normalizedServerId]);

  const handleNavigateToKanban = useCallback(() => {
    if (!activeProjectId || !normalizedServerId) return;
    const rootWorkspace = getRootWorkspace();
    if (!rootWorkspace) return;
    navigateToPreparedWorkspaceTab({
      serverId: normalizedServerId,
      workspaceId: rootWorkspace.id,
      target: { kind: "kanban", projectId: activeProjectId },
    });
  }, [activeProjectId, getRootWorkspace, normalizedServerId]);

  const handleWorkspacePress = useCallback(
    (workspaceId: string) => {
      if (!normalizedServerId) return;
      router.push(buildHostWorkspaceRoute(normalizedServerId, workspaceId) as Href);
    },
    [normalizedServerId],
  );

  const handleAgentPress = useCallback(
    (agentId: string) => {
      if (!normalizedServerId) return;
      // navigateToAgent handles both active and archived agents:
      // Active: resolves workspace, finds/focuses existing tab
      // Archived: falls back to agent detail route showing session history
      navigateToAgent({ serverId: normalizedServerId, agentId });
    },
    [normalizedServerId],
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
    const rootWorkspace = getRootWorkspace();
    if (rootWorkspace) {
      navigateToPreparedWorkspaceTab({
        serverId: normalizedServerId,
        workspaceId: rootWorkspace.id,
        target: { kind: "create_project" },
      });
    }
  }, [getRootWorkspace, normalizedServerId]);

  // Empty state: no projects
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
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <SidebarProjectSwitcher serverId={serverId} />

      <View style={styles.menuSection}>
        <SidebarMenuItem
          icon={ListChecks}
          label="项目列表"
          onPress={handleNavigateToProjectList}
          active={activePanelKind === "project_list"}
          testID="sidebar-project-list-menu"
        />
        <SidebarMenuItem
          icon={ClipboardList}
          label="任务列表"
          onPress={handleNavigateToKanban}
          active={activePanelKind === "kanban"}
          testID="sidebar-task-list-menu"
        />
      </View>

      <View style={styles.divider} />

      {/* Workspace section */}
      {projectWorkspaceEntries.length > 0 ? (
        <View style={styles.section}>
          {/* Project icon row */}
          <View style={styles.projectIconRow}>
            <ProjectIconView
              iconDataUri={projectIconDataUri}
              initial={projectPlaceholderInitial}
              projectKey={activeProject.id}
              imageStyle={styles.projectIcon}
              fallbackStyle={styles.projectIconFallback}
              textStyle={styles.projectIconFallbackText}
            />
            <Text style={styles.projectIconName} numberOfLines={1}>
              {activeProject.name}
            </Text>
            <Text style={styles.projectIconDir} numberOfLines={1}>
              {activeProject.rootDirectory}
            </Text>
          </View>
          <Pressable style={styles.sectionHeader} onPress={toggleWorkspaceCollapsed}>
            {workspaceCollapsed ? (
              <ChevronRight size={14} color={theme.colors.foregroundMuted} />
            ) : (
              <ChevronDown size={14} color={theme.colors.foregroundMuted} />
            )}
            <Text style={styles.sectionLabel}>工作区</Text>
            <Text style={styles.sectionCount}>{projectWorkspaceEntries.length}</Text>
          </Pressable>
          {!workspaceCollapsed
            ? projectWorkspaceEntries.map((ws) => {
                const dirName = extractDirectoryName(ws);
                const initial = dirName.charAt(0).toUpperCase();
                const isSelected = isWorkspaceSelected({
                  selection: activeWorkspaceSelection,
                  serverId: ws.serverId,
                  workspaceId: ws.workspaceId,
                  enabled: true,
                });
                return (
                  <Pressable
                    key={ws.workspaceId}
                    // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                    onPress={() => handleWorkspacePress(ws.workspaceId)}
                    // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                    style={({ pressed, hovered }) => [
                      styles.repoRow,
                      (isSelected || hovered) && styles.repoRowHover,
                      pressed && styles.repoRowPressed,
                    ]}
                  >
                    <ProjectIconView
                      iconDataUri={null}
                      initial={initial}
                      projectKey={ws.workspaceId}
                      imageStyle={styles.repoAvatarImage}
                      fallbackStyle={styles.repoAvatarFallback}
                      textStyle={styles.repoAvatarText}
                    />
                    <Text style={styles.repoName} numberOfLines={1}>
                      {dirName}
                    </Text>
                  </Pressable>
                );
              })
            : null}
        </View>
      ) : null}

      {/* Agent section */}
      <View style={styles.section}>
        <Pressable style={styles.sectionHeader} onPress={toggleAgentCollapsed}>
          {agentCollapsed ? (
            <ChevronRight size={14} color={theme.colors.foregroundMuted} />
          ) : (
            <ChevronDown size={14} color={theme.colors.foregroundMuted} />
          )}
          <Bot size={14} color={theme.colors.foregroundMuted} />
          <Text style={styles.sectionLabel}>Agent</Text>
          <Text style={styles.sectionCount}>{projectAgents.length}</Text>
          <Pressable onPress={handleCreateFreeAgent} style={styles.addAgentButton}>
            <Plus size={14} color={theme.colors.foregroundMuted} />
          </Pressable>
        </Pressable>
        {!agentCollapsed && projectAgents.length > 0
          ? projectAgents.map((agent) => {
              return (
                <Pressable
                  key={agent.id}
                  accessibilityRole="button"
                  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                  onPress={() => handleAgentPress(agent.id)}
                  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                  style={({ pressed, hovered }) => [
                    styles.agentRow,
                    hovered && styles.agentRowHover,
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
  );
}

export default SidebarDevPlatformContent;

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: theme.spacing[4],
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing[8],
    paddingHorizontal: theme.spacing[4],
    gap: theme.spacing[3],
  },
  emptyTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foregroundMuted,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[4],
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface2,
  },
  emptyButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  menuSection: {
    paddingHorizontal: theme.spacing[3],
    gap: theme.spacing[1],
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing[2],
    marginHorizontal: theme.spacing[3],
  },
  section: {
    paddingHorizontal: theme.spacing[2],
  },
  projectIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[2],
  },
  projectIcon: {
    width: "100%",
    height: "100%",
    borderRadius: theme.borderRadius.sm,
  },
  projectIconFallback: {
    width: theme.iconSize.md,
    height: theme.iconSize.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface2,
  },
  projectIconFallbackText: {
    fontSize: 9,
    color: theme.colors.foregroundMuted,
  },
  projectIconName: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    flexShrink: 0,
  },
  projectIconDir: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
    flex: 1,
    minWidth: 0,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[2],
  },
  sectionLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foregroundMuted,
    flex: 1,
  },
  sectionCount: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  addAgentButton: {
    width: 20,
    height: 20,
    borderRadius: theme.borderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  repoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    minHeight: 36,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[2],
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing[1],
  },
  repoRowHover: {
    backgroundColor: theme.colors.surfaceSidebarHover,
  },
  repoRowPressed: {
    backgroundColor: theme.colors.surface2,
  },
  repoAvatarFallback: {
    width: theme.iconSize.md,
    height: theme.iconSize.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  repoAvatarImage: {
    width: theme.iconSize.md,
    height: theme.iconSize.md,
    borderRadius: theme.borderRadius.sm,
  },
  repoAvatarText: {
    fontSize: 9,
    fontWeight: theme.fontWeight.medium,
  },
  repoName: {
    fontSize: theme.fontSize.sm,
    fontWeight: "400",
    color: theme.colors.foregroundMuted,
    flex: 1,
    minWidth: 0,
  },
  agentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    minHeight: 36,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[2],
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing[1],
  },
  agentRowHover: {
    backgroundColor: theme.colors.surfaceSidebarHover,
  },
  agentRowPressed: {
    backgroundColor: theme.colors.surface2,
  },
  agentName: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
    flex: 1,
    minWidth: 0,
  },
}));
