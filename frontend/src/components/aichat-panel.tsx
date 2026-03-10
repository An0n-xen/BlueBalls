"use client"

import * as React from "react"
import { Grip, X, Send, Eraser, Loader2, Sparkles, BarChart2 } from "lucide-react"
import axios from "axios"

axios.defaults.baseURL = "http://localhost:8000/api/v1"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  isLoading?: boolean
  isError?: boolean
}

export function AiChatPanel({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [position, setPosition] = React.useState({ x: 90, y: 100 })
  const [isDragging, setIsDragging] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [inputMessage, setInputMessage] = React.useState("")
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [datasetId, setDatasetId] = React.useState<string | null>(null)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const dragRef = React.useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.datasetId) {
        setDatasetId(detail.datasetId)
      }
    }
    window.addEventListener("dataset-info", handler)
    return () => window.removeEventListener("dataset-info", handler)
  }, [])

  React.useEffect(() => {
    setMounted(true)
    const vh = window.innerHeight
    const itemHeight = 640
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

  const handleSendMessage = async (query: string) => {
    if (!query.trim() || isProcessing) return
    if (!datasetId) {
      const noDataMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: "Please upload a dataset first before asking questions. I need data to work with!",
        isError: true,
      }
      setMessages(prev => [...prev, noDataMsg])
      return
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query.trim(),
    }

    const loadingMsg: ChatMessage = {
      id: `loading-${Date.now()}`,
      role: "assistant",
      content: "Analyzing your data and generating a visualization...",
      isLoading: true,
    }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setInputMessage("")
    setIsProcessing(true)

    try {
      const resp = await axios.post("/charts/generate", {
        dataset_id: datasetId,
        user_query: query.trim(),
      })

      const spec = resp.data.chart_spec?.chart_spec || resp.data.chart_spec
      const sqlQuery = resp.data.sql_query

      // Dispatch chart to the dashboard
      window.dispatchEvent(
        new CustomEvent("ai-chart-generated", {
          detail: {
            query: query.trim(),
            chart_spec: spec,
            sql_query: sqlQuery,
          },
        })
      )

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: spec
          ? `✅ Done! I've added a chart for "${query.trim()}" to your dashboard.`
          : "I ran the query successfully but couldn't generate a chart visualization.",
      }

      setMessages(prev => [...prev.filter(m => m.id !== loadingMsg.id), assistantMsg])
    } catch (err) {
      const e = err as any
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `Sorry, I ran into an issue: ${e.response?.data?.detail || e.message || "Failed to generate chart"}. Try rephrasing your question.`,
        isError: true,
      }
      setMessages(prev => [...prev.filter(m => m.id !== loadingMsg.id), errorMsg])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    handleSendMessage(inputMessage)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleClear = () => {
    setMessages([])
    setInputMessage("")
  }

  if (!mounted) return null

  const quickActions = [
    "What are the most interesting patterns in this data?",
    "Generate a chart showing the distribution of key metrics.",
    "Show me the top trends over time.",
  ]

  const showQuickActions = messages.length === 0

  return (
    <div 
      className={`fixed z-50 flex flex-col w-[380px] h-[640px] rounded-xl bg-[#0f0f0f] text-gray-200 shadow-2xl border border-white/10 overflow-hidden transition-all duration-300 ease-out ${open ? "opacity-100 scale-100 translate-x-0 pointer-events-auto blur-0" : "opacity-0 scale-95 -translate-x-6 pointer-events-none blur-sm"}`}
      style={{ left: position.x, top: position.y, transitionProperty: "opacity, transform, blur, box-shadow" }}
      onPointerDown={onPointerDownDrag}
      onPointerMove={onPointerMoveDrag}
      onPointerUp={onPointerUpDrag}
      onPointerCancel={onPointerUpDrag}
    >
      {/* Header */}
      <div className="drag-handle flex items-center justify-between px-4 py-3 border-b border-white/5 cursor-grab active:cursor-grabbing bg-gradient-to-r from-blue-950/30 to-purple-950/20">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-200 select-none pointer-events-none">
          <Grip className="h-4 w-4 text-gray-500" />
          <Sparkles className="h-3.5 w-3.5 text-blue-400" />
          AI Assistant
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button 
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleClear}
              className="text-gray-500 hover:text-gray-300 transition-colors z-10 p-1.5 hover:bg-white/5 rounded-md"
              title="Clear conversation"
            >
              <Eraser className="h-3.5 w-3.5" />
            </button>
          )}
          <button 
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-300 transition-colors z-10 p-1.5 hover:bg-white/5 rounded-md"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-[#111111]" onPointerDown={(e) => e.stopPropagation()}>
        
        {/* Welcome message */}
        <div className="flex gap-2.5">
          <div className="shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mt-0.5">
            <Sparkles className="h-3 w-3 text-white" />
          </div>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl rounded-tl-sm p-3 text-[13px] leading-relaxed text-gray-300 max-w-[280px]">
            <p>Hi! I'm your data assistant. Ask me anything about your dataset and I'll generate visualizations on your dashboard.</p>
            {!datasetId && (
              <p className="mt-2 text-amber-400/80 text-xs">⚠ No dataset connected yet. Upload a file first.</p>
            )}
          </div>
        </div>

        {/* Quick actions */}
        {showQuickActions && datasetId && (
          <div className="space-y-2 pt-2">
            <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium px-1">Quick actions</span>
            {quickActions.map((action, idx) => (
              <button 
                key={idx}
                onClick={() => handleSendMessage(action)}
                disabled={isProcessing}
                className="w-full text-left px-3.5 py-2.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.04] hover:border-blue-500/20 text-gray-400 hover:text-gray-300 text-[12.5px] transition-all bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-2">
                  <BarChart2 className="h-3.5 w-3.5 text-blue-400/60 mt-0.5 shrink-0" />
                  <span>{action}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mt-0.5">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
            )}
            <div className={`max-w-[280px] ${
              msg.role === "user" 
                ? "bg-blue-600/20 border border-blue-500/20 rounded-xl rounded-tr-sm px-3.5 py-2.5" 
                : "bg-white/[0.04] border border-white/[0.06] rounded-xl rounded-tl-sm px-3.5 py-2.5"
            }`}>
              {msg.isLoading && (
                <div className="flex items-center gap-2 text-[13px] text-gray-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                  <span>{msg.content}</span>
                </div>
              )}

              {msg.isError && !msg.isLoading && (
                <p className="text-[13px] text-red-400/80 leading-relaxed">{msg.content}</p>
              )}

              {!msg.isLoading && !msg.isError && (
                <p className={`text-[13px] leading-relaxed ${msg.role === "user" ? "text-blue-100" : "text-gray-300"}`}>
                  {msg.content}
                </p>
              )}
            </div>
            {msg.role === "user" && (
              <div className="shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center mt-0.5">
                <span className="text-[10px] font-bold text-white">U</span>
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-3 bg-[#0a0a0a] border-t border-white/[0.06]" onPointerDown={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="relative rounded-xl border border-white/[0.12] bg-white/[0.02] focus-within:ring-1 focus-within:ring-blue-500/30 focus-within:border-blue-500/20 transition-all">
            <textarea 
              placeholder={datasetId ? "Ask about your data..." : "Upload a dataset first..."}
              className="w-full min-h-[60px] max-h-[100px] p-3 pb-10 bg-transparent text-[13px] resize-none focus:outline-none placeholder:text-gray-500/50 text-gray-200"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!datasetId || isProcessing}
            />
            <div className="absolute bottom-2 left-2.5 right-2.5 flex justify-between items-center">
              <button 
                type="button"
                onClick={handleClear}
                className="p-1.5 text-gray-600 hover:text-gray-400 hover:bg-white/5 rounded-md transition-colors"
                title="Clear conversation"
              >
                <Eraser className="h-3.5 w-3.5" />
              </button>
              <button 
                type="submit"
                disabled={!inputMessage.trim() || isProcessing || !datasetId}
                className={`p-1.5 rounded-md transition-all ${
                  inputMessage.trim() && !isProcessing && datasetId
                    ? 'text-blue-400 hover:bg-blue-500/10 hover:text-blue-300' 
                    : 'text-gray-600 cursor-not-allowed'
                }`}
              >
                {isProcessing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
