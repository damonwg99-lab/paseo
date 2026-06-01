import { FolderPlus } from "lucide-react-native";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import invariant from "tiny-invariant";
import { useCallback, useState } from "react";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { usePaneContext, usePaneFocus } from "@/panels/pane-context";
import type { PanelDescriptor, PanelRegistration } from "@/panels/panel-registry";
import { useDevPlatformStore } from "@/stores/dev-platform-store";
import type { DevPlatformGitRepo } from "@getpaseo/protocol/dev-platform/types";

const FLEX_FILL_STYLE = { flex: 1 } as const;

function useCreateProjectPanelDescriptor(
  _target: { kind: "create_project" },
  _context: { serverId: string; workspaceId: string },
): PanelDescriptor {
  return {
    label: "New project",
    subtitle: "Create a dev platform project",
    titleState: "ready",
    icon: FolderPlus,
    statusBucket: null,
  };
}

function CreateProjectPanel() {
  const { target } = usePaneContext();
  const { isWorkspaceFocused } = usePaneFocus();
  invariant(target.kind === "create_project", "CreateProjectPanel requires create_project target");

  const { theme } = useUnistyles();
  const createProject = useDevPlatformStore((s) => s.createProject);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rootDirectory, setRootDirectory] = useState("");
  const [zentaoProjectId, setZentaoProjectId] = useState("");
  const [uatBranch, setUatBranch] = useState("");
  const [prdBranch, setPrdBranch] = useState("");
  const [cicdPlatform, setCicdPlatform] = useState("");
  const [cicdUrl, setCicdUrl] = useState("");
  const [cicdToken, setCicdToken] = useState("");
  const [uatJob, setUatJob] = useState("");
  const [prdJob, setPrdJob] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [repoName, setRepoName] = useState("");
  const [gitRepos, setGitRepos] = useState<DevPlatformGitRepo[]>([]);

  const handleAddRepo = useCallback(() => {
    const url = repoUrl.trim();
    if (!url) return;
    setGitRepos((prev) => [...prev, { url, label: repoName.trim() || undefined }]);
    setRepoUrl("");
    setRepoName("");
  }, [repoUrl, repoName]);

  const handleRemoveRepo = useCallback((url: string) => {
    setGitRepos((prev) => prev.filter((repo) => repo.url !== url));
  }, []);

  const handleCreate = useCallback(async () => {
    const trimmedName = name.trim();
    const trimmedRoot = rootDirectory.trim() || trimmedName;
    if (!trimmedName) return;
    await createProject({
      name: trimmedName,
      rootDirectory: trimmedRoot,
      description: description.trim() || undefined,
      gitRepos,
      zentaoProjectId: zentaoProjectId.trim() || undefined,
      uatBranch: uatBranch.trim() || undefined,
      prdBranch: prdBranch.trim() || undefined,
      cicdConfig: cicdPlatform.trim()
        ? {
            type: cicdPlatform.trim() as "jenkins" | "github_actions" | "gitlab_ci" | "custom",
            url: cicdUrl.trim(),
            token: cicdToken.trim(),
            uatJob: uatJob.trim(),
            prdJob: prdJob.trim(),
            autoTriggerUat: true,
            autoTriggerPrd: false,
          }
        : undefined,
    });
  }, [
    name,
    rootDirectory,
    description,
    gitRepos,
    zentaoProjectId,
    uatBranch,
    prdBranch,
    cicdPlatform,
    cicdUrl,
    cicdToken,
    uatJob,
    prdJob,
    createProject,
  ]);

  if (!isWorkspaceFocused) {
    return <View style={FLEX_FILL_STYLE} />;
  }

  return (
    <ScrollView style={FLEX_FILL_STYLE} contentContainerStyle={styles.content}>
      <Text style={styles.title}>New project</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Project name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="My project"
          placeholderTextColor={theme.colors.foregroundMuted}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Root directory *</Text>
        <TextInput
          style={styles.input}
          value={rootDirectory}
          onChangeText={setRootDirectory}
          placeholder="/path/to/project"
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
          placeholder="Project description"
          placeholderTextColor={theme.colors.foregroundMuted}
          multiline
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Git repositories</Text>
        {gitRepos.map((repo) => (
          <View key={repo.url} style={styles.repoRow}>
            <Text style={styles.repoText}>{repo.label ?? repo.url}</Text>
            <Pressable
              // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
              onPress={() => handleRemoveRepo(repo.url)}
              style={styles.repoRemove}
            >
              <Text style={styles.repoRemoveText}>Remove</Text>
            </Pressable>
          </View>
        ))}
        <TextInput
          style={styles.input}
          value={repoUrl}
          onChangeText={setRepoUrl}
          placeholder="Repository URL"
          placeholderTextColor={theme.colors.foregroundMuted}
        />
        <TextInput
          style={styles.input}
          value={repoName}
          onChangeText={setRepoName}
          placeholder="Repository name (optional)"
          placeholderTextColor={theme.colors.foregroundMuted}
        />
        <Pressable onPress={handleAddRepo} style={styles.addRepoButton}>
          <Text style={styles.addRepoText}>Add repository</Text>
        </Pressable>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.sectionTitle}>Branches</Text>
        <TextInput
          style={styles.input}
          value={uatBranch}
          onChangeText={setUatBranch}
          placeholder="UAT branch name"
          placeholderTextColor={theme.colors.foregroundMuted}
        />
        <TextInput
          style={styles.input}
          value={prdBranch}
          onChangeText={setPrdBranch}
          placeholder="Production branch name"
          placeholderTextColor={theme.colors.foregroundMuted}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.sectionTitle}>Zentao</Text>
        <TextInput
          style={styles.input}
          value={zentaoProjectId}
          onChangeText={setZentaoProjectId}
          placeholder="Zentao project ID"
          placeholderTextColor={theme.colors.foregroundMuted}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.sectionTitle}>CI/CD (optional)</Text>
        <TextInput
          style={styles.input}
          value={cicdPlatform}
          onChangeText={setCicdPlatform}
          placeholder="Platform (jenkins/github_actions/gitlab_ci/custom)"
          placeholderTextColor={theme.colors.foregroundMuted}
        />
        <TextInput
          style={styles.input}
          value={cicdUrl}
          onChangeText={setCicdUrl}
          placeholder="CI/CD URL"
          placeholderTextColor={theme.colors.foregroundMuted}
        />
        <TextInput
          style={styles.input}
          value={cicdToken}
          onChangeText={setCicdToken}
          placeholder="Auth token"
          placeholderTextColor={theme.colors.foregroundMuted}
        />
        <TextInput
          style={styles.input}
          value={uatJob}
          onChangeText={setUatJob}
          placeholder="UAT job name"
          placeholderTextColor={theme.colors.foregroundMuted}
        />
        <TextInput
          style={styles.input}
          value={prdJob}
          onChangeText={setPrdJob}
          placeholder="Production job name"
          placeholderTextColor={theme.colors.foregroundMuted}
        />
      </View>

      <Pressable onPress={handleCreate} style={styles.createButton}>
        <Text style={styles.createButtonText}>Create project</Text>
      </Pressable>
    </ScrollView>
  );
}

export const createProjectPanelRegistration: PanelRegistration<"create_project"> = {
  kind: "create_project",
  component: CreateProjectPanel,
  useDescriptor: useCreateProjectPanelDescriptor,
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
  sectionTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
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
  repoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing[1],
    paddingHorizontal: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  repoText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
    flex: 1,
  },
  repoRemove: {
    paddingHorizontal: theme.spacing[2],
  },
  repoRemoveText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.palette.red[500],
  },
  addRepoButton: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  addRepoText: {
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
