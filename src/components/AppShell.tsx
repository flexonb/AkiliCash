import { useEffect, useState } from "react";
import { NavLink, useNavigate, Link } from "react-router-dom";
import { LayoutDashboard, Users, Banknote, Receipt, Wallet, Settings as SettingsIcon, LogOut, Archive } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/AppAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";
import { useOutbox } from "@/hooks/useOutbox";
import { OnlineIndicator } from "@/components/OnlineIndicator";

const companyNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/loans", label: "Cash-out", icon: Banknote },
  { to: "/payments", label: "Cash-in", icon: Receipt },
  { to: "/expenses", label: "Expenses", icon: Wallet },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const clientNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "#loans", label: "My Loans", icon: Banknote },
  { to: "#support", label: "Support", icon: Users },
];

function getInitials(name: string | null | undefined, fallback: string | null | undefined): string {
  const source = (name && name.trim()) || fallback || "";
  if (!source) return "?";
  const parts = source.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function UserMenu({ onSignOut }: { onSignOut: () => void }) {
  const { user, isAdmin, profile } = useAuth();
  const fullName = profile?.full_name ?? null;
  const avatarUrl = null;

  const initials = getInitials(fullName, user?.email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Open user menu"
          className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Avatar className="h-9 w-9 border-2 border-border bg-card text-foreground hover:border-primary transition-colors">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName ?? "User"} />}
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="space-y-0.5">
          <p className="text-sm font-medium truncate">{fullName ?? user?.email}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          {isAdmin && (
            <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-semibold">
              ADMIN
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin && (
          <>
            <DropdownMenuItem asChild>
              <Link to="/drawer" className="cursor-pointer">
                <Archive className="w-4 h-4 mr-2" /> Drawer history
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer">
                <SettingsIcon className="w-4 h-4 mr-2" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={onSignOut} className="cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="w-4 h-4 mr-2" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user, isAdmin, isClient } = useAuth();
  const { settings } = useSettings();

  const signOut = async () => {
    await api.auth.signOut();
    navigate("/auth");
  };

  useBackgroundSync();
  useOutbox();

  const navItems = isClient ? clientNavItems : companyNavItems;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="p-6 border-b border-sidebar-border flex items-center gap-3">
          <img src="/app-icon.png" alt="Logo" className="w-8 h-8 rounded-full object-cover" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">{isClient ? "AkiliCash" : settings.business_name}</h1>
            <p className="text-xs opacity-70 mt-1">{isClient ? "Borrower Dashboard" : "Microloan Management"}</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isHash = item.to.startsWith("#");
            const className = ({ isActive }: any) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                !isHash && isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              );

            if (isHash) {
              return (
                <a
                  key={item.to}
                  href={item.to}
                  onClick={(e) => {
                    const el = document.querySelector(item.to);
                    if (el) {
                      e.preventDefault();
                      el.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className={className({ isActive: false })}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </a>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={className}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs opacity-70 px-2 truncate">
            {user?.email}
            {isAdmin && <span className="ml-2 px-1.5 py-0.5 rounded bg-sidebar-primary text-sidebar-primary-foreground text-[10px] font-semibold">ADMIN</span>}
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <img src="/app-icon.png" alt="Logo" className="w-6 h-6 rounded-full object-cover" />
          <h1 className="font-bold">{isClient ? "AkiliCash" : settings.business_name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <OnlineIndicator />
          <UserMenu onSignOut={signOut} />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {/* Desktop top bar with avatar menu */}
        <div className="hidden md:flex items-center justify-end gap-2 px-8 pt-6">
          <OnlineIndicator />
          <UserMenu onSignOut={signOut} />
        </div>
        <div className="max-w-6xl mx-auto p-4 md:p-8 md:pt-4">{children}</div>
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border flex justify-around z-50 shadow-elegant px-1 pt-1 pb-[env(safe-area-inset-bottom)]">
        {navItems.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-0.5 py-2 px-1 flex-1 mx-0.5 rounded-lg text-[10px] font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
