import { History } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";
import invariant from "tiny-invariant";
import { usePaneContext, usePaneFocus } from "@/panels/pane-context";
import type { PanelDescriptor, PanelRegistration } from "@/panels/panel-registry";
import { useDevPlatformStore } from "@/stores/dev-platform-store";
import { TASK_TYPE_LABELS, STATUS_LABELS } from "@/constants/dev-platform-icons";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import type { DevPlatformTask } from "@getpaseo/protocol/dev-platform/types";

const FLEX_FILL_STYLE = { flex: 1 } as const;

function findTaskById(taskId: string): DevPlatformTask | null {
  const tasksByProject = useDevPlatformStore.getState().tasksByProject;
  for (const tasks of Object.values(tasksByProject)) {
    const found = tasks.find((t) => t.id === taskId);
    if (found) return found;
  }
  return null;
}

function useTaskActivityPanelDescriptor(
  target: { kind: "task_activity"; taskId: string },
  _context: { serverId: string; workspaceId: string },
): PanelDescriptor {
  const task = findTaskById(target.taskId);
  return {
    label: task?.title ?? "Activity log",
    subtitle: "Task activity history",
    titleState: "ready",
    icon: History,
    statusBucket: null,
  };
}

function TaskActivityPanel() {
  const { target } = usePaneContext();
  const { isWorkspaceFocused } = usePaneFocus();
  invariant(target.kind === "task_activity", "TaskActivityPanel requires task_activity target");

  const _theme = useUnistyles();
  const tasksByProject = useDevPlatformStore((s) => s.tasksByProject);

  let task: DevPlatformTask | null = null;
  for (const tasks of Object.values(tasksByProject)) {
    const found = tasks.find((t) => t.id === target.taskId);
    if (found) {
      task = found;
      break;
    }
  }

  if (!isWorkspaceFocused) {
    return <View style={FLEX_FILL_STYLE} />;
  }

  if (!task) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>Task not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={FLEX_FILL_STYLE} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Activity log</Text>
      <Text style={styles.subtitle}>
        {task.title} &middot; {TASK_TYPE_LABELS[task.type]} &middot; {STATUS_LABELS[task.status]}
      </Text>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          Activity logging will be available in Phase 2. Task events (status changes, agent
          assignments, zentao syncs) will appear here.
        </Text>
      </View>
    </ScrollView>
  );
}

export const taskActivityPanelRegistration: PanelRegistration<"task_activity"> = {
  kind: "task_activity",
  component: TaskActivityPanel,
  useDescriptor: useTaskActivityPanelDescriptor,
};

const styles = StyleSheet.create((theme) => ({
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  emptyTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  content: {
    padding: theme.spacing[6],
    maxWidth: 640,
    alignSelf: "center",
    gap: theme.spacing[3],
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
  placeholder: {
    paddingVertical: theme.spacing[6],
    paddingHorizontal: theme.spacing[4],
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  placeholderText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
    textAlign: "center",
  },
}));
