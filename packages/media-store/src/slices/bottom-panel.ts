import type { StateCreator } from "zustand";
import type { TaskProgress } from "../types";

export interface BottomPanelSlice {
  bottomPanelVisible: boolean;
  bottomPanelCollapsed: boolean;
  bottomPanelActiveTaskId: string | null;
  bottomPanelTasks: Record<string, TaskProgress>;

  showBottomPanel: () => void;
  hideBottomPanel: () => void;
  toggleBottomPanelCollapsed: () => void;
  setBottomPanelActiveTask: (taskId: string | null) => void;
  upsertBottomPanelTask: (task: TaskProgress) => void;
  removeBottomPanelTask: (taskId: string) => void;
  clearCompletedTasks: () => void;
}

export const createBottomPanelSlice: StateCreator<BottomPanelSlice, [["zustand/immer", never]]> = (set) => ({
  bottomPanelVisible: false,
  bottomPanelCollapsed: false,
  bottomPanelActiveTaskId: null,
  bottomPanelTasks: {},

  showBottomPanel: () =>
    set((state) => {
      state.bottomPanelVisible = true;
      state.bottomPanelCollapsed = false;
    }),

  hideBottomPanel: () =>
    set((state) => {
      state.bottomPanelVisible = false;
    }),

  toggleBottomPanelCollapsed: () =>
    set((state) => {
      state.bottomPanelCollapsed = !state.bottomPanelCollapsed;
    }),

  setBottomPanelActiveTask: (taskId) =>
    set((state) => {
      state.bottomPanelActiveTaskId = taskId;
    }),

  upsertBottomPanelTask: (task) =>
    set((state) => {
      state.bottomPanelTasks[task.taskId] = task;
      if (!state.bottomPanelVisible && task.status === "running") {
        state.bottomPanelVisible = true;
        state.bottomPanelCollapsed = false;
      }
      if (!state.bottomPanelActiveTaskId) {
        state.bottomPanelActiveTaskId = task.taskId;
      }
    }),

  removeBottomPanelTask: (taskId) =>
    set((state) => {
      delete state.bottomPanelTasks[taskId];
      if (state.bottomPanelActiveTaskId === taskId) {
        const remaining = Object.keys(state.bottomPanelTasks);
        state.bottomPanelActiveTaskId = remaining.length > 0 ? remaining[0]! : null;
      }
      if (Object.keys(state.bottomPanelTasks).length === 0) {
        state.bottomPanelVisible = false;
      }
    }),

  clearCompletedTasks: () =>
    set((state) => {
      for (const taskId of Object.keys(state.bottomPanelTasks)) {
        const task = state.bottomPanelTasks[taskId];
        if (task && (task.status === "completed" || task.status === "failed" || task.status === "cancelled")) {
          delete state.bottomPanelTasks[taskId];
        }
      }
      const remaining = Object.keys(state.bottomPanelTasks);
      if (remaining.length === 0) {
        state.bottomPanelVisible = false;
        state.bottomPanelActiveTaskId = null;
      } else if (state.bottomPanelActiveTaskId && !state.bottomPanelTasks[state.bottomPanelActiveTaskId]) {
        state.bottomPanelActiveTaskId = remaining[0]!;
      }
    }),
});
