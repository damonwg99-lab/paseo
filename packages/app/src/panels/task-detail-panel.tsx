import { ClipboardList } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";
import invariant from "tiny-invariant";
import { usePaneContext, usePaneFocus } from "@/panels/pane-context";
import type { PanelDescriptor, PanelRegistration } from "@/panels/panel-registry";
import { useDevPlatformStore } from "@/stores/dev-platform-store";
import {
  TASK_TYPE_ICONS,
  TASK_TYPE_LABELS,
  STATUS_LABELS,
  PRIORITY_LABELS,
  DEPLOYMENT_STATUS_LABELS,
  BUILD_STATUS_LABELS,
} from "@/constants/dev-platform-icons";
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

function useTaskDetailPanelDescriptor(
  target: { kind: "task_detail"; taskId: string },
  _context: { serverId: string; workspaceId: string },
): PanelDescriptor {
  const task = findTaskById(target.taskId);
  return {
    label: task?.title ?? "Task detail",
    subtitle: task ? (TASK_TYPE_LABELS[task.type] ?? "Task") : "Task",
    titleState: "ready",
    icon: ClipboardList,
    statusBucket: null,
  };
}

function BasicInfoSection({
  task,
  projectName,
  theme,
}: {
  task: DevPlatformTask;
  projectName: string;
  theme: ReturnType<typeof useUnistyles>["theme"];
}) {
  const TypeIcon = TASK_TYPE_ICONS[task.type] ?? ClipboardList;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Basic info</Text>
      <View style={styles.row}>
        <TypeIcon size={16} color={theme.colors.foregroundMuted} />
        <Text style={styles.rowLabel}>{TASK_TYPE_LABELS[task.type]}</Text>
        <Text style={styles.rowTitle}>{task.title}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Status:</Text>
        <Text style={styles.metaValue}>{STATUS_LABELS[task.status]}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Priority:</Text>
        <Text style={styles.metaValue}>{PRIORITY_LABELS[task.priority ?? "medium"]}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Interaction:</Text>
        <Text style={styles.metaValue}>{task.interactionMode}</Text>
      </View>
      {task.description ? (
        <View style={styles.descriptionBlock}>
          <Text style={styles.descriptionText}>{task.description}</Text>
        </View>
      ) : null}
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Project:</Text>
        <Text style={styles.metaValue}>{projectName ?? task.projectId}</Text>
      </View>
    </View>
  );
}

function RelationsSection({ task }: { task: DevPlatformTask }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Relations</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Agents:</Text>
        <Text style={styles.metaValue}>
          {task.agentIds.length > 0 ? task.agentIds.join(", ") : "None"}
        </Text>
      </View>
      {task.parentTaskId ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Parent task:</Text>
          <Text style={styles.metaValue}>{task.parentTaskId}</Text>
        </View>
      ) : null}
      {task.dependsOn.length > 0 ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Depends on:</Text>
          <Text style={styles.metaValue}>{task.dependsOn.join(", ")}</Text>
        </View>
      ) : null}
      {task.involvedRepos.length > 0 ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Involved repos:</Text>
          <Text style={styles.metaValue}>{task.involvedRepos.join(", ")}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ZentaoDeploymentSection({ task }: { task: DevPlatformTask }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Zentao & Deployment</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Zentao sync:</Text>
        <Text style={styles.metaValue}>{task.syncToZentao ? "Yes" : "No"}</Text>
      </View>
      {task.zentaoId ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Zentao ID:</Text>
          <Text style={styles.metaValue}>{task.zentaoId}</Text>
        </View>
      ) : null}
      {task.branchName ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Branch:</Text>
          <Text style={styles.metaValue}>{task.branchName}</Text>
        </View>
      ) : null}
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Deployment:</Text>
        <Text style={styles.metaValue}>
          {DEPLOYMENT_STATUS_LABELS[task.deploymentStatus ?? "not_deployed"] ??
            task.deploymentStatus}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Build:</Text>
        <Text style={styles.metaValue}>
          {BUILD_STATUS_LABELS[task.buildStatus ?? "not_built"] ?? task.buildStatus}
        </Text>
      </View>
    </View>
  );
}

function TimestampsSection({ task }: { task: DevPlatformTask }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Timestamps</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Created:</Text>
        <Text style={styles.metaValue}>{task.createdAt}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Updated:</Text>
        <Text style={styles.metaValue}>{task.updatedAt}</Text>
      </View>
    </View>
  );
}

function TaskDetailPanel() {
  const { target } = usePaneContext();
  const { isWorkspaceFocused } = usePaneFocus();
  invariant(target.kind === "task_detail", "TaskDetailPanel requires task_detail target");

  const { theme } = useUnistyles();
  const tasksByProject = useDevPlatformStore((s) => s.tasksByProject);
  const projects = useDevPlatformStore((s) => s.projects);

  let task: DevPlatformTask | null = null;
  let projectName = "";
  for (const [pid, tasks] of Object.entries(tasksByProject)) {
    const found = tasks.find((t) => t.id === target.taskId);
    if (found) {
      task = found;
      projectName = projects.find((p) => p.id === pid)?.name ?? pid;
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
      <BasicInfoSection task={task} projectName={projectName} theme={theme} />
      <RelationsSection task={task} />
      <ZentaoDeploymentSection task={task} />
      <TimestampsSection task={task} />
    </ScrollView>
  );
}

export const taskDetailPanelRegistration: PanelRegistration<"task_detail"> = {
  kind: "task_detail",
  component: TaskDetailPanel,
  useDescriptor: useTaskDetailPanelDescriptor,
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
    gap: theme.spacing[4],
  },
  section: {
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[2],
  },
  sectionTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    paddingBottom: theme.spacing[1],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  rowLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  rowTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    gap: theme.spacing[2],
  },
  metaLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
    fontWeight: theme.fontWeight.medium,
  },
  metaValue: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
  descriptionBlock: {
    paddingVertical: theme.spacing[2],
  },
  descriptionText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
    lineHeight: 20,
  },
}));
