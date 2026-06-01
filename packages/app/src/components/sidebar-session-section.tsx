import { View, Text, Pressable, type PressableStateCallbackType } from "react-native";
import { useCallback } from "react";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ChevronDown, ChevronRight, Plus, Bot } from "lucide-react-native";
import { useSessionStore } from "@/stores/session-store";

interface SidebarSessionSectionProps {
  serverId: string | null;
  projectRootDirectory: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onAgentPress: (agentId: string) => void;
  onCreateAgent: () => void;
}

export function SidebarSessionSection({
  serverId,
  projectRootDirectory,
  collapsed,
  onToggleCollapsed,
  onAgentPress,
  onCreateAgent,
}: SidebarSessionSectionProps) {
  const { theme } = useUnistyles();

  const sessions = useSessionStore((s) => s.sessions);
  const session = serverId ? sessions[serverId] : null;

  // Filter agents by cwd matching project root directory
  const agents = session
    ? Array.from(session.agents.values()).filter((agent) => agent.cwd === projectRootDirectory)
    : [];

  const ChevronIcon = collapsed ? ChevronRight : ChevronDown;

  const headerStyle = useCallback(
    ({ hovered }: PressableStateCallbackType & { hovered?: boolean }) => [
      styles.sectionHeader,
      hovered && styles.sectionHeaderHovered,
    ],
    [],
  );

  return (
    <View style={styles.section}>
      <Pressable onPress={onToggleCollapsed} style={headerStyle}>
        {({ hovered }) => (
          <>
            <ChevronIcon
              size={12}
              color={hovered ? theme.colors.foreground : theme.colors.foregroundMuted}
            />
            <Bot size={12} color={theme.colors.foregroundMuted} />
            <Text
              // oxlint-disable-next-line react-perf/jsx-no-new-array-as-prop
              style={[styles.sectionLabel, hovered && styles.sectionLabelHovered]}
            >
              Sessions
            </Text>
            <Text style={styles.agentCount}>{agents.length}</Text>
            {hovered ? (
              <Pressable onPress={onCreateAgent} style={styles.addAgentButton}>
                <Plus size={12} color={theme.colors.foregroundMuted} />
              </Pressable>
            ) : null}
          </>
        )}
      </Pressable>
      {!collapsed && agents.length > 0
        ? agents.map((agent) => (
            <Pressable
              key={agent.id}
              // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
              onPress={() => onAgentPress(agent.id)}
              style={agentRowStyle}
            >
              {({ hovered }) => (
                <>
                  <Bot
                    size={12}
                    color={hovered ? theme.colors.foreground : theme.colors.foregroundMuted}
                  />
                  <Text
                    // oxlint-disable-next-line react-perf/jsx-no-new-array-as-prop
                    style={[styles.agentName, hovered && styles.agentNameHovered]}
                    numberOfLines={1}
                  >
                    {agent.title ?? agent.id}
                  </Text>
                </>
              )}
            </Pressable>
          ))
        : null}
    </View>
  );
}

function agentRowStyle({ hovered }: PressableStateCallbackType & { hovered?: boolean }) {
  return [styles.agentRow, hovered && styles.agentRowHovered];
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
  agentCount: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
  },
  addAgentButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  agentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    minHeight: 28,
    paddingVertical: theme.spacing[1],
    paddingLeft: theme.spacing[3] + theme.spacing[2],
    paddingRight: theme.spacing[2],
    borderRadius: theme.borderRadius.lg,
  },
  agentRowHovered: {
    backgroundColor: theme.colors.surfaceSidebarHover,
  },
  agentName: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
    flex: 1,
    minWidth: 0,
  },
  agentNameHovered: {
    color: theme.colors.foreground,
  },
}));
