import { View, Text, Pressable, type PressableStateCallbackType } from "react-native";
import { useCallback } from "react";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ChevronDown, ChevronRight, FolderGit2 } from "lucide-react-native";
import { useDevPlatformStore } from "@/stores/dev-platform-store";

interface SidebarWorkspaceSectionProps {
  projectId: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function SidebarWorkspaceSection({
  projectId,
  collapsed,
  onToggleCollapsed,
}: SidebarWorkspaceSectionProps) {
  const { theme } = useUnistyles();
  const projects = useDevPlatformStore((s) => s.projects);
  const project = projects.find((p) => p.id === projectId);

  const headerStyle = useCallback(
    ({ hovered }: PressableStateCallbackType & { hovered?: boolean }) => [
      styles.sectionHeader,
      hovered && styles.sectionHeaderHovered,
    ],
    [],
  );

  if (!project) return null;

  const repos = project.gitRepos ?? [];
  const ChevronIcon = collapsed ? ChevronRight : ChevronDown;

  return (
    <View style={styles.section}>
      <Pressable onPress={onToggleCollapsed} style={headerStyle}>
        {({ hovered }) => (
          <>
            <ChevronIcon
              size={12}
              color={hovered ? theme.colors.foreground : theme.colors.foregroundMuted}
            />
            <FolderGit2 size={12} color={theme.colors.foregroundMuted} />
            <Text
              // oxlint-disable-next-line react-perf/jsx-no-new-array-as-prop
              style={[styles.sectionLabel, hovered && styles.sectionLabelHovered]}
            >
              Workspaces
            </Text>
            <Text style={styles.repoCount}>{repos.length}</Text>
          </>
        )}
      </Pressable>
      {!collapsed && repos.length > 0
        ? repos.map((repo) => (
            <Pressable key={repo.url} style={repoRowStyle}>
              {({ hovered }) => (
                <>
                  <FolderGit2
                    size={12}
                    color={hovered ? theme.colors.foreground : theme.colors.foregroundMuted}
                  />
                  <Text
                    // oxlint-disable-next-line react-perf/jsx-no-new-array-as-prop
                    style={[styles.repoName, hovered && styles.repoNameHovered]}
                    numberOfLines={1}
                  >
                    {repo.label ?? repo.url}
                  </Text>
                </>
              )}
            </Pressable>
          ))
        : null}
    </View>
  );
}

function repoRowStyle({ hovered }: PressableStateCallbackType & { hovered?: boolean }) {
  return [styles.repoRow, hovered && styles.repoRowHovered];
}

const styles = StyleSheet.create((theme) => ({
  section: {
    paddingLeft: theme.spacing[3],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[1],
    paddingHorizontal: theme.spacing[2],
    borderRadius: theme.borderRadius.lg,
  },
  sectionHeaderHovered: {
    backgroundColor: theme.colors.surfaceSidebarHover,
  },
  sectionLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foregroundMuted,
    flex: 1,
  },
  sectionLabelHovered: {
    color: theme.colors.foreground,
  },
  repoCount: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
  },
  repoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    minHeight: 28,
    paddingVertical: theme.spacing[1],
    paddingLeft: theme.spacing[3] + theme.spacing[2],
    paddingRight: theme.spacing[2],
    borderRadius: theme.borderRadius.lg,
  },
  repoRowHovered: {
    backgroundColor: theme.colors.surfaceSidebarHover,
  },
  repoName: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
    flex: 1,
    minWidth: 0,
  },
  repoNameHovered: {
    color: theme.colors.foreground,
  },
}));
