import { ChevronDown } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Combobox } from "@/components/ui/combobox";
import type { ComboboxOption } from "@/components/ui/combobox";
import { useDevPlatformStore } from "@/stores/dev-platform-store";
import { navigateToPreparedWorkspaceTab } from "@/utils/workspace-navigation";
import { useSessionStore } from "@/stores/session-store";

interface SidebarProjectSwitcherProps {
  serverId: string | null;
}

function SidebarProjectSwitcher({ serverId }: SidebarProjectSwitcherProps) {
  const { theme } = useUnistyles();
  const allProjects = useDevPlatformStore((s) => s.projects);
  const projects = useMemo(() => allProjects.filter((p) => !p.archivedAt), [allProjects]);
  const activeProjectId = useDevPlatformStore((s) => s.activeProjectId);
  const setActiveProjectId = useDevPlatformStore((s) => s.setActiveProjectId);

  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<View>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const options: ComboboxOption[] = useMemo(
    () => projects.map((p) => ({ id: p.id, label: p.name, description: p.rootDirectory })),
    [projects],
  );

  const handleSelect = useCallback(
    (id: string) => {
      setActiveProjectId(id);
      setIsOpen(false);
      if (!serverId) return;
      const sessions = useSessionStore.getState().sessions;
      const session = sessions[serverId];
      if (!session) return;
      const firstWorkspace = session.workspaces.values().next().value;
      if (!firstWorkspace) return;
      navigateToPreparedWorkspaceTab({
        serverId,
        workspaceId: firstWorkspace.id,
        target: { kind: "kanban", projectId: id },
      });
    },
    [setActiveProjectId, serverId],
  );

  const handleOpen = useCallback(() => setIsOpen(true), []);

  if (projects.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Pressable
        ref={triggerRef}
        onPress={handleOpen}
        style={styles.trigger}
        testID="sidebar-project-switcher-trigger"
      >
        <Text style={styles.triggerLabel} numberOfLines={1}>
          {activeProject?.name ?? "选择项目"}
        </Text>
        <ChevronDown size={14} color={theme.colors.foregroundMuted} />
      </Pressable>
      <Combobox
        options={options}
        value={activeProjectId ?? ""}
        onSelect={handleSelect}
        searchable={true}
        title="切换项目"
        searchPlaceholder="搜索项目..."
        desktopMinWidth={280}
        desktopPlacement="bottom-start"
        open={isOpen}
        onOpenChange={setIsOpen}
        anchorRef={triggerRef}
      />
    </View>
  );
}

export default SidebarProjectSwitcher;

const styles = StyleSheet.create((theme) => ({
  container: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSidebar,
  },
  triggerLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    flex: 1,
  },
}));
