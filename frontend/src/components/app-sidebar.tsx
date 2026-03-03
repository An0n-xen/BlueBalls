"use client"

import * as React from "react"
import type { CSSProperties } from "react"
import {
  Sidebar,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { PlusCircle, Settings, MessageSquare, Filter, Database } from "lucide-react"
import { AddBlockPanel } from "./add-block-panel"
import { FilterPanel } from "./filter-panel"
import { AiChatPanel } from "./aichat-panel"

const items = [
  {
    title: "Add",
    icon: PlusCircle,
  },
  {
    title: "Setup",
    icon: Settings,
  },
  {
    title: "Filter",
    icon: Filter,
  },
  {
    title: "AI Chat",
    icon: MessageSquare,
  },
  {
    title: "Data",
    icon: Database,
  },
]

export function AppSidebar() {
  const [activePanel, setActivePanel] = React.useState<string | null>(null);

  return (
    <>
      <Sidebar variant="sidebar" collapsible="none" className="!h-svh" style={{ "--sidebar-width": "4.5rem" } as CSSProperties}>
        <SidebarHeader className="border-b border-border/10 px-2 py-4 shrink-0">
          <div className="flex items-center justify-center text-primary font-bold text-lg tracking-tight">
            <div className="bg-blue-600 text-white px-1.5 py-0.5 rounded-md">
              <span className="leading-none text-xl font-black">B</span>
            </div>
          </div>
        </SidebarHeader>

        <div className="flex flex-1 flex-col items-center justify-center min-h-0">
          <nav className="flex flex-col items-center gap-4">
            {items.map((item) => {
              const isPanelTrigger = ["Add", "Filter", "AI Chat"].includes(item.title);
              const isOpen = activePanel === item.title;

              return (
                 <a
                  key={item.title}
                  href="#"
                  onClick={(e) => {
                    if (isPanelTrigger) {
                      e.preventDefault();
                      setActivePanel(isOpen ? null : item.title);
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-1.5 px-3 py-2 text-center transition-colors rounded-md hover:bg-sidebar-accent ${isOpen ? 'text-primary bg-sidebar-accent' : 'text-sidebar-foreground/70 hover:text-primary'}`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="text-[11px] leading-none">{item.title}</span>
                </a>
              )
            })}
          </nav>
        </div>

        <SidebarFooter className="hidden" />
      </Sidebar>

      <AddBlockPanel open={activePanel === "Add"} onClose={() => setActivePanel(null)} />
      <FilterPanel open={activePanel === "Filter"} onClose={() => setActivePanel(null)} />
      <AiChatPanel open={activePanel === "AI Chat"} onClose={() => setActivePanel(null)} />
    </>
  )
}
