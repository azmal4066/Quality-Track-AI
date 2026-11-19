import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, ScanSearch, Layers, Bug, Package, History, BarChart3, FileText, Bot, Users, Settings, PanelLeftClose, PanelLeftOpen, Sun, Moon, LogOut, Menu, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import type { Role } from "../types";

const NAV: { to: string; label: string; icon: any; roles?: Role[] }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inspect", label: "AI Inspection", icon: ScanSearch, roles: ["super_admin", "admin", "inspector"] },
  { to: "/batch", label: "Batch Inspection", icon: Layers, roles: ["super_admin", "admin", "inspector"] },
  { to: "/defects", label: "Defect Management", icon: Bug },
  { to: "/products", label: "Products", icon: Package },
  { to: "/history", label: "Inspection History", icon: History },
  { to: "/analytics", label: "Quality Analytics", icon: BarChart3 },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/assistant", label: "AI Assistant", icon: Bot },
  { to: "/employees", label: "Employees", icon: Users, roles: ["super_admin", "admin"] },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile, can, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const loc = useLocation();
  const current = NAV.find(n => (n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to)));

  const sidebar = (
    <aside className={clsx("flex h-full flex-col border-r border-line bg-side transition-[width] duration-200", collapsed ? "w-[72px]" : "w-64")}>
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand shadow-glow"><ShieldCheck className="h-5 w-5 text-white" /></div>
        {!collapsed && <span className="text-lg font-extrabold tracking-tight">QualityTrack<span className="text-cyan"> AI</span></span>}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV.filter(n => !n.roles || can(...n.roles)).map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"} onClick={() => setMobileOpen(false)} title={collapsed ? n.label : undefined}
            className={({ isActive }) => clsx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
              isActive ? "bg-brand/15 text-brand" : "text-mute hover:bg-line/40 hover:text-ink")}>
            <n.icon className="h-5 w-5 shrink-0" />{!collapsed && n.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <button onClick={() => setCollapsed(c => !c)} className="hidden w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-mute hover:bg-line/40 lg:flex">
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <><PanelLeftClose className="h-5 w-5" />Collapse</>}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-full">
      <div className="hidden lg:block">{sidebar}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 flex lg:hidden"><div className="h-full">{sidebar}</div><div className="flex-1 bg-black/60" onClick={() => setMobileOpen(false)} /></div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-side/70 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <span className="text-sm font-bold">{current?.label ?? "QualityTrack AI"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="btn-ghost !p-2.5" aria-label="Toggle theme">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">{profile?.full_name ?? profile?.email}</p>
              <p className="text-xs capitalize text-mute">{profile?.role.replace("_", " ")}</p>
            </div>
            <button onClick={signOut} className="btn-ghost !p-2.5" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
