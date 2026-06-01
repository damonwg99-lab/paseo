import { Plus } from "lucide-react-native";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import invariant from "tiny-invariant";
import { useCallback, useState } from "react";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { usePaneContext, usePaneFocus } from "@/panels/pane-context";
import type { PanelDescriptor, PanelRegistration } from "@/panels/panel-registry";
import { useDevPlatformStore } from "@/stores/dev-platform-store";
import { TASK_TYPE_ICONS, TASK_TYPE_LABELS, PRIORITY_LABELS } from "@/constants/dev-platform-icons";
import type {
  DevPlatformTaskType,
  DevPlatformTaskPriority,
  DevPlatformInteractionMode,
} from "@getpaseo/protocol/dev-platform/types";

const FLEX_FILL_STYLE = { flex: 1 } as const;

const INTERACTION_MODE_LABELS: Record<DevPlatformInteractionMode, string> = {
  step_by_step: "Step by step",
  auto: "Autonomous",
};

function useCreateTaskPanelDescriptor(
  target: { kind: "create_task"; projectId: string },
  _context: { serverId: string; workspaceId: string },
): PanelDescriptor {
  const projects = useDevPlatformStore((s) => s.projects);
  const project = projects.find((p) => p.id === target.projectId);
  return {
    label: project?.name ?? "New task",
    subtitle: "Create a task",
    titleState: "ready",
    icon: Plus,
    statusBucket: null,
  };
}

function CreateTaskPanel() {
  const { target } = usePaneContext();
  const { isWorkspaceFocused } = usePaneFocus();
  invariant(target.kind === "create_task", "CreateTaskPanel requires create_task target");

  const { theme } = useUnistyles();
  const createTask = useDevPlatformStore((s) => s.createTask);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState<DevPlatformTaskType>("development");
  const [priority, setPriority] = useState<DevPlatformTaskPriority>("medium");
  const [interactionMode, setInteractionMode] =
    useState<DevPlatformInteractionMode>("step_by_step");
  const [syncToZentao, setSyncToZentao] = useState(false);

  const handleCreate = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    await createTask({
      projectId: target.projectId,
      taskType,
      title: trimmedTitle,
      description: description.trim() || undefined,
      priority,
      interactionMode,
      syncToZentao,
    });
  }, [
    title,
    description,
    taskType,
    priority,
    interactionMode,
    syncToZentao,
    target.projectId,
    createTask,
  ]);

  if (!isWorkspaceFocused) {
    return <View style={FLEX_FILL_STYLE} />;
  }

  return (
    <ScrollView style={FLEX_FILL_STYLE} contentContainerStyle={styles.content}>
      <Text style={styles.title}>New task</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Task title"
          placeholderTextColor={theme.colors.foregroundMuted}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput
          // oxlint-disable-next-line react-perf/jsx-no-new-array-as-prop
          style={[styles.input, styles.multilineInput]}
          value={description}
          onChangeText={setDescription}
          placeholder="Task description"
          placeholderTextColor={theme.colors.foregroundMuted}
          multiline
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Type</Text>
        <View style={styles.typeRow}>
          {(Object.keys(TASK_TYPE_ICONS) as DevPlatformTaskType[]).map((type) => {
            const TypeIcon = TASK_TYPE_ICONS[type];
            const isSelected = taskType === type;
            return (
              <Pressable
                key={type}
                // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                onPress={() => setTaskType(type)}
                // oxlint-disable-next-line react-perf/jsx-no-new-array-as-prop
                style={[styles.typeButton, isSelected && styles.typeButtonSelected]}
              >
                <TypeIcon
                  size={14}
                  color={isSelected ? theme.colors.foreground : theme.colors.foregroundMuted}
                />
                <Text
                  // oxlint-disable-next-line react-perf/jsx-no-new-array-as-prop
                  style={[styles.typeButtonText, isSelected && styles.typeButtonTextSelected]}
                >
                  {TASK_TYPE_LABELS[type]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Priority</Text>
        <View style={styles.typeRow}>
          {(Object.keys(PRIORITY_LABELS) as DevPlatformTaskPriority[]).map((p) => {
            const isSelected = priority === p;
            return (
              <Pressable
                key={p}
                // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                onPress={() => setPriority(p)}
                // oxlint-disable-next-line react-perf/jsx-no-new-array-as-prop
                style={[styles.typeButton, isSelected && styles.typeButtonSelected]}
              >
                <Text
                  // oxlint-disable-next-line react-perf/jsx-no-new-array-as-prop
                  style={[styles.typeButtonText, isSelected && styles.typeButtonTextSelected]}
                >
                  {PRIORITY_LABELS[p]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Interaction mode</Text>
        <View style={styles.typeRow}>
          {(Object.keys(INTERACTION_MODE_LABELS) as DevPlatformInteractionMode[]).map((mode) => {
            const isSelected = interactionMode === mode;
            return (
              <Pressable
                key={mode}
                // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                onPress={() => setInteractionMode(mode)}
                // oxlint-disable-next-line react-perf/jsx-no-new-array-as-prop
                style={[styles.typeButton, isSelected && styles.typeButtonSelected]}
              >
                <Text
                  // oxlint-disable-next-line react-perf/jsx-no-new-array-as-prop
                  style={[styles.typeButtonText, isSelected && styles.typeButtonTextSelected]}
                >
                  {INTERACTION_MODE_LABELS[mode]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Sync to Zentao</Text>
        {/* oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop */}
        <Pressable onPress={() => setSyncToZentao(!syncToZentao)} style={styles.toggleRow}>
          {/* oxlint-disable-next-line react-perf/jsx-no-new-array-as-prop */}
          <View style={[styles.toggleBox, syncToZentao && styles.toggleBoxActive]} />
          <Text style={styles.toggleLabel}>{syncToZentao ? "Yes" : "No"}</Text>
        </Pressable>
      </View>

      <Pressable onPress={handleCreate} style={styles.createButton}>
        <Text style={styles.createButtonText}>Create task</Text>
      </Pressable>
    </ScrollView>
  );
}

export const createTaskPanelRegistration: PanelRegistration<"create_task"> = {
  kind: "create_task",
  component: CreateTaskPanel,
  useDescriptor: useCreateTaskPanelDescriptor,
};

const styles = StyleSheet.create((theme) => ({
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
  fieldGroup: {
    gap: theme.spacing[2],
  },
  fieldLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foregroundMuted,
  },
  input: {
    fontSize: theme.fontSize.base,
    color: theme.colors.foreground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
  },
  multilineInput: {
    minHeight: 80,
  },
  typeRow: {
    flexDirection: "row",
    gap: theme.spacing[2],
    flexWrap: "wrap",
  },
  typeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[1],
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  typeButtonSelected: {
    backgroundColor: theme.colors.surface2,
    borderColor: theme.colors.foregroundMuted,
  },
  typeButtonText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
  },
  typeButtonTextSelected: {
    color: theme.colors.foreground,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  toggleBox: {
    width: 20,
    height: 20,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  toggleBoxActive: {
    backgroundColor: theme.colors.palette.blue[500],
    borderColor: theme.colors.palette.blue[500],
  },
  toggleLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  createButton: {
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface2,
    alignItems: "center",
  },
  createButtonText: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
}));
