"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import {
  UploadCloud, FileText, Database, Sparkles, Loader2, BarChart2,
  Play, Share2, LayoutGrid, ChevronRight, LayoutDashboard, GripVertical, Target, Trash2,
  Search, Download
} from "lucide-react";
import { MetricKpiPanel } from "@/components/metric-kpi-panel";
import { RichTextBlock } from "@/components/rich-text-block";
import { GridPanel } from "@/components/grid-panel";
import { ImagePanel } from "@/components/image-panel";
import { HeaderPanel } from "@/components/header-panel";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import ReactECharts from "echarts-for-react";

axios.defaults.baseURL = "http://localhost:8000/api/v1";

type ColumnDef = {
  name: string;
  type: string;
  column_type?: string;
  description?: string;
};

type SuggestedChart = {
  id: string;
  query: string;
  sql_query: string;
  chart_spec: any;
};

type RichTextBlockData = {
  id: string;
  content: string;
};

type KpiCard = {
  id: string;
  kpi_column: string;
  aggregation: string;
  value: number | null;
  date_column: string | null;
  breakdown: { period: string; value: number }[] | null;
  label: string;
};

type DashboardBlock =
  | { type: "kpi"; id: string; data: KpiCard }
  | { type: "richtext"; id: string; data: RichTextBlockData }
  | { type: "grid"; id: string; data: GridBlockData }
  | { type: "image"; id: string; data: ImageBlockData }
  | { type: "header"; id: string; data: HeaderBlockData };

type ImageBlockData = {
  id: string;
  imageUrl: string;
  appearance: "fit" | "fill";
};

type HeaderBlockData = {
  id: string;
  title: string;
  description: string;
  textSize: "small" | "medium" | "large";
  textAlignment: "left" | "center" | "right";
  backgroundColor: string;
};

type GridBlockData = {
  id: string;
  columns: string[];
  rows: Record<string, any>[];
  sortColumn: string | null;
  sortDirection: "asc" | "desc";
  showSearchAndSorting: boolean;
  showDownloadButton: boolean;
  hideTitle: boolean;
  datasetName: string;
};

// Sortable wrapper for dashboard blocks
function SortableDashboardBlock({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : ('auto' as const),
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={`cursor-grab active:cursor-grabbing ${isDragging ? 'ring-2 ring-blue-500/30 shadow-2xl shadow-blue-900/20 rounded-xl' : ''}`}>
      {children}
    </div>
  );
}

function SortableChartCard({ chart, children }: { chart: SuggestedChart; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chart.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto' as const,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className={`border-blue-500/10 bg-black/40 backdrop-blur-md shadow-xl hover:border-blue-500/20 transition-all group relative cursor-grab active:cursor-grabbing ${isDragging ? 'ring-2 ring-blue-500/30 shadow-2xl shadow-blue-900/20' : ''}`}>
        <CardHeader className="border-b border-white/[0.03] pb-3 flex flex-row items-start justify-between gap-2">
          <CardTitle className="text-base text-white/90 font-medium leading-snug flex-1">
            {chart.query}
          </CardTitle>
          <GripVertical className="w-4 h-4 shrink-0 text-white/20" />
        </CardHeader>
        <CardContent className="pt-6">
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AnalysisDashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [schema, setSchema] = useState<ColumnDef[]>([]);
  const [datasetDescription, setDatasetDescription] = useState<string | null>(null);
  const [datasetRowCount, setDatasetRowCount] = useState<number | null>(null);
  const [datasetColumnCount, setDatasetColumnCount] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedChart[] | null>(null);

  
  // Data Tab State
  const [rawData, setRawData] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 50;
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const [isUploading, setIsUploading] = useState(false);
  const [isFetchingSchema, setIsFetchingSchema] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Metric & KPI Panel state
  const [isMetricPanelOpen, setIsMetricPanelOpen] = useState(false);
  const [isComputingKpi, setIsComputingKpi] = useState(false);

  // Grid Panel state
  const [isGridPanelOpen, setIsGridPanelOpen] = useState(false);

  // Image Panel state
  const [isImagePanelOpen, setIsImagePanelOpen] = useState(false);

  // Header Panel state
  const [isHeaderPanelOpen, setIsHeaderPanelOpen] = useState(false);

  // Global Filters state
  const [globalFilters, setGlobalFilters] = useState<Record<string, string[]>>({});

  // Unified dashboard blocks (KPI cards + Rich Text blocks) — ordered
  const [dashboardBlocks, setDashboardBlocks] = useState<DashboardBlock[]>([]);

  const dashboardBlockIds = useMemo(
    () => dashboardBlocks.map((b) => b.id),
    [dashboardBlocks]
  );

  // Listen for custom events from AddBlockPanel
  useEffect(() => {
    const handleMetricKpi = () => setIsMetricPanelOpen(true);
    const handleRichText = () => {
      const id = `rt-${Date.now()}`;
      setDashboardBlocks((prev) => [
        ...prev,
        { type: "richtext", id, data: { id, content: "" } },
      ]);
    };
    const handleGridPanel = () => setIsGridPanelOpen(true);
    const handleImagePanel = () => setIsImagePanelOpen(true);
    const handleHeaderPanel = () => setIsHeaderPanelOpen(true);
    window.addEventListener("open-metric-kpi", handleMetricKpi);
    window.addEventListener("add-rich-text-block", handleRichText);
    window.addEventListener("open-grid-panel", handleGridPanel);
    window.addEventListener("open-image-panel", handleImagePanel);
    window.addEventListener("open-header-panel", handleHeaderPanel);
    return () => {
      window.removeEventListener("open-metric-kpi", handleMetricKpi);
      window.removeEventListener("add-rich-text-block", handleRichText);
      window.removeEventListener("open-grid-panel", handleGridPanel);
      window.removeEventListener("open-image-panel", handleImagePanel);
      window.removeEventListener("open-header-panel", handleHeaderPanel);
    };
  }, []);

  // Listen for filter changes from FilterPanel
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setGlobalFilters(detail?.filters || {});
    };
    window.addEventListener("global-filters-changed", handler);
    return () => window.removeEventListener("global-filters-changed", handler);
  }, []);

  // Listen for charts generated from AI Chat
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.chart_spec) {
        const newChart: SuggestedChart = {
          id: `ai-chat-${Date.now()}`,
          query: detail.query || "AI Generated Chart",
          sql_query: detail.sql_query || "",
          chart_spec: detail.chart_spec,
        };
        setSuggestions((prev) => (prev ? [newChart, ...prev] : [newChart]));
      }
    };
    window.addEventListener("ai-chart-generated", handler);
    return () => window.removeEventListener("ai-chart-generated", handler);
  }, []);

  // Build filter context string for chart generation
  const buildFilterContext = useCallback(() => {
    const entries = Object.entries(globalFilters);
    if (entries.length === 0) return "";
    const clauses = entries.map(
      ([col, values]) => `"${col}" IN (${values.map((v) => `'${v}'`).join(", ")})`
    );
    return ` [IMPORTANT: Apply these filters: WHERE ${clauses.join(" AND ")}]`;
  }, [globalFilters]);

  // Re-generate existing charts when filters change
  const prevFiltersRef = React.useRef<Record<string, string[]>>({});
  useEffect(() => {
    // Skip initial mount
    const prevStr = JSON.stringify(prevFiltersRef.current);
    const currStr = JSON.stringify(globalFilters);
    if (prevStr === currStr) return;
    prevFiltersRef.current = globalFilters;

    if (!datasetId) return;

    const filterCtx = buildFilterContext();

    // Re-generate suggested charts
    if (suggestions && suggestions.length > 0) {
      const regenerate = async () => {
        const updated = await Promise.all(
          suggestions.map(async (chart) => {
            try {
              const resp = await axios.post("/charts/generate", {
                dataset_id: datasetId,
                user_query: chart.query + filterCtx,
              });
              const spec =
                resp.data.chart_spec?.chart_spec || resp.data.chart_spec;
              return { ...chart, chart_spec: spec || chart.chart_spec, sql_query: resp.data.sql_query || chart.sql_query };
            } catch {
              return chart; // keep original on error
            }
          })
        );
        setSuggestions(updated);
      };
      regenerate();
    }


  }, [globalFilters, datasetId, buildFilterContext]);

  const handleDashboardDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setDashboardBlocks((prev) => {
        const oldIndex = prev.findIndex((b) => b.id === active.id);
        const newIndex = prev.findIndex((b) => b.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          return arrayMove(prev, oldIndex, newIndex);
        }
        return prev;
      });
    }
  }, []);

  // Drag and drop sensors for chart reordering
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const suggestionIds = useMemo(
    () => suggestions?.map((s) => s.id) ?? [],
    [suggestions]
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && suggestions) {
      const oldIndex = suggestions.findIndex((s) => s.id === active.id);
      const newIndex = suggestions.findIndex((s) => s.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        setSuggestions(arrayMove(suggestions, oldIndex, newIndex));
      }
    }
  }, [suggestions]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setDatasetId(null);
      setSchema([]);
      setDatasetDescription(null);
      setDatasetRowCount(null);
      setDatasetColumnCount(null);
      setSuggestions(null);
      setRawData([]);
      setTotalRows(0);
      setPageIndex(0);
      setIsLoadingMore(false);
      setError(null);
      setDashboardBlocks([]);
    }
  }, []);

  const handleRichTextChange = (id: string, html: string) => {
    setDashboardBlocks((prev) =>
      prev.map((b) =>
        b.type === "richtext" && b.id === id
          ? { ...b, data: { ...b.data, content: html } }
          : b
      )
    );
  };

  const handleRemoveBlock = (id: string) => {
    setDashboardBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleAddKpi = async (kpi: KpiCard) => {
    if (!datasetId) return;
    setIsComputingKpi(true);
    setError(null);
    try {
      const resp = await axios.post(`/dataset/${datasetId}/kpi`, {
        dataset_id: datasetId,
        kpi_column: kpi.kpi_column,
        aggregation: kpi.aggregation,
        date_column: kpi.date_column,
      });
      const computedKpi: KpiCard = {
        ...kpi,
        value: resp.data.value,
        breakdown: resp.data.breakdown,
      };
      setDashboardBlocks((prev) => [
        ...prev,
        { type: "kpi", id: computedKpi.id, data: computedKpi },
      ]);
      setIsMetricPanelOpen(false);
    } catch (err) {
      const e = err as any;
      setError(e.response?.data?.detail || "Failed to compute KPI");
    } finally {
      setIsComputingKpi(false);
    }
  };


  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await axios.post("/dataset/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const returnedId = resp.data.dataset_id;
      setDatasetId(returnedId);
      await fetchSchema(returnedId);
      await fetchRawData(returnedId, 0);
      // Broadcast dataset info so FilterPanel knows the active dataset
      window.dispatchEvent(
        new CustomEvent("dataset-info", {
          detail: { datasetId: returnedId, datasetName: file?.name || "" },
        })
      );
    } catch (err) {
      const e = err as any;
      setError(e.response?.data?.detail || e.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const fetchSchema = async (id: string) => {
    setIsFetchingSchema(true);
    try {
      const resp = await axios.get(`/dataset/${id}/schema`);
      setSchema(resp.data.columns);
      setDatasetDescription(resp.data.description);
      setDatasetRowCount(resp.data.row_count);
      setDatasetColumnCount(resp.data.column_count);
    } catch (err) {
      const e = err as any;
      setError(e.response?.data?.detail || "Failed to fetch schema");
    } finally {
      setIsFetchingSchema(false);
    }
  };

  const fetchRawData = async (id: string, page: number, append = false) => {
    if (append) setIsLoadingMore(true);
    else setIsFetchingData(true);
    try {
      const resp = await axios.get(`/dataset/${id}/data?limit=${pageSize}&offset=${page * pageSize}`);
      if (append) {
        setRawData(prev => [...prev, ...resp.data.data]);
      } else {
        setRawData(resp.data.data);
      }
      setTotalRows(resp.data.total);
      setPageIndex(page);
    } catch (err) {
      const e = err as any;
      setError(e.response?.data?.detail || "Failed to fetch data");
    } finally {
      setIsFetchingData(false);
      setIsLoadingMore(false);
    }
  };

  const handleSuggestCharts = async () => {
    if (!datasetId) return;
    setIsFetchingSuggestions(true);
    setError(null);
    try {
      const resp = await axios.get(`/charts/suggest?dataset_id=${datasetId}`);
      const withIds = (resp.data.suggestions || []).map((s: any, i: number) => ({
        ...s,
        id: `chart-${i}-${Date.now()}`,
      }));
      setSuggestions(withIds);
    } catch (err) {
      const e = err as any;
      setError(e.response?.data?.detail || "Failed to get chart suggestions");
    } finally {
      setIsFetchingSuggestions(false);
    }
  };



  // Theme-matching color palette for charts (blues, teals, purples — no clashing greens/yellows)
  const chartColorPalette = [
    '#60a5fa', // blue-400
    '#a78bfa', // violet-400
    '#34d399', // emerald-400
    '#f472b6', // pink-400
    '#38bdf8', // sky-400
    '#c084fc', // purple-400
    '#2dd4bf', // teal-400
    '#fb923c', // orange-400
    '#818cf8', // indigo-400
    '#22d3ee', // cyan-400
  ];

  const getChartEnhancements = (spec: any) => {
    const enhanceAxis = (axis: any) => ({
      ...axis,
      splitLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      axisLabel: {
        ...axis?.axisLabel,
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        fontFamily: 'inherit',
      },
      nameTextStyle: {
        ...axis?.nameTextStyle,
        fontSize: 13,
        color: 'rgba(255,255,255,0.6)',
        fontFamily: 'inherit',
      },
    });

    return {
      ...spec,
      backgroundColor: 'transparent',
      color: chartColorPalette,
      textStyle: {
        fontFamily: 'inherit',
        color: 'rgba(255,255,255,0.8)',
      },
      title: spec.title ? {
        ...spec.title,
        textStyle: {
          ...spec.title?.textStyle,
          fontSize: 16,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.9)',
          fontFamily: 'inherit',
        },
        subtextStyle: {
          ...spec.title?.subtextStyle,
          fontSize: 12,
          color: 'rgba(255,255,255,0.45)',
          fontFamily: 'inherit',
        },
      } : undefined,
      legend: spec.legend ? {
        ...spec.legend,
        textStyle: {
          ...spec.legend?.textStyle,
          fontSize: 13,
          color: 'rgba(255,255,255,0.7)',
          fontFamily: 'inherit',
        },
        itemWidth: 14,
        itemHeight: 10,
        itemGap: 16,
      } : undefined,
      tooltip: {
        ...spec.tooltip,
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: {
          color: 'rgba(255,255,255,0.9)',
          fontSize: 13,
          fontFamily: 'inherit',
        },
      },
      grid: {
        ...spec.grid,
        show: true,
        borderColor: 'rgba(255,255,255,0.05)',
        containLabel: true,
      },
      xAxis: spec.xAxis ? (Array.isArray(spec.xAxis) ? spec.xAxis.map(enhanceAxis) : enhanceAxis(spec.xAxis)) : undefined,
      yAxis: spec.yAxis ? (Array.isArray(spec.yAxis) ? spec.yAxis.map(enhanceAxis) : enhanceAxis(spec.yAxis)) : undefined,
    }
  }

  const formatColumnName = (name: string) => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-950 font-sans text-foreground selection:bg-primary/30">
      
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-border/10 flex items-center justify-between px-4 bg-zinc-950/50 backdrop-blur-md shrink-0 z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <div className="h-4 w-[1px] bg-border/20" />
          <h1 className="font-semibold text-sm drop-shadow-sm flex items-center gap-2">
            {file ? file.name.replace(".csv", "").replace(".xlsx", "") : "Untitled Analysis"}
            {datasetId && <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] h-5 px-1.5 ml-1">Connected</Badge>}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs border-white/10 bg-transparent hover:bg-white/5">
            <Play className="w-3.5 h-3.5 mr-1.5" /> Save
          </Button>
          <Button size="sm" className="h-8 text-xs bg-white text-black hover:bg-zinc-200">
            <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share Board
          </Button>
        </div>
      </header>

      {/* Main Scrollable Area */}
      <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 bg-zinc-950">
        <div className="max-w-screen-2xl mx-auto space-y-6">
          
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-top-2">
              Warning: {error}
            </div>
          )}

          {!datasetId ? (
             <div className="h-[calc(100vh-12rem)] flex items-center justify-center">
                <Card className="w-full max-w-md border-blue-500/15 bg-black/40 backdrop-blur-md shadow-2xl shadow-blue-950/20 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-blue-500/[0.03] to-transparent pointer-events-none" />
                  <CardHeader className="text-center pb-2 relative z-10">
                    <CardTitle className="text-xl">Connect Dataset</CardTitle>
                    <CardDescription>Upload a CSV or Excel file to begin analyzing.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 flex flex-col gap-4 relative z-10">
                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ease-out group ${
                        isDragActive ? "border-blue-500 bg-blue-500/5 scale-[1.02]" : "border-white/10 hover:border-blue-500/40 hover:bg-blue-500/[0.02]"
                      }`}
                    >
                      <input {...getInputProps()} />
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="p-3 bg-blue-500/10 rounded-full group-hover:bg-blue-500/15 transition-colors">
                          <UploadCloud className={`w-8 h-8 ${isDragActive ? "text-blue-400 transition-colors" : "text-blue-400/60 group-hover:text-blue-400 transition-colors"}`} />
                        </div>
                        {file ? (
                          <div className="flex flex-col items-center">
                            <span className="font-medium text-white break-all text-sm">{file.name}</span>
                            <span className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(1)} KB</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="text-sm font-medium text-white transition-colors group-hover:text-blue-300">Click or drag file</span>
                            <span className="text-xs text-muted-foreground mt-1">Supports .csv, .xls, .xlsx</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={handleUpload}
                      disabled={!file || isUploading}
                      className="w-full font-semibold transition-all bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/25"
                    >
                      {isUploading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ingesting Data...</>
                      ) : (
                        "Initialize Dataset"
                      )}
                    </Button>
                  </CardContent>
                </Card>
             </div>
          ) : (
            <Tabs defaultValue="dashboard" className="w-full">
              <div className="flex items-center justify-between mb-6">
                <TabsList className="bg-white/5 border border-white/10">
                  <TabsTrigger value="dashboard" className="data-[state=active]:bg-blue-500/15 data-[state=active]:text-blue-300">
                    <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
                  </TabsTrigger>
                  <TabsTrigger value="data" className="data-[state=active]:bg-blue-500/15 data-[state=active]:text-blue-300">
                    <Database className="w-4 h-4 mr-2" /> View Data
                  </TabsTrigger>
                </TabsList>
                
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-9 border-white/10 bg-black hover:bg-white/5" onClick={handleSuggestCharts} disabled={isFetchingSuggestions}>
                     {isFetchingSuggestions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 w-4 h-4 text-amber-400" />}
                     Auto-Generate Insights
                  </Button>
                </div>
              </div>

              {/* DASHBOARD TAB */}
              <TabsContent value="dashboard" className="focus-visible:outline-none space-y-6">

                {/* Sortable Dashboard Blocks (KPI + Rich Text) */}
                {dashboardBlocks.length > 0 && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDashboardDragEnd}
                  >
                    <SortableContext items={dashboardBlockIds} strategy={verticalListSortingStrategy}>
                      <div className="space-y-4">
                        {dashboardBlocks.map((block) => (
                          <SortableDashboardBlock key={block.id} id={block.id}>
                            {block.type === "kpi" ? (() => {
                              const kpi = block.data;
                              return (
                                <Card className="border-blue-500/10 bg-black/40 backdrop-blur-md shadow-xl hover:border-blue-500/20 transition-all group relative overflow-hidden">
                                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.04] to-purple-500/[0.02] pointer-events-none" />
                                  <CardContent className="pt-5 pb-4 px-5 relative z-10">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-lg bg-blue-500/10">
                                          <Target className="w-3.5 h-3.5 text-blue-400" />
                                        </div>
                                        <span className="text-xs font-medium text-white/40 uppercase tracking-wider">{kpi.aggregation}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <GripVertical className="w-4 h-4 text-white/20" />
                                        <button
                                          onClick={() => handleRemoveBlock(kpi.id)}
                                          className="opacity-0 group-hover:opacity-100 transition-opacity text-white/20 hover:text-red-400 p-1"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="text-3xl font-bold text-white tracking-tight mb-1">
                                      {kpi.value != null ? Number(kpi.value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                                    </div>
                                    <p className="text-sm text-white/50 font-medium">{kpi.label}</p>
                                    {kpi.date_column && kpi.breakdown && kpi.breakdown.length > 0 && (
                                      <div className="mt-3 pt-3 border-t border-white/5">
                                        <span className="text-[10px] text-white/30 uppercase tracking-wider">Grouped by {formatColumnName(kpi.date_column)}</span>
                                        <div className="flex items-end gap-[2px] mt-2 h-8">
                                          {kpi.breakdown.slice(0, 20).map((b, i) => {
                                            const max = Math.max(...kpi.breakdown!.map((x) => Number(x.value) || 0));
                                            const pct = max > 0 ? (Number(b.value) / max) * 100 : 0;
                                            return (
                                              <div
                                                key={i}
                                                className="flex-1 bg-blue-500/30 rounded-sm min-w-[3px] transition-all hover:bg-blue-400/50"
                                                style={{ height: `${Math.max(pct, 4)}%` }}
                                                title={`${b.period}: ${b.value}`}
                                              />
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              );
                            })() : block.type === "richtext" ? (
                              <RichTextBlock
                                id={block.id}
                                initialContent={block.data.content}
                                onContentChange={handleRichTextChange}
                                onRemove={handleRemoveBlock}
                              />
                            ) : block.type === "grid" ? (() => {
                              const grid = block.data;
                              const GridBlockInner = () => {
                                const [searchTerm, setSearchTerm] = React.useState("");
                                const filteredRows = searchTerm
                                  ? grid.rows.filter((row) =>
                                      grid.columns.some((col) =>
                                        String(row[col] ?? "").toLowerCase().includes(searchTerm.toLowerCase())
                                      )
                                    )
                                  : grid.rows;

                                const handleDownload = () => {
                                  const header = grid.columns.map((c) => formatColumnName(c)).join(",");
                                  const csvRows = filteredRows.map((row) =>
                                    grid.columns.map((c) => {
                                      const val = String(row[c] ?? "");
                                      return val.includes(",") ? `"${val}"` : val;
                                    }).join(",")
                                  );
                                  const csv = [header, ...csvRows].join("\n");
                                  const blob = new Blob([csv], { type: "text/csv" });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = `${grid.datasetName || "grid"}_export.csv`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                };

                                return (
                                  <Card className="border-blue-500/10 bg-black/40 backdrop-blur-md shadow-xl hover:border-blue-500/20 transition-all group relative overflow-hidden">
                                    {/* Title bar */}
                                    {!grid.hideTitle && (
                                      <CardHeader className="border-b border-white/[0.03] pb-3 flex flex-row items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <LayoutGrid className="w-4 h-4 text-blue-400" />
                                          <CardTitle className="text-base text-white/90 font-medium">
                                            {grid.datasetName || "Data Grid"}
                                          </CardTitle>
                                          <span className="text-xs text-white/30">{filteredRows.length} rows</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <GripVertical className="w-4 h-4 text-white/20" />
                                          <button
                                            onClick={() => handleRemoveBlock(block.id)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-white/20 hover:text-red-400 p-1"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </CardHeader>
                                    )}
                                    <CardContent className={`${grid.hideTitle ? 'pt-4' : 'pt-3'} pb-3 px-4 space-y-3`}>
                                      {/* Search + Download bar */}
                                      {(grid.showSearchAndSorting || grid.showDownloadButton) && (
                                        <div className="flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
                                          {grid.showSearchAndSorting && (
                                            <div className="relative flex-1">
                                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                                              <input
                                                type="text"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                placeholder="Search..."
                                                className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white/80 placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/30"
                                              />
                                            </div>
                                          )}
                                          {grid.showDownloadButton && (
                                            <button
                                              onClick={handleDownload}
                                              className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
                                              title="Download CSV"
                                            >
                                              <Download className="w-4 h-4" />
                                            </button>
                                          )}
                                        </div>
                                      )}
                                      {/* Data Table */}
                                      <div className="overflow-auto max-h-[350px] rounded-lg border border-white/[0.06]" onPointerDown={(e) => e.stopPropagation()}>
                                        <table className="w-full text-sm">
                                          <thead className="sticky top-0 z-10">
                                            <tr className="bg-white/[0.04]">
                                              {grid.columns.map((col) => (
                                                <th key={col} className="px-3 py-2 text-left text-xs font-semibold text-white/50 uppercase tracking-wider whitespace-nowrap border-b border-white/[0.06]">
                                                  {formatColumnName(col)}
                                                </th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {filteredRows.slice(0, 50).map((row, i) => (
                                              <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                                {grid.columns.map((col) => (
                                                  <td key={col} className="px-3 py-2 text-white/70 whitespace-nowrap text-xs">
                                                    {row[col] != null ? String(row[col]) : <span className="text-white/20">—</span>}
                                                  </td>
                                                ))}
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                        {filteredRows.length > 50 && (
                                          <div className="text-center py-2 text-xs text-white/30 bg-white/[0.02]">
                                            Showing 50 of {filteredRows.length} rows
                                          </div>
                                        )}
                                      </div>
                                      {grid.hideTitle && (
                                        <div className="flex justify-end" onPointerDown={(e) => e.stopPropagation()}>
                                          <button
                                            onClick={() => handleRemoveBlock(block.id)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-white/20 hover:text-red-400 p-1"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                );
                              };
                              return <GridBlockInner />;
                            })() : block.type === "image" ? (() => {
                              const img = block.data;
                              return (
                                <Card className="border-blue-500/10 bg-black/40 backdrop-blur-md shadow-xl hover:border-blue-500/20 transition-all group relative overflow-hidden">
                                  <div className="relative">
                                    <img
                                      src={img.imageUrl}
                                      alt="Dashboard image"
                                      className={`w-full ${img.appearance === "fill" ? "h-48 object-cover" : "max-h-56 object-cover"}`}
                                    />
                                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <GripVertical className="w-4 h-4 text-white/40" />
                                      <button
                                        onClick={() => handleRemoveBlock(block.id)}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        className="p-1 rounded bg-black/50 backdrop-blur-sm text-white/40 hover:text-red-400 transition-colors"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </Card>
                              );
                            })() : block.type === "header" ? (() => {
                              const hdr = block.data;
                              const sizeClass = hdr.textSize === "small" ? "text-xl" : hdr.textSize === "large" ? "text-4xl" : "text-2xl";
                              const alignClass = hdr.textAlignment === "left" ? "text-left" : hdr.textAlignment === "right" ? "text-right" : "text-center";
                              return (
                                <div className={`bg-gradient-to-r ${hdr.backgroundColor} rounded-xl px-8 py-8 group relative overflow-hidden shadow-xl`}>
                                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.05),transparent_50%)]" />
                                  <div className={`relative z-10 ${alignClass}`}>
                                    <h2 className={`${sizeClass} font-bold text-white tracking-tight`}>{hdr.title}</h2>
                                    {hdr.description && (
                                      <p className={`mt-2 text-white/60 ${hdr.textSize === "small" ? "text-sm" : "text-base"} max-w-2xl ${hdr.textAlignment === "center" ? "mx-auto" : ""}`}>
                                        {hdr.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <GripVertical className="w-4 h-4 text-white/40" />
                                    <button
                                      onClick={() => handleRemoveBlock(block.id)}
                                      onPointerDown={(e) => e.stopPropagation()}
                                      className="p-1 rounded bg-black/30 backdrop-blur-sm text-white/40 hover:text-red-400 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })() : null}
                          </SortableDashboardBlock>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
                


                {/* Grid of Recommended Charts — Draggable */}
                {suggestions && suggestions.length > 0 && (
                   <div className="pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-white/90 flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-amber-400" />
                          Suggested Insights
                        </h3>
                        <span className="text-xs text-white/30">Drag to reorder</span>
                      </div>
                      
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={suggestionIds} strategy={rectSortingStrategy}>
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            {suggestions.map((chart) => (
                              <SortableChartCard key={chart.id} chart={chart}>
                                <div className="w-full h-[450px]">
                                  <ReactECharts
                                    option={getChartEnhancements(chart.chart_spec)}
                                    style={{ height: '100%', width: '100%' }}
                                    theme="dark"
                                  />
                                </div>
                              </SortableChartCard>
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                   </div>
                )}
                
                {/* Empty state for Dashboard when dataset is loaded but no charts exist */}
                {!suggestions && !isFetchingSuggestions && (
                   <div className="h-[400px] rounded-xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-center p-8 opacity-50">
                      <BarChart2 className="w-12 h-12 text-white/20 mb-4" />
                      <h3 className="text-lg font-semibold text-white/50">Dashboard Empty</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        Use the AI Chat in the sidebar or click &quot;Auto-Generate Insights&quot; to build your dashboard.
                      </p>
                   </div>
                )}


              </TabsContent>

              {/* DATA TAB */}
              <TabsContent value="data" className="focus-visible:outline-none">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full flex-1">
                  
                  {/* Left: Main Data Table */}
                  <div className="xl:col-span-8 flex flex-col gap-4">
                     <Card className="border-blue-500/10 bg-[#09090b] shadow-2xl overflow-hidden flex flex-col h-[calc(100vh-14rem)] rounded-xl relative">
                       <div className="h-4 px-5 flex items-center shrink-0">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-400/60" />
                            <span className="text-sm font-semibold text-white/90 tracking-wide">
                              {file?.name || 'Dataset'}
                            </span>
                          </div>
                        </div>
                       <CardContent className="p-0 flex-1 overflow-hidden relative">
                         {isFetchingData && (
                            <div className="absolute inset-0 bg-black/50 z-20 backdrop-blur-[1px] flex items-center justify-center">
                              <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                         )}
                         <div 
                           className="h-[calc(100vh-14rem-6rem)] w-full overflow-auto bg-black/20 rounded-b-xl border-t-0 p-0 relative"
                           onScroll={(e) => {
                             const target = e.currentTarget;
                             if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
                               if (!isLoadingMore && !isFetchingData && rawData.length < totalRows && datasetId) {
                                 fetchRawData(datasetId, pageIndex + 1, true);
                               }
                             }
                           }}
                         >
                           <table className="text-xs w-full max-w-none relative border-collapse text-left">
                               <thead className="bg-[#09090b]/90 backdrop-blur-md sticky top-0 z-30 shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
                                 <tr className="border-white/5 hover:bg-transparent bg-transparent">
                                   <th className="font-semibold text-white/50 w-[50px] min-w-[50px] text-center sticky left-0 top-0 bg-[#09090b]/90 backdrop-blur-xl z-40 border-r border-white/5 border-b border-white/[0.05] p-3">
                                     #
                                   </th>
                                   {schema.map((col, idx) => (
                                     <th key={idx} className="font-semibold text-white/90 whitespace-nowrap min-w-[180px] bg-[#09090b]/90 backdrop-blur-xl sticky top-0 z-30 border-b border-white/[0.05] p-3 align-bottom transition-colors hover:bg-white/[0.02]">
                                       <div className="flex flex-col gap-1.5 py-1">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[13px] tracking-tight">{formatColumnName(col.name)}</span>
                                            <span className="h-5 px-1.5 flex items-center justify-center rounded-full text-[9px] font-mono tracking-wider border border-blue-500/15 bg-blue-500/5 text-blue-300/60 whitespace-nowrap overflow-hidden">
                                              {col.type}
                                            </span>
                                          </div>
                                          {col.description && (
                                            <span className="text-[11px] text-muted-foreground/50 font-normal max-w-xs truncate block">
                                              {col.description}
                                            </span>
                                          )}
                                       </div>
                                     </th>
                                   ))}
                                 </tr>
                               </thead>
                               <tbody>
                                 {rawData.map((row, rowIdx) => (
                                   <tr key={rowIdx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                     <td className="font-mono text-muted-foreground/60 w-[50px] min-w-[50px] text-center sticky left-0 bg-[#09090b]/90 z-20 backdrop-blur-xl border-r border-white/5 font-semibold text-xs border-b border-transparent p-3 align-middle">
                                       {rowIdx + 1}
                                     </td>
                                     {schema.map((col, colIdx) => (
                                        <td key={colIdx} className="text-white/80 whitespace-nowrap overflow-hidden text-ellipsis max-w-[280px] p-3 align-middle text-sm" title={String(row[col.name])}>
                                          {row[col.name] === null ? (
                                             <span className="opacity-30 italic text-xs">null</span>
                                          ) : (
                                             <span className={['INTEGER', 'FLOAT', 'DOUBLE', 'NUMBER'].includes(col.type.toUpperCase()) ? "font-mono text-white/60 text-xs" : "font-sans tracking-wide"}>
                                               {String(row[col.name])}
                                             </span>
                                          )}
                                        </td>
                                     ))}
                                 </tr>
                               ))}
                               {rawData.length === 0 && !isFetchingData && (
                                  <tr>
                                    <td colSpan={schema.length + 1} className="h-24 text-center align-middle p-4">
                                      No data found.
                                    </td>
                                  </tr>
                               )}
                               {isLoadingMore && (
                                 <tr>
                                   <td colSpan={schema.length + 1} className="text-center p-4">
                                     <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
                                   </td>
                                 </tr>
                               )}
                             </tbody>
                           </table>
                         </div>
                       </CardContent>
                     </Card>
                  </div>

                  {/* Right: Schema Outline */}
                  <div className="xl:col-span-4">
                     <Card className="border-blue-500/10 bg-[#09090b] text-white shadow-xl h-[calc(100vh-14rem)] flex flex-col rounded-xl overflow-hidden relative">
                       <CardHeader className="p-4 border-b border-white/[0.03] bg-transparent shrink-0 flex flex-row items-center justify-between">
                          <div className="flex items-center gap-2">
                            <LayoutGrid className="w-4 h-4 text-blue-400/60" />
                            <CardTitle className="text-sm font-semibold tracking-wide text-white/90">Schema Summary</CardTitle>
                         </div>
                         <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/70 hover:bg-white/5 hover:text-white rounded-full">
                           <Play className="w-3 h-3" /> {/* Replace with cross icon if desired */}
                         </Button>
                       </CardHeader>
                       <CardContent className="p-0 flex-1 overflow-hidden relative">
                          <ScrollArea className="h-[calc(100vh-14rem-64px)] overflow-y-auto">
                            <div className="flex flex-col">
                              {/* AI Overview Header */}
                              {datasetDescription && (
                                <div className="p-5 border-b border-white/[0.03]">
                                  <p className="text-[13px] leading-relaxed text-white/80 font-medium">
                                    {datasetDescription}
                                  </p>
                                  <div className="flex items-center gap-12 mt-6">
                                    <div className="flex flex-col gap-1.5">
                                      <span className="text-[11px] text-muted-foreground/60 font-medium tracking-wide">Rows</span>
                                      <div className="flex items-center gap-2 text-white/90">
                                        <LayoutGrid className="w-3.5 h-3.5 opacity-50" />
                                        <span className="text-sm font-semibold tracking-tight">{datasetRowCount?.toLocaleString() || '0'}</span>
                                      </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                      <span className="text-[11px] text-muted-foreground/60 font-medium tracking-wide">Columns</span>
                                      <div className="flex items-center gap-2 text-white/90">
                                        <LayoutGrid className="w-3.5 h-3.5 opacity-50" />
                                        <span className="text-sm font-semibold tracking-tight">{datasetColumnCount?.toLocaleString() || '0'}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {schema.map((col, idx) => (
                                <div key={idx} className="p-5 border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors flex flex-col gap-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                      <span className="font-semibold text-[13px] text-white/90 tracking-tight">{formatColumnName(col.name)}</span>
                                      <Badge variant="outline" className="text-[10px] py-0 px-2 h-5 border-blue-500/15 text-blue-300/60 bg-blue-500/5 rounded-full font-medium tracking-wider">
                                        {col.type === "TIMESTAMP" || col.type.includes("TIME") ? "Date" : col.type === "INTEGER" || col.type === "FLOAT" || col.type === "DOUBLE PRECISION" ? "Number" : "String"}
                                      </Badge>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-white/20 rotate-90" />
                                  </div>
                                  <p className="text-[12px] text-muted-foreground/60 leading-relaxed pr-6 max-w-sm mt-0.5">
                                    {col.description || <span className="italic opacity-30">No description available</span>}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                       </CardContent>
                     </Card>
                  </div>

                </div>
              </TabsContent>

            </Tabs>
          )}

          {/* Metric & KPI Panel */}
          <MetricKpiPanel
            open={isMetricPanelOpen}
            onClose={() => setIsMetricPanelOpen(false)}
            schema={schema}
            datasetId={datasetId}
            fileName={file?.name || null}
            onAddKpi={handleAddKpi}
            isComputing={isComputingKpi}
          />

          {/* Grid Panel */}
          <GridPanel
            isOpen={isGridPanelOpen}
            onClose={() => setIsGridPanelOpen(false)}
            columns={schema}
            datasetName={file?.name || ""}
            onAddGrid={async (config) => {
              if (!datasetId) return;
              try {
                const resp = await axios.get(`/dataset/${datasetId}/data`, {
                  params: { limit: 100, offset: 0 },
                });
                let rows: Record<string, any>[] = resp.data.data;
                // Filter to selected columns
                const cols = config.selectedColumns;
                rows = rows.map((row) => {
                  const filtered: Record<string, any> = {};
                  cols.forEach((c) => { filtered[c] = row[c]; });
                  return filtered;
                });
                // Sort if specified
                if (config.sortColumn) {
                  const sc = config.sortColumn;
                  const dir = config.sortDirection === "asc" ? 1 : -1;
                  rows.sort((a, b) => {
                    const va = a[sc], vb = b[sc];
                    if (va == null && vb == null) return 0;
                    if (va == null) return dir;
                    if (vb == null) return -dir;
                    if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
                    return String(va).localeCompare(String(vb)) * dir;
                  });
                }
                const id = `grid-${Date.now()}`;
                setDashboardBlocks((prev) => [
                  ...prev,
                  {
                    type: "grid",
                    id,
                    data: {
                      id,
                      columns: cols,
                      rows,
                      sortColumn: config.sortColumn,
                      sortDirection: config.sortDirection,
                      showSearchAndSorting: config.showSearchAndSorting,
                      showDownloadButton: config.showDownloadButton,
                      hideTitle: config.hideTitle,
                      datasetName: file?.name || "",
                    },
                  },
                ]);
                setIsGridPanelOpen(false);
              } catch (err) {
                console.error("Failed to fetch grid data:", err);
              }
            }}
          />

          {/* Image Panel */}
          <ImagePanel
            isOpen={isImagePanelOpen}
            onClose={() => setIsImagePanelOpen(false)}
            onAddImage={(config) => {
              const id = `img-${Date.now()}`;
              setDashboardBlocks((prev) => [
                ...prev,
                {
                  type: "image",
                  id,
                  data: {
                    id,
                    imageUrl: config.imageUrl,
                    appearance: config.appearance,
                  },
                },
              ]);
              setIsImagePanelOpen(false);
            }}
          />

          {/* Header Panel */}
          <HeaderPanel
            isOpen={isHeaderPanelOpen}
            onClose={() => setIsHeaderPanelOpen(false)}
            onAddHeader={(config) => {
              const id = `hdr-${Date.now()}`;
              setDashboardBlocks((prev) => [
                ...prev,
                {
                  type: "header",
                  id,
                  data: {
                    id,
                    title: config.title,
                    description: config.description,
                    textSize: config.textSize,
                    textAlignment: config.textAlignment,
                    backgroundColor: config.backgroundColor,
                  },
                },
              ]);
              setIsHeaderPanelOpen(false);
            }}
          />

        </div>
      </div>
    </div>
  );
}
