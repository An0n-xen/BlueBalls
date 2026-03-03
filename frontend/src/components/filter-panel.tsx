"use client"

import * as React from "react"
import { Grip, X, Search, ChevronDown, CheckCircle2 } from "lucide-react"

const categories = [
  { name: "Patient Id", count: 420, color: "bg-red-500" },
  { name: "Age", count: 37, color: "bg-orange-500" },
  { name: "Sex", count: 2, color: "bg-yellow-400" },
  { name: "Residence", count: 400, color: "bg-green-800" },
  { name: "Sickle Cell Type", count: 3, color: "bg-green-500" },
  { name: "Comorbidities", count: 17, color: "bg-teal-500" },
  { name: "Length Of Stay For Each Admission 1", count: 9, color: "bg-lime-400" },
]

export function FilterPanel({ open, onClose }: { open: boolean, onClose: () => void }) {
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

  if (!mounted || !open) return null

  return (
    <div 
      className="fixed z-50 flex flex-col w-[800px] h-[600px] rounded-xl bg-popover text-popover-foreground shadow-2xl border border-border/50 overflow-hidden"
      style={{ left: position.x, top: position.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="drag-handle flex items-center justify-between px-6 py-4 border-b border-border/50 cursor-grab active:cursor-grabbing bg-muted/30">
        <div className="flex items-center gap-2 text-base font-semibold text-popover-foreground select-none pointer-events-none">
          <Grip className="h-5 w-5 text-muted-foreground" />
          Global Filters
        </div>
        <button 
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose} 
          className="text-muted-foreground hover:text-popover-foreground transition-colors z-10 p-1"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      <div className="px-6 py-3 border-b border-border/50 bg-muted/10">
        <p className="text-sm text-muted-foreground">Build your filters by selecting the tags</p>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left Panel */}
        <div className="w-[300px] border-r border-border/50 flex flex-col min-h-0 bg-muted/5">
          <div className="p-4 space-y-4">
            {/* Sheet Selector */}
            <div className="flex items-center justify-between w-full p-2.5 bg-background border border-border rounded-md text-sm cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2 text-foreground">
                <div className="w-4 h-4 rounded bg-muted flex items-center justify-center">
                  <span className="text-[10px] font-bold">∑</span>
                </div>
                <span className="font-medium">SCD Paedics.xlsx - Sheet1</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search" 
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="px-4 pb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Categories
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 custom-scrollbar">
            {categories.map((category) => (
              <button 
                key={category.name}
                className="w-full flex items-center justify-between p-3 bg-background border border-border rounded-md hover:border-border/80 hover:shadow-sm transition-all text-left relative overflow-hidden group"
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${category.color}`} />
                <span className="pl-2 font-medium text-sm text-foreground/90 truncate mr-2">{category.name}</span>
                <span className="text-xs text-muted-foreground font-medium">{category.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-muted/5">
          <p className="text-muted-foreground text-[15px] text-center max-w-sm">
            Select from the list of columns in the left panel to start filtering
          </p>
        </div>
      </div>
    </div>
  )
}
