import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Activity, BarChart3, CheckCircle2, ClipboardCheck, TrendingUp, UserCheck, Users } from "lucide-react";
import { melbourneNow } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// ─── Client Performance KPI Card ────────────────────────────────────────────
function ClientPerformanceKpiCard({ onClick }: { onClick: () => void }) {
  const { data: kpiData, isLoading } = trpc.performance.kpiSummary.useQuery(
    undefined,
    { staleTime: 60 * 1000 }
  );

  const greenPct = kpiData?.business?.greenPct ?? 0;
  const total = kpiData?.business?.total ?? 0;
  const target = kpiData?.target ?? 70;
  const met = greenPct >= target;

  return (
    <Card
      className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl cursor-pointer hover:border-white/20 transition-all hover:shadow-lg hover:shadow-violet-500/5 group"
      onClick={onClick}
    >
      <CardContent className="p-6 flex items-start gap-4">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
          isLoading ? "bg-zinc-800 border border-zinc-700" :
          met ? "bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/15" :
                "bg-amber-400/10 border border-amber-400/20 group-hover:bg-amber-400/15"
        }`}>
          <Activity className={`h-5 w-5 ${
            isLoading ? "text-zinc-500" : met ? "text-emerald-500" : "text-amber-400"
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white/90">Client Performance</h3>
          {isLoading ? (
            <div className="h-4 w-24 bg-zinc-700 rounded animate-pulse mt-1" />
          ) : total === 0 ? (
            <p className="text-sm text-white/50 mt-0.5">No ratings yet — rate your clients.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-lg font-bold ${met ? "text-emerald-400" : "text-amber-400"}`}>
                  {greenPct.toFixed(1)}%
                </span>
                <span className="text-xs text-white/50">on track</span>
                {met
                  ? <span className="text-xs text-emerald-500 font-medium">✓ KPI met</span>
                  : <span className="text-xs text-amber-400 font-medium">Target: {target}%</span>
                }
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${met ? "bg-emerald-500" : "bg-amber-400"}`}
                  style={{ width: `${Math.min(greenPct, 100)}%` }}
                />
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: coaches } = trpc.coaches.list.useQuery(undefined, { enabled: !!user });

  // Only non-admin users need to check their own coach profile
  const { data: myCoach, refetch: refetchMyCoach } = trpc.coaches.myCoach.useQuery(undefined, {
    enabled: !!user && user.role !== "admin",
  });

  // Unclaimed coaches — only needed when the user has no profile yet
  const { data: unclaimedCoaches } = trpc.coaches.unclaimed.useQuery(undefined, {
    enabled: !!user && user.role !== "admin" && !myCoach,
  });

  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [selectedCoachId, setSelectedCoachId] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const claimProfile = trpc.coaches.claimProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile claimed! Welcome to the team 🎉");
      setConfirmOpen(false);
      setClaimDialogOpen(false);
      setSelectedCoachId(null);
      refetchMyCoach();
      utils.coaches.unclaimed.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const selectedCoach = unclaimedCoaches?.find(c => c.id === selectedCoachId);

  if (loading) return null;

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full text-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl relative">
          <div className="absolute -inset-20 bg-violet-500/10 blur-[80px] rounded-full pointer-events-none" />
          <div className="flex flex-col items-center gap-3 relative z-10">
            <div className="h-16 w-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-2">
              <ClipboardCheck className="h-8 w-8 text-violet-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white/90">
              Coach Check-In
            </h1>
            <p className="text-white/50 text-sm leading-relaxed max-w-xs">
              Daily accountability tracking for your remote coaching team. Monitor engagement, follow-ups, and client retention in one place.
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl relative z-10"
          >
            Sign in to continue
          </Button>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "admin";

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 pt-20 pb-2">
        {/* Welcome */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white/90" style={{ fontFamily: "'Comfortaa', cursive" }}>
            Welcome back, {user.name?.split(" ")[0] ?? "there"}
          </h1>
          <p className="text-white/50 mt-1 text-sm">
            {melbourneNow().toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(myCoach || isAdmin) && (
            <Card
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl cursor-pointer hover:border-white/20 transition-all hover:shadow-lg hover:shadow-violet-500/5 group"
              onClick={() => setLocation("/coach")}
            >
              <CardContent className="p-6 flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-violet-500/15 transition-colors">
                  <ClipboardCheck className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white/90">Daily Check-Ins</h3>
                  <p className="text-sm text-white/50 mt-0.5">
                    Submit your morning review, follow-up outreach, and disengagement reports.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {myCoach && !isAdmin && (
            <Card
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl cursor-pointer hover:border-white/20 transition-all hover:shadow-lg hover:shadow-violet-500/5 group"
              onClick={() => setLocation("/client-checkins")}
            >
              <CardContent className="p-6 flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/15 transition-colors">
                  <UserCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-white/90">Client Check-Ins</h3>
                  <p className="text-sm text-white/50 mt-0.5">
                    Mark your clients' weekly check-ins as complete and track engagement.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {isAdmin && (
            <>
              <Card
                className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl cursor-pointer hover:border-white/20 transition-all hover:shadow-lg hover:shadow-violet-500/5 group"
                onClick={() => setLocation("/dashboard")}
              >
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-violet-500/15 transition-colors">
                    <BarChart3 className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white/90">Manager Dashboard</h3>
                    <p className="text-sm text-white/50 mt-0.5">
                      View business-wide engagement metrics, trends, and per-coach breakdowns.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl cursor-pointer hover:border-white/20 transition-all hover:shadow-lg hover:shadow-violet-500/5 group"
                onClick={() => setLocation("/team")}
              >
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-violet-500/15 transition-colors">
                    <Users className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white/90">Team Management</h3>
                    <p className="text-sm text-white/50 mt-0.5">
                      Add coaches, link accounts, and manage roles for your growing team.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <ClientPerformanceKpiCard onClick={() => setLocation("/client-performance")} />
            </>
          )}

          {/* Profile Not Linked — with self-service claim flow */}
          {!myCoach && !isAdmin && (
            <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl col-span-full">
              <CardContent className="p-8 text-center">
                <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-7 w-7 text-white/50" />
                </div>
                <h3 className="font-semibold text-white/90 text-lg mb-1">Profile Not Linked</h3>
                <p className="text-sm text-white/50 max-w-sm mx-auto mb-6">
                  Your account hasn't been linked to a coach profile yet. If your manager has already created a profile for you, you can claim it below.
                </p>

                {unclaimedCoaches && unclaimedCoaches.length > 0 ? (
                  <Button
                    onClick={() => setClaimDialogOpen(true)}
                    className="gap-2"
                  >
                    <UserCheck className="h-4 w-4" />
                    Claim My Profile
                  </Button>
                ) : (
                  <p className="text-xs text-white/50 italic">
                    No unclaimed profiles available. Ask your manager to create one for you.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Team overview (admin only) */}
        {isAdmin && coaches && coaches.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">Active Coaches</h2>
            <div className="flex flex-wrap gap-2">
              {coaches.map(coach => (
                <div key={coach.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/70">
                  <div className="h-5 w-5 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-semibold text-violet-400">
                    {coach.name.charAt(0).toUpperCase()}
                  </div>
                  {coach.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Claim profile — pick a coach dialog */}
      <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
        <DialogContent className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-violet-400" />
              Claim Your Coach Profile
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Select your name from the list below. Only unclaimed profiles are shown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-64 overflow-y-auto">
            {unclaimedCoaches?.map(coach => (
              <button
                key={coach.id}
                type="button"
                onClick={() => setSelectedCoachId(coach.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  selectedCoachId === coach.id
                    ? "bg-violet-500/10 border-primary/40 text-white/90"
                    : "bg-white/5 border-white/10 text-white/90 hover:border-white/20"
                }`}
              >
                <div className="h-9 w-9 rounded-full bg-violet-500/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-violet-400 shrink-0">
                  {coach.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{coach.name}</p>
                  {coach.email && (
                    <p className="text-xs text-white/50 truncate">{coach.email}</p>
                  )}
                </div>
                {selectedCoachId === coach.id && (
                  <CheckCircle2 className="h-4 w-4 text-violet-400 shrink-0" />
                )}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClaimDialogOpen(false)} className="bg-transparent">
              Cancel
            </Button>
            <Button
              disabled={!selectedCoachId}
              onClick={() => {
                if (selectedCoachId) setConfirmOpen(true);
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm claim dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Profile Claim</DialogTitle>
            <DialogDescription className="text-white/50">
              You are about to claim the profile for <strong className="text-white/90">{selectedCoach?.name}</strong>. This will link your Manus account to this coach profile permanently.
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-white/50 px-1">
            If this is not you, click Cancel and contact your manager.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} className="bg-transparent">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedCoachId) claimProfile.mutate({ coachId: selectedCoachId });
              }}
              disabled={claimProfile.isPending}
            >
              {claimProfile.isPending ? "Claiming..." : "Yes, This Is Me"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
