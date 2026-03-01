"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { PlusCircle, Settings, MessageSquare, Filter, LayoutDashboard, Database } from "lucide-react"

const items = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    isActive: true,
  },
  {
    title: "Data",
    icon: Database,
    isActive: false,
  },
  {
    title: "Add",
    icon: PlusCircle,
    isActive: false,
  },
  {
    title: "Setup",
    icon: Settings,
    isActive: false,
  },
  {
    title: "Filter",
    icon: Filter,
    isActive: false,
  },
  {
    title: "AI Chat",
    icon: MessageSquare,
    isActive: false,
  },
]

export function AppSidebar() {
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="border-b border-border/10 p-4">
        <div className="flex items-center gap-2 text-primary font-bold text-lg">
          <div className="bg-primary text-black p-1 rounded">
             <span className="leading-none text-xl font-black">P</span>
          </div>
          <span className="group-data-[collapsible=icon]:hidden">Polymath</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={item.isActive} tooltip={item.title} className="hover:text-primary transition-colors">
                    <a href="#">
                      <item.icon className="w-5 h-5" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-border/10">
         <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Settings" className="hover:text-primary transition-colors">
                <a href="#">
                  <Settings className="w-5 h-5" />
                  <span>Settings</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
