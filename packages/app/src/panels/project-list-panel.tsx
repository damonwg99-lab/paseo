import { ListChecks, FolderPlus } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import invariant from "tiny-invariant";
import { useCallback, useEffect, useMemo } from "react";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { usePaneContext, usePaneFocus } from "@/panels/pane-context";
import type { PanelDescriptor, PanelRegistration } from "@/panels/panel-registry";
import { useDevPlatformStore } from "@/stores/dev-platform-store";
import { navigateToPreparedWorkspaceTab } from "@/utils/workspace-navigation";
import { useSessionStore } from "@/stores/session-store";

const FLEX_FILL_STYLE = { flex: 1 } as const;

function useProjectListPanelDescriptor(
  _target: { kind: "project_list" },
  _context: { serverId: string; workspaceId: string },
): PanelDescriptor {
  return {
    label: "项目列表",
    subtitle: "所有项目",
    titleState: "ready",
    icon: ListChecks,
    statusBucket: null,
  };
}

function ProjectListPanel() {
  const { target } = usePaneContext();
  const { isWorkspaceFocused } = usePaneFocus();
  invariant(target.kind === "project_list", "ProjectListPanel requires project_list target");

  const { theme } = useUnistyles();
  const allProjects = useDevPlatformStore((s) => s.projects);
  const projects = useMemo(() => allProjects.filter((p) => !p.archivedAt), [allProjects]);
  const tasksByProject = useDevPlatformStore((s) => s.tasksByProject);
  const setActiveProjectId = useDevPlatformStore((s) => s.setActiveProjectId);
  const archiveProject = useDevPlatformStore((s) => s.archiveProject);
  const fetchProjects = useDevPlatformStore((s) => s.fetchProjects);
  const fetchTasks = useDevPlatformStore((s) => s.fetchTasks);

  // Fetch projects on mount to restore data after page refresh
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    for (const project of projects) {
      if (!tasksByProject[project.id]) {
        fetchTasks(project.id);
      }
    }
  }, [projects, tasksByProject, fetchTasks]);
  const allSessions = useSessionStore((s) => s.sessions);
  const serverId = useMemo(() => {
    const ids = Object.keys(allSessions);
    return ids.length > 0 ? ids[0] : null;
  }, [allSessions]);

  const getFirstWorkspace = useCallback(() => {
    if (!serverId) return null;
    const sessions = useSessionStore.getState().sessions;
    const session = sessions[serverId];
    if (!session) return null;
    return session.workspaces.values().next().value ?? null;
  }, [serverId]);

  const handleSwitchProject = useCallback(
    (projectId: string) => {
      setActiveProjectId(projectId);
      const firstWorkspace = getFirstWorkspace();
      if (!firstWorkspace || !serverId) return;
      navigateToPreparedWorkspaceTab({
        serverId,
        workspaceId: firstWorkspace.id,
        target: { kind: "kanban", projectId },
      });
    },
    [setActiveProjectId, getFirstWorkspace, serverId],
  );

  const handleEditProject = useCallback(
    (projectId: string) => {
      const firstWorkspace = getFirstWorkspace();
      if (!firstWorkspace || !serverId) return;
      navigateToPreparedWorkspaceTab({
        serverId,
        workspaceId: firstWorkspace.id,
        target: { kind: "project_settings", projectId },
      });
    },
    [getFirstWorkspace, serverId],
  );

  const handleArchiveProject = useCallback(
    async (projectId: string) => {
      await archiveProject(projectId);
    },
    [archiveProject],
  );

  const handleCreateProject = useCallback(() => {
    const firstWorkspace = getFirstWorkspace();
    if (!firstWorkspace || !serverId) return;
    navigateToPreparedWorkspaceTab({
      serverId,
      workspaceId: firstWorkspace.id,
      target: { kind: "create_project" },
    });
  }, [getFirstWorkspace, serverId]);

  if (!isWorkspaceFocused) {
    return <View style={FLEX_FILL_STYLE} />;
  }

  if (projects.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>还没有项目</Text>
        <Pressable onPress={handleCreateProject} style={styles.createButton}>
          <Text style={styles.createButtonText}>新建项目</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={FLEX_FILL_STYLE} contentContainerStyle={styles.content}>
      <Text style={styles.title}>所有项目</Text>
      {projects.map((project) => {
        const taskCount = (tasksByProject[project.id] ?? []).filter((t) => !t.archivedAt).length;
        return (
          <View key={project.id} style={styles.card}>
            <Text style={styles.cardTitle}>{project.name}</Text>
            {project.description ? (
              <Text style={styles.cardDescription} numberOfLines={2}>
                {project.description}
              </Text>
            ) : null}
            <Text style={styles.cardRoot}>{project.rootDirectory}</Text>
            <View style={styles.cardStats}>
              <Text style={styles.cardStat}>{project.gitRepos.length} 个仓库</Text>
              <Text style={styles.cardStat}>{taskCount} 个任务</Text>
            </View>
            <View style={styles.cardActions}>
              <Pressable
                // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                onPress={() => handleSwitchProject(project.id)}
                style={styles.actionButton}
              >
                <Text style={styles.actionButtonText}>切换</Text>
              </Pressable>
              <Pressable
                // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                onPress={() => handleEditProject(project.id)}
                style={styles.actionButton}
              >
                <Text style={styles.actionButtonText}>编辑</Text>
              </Pressable>
              <Pressable
                // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                onPress={() => handleArchiveProject(project.id)}
                style={styles.actionButton}
              >
                <Text style={styles.actionButtonText}>归档</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      <Pressable onPress={handleCreateProject} style={styles.addButton}>
        <FolderPlus size={16} color={theme.colors.foreground} />
        <Text style={styles.addButtonText}>新建项目</Text>
      </Pressable>
    </ScrollView>
  );
}

export const projectListPanelRegistration: PanelRegistration<"project_list"> = {
  kind: "project_list",
  component: ProjectListPanel,
  useDescriptor: useProjectListPanelDescriptor,
};

const styles = StyleSheet.create((theme) => ({
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: theme.spacing[3],
  },
  emptyTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  createButton: {
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface2,
  },
  createButtonText: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  content: {
    padding: theme.spacing[6],
    maxWidth: 640,
    alignSelf: "center",
    gap: theme.spacing[4],
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing[4],
    gap: theme.spacing[2],
  },
  cardTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  cardDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  cardRoot: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
  },
  cardStats: {
    flexDirection: "row",
    gap: theme.spacing[3],
  },
  cardStat: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
  },
  cardActions: {
    flexDirection: "row",
    gap: theme.spacing[2],
  },
  actionButton: {
    paddingVertical: theme.spacing[1],
    paddingHorizontal: theme.spacing[3],
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface2,
  },
  actionButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface2,
  },
  addButtonText: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
}));
