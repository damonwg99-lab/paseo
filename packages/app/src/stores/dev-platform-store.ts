import { create } from "zustand";
import type {
  DevPlatformProject,
  DevPlatformTask,
  DevPlatformGitRepo,
  DevPlatformTaskType,
  DevPlatformTaskPriority,
  DevPlatformTaskStatus,
  DevPlatformInteractionMode,
  DevPlatformProviderConfig,
  CicdConfig,
  DefaultAgentConfig,
} from "@getpaseo/protocol/dev-platform/types";
import type { BranchStatusEntry, GitRepoStatus } from "@getpaseo/protocol/dev-platform/rpc-schemas";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { useSessionStore } from "@/stores/session-store";

interface DevPlatformState {
  projects: DevPlatformProject[];
  activeProjectId: string | null;
  tasksByProject: Record<string, DevPlatformTask[]>;
  branchStatusByProject: Record<string, BranchStatusEntry[]>;
  repoStatusesByProject: Record<string, Map<string, GitRepoStatus>>;
  defaultAgentConfigs: DefaultAgentConfig[];
  loading: boolean;
  error: string | null;

  setActiveProjectId: (projectId: string | null) => void;
  fetchProjects: () => Promise<void>;
  fetchTasks: (projectId: string) => Promise<void>;
  fetchBranchStatus: (projectId: string) => Promise<void>;
  fetchRepoStatuses: (projectId: string) => Promise<void>;
  fetchDefaultConfigs: () => Promise<void>;
  createProject: (input: {
    name: string;
    rootDirectory: string;
    description?: string;
    gitRepos?: DevPlatformGitRepo[];
    zentaoProjectId?: string;
    uatBranch?: string;
    prdBranch?: string;
    cicdConfig?: CicdConfig | null;
  }) => Promise<DevPlatformProject | null>;
  updateProject: (input: {
    projectId: string;
    name?: string;
    description?: string;
    gitRepos?: DevPlatformGitRepo[];
    zentaoProjectId?: string;
    uatBranch?: string;
    prdBranch?: string;
    cicdConfig?: CicdConfig | null;
    archivedAt?: string | null;
  }) => Promise<DevPlatformProject | null>;
  archiveProject: (projectId: string) => Promise<DevPlatformProject | null>;
  createTask: (input: {
    projectId: string;
    taskType: DevPlatformTaskType;
    title: string;
    description?: string;
    priority?: DevPlatformTaskPriority;
    interactionMode?: DevPlatformInteractionMode;
    parentTaskId?: string | null;
    syncToZentao?: boolean;
    providerConfig?: DevPlatformProviderConfig | null;
    involvedRepos?: string[];
  }) => Promise<DevPlatformTask | null>;
  updateTask: (input: {
    taskId: string;
    title?: string;
    description?: string;
    priority?: DevPlatformTaskPriority;
    status?: DevPlatformTaskStatus;
    interactionMode?: DevPlatformInteractionMode;
    parentTaskId?: string | null;
    branchName?: string | null;
    providerConfig?: DevPlatformProviderConfig | null;
    involvedRepos?: string[];
    archivedAt?: string | null;
  }) => Promise<DevPlatformTask | null>;
  linkAgentToTask: (taskId: string, agentId: string) => Promise<DevPlatformTask | null>;
  setActiveAgent: (taskId: string, agentId: string) => Promise<DevPlatformTask | null>;
  toggleZentaoSync: (taskId: string, enabled: boolean) => Promise<DevPlatformTask | null>;
  archiveTask: (taskId: string) => Promise<DevPlatformTask | null>;
  updateDefaultConfig: (input: {
    taskType: DevPlatformTaskType;
    provider: string;
    model: string;
    mode: string;
    systemPromptTemplate?: string;
  }) => Promise<DefaultAgentConfig | null>;
}

function getClient(): DaemonClient {
  const sessions = useSessionStore.getState().sessions;
  const serverIds = Object.keys(sessions);
  const client = serverIds.length > 0 ? sessions[serverIds[0]]?.client : null;
  if (!client) {
    throw new Error("DaemonClient not available");
  }
  return client;
}

function updateTaskInState(
  state: DevPlatformState,
  task: DevPlatformTask,
): Partial<DevPlatformState> {
  return {
    tasksByProject: {
      ...state.tasksByProject,
      [task.projectId]: (state.tasksByProject[task.projectId] ?? []).map((t) =>
        t.id === task.id ? task : t,
      ),
    },
  };
}

export const useDevPlatformStore = create<DevPlatformState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  tasksByProject: {},
  branchStatusByProject: {},
  repoStatusesByProject: {},
  defaultAgentConfigs: [],
  loading: false,
  error: null,

  setActiveProjectId: (projectId: string | null) => {
    set({ activeProjectId: projectId });
  },

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const payload = await getClient().devProjectList();
      const projects = payload.projects ?? [];
      const state = get();
      const activeProjectId = state.activeProjectId;
      const nonArchived = projects.filter((p) => !p.archivedAt);
      const nextActiveId =
        activeProjectId && nonArchived.some((p) => p.id === activeProjectId)
          ? activeProjectId
          : (nonArchived[0]?.id ?? null);
      set({
        projects,
        activeProjectId: nextActiveId,
        loading: false,
      });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  fetchTasks: async (projectId: string) => {
    try {
      const payload = await getClient().devTaskList(projectId);
      set((state) => ({
        tasksByProject: {
          ...state.tasksByProject,
          [projectId]: payload.tasks ?? [],
        },
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  fetchBranchStatus: async (projectId: string) => {
    try {
      const payload = await getClient().devProjectBranchStatusList({ projectId });
      set((state) => ({
        branchStatusByProject: {
          ...state.branchStatusByProject,
          [projectId]: payload.branches ?? [],
        },
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  fetchRepoStatuses: async (projectId: string) => {
    try {
      const payload = await getClient().devRepoStatusAll({ projectId });
      const statusMap = new Map<string, GitRepoStatus>();
      for (const entry of payload.statuses ?? []) {
        if (entry.status) {
          statusMap.set(entry.repoPath, entry.status);
        }
      }
      set((state) => ({
        repoStatusesByProject: {
          ...state.repoStatusesByProject,
          [projectId]: statusMap,
        },
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  fetchDefaultConfigs: async () => {
    try {
      const payload = await getClient().devDefaultConfigList();
      set({ defaultAgentConfigs: payload.configs ?? [] });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  createProject: async (input) => {
    try {
      const payload = await getClient().devProjectCreate(input);
      const project = payload.project;
      if (project) {
        set((state) => ({
          projects: [...state.projects, project],
          activeProjectId: project.id,
        }));
      }
      return project;
    } catch (error) {
      set({ error: String(error) });
      return null;
    }
  },

  updateProject: async (input) => {
    try {
      const payload = await getClient().devProjectUpdate(input);
      const project = payload.project;
      if (project) {
        set((state) => ({
          projects: state.projects.map((p) => (p.id === project.id ? project : p)),
        }));
      }
      return project;
    } catch (error) {
      set({ error: String(error) });
      return null;
    }
  },

  archiveProject: async (projectId: string) => {
    try {
      const payload = await getClient().devProjectArchive(projectId);
      const project = payload.project;
      if (project) {
        const state = get();
        const updatedProjects = state.projects.map((p) => (p.id === project.id ? project : p));
        const nextActiveId =
          state.activeProjectId === project.id
            ? (updatedProjects.find((p) => !p.archivedAt)?.id ?? null)
            : state.activeProjectId;
        set({
          projects: updatedProjects,
          activeProjectId: nextActiveId,
        });
      }
      return project;
    } catch (error) {
      set({ error: String(error) });
      return null;
    }
  },

  createTask: async (input) => {
    try {
      const payload = await getClient().devTaskCreate(input);
      const task = payload.task;
      if (task) {
        set((state) => ({
          tasksByProject: {
            ...state.tasksByProject,
            [task.projectId]: [...(state.tasksByProject[task.projectId] ?? []), task],
          },
        }));
      }
      return task;
    } catch (error) {
      set({ error: String(error) });
      return null;
    }
  },

  updateTask: async (input) => {
    try {
      const payload = await getClient().devTaskUpdate(input);
      const task = payload.task;
      if (task) {
        set((state) => updateTaskInState(state, task));
      }
      return task;
    } catch (error) {
      set({ error: String(error) });
      return null;
    }
  },

  linkAgentToTask: async (taskId: string, agentId: string) => {
    try {
      const payload = await getClient().devTaskLinkAgent(taskId, agentId);
      const task = payload.task;
      if (task) {
        set((state) => updateTaskInState(state, task));
      }
      return task;
    } catch (error) {
      set({ error: String(error) });
      return null;
    }
  },

  setActiveAgent: async (taskId: string, agentId: string) => {
    try {
      const payload = await getClient().devTaskSetActiveAgent(taskId, agentId);
      const task = payload.task;
      if (task) {
        set((state) => updateTaskInState(state, task));
      }
      return task;
    } catch (error) {
      set({ error: String(error) });
      return null;
    }
  },

  toggleZentaoSync: async (taskId: string, enabled: boolean) => {
    try {
      const payload = await getClient().devTaskToggleZentaoSync(taskId, enabled);
      const task = payload.task;
      if (task) {
        set((state) => updateTaskInState(state, task));
      }
      return task;
    } catch (error) {
      set({ error: String(error) });
      return null;
    }
  },

  archiveTask: async (taskId: string) => {
    try {
      const payload = await getClient().devTaskArchive(taskId);
      const task = payload.task;
      if (task) {
        set((state) => updateTaskInState(state, task));
      }
      return task;
    } catch (error) {
      set({ error: String(error) });
      return null;
    }
  },

  updateDefaultConfig: async (input) => {
    try {
      const payload = await getClient().devDefaultConfigUpdate(input);
      const config = payload.config;
      if (config) {
        set((state) => ({
          defaultAgentConfigs: state.defaultAgentConfigs.map((c) =>
            c.type === config.type ? config : c,
          ),
        }));
      }
      return config;
    } catch (error) {
      set({ error: String(error) });
      return null;
    }
  },
}));
