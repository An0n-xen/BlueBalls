"use client"

import * as React from "react"
import {
  X,
  GripVertical,
  ChevronDown,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Download,
  EyeOff,
  LayoutGrid,
} from "lucide-react"

type ColumnDef = {
  name: string
  type: string
  column_type?: string
}

type GridConfig = {
  selectedColumns: string[]
  sortColumn: string | null
  sortDirection: "asc" | "desc"
  showSearchAndSorting: boolean
  showDownloadButton: boolean
  hideTitle: boolean
}

type GridPanelProps = {
  isOpen: boolean
  onClose: () => void
  columns: ColumnDef[]
  datasetName: string
  onAddGrid: (config: GridConfig) => void
}

export function GridPanel({
  isOpen,
  onClose,
  columns,
  datasetName,
  onAddGrid,
}: GridPanelProps) {
  const [selectedColumns, setSelectedColumns] = React.useState<string[]>([])
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = React.useState(false)
  const [sortColumn, setSortColumn] = React.useState<string | null>(null)
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc")
  const [isSortDropdownOpen, setIsSortDropdownOpen] = React.useState(false)
  const [showSearchAndSorting, setShowSearchAndSorting] = React.useState(true)
  const [showDownloadButton, setShowDownloadButton] = React.useState(true)
  const [hideTitle, setHideTitle] = React.useState(false)

  const panelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsColumnDropdownOpen(false)
        setIsSortDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  React.useEffect(() => {
    if (isOpen) {
      setSelectedColumns([])
      setSortColumn(null)
      setSortDirection("asc")
      setShowSearchAndSorting(true)
      setShowDownloadButton(true)
      setHideTitle(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const toggleColumn = (name: string) => {
    setSelectedColumns((prev) =>
      prev.includes(name)
        ? prev.filter((c) => c !== name)
        : [...prev, name]
    )
  }

  const handleSelectAll = () => {
    if (selectedColumns.length === columns.length) {
      setSelectedColumns([])
    } else {
      setSelectedColumns(columns.map((c) => c.name))
    }
  }

  const handleSubmit = () => {
    onAddGrid({
      selectedColumns:
        selectedColumns.length > 0
          ? selectedColumns
          : columns.map((c) => c.name),
      sortColumn,
      sortDirection,
      showSearchAndSorting,
      showDownloadButton,
      hideTitle,
    })
  }

  const formatColumnName = (name: string) =>
    name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 pointer-events-none">
      <div
        ref={panelRef}
        className="pointer-events-auto w-[380px] bg-[#0c0e14] border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden backdrop-blur-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-white/20" />
            <LayoutGrid className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white/90">Grid</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/60 p-1 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-5">
          {/* Dataset display */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-white/[0.04] rounded-lg border border-white/10">
            <div className="w-2 h-2 rounded-sm bg-blue-400 shrink-0" />
            <span className="text-sm text-white/70 font-medium truncate flex-1">
              {datasetName || "No dataset loaded"}
            </span>
            <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />
          </div>

          {/* Columns multi-select */}
          <div>
            <label className="flex items-center gap-1 text-xs font-semibold text-blue-400 mb-2">
              <span className="text-blue-400">✱</span> Columns
            </label>
            <div className="relative">
              <button
                onClick={() => {
                  setIsColumnDropdownOpen(!isColumnDropdownOpen)
                  setIsSortDropdownOpen(false)
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-white/[0.04] rounded-lg border border-white/10 hover:border-white/20 transition-colors text-sm"
              >
                <span className={selectedColumns.length > 0 ? "text-white/80" : "text-white/30"}>
                  {selectedColumns.length > 0
                    ? `${selectedColumns.length} column${selectedColumns.length > 1 ? "s" : ""} selected`
                    : "Select Columns"}
                </span>
                <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${isColumnDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {isColumnDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#12141c] rounded-lg border border-white/10 shadow-xl z-10 max-h-[200px] overflow-y-auto">
                  {/* Select All */}
                  <button
                    onClick={handleSelectAll}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] text-sm border-b border-white/[0.06]"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      selectedColumns.length === columns.length
                        ? "bg-blue-500 border-blue-500"
                        : "border-white/20"
                    }`}>
                      {selectedColumns.length === columns.length && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="font-medium text-white/50">Select All</span>
                  </button>
                  {columns.map((col) => (
                    <button
                      key={col.name}
                      onClick={() => toggleColumn(col.name)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] text-sm"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        selectedColumns.includes(col.name)
                          ? "bg-blue-500 border-blue-500"
                          : "border-white/20"
                      }`}>
                        {selectedColumns.includes(col.name) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="text-white/70 truncate">{formatColumnName(col.name)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sort by */}
          <div>
            <label className="text-xs font-medium text-white/40 mb-2 block">
              Sort by
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setIsSortDropdownOpen(!isSortDropdownOpen)
                    setIsColumnDropdownOpen(false)
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setIsSortDropdownOpen(!isSortDropdownOpen); setIsColumnDropdownOpen(false); } }}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-white/[0.04] rounded-lg border border-white/10 hover:border-white/20 transition-colors text-sm cursor-pointer"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <ArrowUpDown className="w-3.5 h-3.5 text-white/30 shrink-0" />
                    <span className={sortColumn ? "text-white/80 truncate" : "text-white/30"}>
                      {sortColumn ? formatColumnName(sortColumn) : "Original Order"}
                    </span>
                  </div>
                  {sortColumn && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSortColumn(null)
                      }}
                      className="text-white/30 hover:text-white/60 p-0.5 ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {isSortDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#12141c] rounded-lg border border-white/10 shadow-xl z-10 max-h-[200px] overflow-y-auto">
                    {columns.map((col) => (
                      <button
                        key={col.name}
                        onClick={() => {
                          setSortColumn(col.name)
                          setIsSortDropdownOpen(false)
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] text-sm ${
                          sortColumn === col.name ? "bg-blue-500/10 text-blue-400" : "text-white/70"
                        }`}
                      >
                        {formatColumnName(col.name)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
                className="p-2.5 rounded-lg border border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06] transition-colors"
                title={sortDirection === "asc" ? "Ascending" : "Descending"}
              >
                {sortDirection === "asc" ? (
                  <ArrowUp className="w-4 h-4 text-white/50" />
                ) : (
                  <ArrowDown className="w-4 h-4 text-white/50" />
                )}
              </button>
            </div>
          </div>

          {/* Toggle options */}
          <div className="space-y-3 pt-1">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-[18px] h-[18px] rounded flex items-center justify-center transition-colors ${
                showSearchAndSorting ? "bg-blue-500" : "bg-white/[0.04] border-2 border-white/15"
              }`}>
                {showSearchAndSorting && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-white/30" />
                <span className="text-sm text-white/60 group-hover:text-white/80">Show search and sorting</span>
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={showSearchAndSorting}
                onChange={(e) => setShowSearchAndSorting(e.target.checked)}
              />
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-[18px] h-[18px] rounded flex items-center justify-center transition-colors ${
                showDownloadButton ? "bg-blue-500" : "bg-white/[0.04] border-2 border-white/15"
              }`}>
                {showDownloadButton && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="flex items-center gap-2">
                <Download className="w-3.5 h-3.5 text-white/30" />
                <span className="text-sm text-white/60 group-hover:text-white/80">Show download button</span>
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={showDownloadButton}
                onChange={(e) => setShowDownloadButton(e.target.checked)}
              />
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-[18px] h-[18px] rounded flex items-center justify-center transition-colors ${
                hideTitle ? "bg-blue-500" : "bg-white/[0.04] border-2 border-white/15"
              }`}>
                {hideTitle && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="flex items-center gap-2">
                <EyeOff className="w-3.5 h-3.5 text-white/30" />
                <span className="text-sm text-white/60 group-hover:text-white/80">Hide title</span>
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={hideTitle}
                onChange={(e) => setHideTitle(e.target.checked)}
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <button
            onClick={handleSubmit}
            disabled={columns.length === 0}
            className="w-full py-2.5 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <LayoutGrid className="w-4 h-4" />
            Add Grid
          </button>
        </div>
      </div>
    </div>
  )
}
