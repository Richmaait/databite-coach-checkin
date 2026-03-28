import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDateAU, formatWeekAU } from "@/lib/utils";
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";
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

const DAY_COLORS: Record<
  string,
  {
    header: string;
    completedBg: string;
    pendingBg: string;
    pendingHover: string;
    subActive: string;
    subHover: string;
  }
> = {
  monday: {
    header: "bg-violet-600",
    completedBg: "bg-violet-100 border-violet-300",
    pendingBg: "bg-white border-violet-200",
    pendingHover: "hover:bg-violet-50 hover:border-violet-300",
    subActive: "text-violet-600",
    subHover: "text-gray-400 hover:text-violet-500",
  },
  tuesday: {
    header: "bg-sky-600",
    completedBg: "bg-sky-100 border-sky-300",
    pendingBg: "bg-white border-sky-200",
    pendingHover: "hover:bg-sky-50 hover:border-sky-300",
    subActive: "text-sky-600",
    subHover: "text-gray-400 hover:text-sky-500",
  },
  wednesday: {
    header: "bg-teal-600",
    completedBg: "bg-teal-100 border-teal-300",
    pendingBg: "bg-white border-teal-200",
    pendingHover: "hover:bg-teal-50 hover:border-teal-300",
    subActive: "text-teal-600",
    subHover: "text-gray-400 hover:text-teal-500",
  },
  thursday: {
    header: "bg-amber-600",
    completedBg: "bg-amber-100 border-amber-300",
    pendingBg: "bg-white border-amber-200",
    pendingHover: "hover:bg-amber-50 hover:border-amber-300",
    subActive: "text-amber-600",
    subHover: "text-gray-400 hover:text-amber-500",
  },
  friday: {
    header: "bg-purple-600",
    completedBg: "bg-purple-100 border-purple-300",
    pendingBg: "bg-white border-purple-200",
    pendingHover: "hover:bg-purple-50 hover:border-purple-300",
    subActive: "text-purple-600",
    subHover: "text-gray-400 hover:text-purple-500",
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

  // ── Disengagement grouping ─────────────────────────────────────────────────
  const disengagedGrouped = useMemo(() => {
    if (!allDisengaged) return { critical: [], alert: [], warning: [] };
    const critical: typeof allDisengaged = [];
    const alert: typeof allDisengaged = [];
    const warning: typeof allDisengaged = [];
    for (const d of allDisengaged) {
      if (d.consecutiveMissedWeeks >= 3) critical.push(d);
      else if (d.consecutiveMissedWeeks === 2) alert.push(d);
      else if (d.consecutiveMissedWeeks === 1) warning.push(d);
    }
    return { critical, alert, warning };
  }, [allDisengaged]);

  // ── Render guard ───────────────────────────────────────────────────────────
  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto py-4 px-4 space-y-4">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Client Check-Ins
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track weekly client check-in completions
            </p>
          </div>
          {/* Coach selector — top right */}
          {isAdmin && coaches && (
            <Select
              value={selectedCoachId?.toString() ?? ""}
              onValueChange={(v) => setSelectedCoachId(parseInt(v))}
            >
              <SelectTrigger className="w-44 bg-secondary border-border">
                <SelectValue placeholder="Select coach" />
              </SelectTrigger>
              <SelectContent>
                {coaches.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* ── Reminder banner ─────────────────────────────────────────────── */}
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800">
          Please ensure you mark check-ins as completed as they are sent out for
          timestamp purposes
        </div>

        {/* ── Week navigation + stats ─────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Stats badges — left side */}
          {coachStats && (
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className="text-xs py-1 px-2.5 border-sky-300 text-sky-700 bg-sky-50"
              >
                <FileText className="h-3 w-3 mr-1" />
                {coachStats.clientSubmitted} Submitted
              </Badge>
              <Badge
                variant="outline"
                className="text-xs py-1 px-2.5 border-emerald-300 text-emerald-700 bg-emerald-50"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {coachStats.completed} Completed
              </Badge>
            </div>
          )}

          {/* Week selector — right side */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={goToPrevWeek}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={goToCurrentWeek}
              className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-sm font-medium transition-colors"
            >
              {formatWeekAU(weekStart)}
            </button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={goToNextWeek}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Tabs — full width ──────────────────────────────────────────── */}
        <Tabs defaultValue="roster" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="roster">Roster</TabsTrigger>
            <TabsTrigger value="disengagement">
              Disengagement Tracking
            </TabsTrigger>
          </TabsList>

          {/* ── Roster Tab ──────────────────────────────────────────────── */}
          <TabsContent value="roster" className="mt-4">
            {!effectiveCoachId ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground text-sm">
                  Select a coach above to view their roster.
                </CardContent>
              </Card>
            ) : !roster ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground text-sm">
                  Loading roster...
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-5 gap-3">
                {DAYS.map((day) => {
                  const clients = (roster as Record<string, string[]>)[day] ?? [];
                  const colours = DAY_COLORS[day];
                  const dayDateLabel = getDayDateLabel(weekStart, day);

                  return (
                    <div
                      key={day}
                      className="rounded-xl overflow-hidden border border-border"
                    >
                      {/* Day header */}
                      <div
                        className={`${colours.header} text-white px-3 py-2.5 text-center`}
                      >
                        <div className="text-sm font-semibold">
                          {DAY_LABELS[day]}
                        </div>
                        <span className="text-xs opacity-70">
                          {dayDateLabel}
                        </span>
                      </div>

                      {/* Client list */}
                      <div className="p-2 space-y-1.5 bg-gray-50 min-h-[120px]">
                        {clients.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            No clients
                          </p>
                        ) : (
                          clients.map((clientName: string) => {
                            const isCompleted = completedSet.has(
                              `${clientName}|${day}`,
                            );
                            const isClientSub = clientSubmittedSet.has(
                              `${clientName}|${day}`,
                            );
                            const excuseEntry = approvedExcuseMap.get(
                              `${clientName}|${day}`,
                            );
                            const isExcused =
                              !!excuseEntry && !isCompleted;
                            const isMissedStreak = missedSet.has(
                              `${clientName}|${day}`,
                            );
                            const isOverdue = isClientOverdue(
                              weekStart,
                              day,
                              isCompleted || isExcused,
                            );
                            const showRed =
                              (isOverdue || isMissedStreak) &&
                              !isCompleted &&
                              !isExcused;

                            return (
                              <div
                                key={clientName}
                                className="flex items-center gap-1"
                              >
                                {/* Sub button */}
                                <button
                                  onClick={() =>
                                    toggleClientSubmittedMutation.mutate({
                                      clientName,
                                      dayOfWeek: day,
                                      weekStart,
                                      ...(effectiveCoachId
                                        ? { coachId: effectiveCoachId }
                                        : {}),
                                    })
                                  }
                                  title={
                                    isClientSub
                                      ? "Client submitted (click to unmark)"
                                      : "Mark client as submitted"
                                  }
                                  className={`shrink-0 p-1 rounded-md transition-all duration-150 ${
                                    isClientSub
                                      ? `${colours.subActive} ring-1 ring-current/30`
                                      : colours.subHover
                                  }`}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4"
                                    viewBox="0 0 24 24"
                                    fill={
                                      isClientSub ? "currentColor" : "none"
                                    }
                                    stroke="currentColor"
                                    strokeWidth={isClientSub ? 1.5 : 2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line
                                      x1="16"
                                      y1="13"
                                      x2="8"
                                      y2="13"
                                    />
                                    <line
                                      x1="16"
                                      y1="17"
                                      x2="8"
                                      y2="17"
                                    />
                                    <polyline points="10 9 9 9 8 9" />
                                  </svg>
                                </button>

                                {/* Client name button */}
                                <button
                                  onClick={() =>
                                    canEdit &&
                                    !isCompleted &&
                                    !isExcused &&
                                    handleClientClick(clientName, day)
                                  }
                                  disabled={
                                    isCompleted || isExcused || !canEdit
                                  }
                                  title={
                                    isExcused
                                      ? `Excused — ${excuseEntry?.reason}`
                                      : undefined
                                  }
                                  className={`
                                    flex-1 text-left px-2.5 py-2 rounded-lg border text-xs font-medium
                                    transition-all duration-150 flex items-center gap-2
                                    ${
                                      isCompleted
                                        ? `${colours.completedBg} cursor-default opacity-80`
                                        : isExcused
                                          ? "bg-emerald-50 border-emerald-300 cursor-default opacity-80"
                                          : showRed
                                            ? "bg-red-50 border-red-300 hover:bg-red-100 hover:border-red-400 cursor-pointer"
                                            : `${colours.pendingBg} ${colours.pendingHover} cursor-pointer`
                                    }
                                  `}
                                >
                                  {isCompleted ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                  ) : isExcused ? (
                                    <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                  ) : showRed ? (
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                                  ) : (
                                    <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                                  )}
                                  <span
                                    className={`leading-tight ${
                                      isExcused
                                        ? "text-emerald-700"
                                        : showRed
                                          ? "text-red-700"
                                          : "text-gray-800"
                                    }`}
                                  >
                                    {clientName}
                                  </span>
                                </button>

                                {/* Excuse button */}
                                {canEdit &&
                                  !isCompleted &&
                                  !isExcused && (
                                    <button
                                      onClick={() => {
                                        setExcuseReason("");
                                        setExcuseDialog({
                                          clientName,
                                          day,
                                        });
                                      }}
                                      title="Submit excuse"
                                      className="shrink-0 p-1 rounded text-muted-foreground hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                    >
                                      <ShieldAlert className="h-3 w-3" />
                                    </button>
                                  )}

                                {/* Undo button */}
                                {isCompleted && canEdit && (
                                  <button
                                    onClick={() =>
                                      setUndoPending({
                                        clientName,
                                        day,
                                      })
                                    }
                                    title="Undo check-in"
                                    className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Disengagement Tab ────────────────────────────────────────── */}
          <TabsContent value="disengagement" className="mt-4 space-y-4">
            {/* Critical: 3+ consecutive missed weeks */}
            {disengagedGrouped.critical.length > 0 && (
              <Card className="border-red-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-red-700 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Critical — 3+ Consecutive Missed Weeks (
                    {disengagedGrouped.critical.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {disengagedGrouped.critical.map((d) => (
                      <div
                        key={`${d.coachName}-${d.clientName}-${d.dayOfWeek}`}
                        className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-red-50 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-red-800">
                            {d.clientName}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] border-red-300 text-red-600"
                          >
                            {d.dayOfWeek}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-red-600">
                          <span>{d.consecutiveMissedWeeks} weeks missed</span>
                          <span className="text-muted-foreground">
                            Coach: {d.coachName}
                          </span>
                          {d.lastCompletedWeek && (
                            <span className="text-muted-foreground">
                              Last done: {formatDateAU(d.lastCompletedWeek)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Alert: 2 consecutive missed weeks */}
            {disengagedGrouped.alert.length > 0 && (
              <Card className="border-amber-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Alert — 2 Consecutive Missed Weeks (
                    {disengagedGrouped.alert.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {disengagedGrouped.alert.map((d) => (
                      <div
                        key={`${d.coachName}-${d.clientName}-${d.dayOfWeek}`}
                        className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-amber-50 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-amber-800">
                            {d.clientName}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] border-amber-300 text-amber-600"
                          >
                            {d.dayOfWeek}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-amber-600">
                          <span>2 weeks missed</span>
                          <span className="text-muted-foreground">
                            Coach: {d.coachName}
                          </span>
                          {d.lastCompletedWeek && (
                            <span className="text-muted-foreground">
                              Last done: {formatDateAU(d.lastCompletedWeek)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Warning: 1 missed week */}
            {disengagedGrouped.warning.length > 0 && (
              <Card className="border-yellow-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-yellow-700 flex items-center gap-2">
                    <Circle className="h-4 w-4" />
                    Warning — 1 Missed Week ({disengagedGrouped.warning.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {disengagedGrouped.warning.map((d) => (
                      <div
                        key={`${d.coachName}-${d.clientName}-${d.dayOfWeek}`}
                        className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-yellow-50 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-yellow-800">
                            {d.clientName}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] border-yellow-300 text-yellow-600"
                          >
                            {d.dayOfWeek}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-yellow-600">
                          <span>1 week missed</span>
                          <span className="text-muted-foreground">
                            Coach: {d.coachName}
                          </span>
                          {d.lastCompletedWeek && (
                            <span className="text-muted-foreground">
                              Last done: {formatDateAU(d.lastCompletedWeek)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty state */}
            {!allDisengaged ||
              (disengagedGrouped.critical.length === 0 &&
                disengagedGrouped.alert.length === 0 &&
                disengagedGrouped.warning.length === 0 && (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground text-sm">
                      No disengaged clients this week. Great work!
                    </CardContent>
                  </Card>
                ))}
          </TabsContent>
        </Tabs>
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
