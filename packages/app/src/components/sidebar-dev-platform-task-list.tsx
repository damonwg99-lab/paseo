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
import { Plus } from "lucide-react-native";
import { useDevPlatformStore } from "@/stores/dev-platform-store";
import { navigateToPreparedWorkspaceTab } from "@/utils/workspace-navigation";
import { useSessionStore } from "@/stores/session-store";
import { SidebarProjectSection } from "@/components/sidebar-project-section";

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
  const fetchProjects = useDevPlatformStore((s) => s.fetchProjects);
  const fetchTasks = useDevPlatformStore((s) => s.fetchTasks);
  const tasksByProject = useDevPlatformStore((s) => s.tasksByProject);

  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectRootDir, setNewProjectRootDir] = useState("");
  const inputRef = useRef<TextInput>(null);
  const createProject = useDevPlatformStore((s) => s.createProject);

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

  const handleSettingsPress = useCallback(
    (projectId: string) => {
      if (!serverId) return;
      const sessions = useSessionStore.getState().sessions;
      const session = sessions[serverId];
      if (!session) return;
      const firstWorkspace = session.workspaces.values().next().value;
      if (!firstWorkspace) return;
      navigateToPreparedWorkspaceTab({
        serverId,
        workspaceId: firstWorkspace.id,
        target: { kind: "project_settings", projectId },
      });
    },
    [serverId],
  );

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

      {projects.map((project) => {
        const collapsed = collapsedProjectIds.has(project.id);
        return (
          <SidebarProjectSection
            key={project.id}
            projectId={project.id}
            collapsed={collapsed}
            onToggleCollapsed={onToggleProjectCollapsed}
            // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
            onProjectPress={onProjectPress ?? (() => {})}
            onSettingsPress={handleSettingsPress}
            serverId={serverId ?? null}
          />
        );
      })}
    </ScrollView>
  );
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
}));
