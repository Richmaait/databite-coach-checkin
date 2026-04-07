import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { formatDateAU, formatWeekAU, melbourneNow } from "@/lib/utils";
import { format, subDays, addDays, subMonths, getISOWeek, getYear, startOfWeek, endOfWeek } from "date-fns";
import { Activity, AlertTriangle, CalendarDays, FileText, ListChecks, MessageSquare, TrendingDown, TrendingUp, Users, ShieldAlert, ShieldCheck, ShieldX, Clock3, Loader2 } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocation } from "wouter";

type RangeKey = "today" | "wtd" | "7d" | "14d" | "30d" | "90d" | "180d" | "12m" | "custom";

/** Returns the Monday of the current work week.
 *  Mon–Sat: returns this week's Monday.
 *  Sunday: the work week (Mon–Fri) is over, so "this week" = the week that just finished.
 *  The new week flips on Monday. */
function currentMonday(from: Date = melbourneNow()): Date {
  const d = new Date(from);
  const dow = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // Sunday: treat as end of the prior work week — go back to that Monday
  const diff = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

/** Returns the Friday of a given Monday's week. */
function fridayOfWeek(monday: Date): Date {
  return addDays(monday, 4);
}

function getDateRange(
  range: RangeKey,
  customFrom?: Date | null,
  customTo?: Date | null
): { startDate: string; endDate: string } {
  const today = melbourneNow();
  switch (range) {
    case "today":
      return { startDate: format(today, "yyyy-MM-dd"), endDate: format(today, "yyyy-MM-dd") };
    case "wtd": {
      // This week: Mon of current week → today
      const mon = currentMonday(today);
      return { startDate: format(mon, "yyyy-MM-dd"), endDate: format(today, "yyyy-MM-dd") };
    }
    case "7d": {
      // Last week: data range is full 7 days (Sun–Sat), displayed as Mon–Fri
      const thisMon = currentMonday(today);
      const lastMon = subDays(thisMon, 7);
      const lastSun = subDays(thisMon, 1); // Sunday end of last week
      return { startDate: format(lastMon, "yyyy-MM-dd"), endDate: format(lastSun, "yyyy-MM-dd") };
    }
    case "14d": {
      const thisMon = currentMonday(today);
      const startMon = subDays(thisMon, 14);
      const lastSun = subDays(thisMon, 1);
      return { startDate: format(startMon, "yyyy-MM-dd"), endDate: format(lastSun, "yyyy-MM-dd") };
    }
    case "30d": {
      const thisMon = currentMonday(today);
      const startMon = subDays(thisMon, 28);
      const lastSun = subDays(thisMon, 1);
      return { startDate: format(startMon, "yyyy-MM-dd"), endDate: format(lastSun, "yyyy-MM-dd") };
    }
    case "90d": {
      const thisMon = currentMonday(today);
      const startMon = subDays(thisMon, 91);
      const lastSun = subDays(thisMon, 1);
      return { startDate: format(startMon, "yyyy-MM-dd"), endDate: format(lastSun, "yyyy-MM-dd") };
    }
    case "180d": {
      const thisMon = currentMonday(today);
      const startMon = subDays(thisMon, 182);
      const lastSun = subDays(thisMon, 1);
      return { startDate: format(startMon, "yyyy-MM-dd"), endDate: format(lastSun, "yyyy-MM-dd") };
    }
    case "12m": {
      const thisMon = currentMonday(today);
      const startMon = subDays(thisMon, 364);
      const lastSun = subDays(thisMon, 1);
      return { startDate: format(startMon, "yyyy-MM-dd"), endDate: format(lastSun, "yyyy-MM-dd") };
    }
    case "custom":
      if (customFrom && customTo) {
        return {
          startDate: format(customFrom, "yyyy-MM-dd"),
          endDate: format(customTo, "yyyy-MM-dd"),
        };
      }
      // Fallback to last complete week
      return (() => {
        const sun = lastSunday(today);
        const mon = mondayNWeeksBeforeSunday(sun, 1);
        return { startDate: format(mon, "yyyy-MM-dd"), endDate: format(sun, "yyyy-MM-dd") };
      })();
    default: {
      const sun = lastSunday(today);
      const mon = mondayNWeeksBeforeSunday(sun, 4);
      return { startDate: format(mon, "yyyy-MM-dd"), endDate: format(sun, "yyyy-MM-dd") };
    }
  }
}

const COACH_COLORS = [
  "oklch(0.72 0.17 162)",  // Kyah — teal/green
  "oklch(0.75 0.15 220)",  // Luke — sky blue
  "oklch(0.72 0.16 280)",  // Steve — purple/violet
  "oklch(0.78 0.15 320)",  // extra — pink
  "oklch(0.72 0.16 340)",  // extra — rose
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/[0.08] rounded-xl px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="text-white/50 font-medium mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white/50">{p.name}:</span>
          <span className="text-white/90 font-semibold">{typeof p.value === "number" ? (p.name.includes("%") ? `${p.value.toFixed(1)}%` : p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

/** Tooltip for the Engagement Rate by Coach line chart — shows completed / scheduled counts */
const EngagementTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  // Filter out the hidden __completed__ / __scheduled__ keys — only show real coach lines
  const visiblePayload = payload.filter((p: any) => !p.dataKey.startsWith("__"));
  if (!visiblePayload.length) return null;
  // The data point object is accessible via payload[0].payload
  const dataPoint = payload[0]?.payload ?? {};
  return (
    <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/[0.08] rounded-xl px-3 py-2.5 shadow-xl text-xs space-y-1.5 min-w-[160px]">
      <p className="text-white/50 font-medium mb-1.5">{label}</p>
      {visiblePayload.map((p: any, i: number) => {
        const completed = dataPoint[`__completed__${p.name}`] as number | undefined;
        const scheduled = dataPoint[`__scheduled__${p.name}`] as number | undefined;
        return (
          <div key={i} className="space-y-0.5">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
              <span className="text-white/90 font-semibold">{p.name}</span>
              <span className="text-white/50 ml-auto">{typeof p.value === "number" ? `${p.value.toFixed(1)}%` : p.value}</span>
            </div>
            {completed !== undefined && scheduled !== undefined && (
              <p className="text-white/50 pl-4">{completed} / {scheduled} clients</p>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Sweep Report History Section ────────────────────────────────────────────
function SweepReportHistorySection() {
  const [, setLocation] = useLocation();
  const { data: savedReports, isLoading } = trpc.sweepReport.listSaved.useQuery(
    undefined,
    { staleTime: 60 * 1000 }
  );

  // Build chart data: each saved report becomes a data point
  const chartData = useMemo(() => {
    if (!savedReports) return [];
    return [...savedReports].reverse().map(r => ({
      label: r.title.replace("Post-Sweep Report \u2014 ", "").replace("Post-Sweep Report - ", ""),
      greenPct: r.greenPct,
      redCount: r.redCount,
      yellowCount: r.yellowCount,
      engPct: r.overallEngagementPct,
      id: r.id,
    }));
  }, [savedReports]);

  if (isLoading) return null;
  if (!savedReports || savedReports.length === 0) return null;

  return (
    <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-white/50" />
          <CardTitle className="text-sm font-semibold text-white/90">Post-Sweep Report History</CardTitle>
        </div>
        <p className="text-xs text-white/50">Saved sweep reports — click any row to open the full report</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Trend chart: On Track % over time */}
        {chartData.length >= 2 && (
          <div>
            <p className="text-xs text-white/50 mb-3">On Track % trend across sweeps</p>
            <ResponsiveContainer width="100%" height={160}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "oklch(0.6 0 0)" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "oklch(0.6 0 0)" }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/[0.08] rounded-xl px-3 py-2 shadow-xl text-xs space-y-1">
                        <p className="text-white/50 font-medium mb-1">{label}</p>
                        {payload.map((p: any, i: number) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                            <span className="text-white/50">{p.name}:</span>
                            <span className="text-white/90 font-semibold">{typeof p.value === "number" ? `${p.value.toFixed(1)}%` : p.value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={70} stroke="oklch(0.72 0.17 162)" strokeDasharray="4 3" label={{ value: "70% target", position: "insideTopRight", fontSize: 9, fill: "oklch(0.72 0.17 162)" }} />
                <Line type="monotone" dataKey="greenPct" name="On Track %" stroke="oklch(0.72 0.17 162)" strokeWidth={2} dot={{ r: 4, fill: "oklch(0.72 0.17 162)" }} />
                <Line type="monotone" dataKey="engPct" name="Engagement %" stroke="oklch(0.75 0.18 55)" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: "oklch(0.75 0.18 55)" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Report list */}
        <div className="divide-y divide-border rounded-xl overflow-hidden border border-white/[0.08]">
          {savedReports.map((report, i) => {
            const onTrackColor = report.greenPct >= 70 ? "text-emerald-400" : report.greenPct >= 50 ? "text-yellow-200" : "text-red-400";
            const engColor = report.overallEngagementPct >= 80 ? "text-emerald-400" : report.overallEngagementPct >= 60 ? "text-yellow-200" : "text-red-400";
            return (
              <button
                key={report.id}
                onClick={() => setLocation(`/sweep-report/${report.id}`)}
                className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-white/10 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white/90 truncate">{report.title}</p>
                    {report.scopeType === "coach" && report.scopeCoachName && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30 shrink-0">
                        1-on-1: {report.scopeCoachName}
                      </span>
                    )}
                  </div>
                  {report.weekStart && (
                    <p className="text-xs text-white/50 mt-0.5">
                      Week of {new Date(report.weekStart).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs">
                  <div className="text-center">
                    <div className={`font-bold tabular-nums ${onTrackColor}`}>{report.greenPct.toFixed(0)}%</div>
                    <div className="text-white/50">On Track</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /><span className="text-emerald-400 font-semibold">{report.greenCount}</span></span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-200/80" /><span className="text-yellow-200 font-semibold">{report.yellowCount}</span></span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /><span className="text-red-400 font-semibold">{report.redCount}</span></span>
                  </div>
                  <div className="text-center hidden sm:block">
                    <div className={`font-bold tabular-nums ${engColor}`}>{report.overallEngagementPct.toFixed(0)}%</div>
                    <div className="text-white/50">Engagement</div>
                  </div>
                  <div className="text-white/50 hidden md:block">
                    {new Date(report.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Melbourne" })}
                  </div>
                  <svg className="h-4 w-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [range, setRange] = useState<RangeKey>("7d");
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [customStep, setCustomStep] = useState<"from" | "to">("from");
  const rangeOptions: { value: RangeKey; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "wtd",   label: "This week" },
    { value: "7d",    label: "Last week" },
    { value: "14d",   label: "2 weeks" },
    { value: "30d",   label: "1 month" },
    { value: "90d",   label: "3 months" },
    { value: "180d",  label: "6 months" },
    { value: "12m",   label: "12 months" },
  ];
  const [selectedCoachId, setSelectedCoachId] = useState<number | null>(null);
  const [volumeCoachFilter, setVolumeCoachFilter] = useState<number | "all">("all");
  // Single filter for the combined engagement chart (replaces dailyCoachFilter + engagementCoachFilter)
  const [chartCoachFilter, setChartCoachFilter] = useState<number | "all">("all");
  // Engagement % over time graph toggle: "team" = single team line, "individual" = per-coach lines
  const [engagementTrendView, setEngagementTrendView] = useState<"team" | "individual">("team");

  const { startDate, endDate } = getDateRange(range, customFrom, customTo);
  // Previous week window (same duration, shifted back 7 days) for WoW comparison
  const prevWeekStarts = useMemo(() => {
    const prevEnd = subDays(new Date(endDate + "T00:00:00"), 7);
    const prevStart = subDays(new Date(startDate + "T00:00:00"), 7);
    const starts: string[] = [];
    const d = new Date(prevEnd);
    const dow = d.getDay();
    const daysToMon = dow === 0 ? 6 : dow - 1;
    d.setDate(d.getDate() - daysToMon);
    while (d >= prevStart) {
      starts.push(format(d, "yyyy-MM-dd"));
      d.setDate(d.getDate() - 7);
    }
    return starts;
  }, [startDate, endDate]);
  const { data: coaches } = trpc.coaches.list.useQuery(undefined, { enabled: !!user });
  const { data: aggregateData, isLoading } = trpc.checkins.aggregate.useQuery(
    { startDate, endDate },
    { enabled: !!user }
  );
  const { data: rawRecords } = trpc.checkins.byDateRange.useQuery(
    { startDate, endDate },
    { enabled: !!user }
  );

  // Low mood alerts — today's submissions with moodScore <= 2
  // Use Australia/Melbourne timezone (handles DST: AEDT UTC+11 Oct-Apr, AEST UTC+10 Apr-Oct)
  const todayDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(melbourneNow());
  const { data: lowMoodAlerts } = trpc.checkins.lowMoodAlerts.useQuery(
    { recordDate: todayDate },
    { enabled: !!user }
  );

  // Submission streaks per coach
  const { data: streakData } = trpc.coaches.streaks.useQuery(
    undefined,
    { enabled: !!user }
  );

  // Recent notes feed
  const { data: recentNotes } = trpc.checkins.recentNotes.useQuery(
    undefined,
    { enabled: !!user }
  );

  // Lagged mood data: the period immediately before the selected range
  // e.g. if range is "30d" (last 30 days), the mood period is the 30 days before that
  const laggedMoodRange = useMemo(() => {
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);
    const rangeDays = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
    const lagEnd = new Date(rangeStart);
    lagEnd.setDate(lagEnd.getDate() - 1);
    const lagStart = new Date(lagEnd);
    lagStart.setDate(lagStart.getDate() - rangeDays);
    return {
      startDate: format(lagStart, "yyyy-MM-dd"),
      endDate: format(lagEnd, "yyyy-MM-dd"),
    };
  }, [startDate, endDate]);
  const { data: lastWeekRecords } = trpc.checkins.byDateRange.useQuery(
    { startDate: laggedMoodRange.startDate, endDate: laggedMoodRange.endDate },
    { enabled: !!user }
  );

  const isAdmin = user?.role === "admin";
  // Current week Monday for excuse queries — use local date parts to avoid UTC timezone shift
  // (server may be in a different timezone; browser local time is what matters here)
  const currentWeekStart = useMemo(() => {
    const d = melbourneNow();
    d.setHours(0, 0, 0, 0);
    const dow = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const diff = dow === 0 ? -6 : 1 - dow; // shift to Monday
    d.setDate(d.getDate() + diff);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);
  // Pending excuses awaiting approval
  const { data: pendingExcuses, refetch: refetchPendingExcuses } = trpc.clientCheckins.getPendingExcuses.useQuery(
    undefined,
    { enabled: !!user && isAdmin, staleTime: 30 * 1000 }
  );
  const utils = trpc.useUtils();
  // Hoisted here (top-level) to comply with Rules of Hooks — must not be inside JSX callbacks or conditional blocks
  const reviewExcuseMutation = trpc.clientCheckins.reviewExcuse.useMutation({
    onSuccess: (_: any, vars: any) => {
      refetchPendingExcuses();
      utils.clientCheckins.getPendingExcuses.invalidate();
      utils.clientCheckins.getExcuseCountsByCoach.invalidate();
      toast.success(vars.status === "approved" ? "Excuse approved." : "Excuse rejected.");
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to review excuse"),
  });
  // Client check-in missed streaks (all coaches))
  const { data: allMissedStreaks } = trpc.clientCheckins.getAllMissedStreaks.useQuery(
    undefined,
    { enabled: !!user && isAdmin, staleTime: 5 * 60 * 1000 }
  );
  // Disengaged clients (1+ consecutive missed check-ins) — new granular view
  // viewWeek = Monday of the endDate's week, so streaks are capped to the selected period
  const disengagementViewWeek = useMemo(() => {
    const d = new Date(endDate + "T00:00:00");
    const dow = d.getDay(); // 0=Sun
    const daysToMon = dow === 0 ? 6 : dow - 1;
    d.setDate(d.getDate() - daysToMon);
    return format(d, "yyyy-MM-dd");
  }, [endDate]);
  // Per-coach excuse counts for the selected week (follows disengagementViewWeek, which is derived from endDate)
  const { data: excuseCountsByCoach } = trpc.clientCheckins.getExcuseCountsByCoach.useQuery(
    { weekStart: disengagementViewWeek },
    { enabled: !!user && isAdmin, staleTime: 60 * 1000 }
  );
  const { data: allDisengagedData } = trpc.clientCheckins.getAllDisengagedClients.useQuery(
    { viewWeek: disengagementViewWeek === currentWeekStart ? undefined : disengagementViewWeek },
    { enabled: !!user && isAdmin, staleTime: 0 }
  );
  const allDisengagedClients = allDisengagedData?.clients;
  const disengagedRosterSizeByCoach = allDisengagedData?.rosterSizeByCoach ?? {};
  // Today's Plans — all coaches' morning submissions for today
  const { data: todayMorning } = trpc.clientCheckins.getAllTodayMorning.useQuery(
    { recordDate: todayDate },
    { enabled: !!user && isAdmin, staleTime: 2 * 60 * 1000 }
  );
  // Roster-based weekly stats — compute Monday weekStarts within the selected range
  const rosterWeekStarts = useMemo(() => {
    const starts: string[] = [];
    // Walk backward from the Monday of endDate's week.
    // Always include the Monday of startDate's week so single-day ranges (Today)
    // still resolve to a valid weekStart.
    const d = new Date(endDate + "T00:00:00");
    const dow = d.getDay();
    const daysToMon = dow === 0 ? 6 : dow - 1;
    d.setDate(d.getDate() - daysToMon); // Monday of endDate's week
    // The earliest Monday we need is the Monday of startDate's week
    const startMon = new Date(startDate + "T00:00:00");
    const startDow = startMon.getDay();
    const startDaysToMon = startDow === 0 ? 6 : startDow - 1;
    startMon.setDate(startMon.getDate() - startDaysToMon);
    while (d >= startMon) {
      starts.push(format(d, "yyyy-MM-dd"));
      d.setDate(d.getDate() - 7);
    }
    return starts;
  }, [startDate, endDate]);
  const { data: rosterStats } = trpc.clientCheckins.getRosterWeeklyStats.useQuery(
    { weekStarts: rosterWeekStarts, startDate, endDate },
    { enabled: !!user && isAdmin && rosterWeekStarts.length > 0, staleTime: 2 * 60 * 1000 }
  );
  // Day-by-day roster stats for the combined chart
  const { data: dailyStats } = trpc.clientCheckins.getRosterDailyStats.useQuery(
    { startDate, endDate },
    { enabled: !!user && isAdmin, staleTime: 2 * 60 * 1000 }
  );
  // Previous week stats for WoW comparison badges
  const { data: prevRosterStats } = trpc.clientCheckins.getRosterWeeklyStats.useQuery(
    { weekStarts: prevWeekStarts },
    { enabled: !!user && isAdmin && prevWeekStarts.length > 0, staleTime: 5 * 60 * 1000 }
  );

  // Prior 6 weeks for KPI tracker (always fetched regardless of range)
  const kpiTrackerWeekStarts = useMemo(() => {
    const starts: string[] = [];
    const mon = currentMonday(melbourneNow());
    // Start from LAST week's Monday (current week is incomplete), go back 6 weeks
    const d = subDays(mon, 7);
    for (let i = 0; i < 6; i++) {
      starts.push(format(d, "yyyy-MM-dd"));
      d.setDate(d.getDate() - 7);
    }
    return starts;
  }, []);
  const { data: kpiTrackerStats } = trpc.clientCheckins.getRosterWeeklyStats.useQuery(
    { weekStarts: kpiTrackerWeekStarts },
    { enabled: !!user && isAdmin && kpiTrackerWeekStarts.length > 0, staleTime: 5 * 60 * 1000 }
  );

  // ── Compute summary stats (must be before any early return — React hooks rules) ─
  const morningRecords = rawRecords?.filter(r => r.submissionType === "morning") ?? [];
  const followupRecords = rawRecords?.filter(r => r.submissionType === "followup") ?? [];
  const disengagementRecords = rawRecords?.filter(r => r.submissionType === "disengagement") ?? [];
  // Roster-based totals (replaces old morning-form scheduledCheckins/completedCheckins/engagementPct)
  const totalScheduled = (rosterStats ?? []).reduce((s, r) => s + r.scheduled, 0);
  const totalCompleted = (rosterStats ?? []).reduce((s, r) => s + r.completed, 0);
  // Previous week totals for WoW badges
  const prevScheduled = (prevRosterStats ?? []).reduce((s, r) => s + r.scheduled, 0);
  const prevCompleted = (prevRosterStats ?? []).reduce((s, r) => s + r.completed, 0);
  const prevEngagement = (() => {
    const rows = prevRosterStats ?? [];
    const sched = rows.reduce((s, r) => s + r.scheduled, 0);
    const exc = rows.reduce((s, r) => s + (r.excused ?? 0), 0);
    const eff = Math.max(sched - exc, 1);
    return sched > 0 ? Math.round((rows.reduce((s, r) => s + r.completed, 0) / eff) * 1000) / 10 : 0;
  })();
  const avgEngagement = (() => {
    const rows = rosterStats ?? [];
    const sched = rows.reduce((s, r) => s + r.scheduled, 0);
    const exc = rows.reduce((s, r) => s + (r.excused ?? 0), 0);
    const eff = Math.max(sched - exc, 1);
    return sched > 0 ? Math.round((rows.reduce((s, r) => s + r.completed, 0) / eff) * 1000) / 10 : 0;
  })();
  const totalFollowup = followupRecords.reduce((s, r) => s + (r.followupMessagesSent ?? 0), 0);
  const totalDisengagement = disengagementRecords.reduce((s, r) => s + (r.disengagementMessagesSent ?? 0), 0);

  // ── Combined engagement chart data: grouped bars (Scheduled/Completed per coach) + engagement % lines ──
  // One row per coach per week + a Team totals row. Blank separator rows between weeks.
  const combinedChartData = useMemo(() => {
    if (!rosterStats || !coaches) return [];
    const filteredCoaches = chartCoachFilter === "all"
      ? coaches
      : coaches.filter(c => c.id === chartCoachFilter);
    const byWeek: Record<string, Record<string, number>> = {};
    for (const r of rosterStats) {
      if (chartCoachFilter !== "all" && r.coachId !== chartCoachFilter) continue;
      if (!byWeek[r.weekStart]) byWeek[r.weekStart] = { __totalScheduled: 0, __totalCompleted: 0, __totalExcused: 0 };
      const excused = (r as any).excused ?? 0;
      byWeek[r.weekStart][`${r.coachName}_scheduled`] = (byWeek[r.weekStart][`${r.coachName}_scheduled`] ?? 0) + r.scheduled;
      byWeek[r.weekStart][`${r.coachName}_completed`] = (byWeek[r.weekStart][`${r.coachName}_completed`] ?? 0) + r.completed;
      byWeek[r.weekStart][`${r.coachName}_excused`] = (byWeek[r.weekStart][`${r.coachName}_excused`] ?? 0) + excused;
      byWeek[r.weekStart].__totalScheduled += r.scheduled;
      byWeek[r.weekStart].__totalCompleted += r.completed;
      byWeek[r.weekStart].__totalExcused += excused;
    }
    const sortedWeeks = Object.entries(byWeek).sort(([a], [b]) => a.localeCompare(b));
    const rows: Record<string, string | number | null>[] = [];
    sortedWeeks.forEach(([weekStart, vals], wi) => {
      const weekLabel = formatDateAU(weekStart);
      const teamEffective = Math.max(vals.__totalScheduled - vals.__totalExcused, 1);
      const teamEngPct = vals.__totalScheduled > 0
        ? Math.round((vals.__totalCompleted / teamEffective) * 1000) / 10
        : 0;
      // One row per coach — always show coach name on X-axis
      filteredCoaches.forEach((coach, ci) => {
        const coachSched = vals[`${coach.name}_scheduled`] ?? 0;
        const coachComp = vals[`${coach.name}_completed`] ?? 0;
        const coachExc = vals[`${coach.name}_excused`] ?? 0;
        const coachEffective = Math.max(coachSched - coachExc, 1);
        const coachEngPct = coachSched > 0
          ? Math.round((coachComp / coachEffective) * 1000) / 10
          : null;
        rows.push({
          date: coach.name,
          coachLabel: coach.name,
          weekStart,
          __weekLabel: weekLabel,
          Scheduled: coachSched,
          Completed: coachComp,
          "Engagement %": null as any,
          [`eng_${coach.name}`]: coachEngPct,
          __coachIdx: ci,
          __coachId: coach.id,
          __coachEngPct: coachEngPct,
          __teamScheduled: vals.__totalScheduled,
        });
      });
      // Team totals row
      rows.push({
        date: "Team",
        coachLabel: "Team",
        weekStart,
        __weekLabel: weekLabel,
        Scheduled: vals.__totalScheduled,
        Completed: vals.__totalCompleted,
        "Engagement %": teamEngPct as any,
        __coachIdx: -1,
        __isTeam: 1,
        __teamEngPct: teamEngPct,
        __teamScheduled: vals.__totalScheduled,
      });
      // Blank separator between weeks (except after last week)
      if (wi < sortedWeeks.length - 1) {
        rows.push({ date: "", Scheduled: 0, Completed: 0, "Engagement %": null, __separator: 1 });
      }
    });
    return rows;
  }, [rosterStats, coaches, chartCoachFilter]);

  // Keep volumeData for the day-by-day chart (used elsewhere)
  const volumeData = useMemo(() => {
    if (!rosterStats) return [];
    const byWeek: Record<string, { scheduled: number; completed: number }> = {};
    for (const r of rosterStats) {
      if (volumeCoachFilter !== "all" && r.coachId !== volumeCoachFilter) continue;
      if (!byWeek[r.weekStart]) byWeek[r.weekStart] = { scheduled: 0, completed: 0 };
      byWeek[r.weekStart].scheduled += r.scheduled;
      byWeek[r.weekStart].completed += r.completed;
    }
    return Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, vals]) => ({
        date: formatDateAU(weekStart),
        Scheduled: vals.scheduled,
        Completed: vals.completed,
      }));
  }, [rosterStats, volumeCoachFilter]);

  // ── Per-coach detail table (roster-based scheduled/completed/missed + weekly best/worst/stddev) ─────────────────
  const coachDetail = useMemo(() => {
    if (!coaches) return [];
    return coaches.map(coach => {
      const cRoster = (rosterStats ?? []).filter(r => r.coachId === coach.id);
      const cMorning = (rawRecords ?? []).filter(r => r.coachId === coach.id && r.submissionType === "morning");
      const cFollowup = (rawRecords ?? []).filter(r => r.coachId === coach.id && r.submissionType === "followup");
      const cDisengagement = (rawRecords ?? []).filter(r => r.coachId === coach.id && r.submissionType === "disengagement");
      const scheduled = cRoster.reduce((s, r) => s + r.scheduled, 0);
      const completed = cRoster.reduce((s, r) => s + r.completed, 0);
      const weeklyPcts = cRoster.filter(r => r.scheduled > 0).map(r => (r as any).pct ?? (r as any).engagementPct).filter((p: any) => p != null && !isNaN(p));
      const bestWeek = weeklyPcts.length > 0 ? Math.round(Math.max(...weeklyPcts) * 10) / 10 : null;
      const worstWeek = weeklyPcts.length > 0 ? Math.round(Math.min(...weeklyPcts) * 10) / 10 : null;
      let stdDev: number | null = null;
      if (weeklyPcts.length > 1) {
        const mean = weeklyPcts.reduce((s, v) => s + v, 0) / weeklyPcts.length;
        const variance = weeklyPcts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / weeklyPcts.length;
        stdDev = Math.round(Math.sqrt(variance) * 10) / 10;
      }
      const avgEngagementPct = scheduled > 0 ? Math.round((completed / scheduled) * 1000) / 10 : 0;
      const streak = streakData ? (streakData as Record<number, number>)[coach.id] ?? 0 : 0;
      return {
        coach,
        scheduled,
        completed,
        missed: scheduled - completed,
        avgEngagement: avgEngagementPct,
        followups: cFollowup.reduce((s, r) => s + (r.followupMessagesSent ?? 0), 0),
        disengagement: cDisengagement.reduce((s, r) => s + (r.disengagementMessagesSent ?? 0), 0),
        submissions: cMorning.length,
        bestWeek,
        worstWeek,
        stdDev,
        streak,
      };
    });
  }, [rosterStats, rawRecords, coaches, streakData]);

  // ── Mood vs Engagement overlay (lagged: prior period mood → current period engagement) ─
  const moodEngagementData = useMemo(() => {
    if (!lastWeekRecords || !coaches) return [];
    // Current period engagement — use roster-based stats (accurate since switch to roster tracking)
    // Prior period mood (the equal-length period immediately before the selected range)
    const priorMorning = lastWeekRecords.filter(r => r.submissionType === "morning");
    return coaches.map((coach, i) => {
      // Roster-based engagement for current period
      const cRoster = (rosterStats ?? []).filter(r => r.coachId === coach.id);
      const rScheduled = cRoster.reduce((s, r) => s + r.scheduled, 0);
      const rCompleted = cRoster.reduce((s, r) => s + r.completed, 0);
      const rExcused = cRoster.reduce((s, r) => s + ((r as any).excused ?? 0), 0);
      const rEffective = Math.max(rScheduled - rExcused, 1);
      const avgEngCurrent = rScheduled > 0
        ? Math.round((rCompleted / rEffective) * 1000) / 10
        : null;
      // Prior period mood from morning check-in records
      const priorRecords = priorMorning.filter(r => r.coachId === coach.id);
      const moodRecords = priorRecords.filter(r => r.moodScore != null && r.moodScore > 0);
      const avgMoodPrior = moodRecords.length > 0
        ? Math.round(moodRecords.reduce((s, r) => s + (r.moodScore ?? 0), 0) / moodRecords.length * 10) / 10
        : null;
      return {
        name: coach.name,
        "Prior Period Avg Mood (×20)": avgMoodPrior !== null ? Math.round(avgMoodPrior * 20 * 10) / 10 : null,
        "Current Period Engagement %": avgEngCurrent,
        moodRaw: avgMoodPrior,
        color: COACH_COLORS[i % COACH_COLORS.length],
      };
    }).filter(d => d["Prior Period Avg Mood (×20)"] !== null || d["Current Period Engagement %"] !== null);
  }, [rosterStats, lastWeekRecords, coaches]);

  // ── Engagement % over time — weekly trend data (team-wide + per-coach) ─────────────────────────
  const engagementTrendData = useMemo(() => {
    if (!rosterStats || !coaches) return [];
    // Group rosterStats by weekStart
    const byWeek: Record<string, { totalScheduled: number; totalCompleted: number; byCoach: Record<number, { scheduled: number; completed: number }> }> = {};
    for (const r of rosterStats) {
      if (!byWeek[r.weekStart]) byWeek[r.weekStart] = { totalScheduled: 0, totalCompleted: 0, byCoach: {} };
      byWeek[r.weekStart].totalScheduled += r.scheduled;
      byWeek[r.weekStart].totalCompleted += r.completed;
      if (!byWeek[r.weekStart].byCoach[r.coachId]) byWeek[r.weekStart].byCoach[r.coachId] = { scheduled: 0, completed: 0 };
      byWeek[r.weekStart].byCoach[r.coachId].scheduled += r.scheduled;
      byWeek[r.weekStart].byCoach[r.coachId].completed += r.completed;
    }
    return Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, vals]) => {
        const row: Record<string, string | number | null> = {
          date: formatDateAU(weekStart),
          weekStart,
          __scheduled: vals.totalScheduled,
          __completed: vals.totalCompleted,
          __missed: vals.totalScheduled - vals.totalCompleted,
          "Team": vals.totalScheduled > 0
            ? Math.round((vals.totalCompleted / vals.totalScheduled) * 1000) / 10
            : null,
        };
        for (const coach of coaches) {
          const c = vals.byCoach[coach.id];
          row[coach.name] = c && c.scheduled > 0
            ? Math.round((c.completed / c.scheduled) * 1000) / 10
            : null;
        }
        return row;
      });
  }, [rosterStats, coaches]);

  const rangeLabels: Record<RangeKey, string> = {
    "today": "Today",
    "wtd":   "This week",
    "7d":    "Last week",
    "14d":   "Last 2 weeks",
    "30d":   "Last 4 weeks",
    "90d":   "Last 13 weeks",
    "180d":  "Last 26 weeks",
    "12m":   "Last 52 weeks",
    "custom": customFrom && customTo
      ? `${format(customFrom, "d MMM")} – ${format(customTo, "d MMM yyyy")}`
      : "Custom range",
  };

  function getEngagementBadge(pct: number) {
    if (pct >= 90) return <Badge className="bg-emerald-400/10 text-emerald-400 border-emerald-400/20 text-xs">{pct}%</Badge>;
    if (pct >= 75) return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">{pct}%</Badge>;
    if (pct >= 50) return <Badge className="bg-yellow-400/10 text-yellow-200 border-yellow-400/20 text-xs">{pct}%</Badge>;
    return <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-xs">{pct}%</Badge>;
  }

  // Non-admin guard — placed after all hooks to comply with React rules of hooks
  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto py-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
            <Activity className="h-8 w-8 text-white/50" />
          </div>
          <h2 className="text-xl font-semibold text-white/90 mb-2">Manager Access Required</h2>
          <p className="text-white/50 text-sm">The dashboard is only available to managers and founders.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pt-20 pb-2">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white/90" style={{ fontFamily: "'Comfortaa', cursive" }}>Manager Dashboard</h1>
            <p className="text-white/50 text-sm mt-0.5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-md px-2.5 py-0.5 text-xs font-semibold tracking-wide">
                {range === "today"
                  ? `Today · ${format(new Date(startDate + "T00:00:00"), "d MMM yyyy")}`
                  : range === "wtd"
                  ? `This week · ${format(new Date(startDate + "T00:00:00"), "d MMM")} – ${format(new Date(endDate + "T00:00:00"), "d MMM yyyy")}`
                  : `${rangeLabels[range]} · ${format(new Date(startDate + "T00:00:00"), "d MMM")} – ${format(new Date(endDate + "T00:00:00"), "d MMM yyyy")}`}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-1 bg-white/5 border border-white/[0.08] rounded-xl p-1">
            {rangeOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRange(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  range === opt.value
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/50 hover:text-white/90 hover:bg-white/10"
                }`}
              >
                {opt.label}
              </button>
            ))}
            {/* Custom date range picker */}
            <Popover open={customPickerOpen} onOpenChange={setCustomPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    setCustomStep("from");
                    setCustomPickerOpen(true);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                    range === "custom"
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-white/50 hover:text-white/90 hover:bg-white/10"
                  }`}
                >
                  <CalendarDays className="h-3 w-3" />
                  {range === "custom" && customFrom && customTo
                    ? `${format(customFrom, "d MMM")} – ${format(customTo, "d MMM")}`
                    : "Custom"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-3 border-b border-white/[0.08]">
                  <p className="text-xs font-medium text-white/90">
                    {customStep === "from" ? "Select start date" : "Select end date"}
                  </p>
                  {customFrom && customStep === "to" && (
                    <p className="text-xs text-white/50 mt-0.5">
                      From: {format(customFrom, "d MMM yyyy")}
                    </p>
                  )}
                </div>
                <Calendar
                  mode="single"
                  selected={customStep === "from" ? customFrom ?? undefined : customTo ?? undefined}
                  onSelect={(date) => {
                    if (!date) return;
                    if (customStep === "from") {
                      setCustomFrom(date);
                      setCustomTo(null);
                      setCustomStep("to");
                    } else {
                      // Ensure end >= start
                      const from = customFrom!;
                      const finalTo = date < from ? from : date;
                      const finalFrom = date < from ? date : from;
                      setCustomFrom(finalFrom);
                      setCustomTo(finalTo);
                      setRange("custom");
                      setCustomPickerOpen(false);
                      setCustomStep("from");
                    }
                  }}
                  disabled={(date) =>
                    customStep === "to" && customFrom ? date < customFrom : false
                  }
                  initialFocus
                />
                {customStep === "to" && (
                  <div className="p-2 border-t border-white/[0.08] flex justify-between">
                    <button
                      type="button"
                      className="text-xs text-white/50 hover:text-white/90"
                      onClick={() => { setCustomStep("from"); setCustomFrom(null); setCustomTo(null); }}
                    >
                      ← Back
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Low mood alert banner */}
        {lowMoodAlerts && lowMoodAlerts.length > 0 && (
          <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-200 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-yellow-200 mb-1">Wellbeing Check Needed Today</p>
              <p className="text-xs text-white/50">
                {lowMoodAlerts.map(r => {
                  const coach = coaches?.find(c => c.id === r.coachId);
                  const moodLabels = ["", "Not good", "Below average", "Okay", "Good", "Amazing"];
                  const moodEmojis = ["", "😔", "😕", "😐", "🙂", "🤩"];
                  return `${coach?.name ?? "A coach"} rated themselves ${moodEmojis[r.moodScore ?? 0]} ${moodLabels[r.moodScore ?? 0]}`;
                }).join(" · ")}
              </p>
            </div>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl border-l-[3px] border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wider">Avg Engagement</p>
                  <p className="text-3xl font-bold text-white/90 mt-1">{avgEngagement.toFixed(1)}%</p>
                  {avgEngagement >= 80 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 border border-emerald-400/20 mt-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                      KPI ACHIEVED
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 mt-1">
                    <p className="text-xs text-white/50">{rangeLabels[range]}</p>
                    {prevRosterStats && prevEngagement > 0 && (() => {
                      const delta = Math.round((avgEngagement - prevEngagement) * 10) / 10;
                      const isUp = delta >= 0;
                      return (
                        <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                          isUp ? "bg-emerald-400/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                        }`}>
                          {isUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                          {isUp ? "+" : ""}{delta}% vs prev
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-violet-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl border-l-[3px] border-l-blue-400">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wider">Check-ins</p>
                  <p className="text-3xl font-bold text-white/90 mt-1">{totalCompleted}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <p className="text-xs text-white/50">of {totalScheduled} scheduled</p>
                    {prevRosterStats && prevCompleted > 0 && (() => {
                      const delta = totalCompleted - prevCompleted;
                      const isUp = delta >= 0;
                      return (
                        <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                          isUp ? "bg-emerald-400/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                        }`}>
                          {isUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                          {isUp ? "+" : ""}{delta} vs prev
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl border-l-[3px] border-l-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wider">Follow-ups</p>
                  <p className="text-3xl font-bold text-white/90 mt-1">{totalFollowup}</p>
                  <p className="text-xs text-white/50 mt-1">Messages sent</p>
                </div>
                <div className="h-8 w-8 rounded-lg bg-yellow-400/10 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-yellow-200" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl border-l-[3px] border-l-rose-500">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wider">Disengagement</p>
                  <p className="text-3xl font-bold text-white/90 mt-1">{totalDisengagement}</p>
                  <p className="text-xs text-white/50 mt-1">Outreach sent</p>
                </div>
                <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                  <TrendingDown className="h-4 w-4 text-rose-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Weekly KPI Tracker — only show on "This Week" or "Last Week" views */}
        {(range === "wtd" || range === "7d") && kpiTrackerStats && kpiTrackerStats.length > 0 && (() => {
          const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          // Build per-week engagement from kpiTrackerStats
          const weekMap = new Map<string, { scheduled: number; completed: number; excused: number }>();
          for (const r of kpiTrackerStats) {
            const cur = weekMap.get(r.weekStart) ?? { scheduled: 0, completed: 0, excused: 0 };
            cur.scheduled += r.scheduled;
            cur.completed += r.completed;
            cur.excused += (r as any).excused ?? 0;
            weekMap.set(r.weekStart, cur);
          }
          const allWeeks = Array.from(weekMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([weekStart, vals]) => {
              const eff = Math.max(vals.scheduled - vals.excused, 1);
              const pct = vals.scheduled > 0 ? Math.round((vals.completed / eff) * 1000) / 10 : 0;
              const achieved = pct >= 80;
              const mon = new Date(weekStart + "T00:00:00");
              const fri = new Date(weekStart + "T00:00:00");
              fri.setDate(fri.getDate() + 4);
              const label = `${mon.getDate()} ${months[mon.getMonth()]} – ${fri.getDate()} ${months[fri.getMonth()]}`;
              return { weekStart, label, pct, achieved };
            });

          // All weeks are completed (we only fetch past weeks now)
          // Most recent week is the hero display
          const currentWeek = allWeeks.length > 0 ? allWeeks[allWeeks.length - 1] : null;
          // Prior weeks = all except the hero, newest first, max 5
          const priorWeeks = allWeeks
            .filter(w => currentWeek && w.weekStart !== currentWeek.weekStart)
            .reverse()
            .slice(0, 5);
          const allTracked = currentWeek ? [currentWeek, ...priorWeeks] : priorWeeks;
          const achievedCount = allTracked.filter(w => w.achieved).length;

          if (!currentWeek) return null;
          return (
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white/80">Weekly KPI Tracker</h3>
                  <span className="text-xs text-white/40">80%+ = achieved</span>
                </div>
                <span className="text-sm font-bold text-emerald-400">{achievedCount}/{allTracked.length} weeks</span>
              </div>
              {/* Most recent completed week — big bar with centered percentage */}
              <div className="mb-4">
                <div className="flex flex-col items-center gap-1 mb-2">
                  <span className={`text-2xl font-bold ${currentWeek.achieved ? "text-emerald-400" : "text-red-400"}`}>
                    {currentWeek.pct.toFixed(1)}%
                  </span>
                  {currentWeek.achieved
                    ? <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/20">KPI ACHIEVED</span>
                    : <span className="text-[10px] font-bold text-red-400 px-2 py-0.5 rounded-full bg-red-400/10 border border-red-400/20">KPI MISSED</span>
                  }
                  <span className="text-xs text-white/40">{currentWeek.label}</span>
                </div>
                <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${currentWeek.achieved ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]"}`}
                    style={{ width: `${Math.min(currentWeek.pct, 100)}%` }}
                  />
                </div>
              </div>
              {/* Prior weeks — small badges */}
              {priorWeeks.length > 0 && (
                <div>
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">Prior Weeks</span>
                  <div className="flex items-center gap-2 mt-2">
                    {priorWeeks.map(w => (
                      <div key={w.weekStart} className={`flex-1 glass rounded-xl px-3 py-2 text-center border ${w.achieved ? "border-emerald-400/15" : "border-red-400/15"}`}>
                        <span className={`text-sm font-bold block ${w.achieved ? "text-emerald-400" : "text-red-400"}`}>
                          {w.pct.toFixed(1)}%
                        </span>
                        <span className="text-[9px] text-white/30 block mt-0.5">{w.label}</span>
                        {w.achieved
                          ? <span className="text-[8px] font-bold text-emerald-400 mt-1 block">ACHIEVED</span>
                          : <span className="text-[8px] font-bold text-red-400 mt-1 block">MISSED</span>
                        }
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Combined engagement chart — Scheduled/Completed bars per coach + Engagement % line */}
        <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold text-white/90">Engagement Overview</CardTitle>
                <p className="text-xs text-white/50 mt-0.5">
                  {chartCoachFilter === "all"
                    ? "Bars = scheduled/completed per coach · Dashed line = team engagement % · Solid lines = per-coach engagement %"
                    : `Scheduled vs Completed · ${coaches?.find(c => c.id === chartCoachFilter)?.name ?? ""} · Engagement % line`}
                </p>
              </div>
              <Select
                value={chartCoachFilter === "all" ? "all" : String(chartCoachFilter)}
                onValueChange={v => setChartCoachFilter(v === "all" ? "all" : Number(v))}
              >
                <SelectTrigger className="h-7 w-36 text-xs bg-white/5 border-white/[0.08]">
                  <SelectValue placeholder="View" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Coaches</SelectItem>
                  {coaches?.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {combinedChartData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-white/50 text-sm">No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={420}>
{(() => {
  // Calculate the max team scheduled to set as 100% mark on Y-axis, plus 20% headroom
  const maxTeamSched = Math.max(...combinedChartData.filter((d: any) => d.__isTeam).map((d: any) => d.Scheduled as number), 1);
  const yMax = maxTeamSched;
  return (
<ComposedChart data={combinedChartData} margin={{ top: 48, right: 40, left: -10, bottom: 28 }} barCategoryGap="20%" barGap={6}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.012 240)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={({ x, y, payload, index }: any) => {
                      const entry = combinedChartData[index] as any;
                      const isTeam = entry?.__isTeam;
                      const isSep = entry?.__separator;
                      const coachIdx = entry?.__coachIdx ?? 0;
                      const isCoach = !isTeam && !isSep && payload.value;
                      const coachColor = isCoach ? COACH_COLORS[coachIdx % COACH_COLORS.length] : undefined;
                      return (
                        <text x={x} y={y + 14} textAnchor="middle"
                          fontSize={isTeam ? 10 : 11}
                          fill={isTeam ? "oklch(0.70 0.010 240)" : isCoach ? coachColor : "oklch(0.48 0.010 240)"}
                          fontWeight={700}>
                          {isSep ? "" : payload.value}
                        </text>
                      );
                    }}
                    tickLine={false} axisLine={false}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "oklch(0.52 0.010 240)" }} tickLine={false} axisLine={false} domain={[0, yMax]} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 120]} tickFormatter={(v: number) => v <= 100 ? `${v}%` : ''} tick={{ fontSize: 10, fill: "oklch(0.52 0.010 240)" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0]?.payload as any;
                      if (row.__separator) return null;
                      const isTeam = !!row.__isTeam;
                      const coachIdx = row.__coachIdx ?? 0;
                      const color = isTeam ? "oklch(0.88 0.01 240)" : COACH_COLORS[coachIdx % COACH_COLORS.length];
                      const engPct = isTeam ? row.__teamEngPct : row.__coachEngPct;
                      return (
                        <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/[0.08] rounded-xl px-3 py-2.5 shadow-xl text-xs space-y-1 min-w-[180px]">
                          <p className="font-semibold mb-1" style={{ color }}>{row.coachLabel}</p>
                          <div className="flex justify-between gap-4">
                            <span className="text-white/50">Scheduled</span>
                            <span className="font-semibold text-white/90">{row.Scheduled}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-white/50">Completed</span>
                            <span className="font-semibold" style={{ color }}>{row.Completed}</span>
                          </div>
                          {engPct != null && (
                            <div className="flex justify-between gap-4 border-t border-white/[0.08] pt-1 mt-1">
                              <span className="text-white/50">Engagement</span>
                              <span className="font-semibold" style={{ color: engPct >= 80 ? "oklch(0.72 0.17 145)" : engPct >= 60 ? "oklch(0.85 0.12 85)" : "oklch(0.65 0.22 25)" }}>
                                {(engPct as number).toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  {/* Scheduled bars — muted, coloured per coach; white/silver for Team */}
                  <Bar yAxisId="left" dataKey="Scheduled" radius={[3, 3, 0, 0]} barSize={22}>
                    {combinedChartData.map((entry: any, idx: number) => {
                      const isTeam = entry.__isTeam;
                      const isSep = entry.__separator;
                      const color = isTeam ? "oklch(0.78 0.01 240)" : COACH_COLORS[(entry.__coachIdx ?? 0) % COACH_COLORS.length];
                      return <Cell key={idx} fill={color} fillOpacity={isSep ? 0 : isTeam ? 0.18 : 0.22} />;
                    })}
                    <LabelList dataKey="Scheduled" position="top"
                      content={({ x, y, width, value, index }: any) => {
                        if (!value) return null;
                        const entry = combinedChartData[index] as any;
                        const isTeam = entry?.__isTeam;
                        const coachIdx = entry?.__coachIdx ?? 0;
                        const engPct = isTeam ? entry?.__teamEngPct : entry?.__coachEngPct;
                        const badgeColor = isTeam ? "oklch(0.88 0.01 240)" : COACH_COLORS[coachIdx % COACH_COLORS.length];
                        const pairCx = (x ?? 0) + 25;
                        // Badge sits just above the scheduled bar label, between the dots and the bar numbers
                        const badgeTopY = (y ?? 0) - 42;
                        return (
                          <g>
                            <text x={(x ?? 0) + (width ?? 0) / 2} y={(y ?? 0) - 4} textAnchor="middle" fontSize={10} fill="oklch(0.60 0.010 240)" fontWeight={600}>{value}</text>
                            {engPct != null && (
                              <g>
                                <rect x={pairCx - 26} y={badgeTopY - 6} width={52} height={20} rx={10}
                                  fill={isTeam ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)"}
                                  stroke={isTeam ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.10)"}
                                  strokeWidth={1} />
                                <text x={pairCx} y={badgeTopY + 8} textAnchor="middle" fontSize={11} fontWeight={700} fill={badgeColor}>
                                  {engPct.toFixed(0)}%
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      }}
                    />
                  </Bar>
                  {/* Completed bars — bright, coloured per coach; white/silver for Team */}
                  <Bar yAxisId="left" dataKey="Completed" radius={[3, 3, 0, 0]} barSize={22}>
                    {combinedChartData.map((entry: any, idx: number) => {
                      const isTeam = entry.__isTeam;
                      const isSep = entry.__separator;
                      const color = isTeam ? "oklch(0.88 0.01 240)" : COACH_COLORS[(entry.__coachIdx ?? 0) % COACH_COLORS.length];
                      return <Cell key={idx} fill={color} fillOpacity={isSep ? 0 : 0.95} />;
                    })}
                    <LabelList dataKey="Completed" position="top"
                      content={({ x, y, width, value, index }: any) => {
                        if (!value) return null;
                        const entry = combinedChartData[index] as any;
                        const isTeam = entry.__isTeam;
                        const color = isTeam ? "oklch(0.88 0.01 240)" : COACH_COLORS[(entry?.__coachIdx ?? 0) % COACH_COLORS.length];
                        return <text x={(x ?? 0) + (width ?? 0) / 2} y={(y ?? 0) - 4} textAnchor="middle" fontSize={10} fontWeight={700} fill={color}>{value}</text>;
                      }}
                    />
                  </Bar>
                  {/* Engagement % badges are rendered from the Scheduled bar's LabelList above */}
                  {/* Engagement lines removed — badges above bars show engagement % */}
                </ComposedChart>
  );
})()}
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Mood vs Engagement overlay chart */}
        <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white/90">Mood vs Engagement (Lagged)</CardTitle>
            <p className="text-xs text-white/50">
              Prior period's average mood score (scaled to 100) compared against current period's average engagement % per coach.
              Low mood in the prior period may predict lower engagement in the current period.
            </p>
          </CardHeader>
          <CardContent>
            {moodEngagementData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-white/50 text-sm">
                No mood data yet — mood scores will appear once coaches start submitting morning reviews
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={moodEngagementData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barCategoryGap="30%" barGap={6}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.012 240)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "oklch(0.52 0.010 240)", fontWeight: 600 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "oklch(0.52 0.010 240)" }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="Prior Period Avg Mood (×20)" fill="oklch(0.75 0.13 280)" radius={[3, 3, 0, 0]} barSize={22} />
                  <Bar dataKey="Current Period Engagement %" fill="oklch(0.72 0.17 162)" radius={[3, 3, 0, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Engagement % Over Time */}
        <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-sm font-semibold text-white/90">Engagement % Over Time</CardTitle>
                <p className="text-xs text-white/50 mt-0.5">Weekly engagement rate — {rangeLabels[range]}</p>
              </div>
              <div className="flex items-center gap-1 bg-white/5 border border-white/[0.08] rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setEngagementTrendView("team")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    engagementTrendView === "team"
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-white/50 hover:text-white/90"
                  }`}
                >
                  Team
                </button>
                <button
                  type="button"
                  onClick={() => setEngagementTrendView("individual")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    engagementTrendView === "individual"
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-white/50 hover:text-white/90"
                  }`}
                >
                  Per Coach
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {engagementTrendData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-white/50 text-sm">
                No engagement data for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={engagementTrendData} margin={{ top: 5, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.012 240)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.52 0.010 240)" }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: "oklch(0.52 0.010 240)" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const dp = payload[0]?.payload ?? {};
                      const scheduled = dp.__scheduled as number | undefined;
                      const completed = dp.__completed as number | undefined;
                      const missed = dp.__missed as number | undefined;
                      return (
                        <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/[0.08] rounded-xl px-3 py-2.5 shadow-xl text-xs space-y-1 min-w-[160px]">
                          <p className="text-white/50 font-medium mb-1">{label}</p>
                          {payload.map((p: any, i: number) => p.value != null && (
                            <div key={i} className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                              <span className="text-white/50">{p.name}:</span>
                              <span className="font-semibold text-white/90 ml-auto">{(p.value as number).toFixed(1)}%</span>
                            </div>
                          ))}
                          {scheduled !== undefined && completed !== undefined && missed !== undefined && (
                            <div className="border-t border-white/[0.08] mt-1.5 pt-1.5 space-y-0.5">
                              <div className="flex justify-between gap-3">
                                <span className="text-white/50">Completed</span>
                                <span className="font-semibold text-emerald-400">{completed}</span>
                              </div>
                              <div className="flex justify-between gap-3">
                                <span className="text-white/50">Missed</span>
                                <span className="font-semibold text-rose-400">{missed}</span>
                              </div>
                              <div className="flex justify-between gap-3">
                                <span className="text-white/50">Total</span>
                                <span className="font-semibold text-white/90">{scheduled}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine
                    y={80}
                    stroke="oklch(0.65 0.15 145)"
                    strokeDasharray="5 4"
                    strokeWidth={1.5}
                    label={{ value: "Goal 80%", position: "insideTopRight", fontSize: 10, fill: "oklch(0.65 0.15 145)", dy: -4 }}
                  />
                  {engagementTrendView === "team" ? (
                    <Line
                      type="monotone"
                      dataKey="Team"
                      stroke="oklch(0.85 0.12 85)"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "oklch(0.85 0.12 85)", strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                      connectNulls={false}
                    />
                  ) : (
                    coaches?.map((coach, i) => (
                      <Line
                        key={coach.id}
                        type="monotone"
                        dataKey={coach.name}
                        stroke={COACH_COLORS[i % COACH_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3, fill: COACH_COLORS[i % COACH_COLORS.length], strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                        connectNulls={false}
                      />
                    ))
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Per-coach detail table */}
        <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white/90">Coach Performance Breakdown</CardTitle>
            <p className="text-xs text-white/50">{rangeLabels[range]} — all metrics per coach</p>
          </CardHeader>
          <CardContent>
            {coachDetail.length === 0 ? (
              <div className="py-8 text-center text-white/50 text-sm">No coaches found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08]">
                      <th className="text-left py-2 px-3 text-xs text-white/50 font-medium">Coach</th>
                      <th className="text-right py-2 px-3 text-xs text-white/50 font-medium">Scheduled</th>
                      <th className="text-right py-2 px-3 text-xs text-white/50 font-medium">Completed</th>
                      <th className="text-right py-2 px-3 text-xs text-white/50 font-medium">Missed</th>
                      <th className="text-right py-2 px-3 text-xs text-white/50 font-medium">Avg Eng.</th>
                      <th className="text-right py-2 px-3 text-xs text-white/50 font-medium">Best Wk</th>
                      <th className="text-right py-2 px-3 text-xs text-white/50 font-medium">Worst Wk</th>
                      <th className="text-right py-2 px-3 text-xs text-white/50 font-medium">Std Dev</th>
                      <th className="text-right py-2 px-3 text-xs text-white/50 font-medium">Streak</th>
                      <th className="text-right py-2 px-3 text-xs text-white/50 font-medium">Follow-ups</th>
                      <th className="text-right py-2 px-3 text-xs text-white/50 font-medium">Disengagement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coachDetail.map((row, i) => (
                      <tr key={row.coach.id} className="border-b border-white/[0.08]/50 hover:bg-white/10 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-background"
                              style={{ background: COACH_COLORS[i % COACH_COLORS.length] }}
                            >
                              {row.coach.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-white/90">{row.coach.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right text-white/90">{row.scheduled}</td>
                        <td className="py-3 px-3 text-right text-white/90">{row.completed}</td>
                        <td className="py-3 px-3 text-right text-rose-400">{row.missed}</td>
                        <td className="py-3 px-3 text-right">{getEngagementBadge(row.avgEngagement)}</td>
                        <td className="py-3 px-3 text-right">
                          {row.bestWeek !== null ? <span className="text-emerald-400 font-medium">{row.bestWeek}%</span> : <span className="text-white/50">—</span>}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {row.worstWeek !== null ? <span className="text-rose-400 font-medium">{row.worstWeek}%</span> : <span className="text-white/50">—</span>}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {row.stdDev !== null ? <span className="text-white/50">±{row.stdDev}%</span> : <span className="text-white/50">—</span>}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className={`font-medium ${row.streak >= 5 ? "text-emerald-400" : row.streak >= 2 ? "text-yellow-200" : "text-white/50"}`}>
                            {row.streak > 0 ? `🔥 ${row.streak}d` : "—"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-yellow-200">{row.followups}</td>
                        <td className="py-3 px-3 text-right text-rose-400">{row.disengagement}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Plans */}
        {isAdmin && (
          <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-violet-400" />
                <CardTitle className="text-sm font-semibold text-white/90">Today's Plans</CardTitle>
              </div>
              <p className="text-xs text-white/50">
                {format(melbourneNow(), "EEEE d MMMM")} — working hours and action plans submitted this morning
              </p>
            </CardHeader>
            <CardContent>
              {!todayMorning || todayMorning.length === 0 ? (
                <div className="py-6 text-center text-white/50 text-sm">No morning submissions yet today</div>
              ) : (
                <div className="space-y-3">
                  {todayMorning.map((row, i) => (
                    <div key={row.coachId} className="rounded-xl bg-white/5/40 border border-white/[0.08]/60 px-4 py-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-background shrink-0"
                          style={{ background: COACH_COLORS[i % COACH_COLORS.length] }}
                        >
                          {row.coachName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-white/90">{row.coachName}</span>
                        {row.submitted ? (
                          <>
                            {row.moodScore && (
                              <span className="text-base" title={["Not good","Below average","Okay","Good","Amazing"][row.moodScore - 1]}>
                                {["\uD83D\uDE14","\uD83D\uDE15","\uD83D\uDE10","\uD83D\uDE42","\uD83E\uDD29"][row.moodScore - 1]}
                              </span>
                            )}
                            {row.workingHours && (
                              <span className="ml-auto text-xs font-medium text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-2.5 py-0.5">
                                {row.workingHours}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="ml-auto text-[11px] text-white/50 italic">Not submitted yet</span>
                        )}
                      </div>
                      {row.actionPlan && (
                        <p className="text-xs text-white/50 leading-relaxed pl-9 whitespace-pre-wrap">{row.actionPlan}</p>
                      )}
                      {row.notes && (
                        <p className="text-[11px] text-white/50/70 leading-relaxed pl-9 italic">{row.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Disengagement Tracking — per-coach columns */}
        {allDisengagedClients !== undefined && (() => {
          // Group all disengaged clients by coach
          const coachNames = Array.from(new Set(allDisengagedClients.map(c => c.coachName))).sort();
          // Also include coaches from allMissedStreaks who may not appear in allDisengagedClients
          if (allMissedStreaks) {
            for (const { coach } of allMissedStreaks) {
              if (!coachNames.includes(coach.name)) coachNames.push(coach.name);
            }
          }
          const hasAny = allDisengagedClients.length > 0 || (allMissedStreaks?.some(c => c.streaks.length > 0) ?? false);
          if (!hasAny) return null;

          // Severity helpers
          const tierLabel = (n: number) =>
            n >= 3 ? { label: "Critical", bg: "bg-red-400/10", border: "border-red-400/30", text: "text-red-400", dot: "bg-red-400" } :
            n === 2 ? { label: "Alert", bg: "bg-rose-500/10", border: "border-rose-400/30", text: "text-rose-400", dot: "bg-rose-400" } :
                      { label: "Warning", bg: "bg-yellow-400/10", border: "border-yellow-400/20", text: "text-yellow-200", dot: "bg-yellow-200/80" };

          return (
            <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-400" />
                    <CardTitle className="text-sm font-semibold text-white/90">Disengagement Tracking</CardTitle>
                  </div>
                  <span className="text-xs text-white/50">
                    {allDisengagedClients.length} client{allDisengagedClients.length !== 1 ? "s" : ""} flagged
                  </span>
                </div>
                <p className="text-xs text-white/50 mt-0.5">
                  Consecutive missed check-ins per coach — streak resets when marked complete
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Legend */}
                <div className="flex items-center gap-4 mb-4 pb-3 border-b border-white/[0.08]/50">
                  <div className="flex items-center gap-1.5 text-[11px] text-white/50">
                    <span className="inline-block w-2 h-2 rounded-full bg-red-400" /> Critical (3+ misses)
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-white/50">
                    <span className="inline-block w-2 h-2 rounded-full bg-rose-400" /> Alert (2 misses)
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-white/50">
                    <span className="inline-block w-2 h-2 rounded-full bg-yellow-200/80" /> Warning (1 miss)
                  </div>
                </div>
                {/* Per-coach columns */}
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(coachNames.length, 3)}, minmax(0, 1fr))` }}>
                  {coachNames.map(coachName => {
                    const clients = allDisengagedClients
                      .filter(c => c.coachName === coachName)
                      .sort((a, b) => b.consecutiveMissed - a.consecutiveMissed);
                    const rosterSize = disengagedRosterSizeByCoach[coachName] ?? 0;
                    const redClients = clients.filter(c => c.consecutiveMissed >= 3);
                    const orangeClients = clients.filter(c => c.consecutiveMissed === 2);
                    const yellowClients = clients.filter(c => c.consecutiveMissed === 1);
                    const pct = (n: number) => rosterSize > 0 ? Math.round((n / rosterSize) * 100) : 0;
                    return (
                      <div key={coachName} className="flex flex-col gap-1.5">
                        {/* Coach header with roster stats */}
                        <div className="pb-2 border-b border-white/[0.08]/40">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-white/90">{coachName}</span>
                            {clients.length > 0 ? (
                              <span className="text-[10px] text-white/50">
                                {clients.length}{rosterSize > 0 ? `/${rosterSize}` : ""} flagged
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-400 font-medium">✓ All clear</span>
                            )}
                          </div>
                          {clients.length > 0 && rosterSize > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                              {redClients.length > 0 && (
                                <span className="text-[9px] font-medium text-red-400">
                                  {redClients.length} critical ({pct(redClients.length)}%)
                                </span>
                              )}
                              {orangeClients.length > 0 && (
                                <span className="text-[9px] font-medium text-rose-400">
                                  {orangeClients.length} alert ({pct(orangeClients.length)}%)
                                </span>
                              )}
                              {yellowClients.length > 0 && (
                                <span className="text-[9px] font-medium text-yellow-200">
                                  {yellowClients.length} warning ({pct(yellowClients.length)}%)
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {/* Client rows grouped by tier */}
                        {clients.length === 0 ? (
                          <p className="text-[11px] text-white/50/50 italic py-1">No disengaged clients</p>
                        ) : (
                          <div className="flex flex-col gap-0">
                            {/* Critical tier */}
                            {redClients.length > 0 && (
                              <>
                                <div className="flex items-center gap-1.5 py-1 mt-0.5">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                                  <span className="text-[9px] font-semibold text-red-400 uppercase tracking-wider">Critical</span>
                                  <div className="flex-1 h-px bg-red-400/20" />
                                </div>
                                <div className="flex flex-col gap-1">
                                  {redClients.map(c => {
                                    const t = tierLabel(c.consecutiveMissed);
                                    return (
                                      <div key={`${c.clientName}|${c.dayOfWeek}`}
                                        className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 border ${t.bg} ${t.border}`}>
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className={`font-medium text-[11px] truncate ${t.text}`}>{c.clientName}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                          <span className="text-[10px] text-white/50 capitalize">{c.dayOfWeek}</span>
                                          <span className={`text-[11px] font-bold tabular-nums ${t.text}`}>{c.consecutiveMissed}w</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                            {/* Alert tier */}
                            {orangeClients.length > 0 && (
                              <>
                                <div className="flex items-center gap-1.5 py-1 mt-1.5">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />
                                  <span className="text-[9px] font-semibold text-rose-400 uppercase tracking-wider">Alert</span>
                                  <div className="flex-1 h-px bg-rose-400/20" />
                                </div>
                                <div className="flex flex-col gap-1">
                                  {orangeClients.map(c => {
                                    const t = tierLabel(c.consecutiveMissed);
                                    return (
                                      <div key={`${c.clientName}|${c.dayOfWeek}`}
                                        className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 border ${t.bg} ${t.border}`}>
                                        <span className={`font-medium text-[11px] truncate ${t.text}`}>{c.clientName}</span>
                                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                          <span className="text-[10px] text-white/50 capitalize">{c.dayOfWeek}</span>
                                          <span className={`text-[11px] font-bold tabular-nums ${t.text}`}>{c.consecutiveMissed}w</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                            {/* Warning tier */}
                            {yellowClients.length > 0 && (
                              <>
                                <div className="flex items-center gap-1.5 py-1 mt-1.5">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-200/80 flex-shrink-0" />
                                  <span className="text-[9px] font-semibold text-yellow-200 uppercase tracking-wider">Warning</span>
                                  <div className="flex-1 h-px bg-yellow-400/20" />
                                </div>
                                <div className="flex flex-col gap-1">
                                  {yellowClients.map(c => {
                                    const t = tierLabel(c.consecutiveMissed);
                                    return (
                                      <div key={`${c.clientName}|${c.dayOfWeek}`}
                                        className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 border ${t.bg} ${t.border}`}>
                                        <span className={`font-medium text-[11px] truncate ${t.text}`}>{c.clientName}</span>
                                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                          <span className="text-[10px] text-white/50 capitalize">{c.dayOfWeek}</span>
                                          <span className={`text-[11px] font-bold tabular-nums ${t.text}`}>{c.consecutiveMissed}w</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })()}
        {/* Follow-ups & Outreach Daily Table */}
        {rawRecords && coaches && (() => {
          // Build per-day, per-coach follow-up and outreach counts from check-in submissions
          const followupRecs = rawRecords.filter(r => r.submissionType === "followup");
          const disengagementRecs = rawRecords.filter(r => r.submissionType === "disengagement");
          // Collect all unique dates in range
          const allDates = Array.from(new Set([
            ...followupRecs.map(r => r.recordDate),
            ...disengagementRecs.map(r => r.recordDate),
          ])).sort();
          if (allDates.length === 0) return null;
          return (
            <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-400" />
                  <CardTitle className="text-sm font-semibold text-white/90">Follow-ups &amp; Outreach by Day</CardTitle>
                </div>
                <p className="text-xs text-white/50 mt-0.5">
                  Check-in 2 (follow-up messages) and Check-in 3 (disengagement outreach) sent per coach per day
                </p>
              </CardHeader>
              <CardContent className="pt-0 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08]/50">
                      <th className="text-left py-2 px-3 text-white/50 font-medium">Date</th>
                      {coaches.map(coach => (
                        <th key={coach.id} className="text-center py-2 px-3 text-white/50 font-medium" colSpan={2}>
                          {coach.name}
                        </th>
                      ))}
                      <th className="text-center py-2 px-3 text-white/50 font-medium" colSpan={2}>Total</th>
                    </tr>
                    <tr className="border-b border-white/[0.08]/30">
                      <th className="py-1 px-3" />
                      {coaches.map(coach => (
                        <Fragment key={coach.id}>
                          <th className="text-center py-1 px-2 text-[10px] text-blue-400 font-normal">Follow-up</th>
                          <th className="text-center py-1 px-2 text-[10px] text-rose-400 font-normal">Outreach</th>
                        </Fragment>
                      ))}
                      <th className="text-center py-1 px-2 text-[10px] text-blue-400 font-normal">Follow-up</th>
                      <th className="text-center py-1 px-2 text-[10px] text-rose-400 font-normal">Outreach</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDates.map(date => {
                      let totalFu = 0, totalDis = 0;
                      return (
                        <tr key={date} className="border-b border-white/[0.08]/20 hover:bg-white/5/20">
                          <td className="py-2 px-3 text-white/50">
                            {new Date(date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </td>
                          {coaches.map(coach => {
                            const fu = followupRecs.filter(r => r.coachId === coach.id && r.recordDate === date)
                              .reduce((s, r) => s + (r.followupMessagesSent ?? 0), 0);
                            const dis = disengagementRecs.filter(r => r.coachId === coach.id && r.recordDate === date)
                              .reduce((s, r) => s + (r.disengagementMessagesSent ?? 0), 0);
                            totalFu += fu; totalDis += dis;
                            return (
                              <Fragment key={coach.id}>
                                <td className={`py-2 px-2 text-center ${fu > 0 ? 'text-blue-400 font-medium' : 'text-white/50/40'}`}>{fu > 0 ? fu : '—'}</td>
                                <td className={`py-2 px-2 text-center ${dis > 0 ? 'text-rose-400 font-medium' : 'text-white/50/40'}`}>{dis > 0 ? dis : '—'}</td>
                              </Fragment>
                            );
                          })}
                          <td className={`py-2 px-2 text-center font-semibold ${totalFu > 0 ? 'text-blue-400' : 'text-white/50/40'}`}>{totalFu > 0 ? totalFu : '—'}</td>
                          <td className={`py-2 px-2 text-center font-semibold ${totalDis > 0 ? 'text-rose-400' : 'text-white/50/40'}`}>{totalDis > 0 ? totalDis : '—'}</td>
                        </tr>
                      );
                    })}
                    {/* Totals row */}
                    <tr className="border-t border-white/[0.08]/50 bg-white/5/10">
                      <td className="py-2 px-3 text-white/50 font-medium">Total</td>
                      {coaches.map(coach => {
                        const fu = followupRecs.filter(r => r.coachId === coach.id).reduce((s, r) => s + (r.followupMessagesSent ?? 0), 0);
                        const dis = disengagementRecs.filter(r => r.coachId === coach.id).reduce((s, r) => s + (r.disengagementMessagesSent ?? 0), 0);
                        return (
                          <Fragment key={coach.id}>
                            <td className="py-2 px-2 text-center text-blue-400 font-semibold">{fu}</td>
                            <td className="py-2 px-2 text-center text-rose-400 font-semibold">{dis}</td>
                          </Fragment>
                        );
                      })}
                      <td className="py-2 px-2 text-center text-blue-400 font-bold">
                        {followupRecs.reduce((s, r) => s + (r.followupMessagesSent ?? 0), 0)}
                      </td>
                      <td className="py-2 px-2 text-center text-rose-400 font-bold">
                        {disengagementRecs.reduce((s, r) => s + (r.disengagementMessagesSent ?? 0), 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          );
        })()}

        {/* Pending Excuses Approval */}
        {isAdmin && (() => {
          const pending = pendingExcuses ?? [];
          const counts = excuseCountsByCoach ?? [];
          return (
            <>
              {/* Pending approvals */}
              {pending.length > 0 && (
                <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl border-l-[3px] border-l-blue-400">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-blue-400" />
                      <CardTitle className="text-sm font-semibold text-white/90">Pending Excuse Approvals</CardTitle>
                      <span className="ml-auto text-xs font-semibold bg-blue-400/15 text-blue-400 px-2 py-0.5 rounded-full">{pending.length}</span>
                    </div>
                    <p className="text-xs text-white/50">Coaches have flagged clients as excused — approve or reject each request below</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {pending.map((e: any) => (
                        <div key={e.id} className="flex items-start justify-between gap-3 rounded-xl bg-white/5/50 border px-3 py-2.5">
                          <div className="flex items-start gap-2 min-w-0">
                            <Clock3 className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white/90">{e.clientName} <span className="font-normal text-white/50 capitalize">({e.dayOfWeek})</span></p>
                              <p className="text-[11px] text-white/50">Coach: {e.coachName} &middot; Week of {formatDateAU(e.weekStart)}</p>
                              <p className="text-[11px] text-white/90/80 mt-0.5 italic">"{e.reason}"</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => reviewExcuseMutation.mutate({ excuseId: e.id, status: "approved" })}
                              disabled={reviewExcuseMutation.isPending}
                              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-emerald-400/15 text-emerald-400 hover:bg-emerald-400/25 font-semibold transition-colors"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button
                              onClick={() => reviewExcuseMutation.mutate({ excuseId: e.id, status: "rejected" })}
                              disabled={reviewExcuseMutation.isPending}
                              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-red-400/15 text-red-400 hover:bg-red-400/25 font-semibold transition-colors"
                            >
                              <ShieldX className="h-3.5 w-3.5" /> Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {/* Per-coach excuse counts this week */}
              {counts.length > 0 && (
                <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-white/50" />
                      <CardTitle className="text-sm font-semibold text-white/90">Valid Excuses — Week of {formatDateAU(disengagementViewWeek)}</CardTitle>
                    </div>
                    <p className="text-xs text-white/50">Number of valid excuses submitted per coach for the selected week</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      {counts.map((c: any) => (
                        <div key={c.coachName} className="flex items-center gap-2 rounded-xl bg-white/5/50 border px-3 py-2">
                          <div
                            className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-background shrink-0"
                            style={{ background: COACH_COLORS[(coaches?.findIndex(co => co.name === c.coachName) ?? 0) % COACH_COLORS.length] }}
                          >
                            {c.coachName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-white/90">{c.coachName}</p>
                            <p className="text-[11px] text-white/50">
                              {c.total} excuse{c.total !== 1 ? "s" : ""}
                              {c.pending > 0 && <span className="text-blue-400 ml-1">({c.pending} pending)</span>}
                              {c.approved > 0 && <span className="text-emerald-400 ml-1">({c.approved} approved)</span>}
                              {c.rejected > 0 && <span className="text-red-400 ml-1">({c.rejected} rejected)</span>}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          );
        })()}
        {/* Sweep Report History */}
        <SweepReportHistorySection />

        {/* Recent Notes feed */}
        <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-white/50" />
              <CardTitle className="text-sm font-semibold text-white/90">Recent Coach Notes</CardTitle>
            </div>
            <p className="text-xs text-white/50">Latest notes submitted by coaches across all check-in types</p>
          </CardHeader>
          <CardContent>
            {!recentNotes || recentNotes.length === 0 ? (
              <div className="py-6 text-center text-white/50 text-sm">No notes submitted yet</div>
            ) : (
              <div className="space-y-2">
                {recentNotes.map((note, i) => {
                  const coach = coaches?.find(c => c.id === note.coachId);
                  const typeLabels: Record<string, string> = { morning: "Morning Review", followup: "Follow-Up", disengagement: "Disengagement" };
                  const typeColors: Record<string, string> = { morning: "text-yellow-200", followup: "text-blue-400", disengagement: "text-rose-400" };
                  const noteType = (note as any).submissionType as string ?? "morning";
                  return (
                    <div key={i} className="flex items-start gap-3 rounded-xl bg-white/5/50 px-3 py-2.5">
                      <div
                        className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-background shrink-0 mt-0.5"
                        style={{ background: COACH_COLORS[(coaches?.findIndex(c => c.id === note.coachId) ?? 0) % COACH_COLORS.length] }}
                      >
                        {(coach?.name ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium text-white/90">{coach?.name ?? "Unknown"}</span>
                          <span className={`text-[10px] font-medium ${typeColors[noteType] ?? "text-white/50"}`}>
                            {typeLabels[noteType] ?? noteType}
                          </span>
                          <span className="text-[10px] text-white/50 ml-auto">
                            {new Date(note.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-xs text-white/50 leading-relaxed">{note.notes}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
