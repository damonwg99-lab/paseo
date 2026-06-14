import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useCallback, useState } from "react";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { router } from "expo-router";
import { useDevPlatformStore } from "@/stores/dev-platform-store";
import { useSessionStore } from "@/stores/session-store";
import { useHostRuntimeClient, useHostRuntimeIsConnected } from "@/runtime/host-runtime";
import { normalizeWorkspaceDescriptor } from "@/stores/session-store";
import { buildWorkspaceTabPersistenceKey } from "@/stores/workspace-tabs-store";
import { useWorkspaceLayoutStore } from "@/stores/workspace-layout-store";
import { navigateToWorkspace } from "@/stores/navigation-active-workspace-store";
import { buildHostOpenProjectRoute } from "@/utils/host-routes";
import type { DevPlatformGitRepo, CicdConfig } from "@getpaseo/protocol/dev-platform/types";

interface ProjectFormPanelProps {
  mode: "create" | "edit";
  projectId?: string;
  serverId?: string;
}

const FLEX_FILL_STYLE = { flex: 1 } as const;

const CICD_PLATFORM_OPTIONS = ["jenkins", "github_actions", "gitlab_ci", "custom"] as const;

// oxlint-disable-next-line complexity
function ProjectFormPanel({ mode, projectId, serverId }: ProjectFormPanelProps) {
  const { theme } = useUnistyles();
  const createProject = useDevPlatformStore((s) => s.createProject);
  const updateProject = useDevPlatformStore((s) => s.updateProject);
  const projects = useDevPlatformStore((s) => s.projects);
  const project = mode === "edit" && projectId ? projects.find((p) => p.id === projectId) : null;

  // Hooks for workspace creation after project creation (must be at top level)
  const normalizedServerId = serverId?.trim() ?? "";
  const client = useHostRuntimeClient(normalizedServerId);
  const isConnected = useHostRuntimeIsConnected(normalizedServerId);

  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [rootDirectory, setRootDirectory] = useState(project?.rootDirectory ?? "");
  const [zentaoProjectId, setZentaoProjectId] = useState(project?.zentaoProjectId ?? "");
  const [uatBranch, setUatBranch] = useState(project?.uatBranch ?? "");
  const [prdBranch, setPrdBranch] = useState(project?.prdBranch ?? "");
  const [gitRepos, setGitRepos] = useState<DevPlatformGitRepo[]>(project?.gitRepos ?? []);
  const [repoUrl, setRepoUrl] = useState("");
  const [repoName, setRepoName] = useState("");

  const cicdConfig = project?.cicdConfig;
  const [cicdPlatform, setCicdPlatform] = useState(cicdConfig?.type ?? "");
  const [cicdUrl, setCicdUrl] = useState(cicdConfig?.url ?? "");
  const [cicdToken, setCicdToken] = useState(cicdConfig?.token ?? "");
  const [uatJob, setUatJob] = useState(cicdConfig?.uatJob ?? "");
  const [prdJob, setPrdJob] = useState(cicdConfig?.prdJob ?? "");

  const isEdit = mode === "edit";

  const handleAddRepo = useCallback(() => {
    const url = repoUrl.trim();
    if (!url) return;
    const label = repoName.trim() || undefined;
    // For manually added repos, derive relativePath from label or default to "."
    // (auto-detected repos get their relativePath from the scanner)
    const relativePath = label ?? ".";
    setGitRepos((prev) => [...prev, { url, relativePath, worktrees: [], label }]);
    setRepoUrl("");
    setRepoName("");
  }, [repoUrl, repoName]);

  const handleRemoveRepo = useCallback((url: string) => {
    setGitRepos((prev) => prev.filter((repo) => repo.url !== url));
  }, []);

  // Open workspace for the project root directory and navigate to kanban
  const openWorkspaceAndNavigateToKanban = useCallback(
    async (rootDir: string, newProjectId: string) => {
      if (!normalizedServerId) return;
      if (!client || !isConnected) {
        router.push(buildHostOpenProjectRoute(normalizedServerId));
        return;
      }
      try {
        const payload = await client.openProject(rootDir);
        if (!payload.workspace) {
          router.push(buildHostOpenProjectRoute(normalizedServerId));
          return;
        }
        const workspace = normalizeWorkspaceDescriptor(payload.workspace);
        useSessionStore.getState().mergeWorkspaces(normalizedServerId, [workspace]);
        useSessionStore.getState().setHasHydratedWorkspaces(normalizedServerId, true);

        const workspaceKey = buildWorkspaceTabPersistenceKey({
          serverId: normalizedServerId,
          workspaceId: workspace.id,
        });
        if (!workspaceKey) {
          router.push(buildHostOpenProjectRoute(normalizedServerId));
          return;
        }
        useWorkspaceLayoutStore.getState().openTabFocused(workspaceKey, {
          kind: "kanban",
          projectId: newProjectId,
        });
        navigateToWorkspace(normalizedServerId, workspace.id);
      } catch {
        router.push(buildHostOpenProjectRoute(normalizedServerId));
      }
    },
    [normalizedServerId, client, isConnected],
  );

  // oxlint-disable-next-line complexity
  const handleSubmit = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const cicdInput: CicdConfig | null | undefined = cicdPlatform.trim()
      ? {
          type: cicdPlatform.trim() as (typeof CICD_PLATFORM_OPTIONS)[number],
          url: cicdUrl.trim(),
          token: cicdToken.trim(),
          uatJob: uatJob.trim(),
          prdJob: prdJob.trim(),
          autoTriggerUat: true,
          autoTriggerPrd: false,
        }
      : null;

    if (isEdit && projectId) {
      await updateProject({
        projectId,
        name: trimmedName,
        description: description.trim() || undefined,
        gitRepos,
        zentaoProjectId: zentaoProjectId.trim() || undefined,
        uatBranch: uatBranch.trim() || undefined,
        prdBranch: prdBranch.trim() || undefined,
        cicdConfig: cicdInput,
      });
    } else {
      const trimmedRoot = rootDirectory.trim() || trimmedName;
      const newProject = await createProject({
        name: trimmedName,
        rootDirectory: trimmedRoot,
        description: description.trim() || undefined,
        gitRepos,
        zentaoProjectId: zentaoProjectId.trim() || undefined,
        uatBranch: uatBranch.trim() || undefined,
        prdBranch: prdBranch.trim() || undefined,
        cicdConfig: cicdInput,
      });

      if (newProject) {
        await openWorkspaceAndNavigateToKanban(trimmedRoot, newProject.id);
      }
    }
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
    isEdit,
    projectId,
    createProject,
    updateProject,
    openWorkspaceAndNavigateToKanban,
  ]);

  return (
    <ScrollView style={FLEX_FILL_STYLE} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isEdit ? "项目设置" : "新建项目"}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>基本信息</Text>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>项目名称 *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="项目名称"
            placeholderTextColor={theme.colors.foregroundMuted}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>项目描述</Text>
          <TextInput
            // oxlint-disable-next-line react-perf/jsx-no-new-array-as-prop
            style={[styles.input, styles.multilineInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="项目描述"
            placeholderTextColor={theme.colors.foregroundMuted}
            multiline
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>项目根目录 *</Text>
          {isEdit ? (
            <>
              <Text style={styles.readOnlyValue}>{project?.rootDirectory ?? rootDirectory}</Text>
              <Text style={styles.readOnlyHint}>创建后不可修改</Text>
            </>
          ) : (
            <TextInput
              style={styles.input}
              value={rootDirectory}
              onChangeText={setRootDirectory}
              placeholder="/path/to/project"
              placeholderTextColor={theme.colors.foregroundMuted}
            />
          )}
        </View>
        {isEdit && project?.createdAt ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>创建时间</Text>
            <Text style={styles.readOnlyValue}>{new Date(project.createdAt).toLocaleString()}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Git仓库</Text>
        {gitRepos.map((repo) => (
          <View key={repo.url} style={styles.repoRow}>
            <Text style={styles.repoText}>{repo.label ?? repo.url}</Text>
            <Pressable
              // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
              onPress={() => handleRemoveRepo(repo.url)}
              style={styles.repoRemove}
            >
              <Text style={styles.repoRemoveText}>删除</Text>
            </Pressable>
          </View>
        ))}
        <TextInput
          style={styles.input}
          value={repoUrl}
          onChangeText={setRepoUrl}
          placeholder="仓库URL"
          placeholderTextColor={theme.colors.foregroundMuted}
        />
        <TextInput
          style={styles.input}
          value={repoName}
          onChangeText={setRepoName}
          placeholder="仓库名称（可选）"
          placeholderTextColor={theme.colors.foregroundMuted}
        />
        <Pressable onPress={handleAddRepo} style={styles.addRepoButton}>
          <Text style={styles.addRepoText}>添加仓库</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>分支</Text>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>UAT分支名</Text>
          <TextInput
            style={styles.input}
            value={uatBranch}
            onChangeText={setUatBranch}
            placeholder="UAT分支名"
            placeholderTextColor={theme.colors.foregroundMuted}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>生产分支名</Text>
          <TextInput
            style={styles.input}
            value={prdBranch}
            onChangeText={setPrdBranch}
            placeholder="生产分支名"
            placeholderTextColor={theme.colors.foregroundMuted}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>禅道</Text>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>禅道项目ID</Text>
          <TextInput
            style={styles.input}
            value={zentaoProjectId}
            onChangeText={setZentaoProjectId}
            placeholder="禅道项目ID"
            placeholderTextColor={theme.colors.foregroundMuted}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CI/CD（可选）</Text>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>平台类型</Text>
          <TextInput
            style={styles.input}
            value={cicdPlatform}
            onChangeText={setCicdPlatform}
            placeholder="jenkins / github_actions / gitlab_ci / custom"
            placeholderTextColor={theme.colors.foregroundMuted}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>CI/CD URL</Text>
          <TextInput
            style={styles.input}
            value={cicdUrl}
            onChangeText={setCicdUrl}
            placeholder="平台地址"
            placeholderTextColor={theme.colors.foregroundMuted}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>认证Token</Text>
          <TextInput
            style={styles.input}
            value={cicdToken}
            onChangeText={setCicdToken}
            placeholder="认证token"
            placeholderTextColor={theme.colors.foregroundMuted}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>UAT Job名</Text>
          <TextInput
            style={styles.input}
            value={uatJob}
            onChangeText={setUatJob}
            placeholder="UAT job名"
            placeholderTextColor={theme.colors.foregroundMuted}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>生产Job名</Text>
          <TextInput
            style={styles.input}
            value={prdJob}
            onChangeText={setPrdJob}
            placeholder="生产job名"
            placeholderTextColor={theme.colors.foregroundMuted}
          />
        </View>
      </View>

      <Pressable onPress={handleSubmit} style={styles.saveButton}>
        <Text style={styles.saveButtonText}>{isEdit ? "保存修改" : "创建项目"}</Text>
      </Pressable>
    </ScrollView>
  );
}

export default ProjectFormPanel;

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
