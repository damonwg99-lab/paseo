import { ClipboardList } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";
import invariant from "tiny-invariant";
import { usePaneContext, usePaneFocus } from "@/panels/pane-context";
import type { PanelDescriptor, PanelRegistration } from "@/panels/panel-registry";
import { useDevPlatformStore } from "@/stores/dev-platform-store";
import type { DevPlatformTask } from "@getpaseo/protocol/dev-platform/types";

const FLEX_FILL_STYLE = { flex: 1 } as const;
const LOADING_STYLE = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
} as const;
const CONTENT_CONTAINER_STYLE = { padding: 16 } as const;
const TITLE_STYLE = { fontSize: 18, fontWeight: "600" } as const;
const SUBTITLE_STYLE = { fontSize: 12, marginTop: 4, opacity: 0.6 } as const;
const DESC_STYLE = { fontSize: 14, marginTop: 12 } as const;
const META_STYLE = { fontSize: 12, marginTop: 8, opacity: 0.5 } as const;

const TASK_TYPE_LABELS: Record<string, string> = {
  requirement: "Requirement",
  design: "Design",
  development: "Development",
  bug: "Bug",
  testing: "Testing",
  documentation: "Documentation",
  deployment: "Deployment",
};

function useTaskPanelDescriptor(
  target: { kind: "task"; taskId: string },
  _context: { serverId: string; workspaceId: string },
): PanelDescriptor {
  const tasksByProject = useDevPlatformStore((state) => state.tasksByProject);
  let task: DevPlatformTask | null = null;
  for (const tasks of Object.values(tasksByProject)) {
    const found = tasks.find((t) => t.id === target.taskId);
    if (found) {
      task = found;
      break;
    }
  }

  return {
    label: task?.title ?? "Task",
    subtitle: task ? (TASK_TYPE_LABELS[task.type] ?? "Task") : "Task",
    titleState: "ready",
    icon: ClipboardList,
    statusBucket: null,
  };
}

function TaskPanel() {
  const { target } = usePaneContext();
  const { isWorkspaceFocused } = usePaneFocus();
  invariant(target.kind === "task", "TaskPanel requires task target");

  const tasksByProject = useDevPlatformStore((state) => state.tasksByProject);

  let task: DevPlatformTask | null = null;
  let projectId: string | null = null;
  for (const [pid, tasks] of Object.entries(tasksByProject)) {
    const found = tasks.find((t) => t.id === target.taskId);
    if (found) {
      task = found;
      projectId = pid;
      break;
    }
  }

  if (!isWorkspaceFocused) {
    return <View style={FLEX_FILL_STYLE} />;
  }

  if (!task) {
    return (
      <View style={LOADING_STYLE}>
        <Text>Loading task...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={FLEX_FILL_STYLE} contentContainerStyle={CONTENT_CONTAINER_STYLE}>
      <Text style={TITLE_STYLE}>{task.title}</Text>
      <Text style={SUBTITLE_STYLE}>
        {TASK_TYPE_LABELS[task.type] ?? task.type} | {task.status} | {task.interactionMode}
      </Text>
      {task.description ? <Text style={DESC_STYLE}>{task.description}</Text> : null}
      <Text style={META_STYLE}>
        Task ID: {task.id} | Project: {projectId}
      </Text>
    </ScrollView>
  );
}

export const taskPanelRegistration: PanelRegistration<"task"> = {
  kind: "task",
  component: TaskPanel,
  useDescriptor: useTaskPanelDescriptor,
};
