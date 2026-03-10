"use client"

import * as React from "react"
import axios from "axios"
import {
  Grip,
  X,
  Search,
  ChevronDown,
  CheckCircle2,
  ArrowUpDown,
  Loader2,
} from "lucide-react"

type DistinctValue = { value: string; count: number }
type ColumnInfo = {
  name: string
  type: string
  distinct_count: number
  values: DistinctValue[]
}

export type GlobalFilters = Record<string, string[]>

export function FilterPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [position, setPosition] = React.useState({ x: 90, y: 100 })
  const [isDragging, setIsDragging] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const dragRef = React.useRef<{
    startX: number
    startY: number
    initX: number
    initY: number
  } | null>(null)

  const [datasetId, setDatasetId] = React.useState<string | null>(null)
  const [datasetName, setDatasetName] = React.useState("")
  const [columns, setColumns] = React.useState<ColumnInfo[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [selectedColumn, setSelectedColumn] = React.useState<string | null>(
    null
  )
  const [columnSearch, setColumnSearch] = React.useState("")
  const [valueSearch, setValueSearch] = React.useState("")
  const [valueSortBy, setValueSortBy] = React.useState<"count" | "alpha">(
    "count"
  )
  const [activeFilters, setActiveFilters] = React.useState<GlobalFilters>({})
  const lastFetchedId = React.useRef<string | null>(null)

  React.useEffect(() => {
    setMounted(true)
    const vh = window.innerHeight
    setPosition({ x: 90, y: Math.max(50, (vh - 600) / 2) })
  }, [])

  // Listen for dataset-info event from page.tsx
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.datasetId) setDatasetId(detail.datasetId)
      if (detail?.datasetName) setDatasetName(detail.datasetName)
    }
    window.addEventListener("dataset-info", handler)
    return () => window.removeEventListener("dataset-info", handler)
  }, [])

  // Fetch distinct values when panel opens with a dataset
  React.useEffect(() => {
    if (open && datasetId && lastFetchedId.current !== datasetId) {
      lastFetchedId.current = datasetId
      setIsLoading(true)
      setColumns([])
      setSelectedColumn(null)
      axios
        .get(`/dataset/${datasetId}/distinct-values`)
        .then((resp) => {
          setColumns(resp.data.columns || [])
        })
        .catch((err) => {
          console.error("Failed to fetch distinct values:", err)
        })
        .finally(() => setIsLoading(false))
    }
  }, [open, datasetId])

  // Broadcast filter changes to page.tsx
  const broadcastFilters = React.useCallback((filters: GlobalFilters) => {
    setActiveFilters(filters)
    window.dispatchEvent(
      new CustomEvent("global-filters-changed", { detail: { filters } })
    )
    window.dispatchEvent(
      new CustomEvent("filter-status-changed", {
        detail: { hasFilters: Object.keys(filters).length > 0 },
      })
    )
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
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      setPosition({
        x: dragRef.current.initX + dx,
        y: dragRef.current.initY + dy,
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

  if (!mounted) return null

  const COLUMN_COLORS = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-400",
    "bg-green-600",
    "bg-green-500",
    "bg-teal-500",
    "bg-lime-400",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-rose-400",
  ]

  const filteredColumns = columnSearch
    ? columns.filter((c) =>
        c.name.toLowerCase().includes(columnSearch.toLowerCase())
      )
    : columns

  const selectedCol = columns.find((c) => c.name === selectedColumn)
  let displayValues = selectedCol?.values || []
  if (valueSearch) {
    displayValues = displayValues.filter((v) =>
      v.value.toLowerCase().includes(valueSearch.toLowerCase())
    )
  }
  if (valueSortBy === "alpha") {
    displayValues = [...displayValues].sort((a, b) =>
      a.value.localeCompare(b.value)
    )
  }

  const selectedValues = selectedColumn
    ? activeFilters[selectedColumn] || []
    : []

  const toggleValue = (val: string) => {
    if (!selectedColumn) return
    const current = activeFilters[selectedColumn] || []
    const updated = current.includes(val)
      ? current.filter((v) => v !== val)
      : [...current, val]
    const newFilters = { ...activeFilters }
    if (updated.length === 0) {
      delete newFilters[selectedColumn]
    } else {
      newFilters[selectedColumn] = updated
    }
    broadcastFilters(newFilters)
  }

  const clearAllFilters = () => {
    broadcastFilters({})
  }

  const removeFilterChip = (colName: string, val: string) => {
    const current = activeFilters[colName] || []
    const updated = current.filter((v) => v !== val)
    const newFilters = { ...activeFilters }
    if (updated.length === 0) {
      delete newFilters[colName]
    } else {
      newFilters[colName] = updated
    }
    broadcastFilters(newFilters)
  }

  const formatColumnName = (name: string) =>
    name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())

  const hasActiveFilters = Object.keys(activeFilters).length > 0

  return (
    <div
      className={`fixed z-50 flex flex-col w-[800px] h-[600px] rounded-xl bg-[#0f0f0f] text-gray-200 shadow-2xl border border-white/10 overflow-hidden transition-all duration-300 ease-out ${
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
      {/* Title Bar */}
      <div className="drag-handle flex items-center justify-between px-6 py-4 border-b border-white/5 cursor-grab active:cursor-grabbing bg-gradient-to-r from-blue-950/30 to-purple-950/20">
        <div className="flex items-center gap-2 text-base font-semibold text-gray-200 select-none pointer-events-none">
          <Grip className="h-5 w-5 text-gray-500" />
          Global Filters
        </div>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 transition-colors z-10 p-1.5 hover:bg-white/5 rounded-md"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Active Filters Bar */}
      {hasActiveFilters && (
        <div className="px-6 py-2.5 border-b border-white/5 bg-white/[0.02] flex items-center gap-2 flex-wrap">
          {Object.entries(activeFilters).map(([colName, values]) =>
            values.map((val) => (
              <span
                key={`${colName}-${val}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/15 text-blue-400 rounded-full text-xs font-medium"
              >
                <span className="text-blue-300">
                  {formatColumnName(colName)}
                </span>
                <span className="text-blue-400/60">is</span>
                <span className="bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-300">
                  {val}
                </span>
                <button
                  onClick={() => removeFilterChip(colName, val)}
                  className="ml-0.5 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors ml-1"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Left Panel — Column List */}
        <div className="w-[300px] border-r border-white/5 flex flex-col min-h-0 bg-[#111111]">
          <div className="p-4 space-y-4">
            {/* Dataset Indicator */}
            <div className="flex items-center justify-between w-full p-2.5 bg-white/[0.04] border border-white/[0.08] rounded-md text-sm">
              <div className="flex items-center gap-2 text-gray-300">
                <div className="w-4 h-4 rounded bg-white/10 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-gray-400">∑</span>
                </div>
                <span className="font-medium truncate">
                  {datasetName || "No dataset loaded"}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
            </div>

            {/* Column Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search"
                value={columnSearch}
                onChange={(e) => setColumnSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-md text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/20"
              />
            </div>
          </div>

          <div className="px-4 pb-2 flex items-center gap-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Categories
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 custom-scrollbar">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
              </div>
            ) : columns.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">
                {datasetId
                  ? "No columns available"
                  : "Upload a dataset to start filtering"}
              </p>
            ) : (
              filteredColumns.map((col, i) => {
                const colFilterCount = (activeFilters[col.name] || []).length
                return (
                  <button
                    key={col.name}
                    onClick={() => {
                      setSelectedColumn(col.name)
                      setValueSearch("")
                    }}
                    className={`w-full flex items-center justify-between p-3 bg-white/[0.03] border rounded-md hover:bg-white/[0.06] hover:shadow-sm transition-all text-left relative overflow-hidden group ${
                      selectedColumn === col.name
                        ? "border-blue-500/50 ring-1 ring-blue-500/20"
                        : colFilterCount > 0
                        ? "border-blue-500/30"
                        : "border-white/[0.08]"
                    }`}
                  >
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                        COLUMN_COLORS[i % COLUMN_COLORS.length]
                      }`}
                    />
                    <span className="pl-2 font-medium text-sm text-gray-300 truncate mr-2">
                      {formatColumnName(col.name)}
                    </span>
                    <div className="flex items-center gap-2">
                      {colFilterCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">
                          {colFilterCount}
                        </span>
                      )}
                      <span className="text-xs text-gray-500 font-medium">
                        {col.distinct_count}
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right Panel — Value Selection */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#111111]">
          {selectedCol ? (
            <>
              {/* Column Header */}
              <div className="px-6 py-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-200">
                    {formatColumnName(selectedCol.name)}
                  </h3>
                  <span className="text-xs text-gray-500 bg-white/[0.06] px-2 py-0.5 rounded-full">
                    {selectedCol.type}
                  </span>
                </div>
              </div>

              {/* Search + Sort Bar */}
              <div className="px-6 py-3 border-b border-white/5 flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search"
                    value={valueSearch}
                    onChange={(e) => setValueSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-md text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/20"
                  />
                </div>
                <button
                  onClick={() =>
                    setValueSortBy((s) =>
                      s === "count" ? "alpha" : "count"
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-md text-xs text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <ArrowUpDown className="w-3 h-3" />
                  {valueSortBy === "count" ? "Sort by" : "A-Z"}
                </button>
              </div>

              {/* Value Chips */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="flex flex-wrap gap-2">
                  {displayValues.map((v) => {
                    const isSelected = selectedValues.includes(v.value)
                    return (
                      <button
                        key={v.value}
                        onClick={() => toggleValue(v.value)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
                          isSelected
                            ? "bg-blue-500/20 text-blue-300 border-2 border-blue-400/40 font-medium shadow-sm"
                            : "bg-white/[0.04] text-gray-400 border border-white/[0.1] hover:bg-white/[0.08] hover:text-gray-200 hover:border-white/20"
                        }`}
                      >
                        <span>{v.value}</span>
                        <span
                          className={`text-[10px] font-semibold ${
                            isSelected ? "text-blue-400" : "text-gray-600"
                          }`}
                        >
                          {v.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <p className="text-gray-500 text-[15px] text-center max-w-sm">
                Select from the list of columns in the left panel to start
                filtering
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
