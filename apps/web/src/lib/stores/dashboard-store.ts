import { create } from "zustand";
import type {
  PinnedWidget,
  QualityAlert,
  DashboardSourceSummary,
  DashboardKpis,
  CompletenessData,
  LineageEntry,
  CorrectionEntry,
} from "@/lib/types";
import {
  MOCK_PINNED_WIDGETS,
  MOCK_ALERTS,
  MOCK_DASHBOARD_SOURCES,
  MOCK_COMPLETENESS,
  MOCK_LINEAGE,
  MOCK_CORRECTIONS,
} from "@/lib/mock-data";

export interface DashboardData {
  pinnedWidgets: PinnedWidget[];
  alerts: QualityAlert[];
  sources: DashboardSourceSummary[];
  completeness: CompletenessData | null;
  lineage: LineageEntry[];
  corrections: CorrectionEntry[];
}

const EMPTY_DASHBOARD: DashboardData = {
  pinnedWidgets: [],
  alerts: [],
  sources: [],
  completeness: null,
  lineage: [],
  corrections: [],
};

interface DashboardState {
  dashboards: Record<string, DashboardData>;
  ensureDashboard: (projectId: string) => void;
  pinWidget: (projectId: string, widget: PinnedWidget) => void;
  unpinWidget: (projectId: string, id: string) => void;
  acknowledgeAlert: (projectId: string, id: string) => void;
  setSources: (projectId: string, sources: DashboardSourceSummary[]) => void;
  setAlerts: (projectId: string, alerts: QualityAlert[]) => void;
  setCompleteness: (projectId: string, data: CompletenessData) => void;
  setLineage: (projectId: string, lineage: LineageEntry[]) => void;
  setCorrections: (projectId: string, corrections: CorrectionEntry[]) => void;
}

function getDashboard(state: DashboardState, projectId: string): DashboardData {
  return state.dashboards[projectId] ?? EMPTY_DASHBOARD;
}

/** Derive KPIs from dashboard data — keeps a single source of truth */
export function computeKpis(data: DashboardData): DashboardKpis {
  const totalSources = data.sources.length;

  const totalRowsHarmonized = data.sources.reduce((sum, s) => sum + s.rowCount, 0);

  const fieldsMapped = data.sources.reduce((sum, s) => sum + s.mappedFields, 0);
  const fieldsTotal = data.sources.reduce(
    (sum, s) => sum + s.mappedFields + s.unmappedFields,
    0,
  );

  const dataCompleteness =
    fieldsTotal > 0 ? Math.round((fieldsMapped / fieldsTotal) * 1000) / 10 : 0;

  const openAlerts = data.alerts.filter((a) => !a.acknowledged).length;

  return {
    totalSources,
    totalRowsHarmonized,
    fieldsMapped,
    fieldsTotal,
    dataCompleteness,
    openAlerts,
  };
}

export const useDashboardStore = create<DashboardState>()((set) => ({
  dashboards: {
    "proj-001": {
      pinnedWidgets: MOCK_PINNED_WIDGETS,
      alerts: MOCK_ALERTS,
      sources: MOCK_DASHBOARD_SOURCES,
      completeness: MOCK_COMPLETENESS,
      lineage: MOCK_LINEAGE,
      corrections: MOCK_CORRECTIONS,
    },
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
      return {
        dashboards: {
          ...state.dashboards,
          [projectId]: { ...d, pinnedWidgets: [...d.pinnedWidgets, widget] },
        },
      };
    }),

  unpinWidget: (projectId, id) =>
    set((state) => {
      const d = getDashboard(state, projectId);
      return {
        dashboards: {
          ...state.dashboards,
          [projectId]: { ...d, pinnedWidgets: d.pinnedWidgets.filter((w) => w.id !== id) },
        },
      };
    }),

  acknowledgeAlert: (projectId, id) =>
    set((state) => {
      const d = getDashboard(state, projectId);
      return {
        dashboards: {
          ...state.dashboards,
          [projectId]: {
            ...d,
            alerts: d.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
          },
        },
      };
    }),

  setSources: (projectId, sources) =>
    set((state) => {
      const d = getDashboard(state, projectId);
      return {
        dashboards: { ...state.dashboards, [projectId]: { ...d, sources } },
      };
    }),

  setAlerts: (projectId, alerts) =>
    set((state) => {
      const d = getDashboard(state, projectId);
      return {
        dashboards: { ...state.dashboards, [projectId]: { ...d, alerts } },
      };
    }),

  setCompleteness: (projectId, completeness) =>
    set((state) => {
      const d = getDashboard(state, projectId);
      return {
        dashboards: { ...state.dashboards, [projectId]: { ...d, completeness } },
      };
    }),

  setLineage: (projectId, lineage) =>
    set((state) => {
      const d = getDashboard(state, projectId);
      return {
        dashboards: { ...state.dashboards, [projectId]: { ...d, lineage } },
      };
    }),

  setCorrections: (projectId, corrections) =>
    set((state) => {
      const d = getDashboard(state, projectId);
      return {
        dashboards: { ...state.dashboards, [projectId]: { ...d, corrections } },
      };
    }),
}));
