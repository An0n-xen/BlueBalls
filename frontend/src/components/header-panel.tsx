"use client"

import * as React from "react"
import {
  X,
  GripVertical,
  Heading1,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Check,
} from "lucide-react"

type HeaderConfig = {
  title: string
  description: string
  textSize: "small" | "medium" | "large"
  textAlignment: "left" | "center" | "right"
  backgroundColor: string
}

type HeaderPanelProps = {
  isOpen: boolean
  onClose: () => void
  onAddHeader: (config: HeaderConfig) => void
}

const bgColors = [
  // Row 1 - Dark tones
  { value: "from-gray-900 to-gray-800", preview: "#111827" },
  { value: "from-gray-800 to-gray-700", preview: "#1f2937" },
  { value: "from-blue-950 to-blue-900", preview: "#172554" },
  { value: "from-slate-800 to-slate-700", preview: "#334155" },
  // Row 2 - Vibrant
  { value: "from-rose-600 to-pink-500", preview: "#e11d48" },
  { value: "from-purple-400 to-pink-300", preview: "#c084fc" },
  { value: "from-cyan-400 to-sky-300", preview: "#22d3ee" },
  { value: "from-emerald-400 to-teal-300", preview: "#34d399" },
  // Row 3 - Warm
  { value: "from-amber-400 to-orange-300", preview: "#fbbf24" },
]

export function HeaderPanel({
  isOpen,
  onClose,
  onAddHeader,
}: HeaderPanelProps) {
  const [title, setTitle] = React.useState("Your Title Here")
  const [description, setDescription] = React.useState("")
  const [textSize, setTextSize] = React.useState<"small" | "medium" | "large">("medium")
  const [textAlignment, setTextAlignment] = React.useState<"left" | "center" | "right">("center")
  const [selectedBg, setSelectedBg] = React.useState(bgColors[2].value)

  React.useEffect(() => {
    if (isOpen) {
      setTitle("Your Title Here")
      setDescription("")
      setTextSize("medium")
      setTextAlignment("center")
      setSelectedBg(bgColors[2].value)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = () => {
    if (!title.trim()) return
    onAddHeader({
      title: title.trim(),
      description: description.trim(),
      textSize,
      textAlignment,
      backgroundColor: selectedBg,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 pointer-events-none">
      <div className="pointer-events-auto w-[340px] bg-[#0c0e14] border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-white/20" />
            <Heading1 className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white/90">Header</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/60 p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="flex items-center gap-1 text-xs font-semibold text-blue-400">
                <span>✱</span> Header Title
              </label>
              <span className="text-[10px] text-white/25">{title.length}/50</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 50))}
              placeholder="Your Title Here"
              className="w-full px-3 py-2.5 text-sm bg-white/[0.04] border border-white/10 rounded-lg text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/30"
            />
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="flex items-center gap-1 text-xs font-semibold text-blue-400">
                <span>✱</span> Description
              </label>
              <span className="text-[10px] text-white/25">{description.length}/300</span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 300))}
              placeholder="Enter description"
              rows={3}
              className="w-full px-3 py-2.5 text-sm bg-white/[0.04] border border-white/10 rounded-lg text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/30 resize-y min-h-[60px]"
            />
          </div>

          {/* Text Size */}
          <div>
            <label className="text-xs font-medium text-white/40 mb-2 block">Text Size</label>
            <div className="flex rounded-lg border border-white/10 overflow-hidden">
              {(["small", "medium", "large"] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setTextSize(size)}
                  className={`flex-1 py-2 text-center transition-colors border-r last:border-r-0 border-white/10 ${
                    textSize === size
                      ? "bg-blue-500/15 text-blue-400"
                      : "bg-white/[0.02] text-white/40 hover:text-white/60"
                  }`}
                >
                  <span className={`font-medium ${size === "small" ? "text-xs" : size === "medium" ? "text-sm" : "text-base"}`}>
                    Aa
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Text Alignment */}
          <div>
            <label className="text-xs font-medium text-white/40 mb-2 block">Text Alignment</label>
            <div className="flex rounded-lg border border-white/10 overflow-hidden">
              {([
                { value: "left" as const, icon: AlignLeft },
                { value: "center" as const, icon: AlignCenter },
                { value: "right" as const, icon: AlignRight },
              ]).map(({ value, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTextAlignment(value)}
                  className={`flex-1 flex items-center justify-center py-2.5 transition-colors border-r last:border-r-0 border-white/10 ${
                    textAlignment === value
                      ? "bg-blue-500/15 text-blue-400"
                      : "bg-white/[0.02] text-white/40 hover:text-white/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Background Color */}
          <div>
            <label className="text-xs font-medium text-white/40 mb-2 block">Background Color</label>
            <div className="grid grid-cols-4 gap-2">
              {bgColors.map((bg) => (
                <button
                  key={bg.value}
                  onClick={() => setSelectedBg(bg.value)}
                  className={`w-full aspect-[2/1] rounded-lg transition-all ${
                    selectedBg === bg.value
                      ? "ring-2 ring-blue-400 ring-offset-1 ring-offset-[#0c0e14] scale-105"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: bg.preview }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="w-full py-2.5 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <Heading1 className="w-4 h-4" />
            Add Header
          </button>
        </div>
      </div>
    </div>
  )
}
