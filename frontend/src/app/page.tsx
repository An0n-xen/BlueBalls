"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import {
  UploadCloud, FileText, Database, Sparkles, Loader2, BarChart2,
  Play, Share2, LayoutGrid, Plus, ChevronRight, ChevronLeft, Info, LayoutDashboard, GripVertical
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

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
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import ReactECharts from "echarts-for-react";

axios.defaults.baseURL = "http://localhost:8000/api/v1";

type ColumnDef = {
  name: string;
  type: string;
  description?: string;
};

type SuggestedChart = {
  id: string;
  query: string;
  sql_query: string;
  chart_spec: any;
};

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
  const [userQuery, setUserQuery] = useState("");
  const [generatedChart, setGeneratedChart] = useState<any>(null);
  const [generatedSql, setGeneratedSql] = useState<string | null>(null);
  
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
  const [isGeneratingChart, setIsGeneratingChart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI suggested query prompts (for "Suggested for you" section)
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [isFetchingPrompts, setIsFetchingPrompts] = useState(false);

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
      setGeneratedChart(null);
      setGeneratedSql(null);
      setUserQuery("");
      setRawData([]);
      setTotalRows(0);
      setPageIndex(0);
      setIsLoadingMore(false);
      setError(null);
    }
  }, []);

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

  const handleFetchSuggestedPrompts = async () => {
    if (!datasetId) return;
    setIsFetchingPrompts(true);
    setError(null);
    try {
      const resp = await axios.get(`/charts/suggest-queries?dataset_id=${datasetId}`);
      setSuggestedPrompts(resp.data.suggestions || []);
    } catch (err) {
      const e = err as any;
      setError(e.response?.data?.detail || "Failed to get suggestions");
    } finally {
      setIsFetchingPrompts(false);
    }
  };

  const handlePromptClick = async (prompt: string) => {
    if (!datasetId) return;
    setUserQuery(prompt);
    setIsGeneratingChart(true);
    setError(null);
    setGeneratedChart(null);
    setGeneratedSql(null);

    try {
      const resp = await axios.post("/charts/generate", {
        dataset_id: datasetId,
        user_query: prompt,
      });
      setGeneratedChart(resp.data.chart_spec);
      setGeneratedSql(resp.data.sql_query);
    } catch (err) {
      const e = err as any;
      setError(e.response?.data?.detail || "Failed to generate chart");
    } finally {
      setIsGeneratingChart(false);
    }
  };

  const handleGenerateChart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!datasetId || !userQuery.trim()) return;
    
    setIsGeneratingChart(true);
    setError(null);
    setGeneratedChart(null);
    setGeneratedSql(null);

    try {
      const resp = await axios.post("/charts/generate", {
        dataset_id: datasetId,
        user_query: userQuery
      });
      
      setGeneratedSql(resp.data.sql_query);
      const spec = resp.data.chart_spec?.chart_spec || resp.data.chart_spec;
      if (spec) {
        setGeneratedChart(spec);
      } else {
        setError("Generated query successfully, but failed to build charting options.");
      }
    } catch (err) {
      const e = err as any;
      setError(e.response?.data?.detail || "Failed to generate chart");
    } finally {
      setIsGeneratingChart(false);
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
                
                {/* Custom Query Builder Block */}
                <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-white/10 rounded-xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-sm">
                   <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(59,130,246,0.1),transparent_50%)]" />
                   <div className="relative z-10 grid gap-4">
                     <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <BarChart2 className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-white">Natural Language Builder</h2>
                          <p className="text-sm text-blue-200/60">Ask a question to generate a completely custom chart.</p>
                        </div>
                     </div>
                     <form onSubmit={handleGenerateChart} className="flex gap-3 mt-2">
                        <Input 
                          placeholder="e.g. 'Show me the top 5 reasons for admission by month'" 
                          value={userQuery}
                          onChange={(e) => setUserQuery(e.target.value)}
                          className="bg-black/50 border-white/10 text-white placeholder:text-white/30 h-12 flex-1 shadow-inner focus-visible:ring-blue-500/50"
                        />
                        <Button 
                          type="submit"
                          disabled={isGeneratingChart || !userQuery.trim()}
                          className="font-semibold h-12 px-6 transition-all bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                        >
                          {isGeneratingChart ? (
                            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating...</>
                          ) : (
                            <><Plus className="mr-2 w-5 h-5" /> Build Chart</>
                          )}
                        </Button>
                     </form>
                   </div>
                </div>

                {/* AI Generated Custom Chart Result */}
                {(generatedChart || generatedSql) && (
                  <Card className="border-blue-500/30 bg-black/40 backdrop-blur-md shadow-xl animate-in fade-in zoom-in-95">
                    <CardHeader className="border-b border-border/5 pb-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg text-blue-400 flex items-center gap-2">
                           {userQuery}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {generatedChart && (
                        <div className="w-full h-[500px] bg-transparent">
                          <ReactECharts 
                            option={getChartEnhancements(generatedChart)} 
                            style={{ height: '100%', width: '100%' }} 
                            theme="dark"
                          />
                        </div>
                      )}
                      {generatedSql && (
                        <Accordion type="single" collapsible className="w-full mt-4">
                          <AccordionItem value="sql" className="border-white/5">
                            <AccordionTrigger className="text-xs font-medium text-muted-foreground hover:text-white py-2">
                              Executed SQL Query
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="bg-black/60 border border-white/5 rounded-md p-3 mt-1">
                                <code className="text-blue-300/70 font-mono text-[11px] whitespace-pre-wrap">
                                  {generatedSql}
                                </code>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      )}
                    </CardContent>
                  </Card>
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
                {!suggestions && !generatedChart && !isFetchingSuggestions && (
                   <div className="h-[400px] rounded-xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-center p-8 opacity-50">
                      <BarChart2 className="w-12 h-12 text-white/20 mb-4" />
                      <h3 className="text-lg font-semibold text-white/50">Dashboard Empty</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        Use the Natural Language builder above or click "Auto-Generate Insights" to build your dashboard.
                      </p>
                   </div>
                )}

                {/* Suggested for You — Clickable Query Prompts */}
                {datasetId && (
                  <div className="pt-8 mt-4 border-t border-white/5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-white/90 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-400" />
                        Suggested for you
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleFetchSuggestedPrompts}
                        disabled={isFetchingPrompts}
                        className="text-xs text-white/40 hover:text-white/70"
                      >
                        {isFetchingPrompts ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh"}
                      </Button>
                    </div>
                    
                    {suggestedPrompts.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {suggestedPrompts.map((prompt, idx) => (
                          <button
                            key={idx}
                            onClick={() => handlePromptClick(prompt)}
                            disabled={isGeneratingChart}
                            className="group p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5 transition-all text-left"
                          >
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/15 transition-colors shrink-0">
                                <Sparkles className="w-4 h-4 text-blue-400" />
                              </div>
                              <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors line-clamp-2 leading-relaxed">
                                {prompt}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <Button
                          onClick={handleFetchSuggestedPrompts}
                          disabled={isFetchingPrompts}
                          variant="outline"
                          className="border-white/10 text-white/50 hover:text-white hover:bg-white/5"
                        >
                          {isFetchingPrompts ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2 text-amber-400" />}
                          Get Suggestions
                        </Button>
                      </div>
                    )}
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

        </div>
      </div>
    </div>
  );
}
