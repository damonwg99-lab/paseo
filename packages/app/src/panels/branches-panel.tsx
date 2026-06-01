import { GitBranch } from "lucide-react-native";
import { Pressable, ScrollView, Text, View, type PressableStateCallbackType } from "react-native";
import invariant from "tiny-invariant";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePaneContext, usePaneFocus } from "@/panels/pane-context";
import type { PanelDescriptor, PanelRegistration } from "@/panels/panel-registry";
import { useDevPlatformStore } from "@/stores/dev-platform-store";
import { navigateToPreparedWorkspaceTab } from "@/utils/workspace-navigation";
import { useSessionStore } from "@/stores/session-store";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import type { BranchStatusEntry } from "@getpaseo/protocol/dev-platform/rpc-schemas";

const FLEX_FILL_STYLE = { flex: 1 } as const;

const GROUP_LABELS = {
  pending_uat: "Pending UAT merge",
  uat_awaiting_prd: "UAT awaiting production",
  deployed: "Deployed to production",
} as const;

type BranchGroup = keyof typeof GROUP_LABELS;

function groupBranches(branches: BranchStatusEntry[]): Record<BranchGroup, BranchStatusEntry[]> {
  const groups: Record<BranchGroup, BranchStatusEntry[]> = {
    pending_uat: [],
    uat_awaiting_prd: [],
    deployed: [],
  };
  for (const branch of branches) {
    if (branch.mergedToPrd) {
      groups.deployed.push(branch);
    } else if (branch.mergedToUat) {
      groups.uat_awaiting_prd.push(branch);
    } else {
      groups.pending_uat.push(branch);
    }
  }
  return groups;
}

function useBranchesPanelDescriptor(
  target: { kind: "branches"; projectId: string },
  _context: { serverId: string; workspaceId: string },
): PanelDescriptor {
  const projects = useDevPlatformStore((s) => s.projects);
  const project = projects.find((p) => p.id === target.projectId);
  return {
    label: project?.name ?? "Branches",
    subtitle: "Branch management",
    titleState: "ready",
    icon: GitBranch,
    statusBucket: null,
  };
}

function BranchesPanel() {
  const { target } = usePaneContext();
  const { isWorkspaceFocused } = usePaneFocus();
  invariant(target.kind === "branches", "BranchesPanel requires branches target");

  const { theme } = useUnistyles();
  const projects = useDevPlatformStore((s) => s.projects);
  const branchStatusByProject = useDevPlatformStore((s) => s.branchStatusByProject);
  const fetchBranchStatus = useDevPlatformStore((s) => s.fetchBranchStatus);
  const tasksByProject = useDevPlatformStore((s) => s.tasksByProject);
  const project = projects.find((p) => p.id === target.projectId);

  useEffect(() => {
    void fetchBranchStatus(target.projectId);
  }, [target.projectId, fetchBranchStatus]);

  const branches = branchStatusByProject[target.projectId] ?? [];
  const grouped = groupBranches(branches);

  const handleTaskPress = useCallback((taskId: string) => {
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
      target: { kind: "task", taskId },
    });
  }, []);

  const projectTasks = useMemo(
    () => tasksByProject[target.projectId] ?? [],
    [tasksByProject, target.projectId],
  );
  const headerBarStyle = useMemo(
    () => [styles.headerBar, { borderBottomColor: theme.colors.border }],
    [theme.colors.border],
  );
  const groupHeaderStyle = useMemo(
    () => [styles.groupHeader, { borderBottomColor: theme.colors.border }],
    [theme.colors.border],
  );

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

  const totalBranches = branches.length;

  return (
    <View style={FLEX_FILL_STYLE}>
      <View style={headerBarStyle}>
        <GitBranch size={16} color={theme.colors.foregroundMuted} />
        <Text style={styles.headerTitle}>{project.name}</Text>
        <Text style={styles.headerCount}>{totalBranches} branches</Text>
      </View>

      <ScrollView style={FLEX_FILL_STYLE} contentContainerStyle={styles.branchContent}>
        {(Object.keys(GROUP_LABELS) as BranchGroup[]).map((groupKey) => {
          const groupEntries = grouped[groupKey];
          if (groupEntries.length === 0) return null;
          return (
            <View key={groupKey} style={styles.branchGroup}>
              <View style={groupHeaderStyle}>
                <GroupDot groupKey={groupKey} theme={theme} />
                <Text style={styles.groupTitle}>{GROUP_LABELS[groupKey]}</Text>
                <Text style={styles.groupCount}>{groupEntries.length}</Text>
              </View>
              {groupEntries.map((branch) => (
                <BranchRow
                  key={`${branch.branchName}-${branch.repoLabel ?? ""}`}
                  branch={branch}
                  theme={theme}
                  tasksByProject={projectTasks}
                  onTaskPress={handleTaskPress}
                />
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function GroupDot({
  groupKey,
  theme,
}: {
  groupKey: BranchGroup;
  theme: ReturnType<typeof useUnistyles>["theme"];
}) {
  let color: string;
  switch (groupKey) {
    case "pending_uat":
      color = theme.colors.palette.amber[500];
      break;
    case "uat_awaiting_prd":
      color = theme.colors.palette.blue[500];
      break;
    case "deployed":
      color = theme.colors.palette.green[500];
      break;
  }
  const dotStyle = useMemo(() => [styles.groupDot, { backgroundColor: color }], [color]);
  return <View style={dotStyle} />;
}

function BranchRow({
  branch,
  theme,
  tasksByProject,
  onTaskPress,
}: {
  branch: BranchStatusEntry;
  theme: ReturnType<typeof useUnistyles>["theme"];
  tasksByProject: { id: string; title: string; type: string }[];
  onTaskPress: (taskId: string) => void;
}) {
  const associatedTasks = useMemo(
    () =>
      branch.associatedTaskIds.map((id) => tasksByProject.find((t) => t.id === id)).filter(Boolean),
    [branch.associatedTaskIds, tasksByProject],
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const toggleExpanded = useCallback(() => setIsExpanded((v) => !v), []);

  const rowStyle = useCallback(
    ({ hovered, pressed }: PressableStateCallbackType & { hovered?: boolean }) => [
      styles.branchRow,
      hovered && styles.branchRowHovered,
      pressed && styles.branchRowPressed,
    ],
    [],
  );

  return (
    <View>
      <Pressable
        style={rowStyle}
        onPress={toggleExpanded}
        testID={`branch-row-${branch.branchName}`}
        accessibilityRole="button"
        accessibilityLabel={branch.branchName}
      >
        <GitBranch size={14} color={theme.colors.foregroundMuted} />
        <Text style={styles.branchName} numberOfLines={1}>
          {branch.branchName}
        </Text>
        {branch.repoLabel ? <Text style={styles.repoLabel}>{branch.repoLabel}</Text> : null}
        {branch.aheadBy != null || branch.behindBy != null ? (
          <Text style={styles.aheadBehind}>
            +{branch.aheadBy ?? 0} / -{branch.behindBy ?? 0}
          </Text>
        ) : null}
        {branch.buildStatus && branch.buildStatus !== "not_built" ? (
          <BuildStatusBadge status={branch.buildStatus} theme={theme} />
        ) : null}
        <Text style={styles.taskCount}>{associatedTasks.length} tasks</Text>
      </Pressable>

      {isExpanded && associatedTasks.length > 0
        ? associatedTasks.map((task) => (
            <TaskSubRow key={task!.id} task={task!} onTaskPress={onTaskPress} />
          ))
        : null}
    </View>
  );
}

function TaskSubRow({
  task,
  onTaskPress,
}: {
  task: { id: string; title: string; type: string };
  onTaskPress: (taskId: string) => void;
}) {
  const handlePress = useCallback(() => onTaskPress(task.id), [onTaskPress, task.id]);
  return (
    <Pressable
      style={styles.taskSubRow}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={task.title}
    >
      <Text style={styles.taskSubTitle} numberOfLines={1}>
        {task.title}
      </Text>
      <Text style={styles.taskSubType}>{task.type}</Text>
    </Pressable>
  );
}

function BuildStatusBadge({
  status,
  theme,
}: {
  status: string;
  theme: ReturnType<typeof useUnistyles>["theme"];
}) {
  let label: string;
  let color: string;
  switch (status) {
    case "building":
      label = "Building";
      color = theme.colors.palette.amber[500];
      break;
    case "build_success":
      label = "OK";
      color = theme.colors.palette.green[500];
      break;
    case "build_failed":
      label = "Failed";
      color = theme.colors.palette.red[500];
      break;
    default:
      label = status;
      color = theme.colors.foregroundMuted;
  }
  const badgeStyle = useMemo(() => [styles.buildBadge, { color }], [color]);
  return <Text style={badgeStyle}>{label}</Text>;
}

export const branchesPanelRegistration: PanelRegistration<"branches"> = {
  kind: "branches",
  component: BranchesPanel,
  useDescriptor: useBranchesPanelDescriptor,
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
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    flex: 1,
  },
  headerCount: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  branchContent: {
    padding: theme.spacing[4],
    gap: theme.spacing[4],
  },
  branchGroup: {
    gap: theme.spacing[2],
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingBottom: theme.spacing[2],
    borderBottomWidth: 1,
  },
  groupDot: {
    width: 8,
    height: 8,
    borderRadius: theme.borderRadius.full,
  },
  groupTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    flex: 1,
  },
  groupCount: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
  },
  branchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    borderRadius: theme.borderRadius.lg,
  },
  branchRowHovered: {
    backgroundColor: theme.colors.surfaceSidebarHover,
  },
  branchRowPressed: {
    backgroundColor: theme.colors.surface2,
  },
  branchName: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
    flex: 1,
    minWidth: 0,
  },
  repoLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
    flexShrink: 0,
  },
  aheadBehind: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
    flexShrink: 0,
  },
  taskCount: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
    flexShrink: 0,
  },
  buildBadge: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    flexShrink: 0,
  },
  taskSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingLeft: theme.spacing[3] + theme.spacing[4],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.borderRadius.lg,
  },
  taskSubTitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
    opacity: 0.76,
    flex: 1,
    minWidth: 0,
  },
  taskSubType: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
    flexShrink: 0,
  },
}));
