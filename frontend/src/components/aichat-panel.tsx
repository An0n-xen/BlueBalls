"use client"

import * as React from "react"
import { Grip, X, Sparkles, Send, Eraser } from "lucide-react"

export function AiChatPanel({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [position, setPosition] = React.useState({ x: 90, y: 100 })
  const [isDragging, setIsDragging] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [inputMessage, setInputMessage] = React.useState("")
  const dragRef = React.useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null)

  React.useEffect(() => {
    setMounted(true)
    // Initial position slightly above middle vertically
    const vh = window.innerHeight
    const itemHeight = 600 // roughly max height
    setPosition({ x: 90, y: Math.max(50, (vh - itemHeight) / 2) })
  }, [])

  const onPointerDownDrag = (e: React.PointerEvent) => {
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

  const onPointerMoveDrag = (e: React.PointerEvent) => {
    if (isDragging && dragRef.current) {
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      setPosition({
        x: dragRef.current.initX + dx,
        y: dragRef.current.initY + dy,
      })
    }
  }

  const onPointerUpDrag = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false)
      dragRef.current = null
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  if (!mounted) return null

  const quickActions = [
    "Can you recommend some interesting insights?",
    "Please generate a chart for me.",
    "How do I add more data to my board?"
  ]

  return (
    <div 
      className={`fixed z-50 flex flex-col w-[340px] h-[580px] rounded-xl bg-[#0f0f0f] text-gray-200 shadow-2xl border border-white/10 overflow-hidden transition-all duration-300 ease-out ${open ? "opacity-100 scale-100 translate-x-0 pointer-events-auto blur-0" : "opacity-0 scale-95 -translate-x-6 pointer-events-none blur-sm"}`}
      style={{ left: position.x, top: position.y, transitionProperty: "opacity, transform, blur, box-shadow" }}
      onPointerDown={onPointerDownDrag}
      onPointerMove={onPointerMoveDrag}
      onPointerUp={onPointerUpDrag}
      onPointerCancel={onPointerUpDrag}
    >
      <div className="drag-handle flex items-center justify-between px-4 py-3 border-b border-white/5 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-200 select-none pointer-events-none">
          <Grip className="h-4 w-4 text-gray-500" />
          AI Chat
        </div>
        <button 
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose} 
          className="text-gray-500 hover:text-gray-300 transition-colors z-10 p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#1a1a1a]">
        {/* Bot Message */}
        <div className="bg-[#0f0f0f] border border-white/5 rounded-xl rounded-tr-md p-4 text-[13.5px] leading-relaxed shadow-sm text-gray-300 space-y-4 ml-8">
          <p>Getting presentation ready.</p>
          <p>Before you share, give your story a custom look & feel!</p>
          <p>Use the style tab for custom colors or add context with some of our presentation blocks like headers, text, images, or Loom video.</p>
          <p>Let me know if I can help with any final touches!</p>
        </div>
      </div>

      <div className="p-4 bg-[#0a0a0a] space-y-3">
        {/* Quick Actions */}
        <div className="space-y-2">
          {quickActions.map((action, idx) => (
            <button 
              key={idx}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full text-left px-4 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 text-gray-400 hover:text-gray-300 text-[13px] transition-colors bg-transparent"
            >
              {action}
            </button>
          ))}
        </div>

        {/* Input Box */}
        <div 
          className="relative rounded-xl border border-white/20 bg-transparent focus-within:ring-1 focus-within:ring-white/30 focus-within:border-white/30 transition-all"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <textarea 
            placeholder="Ask a question or request."
            className="w-full min-h-[90px] p-4 pb-12 bg-transparent text-[13.5px] resize-none focus:outline-none placeholder:text-gray-500/70 text-gray-200"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
          />
          <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center">
            <button className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-md transition-colors">
              <Eraser className="h-4 w-4" />
            </button>
            <button 
              className={`p-1.5 rounded-md transition-colors ${inputMessage.trim() ? 'text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
