import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  type PressableStateCallbackType,
} from "react-native";
import { useCallback, useEffect, useState, useRef } from "react";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import {
  Bug,
  ClipboardList,
  Code,
  FileText,
  Layout,
  Plus,
  Rocket,
  TestTube,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from "lucide-react-native";
import { useDevPlatformStore } from "@/stores/dev-platform-store";
import { navigateToPreparedWorkspaceTab } from "@/utils/workspace-navigation";
import { useSessionStore } from "@/stores/session-store";
import type { DevPlatformTask, DevPlatformTaskType } from "@getpaseo/protocol/dev-platform/types";

const TASK_TYPE_ICONS: Record<DevPlatformTaskType, LucideIcon> = {
  requirement: ClipboardList,
  design: Layout,
  development: Code,
  bug: Bug,
  testing: TestTube,
  documentation: FileText,
  deployment: Rocket,
};

const TASK_TYPE_LABELS: Record<DevPlatformTaskType, string> = {
  requirement: "Req",
  design: "Des",
  development: "Dev",
  bug: "Bug",
  testing: "Test",
  documentation: "Doc",
  deployment: "Deploy",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  todo: "muted",
  in_progress: "blue",
  review: "amber",
  done: "green",
  blocked: "red",
  merge_conflict: "red",
  archived: "muted",
};

interface SidebarDevPlatformTaskListProps {
  serverId: string | null;
  collapsedProjectIds: ReadonlySet<string>;
  onToggleProjectCollapsed: (projectId: string) => void;
  onProjectPress?: (projectId: string) => void;
}

export function SidebarDevPlatformTaskList({
  serverId,
  collapsedProjectIds,
  onToggleProjectCollapsed,
  onProjectPress,
}: SidebarDevPlatformTaskListProps) {
  const { theme } = useUnistyles();
  const projects = useDevPlatformStore((s) => s.projects);
  const tasksByProject = useDevPlatformStore((s) => s.tasksByProject);
  const loading = useDevPlatformStore((s) => s.loading);
  const fetchProjects = useDevPlatformStore((s) => s.fetchProjects);
  const fetchTasks = useDevPlatformStore((s) => s.fetchTasks);
  const createProject = useDevPlatformStore((s) => s.createProject);

  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectRootDir, setNewProjectRootDir] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (serverId) {
      void fetchProjects();
    }
  }, [serverId, fetchProjects]);

  useEffect(() => {
    for (const project of projects) {
      if (!tasksByProject[project.id]) {
        void fetchTasks(project.id);
      }
    }
  }, [projects, tasksByProject, fetchTasks]);

  const handleToggleProject = useCallback(
    (projectId: string) => {
      onToggleProjectCollapsed(projectId);
    },
    [onToggleProjectCollapsed],
  );

  const handleTaskPress = useCallback(
    (task: DevPlatformTask) => {
      if (!serverId) return;
      const sessions = useSessionStore.getState().sessions;
      const session = sessions[serverId];
      if (!session) return;
      const firstWorkspace = session.workspaces.values().next().value;
      if (!firstWorkspace) return;
      navigateToPreparedWorkspaceTab({
        serverId,
        workspaceId: firstWorkspace.id,
        target: { kind: "task", taskId: task.id },
      });
    },
    [serverId],
  );

  const handleStartCreateProject = useCallback(() => {
    setIsCreatingProject(true);
    setNewProjectName("");
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleCancelCreateProject = useCallback(() => {
    setIsCreatingProject(false);
    setNewProjectName("");
    setNewProjectRootDir("");
  }, []);

  const handleConfirmCreateProject = useCallback(async () => {
    const name = newProjectName.trim();
    if (!name) return;
    const project = await createProject({ name, rootDirectory: newProjectRootDir.trim() || name });
    if (project) {
      setIsCreatingProject(false);
      setNewProjectName("");
      setNewProjectRootDir("");
      onProjectPress?.(project.id);
    }
  }, [newProjectName, newProjectRootDir, createProject, onProjectPress]);

  const createProjectRowStyle = useCallback(
    ({ hovered }: PressableStateCallbackType & { hovered?: boolean }) => [
      styles.addProjectRow,
      hovered && styles.addProjectRowHovered,
    ],
    [],
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      testID="sidebar-dev-platform-task-list-scroll"
    >
      {isCreatingProject ? (
        <View style={styles.createProjectForm}>
          <TextInput
            ref={inputRef}
            style={styles.createProjectInput}
            value={newProjectName}
            onChangeText={setNewProjectName}
            placeholder="Project name"
            placeholderTextColor={theme.colors.foregroundMuted}
            autoFocus
            onSubmitEditing={handleConfirmCreateProject}
            returnKeyType="done"
          />
          <TextInput
            style={styles.createProjectInput}
            value={newProjectRootDir}
            onChangeText={setNewProjectRootDir}
            placeholder="Root directory"
            placeholderTextColor={theme.colors.foregroundMuted}
            onSubmitEditing={handleConfirmCreateProject}
            returnKeyType="done"
          />
          <View style={styles.createProjectActions}>
            <Pressable onPress={handleCancelCreateProject} style={styles.createProjectCancel}>
              <Text style={styles.createProjectCancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleConfirmCreateProject} style={styles.createProjectConfirm}>
              <Text style={styles.createProjectConfirmText}>Create</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Pressable onPress={handleStartCreateProject} style={createProjectRowStyle}>
        <Plus size={14} color={theme.colors.foregroundMuted} />
        <Text style={styles.addProjectText}>New project</Text>
      </Pressable>

      {loading && projects.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Loading tasks...</Text>
        </View>
      ) : null}

      {projects.map((project) => {
        const tasks = tasksByProject[project.id] ?? [];
        const collapsed = collapsedProjectIds.has(project.id);
        const nonArchivedTasks = tasks.filter((t) => t.status !== "archived");

        return (
          <View key={project.id} style={styles.projectGroup}>
            <Pressable
              // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
              onPress={() => {
                handleToggleProject(project.id);
                onProjectPress?.(project.id);
              }}
              style={projectHeaderStyle}
              testID={`sidebar-dev-task-project-${project.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${project.name} tasks`}
            >
              {({ hovered }) => {
                const ChevronIcon = collapsed ? ChevronRight : ChevronDown;
                return (
                  <>
                    <ChevronIcon
                      size={14}
                      color={hovered ? theme.colors.foreground : theme.colors.foregroundMuted}
                    />
                    <Text
                      // oxlint-disable-next-line react-perf/jsx-no-new-array-as-prop
                      style={[styles.projectName, hovered && styles.projectNameHovered]}
                      numberOfLines={1}
                    >
                      {project.name}
                    </Text>
                    <Text style={styles.taskCount}>{nonArchivedTasks.length}</Text>
                  </>
                );
              }}
            </Pressable>

            {!collapsed && nonArchivedTasks.length > 0
              ? nonArchivedTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    theme={theme}
                    // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                    onPress={() => handleTaskPress(task)}
                  />
                ))
              : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

function TaskRow({
  task,
  theme,
  onPress,
}: {
  task: DevPlatformTask;
  theme: ReturnType<typeof useUnistyles>["theme"];
  onPress: () => void;
}) {
  const TypeIcon = TASK_TYPE_ICONS[task.type] ?? ClipboardList;
  const statusColorKey = STATUS_DOT_COLORS[task.status] ?? "muted";

  let statusDotColor: string;
  if (statusColorKey === "blue") statusDotColor = theme.colors.palette.blue[500];
  else if (statusColorKey === "amber") statusDotColor = theme.colors.palette.amber[500];
  else if (statusColorKey === "green") statusDotColor = theme.colors.palette.green[500];
  else if (statusColorKey === "red") statusDotColor = theme.colors.palette.red[500];
  else statusDotColor = theme.colors.foregroundMuted;

  const rowStyle = useCallback(
    ({ hovered, pressed }: PressableStateCallbackType & { hovered?: boolean }) => [
      styles.taskRow,
      hovered && styles.taskRowHovered,
      pressed && styles.taskRowPressed,
    ],
    [],
  );

  return (
    <Pressable
      style={rowStyle}
      onPress={onPress}
      testID={`sidebar-dev-task-row-${task.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${TASK_TYPE_LABELS[task.type]}: ${task.title}`}
    >
      <TypeIcon size={14} color={theme.colors.foregroundMuted} />
      {/* oxlint-disable-next-line react-perf/jsx-no-new-array-as-prop */}
      <View style={[styles.statusDotStyle, { backgroundColor: statusDotColor }]} />
      <Text style={styles.taskTitle} numberOfLines={1}>
        {task.title}
      </Text>
      {task.agentIds.length > 0 ? (
        <Text style={styles.agentCount}>A{task.agentIds.length}</Text>
      ) : null}
      {task.syncToZentao ? <Text style={styles.zentaoSyncMark}>Z</Text> : null}
    </Pressable>
  );
}

function projectHeaderStyle({ hovered }: PressableStateCallbackType & { hovered?: boolean }) {
  return [styles.projectHeader, hovered && styles.projectHeaderHovered];
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: theme.spacing[2],
    paddingTop: theme.spacing[2],
    paddingBottom: theme.spacing[4],
  },
  addProjectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing[1],
  },
  addProjectRowHovered: {
    backgroundColor: theme.colors.surfaceSidebarHover,
  },
  addProjectText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  createProjectForm: {
    marginHorizontal: theme.spacing[2],
    marginBottom: theme.spacing[2],
    padding: theme.spacing[3],
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing[2],
  },
  createProjectInput: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
  },
  createProjectActions: {
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
  projectGroup: {
    marginBottom: theme.spacing[1],
  },
  projectHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[2],
    borderRadius: theme.borderRadius.lg,
  },
  projectHeaderHovered: {
    backgroundColor: theme.colors.surfaceSidebarHover,
  },
  projectName: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foregroundMuted,
    flex: 1,
    minWidth: 0,
  },
  projectNameHovered: {
    color: theme.colors.foreground,
  },
  taskCount: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    minHeight: 32,
    paddingVertical: theme.spacing[1],
    paddingLeft: theme.spacing[3] + theme.spacing[2],
    paddingRight: theme.spacing[3],
    borderRadius: theme.borderRadius.lg,
  },
  taskRowHovered: {
    backgroundColor: theme.colors.surfaceSidebarHover,
  },
  taskRowPressed: {
    backgroundColor: theme.colors.surface2,
  },
  statusDotStyle: {
    width: 6,
    height: 6,
    borderRadius: theme.borderRadius.full,
  },
  taskTitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
    opacity: 0.76,
    flex: 1,
    minWidth: 0,
  },
  agentCount: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.palette.blue[500],
    flexShrink: 0,
  },
  zentaoSyncMark: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.palette.green[500],
    flexShrink: 0,
  },
  emptyContainer: {
    marginHorizontal: theme.spacing[2],
    marginTop: theme.spacing[4],
    paddingTop: theme.spacing[6],
    paddingBottom: theme.spacing[4],
    paddingHorizontal: theme.spacing[4],
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface0,
    alignItems: "center",
    gap: theme.spacing[3],
  },
  emptyTitle: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    textAlign: "center",
  },
  emptyText: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
    textAlign: "center",
  },
}));
