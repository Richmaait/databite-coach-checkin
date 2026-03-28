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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl relative">
          <div className="absolute -inset-20 bg-violet-500/10 blur-[80px] rounded-full pointer-events-none" />
          <div className="flex flex-col items-center gap-6 relative z-10">
            <h1 className="text-2xl font-semibold tracking-tight text-center text-white/90">
              Sign in to continue
            </h1>
            <p className="text-sm text-white/50 text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl shadow-lg hover:shadow-xl transition-all relative z-10"
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
    <div className="flex min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Ambient glow blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-violet-500/[0.05] blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-fuchsia-500/[0.05] blur-[120px]" />
      </div>
      {/* Sidebar */}
      <div
        className="relative flex-shrink-0 flex flex-col border-r border-white/[0.08] bg-white/[0.03] backdrop-blur-xl transition-all duration-200 ease-in-out z-50"
        style={{ width: hovered ? 220 : 52 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Logo / header area */}
        <div className="h-12 flex items-center px-3 border-b border-white/[0.08] overflow-hidden">
          <span
            className="font-semibold text-sm text-white/70 whitespace-nowrap transition-opacity duration-150"
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
                  flex items-center gap-3 w-full px-3 py-2.5 text-sm font-normal transition-colors rounded-lg mx-0
                  ${isActive
                    ? "text-white bg-white/10"
                    : "text-white/50 hover:bg-white/[0.06] hover:text-white/80"
                  }
                `}
              >
                <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-white/50"}`} />
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
        <div className="p-2 border-t border-white/[0.08] overflow-hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-white/[0.06] transition-colors w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={!hovered ? (user?.name ?? "Account") : undefined}
              >
                <Avatar className="h-8 w-8 border border-white/10 shrink-0">
                  <AvatarFallback className="text-xs font-medium bg-white/10 text-white/70">
                    {user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div
                  className="flex-1 min-w-0 overflow-hidden transition-all duration-150"
                  style={{ opacity: hovered ? 1 : 0, maxWidth: hovered ? 160 : 0 }}
                >
                  <p className="text-sm font-medium truncate leading-none whitespace-nowrap text-white/80">
                    {user?.name || "-"}
                  </p>
                  <p className="text-xs text-white/30 truncate mt-1 whitespace-nowrap">
                    {user?.email || "-"}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-zinc-900/95 backdrop-blur-xl border border-white/10">
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
      <main className="flex-1 min-w-0 overflow-auto relative z-10">
        {children}
      </main>
    </div>
  );
}
