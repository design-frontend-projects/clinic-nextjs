import { create } from "zustand";
import type {
  BodyChartData,
  DiagramKey,
  NumberingMode,
  PartAnnotation,
} from "@/types/body-chart.types";
import {
  createEmptyBodyChartData,
  getDiagramDefinition,
} from "@/lib/body-chart/registry";

interface DraftSnapshot {
  parts: Record<string, PartAnnotation>;
  overallNotes: string;
}

interface BodyChartState {
  diagramKey: DiagramKey;
  activeViewId: string | undefined;
  visibleLayerIds: string[];
  numberingMode: NumberingMode | undefined;
  animationsEnabled: boolean;
  zoom: number;
  pan: { x: number; y: number };
  hoveredPartId: string | null;
  selectedPartId: string | null;
  draftParts: Record<string, PartAnnotation>;
  overallNotes: string;
  shareWithPatient: boolean;
  viewingVersionId: string | null;
  isDirty: boolean;
  past: DraftSnapshot[];
  future: DraftSnapshot[];

  hydrateFromChart: (params: {
    diagramKey: DiagramKey;
    chartData?: BodyChartData | null;
    overallNotes?: string | null;
    shareWithPatient?: boolean;
    viewingVersionId?: string | null;
    markDirty?: boolean;
  }) => void;
  selectPart: (partId: string | null) => void;
  setHoveredPart: (partId: string | null) => void;
  upsertPartAnnotation: (annotation: PartAnnotation) => void;
  removePartAnnotation: (partId: string) => void;
  setActiveView: (viewId: string) => void;
  toggleLayer: (layerId: string) => void;
  setNumberingMode: (mode: NumberingMode) => void;
  toggleAnimations: () => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  resetViewport: () => void;
  setOverallNotes: (notes: string) => void;
  setShareWithPatient: (share: boolean) => void;
  undo: () => void;
  redo: () => void;
  clearDirty: () => void;
  getSerializedChartData: () => BodyChartData;
}

function cloneParts(
  parts: Record<string, PartAnnotation>,
): Record<string, PartAnnotation> {
  const out: Record<string, PartAnnotation> = {};
  for (const [k, v] of Object.entries(parts)) {
    out[k] = {
      ...v,
      surfaces: v.surfaces ? [...v.surfaces] : undefined,
    };
  }
  return out;
}

export const useBodyChartStore = create<BodyChartState>((set, get) => ({
  diagramKey: "general_body",
  activeViewId: undefined,
  visibleLayerIds: [],
  numberingMode: undefined,
  animationsEnabled: true,
  zoom: 1,
  pan: { x: 0, y: 0 },
  hoveredPartId: null,
  selectedPartId: null,
  draftParts: {},
  overallNotes: "",
  shareWithPatient: true,
  viewingVersionId: null,
  isDirty: false,
  past: [],
  future: [],

  hydrateFromChart: ({
    diagramKey,
    chartData,
    overallNotes,
    shareWithPatient = true,
    viewingVersionId = null,
    markDirty = false,
  }) => {
    const diagram = getDiagramDefinition(diagramKey);
    const fallback = createEmptyBodyChartData(diagramKey);
    const defaultLayers = (diagram.layers ?? [])
      .filter((l) => l.defaultVisible)
      .map((l) => l.id);

    set({
      diagramKey,
      activeViewId:
        chartData?.activeViewId ?? diagram.views?.[0]?.id ?? fallback.activeViewId,
      visibleLayerIds: defaultLayers,
      numberingMode:
        chartData?.numberingMode ??
        diagram.numberingModes?.[0]?.id ??
        fallback.numberingMode,
      animationsEnabled:
        chartData?.animationsEnabled ?? fallback.animationsEnabled,
      draftParts: cloneParts(chartData?.parts ?? {}),
      overallNotes: overallNotes ?? "",
      shareWithPatient,
      viewingVersionId,
      isDirty: markDirty,
      selectedPartId: null,
      hoveredPartId: null,
      zoom: 1,
      pan: { x: 0, y: 0 },
      past: [],
      future: [],
    });
  },

  selectPart: (partId) => set({ selectedPartId: partId }),
  setHoveredPart: (partId) => set({ hoveredPartId: partId }),

  upsertPartAnnotation: (annotation) =>
    set((state) => {
      const prevSnapshot: DraftSnapshot = {
        parts: cloneParts(state.draftParts),
        overallNotes: state.overallNotes,
      };
      const nextParts = cloneParts(state.draftParts);
      nextParts[annotation.partId] = {
        ...annotation,
        surfaces: annotation.surfaces ? [...annotation.surfaces] : undefined,
      };
      return {
        draftParts: nextParts,
        isDirty: true,
        past: [...state.past.slice(-24), prevSnapshot],
        future: [],
      };
    }),

  removePartAnnotation: (partId) =>
    set((state) => {
      if (!(partId in state.draftParts)) return state;
      const prevSnapshot: DraftSnapshot = {
        parts: cloneParts(state.draftParts),
        overallNotes: state.overallNotes,
      };
      const nextParts = cloneParts(state.draftParts);
      delete nextParts[partId];
      return {
        draftParts: nextParts,
        isDirty: true,
        past: [...state.past.slice(-24), prevSnapshot],
        future: [],
      };
    }),

  setActiveView: (viewId) => set({ activeViewId: viewId }),

  toggleLayer: (layerId) =>
    set((state) => {
      const exists = state.visibleLayerIds.includes(layerId);
      const next = exists
        ? state.visibleLayerIds.filter((id) => id !== layerId)
        : [...state.visibleLayerIds, layerId];
      return { visibleLayerIds: next.length > 0 ? next : [layerId] };
    }),

  setNumberingMode: (mode) => set({ numberingMode: mode }),

  toggleAnimations: () =>
    set((state) => ({ animationsEnabled: !state.animationsEnabled })),

  setZoom: (zoom) =>
    set({ zoom: Math.min(2.5, Math.max(0.75, Number(zoom.toFixed(2)))) }),

  setPan: (pan) => set({ pan }),

  resetViewport: () => set({ zoom: 1, pan: { x: 0, y: 0 } }),

  setOverallNotes: (overallNotes) =>
    set({ overallNotes, isDirty: true }),

  setShareWithPatient: (shareWithPatient) =>
    set({ shareWithPatient, isDirty: true }),

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const currentSnapshot: DraftSnapshot = {
        parts: cloneParts(state.draftParts),
        overallNotes: state.overallNotes,
      };
      return {
        draftParts: cloneParts(previous.parts),
        overallNotes: previous.overallNotes,
        past: state.past.slice(0, -1),
        future: [currentSnapshot, ...state.future.slice(0, 24)],
        isDirty: true,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const currentSnapshot: DraftSnapshot = {
        parts: cloneParts(state.draftParts),
        overallNotes: state.overallNotes,
      };
      return {
        draftParts: cloneParts(next.parts),
        overallNotes: next.overallNotes,
        past: [...state.past.slice(-24), currentSnapshot],
        future: state.future.slice(1),
        isDirty: true,
      };
    }),

  clearDirty: () => set({ isDirty: false }),

  getSerializedChartData: () => {
    const state = get();
    return {
      schemaVersion: 1,
      diagramKey: state.diagramKey,
      activeViewId: state.activeViewId,
      numberingMode: state.numberingMode,
      animationsEnabled: state.animationsEnabled,
      parts: cloneParts(state.draftParts),
    };
  },
}));
