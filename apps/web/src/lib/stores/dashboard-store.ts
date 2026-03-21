import { create } from "zustand";
import type {
  PinnedWidget,
  QualityAlert,
  DashboardSourceSummary,
  DashboardKpis,
  CompletenessData,
  LineageEntry,
  CorrectionEntry,
  ChartSpec,
} from "@/lib/types";
import {
  fetchDashboard,
  pinWidget as apiPinWidget,
  acknowledgeAlert as apiAcknowledgeAlert,
  unpinWidget as apiUnpinWidget,
  runQualityCheck as apiRunQualityCheck,
  type DashboardWidgetDTO,
  type DashboardAlertDTO,
  type DashboardSourceDTO,
} from "@/lib/api/dashboard";

function dtoToWidget(dto: DashboardWidgetDTO): PinnedWidget {
  return {
    id: dto.id,
    title: dto.title,
    queryText: dto.queryText,
    sqlQuery: dto.queryCode,
    chartSpec: dto.chartSpec,
    pinnedAt: dto.pinnedAt,
  };
}

function dtoToAlert(dto: DashboardAlertDTO): QualityAlert {
  return {
    id: dto.id,
    severity: dto.severity,
    summary: dto.summary,
    affectedCount: dto.affectedCount,
    acknowledged: dto.acknowledged,
    createdAt: dto.createdAt,
    sourceFileId: dto.sourceFileId ?? undefined,
    detectionMethod: dto.detectionMethod ?? undefined,
  };
}

function dtoToSource(dto: DashboardSourceDTO): DashboardSourceSummary {
  return {
    id: dto.id,
    filename: dto.filename,
    fileType: (dto.fileType ?? "csv") as DashboardSourceSummary["fileType"],
    status: dto.status as DashboardSourceSummary["status"],
    rowCount: dto.rowCount,
    columnCount: dto.columnCount ?? 0,
    mappedFields: dto.mappedFields,
    unmappedFields: dto.unmappedFields,
    lastSyncAt: dto.lastSyncAt ?? new Date().toISOString(),
    uploadedAt: dto.uploadedAt ?? new Date().toISOString(),
    domain: dto.domain ?? "",
  };
}

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
  loading: boolean;
  error: string | null;
  loadDashboard: (projectId: string) => Promise<void>;
  ensureDashboard: (projectId: string) => void;
  pinWidget: (
    projectId: string,
    widget: { title: string; queryText: string; queryCode: string; chartSpec: ChartSpec },
  ) => Promise<void>;
  unpinWidget: (projectId: string, id: string) => void;
  acknowledgeAlert: (projectId: string, id: string) => void;
  runQualityCheck: (projectId: string) => Promise<number>;
  setSources: (projectId: string, sources: DashboardSourceSummary[]) => void;
  setAlerts: (projectId: string, alerts: QualityAlert[]) => void;
  setCompleteness: (projectId: string, data: CompletenessData) => void;
  setLineage: (projectId: string, lineage: LineageEntry[]) => void;
  setCorrections: (projectId: string, corrections: CorrectionEntry[]) => void;
}

function getDashboard(state: DashboardState, projectId: string): DashboardData {
  return state.dashboards[projectId] ?? EMPTY_DASHBOARD;
}

export function computeKpis(data: DashboardData): DashboardKpis {
  const totalSources = data.sources.length;
  const totalRowsHarmonized = data.sources.reduce((sum, s) => sum + s.rowCount, 0);
  const fieldsMapped = data.sources.reduce((sum, s) => sum + s.mappedFields, 0);
  const fieldsTotal = data.sources.reduce((sum, s) => sum + s.mappedFields + s.unmappedFields, 0);
  const dataCompleteness = fieldsTotal > 0 ? Math.round((fieldsMapped / fieldsTotal) * 1000) / 10 : 0;
  const openAlerts = data.alerts.filter((a) => !a.acknowledged).length;

  return { totalSources, totalRowsHarmonized, fieldsMapped, fieldsTotal, dataCompleteness, openAlerts };
}

export const useDashboardStore = create<DashboardState>()((set) => ({
  dashboards: {},
  loading: false,
  error: null,

  loadDashboard: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const dto = await fetchDashboard(projectId);
      set((state) => ({
        loading: false,
        dashboards: {
          ...state.dashboards,
          [projectId]: {
            pinnedWidgets: (dto.widgets ?? []).map(dtoToWidget),
            alerts: (dto.alerts ?? []).map(dtoToAlert),
            sources: (dto.sources ?? []).map(dtoToSource),
            completeness: dto.completeness ?? null,
            lineage: dto.lineage ?? [],
            corrections: dto.corrections ?? [],
          },
        },
      }));
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  ensureDashboard: (projectId) =>
    set((state) => {
      if (state.dashboards[projectId]) return state;
      return { dashboards: { ...state.dashboards, [projectId]: { ...EMPTY_DASHBOARD } } };
    }),

  pinWidget: async (projectId, widget) => {
    try {
      const dto = await apiPinWidget(projectId, {
        ...widget,
        chartSpec: widget.chartSpec as unknown as Record<string, unknown>,
      });
      const pinned = dtoToWidget(dto);
      set((state) => {
        const d = getDashboard(state, projectId);
        return {
          dashboards: {
            ...state.dashboards,
            [projectId]: { ...d, pinnedWidgets: [...d.pinnedWidgets, pinned] },
          },
        };
      });
    } catch {
      /* swallow — toast handled by caller */
    }
  },

  unpinWidget: (projectId, id) => {
    apiUnpinWidget(id).catch(() => {});
    set((state) => {
      const d = getDashboard(state, projectId);
      return {
        dashboards: {
          ...state.dashboards,
          [projectId]: { ...d, pinnedWidgets: d.pinnedWidgets.filter((w) => w.id !== id) },
        },
      };
    });
  },

  acknowledgeAlert: (projectId, id) => {
    apiAcknowledgeAlert(id).catch(() => {});
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
    });
  },

  runQualityCheck: async (projectId) => {
    const result = await apiRunQualityCheck(projectId);
    if (result.alerts.length > 0) {
      set((state) => {
        const d = getDashboard(state, projectId);
        const existingIds = new Set(d.alerts.map((a) => a.id));
        const newAlerts = result.alerts
          .map(dtoToAlert)
          .filter((a) => !existingIds.has(a.id));
        return {
          dashboards: {
            ...state.dashboards,
            [projectId]: { ...d, alerts: [...newAlerts, ...d.alerts] },
          },
        };
      });
    }
    return result.persisted;
  },

  setSources: (projectId, sources) =>
    set((state) => {
      const d = getDashboard(state, projectId);
      return { dashboards: { ...state.dashboards, [projectId]: { ...d, sources } } };
    }),

  setAlerts: (projectId, alerts) =>
    set((state) => {
      const d = getDashboard(state, projectId);
      return { dashboards: { ...state.dashboards, [projectId]: { ...d, alerts } } };
    }),

  setCompleteness: (projectId, completeness) =>
    set((state) => {
      const d = getDashboard(state, projectId);
      return { dashboards: { ...state.dashboards, [projectId]: { ...d, completeness } } };
    }),

  setLineage: (projectId, lineage) =>
    set((state) => {
      const d = getDashboard(state, projectId);
      return { dashboards: { ...state.dashboards, [projectId]: { ...d, lineage } } };
    }),

  setCorrections: (projectId, corrections) =>
    set((state) => {
      const d = getDashboard(state, projectId);
      return { dashboards: { ...state.dashboards, [projectId]: { ...d, corrections } } };
    }),
}));
