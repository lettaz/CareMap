import { create } from "zustand";
import type { PinnedWidget, QualityAlert } from "@/lib/types";
import { MOCK_PINNED_WIDGETS, MOCK_ALERTS } from "@/lib/mock-data";

export interface DashboardData {
  pinnedWidgets: PinnedWidget[];
  alerts: QualityAlert[];
}

const EMPTY_DASHBOARD: DashboardData = { pinnedWidgets: [], alerts: [] };

interface DashboardState {
  dashboards: Record<string, DashboardData>;
  ensureDashboard: (projectId: string) => void;
  pinWidget: (projectId: string, widget: PinnedWidget) => void;
  unpinWidget: (projectId: string, id: string) => void;
  acknowledgeAlert: (projectId: string, id: string) => void;
}

function getDashboard(state: DashboardState, projectId: string): DashboardData {
  return state.dashboards[projectId] ?? EMPTY_DASHBOARD;
}

export const useDashboardStore = create<DashboardState>()((set) => ({
  dashboards: {
    "proj-001": { pinnedWidgets: MOCK_PINNED_WIDGETS, alerts: MOCK_ALERTS },
    "proj-002": { ...EMPTY_DASHBOARD },
  },

  ensureDashboard: (projectId) =>
    set((state) => {
      if (state.dashboards[projectId]) return state;
      return { dashboards: { ...state.dashboards, [projectId]: { ...EMPTY_DASHBOARD } } };
    }),

  pinWidget: (projectId, widget) =>
    set((state) => {
      const d = getDashboard(state, projectId);
      if (d.pinnedWidgets.some((w) => w.id === widget.id)) return state;
      return { dashboards: { ...state.dashboards, [projectId]: { ...d, pinnedWidgets: [...d.pinnedWidgets, widget] } } };
    }),

  unpinWidget: (projectId, id) =>
    set((state) => {
      const d = getDashboard(state, projectId);
      return { dashboards: { ...state.dashboards, [projectId]: { ...d, pinnedWidgets: d.pinnedWidgets.filter((w) => w.id !== id) } } };
    }),

  acknowledgeAlert: (projectId, id) =>
    set((state) => {
      const d = getDashboard(state, projectId);
      return {
        dashboards: {
          ...state.dashboards,
          [projectId]: { ...d, alerts: d.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)) },
        },
      };
    }),
}));
