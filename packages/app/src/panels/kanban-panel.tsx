import { ListChecks, Plus, Archive, Settings, GitBranch, ClipboardList } from "lucide-react-native";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type PressableStateCallbackType,
} from "react-native";
import invariant from "tiny-invariant";
import { useCallback, useMemo, useState, useRef } from "react";
import { usePaneContext, usePaneFocus } from "@/panels/pane-context";
import type { PanelDescriptor, PanelRegistration } from "@/panels/panel-registry";
import { useDevPlatformStore } from "@/stores/dev-platform-store";
import { navigateToPreparedWorkspaceTab } from "@/utils/workspace-navigation";
import { useSessionStore } from "@/stores/session-store";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import type {
  DevPlatformTask,
  DevPlatformTaskType,
  DevPlatformTaskStatus,
} from "@getpaseo/protocol/dev-platform/types";
import {
  TASK_TYPE_ICONS,
  TASK_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_COLUMNS,
  TYPE_GROUPS,
  DEPLOYMENT_STATUS_LABELS,
} from "@/constants/dev-platform-icons";

const FLEX_FILL_STYLE = { flex: 1 } as const;
const VIEW_MODE_BAR_STYLE = {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderBottomWidth: 1,
} as const;

type ViewMode = "status" | "type";

function useKanbanPanelDescriptor(
  target: { kind: "kanban"; projectId: string },
  _context: { serverId: string; workspaceId: string },
): PanelDescriptor {
  const projects = useDevPlatformStore((s) => s.projects);
  const project = projects.find((p) => p.id === target.projectId);
  return {
    label: project?.name ?? "Kanban",
    subtitle: "Project tasks",
    titleState: "ready",
    icon: ListChecks,
    statusBucket: null,
  };
}

function KanbanPanel() {
  const { target } = usePaneContext();
  const { isWorkspaceFocused } = usePaneFocus();
  invariant(target.kind === "kanban", "KanbanPanel requires kanban target");

  const { theme } = useUnistyles();
  const projects = useDevPlatformStore((s) => s.projects);
  const tasksByProject = useDevPlatformStore((s) => s.tasksByProject);
  const project = projects.find((p) => p.id === target.projectId);
  const activeTasks = useMemo(
    () => (tasksByProject[target.projectId] ?? []).filter((t) => t.status !== "archived"),
    [tasksByProject, target.projectId],
  );

  const [viewMode, setViewMode] = useState<ViewMode>("status");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskType, setNewTaskType] = useState<DevPlatformTaskType>("development");
  const createTask = useDevPlatformStore((s) => s.createTask);
  const taskInputRef = useRef<TextInput>(null);

  const handleSetViewModeStatus = useCallback(() => setViewMode("status"), []);
  const handleSetViewModeType = useCallback(() => setViewMode("type"), []);

  const viewModeBarStyle = useMemo(
    () => [VIEW_MODE_BAR_STYLE, { borderBottomColor: theme.colors.border }],
    [theme.colors.border],
  );

  const handleStartCreateTask = useCallback(() => {
    setIsCreatingTask(true);
    setNewTaskTitle("");
    setNewTaskType("development");
    setTimeout(() => taskInputRef.current?.focus(), 100);
  }, []);

  const handleCancelCreateTask = useCallback(() => {
    setIsCreatingTask(false);
    setNewTaskTitle("");
  }, []);

  const handleConfirmCreateTask = useCallback(async () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    await createTask({
      projectId: target.projectId,
      taskType: newTaskType,
      title,
    });
    setIsCreatingTask(false);
    setNewTaskTitle("");
  }, [newTaskTitle, newTaskType, target.projectId, createTask]);

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

  const handleOpenBranches = useCallback(() => {
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
      target: { kind: "branches", projectId: target.projectId },
    });
  }, [target.projectId]);

  const handleOpenArchivedTasks = useCallback(() => {
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
      target: { kind: "archived_tasks", projectId: target.projectId },
    });
  }, [target.projectId]);

  const handleOpenProjectSettings = useCallback(() => {
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
      target: { kind: "project_settings", projectId: target.projectId },
    });
  }, [target.projectId]);

  const archiveTask = useDevPlatformStore((s) => s.archiveTask);

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

  return (
    <View style={FLEX_FILL_STYLE}>
      <View style={viewModeBarStyle}>
        <Text style={styles.projectTitle}>{project.name}</Text>
        <Pressable
          onPress={handleStartCreateTask}
          style={styles.addTaskButton}
          accessibilityRole="button"
          accessibilityLabel="Add task"
        >
          <Plus size={16} color={theme.colors.foregroundMuted} />
        </Pressable>
        <Pressable onPress={handleOpenArchivedTasks} style={styles.navButton}>
          <Archive size={14} color={theme.colors.foregroundMuted} />
        </Pressable>
        <Pressable onPress={handleOpenProjectSettings} style={styles.navButton}>
          <Settings size={14} color={theme.colors.foregroundMuted} />
        </Pressable>
        <Pressable onPress={handleOpenBranches} style={styles.navButton}>
          <GitBranch size={14} color={theme.colors.foregroundMuted} />
        </Pressable>
        <View style={styles.viewModeSwitch}>
          <ViewModeButton
            label="Status"
            active={viewMode === "status"}
            theme={theme}
            onPress={handleSetViewModeStatus}
          />
          <ViewModeButton
            label="Type"
            active={viewMode === "type"}
            theme={theme}
            onPress={handleSetViewModeType}
          />
        </View>
      </View>

      <ScrollView style={FLEX_FILL_STYLE} contentContainerStyle={styles.kanbanContent}>
        {isCreatingTask ? (
          <View style={styles.createTaskForm}>
            <TextInput
              ref={taskInputRef}
              style={styles.createTaskInput}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              placeholder="Task title"
              placeholderTextColor={theme.colors.foregroundMuted}
              autoFocus
              onSubmitEditing={handleConfirmCreateTask}
              returnKeyType="done"
            />
            <View style={styles.createTaskTypeRow}>
              {(Object.keys(TASK_TYPE_ICONS) as DevPlatformTaskType[]).map((type) => (
                <CreateTaskTypeButton
                  key={type}
                  type={type}
                  isSelected={newTaskType === type}
                  onSelect={setNewTaskType}
                  theme={theme}
                />
              ))}
            </View>
            <View style={styles.createTaskActions}>
              <Pressable onPress={handleCancelCreateTask} style={styles.createProjectCancel}>
                <Text style={styles.createProjectCancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleConfirmCreateTask} style={styles.createProjectConfirm}>
                <Text style={styles.createProjectConfirmText}>Create</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {viewMode === "status" ? (
          <StatusView
            tasks={activeTasks}
            theme={theme}
            onTaskPress={handleTaskPress}
            onArchive={archiveTask}
          />
        ) : (
          <TypeView
            tasks={activeTasks}
            theme={theme}
            onTaskPress={handleTaskPress}
            onArchive={archiveTask}
          />
        )}
      </ScrollView>
    </View>
  );
}

function ViewModeButton({
  label,
  active,
  theme,
  onPress,
}: {
  label: string;
  active: boolean;
  theme: ReturnType<typeof useUnistyles>["theme"];
  onPress: () => void;
}) {
  const style = useCallback(
    ({ hovered }: PressableStateCallbackType & { hovered?: boolean }) => [
      styles.viewModeButton,
      active && styles.viewModeButtonActive,
      hovered && !active && styles.viewModeButtonHovered,
    ],
    [active],
  );
  const textStyle = useMemo(
    () => [styles.viewModeButtonText, active && { color: theme.colors.foreground }],
    [active, theme.colors.foreground],
  );
  return (
    <Pressable
      style={style}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}

function CreateTaskTypeButton({
  type,
  isSelected,
  onSelect,
  theme,
}: {
  type: DevPlatformTaskType;
  isSelected: boolean;
  onSelect: (type: DevPlatformTaskType) => void;
  theme: ReturnType<typeof useUnistyles>["theme"];
}) {
  const TypeIcon = TASK_TYPE_ICONS[type];
  const handlePress = useCallback(() => onSelect(type), [onSelect, type]);
  const buttonStyle = useMemo(
    () => [styles.createTaskTypeButton, isSelected && styles.createTaskTypeButtonSelected],
    [isSelected],
  );
  const textColor = isSelected ? theme.colors.foreground : theme.colors.foregroundMuted;
  const textStyle = useMemo(
    () => [styles.createTaskTypeText, isSelected && styles.createTaskTypeTextSelected],
    [isSelected],
  );
  return (
    <Pressable
      onPress={handlePress}
      style={buttonStyle}
      accessibilityRole="button"
      accessibilityLabel={TASK_TYPE_LABELS[type]}
    >
      <TypeIcon size={14} color={textColor} />
      <Text style={textStyle}>{TASK_TYPE_LABELS[type]}</Text>
    </Pressable>
  );
}

function StatusView({
  tasks,
  theme,
  onTaskPress,
  onArchive,
}: {
  tasks: DevPlatformTask[];
  theme: ReturnType<typeof useUnistyles>["theme"];
  onTaskPress: (task: DevPlatformTask) => void;
  onArchive: (taskId: string) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<DevPlatformTaskStatus, DevPlatformTask[]>();
    for (const status of STATUS_COLUMNS) {
      map.set(status, []);
    }
    for (const task of tasks) {
      const list = map.get(task.status);
      if (list) list.push(task);
      else {
        const blockedList = map.get("blocked");
        if (blockedList) blockedList.push(task);
      }
    }
    return map;
  }, [tasks]);

  const columnHeaderStyle = useMemo(
    () => [styles.columnHeader, { borderBottomColor: theme.colors.border }],
    [theme.colors.border],
  );

  return (
    <View style={styles.columnsContainer}>
      {STATUS_COLUMNS.map((status) => (
        <View key={status} style={styles.column}>
          <View style={columnHeaderStyle}>
            <StatusDot status={status} theme={theme} />
            <Text style={styles.columnTitle}>{STATUS_LABELS[status]}</Text>
            <Text style={styles.columnCount}>{grouped.get(status)?.length ?? 0}</Text>
          </View>
          <ScrollView style={styles.columnScroll} contentContainerStyle={styles.columnContent}>
            {(grouped.get(status) ?? []).map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                theme={theme}
                onTaskPress={onTaskPress}
                onArchive={onArchive}
              />
            ))}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

function TypeView({
  tasks,
  theme,
  onTaskPress,
  onArchive,
}: {
  tasks: DevPlatformTask[];
  theme: ReturnType<typeof useUnistyles>["theme"];
  onTaskPress: (task: DevPlatformTask) => void;
  onArchive: (taskId: string) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<DevPlatformTaskType, DevPlatformTask[]>();
    for (const type of TYPE_GROUPS) {
      map.set(type, []);
    }
    for (const task of tasks) {
      const list = map.get(task.type);
      if (list) list.push(task);
    }
    return map;
  }, [tasks]);

  const typeGroupHeaderStyle = useMemo(
    () => [styles.typeGroupHeader, { borderBottomColor: theme.colors.border }],
    [theme.colors.border],
  );

  return (
    <ScrollView style={FLEX_FILL_STYLE} contentContainerStyle={styles.typeViewContent}>
      {TYPE_GROUPS.map((type) => {
        const typeTasks = grouped.get(type) ?? [];
        if (typeTasks.length === 0) return null;
        const TypeIcon = TASK_TYPE_ICONS[type];
        return (
          <View key={type} style={styles.typeGroup}>
            <View style={typeGroupHeaderStyle}>
              <TypeIcon size={16} color={theme.colors.foregroundMuted} />
              <Text style={styles.typeGroupTitle}>{TASK_TYPE_LABELS[type]}</Text>
              <Text style={styles.columnCount}>{typeTasks.length}</Text>
            </View>
            <View style={styles.typeCards}>
              {typeTasks.map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  theme={theme}
                  onTaskPress={onTaskPress}
                  onArchive={onArchive}
                />
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function StatusDot({
  status,
  theme,
}: {
  status: DevPlatformTaskStatus;
  theme: ReturnType<typeof useUnistyles>["theme"];
}) {
  let color: string;
  switch (status) {
    case "todo":
      color = theme.colors.foregroundMuted;
      break;
    case "in_progress":
      color = theme.colors.palette.blue[500];
      break;
    case "review":
      color = theme.colors.palette.amber[500];
      break;
    case "done":
      color = theme.colors.palette.green[500];
      break;
    case "blocked":
    case "merge_conflict":
      color = theme.colors.palette.red[500];
      break;
    default:
      color = theme.colors.foregroundMuted;
  }
  const dotStyle = useMemo(() => [styles.statusDot, { backgroundColor: color }], [color]);
  return <View style={dotStyle} />;
}

function KanbanCard({
  task,
  theme,
  onTaskPress,
  onArchive,
}: {
  task: DevPlatformTask;
  theme: ReturnType<typeof useUnistyles>["theme"];
  onTaskPress: (task: DevPlatformTask) => void;
  onArchive: (taskId: string) => void;
}) {
  const TypeIcon = TASK_TYPE_ICONS[task.type] ?? ClipboardList;
  const cardStyle = useCallback(
    ({ hovered, pressed }: PressableStateCallbackType & { hovered?: boolean }) => [
      styles.card,
      hovered && styles.cardHovered,
      pressed && styles.cardPressed,
    ],
    [],
  );
  const handlePress = useCallback(() => onTaskPress(task), [onTaskPress, task]);
  const handleArchive = useCallback(() => onArchive(task.id), [onArchive, task.id]);
  const deploymentBadge =
    task.deploymentStatus && task.deploymentStatus !== "not_deployed"
      ? (DEPLOYMENT_STATUS_LABELS[task.deploymentStatus] ?? task.deploymentStatus)
      : null;
  return (
    <Pressable
      style={cardStyle}
      onPress={handlePress}
      testID={`kanban-card-${task.id}`}
      accessibilityRole="button"
      accessibilityLabel={task.title}
    >
      {({ hovered }) => (
        <>
          <View style={styles.cardTop}>
            <TypeIcon size={14} color={theme.colors.foregroundMuted} />
            <Text style={styles.cardTitle} numberOfLines={1}>
              {task.title}
            </Text>
          </View>
          <View style={styles.cardBottom}>
            <StatusDot status={task.status} theme={theme} />
            <Text style={styles.cardStatus}>{STATUS_LABELS[task.status]}</Text>
            {task.agentIds.length > 0 ? (
              <Text style={styles.cardAgentCount}>Agent {task.agentIds.length}</Text>
            ) : null}
            {deploymentBadge ? <Text style={styles.cardDeployMark}>{deploymentBadge}</Text> : null}
            {task.syncToZentao ? <Text style={styles.cardZentaoMark}>Z</Text> : null}
          </View>
          {hovered ? (
            <View style={styles.cardActions}>
              <Pressable onPress={handleArchive} style={styles.cardActionButton}>
                <Archive size={12} color={theme.colors.foregroundMuted} />
                <Text style={styles.cardActionText}>Archive</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

export const kanbanPanelRegistration: PanelRegistration<"kanban"> = {
  kind: "kanban",
  component: KanbanPanel,
  useDescriptor: useKanbanPanelDescriptor,
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
  projectTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    flex: 1,
  },
  viewModeSwitch: {
    flexDirection: "row",
    gap: theme.spacing[1],
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 2,
  },
  viewModeButton: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.borderRadius.md,
  },
  viewModeButtonActive: {
    backgroundColor: theme.colors.surface2,
  },
  viewModeButtonHovered: {
    backgroundColor: theme.colors.surfaceSidebarHover,
  },
  viewModeButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  kanbanContent: {
    padding: theme.spacing[4],
  },
  columnsContainer: {
    flexDirection: "row",
    gap: theme.spacing[4],
    minHeight: 0,
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
  columnHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingBottom: theme.spacing[2],
    borderBottomWidth: 1,
    marginBottom: theme.spacing[2],
  },
  columnTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    flex: 1,
  },
  columnCount: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
  },
  columnScroll: {
    flex: 1,
  },
  columnContent: {
    gap: theme.spacing[2],
    paddingBottom: theme.spacing[4],
  },
  typeViewContent: {
    padding: theme.spacing[4],
    gap: theme.spacing[4],
  },
  typeGroup: {
    gap: theme.spacing[2],
  },
  typeGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingBottom: theme.spacing[2],
    borderBottomWidth: 1,
  },
  typeGroupTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    flex: 1,
  },
  typeCards: {
    gap: theme.spacing[2],
  },
  card: {
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing[3],
    gap: theme.spacing[2],
  },
  cardHovered: {
    backgroundColor: theme.colors.surfaceSidebarHover,
    borderColor: theme.colors.surfaceSidebarHover,
  },
  cardPressed: {
    backgroundColor: theme.colors.surface2,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  cardTitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
    flex: 1,
    minWidth: 0,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  cardStatus: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
  },
  cardAgentCount: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.palette.blue[500],
  },
  cardZentaoMark: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.palette.green[500],
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: theme.borderRadius.full,
  },
  addTaskButton: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  createTaskForm: {
    padding: theme.spacing[4],
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing[3],
    marginBottom: theme.spacing[4],
  },
  createTaskInput: {
    fontSize: theme.fontSize.base,
    color: theme.colors.foreground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
  },
  createTaskTypeRow: {
    flexDirection: "row",
    gap: theme.spacing[2],
  },
  createTaskTypeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[1],
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  createTaskTypeButtonSelected: {
    backgroundColor: theme.colors.surface2,
    borderColor: theme.colors.foregroundMuted,
  },
  createTaskTypeText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
  },
  createTaskTypeTextSelected: {
    color: theme.colors.foreground,
  },
  createTaskActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: theme.spacing[2],
  },
  createProjectCancel: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.borderRadius.md,
  },
  createProjectCancelText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  createProjectConfirm: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface2,
  },
  createProjectConfirmText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
  navButton: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardDeployMark: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.palette.amber[500],
  },
  cardActions: {
    flexDirection: "row",
    gap: theme.spacing[2],
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing[2],
  },
  cardActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[1],
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1],
  },
  cardActionText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
  },
}));
