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
  thursday: "#f472b6",   // rose
  friday: "#a855f7",     // purple
};

const DAY_GRADIENT_PILLS: Record<DayKey, string> = {
  monday: "from-violet-400 to-fuchsia-400",
  tuesday: "from-sky-400 to-cyan-400",
  wednesday: "from-teal-400 to-emerald-400",
  thursday: "from-rose-400 to-pink-300",
  friday: "from-purple-400 to-pink-400",
};

const DAY_COLORS: Record<string, { subActive: string; doneBg: string }> = {
  monday: { subActive: "text-violet-400 drop-shadow-[0_0_6px_rgba(139,92,246,0.6)]", doneBg: "rgba(139,92,246,0.06)" },
  tuesday: { subActive: "text-sky-400 drop-shadow-[0_0_6px_rgba(14,165,233,0.6)]", doneBg: "rgba(14,165,233,0.06)" },
  wednesday: { subActive: "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]", doneBg: "rgba(20,184,166,0.06)" },
  thursday: { subActive: "text-rose-400 drop-shadow-[0_0_6px_rgba(244,114,182,0.6)]", doneBg: "rgba(244,114,182,0.06)" },
  friday: { subActive: "text-pink-400 drop-shadow-[0_0_6px_rgba(244,114,182,0.6)]", doneBg: "rgba(168,85,247,0.06)" },
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

  // Upfront/DEC OFFER renewal alerts (server-parsed from roster names)
  const { data: upfrontAlerts } = trpc.clientCheckins.getUpfrontAlertsAll.useQuery(undefined, {
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

  // Renewal alerts from server (parsed from Google Sheets roster names)
  const renewalAlerts = useMemo(() => {
    if (!upfrontAlerts || !effectiveCoachId) return [];
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return upfrontAlerts
      .filter((a) => a.coachId === effectiveCoachId)
      .map((a) => {
        const d = new Date(a.endDate + "T00:00:00");
        const dateLabel = `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        const displayName = a.clientName.replace(/\s*(UPFRONT|DEC\s*OFFER)\s*[-–—]?\s*\d{1,2}[\s/.-]+\w+[\s/.-]*\d{0,4}/gi, "").replace(/\s*\(.*\)\s*$/, "").trim();
        return { name: displayName, coach: a.coachName, day: a.dayOfWeek, offerType: a.offerType, daysLeft: a.daysLeft, dateLabel };
      });
  }, [upfrontAlerts, effectiveCoachId]);

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

    // Build a list of all roster client names for fuzzy matching excuses
    const rosterNames: Array<{ name: string; day: string }> = [];
    if (roster) {
      for (const day of DAYS) {
        for (const name of ((roster as Record<string, string[]>)[day] ?? [])) {
          rosterNames.push({ name, day });
        }
      }
    }

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
          // Match excuse clientName to roster name — excuse may have extra text like "(7 Apr)"
          const excuseName = e.clientName;
          const dayMatch = rosterNames.find(
            (r) => r.day === e.dayOfWeek && (r.name === excuseName || excuseName.startsWith(r.name) || r.name.startsWith(excuseName)),
          );
          const resolvedName = dayMatch ? dayMatch.name : excuseName;
          excused.set(`${resolvedName}|${e.dayOfWeek}`, { reason: e.reason || "" });
        }
      }
    }

    setLocalCompleted(completed);
    setLocalSubmitted(submitted);
    setLocalExcused(excused);
  }, [weekStatuses, weekExcuses, effectiveCoachId, weekStart, roster]);

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
  const [activeTab, setActiveTab] = useState<"roster" | "disengagement">("roster");
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
    type ExcusedEntry = { clientName: string; dayOfWeek: string; reason: string };
    const map = new Map<string, { coachName: string; critical: typeof allDisengaged; alert: typeof allDisengaged; warning: typeof allDisengaged; excused: ExcusedEntry[]; total: number }>();
    for (const d of allDisengaged) {
      if (!map.has(d.coachName)) {
        map.set(d.coachName, { coachName: d.coachName, critical: [], alert: [], warning: [], excused: [], total: 0 });
      }
      const group = map.get(d.coachName)!;
      group.total++;
      if (d.consecutiveMissedWeeks >= 3) group.critical.push(d);
      else if (d.consecutiveMissedWeeks === 2) group.alert.push(d);
      else if (d.consecutiveMissedWeeks === 1) group.warning.push(d);
    }
    // Add excused clients to their coach's group
    if (weekExcuses) {
      for (const e of weekExcuses as Array<{ coachId: number; coachName: string; clientName: string; dayOfWeek: string; reason: string; status: string }>) {
        if (e.status !== "approved") continue;
        const coachName = e.coachName;
        if (!map.has(coachName)) {
          map.set(coachName, { coachName, critical: [], alert: [], warning: [], excused: [], total: 0 });
        }
        map.get(coachName)!.excused.push({ clientName: e.clientName, dayOfWeek: e.dayOfWeek, reason: e.reason });
      }
    }
    return Array.from(map.values());
  }, [allDisengaged, coaches, weekExcuses]);

  // ── Render guard ───────────────────────────────────────────────────────────
  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="relative z-10">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="max-w-[1600px] mx-auto px-8 pt-20 pb-4">
          {/* Top row: Logo + title on left, coach + date selectors on right */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <img src="/databite-wordmark.png" alt="Databite" className="h-10 brightness-0 invert opacity-80" />
              <h1 className="text-3xl font-bold text-white/50 tracking-tight mt-1" style={{ fontFamily: "'Comfortaa', cursive" }}>Client Check-Ins</h1>
            </div>

            {/* Coach selector + Date selector — top right */}
            <div className="flex items-center gap-3">
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
              <div className="flex items-center gap-1.5">
                <button onClick={goToPrevWeek} className="glass rounded-xl px-3.5 py-2 text-base text-white/50 hover:text-white/80 hover:bg-white/10 transition-all">&larr;</button>
                <div className="glass rounded-xl px-4 py-2 flex items-center gap-2.5">
                  <svg className="w-4.5 h-4.5 text-violet-400/60" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                  <button
                    onClick={goToCurrentWeek}
                    className="text-base text-white/70 font-semibold hover:text-white/90 transition-colors"
                  >
                    {formatWeekRange(weekStart)}
                  </button>
                </div>
                <button onClick={goToNextWeek} className="glass rounded-xl px-3.5 py-2 text-base text-white/50 hover:text-white/80 hover:bg-white/10 transition-all">&rarr;</button>
              </div>
            </div>
          </div>

          {/* ── Stats Row — 25% bigger ────────────────────────────────────── */}
          {coachStats && (
            <div className="flex items-center gap-5 mt-6">
              <div className="glass rounded-2xl px-6 py-4 flex items-center gap-3.5">
                <div className="w-3 h-3 rounded-full bg-violet-400 glow-violet"></div>
                <div>
                  <div className="text-xs text-white/40 uppercase tracking-wider font-medium">Submitted</div>
                  <div className="text-2xl font-bold text-white/90 -mt-0.5">{coachStats.clientSubmitted}</div>
                </div>
              </div>
              <div className="glass rounded-2xl px-6 py-4 flex items-center gap-3.5">
                <div className="w-3 h-3 rounded-full bg-emerald-400 status-dot-green"></div>
                <div>
                  <div className="text-xs text-white/40 uppercase tracking-wider font-medium">Completed</div>
                  <div className="text-2xl font-bold text-white/90 -mt-0.5">{coachStats.completed}</div>
                </div>
              </div>
              <div className="glass rounded-2xl px-6 py-4 flex items-center gap-3.5">
                <div className="w-3 h-3 rounded-full bg-white/30"></div>
                <div>
                  <div className="text-xs text-white/40 uppercase tracking-wider font-medium">Remaining</div>
                  <div className="text-2xl font-bold text-white/90 -mt-0.5">{coachStats.scheduled - coachStats.completed}</div>
                </div>
              </div>
              <div className="glass rounded-2xl px-6 py-4 flex items-center gap-3.5">
                <div className="w-3 h-3 rounded-full bg-red-400 status-dot-red"></div>
                <div>
                  <div className="text-xs text-white/40 uppercase tracking-wider font-medium">Disengaging</div>
                  <div className="text-2xl font-bold text-white/90 -mt-0.5">{disengagingCount}</div>
                </div>
              </div>
              {coachStats.excused > 0 && (
                <div className="glass rounded-2xl px-6 py-4 flex items-center gap-3.5">
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <div>
                    <div className="text-xs text-white/40 uppercase tracking-wider font-medium">Excused</div>
                    <div className="text-2xl font-bold text-white/90 -mt-0.5">{coachStats.excused}</div>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* ── Tab Toggle — centered, wider ───────────────────────────── */}
          <div className="flex justify-center mt-6">
            <div className="flex items-center gap-1 glass rounded-xl p-1.5 w-full max-w-xl">
              <button
                onClick={() => setActiveTab("roster")}
                className={`flex-1 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all text-center ${activeTab === "roster" ? "bg-white/10 text-white shadow-lg shadow-white/5" : "text-white/40 hover:text-white/70"}`}
              >
                Roster
              </button>
              <button
                onClick={() => setActiveTab("disengagement")}
                className={`flex-1 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === "disengagement" ? "bg-white/10 text-white shadow-lg shadow-white/5" : "text-white/40 hover:text-white/70"}`}
              >
                Disengagement Tracking
                {disengagingCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">{disengagingCount}</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── ROSTER TAB ─────────────────────────────────────────────────── */}
        {activeTab === "roster" && (<>
        <div className="max-w-[1600px] mx-auto px-8 mt-6">
          {!effectiveCoachId ? (
            <div className="glass rounded-2xl p-8 text-center text-white/50">
              Select a coach above to view their roster.
            </div>
          ) : !roster ? (
            <div className="glass rounded-2xl p-8 text-center text-white/50">
              Loading roster...
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-5">
              {DAYS.map((day) => {
                const clients = (roster as Record<string, string[]>)[day] ?? [];
                const colours = DAY_COLORS[day];
                const stats = dayStats[day];

                return (
                  <div key={day} className="glass rounded-2xl p-5">
                    {/* Day header */}
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-1.5 h-6 rounded-full bg-gradient-to-b ${DAY_GRADIENT_PILLS[day]}`}></div>
                        <div>
                          <span className="text-base font-bold text-white/90 block leading-tight">{DAY_FULL_NAMES[day]}</span>
                          <span className="text-xs text-white/40">{getDayShortLabel(weekStart, day)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-white/80">{stats.completed}<span className="text-white/30">/{stats.total}</span></span>
                      </div>
                    </div>

                    {/* Client list */}
                    <div className="space-y-2.5">
                      {clients.length === 0 ? (
                        <p className="text-sm text-white/30 text-center py-6">No clients</p>
                      ) : (
                        clients.map((clientName: string) => {
                          const isCompleted = completedSet.has(`${clientName}|${day}`);
                          const isClientSub = clientSubmittedSet.has(`${clientName}|${day}`);
                          const excuseEntry = approvedExcuseMap.get(`${clientName}|${day}`);
                          const isExcused = !!excuseEntry;
                          const isPaused = pausedSet.has(clientName);
                          const isMissedStreak = missedSet.has(`${clientName}|${day}`);
                          const isOverdue = isClientOverdue(weekStart, day, isCompleted || isExcused || isPaused);
                          const showRed = (isOverdue || isMissedStreak) && !isCompleted && !isExcused && !isPaused;
                          const isActionable = canEdit && !isCompleted && !isExcused && !isPaused;

                          // Status logic — excused OVERRIDES submitted/completed appearance
                          const dotClass = isPaused
                            ? "bg-white/20"
                            : isExcused
                              ? "bg-white/20"
                              : isCompleted
                                ? "bg-emerald-400 status-dot-green"
                                : showRed
                                  ? "bg-red-400 status-dot-red"
                                  : "bg-white/20";

                          const nameClass = isPaused
                            ? "text-white/40 line-through"
                            : isExcused
                              ? "text-white/50"
                              : isCompleted
                                ? "text-white/80"
                                : showRed
                                  ? "text-red-300/80"
                                  : "text-white/50";

                          // Excused overrides submitted icon glow
                          const formIconClass = isExcused
                            ? "text-white/10"
                            : isClientSub
                              ? colours.subActive
                              : isCompleted
                                ? "text-violet-400/40"
                                : "text-white/10";

                          const rowStyle = isExcused
                            ? undefined
                            : isCompleted
                              ? { background: colours.doneBg }
                              : showRed
                                ? { borderColor: "rgba(248,113,113,0.15)" }
                                : undefined;

                          // Strip UPFRONT/DEC OFFER tags from display name
                          const displayName = clientName
                            .replace(/\s*(UPFRONT|DEC\s*OFFER)\s*[-–—]\s*\d{1,2}[\s/.-]+\w+[\s/.-]*\d{0,4}/gi, "")
                            .trim();

                          // Check raw name for date/tag info
                          const rawName = (roster as any)?.rawNameMap?.[clientName] as string | undefined;
                          const dateMatch = rawName?.match(/\(([^)]+)\)/);
                          const dateTag = dateMatch?.[1]?.trim() ?? null;
                          const isUpfrontOrDec = dateTag && /UPFRONT|DEC.OFFER/i.test(dateTag);
                          const isCancellation = dateTag && !isUpfrontOrDec;

                          return (
                            <div
                              key={clientName}
                              onClick={() => isActionable && handleClientClick(clientName, day)}
                              className={`group glass-btn w-full rounded-xl px-3.5 py-2.5 flex items-center justify-between transition-all duration-150
                                ${isPaused ? "opacity-40" : ""} ${isActionable ? "cursor-pointer active:scale-[0.98]" : ""}`}
                              style={rowStyle}
                            >
                              {/* Left: form icon + status dot + name */}
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                {/* Form icon (sub toggle) */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleClientSubmittedMutation.mutate({
                                      clientName,
                                      dayOfWeek: day,
                                      weekStart,
                                      ...(effectiveCoachId ? { coachId: effectiveCoachId } : {}),
                                    });
                                  }}
                                  title={isClientSub ? "Client submitted (click to unmark)" : "Mark client as submitted"}
                                  className="shrink-0 p-1 -m-1 rounded-lg hover:bg-white/10 transition-colors"
                                >
                                  <svg className={`w-4 h-4 transition-colors ${formIconClass}`} fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"/>
                                  </svg>
                                </button>

                                {/* Status dot */}
                                <div className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`}></div>

                                {/* Client name */}
                                <span className={`text-sm font-medium ${nameClass} truncate flex items-center gap-1.5`}>
                                  {displayName}
                                  {isExcused && (
                                    <span className="shrink-0" title={excuseEntry?.reason}>
                                      <svg className="w-4 h-4 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                        <line x1="12" y1="8" x2="12" y2="12"/>
                                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                                      </svg>
                                    </span>
                                  )}
                                  {isCancellation && dateTag && (
                                    <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-white/40">
                                      Finishes {dateTag}
                                    </span>
                                  )}
                                  {isUpfrontOrDec && dateTag && (
                                    <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-300">
                                      {dateTag}
                                    </span>
                                  )}
                                </span>
                              </div>

                              {/* Right: resume/undo buttons */}
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                {/* Resume button for paused clients */}
                                {isPaused && canEdit && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); resumeClientMutation.mutate({ coachId: effectiveCoachId ?? 0, clientName }); }}
                                    title="Click to resume"
                                    className="text-xs font-medium text-violet-400 hover:text-violet-300 px-2 py-1 rounded-lg hover:bg-violet-500/10 transition-all"
                                  >
                                    Resume
                                  </button>
                                )}

                                {/* Undo button */}
                                {isCompleted && canEdit && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setUndoPending({ clientName, day }); }}
                                    title="Undo check-in"
                                    className="shrink-0 p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-3.5 w-3.5"
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

        {/* ── Renewal Alerts banner ── */}
        {renewalAlerts.length > 0 && (
        <div className="max-w-[1600px] mx-auto px-8 mt-6">
            <div className="glass rounded-2xl p-6" style={{ borderColor: "rgba(251,146,60,0.2)" }}>
              <div className="flex items-center gap-2.5 mb-5">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
                <h3 className="text-base font-bold text-orange-300">
                  {renewalAlerts.length} Upcoming Renewal{renewalAlerts.length !== 1 ? "s" : ""}
                </h3>
              </div>
              <div className="space-y-2.5">
                {renewalAlerts.map((a) => (
                  <div
                    key={a.name + a.day}
                    className="rounded-xl px-4 py-3 flex items-center justify-between border border-orange-500/10 bg-orange-500/[0.04] hover:bg-orange-500/[0.08] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-sm font-medium text-orange-200 truncate">{a.name}</span>
                      <span className="text-xs text-white/40 capitalize shrink-0">{a.day}</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300 border border-orange-500/20 shrink-0">
                        {a.offerType}
                      </span>
                      <span className="text-xs text-white/40 shrink-0">{a.dateLabel}</span>
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ml-3 ${
                      a.daysLeft <= 0 ? "bg-red-500/20 text-red-300 border border-red-500/30" :
                      a.daysLeft <= 7 ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                      "bg-orange-500/10 text-orange-300 border border-orange-500/20"
                    }`}>
                      {a.daysLeft <= 0 ? `${Math.abs(a.daysLeft)}d overdue` : `in ${a.daysLeft}d`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
        </div>
        )}

        {/* ── Bottom Sections: Pause a Client & Valid Excuse side by side ── */}
        <div className="max-w-[1600px] mx-auto px-8 mt-8 pb-12">
          <div className="grid grid-cols-2 gap-6">

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

            {/* Valid Excuse */}
            {effectiveCoachId && (
            <div className="glass rounded-2xl p-5">
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

          </div>

          {/* Renewal alerts moved above Pause/Excuse section */}

        </div>
        </>)}

        {/* ── DISENGAGEMENT TAB ──────────────────────────────────────────── */}
        {activeTab === "disengagement" && (
        <div className="max-w-[1600px] mx-auto px-8 mt-4 pb-12">
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
                      {coach.excused.length > 0 && <span className="text-emerald-400">{coach.excused.length} excused</span>}
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
                      {/* Excused tier — green */}
                      {coach.excused.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="text-[9px] font-bold uppercase text-emerald-300 tracking-wider">Valid Excuse</span>
                            <div className="flex-1 border-t border-emerald-700/40" />
                          </div>
                          {coach.excused.map((e) => (
                            <div
                              key={`excused-${e.clientName}-${e.dayOfWeek}`}
                              className="glass-btn rounded-xl px-3 py-2 flex items-center justify-between"
                              style={{ borderColor: "rgba(52,211,153,0.15)" }}
                            >
                              <span className="text-xs font-medium text-emerald-300 truncate min-w-0">{e.clientName}</span>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="text-[10px] text-white/40 capitalize">{e.dayOfWeek}</span>
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">APPROVED</span>
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
        )}
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
