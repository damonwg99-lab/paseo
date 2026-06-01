import { Settings } from "lucide-react-native";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import invariant from "tiny-invariant";
import { useCallback, useState } from "react";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { usePaneContext, usePaneFocus } from "@/panels/pane-context";
import type { PanelDescriptor, PanelRegistration } from "@/panels/panel-registry";
import { useDevPlatformStore } from "@/stores/dev-platform-store";

const FLEX_FILL_STYLE = { flex: 1 } as const;

function useProjectSettingsPanelDescriptor(
  target: { kind: "project_settings"; projectId: string },
  _context: { serverId: string; workspaceId: string },
): PanelDescriptor {
  const projects = useDevPlatformStore((s) => s.projects);
  const project = projects.find((p) => p.id === target.projectId);
  return {
    label: project?.name ?? "Project settings",
    subtitle: "Edit project configuration",
    titleState: "ready",
    icon: Settings,
    statusBucket: null,
  };
}

function ProjectSettingsPanel() {
  const { target } = usePaneContext();
  const { isWorkspaceFocused } = usePaneFocus();
  invariant(
    target.kind === "project_settings",
    "ProjectSettingsPanel requires project_settings target",
  );

  const { theme } = useUnistyles();
  const projects = useDevPlatformStore((s) => s.projects);
  const updateProject = useDevPlatformStore((s) => s.updateProject);
  const project = projects.find((p) => p.id === target.projectId);

  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [zentaoProjectId, setZentaoProjectId] = useState(project?.zentaoProjectId ?? "");
  const [uatBranch, setUatBranch] = useState(project?.uatBranch ?? "");
  const [prdBranch, setPrdBranch] = useState(project?.prdBranch ?? "");

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    await updateProject({
      projectId: target.projectId,
      name: trimmedName,
      description: description.trim() || undefined,
      zentaoProjectId: zentaoProjectId.trim() || undefined,
      uatBranch: uatBranch.trim() || undefined,
      prdBranch: prdBranch.trim() || undefined,
    });
  }, [name, description, zentaoProjectId, uatBranch, prdBranch, target.projectId, updateProject]);

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
    <ScrollView style={FLEX_FILL_STYLE} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Project settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic info</Text>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
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
            placeholderTextColor={theme.colors.foregroundMuted}
            multiline
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Root directory</Text>
          <Text style={styles.readOnlyValue}>{project.rootDirectory}</Text>
          <Text style={styles.readOnlyHint}>Cannot be changed after creation</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Branches</Text>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>UAT branch</Text>
          <TextInput
            style={styles.input}
            value={uatBranch}
            onChangeText={setUatBranch}
            placeholderTextColor={theme.colors.foregroundMuted}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Production branch</Text>
          <TextInput
            style={styles.input}
            value={prdBranch}
            onChangeText={setPrdBranch}
            placeholderTextColor={theme.colors.foregroundMuted}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Zentao</Text>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Zentao project ID</Text>
          <TextInput
            style={styles.input}
            value={zentaoProjectId}
            onChangeText={setZentaoProjectId}
            placeholderTextColor={theme.colors.foregroundMuted}
          />
        </View>
      </View>

      <Pressable onPress={handleSave} style={styles.saveButton}>
        <Text style={styles.saveButtonText}>Save changes</Text>
      </Pressable>
    </ScrollView>
  );
}

export const projectSettingsPanelRegistration: PanelRegistration<"project_settings"> = {
  kind: "project_settings",
  component: ProjectSettingsPanel,
  useDescriptor: useProjectSettingsPanelDescriptor,
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
  section: {
    gap: theme.spacing[3],
    paddingVertical: theme.spacing[2],
  },
  sectionTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    paddingBottom: theme.spacing[1],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  fieldGroup: {
    gap: theme.spacing[1],
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
  readOnlyValue: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
    paddingVertical: theme.spacing[1],
  },
  readOnlyHint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
  },
  saveButton: {
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface2,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
}));
