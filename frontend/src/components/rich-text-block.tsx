"use client"

import * as React from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import TiptapColor from "@tiptap/extension-color"
import { TextStyle } from "@tiptap/extension-text-style"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  ChevronDown,
  Trash2,
  GripVertical,
  Check,
  Palette,
} from "lucide-react"

type RichTextBlockProps = {
  id: string
  initialContent?: string
  onContentChange?: (id: string, html: string) => void
  onRemove?: (id: string) => void
}

export function RichTextBlock({
  id,
  initialContent = "",
  onContentChange,
  onRemove,
}: RichTextBlockProps) {
  const [isEditing, setIsEditing] = React.useState(true)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      TiptapColor.configure({ types: ["textStyle"] }),
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: "Start writing..." }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-sm max-w-none focus:outline-none min-h-[80px] px-4 py-3 text-white/85 leading-relaxed",
      },
    },
    onUpdate: ({ editor }) => {
      onContentChange?.(id, editor.getHTML())
    },
  })

  const handleDone = () => {
    setIsEditing(false)
  }

  const handleEdit = () => {
    setIsEditing(true)
    setTimeout(() => editor?.commands.focus(), 0)
  }

  if (!editor) return null

  const ToolbarButton = ({
    onClick,
    isActive = false,
    children,
    title,
  }: {
    onClick: () => void
    isActive?: boolean
    children: React.ReactNode
    title: string
  }) => (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        isActive
          ? "bg-white/15 text-white"
          : "text-white/50 hover:text-white hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  )

  const ToolbarDivider = () => (
    <div className="w-px h-5 bg-white/10 mx-0.5" />
  )

  return (
    <div
      className="group border border-blue-500/10 bg-black/40 backdrop-blur-md rounded-xl shadow-xl hover:border-blue-500/20 transition-all overflow-hidden relative"
    >
      {/* Top bar with drag handle + actions */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.03] bg-white/[0.01]">
        <div className="flex items-center gap-1 text-white/20 hover:text-white/40 transition-colors">
          <GripVertical className="w-4 h-4" />
          <span className="text-[11px] font-medium select-none">Rich Text</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onPointerDown={(e) => e.stopPropagation()}>
          {!isEditing && (
            <button
              onClick={handleEdit}
              className="text-[11px] text-white/30 hover:text-blue-400 px-2 py-1 rounded transition-colors"
            >
              Edit
            </button>
          )}
          <button
            onClick={() => onRemove?.(id)}
            className="text-white/20 hover:text-red-400 p-1 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Toolbar — only when editing */}
      {isEditing && (
        <div className="flex items-center gap-0.5 px-3 py-2 border-b border-white/[0.05] bg-white/[0.02] flex-wrap" onPointerDown={(e) => e.stopPropagation()}>
          {/* Block type selector */}
          <div className="relative">
            <select
              value={
                editor.isActive("heading", { level: 1 })
                  ? "h1"
                  : editor.isActive("heading", { level: 2 })
                  ? "h2"
                  : editor.isActive("heading", { level: 3 })
                  ? "h3"
                  : "p"
              }
              onChange={(e) => {
                const val = e.target.value
                if (val === "p") editor.chain().focus().setParagraph().run()
                else if (val === "h1") editor.chain().focus().toggleHeading({ level: 1 }).run()
                else if (val === "h2") editor.chain().focus().toggleHeading({ level: 2 }).run()
                else if (val === "h3") editor.chain().focus().toggleHeading({ level: 3 }).run()
              }}
              className="appearance-none bg-white/5 border border-white/10 rounded-md px-2 py-1 pr-6 text-xs text-white/70 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            >
              <option value="p">Paragraph</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/40 pointer-events-none" />
          </div>

          <ToolbarDivider />

          {/* Text formatting */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive("bold")}
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive("italic")}
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive("underline")}
            title="Underline"
          >
            <UnderlineIcon className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive("strike")}
            title="Strikethrough"
          >
            <Strikethrough className="w-4 h-4" />
          </ToolbarButton>

          {/* Text color */}
          <div className="relative">
            <ToolbarButton
              onClick={() => {}}
              title="Text Color"
            >
              <Palette className="w-4 h-4" />
            </ToolbarButton>
            <input
              type="color"
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              onChange={(e) =>
                editor.chain().focus().setColor(e.target.value).run()
              }
              title="Pick text color"
            />
          </div>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive("code")}
            title="Inline Code"
          >
            <Code className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Alignment */}
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            isActive={editor.isActive({ textAlign: "left" })}
            title="Align Left"
          >
            <AlignLeft className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            isActive={editor.isActive({ textAlign: "center" })}
            title="Align Center"
          >
            <AlignCenter className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            isActive={editor.isActive({ textAlign: "right" })}
            title="Align Right"
          >
            <AlignRight className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Lists */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive("bulletList")}
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive("orderedList")}
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Link */}
          <ToolbarButton
            onClick={() => {
              const url = window.prompt("Enter URL:")
              if (url) {
                editor.chain().focus().setLink({ href: url }).run()
              }
            }}
            isActive={editor.isActive("link")}
            title="Insert Link"
          >
            <LinkIcon className="w-4 h-4" />
          </ToolbarButton>

          {/* Image */}
          <ToolbarButton
            onClick={() => {
              const url = window.prompt("Enter image URL:")
              if (url) {
                editor.chain().focus().setImage({ src: url }).run()
              }
            }}
            title="Insert Image"
          >
            <ImageIcon className="w-4 h-4" />
          </ToolbarButton>
        </div>
      )}

      {/* Editor Content */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => {
          if (!isEditing) handleEdit()
        }}
        className={!isEditing ? "cursor-pointer" : ""}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Done button */}
      {isEditing && (
        <div className="flex justify-end px-3 py-2 border-t border-white/[0.03]" onPointerDown={(e) => e.stopPropagation()}>
          <button
            onClick={handleDone}
            className="px-4 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-white/90 transition-colors flex items-center gap-1.5 shadow-md"
          >
            <Check className="w-3 h-3" />
            Done
          </button>
        </div>
      )}
    </div>
  )
}
