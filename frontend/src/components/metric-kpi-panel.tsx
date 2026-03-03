"use client"

import * as React from "react"
import { Grip, X, ChevronDown, Target, Loader2, Calendar, Hash, Tag, Wand2 } from "lucide-react"

type ColumnDef = {
  name: string
  type: string
  column_type?: string
  description?: string
}

type KpiResult = {
  id: string
  kpi_column: string
  aggregation: string
  value: number | null
  date_column: string | null
  breakdown: { period: string; value: number }[] | null
  label: string
}

type MetricKpiPanelProps = {
  open: boolean
  onClose: () => void
  schema: ColumnDef[]
  datasetId: string | null
  fileName: string | null
  onAddKpi: (kpi: KpiResult) => void
  isComputing?: boolean
}

// Color config per column type
const TYPE_COLORS: Record<string, { border: string; bg: string; text: string; icon: React.ElementType }> = {
  numerical: { border: "border-l-blue-500", bg: "bg-blue-500/10", text: "text-blue-400", icon: Hash },
  date: { border: "border-l-purple-500", bg: "bg-purple-500/10", text: "text-purple-400", icon: Calendar },
  categorical: { border: "border-l-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-400", icon: Tag },
}

// Aggregation options per column type
const AGGREGATIONS_BY_TYPE: Record<string, string[]> = {
  numerical: ["COUNT", "SUM", "AVG", "MIN", "MAX"],
  date: ["COUNT", "MIN", "MAX"],
  categorical: ["COUNT"],
}

export function MetricKpiPanel({
  open,
  onClose,
  schema,
  datasetId,
  fileName,
  onAddKpi,
  isComputing = false,
}: MetricKpiPanelProps) {
  const [position, setPosition] = React.useState({ x: 200, y: 120 })
  const [isDragging, setIsDragging] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const dragRef = React.useRef<{
    startX: number
    startY: number
    initX: number
    initY: number
  } | null>(null)

  const [kpiColumn, setKpiColumn] = React.useState("")
  const [aggregation, setAggregation] = React.useState("COUNT")
  const [dateColumn, setDateColumn] = React.useState("")
  const [extraOpen, setExtraOpen] = React.useState(false)
  const [kpiDropdownOpen, setKpiDropdownOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Group columns by type
  const numericalColumns = React.useMemo(
    () => schema.filter((c) => c.column_type === "numerical"),
    [schema]
  )
  const dateColumns = React.useMemo(
    () => schema.filter((c) => c.column_type === "date"),
    [schema]
  )
  const categoricalColumns = React.useMemo(
    () => schema.filter((c) => c.column_type === "categorical"),
    [schema]
  )

  // Get the selected column's type
  const selectedColumnType = React.useMemo(() => {
    if (!kpiColumn) return null
    const col = schema.find((c) => c.name === kpiColumn)
    return col?.column_type || "categorical"
  }, [kpiColumn, schema])

  // Available aggregations based on selected column type
  const availableAggregations = React.useMemo(() => {
    if (!selectedColumnType) return ["COUNT", "SUM", "AVG", "MIN", "MAX"]
    return AGGREGATIONS_BY_TYPE[selectedColumnType] || ["COUNT"]
  }, [selectedColumnType])

  // Reset aggregation when column type changes and current agg isn't valid
  React.useEffect(() => {
    if (selectedColumnType && !availableAggregations.includes(aggregation)) {
      setAggregation(availableAggregations[0])
    }
  }, [selectedColumnType, availableAggregations, aggregation])

  // Reset selections when dataset changes
  React.useEffect(() => {
    setKpiColumn("")
    setAggregation("COUNT")
    setDateColumn("")
  }, [datasetId])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setKpiDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  React.useEffect(() => {
    setMounted(true)
    const vh = window.innerHeight
    setPosition({ x: 200, y: Math.max(60, (vh - 500) / 2) })
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".drag-handle")) {
      setIsDragging(true)
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initX: position.x,
        initY: position.y,
      }
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

  const formatColumnName = (name: string) =>
    name
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ")

  const handleSelectColumn = (colName: string) => {
    setKpiColumn(colName)
    setKpiDropdownOpen(false)
  }

  const handleAdd = () => {
    if (!datasetId || !kpiColumn) return
    onAddKpi({
      id: `kpi-${Date.now()}`,
      kpi_column: kpiColumn,
      aggregation,
      value: null,
      date_column: dateColumn || null,
      breakdown: null,
      label: `${aggregation} of ${formatColumnName(kpiColumn)}`,
    })
  }

  // Get unique value count placeholder (use column index as stand-in)
  const getUniqueCount = (col: ColumnDef) => {
    // We don't have unique counts from the API, so show the column type indicator
    const idx = schema.indexOf(col)
    return idx + 1
  }

  if (!mounted) return null

  // Render a column group section
  const ColumnGroup = ({
    title,
    columns,
    typeKey,
  }: {
    title: string
    columns: ColumnDef[]
    typeKey: string
  }) => {
    if (columns.length === 0) return null
    const config = TYPE_COLORS[typeKey] || TYPE_COLORS.categorical
    const TypeIcon = config.icon

    return (
      <div>
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
          <TypeIcon className={`h-3 w-3 ${config.text}`} />
          {title}
        </div>
        {columns.map((col) => (
          <button
            key={col.name}
            onClick={() => handleSelectColumn(col.name)}
            className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-accent/50 transition-colors border-l-[3px] ${config.border} ${
              kpiColumn === col.name ? "bg-accent/40" : ""
            }`}
          >
            <span className="font-medium text-foreground/90 truncate mr-3">
              {formatColumnName(col.name)}
            </span>
            <span className="text-xs text-muted-foreground font-mono shrink-0">
              {getUniqueCount(col)}
            </span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div
      className={`fixed z-50 flex flex-col w-[360px] rounded-xl bg-popover text-popover-foreground shadow-xl border border-border/50 transition-all duration-300 ease-out ${
        open
          ? "opacity-100 scale-100 translate-x-0 pointer-events-auto blur-0"
          : "opacity-0 scale-95 -translate-x-6 pointer-events-none blur-sm"
      }`}
      style={{
        left: position.x,
        top: position.y,
        transitionProperty: "opacity, transform, blur, box-shadow",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Header */}
      <div className="drag-handle flex items-center justify-between px-4 py-3 border-b border-border/50 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2 text-sm font-semibold text-popover-foreground select-none pointer-events-none">
          <Grip className="h-4 w-4 text-muted-foreground" />
          <Target className="h-4 w-4 text-blue-400" />
          Metric & KPI
        </div>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="text-muted-foreground hover:text-popover-foreground transition-colors z-10 p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Dataset Sheet Selector (read-only) */}
        <div className="flex items-center justify-between w-full p-2.5 bg-background border border-border rounded-lg text-sm">
          <div className="flex items-center gap-2 text-foreground">
            <div className="w-5 h-5 rounded bg-muted flex items-center justify-center">
              <span className="text-[10px] font-bold">∑</span>
            </div>
            <span className="font-medium truncate max-w-[240px]">
              {fileName || "No dataset"}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>

        {/* KPI Metric — Custom Grouped Dropdown */}
        <div ref={dropdownRef}>
          <label className="text-xs font-semibold text-red-400 flex items-center gap-1 mb-1.5 px-0.5">
            <span>✱</span> KPI Metric
          </label>
          <div className="relative">
            {/* Trigger */}
            <button
              onClick={() => setKpiDropdownOpen(!kpiDropdownOpen)}
              className="w-full flex items-center justify-between p-2.5 bg-background border border-border rounded-lg text-sm text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring transition-colors hover:border-border/80"
            >
              <span className={kpiColumn ? "text-foreground" : "text-muted-foreground"}>
                {kpiColumn ? formatColumnName(kpiColumn) : "Select KPI Metric"}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                  kpiDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Dropdown Panel */}
            {kpiDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border/50 rounded-lg shadow-2xl z-[60] max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
                <ColumnGroup
                  title="Numerical"
                  columns={numericalColumns}
                  typeKey="numerical"
                />
                <ColumnGroup
                  title="Dates"
                  columns={dateColumns}
                  typeKey="date"
                />
                <ColumnGroup
                  title="Categorical"
                  columns={categoricalColumns}
                  typeKey="categorical"
                />

                {schema.length === 0 && (
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                    Upload a dataset to see columns
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Aggregation — filtered by selected column type */}
        <div className="relative">
          <select
            value={aggregation}
            onChange={(e) => setAggregation(e.target.value)}
            className="w-full appearance-none p-2.5 pr-8 bg-background border border-border rounded-lg text-sm text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {availableAggregations.map((agg) => (
              <option key={agg} value={agg}>
                {agg}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>

        {/* Date Metric */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block px-0.5">
            Date Metric
          </label>
          <div className="relative">
            <select
              value={dateColumn}
              onChange={(e) => setDateColumn(e.target.value)}
              className="w-full appearance-none p-2.5 pr-8 bg-background border border-border rounded-lg text-sm text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Date Metric</option>
              {dateColumns.map((col) => (
                <option key={col.name} value={col.name}>
                  {formatColumnName(col.name)}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Extra Options (expandable) */}
        <button
          onClick={() => setExtraOpen(!extraOpen)}
          className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          <span className="font-medium">Extra Options</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${
              extraOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        {extraOpen && (
          <div className="text-xs text-muted-foreground/60 px-1 pb-1">
            Additional KPI formatting options coming soon.
          </div>
        )}

        {/* Add to Dashboard Button */}
        <button
          onClick={handleAdd}
          disabled={!kpiColumn || !datasetId || isComputing}
          className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
        >
          {isComputing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Computing...
            </>
          ) : (
            "Add to Dashboard"
          )}
        </button>
      </div>
    </div>
  )
}
