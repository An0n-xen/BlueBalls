"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { 
  UploadCloud, FileText, Database, Sparkles, Loader2, BarChart2, 
  Play, Share2, LayoutGrid, Plus, ChevronRight, ChevronLeft, Info, LayoutDashboard
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

import ReactECharts from "echarts-for-react";

axios.defaults.baseURL = "http://localhost:8000/api/v1";

type ColumnDef = {
  name: string;
  type: string;
  description?: string;
};

type SuggestedChart = {
  query: string;
  sql_query: string;
  chart_spec: any;
};

export default function AnalysisDashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [schema, setSchema] = useState<ColumnDef[]>([]);
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

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setDatasetId(null);
      setSchema([]);
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
      setSuggestions(resp.data.suggestions);
    } catch (err) {
      const e = err as any;
      setError(e.response?.data?.detail || "Failed to get chart suggestions");
    } finally {
      setIsFetchingSuggestions(false);
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

  const getChartEnhancements = (spec: any) => {
    // Inject dark mode grid lines and larger fonts into the auto-generated spec
    return {
      ...spec,
      backgroundColor: 'transparent',
      textStyle: { fontFamily: 'inherit' },
      grid: {
        ...spec.grid,
        show: true,
        borderColor: 'rgba(255,255,255,0.05)',
      },
      xAxis: spec.xAxis ? (Array.isArray(spec.xAxis) ? spec.xAxis.map((x: any) => ({...x, splitLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.05)' } }})) : {...spec.xAxis, splitLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.05)' } }}) : undefined,
      yAxis: spec.yAxis ? (Array.isArray(spec.yAxis) ? spec.yAxis.map((y: any) => ({...y, splitLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.05)' } }})) : {...spec.yAxis, splitLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.05)' } }}) : undefined,
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
          <SidebarTrigger className="text-muted-foreground hover:text-white transition-colors" />
          <div className="h-4 w-[1px] bg-border/20" />
          <h1 className="font-semibold text-sm drop-shadow-sm flex items-center gap-2">
            {file ? file.name.replace(".csv", "").replace(".xlsx", "") : "Untitled Analysis"}
            {datasetId && <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] h-5 px-1.5 ml-1">Connected</Badge>}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs border-white/10 bg-transparent hover:bg-white/5">
            <Play className="w-3.5 h-3.5 mr-1.5" /> Present
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
                <Card className="w-full max-w-md border-white/10 bg-black/40 backdrop-blur-md shadow-2xl">
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl">Connect Dataset</CardTitle>
                    <CardDescription>Upload a CSV or Excel file to begin analyzing.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 flex flex-col gap-4">
                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ease-out group ${
                        isDragActive ? "border-primary bg-primary/5 scale-[1.02]" : "border-white/10 hover:border-primary/50 hover:bg-white/[0.02]"
                      }`}
                    >
                      <input {...getInputProps()} />
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="p-3 bg-white/5 rounded-full group-hover:bg-primary/10 transition-colors">
                          <UploadCloud className={`w-8 h-8 ${isDragActive ? "text-primary transition-colors" : "text-muted-foreground group-hover:text-primary transition-colors"}`} />
                        </div>
                        {file ? (
                          <div className="flex flex-col items-center">
                            <span className="font-medium text-white break-all text-sm">{file.name}</span>
                            <span className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(1)} KB</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="text-sm font-medium text-white transition-colors group-hover:text-primary">Click or drag file</span>
                            <span className="text-xs text-muted-foreground mt-1">Supports .csv, .xls, .xlsx</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button 
                      onClick={handleUpload} 
                      disabled={!file || isUploading}
                      className="w-full font-semibold transition-all bg-white text-black hover:bg-zinc-200"
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
                  <TabsTrigger value="dashboard" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
                    <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
                  </TabsTrigger>
                  <TabsTrigger value="data" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
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

                {/* Grid of Recommended Charts */}
                {suggestions && suggestions.length > 0 && (
                   <div className="pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-white/90 flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-amber-400" />
                          Suggested Insights
                        </h3>
                      </div>
                      
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {suggestions.map((chart, idx) => (
                          <Card key={idx} className="border-border/10 bg-black/40 backdrop-blur-md shadow-xl hover:border-white/10 transition-colors group">
                            <CardHeader className="border-b border-border/5 pb-3">
                              <CardTitle className="text-base text-white/90 font-medium leading-snug">
                                {chart.query}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                              <div className="w-full h-[450px]">
                                <ReactECharts 
                                  option={getChartEnhancements(chart.chart_spec)} 
                                  style={{ height: '100%', width: '100%' }} 
                                  theme="dark"
                                />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
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
              </TabsContent>

              {/* DATA TAB */}
              <TabsContent value="data" className="focus-visible:outline-none">
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                  
                  {/* Left: Main Data Table */}
                  <div className="xl:col-span-3 flex flex-col gap-4">
                     <Card className="border-white/5 bg-[#09090b] shadow-2xl overflow-hidden flex flex-col h-[calc(100vh-14rem)] rounded-xl relative">
                       <div className="h-4 px-5 flex items-center shrink-0">
                         <div className="flex items-center gap-2">
                           <FileText className="w-4 h-4 text-muted-foreground/70" />
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
                                            <span className="h-5 px-1.5 flex items-center justify-center rounded-full text-[9px] font-mono tracking-wider border border-white/10 bg-white/5 text-muted-foreground whitespace-nowrap overflow-hidden">
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
                  <div className="xl:col-span-1">
                     <Card className="border-white/5 bg-[#09090b] text-white shadow-xl h-[calc(100vh-14rem)] flex flex-col rounded-xl overflow-hidden relative">
                       <CardHeader className="p-4 border-b border-white/[0.03] bg-transparent shrink-0 flex flex-row items-center justify-between">
                         <div className="flex items-center gap-2">
                           <LayoutGrid className="w-4 h-4 text-muted-foreground/70" />
                           <CardTitle className="text-sm font-semibold tracking-wide text-white/90">Hide Summary</CardTitle>
                         </div>
                         <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/70 hover:bg-white/5 hover:text-white rounded-full">
                           <Play className="w-3 h-3" /> {/* Replace with cross icon if desired */}
                         </Button>
                       </CardHeader>
                       <CardContent className="p-0 flex-1 overflow-hidden relative">
                          <ScrollArea className="h-[calc(100vh-14rem-64px)] overflow-y-auto">
                            <div className="flex flex-col">
                              {schema.map((col, idx) => (
                                <div key={idx} className="p-5 border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors flex flex-col gap-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                      <span className="font-semibold text-[13px] text-white/90 tracking-tight">{formatColumnName(col.name)}</span>
                                      <Badge variant="outline" className="text-[10px] py-0 px-2 h-5 border-white/10 text-muted-foreground bg-white/5 rounded-full font-medium tracking-wider">
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
