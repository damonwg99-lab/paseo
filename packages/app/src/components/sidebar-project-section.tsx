import { View, Text, Pressable, type PressableStateCallbackType } from "react-native";
import { useCallback } from "react";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ChevronDown, ChevronRight, Settings } from "lucide-react-native";
import { useDevPlatformStore } from "@/stores/dev-platform-store";
import { TASK_TYPE_ICONS, getStatusDotColorKey } from "@/constants/dev-platform-icons";
import { navigateToPreparedWorkspaceTab } from "@/utils/workspace-navigation";
import { useSessionStore } from "@/stores/session-store";
import type { DevPlatformTask } from "@getpaseo/protocol/dev-platform/types";

interface SidebarProjectSectionProps {
  projectId: string;
  collapsed: boolean;
  onToggleCollapsed: (projectId: string) => void;
  onProjectPress: (projectId: string) => void;
  onSettingsPress: (projectId: string) => void;
  serverId: string | null;
}

export function SidebarProjectSection({
  projectId,
  collapsed,
  onToggleCollapsed,
  onProjectPress,
  onSettingsPress,
  serverId,
}: SidebarProjectSectionProps) {
  const { theme } = useUnistyles();
  const projects = useDevPlatformStore((s) => s.projects);
  const tasksByProject = useDevPlatformStore((s) => s.tasksByProject);
  const project = projects.find((p) => p.id === projectId);
  const tasks = tasksByProject[projectId] ?? [];
  const activeTasks = tasks.filter((t) => t.status !== "archived");

  const handleToggle = useCallback(() => {
    onToggleCollapsed(projectId);
    onProjectPress(projectId);
  }, [projectId, onToggleCollapsed, onProjectPress]);

  const handleSettings = useCallback(() => {
    onSettingsPress(projectId);
  }, [projectId, onSettingsPress]);

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
        target: { kind: "task_detail", taskId: task.id },
      });
    },
    [serverId],
  );

  const headerStyle = useCallback(
    ({ hovered }: PressableStateCallbackType & { hovered?: boolean }) => [
      styles.projectHeader,
      hovered && styles.projectHeaderHovered,
    ],
    [],
  );

  if (!project) return null;

  const ChevronIcon = collapsed ? ChevronRight : ChevronDown;

  const statusDotColor = (status: string): string => {
    const key = getStatusDotColorKey(status as DevPlatformTask["status"]);
    if (key === "blue") return theme.colors.palette.blue[500];
    if (key === "amber") return theme.colors.palette.amber[500];
    if (key === "green") return theme.colors.palette.green[500];
    if (key === "red") return theme.colors.palette.red[500];
    return theme.colors.foregroundMuted;
  };

  return (
    <View style={styles.projectGroup}>
      <Pressable onPress={handleToggle} style={headerStyle}>
        {({ hovered }) => (
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
            <Text style={styles.taskCount}>{activeTasks.length}</Text>
            {hovered ? (
              <Pressable onPress={handleSettings} style={styles.settingsButton}>
                <Settings size={14} color={theme.colors.foregroundMuted} />
              </Pressable>
            ) : null}
          </>
        )}
      </Pressable>

      {!collapsed && activeTasks.length > 0
        ? activeTasks.map((task) => {
            const TypeIcon = TASK_TYPE_ICONS[task.type];
            return (
              <Pressable
                key={task.id}
                // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                onPress={() => handleTaskPress(task)}
                style={taskRowStyle}
                testID={`sidebar-task-${task.id}`}
              >
                {({ hovered }) => (
                  <>
                    <TypeIcon
                      size={14}
                      color={hovered ? theme.colors.foreground : theme.colors.foregroundMuted}
                    />
                    <View
                      // oxlint-disable-next-line react-perf/jsx-no-new-array-as-prop
                      style={[styles.statusDot, { backgroundColor: statusDotColor(task.status) }]}
                    />
                    <Text
                      // oxlint-disable-next-line react-perf/jsx-no-new-array-as-prop
                      style={[styles.taskTitle, hovered && styles.taskTitleHovered]}
                      numberOfLines={1}
                    >
                      {task.title}
                    </Text>
                    {task.agentIds.length > 0 ? (
                      <Text style={styles.agentMark}>A{task.agentIds.length}</Text>
                    ) : null}
                    {task.syncToZentao ? <Text style={styles.zentaoMark}>Z</Text> : null}
                  </>
                )}
              </Pressable>
            );
          })
        : null}
    </View>
  );
}

function taskRowStyle({ hovered, pressed }: PressableStateCallbackType & { hovered?: boolean }) {
  return [styles.taskRow, hovered && styles.taskRowHovered, pressed && styles.taskRowPressed];
}

const styles = StyleSheet.create((theme) => ({
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
  settingsButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
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
  taskTitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
    opacity: 0.76,
    flex: 1,
    minWidth: 0,
  },
  taskTitleHovered: {
    opacity: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: theme.borderRadius.full,
  },
  agentMark: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.palette.blue[500],
    flexShrink: 0,
  },
  zentaoMark: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.palette.green[500],
    flexShrink: 0,
  },
}));
