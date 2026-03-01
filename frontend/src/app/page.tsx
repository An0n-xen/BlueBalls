"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { UploadCloud, FileText, Database, Sparkles, Loader2, BarChart2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ReactECharts from "echarts-for-react";

// Configure default axios base URL for the FastAPI backend
axios.defaults.baseURL = "http://localhost:8000/api/v1";

type ColumnDef = {
  name: string;
  type: string;
  description?: string;
};

export default function AnalysisDashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [schema, setSchema] = useState<ColumnDef[]>([]);
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [generatedChart, setGeneratedChart] = useState<any>(null);
  const [generatedSql, setGeneratedSql] = useState<string | null>(null);
  
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
      console.log(resp.data);
      setGeneratedSql(resp.data.sql_query);
      
      // The LLM output could be nested inside "chart_spec" depending on prompt execution
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-foreground p-6 md:p-12 font-sans selection:bg-primary/30">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Header */}
        <header className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary w-fit text-sm font-medium border border-primary/20">
            <Sparkles className="w-4 h-4" />
            AI-Powered Analysis Engine
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Data Discovery Studio
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Upload a CSV or Excel file to instantly map its schema using LLMs and generate beautiful charting insights.
          </p>
        </header>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg font-medium animate-in fade-in slide-in-from-top-2">
            Warning: {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Upload & Actions */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <Card className="border-white/10 bg-black/40 backdrop-blur-md shadow-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  Dataset Connection
                </CardTitle>
                <CardDescription>Upload your data to begin the analysis phase.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
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
                        <span className="font-medium text-white break-all">{file.name}</span>
                        <span className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className="font-medium text-white transition-colors group-hover:text-primary">Click or drag file</span>
                        <span className="text-xs text-muted-foreground mt-1">Supports .csv, .xls, .xlsx</span>
                      </div>
                    )}
                  </div>
                </div>

                <Button 
                  onClick={handleUpload} 
                  disabled={!file || isUploading}
                  className="w-full font-semibold h-11 transition-all"
                  size="lg"
                >
                  {isUploading ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Ingesting Data...</>
                  ) : (
                    "Initialize Dataset"
                  )}
                </Button>
              </CardContent>
            </Card>

            {datasetId && schema.length > 0 && (
              <Card className="border-primary/20 bg-primary/5 backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-bottom-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-primary" />
                    AI Chart Engine
                  </CardTitle>
                  <CardDescription>Let Qwen 2.5 figure out the best ways to visualize this dataset.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="default"
                    onClick={handleSuggestCharts} 
                    disabled={isFetchingSuggestions}
                    className="w-full font-semibold h-11 bg-white text-black hover:bg-white/90"
                  >
                    {isFetchingSuggestions ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Brainstorming Charts...</>
                    ) : (
                      <><Sparkles className="mr-2 h-4 w-4" /> Recommend Charts</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Custom Query Generation */}
            {datasetId && schema.length > 0 && (
              <Card className="border-secondary/20 bg-secondary/5 backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-bottom-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-secondary-foreground" />
                    Text-to-Chart
                  </CardTitle>
                  <CardDescription>Ask a question in plain English and instantly get an interactive ECharts visualization.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleGenerateChart} className="flex flex-col gap-3">
                    <Input 
                      placeholder="e.g. 'Show me the top 5 reasons for admission'" 
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      className="bg-black/40 border-white/10 text-white placeholder:text-white/30 h-11"
                    />
                    <Button 
                      type="submit"
                      disabled={isGeneratingChart || !userQuery.trim()}
                      className="w-full font-semibold h-11 transition-all"
                      variant="secondary"
                    >
                      {isGeneratingChart ? (
                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating SQL & Chart...</>
                      ) : (
                        "Generate Visualization"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Schema & Insights */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Schema Table */}
            {schema.length > 0 && (
              <Card className="border-white/10 bg-black/40 backdrop-blur-md shadow-2xl animate-in fade-in zoom-in-95">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <FileText className="w-5 h-5 text-primary" />
                        Inferred Schema
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Table: <code className="text-xs bg-black/40 px-1 py-0.5 rounded text-primary">{datasetId}</code>
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="bg-white/10 hover:bg-white/20 transition-colors">
                      {schema.length} Columns
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[350px] w-full rounded-md border border-white/10 bg-black/20">
                    <Table>
                      <TableHeader className="bg-white/5 sticky top-0 backdrop-blur-md z-10">
                        <TableRow className="border-white/10 hover:bg-transparent">
                          <TableHead className="w-[150px] font-semibold text-white">Column Name</TableHead>
                          <TableHead className="w-[100px] font-semibold text-white">Data Type</TableHead>
                          <TableHead className="font-semibold text-white">AI Contextual Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {schema.map((col, idx) => (
                          <TableRow key={idx} className="border-white/5 hover:bg-white/5 transition-colors">
                            <TableCell className="font-medium font-mono text-sm text-white/90">{col.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 rounded-md font-mono text-xs">
                                {col.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {col.description ? col.description : <span className="italic opacity-50">No description available</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* AI Generated Chart */}
            {(generatedChart || generatedSql) && (
              <Card className="border-blue-500/30 bg-black/40 backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-bottom-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl text-blue-400">
                    <BarChart2 className="w-5 h-5" />
                    Interactive Visualization
                  </CardTitle>
                  <CardDescription>
                    Generated securely via PostgreSQL and Apache ECharts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                  {generatedSql && (
                    <div className="bg-black/60 border border-white/10 rounded-md p-4">
                      <div className="text-xs text-muted-foreground mb-2 flex justify-between">
                        <span>EXECUTED SQL QUERY</span>
                        <Badge variant="outline" className="border-green-500 text-green-500 bg-green-500/10">READ ONLY</Badge>
                      </div>
                      <code className="text-blue-300 font-mono text-sm whitespace-pre-wrap">
                        {generatedSql}
                      </code>
                    </div>
                  )}
                  
                  {generatedChart && (
                    <div className="w-full h-[400px] bg-white/5 rounded-xl border border-white/10 p-4">
                      <ReactECharts 
                        option={{
                          ...generatedChart,
                          backgroundColor: 'transparent',
                          textStyle: { fontFamily: 'inherit' }
                        }} 
                        style={{ height: '100%', width: '100%' }} 
                        theme="dark"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* AI Suggestions Accordion */}
            {suggestions && (
              <Card className="border-primary/30 bg-black/40 backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-bottom-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl text-primary">
                    <Sparkles className="w-5 h-5" />
                    AI Chart Recommendations
                  </CardTitle>
                  <CardDescription>
                    Generated using Qwen 2.5 72B based on the dataset schema.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-invert prose-p:text-white/80 prose-headings:text-white prose-a:text-primary max-w-none rounded-md bg-white/5 p-6 border border-white/10">
                    {/* A quick hack to render markdown loosely since we don't have react-markdown installed yet, just showing the raw text with pre-wrap */}
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed overflow-x-auto">
                      {suggestions}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {!datasetId && (
              <div className="h-full min-h-[400px] rounded-xl border-2 border-dashed border-white/10 bg-black/20 flex flex-col items-center justify-center text-center p-8">
                <Database className="w-12 h-12 text-white/20 mb-4" />
                <h3 className="text-xl font-semibold text-white/50">No Dataset Active</h3>
                <p className="text-muted-foreground mt-2 max-w-sm">
                  Upload a dataset from the left panel to infer its schema and begin generating AI insight recommendations.
                </p>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
