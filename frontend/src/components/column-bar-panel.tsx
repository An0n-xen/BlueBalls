"use client"

import * as React from "react"
import axios from "axios"
import {
  Grip, X, ChevronDown, Loader2, Plus, BarChart, BarChart3,
  ArrowDown, ArrowUp, Hash, Calendar, Tag
} from "lucide-react"

axios.defaults.baseURL = "http://localhost:8000/api/v1"

type ColumnInfo = {
  name: string
  type: string
  column_type?: string
  distinct_count?: number
}

type XValue = {
  id: string
  column: string
  aggregation: string
}

const AGGREGATIONS = ["COUNT", "SUM", "AVG", "MIN", "MAX"]

const COLUMN_COLORS = [
  "bg-red-500", "bg-orange-500", "bg-yellow-400", "bg-green-500",
  "bg-teal-500", "bg-blue-500", "bg-indigo-500", "bg-purple-500",
  "bg-pink-500", "bg-rose-400",
]

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  numerical: { icon: Hash, color: "text-blue-400" },
  date: { icon: Calendar, color: "text-purple-400" },
  categorical: { icon: Tag, color: "text-emerald-400" },
}

export function ColumnBarPanel({ 
  open, 
  onClose,
  schema = [],
  datasetId,
  datasetName
}: { 
  open: boolean; 
  onClose: () => void;
  schema?: ColumnInfo[];
  datasetId: string | null;
  datasetName: string;
}) {
  const [position, setPosition] = React.useState({ x: 90, y: 100 })
  const [isDragging, setIsDragging] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const dragRef = React.useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null)

  // Data
  const [columns, setColumns] = React.useState<ColumnInfo[]>([])
  const lastFetched = React.useRef<string | null>(null)

  // Config
  const [chartType, setChartType] = React.useState<"column" | "bar">("column")
  const [yAxis, setYAxis] = React.useState("")
  const [xValues, setXValues] = React.useState<XValue[]>([
    { id: "xv-0", column: "__record_count__", aggregation: "COUNT" },
  ])
  const [slice, setSlice] = React.useState("")
  const [sortBy, setSortBy] = React.useState("")
  const [sortDir, setSortDir] = React.useState<"desc" | "asc">("desc")

  // UI
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [activeDropdown, setActiveDropdown] = React.useState<string | null>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // ---- Effects ----
  React.useEffect(() => {
    setMounted(true)
    const vh = window.innerHeight
    setPosition({ x: 90, y: Math.max(50, (vh - 650) / 2) })
  }, [])

  // Fetch distinct values when dataset changes or panel opens
  React.useEffect(() => {
    if (open && datasetId && lastFetched.current !== datasetId) {
      lastFetched.current = datasetId
      axios
        .get(`/dataset/${datasetId}/distinct-values`)
        .then((resp) => setColumns(resp.data.columns || []))
        .catch(() => {})
    }
  }, [open, datasetId])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Reset when dataset changes
  React.useEffect(() => {
    setYAxis("")
    setXValues([{ id: "xv-0", column: "__record_count__", aggregation: "COUNT" }])
    setSlice("")
    setSortBy("")
    setError(null)
  }, [datasetId])

  // ---- Drag handlers ----
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".drag-handle")) {
      setIsDragging(true)
      dragRef.current = { startX: e.clientX, startY: e.clientY, initX: position.x, initY: position.y }
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (isDragging && dragRef.current) {
      setPosition({
        x: dragRef.current.initX + (e.clientX - dragRef.current.startX),
        y: dragRef.current.initY + (e.clientY - dragRef.current.startY),
      })
    }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false)
      dragRef.current = null
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  // ---- Helpers ----
  const fmt = (name: string) =>
    name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

  const mergedColumns = React.useMemo(() => {
    // Merge schema (has column_type) with distinct-values (has distinct_count)
    if (columns.length > 0) {
      return columns.map((c) => {
        const s = schema.find((sc) => sc.name === c.name)
        return { ...c, column_type: s?.column_type || c.type }
      })
    }
    return schema.map((s) => ({ ...s, distinct_count: undefined }))
  }, [columns, schema])

  const getColumnColor = (idx: number) => COLUMN_COLORS[idx % COLUMN_COLORS.length]

  // ---- Handlers ----
  const addXValue = () => {
    setXValues((prev) => [
      ...prev,
      { id: `xv-${Date.now()}`, column: "", aggregation: "COUNT" },
    ])
  }

  const removeXValue = (id: string) => {
    setXValues((prev) => (prev.length <= 1 ? prev : prev.filter((v) => v.id !== id)))
  }

  const updateXValue = (id: string, field: "column" | "aggregation", val: string) => {
    setXValues((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: val } : v)))
  }

  const handleGenerate = async () => {
    if (!datasetId || !yAxis) return
    const validX = xValues.filter((v) => v.column)
    if (validX.length === 0) return

    setIsGenerating(true)
    setError(null)

    try {
      const resp = await axios.post("/charts/column-bar", {
        dataset_id: datasetId,
        y_axis: yAxis,
        x_values: validX.map((v) => ({
          column: v.column,
          aggregation: v.aggregation,
        })),
        slice: slice || undefined,
        sort_by: sortBy || undefined,
        sort_dir: sortDir,
        chart_type: chartType,
      })

      // Dispatch chart to dashboard
      window.dispatchEvent(
        new CustomEvent("ai-chart-generated", {
          detail: {
            query: `${chartType === "bar" ? "Bar" : "Column"} chart: ${fmt(yAxis)}`,
            chart_spec: resp.data.chart_spec,
            sql_query: resp.data.sql_query,
          },
        })
      )

      onClose()
    } catch (err) {
      const e = err as any
      setError(e.response?.data?.detail || "Failed to generate chart")
    } finally {
      setIsGenerating(false)
    }
  }

  // ---- Column Dropdown Component ----
  const ColumnDropdown = ({
    id,
    value,
    onChange,
    placeholder,
    showRecordCount = false,
  }: {
    id: string
    value: string
    onChange: (val: string) => void
    placeholder: string
    showRecordCount?: boolean
  }) => {
    const isOpen = activeDropdown === id

    return (
      <div className="relative" ref={isOpen ? dropdownRef : undefined}>
        <button
          onClick={() => setActiveDropdown(isOpen ? null : id)}
          className="w-full flex items-center justify-between p-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-colors hover:border-white/15"
        >
          <span className={value ? "text-gray-200" : "text-gray-500"}>
            {value === "__record_count__"
              ? "Record Count"
              : value
              ? fmt(value)
              : placeholder}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-[60] max-h-[280px] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 sticky top-0 bg-[#1a1a1a]">
              <span className="text-sm font-medium text-gray-300">Select Column</span>
              <button
                onClick={() => setActiveDropdown(null)}
                className="text-gray-500 hover:text-gray-300 p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Record Count option */}
            {showRecordCount && (
              <div className="px-2 py-1.5 border-b border-white/5">
                <button
                  onClick={() => {
                    onChange("__record_count__")
                    setActiveDropdown(null)
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                    value === "__record_count__"
                      ? "bg-blue-500/15 text-blue-300"
                      : "text-gray-400 hover:bg-white/[0.06] hover:text-gray-200"
                  }`}
                >
                  <div className="w-1.5 h-6 rounded-full bg-blue-500" />
                  Record Count
                </button>
              </div>
            )}

            {/* Categories label */}
            <div className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="h-3 w-3" />
              Categories
            </div>

            {/* Column list */}
            {mergedColumns.map((col, idx) => {
              const typeConf = TYPE_CONFIG[col.column_type || "categorical"] || TYPE_CONFIG.categorical
              const TypeIcon = typeConf.icon
              return (
                <button
                  key={col.name}
                  onClick={() => {
                    onChange(col.name)
                    setActiveDropdown(null)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                    value === col.name
                      ? "bg-blue-500/15 text-blue-300"
                      : "text-gray-300 hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-1.5 h-6 rounded-full ${getColumnColor(idx)}`} />
                    <span className="font-medium">{fmt(col.name)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TypeIcon className={`h-3 w-3 ${typeConf.color} opacity-50`} />
                    {col.distinct_count !== undefined && (
                      <span className="text-xs text-gray-600 font-mono">
                        {col.distinct_count}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}

            {mergedColumns.length === 0 && (
              <div className="px-3 py-6 text-sm text-gray-500 text-center">
                Upload a dataset to see columns
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (!mounted) return null

  return (
    <div
      className={`fixed z-50 flex flex-col w-[360px] rounded-xl bg-[#0f0f0f] text-gray-200 shadow-2xl border border-white/10 overflow-hidden transition-all duration-300 ease-out ${
        open
          ? "opacity-100 scale-100 translate-x-0 pointer-events-auto blur-0"
          : "opacity-0 scale-95 -translate-x-6 pointer-events-none blur-sm"
      }`}
      style={{ left: position.x, top: position.y, transitionProperty: "opacity, transform, blur, box-shadow" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Header */}
      <div className="drag-handle flex items-center justify-between px-4 py-3 border-b border-white/5 cursor-grab active:cursor-grabbing bg-gradient-to-r from-blue-950/30 to-purple-950/20">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-200 select-none pointer-events-none">
          <Grip className="h-4 w-4 text-gray-500" />
          <BarChart className="h-3.5 w-3.5 text-blue-400" />
          Column & Bar
        </div>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 transition-colors z-10 p-1.5 hover:bg-white/5 rounded-md"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto bg-[#111111] custom-scrollbar" onPointerDown={(e) => e.stopPropagation()}>
        
        {/* Dataset indicator */}
        <div className="flex items-center justify-between w-full p-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <div className="w-4 h-4 rounded bg-white/10 flex items-center justify-center">
              <span className="text-[10px] font-bold text-gray-400">∑</span>
            </div>
            <span className="font-medium truncate max-w-[240px]">
              {datasetName || "No dataset loaded"}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
        </div>

        {/* Column / Bar toggle */}
        <div className="flex bg-white/[0.04] border border-white/[0.08] rounded-lg p-1">
          <button
            onClick={() => setChartType("column")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all ${
              chartType === "column"
                ? "bg-white/[0.1] text-gray-200 shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Columns
          </button>
          <button
            onClick={() => setChartType("bar")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all ${
              chartType === "bar"
                ? "bg-white/[0.1] text-gray-200 shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <BarChart className="h-3.5 w-3.5 rotate-90" />
            Bars
          </button>
        </div>

        {/* Y-Axis (category column) */}
        <div>
          <label className="text-[11px] font-semibold text-red-400 flex items-center gap-1 mb-1.5 px-0.5 uppercase tracking-wider">
            <span>✱</span> Y-Axis
          </label>
          <ColumnDropdown
            id="y-axis"
            value={yAxis}
            onChange={setYAxis}
            placeholder="Select Y-Axis"
          />
        </div>

        {/* X-Axis (values + aggregation) */}
        <div>
          <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block px-0.5 uppercase tracking-wider">
            X-Axis
          </label>
          <div className="space-y-2">
            {xValues.map((xv, idx) => (
              <div key={xv.id} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-500 font-medium">Value {idx + 1}</span>
                  {xValues.length > 1 && (
                    <button
                      onClick={() => removeXValue(xv.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Column selector for this value */}
                <ColumnDropdown
                  id={`xval-${xv.id}`}
                  value={xv.column}
                  onChange={(val) => updateXValue(xv.id, "column", val)}
                  placeholder="Select Column"
                  showRecordCount
                />

                {/* Aggregation */}
                <div className="relative">
                  <select
                    value={xv.aggregation}
                    onChange={(e) => updateXValue(xv.id, "aggregation", e.target.value)}
                    className="w-full appearance-none p-2 pr-8 bg-white/[0.04] border border-white/[0.08] rounded-md text-sm text-gray-300 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                  >
                    {AGGREGATIONS.map((agg) => (
                      <option key={agg} value={agg}>
                        {agg}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 pointer-events-none" />
                </div>
              </div>
            ))}

            <button
              onClick={addXValue}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-gray-500 hover:text-gray-300 border border-dashed border-white/[0.08] rounded-lg hover:border-white/15 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Value
            </button>
          </div>
        </div>

        {/* Slice (group by) */}
        <div>
          <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block px-0.5 uppercase tracking-wider">
            Slice
          </label>
          <ColumnDropdown
            id="slice"
            value={slice}
            onChange={setSlice}
            placeholder="Select Slice"
          />
        </div>

        {/* Sort By */}
        <div>
          <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block px-0.5 uppercase tracking-wider">
            Sort By
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <ColumnDropdown
                id="sort-by"
                value={sortBy}
                onChange={setSortBy}
                placeholder="Select Sort By"
                showRecordCount
              />
            </div>
            <button
              onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
              className="flex items-center justify-center w-10 bg-white/[0.04] border border-white/[0.08] rounded-lg text-gray-500 hover:text-gray-300 transition-colors shrink-0"
              title={sortDir === "desc" ? "Descending" : "Ascending"}
            >
              {sortDir === "desc" ? (
                <ArrowDown className="h-4 w-4" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400/80 text-xs px-1">{error}</p>
        )}

        {/* Add to Dashboard */}
        <button
          onClick={handleGenerate}
          disabled={!yAxis || !datasetId || isGenerating || xValues.every((v) => !v.column)}
          className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Generating...
            </>
          ) : (
            "Add to Dashboard"
          )}
        </button>
      </div>
    </div>
  )
}
