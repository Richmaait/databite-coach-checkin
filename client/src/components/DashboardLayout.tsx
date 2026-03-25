import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getLoginUrl } from "@/const";
import { LayoutDashboard, LogOut, Users, ClipboardCheck, BarChart3, ListChecks, TrendingUp, Activity, FileBarChart2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import DashboardLayoutSkeleton from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

const allMenuItems = [
  { icon: LayoutDashboard, label: "Home", path: "/", adminOnly: false },
  { icon: ClipboardCheck, label: "My Check-Ins", path: "/coach", adminOnly: false },
  { icon: ListChecks, label: "Client Check-Ins", path: "/client-checkins", adminOnly: false },
  { icon: BarChart3, label: "Dashboard", path: "/dashboard", adminOnly: true },
  { icon: TrendingUp, label: "Coach Activity", path: "/coach-performance", adminOnly: true },
  { icon: Activity, label: "Client Progress", path: "/client-progress", adminOnly: false },
  { icon: FileBarChart2, label: "Weekly Summary", path: "/weekly-summary", adminOnly: true },
  { icon: Users, label: "Team", path: "/team", adminOnly: true },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user } = useAuth();

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [hovered, setHovered] = useState(false);
  const isAdmin = user?.role === "admin";
  const menuItems = allMenuItems.filter(item => !item.adminOnly || isAdmin);

  // Redirect non-admins away from admin-only pages
  useEffect(() => {
    if (!user) return;
    const currentItem = allMenuItems.find(item => item.path === location);
    if (currentItem?.adminOnly && user.role !== "admin") {
      setLocation("/coach");
    }
  }, [user, location, setLocation]);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div
        className="relative flex-shrink-0 flex flex-col border-r border-border bg-sidebar transition-all duration-200 ease-in-out z-50"
        style={{ width: hovered ? 220 : 52 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Logo / header area */}
        <div className="h-12 flex items-center px-3 border-b border-border overflow-hidden">
          <span
            className="font-semibold text-sm text-sidebar-foreground whitespace-nowrap transition-opacity duration-150"
            style={{ opacity: hovered ? 1 : 0, pointerEvents: "none" }}
          >
            Navigation
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-2 overflow-hidden">
          {menuItems.map(item => {
            const isActive = location === item.path;
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                title={!hovered ? item.label : undefined}
                className={`
                  flex items-center gap-3 w-full px-3 py-2.5 text-sm font-normal transition-colors
                  ${isActive
                    ? "text-primary bg-primary/10"
                    : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground"
                  }
                `}
              >
                <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                <span
                  className="whitespace-nowrap overflow-hidden transition-all duration-150"
                  style={{
                    opacity: hovered ? 1 : 0,
                    maxWidth: hovered ? 160 : 0,
                    pointerEvents: "none",
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Footer / user */}
        <div className="p-2 border-t border-border overflow-hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={!hovered ? (user?.name ?? "Account") : undefined}
              >
                <Avatar className="h-8 w-8 border shrink-0">
                  <AvatarFallback className="text-xs font-medium">
                    {user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div
                  className="flex-1 min-w-0 overflow-hidden transition-all duration-150"
                  style={{ opacity: hovered ? 1 : 0, maxWidth: hovered ? 160 : 0 }}
                >
                  <p className="text-sm font-medium truncate leading-none whitespace-nowrap">
                    {user?.name || "-"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-1 whitespace-nowrap">
                    {user?.email || "-"}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={logout}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
