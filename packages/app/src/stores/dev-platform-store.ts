import { create } from "zustand";
import type {
  DevPlatformProject,
  DevPlatformTask,
  DefaultAgentConfig,
} from "@getpaseo/protocol/dev-platform/types";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { useSessionStore } from "@/stores/session-store";

interface DevPlatformState {
  projects: DevPlatformProject[];
  tasksByProject: Record<string, DevPlatformTask[]>;
  defaultAgentConfigs: DefaultAgentConfig[];
  loading: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  fetchTasks: (projectId: string) => Promise<void>;
  fetchDefaultConfigs: () => Promise<void>;
  createProject: (input: {
    name: string;
    description?: string;
    gitRepos?: unknown[];
    zentaoProjectId?: string;
    uatBranch?: string;
    prdBranch?: string;
  }) => Promise<DevPlatformProject | null>;
  createTask: (input: {
    projectId: string;
    taskType: string;
    title: string;
    description?: string;
    priority?: string;
    interactionMode?: string;
    parentTaskId?: string | null;
  }) => Promise<DevPlatformTask | null>;
  updateTask: (input: {
    taskId: string;
    title?: string;
    description?: string;
    priority?: string;
    status?: string;
    interactionMode?: string;
    branchName?: string | null;
  }) => Promise<DevPlatformTask | null>;
  toggleZentaoSync: (taskId: string, enabled: boolean) => Promise<DevPlatformTask | null>;
  archiveTask: (taskId: string) => Promise<DevPlatformTask | null>;
  updateDefaultConfig: (input: {
    taskType: string;
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

export const useDevPlatformStore = create<DevPlatformState>((set) => ({
  projects: [],
  tasksByProject: {},
  defaultAgentConfigs: [],
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const result = await getClient().devProjectList();
      set({
        projects: (result.projects as DevPlatformProject[]) ?? [],
        loading: false,
      });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  fetchTasks: async (projectId: string) => {
    try {
      const result = await getClient().devTaskList(projectId);
      set((state) => ({
        tasksByProject: {
          ...state.tasksByProject,
          [projectId]: (result.tasks as DevPlatformTask[]) ?? [],
        },
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  fetchDefaultConfigs: async () => {
    try {
      const result = await getClient().devDefaultConfigList();
      set({ defaultAgentConfigs: (result.configs as DefaultAgentConfig[]) ?? [] });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  createProject: async (input) => {
    try {
      const result = await getClient().devProjectCreate(input);
      const project = result.project as DevPlatformProject | null;
      if (project) {
        set((state) => ({ projects: [...state.projects, project] }));
      }
      return project;
    } catch (error) {
      set({ error: String(error) });
      return null;
    }
  },

  createTask: async (input) => {
    try {
      const result = await getClient().devTaskCreate(input);
      const task = result.task as DevPlatformTask | null;
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
      const result = await getClient().devTaskUpdate(input);
      const task = result.task as DevPlatformTask | null;
      if (task) {
        set((state) => ({
          tasksByProject: {
            ...state.tasksByProject,
            [task.projectId]: (state.tasksByProject[task.projectId] ?? []).map((t) =>
              t.id === task.id ? task : t,
            ),
          },
        }));
      }
      return task;
    } catch (error) {
      set({ error: String(error) });
      return null;
    }
  },

  toggleZentaoSync: async (taskId: string, enabled: boolean) => {
    try {
      const result = await getClient().devTaskToggleZentaoSync(taskId, enabled);
      const task = result.task as DevPlatformTask | null;
      if (task) {
        set((state) => ({
          tasksByProject: {
            ...state.tasksByProject,
            [task.projectId]: (state.tasksByProject[task.projectId] ?? []).map((t) =>
              t.id === task.id ? task : t,
            ),
          },
        }));
      }
      return task;
    } catch (error) {
      set({ error: String(error) });
      return null;
    }
  },

  archiveTask: async (taskId: string) => {
    try {
      const result = await getClient().devTaskArchive(taskId);
      const task = result.task as DevPlatformTask | null;
      if (task) {
        set((state) => ({
          tasksByProject: {
            ...state.tasksByProject,
            [task.projectId]: (state.tasksByProject[task.projectId] ?? []).map((t) =>
              t.id === task.id ? task : t,
            ),
          },
        }));
      }
      return task;
    } catch (error) {
      set({ error: String(error) });
      return null;
    }
  },

  updateDefaultConfig: async (input) => {
    try {
      const result = await getClient().devDefaultConfigUpdate(input);
      const config = result.config as DefaultAgentConfig | null;
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
