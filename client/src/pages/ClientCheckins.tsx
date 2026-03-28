import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

// ─── Constants ─────────────────────────────────────────────────────────────────

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
type DayKey = (typeof DAYS)[number];

const DAY_LABELS: Record<DayKey, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
};

const DAY_ACCENT_COLORS: Record<DayKey, string> = {
  monday: "#8b5cf6",    // violet
  tuesday: "#0ea5e9",   // sky
  wednesday: "#14b8a6",  // teal
  thursday: "#f59e0b",   // amber
  friday: "#a855f7",     // purple
};

const DAY_GRADIENT_PILLS: Record<DayKey, string> = {
  monday: "from-violet-400 to-fuchsia-400",
  tuesday: "from-sky-400 to-cyan-400",
  wednesday: "from-teal-400 to-emerald-400",
  thursday: "from-amber-400 to-orange-400",
  friday: "from-purple-400 to-pink-400",
};

const DAY_COLORS: Record<
  string,
  {
    header: string;
    headerAccent: string;
    completedBg: string;
    pendingBg: string;
    pendingHover: string;
    subActive: string;
    subHover: string;
  }
> = {
  monday: {
    header: "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl",
    headerAccent: "bg-gradient-to-r from-violet-500/20 to-transparent",
    completedBg: "bg-emerald-500/10 border-emerald-500/20",
    pendingBg: "bg-white/[0.03] border-white/[0.06]",
    pendingHover: "hover:bg-white/[0.08]",
    subActive: "text-violet-400",
    subHover: "text-white/20 hover:text-violet-400",
  },
  tuesday: {
    header: "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl",
    headerAccent: "bg-gradient-to-r from-sky-500/20 to-transparent",
    completedBg: "bg-emerald-500/10 border-emerald-500/20",
    pendingBg: "bg-white/[0.03] border-white/[0.06]",
    pendingHover: "hover:bg-white/[0.08]",
    subActive: "text-sky-400",
    subHover: "text-white/20 hover:text-sky-400",
  },
  wednesday: {
    header: "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl",
    headerAccent: "bg-gradient-to-r from-teal-500/20 to-transparent",
    completedBg: "bg-emerald-500/10 border-emerald-500/20",
    pendingBg: "bg-white/[0.03] border-white/[0.06]",
    pendingHover: "hover:bg-white/[0.08]",
    subActive: "text-teal-400",
    subHover: "text-white/20 hover:text-teal-400",
  },
  thursday: {
    header: "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl",
    headerAccent: "bg-gradient-to-r from-amber-500/20 to-transparent",
    completedBg: "bg-emerald-500/10 border-emerald-500/20",
    pendingBg: "bg-white/[0.03] border-white/[0.06]",
    pendingHover: "hover:bg-white/[0.08]",
    subActive: "text-amber-400",
    subHover: "text-white/20 hover:text-amber-400",
  },
  friday: {
    header: "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl",
    headerAccent: "bg-gradient-to-r from-purple-500/20 to-transparent",
    completedBg: "bg-emerald-500/10 border-emerald-500/20",
    pendingBg: "bg-white/[0.03] border-white/[0.06]",
    pendingHover: "hover:bg-white/[0.08]",
    subActive: "text-purple-400",
    subHover: "text-white/20 hover:text-purple-400",
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD of the Monday for any given date string (YYYY-MM-DD). */
function getMonday(dateStr?: string): string {
  // Use Melbourne timezone for "today" to avoid UTC date mismatch
  const d = dateStr
    ? new Date(dateStr + "T00:00:00")
    : new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Melbourne" }));
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Add days to a YYYY-MM-DD string, returns YYYY-MM-DD. */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Get the day-of-week index (0=Mon, 4=Fri) for a DayKey. */
function dayIndex(day: DayKey): number {
  return DAYS.indexOf(day);
}

/** Check if a client is overdue (past midday Melbourne time for that day). */
function isClientOverdue(
  weekStart: string,
  day: DayKey,
  isDone: boolean,
): boolean {
  if (isDone) return false;
  const dateStr = addDays(weekStart, dayIndex(day));
  // Client turns red only after midnight Melbourne time on their allocated day
  const melbNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Melbourne" }));
  const melbDateStr = `${melbNow.getFullYear()}-${String(melbNow.getMonth() + 1).padStart(2, "0")}-${String(melbNow.getDate()).padStart(2, "0")}`;
  // Only overdue if the day has fully passed (it's now the next day or later)
  return melbDateStr > dateStr;
}

/** Get the date label for a day column (e.g. "25/03"). */
function getDayDateLabel(weekStart: string, day: DayKey): string {
  const dateStr = addDays(weekStart, dayIndex(day));
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

/** Get short date label like "23 Mar" for a given day. */
function getDayShortLabel(weekStart: string, day: DayKey): string {
  const dateStr = addDays(weekStart, dayIndex(day));
  const d = new Date(dateStr + "T00:00:00");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

/** Format a date label like "Mon, 23 Mar" for a given day. */
function getDayFullLabel(weekStart: string, day: DayKey): string {
  const dateStr = addDays(weekStart, dayIndex(day));
  const d = new Date(dateStr + "T00:00:00");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${DAY_LABELS[day]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

/** Full day name e.g. "Monday" */
const DAY_FULL_NAMES: Record<DayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

/** Format week range like "23 Mar - 29 Mar 2026" from a Monday YYYY-MM-DD. */
function formatWeekRange(weekStart: string): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mon = new Date(weekStart + "T00:00:00");
  const fri = new Date(weekStart + "T00:00:00");
  fri.setDate(fri.getDate() + 4);
  const monLabel = `${mon.getDate()} ${months[mon.getMonth()]}`;
  const friLabel = `${fri.getDate()} ${months[fri.getMonth()]} ${fri.getFullYear()}`;
  return `${monLabel} \u2013 ${friLabel}`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ClientCheckins() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isAdmin = user?.role === "admin";

  // ── Week navigation ────────────────────────────────────────────────────────
  const [weekStart, setWeekStart] = useState(() => getMonday());

  const goToPrevWeek = () => setWeekStart((w) => addDays(w, -7));
  const goToNextWeek = () => setWeekStart((w) => addDays(w, 7));
  const goToCurrentWeek = () => setWeekStart(getMonday());

  // ── Coach selection ────────────────────────────────────────────────────────
  const { data: coaches } = trpc.coaches.list.useQuery();
  const { data: myCoach } = trpc.coaches.myCoach.useQuery(undefined, {
    enabled: !!user && user.role !== "admin",
  });

  const [selectedCoachId, setSelectedCoachId] = useState<number | null>(null);

  // Default: managers default to first coach (Steve), coaches to their own
  useEffect(() => {
    if (selectedCoachId) return;
    if (isAdmin && coaches && coaches.length > 0) {
      // Try to find Steve, otherwise default to first coach
      const steve = coaches.find(
        (c) => c.name.toLowerCase().includes("steve"),
      );
      setSelectedCoachId(steve?.id ?? coaches[0].id);
    } else if (myCoach) {
      setSelectedCoachId(myCoach.id);
    }
  }, [isAdmin, coaches, myCoach, selectedCoachId]);

  const effectiveCoachId = isAdmin ? selectedCoachId : (myCoach?.id ?? null);
  const effectiveCoachName = useMemo(() => {
    if (!effectiveCoachId || !coaches) return null;
    return coaches.find((c) => c.id === effectiveCoachId)?.name ?? null;
  }, [effectiveCoachId, coaches]);

  // ── Can the current user edit this roster? ─────────────────────────────────
  const canEdit = useMemo(() => {
    if (!user) return false;
    if (isAdmin) return true;
    if (myCoach && effectiveCoachId === myCoach.id) return true;
    return false;
  }, [user, isAdmin, myCoach, effectiveCoachId]);

  // ── Data queries ───────────────────────────────────────────────────────────

  // Roster for the selected coach
  const { data: roster } = trpc.performance.rosterForCoach.useQuery(
    { coachName: effectiveCoachName! },
    { enabled: !!effectiveCoachName, staleTime: 5 * 60 * 1000 },
  );

  // Aggregate weekly stats (for header counters)
  const { data: weeklyStats } =
    trpc.clientCheckins.getRosterWeeklyStats.useQuery(
      { coachId: effectiveCoachId!, weekStart },
      { enabled: !!effectiveCoachId },
    );

  // All disengaged clients (for disengagement tab)
  const { data: allDisengaged } =
    trpc.clientCheckins.getAllDisengagedClients.useQuery(undefined, {
      staleTime: 5 * 60 * 1000,
    });

  // Missed streaks for red highlighting
  const { data: allMissedStreaks } =
    trpc.clientCheckins.getAllMissedStreaks.useQuery(undefined, {
      staleTime: 5 * 60 * 1000,
    });

  // Paused clients
  const { data: pausedClientNames, refetch: refetchPaused } =
    trpc.clientCheckins.getActivePauses.useQuery(
      { coachId: effectiveCoachId! },
      { enabled: !!effectiveCoachId },
    );
  const pausedSet = useMemo(() => new Set(pausedClientNames ?? []), [pausedClientNames]);

  // Pause/resume mutations
  const pauseClientMutation = trpc.clientCheckins.pauseClient.useMutation({
    onSuccess: (_data, variables) => {
      refetchPaused();
      toast.success(`Paused ${variables.clientName}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const resumeClientMutation = trpc.clientCheckins.resumeClient.useMutation({
    onSuccess: (_data, variables) => {
      refetchPaused();
      toast.success(`Resumed ${variables.clientName}`);
    },
    onError: (e) => toast.error(e.message),
  });

  // Upfront alerts — clients with UPFRONT dates in their name
  const upfrontAlerts = useMemo(() => {
    if (!roster) return [];
    const alerts: Array<{ name: string; day: string; dateStr: string; daysLeft: number }> = [];
    const now = new Date();
    for (const day of DAYS) {
      for (const name of ((roster as Record<string, string[]>)[day] ?? [])) {
        const match = name.match(/UPFRONT\s*[-–—]\s*(\d{1,2}\s+\w+(?:\s+\d{4})?)/i);
        if (match) {
          const dateStr = match[1];
          const parsed = new Date(dateStr + (dateStr.match(/\d{4}/) ? '' : ' 2026'));
          if (!isNaN(parsed.getTime())) {
            const daysLeft = Math.ceil((parsed.getTime() - now.getTime()) / 86400000);
            if (daysLeft <= 60) {
              alerts.push({ name, day, dateStr, daysLeft });
            }
          }
        }
      }
    }
    return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [roster]);

  // Renewal alerts — clients with DEC OFFER or UPFRONT ending within 30 days
  const renewalAlerts = useMemo(() => {
    if (!roster) return [];
    const alerts: Array<{ name: string; coach: string; day: string; offerType: string; daysLeft: number }> = [];
    const now = new Date();
    for (const day of DAYS) {
      for (const name of ((roster as Record<string, string[]>)[day] ?? [])) {
        const matchUpfront = name.match(/UPFRONT\s*[-–—]\s*(\d{1,2}\s+\w+(?:\s+\d{4})?)/i);
        const matchDec = name.match(/DEC\s*OFFER\s*[-–—]\s*(\d{1,2}\s+\w+(?:\s+\d{4})?)/i);
        const match = matchUpfront || matchDec;
        const offerType = matchUpfront ? "UPFRONT" : matchDec ? "DEC OFFER" : null;
        if (match && offerType) {
          const dateStr = match[1];
          const parsed = new Date(dateStr + (dateStr.match(/\d{4}/) ? '' : ' 2026'));
          if (!isNaN(parsed.getTime())) {
            const daysLeft = Math.ceil((parsed.getTime() - now.getTime()) / 86400000);
            if (daysLeft <= 30 && daysLeft >= 0) {
              alerts.push({ name, coach: effectiveCoachName ?? "", day, offerType, daysLeft });
            }
          }
        }
      }
    }
    return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [roster, effectiveCoachName]);

  // Clients missing 2+ consecutive weeks (for the section below the roster)
  const clientsMissing2Plus = useMemo(() => {
    if (!allMissedStreaks || !effectiveCoachId) return [];
    return allMissedStreaks
      .filter((s) => s.coachId === effectiveCoachId && s.consecutiveMissed >= 2)
      .sort((a, b) => b.consecutiveMissed - a.consecutiveMissed);
  }, [allMissedStreaks, effectiveCoachId]);

  // Count of disengaging clients for this coach
  const disengagingCount = useMemo(() => {
    if (!allDisengaged || !effectiveCoachName) return 0;
    return allDisengaged.filter((d) => d.coachName === effectiveCoachName).length;
  }, [allDisengaged, effectiveCoachName]);

  // ── Build client-level sets from data ──────────────────────────────────────

  // We track completed/submitted/excused per `clientName|day` using the
  // aggregate stats + local mutation state. The weeklyStats query returns
  // per-coach aggregates; we use per-client detail from the mutations
  // and local optimistic state.

  // Local state sets (populated from mutations and initial data)
  const [localCompleted, setLocalCompleted] = useState<Set<string>>(new Set());
  const [localSubmitted, setLocalSubmitted] = useState<Set<string>>(new Set());
  const [localExcused, setLocalExcused] = useState<
    Map<string, { reason: string }>
  >(new Map());

  // Load existing completion data from the database
  const { data: weekStatuses } = trpc.clientCheckins.getWeekStatusAll.useQuery(
    { weekStart },
    { enabled: !!weekStart, staleTime: 2 * 60 * 1000 },
  );

  // Load excuses for this week
  const { data: weekExcuses } = trpc.clientCheckins.getExcusesForWeek.useQuery(
    { weekStart, coachId: effectiveCoachId ?? undefined },
    { enabled: !!weekStart },
  );

  // Populate local state from API data when it loads or coach/week changes
  useEffect(() => {
    const completed = new Set<string>();
    const submitted = new Set<string>();
    const excused = new Map<string, { reason: string }>();

    if (weekStatuses) {
      for (const s of weekStatuses) {
        if (effectiveCoachId && s.coachId !== effectiveCoachId) continue;
        const key = `${s.clientName}|${s.dayOfWeek}`;
        if (s.completedAt) completed.add(key);
        if (s.clientSubmitted) submitted.add(key);
      }
    }

    if (weekExcuses) {
      for (const e of weekExcuses) {
        if (effectiveCoachId && e.coachId !== effectiveCoachId) continue;
        if (e.status === "approved") {
          excused.set(`${e.clientName}|${e.dayOfWeek}`, { reason: e.reason || "" });
        }
      }
    }

    setLocalCompleted(completed);
    setLocalSubmitted(submitted);
    setLocalExcused(excused);
  }, [weekStatuses, weekExcuses, effectiveCoachId, weekStart]);

  // Missed streaks set for this coach
  const missedSet = useMemo(() => {
    const s = new Set<string>();
    if (!allMissedStreaks || !effectiveCoachId) return s;
    for (const streak of allMissedStreaks) {
      if (streak.coachId === effectiveCoachId) {
        s.add(`${streak.clientName}|${streak.dayOfWeek}`);
      }
    }
    return s;
  }, [allMissedStreaks, effectiveCoachId]);

  // Approved excuses for this coach from the local state
  const approvedExcuseMap = localExcused;
  const completedSet = localCompleted;

  // Per-day completed/total counts for day column headers
  const dayStats = useMemo(() => {
    const stats: Record<DayKey, { completed: number; total: number }> = {
      monday: { completed: 0, total: 0 },
      tuesday: { completed: 0, total: 0 },
      wednesday: { completed: 0, total: 0 },
      thursday: { completed: 0, total: 0 },
      friday: { completed: 0, total: 0 },
    };
    if (!roster) return stats;
    for (const day of DAYS) {
      const clients = (roster as Record<string, string[]>)[day] ?? [];
      stats[day].total = clients.length;
      for (const clientName of clients) {
        if (localCompleted.has(`${clientName}|${day}`)) {
          stats[day].completed++;
        }
      }
    }
    return stats;
  }, [roster, localCompleted]);
  const clientSubmittedSet = localSubmitted;

  // Stats from weeklyStats (for header)
  const coachStats = useMemo(() => {
    if (!weeklyStats || !effectiveCoachId) return null;
    return (weeklyStats as Array<{ coachId: number; completed: number; clientSubmitted: number; scheduled: number; excused: number; pct: number }>)
      .find((s) => s.coachId === effectiveCoachId) ?? null;
  }, [weeklyStats, effectiveCoachId]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const markCompleteMutation = trpc.clientCheckins.markComplete.useMutation({
    onSuccess: (_data, variables) => {
      const key = `${variables.clientName}|${variables.dayOfWeek}`;
      setLocalCompleted((prev) => new Set(prev).add(key));
      utils.clientCheckins.getRosterWeeklyStats.invalidate();
      toast.success(`Marked ${variables.clientName} as completed`);
    },
    onError: (e) => toast.error(e.message),
  });

  const undoCompleteMutation = trpc.clientCheckins.undoComplete.useMutation({
    onSuccess: (_data, variables) => {
      const key = `${variables.clientName}|${variables.dayOfWeek}`;
      setLocalCompleted((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      utils.clientCheckins.getRosterWeeklyStats.invalidate();
      toast.success(`Undid completion for ${variables.clientName}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleClientSubmittedMutation =
    trpc.clientCheckins.toggleClientSubmitted.useMutation({
      onSuccess: (data, variables) => {
        const key = `${variables.clientName}|${variables.dayOfWeek}`;
        setLocalSubmitted((prev) => {
          const next = new Set(prev);
          if (data.clientSubmitted) {
            next.add(key);
          } else {
            next.delete(key);
          }
          return next;
        });
        utils.clientCheckins.getRosterWeeklyStats.invalidate();
      },
      onError: (e) => toast.error(e.message),
    });

  const submitExcuseMutation = trpc.clientCheckins.submitExcuse.useMutation({
    onSuccess: (_data, variables) => {
      const key = `${variables.clientName}|${variables.dayOfWeek}`;
      setLocalExcused((prev) => {
        const next = new Map(prev);
        next.set(key, { reason: variables.reason });
        return next;
      });
      utils.clientCheckins.getRosterWeeklyStats.invalidate();
      toast.success(`Excuse submitted for ${variables.clientName}`);
      setExcuseDialog(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const syncTypeformMutation = trpc.clientCheckins.syncTypeform.useMutation({
    onSuccess: () => {
      utils.clientCheckins.getRosterWeeklyStats.invalidate();
      utils.clientCheckins.getWeekStatusAll.invalidate();
    },
    onError: () => {},
  });

  // Auto-sync Typeform on page load
  useEffect(() => {
    syncTypeformMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Dialog state ───────────────────────────────────────────────────────────
  const [confirmDialog, setConfirmDialog] = useState<{
    clientName: string;
    day: DayKey;
  } | null>(null);
  const [undoPending, setUndoPending] = useState<{
    clientName: string;
    day: DayKey;
  } | null>(null);
  const [excuseDialog, setExcuseDialog] = useState<{
    clientName: string;
    day: DayKey;
  } | null>(null);
  const [excuseReason, setExcuseReason] = useState("");
  const [excuseSearch, setExcuseSearch] = useState("");
  const [pauseSearch, setPauseSearch] = useState("");
  const [excuseSelectedClient, setExcuseSelectedClient] = useState<string | null>(null);
  const [excuseSelectedDay, setExcuseSelectedDay] = useState<DayKey | null>(null);

  // Build flat list of all clients in current roster for excuse search
  const allRosterClients = useMemo(() => {
    if (!roster) return [];
    const clients: Array<{ name: string; day: DayKey }> = [];
    for (const day of DAYS) {
      for (const name of ((roster as Record<string, string[]>)[day] ?? [])) {
        clients.push({ name, day });
      }
    }
    return clients;
  }, [roster]);

  const excuseSearchResults = useMemo(() => {
    if (!excuseSearch.trim()) return [];
    const q = excuseSearch.toLowerCase();
    return allRosterClients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [excuseSearch, allRosterClients]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleClientClick(clientName: string, day: DayKey) {
    setConfirmDialog({ clientName, day });
  }

  function handleConfirmComplete() {
    if (!confirmDialog || !effectiveCoachId || !effectiveCoachName) return;
    markCompleteMutation.mutate({
      coachId: effectiveCoachId,
      coachName: effectiveCoachName,
      clientName: confirmDialog.clientName,
      dayOfWeek: confirmDialog.day,
      weekStart,
    });
    setConfirmDialog(null);
  }

  function handleConfirmUndo() {
    if (!undoPending || !effectiveCoachId) return;
    undoCompleteMutation.mutate({
      coachId: effectiveCoachId,
      clientName: undoPending.clientName,
      dayOfWeek: undoPending.day,
      weekStart,
    });
    setUndoPending(null);
  }

  function handleSubmitExcuse() {
    if (
      !excuseDialog ||
      !effectiveCoachId ||
      !effectiveCoachName ||
      !excuseReason.trim()
    )
      return;
    submitExcuseMutation.mutate({
      coachId: effectiveCoachId,
      coachName: effectiveCoachName,
      clientName: excuseDialog.clientName,
      dayOfWeek: excuseDialog.day,
      weekStart,
      reason: excuseReason.trim(),
    });
  }

  // ── Disengagement grouping — by coach, then by tier ───────────────────────
  const disengagedByCoach = useMemo(() => {
    if (!allDisengaged || !coaches) return [];
    const map = new Map<string, { coachName: string; critical: typeof allDisengaged; alert: typeof allDisengaged; warning: typeof allDisengaged; total: number }>();
    for (const d of allDisengaged) {
      if (!map.has(d.coachName)) {
        map.set(d.coachName, { coachName: d.coachName, critical: [], alert: [], warning: [], total: 0 });
      }
      const group = map.get(d.coachName)!;
      group.total++;
      if (d.consecutiveMissedWeeks >= 3) group.critical.push(d);
      else if (d.consecutiveMissedWeeks === 2) group.alert.push(d);
      else if (d.consecutiveMissedWeeks === 1) group.warning.push(d);
    }
    return Array.from(map.values());
  }, [allDisengaged, coaches]);

  // ── Render guard ───────────────────────────────────────────────────────────
  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="relative z-10">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="max-w-[1440px] mx-auto px-8 pt-8 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <h1 className="text-lg font-semibold text-white/90 tracking-tight">Client Check-Ins</h1>

              {/* Coach selector glass pill */}
              {isAdmin && coaches && (
                <div className="glass rounded-xl px-3 py-1.5 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-[10px] font-bold">
                    {effectiveCoachName?.charAt(0) ?? "?"}
                  </div>
                  <select
                    className="bg-transparent text-white/80 text-sm font-medium appearance-none cursor-pointer pr-5 outline-none"
                    value={selectedCoachId?.toString() ?? ""}
                    onChange={(e) => setSelectedCoachId(parseInt(e.target.value))}
                  >
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id.toString()} className="bg-zinc-900">{c.name}</option>
                    ))}
                  </select>
                  <svg className="w-3.5 h-3.5 text-white/30 -ml-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
                </div>
              )}

              {/* Date range glass pill */}
              <div className="glass rounded-xl px-3 py-1.5 flex items-center gap-2">
                <svg className="w-4 h-4 text-violet-400/60" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                <button
                  onClick={goToCurrentWeek}
                  className="text-sm text-white/70 font-medium hover:text-white/90 transition-colors"
                >
                  {formatWeekRange(weekStart)}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={goToPrevWeek} className="glass rounded-xl px-3 py-1.5 text-sm text-white/50 hover:text-white/80 transition-colors">&larr; Prev</button>
              <button onClick={goToNextWeek} className="glass rounded-xl px-3 py-1.5 text-sm text-white/50 hover:text-white/80 transition-colors">Next &rarr;</button>
            </div>
          </div>

          {/* ── Stats Row ─────────────────────────────────────────────────── */}
          {coachStats && (
            <div className="flex items-center gap-4 mt-5">
              <div className="glass rounded-2xl px-4 py-2.5 flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-violet-400 glow-violet"></div>
                <div>
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">Submitted</div>
                  <div className="text-lg font-bold text-white/90 -mt-0.5">{coachStats.clientSubmitted}</div>
                </div>
              </div>
              <div className="glass rounded-2xl px-4 py-2.5 flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 status-dot-green"></div>
                <div>
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">Completed</div>
                  <div className="text-lg font-bold text-white/90 -mt-0.5">{coachStats.completed}</div>
                </div>
              </div>
              <div className="glass rounded-2xl px-4 py-2.5 flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-white/30"></div>
                <div>
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">Remaining</div>
                  <div className="text-lg font-bold text-white/90 -mt-0.5">{coachStats.scheduled - coachStats.completed}</div>
                </div>
              </div>
              <div className="glass rounded-2xl px-4 py-2.5 flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-red-400 status-dot-red"></div>
                <div>
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">Disengaging</div>
                  <div className="text-lg font-bold text-white/90 -mt-0.5">{disengagingCount}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Day Columns ─────────────────────────────────────────────────── */}
        <div className="max-w-[1440px] mx-auto px-8 mt-4">
          {!effectiveCoachId ? (
            <div className="glass rounded-2xl p-6 text-center text-white/50 text-sm">
              Select a coach above to view their roster.
            </div>
          ) : !roster ? (
            <div className="glass rounded-2xl p-6 text-center text-white/50 text-sm">
              Loading roster...
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-4">
              {DAYS.map((day) => {
                const clients = (roster as Record<string, string[]>)[day] ?? [];

                return (
                  <div key={day} className="glass rounded-2xl p-4">
                    {/* Day header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-1 h-5 rounded-full bg-gradient-to-b ${DAY_GRADIENT_PILLS[day]}`}></div>
                        <span className="text-sm font-semibold text-white/80">{DAY_FULL_NAMES[day]}</span>
                      </div>
                      <span className="text-xs text-white/30">{getDayShortLabel(weekStart, day)}</span>
                    </div>

                    {/* Client list */}
                    <div className="space-y-2">
                      {clients.length === 0 ? (
                        <p className="text-xs text-white/30 text-center py-4">No clients</p>
                      ) : (
                        clients.map((clientName: string) => {
                          const isCompleted = completedSet.has(`${clientName}|${day}`);
                          const isClientSub = clientSubmittedSet.has(`${clientName}|${day}`);
                          const excuseEntry = approvedExcuseMap.get(`${clientName}|${day}`);
                          const isExcused = !!excuseEntry && !isCompleted;
                          const isPaused = pausedSet.has(clientName);
                          const isMissedStreak = missedSet.has(`${clientName}|${day}`);
                          const isOverdue = isClientOverdue(weekStart, day, isCompleted || isExcused || isPaused);
                          const showRed = (isOverdue || isMissedStreak) && !isCompleted && !isExcused && !isPaused;

                          // Status-based classes
                          const dotClass = isPaused
                            ? "bg-white/20"
                            : isCompleted || isExcused
                              ? "bg-emerald-400 status-dot-green"
                              : showRed
                                ? "bg-red-400 status-dot-red"
                                : "bg-white/20";

                          const nameClass = isPaused
                            ? "text-white/50 line-through"
                            : isCompleted || isExcused
                              ? "text-white/80"
                              : showRed
                                ? "text-red-300/80"
                                : "text-white/50";

                          const formIconClass = isCompleted || isExcused
                            ? "text-violet-400/40"
                            : "text-white/10";

                          const btnStyle = showRed
                            ? { borderColor: "rgba(248,113,113,0.15)" }
                            : undefined;

                          return (
                            <div
                              key={clientName}
                              className={`glass-btn w-full rounded-xl px-3 py-2 flex items-center justify-between ${isPaused ? "opacity-40" : ""}`}
                              style={btnStyle}
                            >
                              {/* Left: form icon + status dot + name */}
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {/* Form icon (sub toggle) */}
                                <button
                                  onClick={() =>
                                    toggleClientSubmittedMutation.mutate({
                                      clientName,
                                      dayOfWeek: day,
                                      weekStart,
                                      ...(effectiveCoachId ? { coachId: effectiveCoachId } : {}),
                                    })
                                  }
                                  title={isClientSub ? "Client submitted (click to unmark)" : "Mark client as submitted"}
                                  className="shrink-0"
                                >
                                  <svg className={`w-3.5 h-3.5 ${isClientSub ? "text-violet-400/70" : formIconClass}`} fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"/>
                                  </svg>
                                </button>

                                {/* Client name button with status dot */}
                                <button
                                  onClick={() =>
                                    canEdit && !isCompleted && !isExcused && !isPaused && handleClientClick(clientName, day)
                                  }
                                  disabled={isCompleted || isExcused || !canEdit || isPaused}
                                  title={
                                    isPaused
                                      ? "Client is paused"
                                      : isExcused
                                        ? `Excused — ${excuseEntry?.reason}`
                                        : undefined
                                  }
                                  className="flex items-center gap-2 min-w-0"
                                >
                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`}></div>
                                  <span className={`text-xs font-medium ${nameClass} truncate flex items-center gap-1`}>
                                    {clientName}
                                    {isExcused && (
                                      <svg className="w-3 h-3 text-emerald-400/60 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.351-.166-2.001A11.954 11.954 0 0110 1.944zM13.707 8.707a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
                                      </svg>
                                    )}
                                  </span>
                                </button>
                              </div>

                              {/* Right: resume/undo buttons */}
                              <div className="flex items-center gap-1 shrink-0 ml-1">
                                {/* Resume button for paused clients */}
                                {isPaused && canEdit && (
                                  <button
                                    onClick={() => resumeClientMutation.mutate({ coachId: effectiveCoachId ?? 0, clientName })}
                                    title="Click to resume"
                                    className="text-[10px] font-medium text-violet-400 hover:text-violet-300 transition-colors"
                                  >
                                    Resume
                                  </button>
                                )}

                                {/* Undo button */}
                                {isCompleted && canEdit && (
                                  <button
                                    onClick={() => setUndoPending({ clientName, day })}
                                    title="Undo check-in"
                                    className="shrink-0 p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-3 w-3"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M3 7v6h6" />
                                      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Bottom Sections: Missing 2+ Weeks & Pause a Client ─────────── */}
        <div className="max-w-[1440px] mx-auto px-8 mt-8 pb-12">
          <div className="grid grid-cols-2 gap-6">

            {/* Missing 2+ Weeks */}
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-red-400 status-dot-red"></div>
                <h3 className="text-sm font-semibold text-white/80">Clients Missing 2+ Weeks</h3>
              </div>
              <div className="space-y-2">
                {clientsMissing2Plus.length === 0 ? (
                  <p className="text-xs text-white/30">No clients missing 2+ weeks.</p>
                ) : (
                  clientsMissing2Plus.map((s) => (
                    <div
                      key={`${s.clientName}-${s.dayOfWeek}`}
                      className="glass-btn rounded-xl px-3 py-2 flex items-center justify-between"
                    >
                      <span className="text-xs font-medium text-red-300/70">{s.clientName}</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                        {s.consecutiveMissed} weeks
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pause a Client */}
            {effectiveCoachId && (
              <div className="glass rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white/80 mb-2">Pause a Client</h3>
                <p className="text-xs text-white/30 mb-4">Temporarily remove a client from the active roster. They won&apos;t appear in check-in lists until resumed.</p>
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Search client name..."
                    value={pauseSearch}
                    onChange={(e) => setPauseSearch(e.target.value)}
                    className="flex-1 glass rounded-xl px-3 py-2 text-xs text-white/80 placeholder-white/20 outline-none focus:border-violet-500/30 transition-colors bg-transparent"
                  />
                </div>
                {pauseSearch.trim() && (
                  <div className="space-y-1 max-h-48 overflow-y-auto mb-4">
                    {allRosterClients
                      .filter((c) => c.name.toLowerCase().includes(pauseSearch.toLowerCase()) && !pausedSet.has(c.name))
                      .slice(0, 8)
                      .map((c) => (
                        <button
                          key={`pause-${c.name}|${c.day}`}
                          onClick={() => {
                            pauseClientMutation.mutate({ coachId: effectiveCoachId!, clientName: c.name });
                            setPauseSearch("");
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-white/[0.08] text-white/80 transition-colors flex items-center justify-between glass-btn"
                        >
                          <span className="font-medium">{c.name}</span>
                          <button
                            className="px-4 py-2 text-xs font-medium rounded-xl bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 text-violet-300 hover:from-violet-500/30 hover:to-fuchsia-500/30 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              pauseClientMutation.mutate({ coachId: effectiveCoachId!, clientName: c.name });
                              setPauseSearch("");
                            }}
                          >
                            Pause
                          </button>
                        </button>
                      ))}
                  </div>
                )}
                {pausedSet.size > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">Currently paused</span>
                    {Array.from(pausedSet).map((name) => (
                      <div key={name} className="glass-btn rounded-xl px-3 py-2 flex items-center justify-between">
                        <span className="text-xs text-white/40">{name}</span>
                        <button
                          onClick={() => resumeClientMutation.mutate({ coachId: effectiveCoachId!, clientName: name })}
                          className="text-[10px] font-medium text-violet-400 hover:text-violet-300 transition-colors"
                        >
                          Resume
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* ── Valid Excuse (kept below the 2-column grid) ────────────────── */}
          {effectiveCoachId && (
            <div className="glass rounded-2xl p-5 mt-6">
              <h3 className="text-sm font-semibold text-white/80 mb-2">Valid Excuse</h3>
              <p className="text-xs text-white/30 mb-4">
                Excused clients are excluded from missed check-in counts (soft). Requires manager approval.
              </p>
              {!excuseSelectedClient ? (
                <div className="max-w-md">
                  <input
                    type="text"
                    placeholder="Search for a client..."
                    value={excuseSearch}
                    onChange={(e) => {
                      setExcuseSearch(e.target.value);
                      setExcuseSelectedClient(null);
                      setExcuseSelectedDay(null);
                    }}
                    className="w-full glass rounded-xl px-3 py-2 text-xs text-white/80 placeholder-white/20 outline-none focus:border-violet-500/30 transition-colors bg-transparent"
                  />
                  {excuseSearchResults.length > 0 && (
                    <div className="space-y-1 max-h-48 overflow-y-auto mt-2">
                      {excuseSearchResults.map((c) => (
                        <button
                          key={`${c.name}|${c.day}`}
                          onClick={() => {
                            setExcuseSelectedClient(c.name);
                            setExcuseSelectedDay(c.day);
                            setExcuseSearch("");
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-white/[0.08] text-white/80 transition-colors flex items-center justify-between glass-btn"
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="text-[10px] text-white/40 capitalize">{c.day}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 max-w-md">
                  <div className="flex items-center justify-between glass rounded-xl px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-white/90">{excuseSelectedClient}</span>
                      <span className="text-xs text-white/40 ml-2 capitalize">{excuseSelectedDay}</span>
                    </div>
                    <button
                      onClick={() => {
                        setExcuseSelectedClient(null);
                        setExcuseSelectedDay(null);
                        setExcuseReason("");
                      }}
                      className="text-xs text-white/50 hover:text-white/90"
                    >
                      Change
                    </button>
                  </div>
                  <Textarea
                    placeholder="Reason for valid excuse..."
                    value={excuseReason}
                    onChange={(e) => setExcuseReason(e.target.value)}
                    rows={2}
                    className="bg-white/5 border-white/10 text-white/90 placeholder:text-white/30"
                  />
                  <Button
                    onClick={() => {
                      if (!excuseSelectedClient || !excuseSelectedDay || !excuseReason.trim()) return;
                      submitExcuseMutation.mutate({
                        coachId: effectiveCoachId!,
                        coachName: effectiveCoachName ?? "",
                        clientName: excuseSelectedClient,
                        dayOfWeek: excuseSelectedDay,
                        weekStart,
                        reason: excuseReason.trim(),
                      });
                      setExcuseSelectedClient(null);
                      setExcuseSelectedDay(null);
                      setExcuseReason("");
                    }}
                    disabled={!excuseReason.trim() || submitExcuseMutation.isPending}
                    size="sm"
                  >
                    {submitExcuseMutation.isPending ? "Submitting..." : "Submit Excuse for Approval"}
                  </Button>
                </div>
              )}

              {/* THIS WEEK'S EXCUSES */}
              {localExcused.size > 0 && (
                <div className="mt-4">
                  <h4 className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
                    This Week&apos;s Excuses
                  </h4>
                  <div className="space-y-1.5">
                    {Array.from(localExcused.entries()).map(([key, val]) => {
                      const [cName, dayOfWeek] = key.split("|");
                      return (
                        <div
                          key={key}
                          className="glass-btn rounded-xl px-3 py-2 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-emerald-300">{cName}</span>
                            <span className="text-[10px] text-white/40 capitalize">{dayOfWeek}</span>
                            <span className="text-[10px] text-white/40">{val.reason}</span>
                          </div>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            APPROVED
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Renewal Alerts (orange banner) ──────────────────────────── */}
          {renewalAlerts.length > 0 && (
            <div className="glass rounded-2xl p-5 mt-6" style={{ borderColor: "rgba(245,158,11,0.2)" }}>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-4 w-4 text-amber-300" />
                <h3 className="text-sm font-semibold text-amber-200">
                  {renewalAlerts.length} Client Renewal{renewalAlerts.length !== 1 ? "s" : ""} Coming Up
                </h3>
              </div>
              <div className="space-y-2">
                {renewalAlerts.map((a) => (
                  <div
                    key={a.name}
                    className="glass-btn rounded-xl px-3 py-2 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-amber-200">{a.name}</span>
                      <span className="text-[10px] text-white/40">{a.coach}</span>
                      <span className="text-[10px] text-white/40 capitalize">{a.day}</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        {a.offerType}
                      </span>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${a.daysLeft <= 7 ? "bg-red-500/10 text-red-400 border border-red-500/20" : a.daysLeft <= 14 ? "bg-orange-500/10 text-orange-400 border border-orange-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}>
                      in {a.daysLeft} day{a.daysLeft !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Disengagement Tracking ─────────────────────────────────────── */}
          {disengagedByCoach.length > 0 && (
            <div className="glass rounded-2xl p-5 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-red-400 status-dot-red"></div>
                <h3 className="text-sm font-semibold text-white/80">
                  Disengagement Tracking
                  {disengagingCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {disengagingCount}
                    </span>
                  )}
                </h3>
              </div>
              <p className="text-xs text-white/30 mb-4">
                Consecutive missed check-ins per coach — streak resets when marked complete
              </p>
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: `repeat(${Math.min(disengagedByCoach.length, 3)}, minmax(0, 1fr))` }}
              >
                {disengagedByCoach.map((coach) => (
                  <div key={coach.coachName} className="glass rounded-2xl p-4">
                    {/* Coach header */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold">
                        {coach.coachName.charAt(0)}
                      </div>
                      <span className="text-sm font-bold text-white/90">{coach.coachName}</span>
                      <span className="text-xs text-white/40 ml-auto">{coach.total} flagged</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] mb-3">
                      {coach.critical.length > 0 && <span className="text-red-400">{coach.critical.length} critical</span>}
                      {coach.alert.length > 0 && <span className="text-orange-400">{coach.alert.length} alert</span>}
                      {coach.warning.length > 0 && <span className="text-yellow-400">{coach.warning.length} warning</span>}
                      {coach.total === 0 && <span className="text-emerald-400">All clear</span>}
                    </div>
                    <div className="space-y-3">
                      {/* Critical tier */}
                      {coach.critical.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="h-2 w-2 rounded-full bg-red-500" />
                            <span className="text-[9px] font-bold uppercase text-red-300 tracking-wider">Critical</span>
                            <div className="flex-1 border-t border-red-700/40" />
                          </div>
                          {coach.critical.map((d) => (
                            <div
                              key={`${d.clientName}-${d.dayOfWeek}`}
                              className="glass-btn rounded-xl px-3 py-2 flex items-center justify-between"
                              style={{ borderColor: "rgba(248,113,113,0.15)" }}
                            >
                              <span className="text-xs font-medium text-red-300 truncate min-w-0">{d.clientName}</span>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="text-[10px] text-white/40 capitalize">{d.dayOfWeek}</span>
                                <span className="text-[10px] font-bold text-red-300">{d.consecutiveMissedWeeks}w</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Alert tier */}
                      {coach.alert.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="h-2 w-2 rounded-full bg-orange-500" />
                            <span className="text-[9px] font-bold uppercase text-orange-300 tracking-wider">Alert</span>
                            <div className="flex-1 border-t border-orange-700/50" />
                          </div>
                          {coach.alert.map((d) => (
                            <div
                              key={`${d.clientName}-${d.dayOfWeek}`}
                              className="glass-btn rounded-xl px-3 py-2 flex items-center justify-between"
                            >
                              <span className="text-xs font-medium text-orange-300 truncate min-w-0">{d.clientName}</span>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="text-[10px] text-white/40 capitalize">{d.dayOfWeek}</span>
                                <span className="text-[10px] font-bold text-orange-300">{d.consecutiveMissedWeeks}w</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Warning tier */}
                      {coach.warning.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="h-2 w-2 rounded-full bg-yellow-500" />
                            <span className="text-[9px] font-bold uppercase text-yellow-300 tracking-wider">Warning</span>
                            <div className="flex-1 border-t border-yellow-700/40" />
                          </div>
                          {coach.warning.map((d) => (
                            <div
                              key={`${d.clientName}-${d.dayOfWeek}`}
                              className="glass-btn rounded-xl px-3 py-2 flex items-center justify-between"
                            >
                              <span className="text-xs font-medium text-yellow-300 truncate min-w-0">{d.clientName}</span>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="text-[10px] text-white/40 capitalize">{d.dayOfWeek}</span>
                                <span className="text-[10px] font-bold text-yellow-300">{d.consecutiveMissedWeeks}w</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Confirm Complete Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={!!confirmDialog}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark as Completed?</DialogTitle>
            <DialogDescription>
              Confirm that <strong>{confirmDialog?.clientName}</strong>&apos;s
              check-in for{" "}
              <strong>
                {confirmDialog?.day
                  ? DAY_LABELS[confirmDialog.day]
                  : ""}
              </strong>{" "}
              has been completed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setConfirmDialog(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmComplete}
              disabled={markCompleteMutation.isPending}
            >
              {markCompleteMutation.isPending
                ? "Saving..."
                : "Mark Complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Undo Confirmation Dialog ────────────────────────────────────────── */}
      <Dialog
        open={!!undoPending}
        onOpenChange={(open) => !open && setUndoPending(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Undo Completion?</DialogTitle>
            <DialogDescription>
              This will undo the completion for{" "}
              <strong>{undoPending?.clientName}</strong> on{" "}
              <strong>
                {undoPending?.day
                  ? DAY_LABELS[undoPending.day]
                  : ""}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setUndoPending(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmUndo}
              disabled={undoCompleteMutation.isPending}
            >
              {undoCompleteMutation.isPending ? "Undoing..." : "Undo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Excuse Dialog ───────────────────────────────────────────────────── */}
      <Dialog
        open={!!excuseDialog}
        onOpenChange={(open) => {
          if (!open) {
            setExcuseDialog(null);
            setExcuseReason("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Excuse</DialogTitle>
            <DialogDescription>
              Submit a valid excuse for{" "}
              <strong>{excuseDialog?.clientName}</strong> on{" "}
              <strong>
                {excuseDialog?.day
                  ? DAY_LABELS[excuseDialog.day]
                  : ""}
              </strong>
              . This will be sent for manager approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              placeholder="Reason for excuse (e.g. client on holiday, medical leave)..."
              value={excuseReason}
              onChange={(e) => setExcuseReason(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setExcuseDialog(null);
                setExcuseReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitExcuse}
              disabled={
                !excuseReason.trim() || submitExcuseMutation.isPending
              }
            >
              {submitExcuseMutation.isPending
                ? "Submitting..."
                : "Submit Excuse"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
