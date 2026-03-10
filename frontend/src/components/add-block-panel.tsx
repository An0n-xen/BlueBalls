"use client"

import * as React from "react"
import { 
  Type, 
  Heading1, 
  LayoutGrid, 
  Image as ImageIcon, 
  LayoutTemplate, 
  Aperture,
  Target,
  BarChart,
  LineChart,
  PieChart,
  Grid3x3,
  Filter,
  ScatterChart,
  Network,
  Circle,
  Table,
  TableProperties,
  Map,
  Crosshair,
  TrendingUp,
  Calculator,
  Grip,
  X
} from "lucide-react"

const presentItems = [
  { title: "Header", icon: Heading1 },
  { title: "Rich Text", icon: Type },
  { title: "Metric & KPI", icon: Target },
  { title: "Grid", icon: LayoutGrid },
  { title: "Image", icon: ImageIcon },
]

const visualizeItems = [
  { title: "Column & Bar", icon: BarChart },
  { title: "Bar Line", icon: LineChart },
  { title: "Pie Chart", icon: PieChart },
  { title: "Time Series", icon: LineChart },
  { title: "Line Plot", icon: TrendingUp },
  { title: "Heatmap", icon: Grid3x3 },
  { title: "Funnel Chart", icon: Filter },
  { title: "Scatter Plot", icon: ScatterChart },
  { title: "Dependency", icon: Network },
  { title: "Bubble", icon: Circle },
  { title: "Data Table", icon: Table },
  { title: "Pivot Table", icon: TableProperties },
  { title: "Map", icon: Map },
]

const explainItems = [
  { title: "Outliers", icon: Crosshair },
  { title: "Correlation", icon: TrendingUp },
  { title: "ROI Calculator", icon: Calculator },
]

export function AddBlockPanel({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [position, setPosition] = React.useState({ x: 90, y: 100 })
  const [isDragging, setIsDragging] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const dragRef = React.useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null)

  React.useEffect(() => {
    setMounted(true)
    // Initial position slightly above middle vertically
    const vh = window.innerHeight
    const itemHeight = 600 // roughly max height
    setPosition({ x: 90, y: Math.max(50, (vh - itemHeight) / 2) })
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true)
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initX: position.x,
        initY: position.y
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

  const ItemButton = ({ icon: Icon, title, onClick }: { icon: any, title: string, onClick?: () => void }) => (
    <button 
      onClick={onClick}
      className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-white/[0.06] text-gray-400 hover:text-gray-200 w-full text-left transition-colors"
    >
      <Icon className="h-4 w-4" />
      <span className="font-medium text-[13px]">{title}</span>
    </button>
  )

  return (
    <div 
      className={`fixed z-50 flex flex-col w-[340px] rounded-xl bg-[#0f0f0f] text-gray-200 shadow-2xl border border-white/10 transition-all duration-300 ease-out ${open ? "opacity-100 scale-100 translate-x-0 pointer-events-auto blur-0" : "opacity-0 scale-95 -translate-x-6 pointer-events-none blur-sm"}`}
      style={{ left: position.x, top: position.y, transitionProperty: "opacity, transform, blur, box-shadow" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="drag-handle flex items-center justify-between px-4 py-3 border-b border-white/5 cursor-grab active:cursor-grabbing bg-gradient-to-r from-blue-950/30 to-purple-950/20">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-200 select-none pointer-events-none">
          <Grip className="h-4 w-4 text-gray-500" />
          Add Block
        </div>
        <button 
          onPointerDown={(e) => e.stopPropagation()} 
          onClick={onClose} 
          className="text-gray-500 hover:text-gray-300 transition-colors z-10 p-1.5 hover:bg-white/5 rounded-md"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      
      <div className="p-4 max-h-[70vh] overflow-y-auto overflow-x-hidden space-y-6 bg-[#111111]">
        {/* Present Section */}
        <div>
          <h4 className="text-[11px] font-semibold text-gray-500 mb-3 px-1 select-none uppercase tracking-wider">Present</h4>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {presentItems.map((item) => {
              const eventMap: Record<string, string> = {
                "Metric & KPI": "open-metric-kpi",
                "Rich Text": "add-rich-text-block",
                "Grid": "open-grid-panel",
                "Image": "open-image-panel",
                "Header": "open-header-panel",
              }
              const eventName = eventMap[item.title]
              return (
                <ItemButton 
                  key={item.title} 
                  icon={item.icon} 
                  title={item.title} 
                  onClick={eventName ? () => window.dispatchEvent(new CustomEvent(eventName)) : undefined}
                />
              )
            })}
          </div>
        </div>

        {/* Visualize Section */}
        <div>
          <h4 className="text-[11px] font-semibold text-gray-500 mb-3 px-1 select-none uppercase tracking-wider">Visualize</h4>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {visualizeItems.map((item) => (
              <ItemButton key={item.title} icon={item.icon} title={item.title} />
            ))}
          </div>
        </div>

        {/* Explain Section */}
        <div>
          <h4 className="text-[11px] font-semibold text-gray-500 mb-3 px-1 select-none uppercase tracking-wider">Explain</h4>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {explainItems.map((item) => (
              <ItemButton key={item.title} icon={item.icon} title={item.title} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
