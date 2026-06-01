import { Archive } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import invariant from "tiny-invariant";
import { useCallback } from "react";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { usePaneContext, usePaneFocus } from "@/panels/pane-context";
import type { PanelDescriptor, PanelRegistration } from "@/panels/panel-registry";
import { useDevPlatformStore } from "@/stores/dev-platform-store";
import { navigateToPreparedWorkspaceTab } from "@/utils/workspace-navigation";
import { useSessionStore } from "@/stores/session-store";
import { TASK_TYPE_ICONS, TASK_TYPE_SHORT_LABELS } from "@/constants/dev-platform-icons";
import type { DevPlatformTask } from "@getpaseo/protocol/dev-platform/types";

const FLEX_FILL_STYLE = { flex: 1 } as const;

function useArchivedTasksPanelDescriptor(
  target: { kind: "archived_tasks"; projectId: string },
  _context: { serverId: string; workspaceId: string },
): PanelDescriptor {
  const projects = useDevPlatformStore((s) => s.projects);
  const project = projects.find((p) => p.id === target.projectId);
  return {
    label: project?.name ?? "Archived tasks",
    subtitle: "Archived task history",
    titleState: "ready",
    icon: Archive,
    statusBucket: null,
  };
}

function ArchivedTasksPanel() {
  const { target } = usePaneContext();
  const { isWorkspaceFocused } = usePaneFocus();
  invariant(target.kind === "archived_tasks", "ArchivedTasksPanel requires archived_tasks target");

  const { theme } = useUnistyles();
  const projects = useDevPlatformStore((s) => s.projects);
  const tasksByProject = useDevPlatformStore((s) => s.tasksByProject);
  const project = projects.find((p) => p.id === target.projectId);
  const archivedTasks = (tasksByProject[target.projectId] ?? []).filter(
    (t) => t.status === "archived",
  );

  const handleTaskPress = useCallback((task: DevPlatformTask) => {
    const sessions = useSessionStore.getState().sessions;
    const serverIds = Object.keys(sessions);
    const serverId = serverIds.length > 0 ? serverIds[0] : null;
    if (!serverId) return;
    const session = sessions[serverId];
    if (!session) return;
    const firstWorkspace = session.workspaces.values().next().value;
    if (!firstWorkspace) return;
    navigateToPreparedWorkspaceTab({
      serverId,
      workspaceId: firstWorkspace.id,
      target: { kind: "task_detail", taskId: task.id },
    });
  }, []);

  if (!isWorkspaceFocused) {
    return <View style={FLEX_FILL_STYLE} />;
  }

  if (!project) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>Project not found</Text>
      </View>
    );
  }

  if (archivedTasks.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No archived tasks</Text>
        <Text style={styles.emptySubtitle}>Tasks you archive will appear here</Text>
      </View>
    );
  }

  return (
    <ScrollView style={FLEX_FILL_STYLE} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Archived tasks</Text>
      <Text style={styles.subtitle}>{project.name}</Text>
      {archivedTasks.map((task) => {
        const TypeIcon = TASK_TYPE_ICONS[task.type] ?? Archive;
        return (
          <Pressable
            key={task.id}
            // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
            onPress={() => handleTaskPress(task)}
            style={styles.taskRow}
          >
            <TypeIcon size={14} color={theme.colors.foregroundMuted} />
            <Text style={styles.taskTitle} numberOfLines={1}>
              {task.title}
            </Text>
            <Text style={styles.taskType}>{TASK_TYPE_SHORT_LABELS[task.type]}</Text>
            <Text style={styles.taskDate}>{task.archivedAt ?? task.updatedAt}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export const archivedTasksPanelRegistration: PanelRegistration<"archived_tasks"> = {
  kind: "archived_tasks",
  component: ArchivedTasksPanel,
  useDescriptor: useArchivedTasksPanelDescriptor,
};

const styles = StyleSheet.create((theme) => ({
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: theme.spacing[2],
  },
  emptyTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  emptySubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  content: {
    padding: theme.spacing[6],
    maxWidth: 640,
    alignSelf: "center",
    gap: theme.spacing[2],
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  taskTitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
    flex: 1,
    minWidth: 0,
  },
  taskType: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
  },
  taskDate: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
  },
}));
