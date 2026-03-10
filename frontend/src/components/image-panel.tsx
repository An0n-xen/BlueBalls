"use client"

import * as React from "react"
import {
  X,
  GripVertical,
  Image as ImageIcon,
  Upload,
  Link,
  Maximize,
  RectangleHorizontal,
} from "lucide-react"

type ImageConfig = {
  imageUrl: string
  appearance: "fit" | "fill"
}

type ImagePanelProps = {
  isOpen: boolean
  onClose: () => void
  onAddImage: (config: ImageConfig) => void
}

export function ImagePanel({
  isOpen,
  onClose,
  onAddImage,
}: ImagePanelProps) {
  const [activeTab, setActiveTab] = React.useState<"upload" | "url">("upload")
  const [imageUrl, setImageUrl] = React.useState("")
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [appearance, setAppearance] = React.useState<"fit" | "fill">("fit")
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab("upload")
      setImageUrl("")
      setPreviewUrl(null)
      setAppearance("fit")
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      setImageUrl(url)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      setImageUrl(url)
    }
  }

  const handleSubmit = () => {
    const finalUrl = activeTab === "url" ? imageUrl : previewUrl
    if (finalUrl) {
      onAddImage({ imageUrl: finalUrl, appearance })
    }
  }

  const hasImage = activeTab === "upload" ? !!previewUrl : !!imageUrl

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 pointer-events-none">
      <div className="pointer-events-auto w-[380px] bg-[#0c0e14] border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-white/20" />
            <ImageIcon className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white/90">Image</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/60 p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-5">
          {/* Tab Switcher */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => setActiveTab("upload")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "upload"
                  ? "bg-blue-500/15 text-blue-400 border-r border-white/10"
                  : "bg-white/[0.02] text-white/40 hover:text-white/60 border-r border-white/10"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Image
            </button>
            <button
              onClick={() => setActiveTab("url")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "url"
                  ? "bg-blue-500/15 text-blue-400"
                  : "bg-white/[0.02] text-white/40 hover:text-white/60"
              }`}
            >
              <Link className="w-3.5 h-3.5" />
              By URL
            </button>
          </div>

          {/* Upload Tab */}
          {activeTab === "upload" && (
            <div>
              {previewUrl ? (
                <div className="relative group">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-40 object-contain rounded-lg bg-white/[0.02] border border-white/10"
                  />
                  <button
                    onClick={() => {
                      setPreviewUrl(null)
                      setImageUrl("")
                    }}
                    className="absolute top-2 right-2 p-1 rounded bg-black/60 text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="flex items-center justify-between px-4 py-4 bg-white/[0.03] rounded-lg border border-dashed border-white/15 hover:border-blue-500/30 cursor-pointer transition-colors group"
                >
                  <span className="text-sm text-white/30 group-hover:text-white/50">Upload Image</span>
                  <Upload className="w-5 h-5 text-white/20 group-hover:text-blue-400 transition-colors" />
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {/* URL Tab */}
          {activeTab === "url" && (
            <div className="space-y-3">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.png"
                className="w-full px-3 py-2.5 text-sm bg-white/[0.04] border border-white/10 rounded-lg text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/30"
              />
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-full h-32 object-contain rounded-lg bg-white/[0.02] border border-white/10"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                />
              )}
            </div>
          )}

          {/* Image Appearance */}
          <div>
            <label className="text-xs font-medium text-white/40 mb-2 block">
              Image Appearance
            </label>
            <div className="flex rounded-lg border border-white/10 overflow-hidden">
              <button
                onClick={() => setAppearance("fit")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-r border-white/10 ${
                  appearance === "fit"
                    ? "bg-blue-500/15 text-blue-400"
                    : "bg-white/[0.02] text-white/40 hover:text-white/60"
                }`}
              >
                <Maximize className="w-3.5 h-3.5" />
                Fit
              </button>
              <button
                onClick={() => setAppearance("fill")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                  appearance === "fill"
                    ? "bg-blue-500/15 text-blue-400"
                    : "bg-white/[0.02] text-white/40 hover:text-white/60"
                }`}
              >
                <RectangleHorizontal className="w-3.5 h-3.5" />
                Fill
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <button
            onClick={handleSubmit}
            disabled={!hasImage}
            className="w-full py-2.5 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <ImageIcon className="w-4 h-4" />
            Add Image
          </button>
        </div>
      </div>
    </div>
  )
}
