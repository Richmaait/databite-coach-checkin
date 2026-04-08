import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { melbourneNow } from "@/lib/utils";
import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Calendar, Users, BarChart2, CheckCircle2, Target } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
const DAY_LABELS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri",
};
const COACH_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ec4899", "#14b8a6"];

type Preset = "1w" | "lw" | "2w" | "4w" | "3m" | "6m" | "12m" | "custom";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function addWeeks(d: Date, n: number): Date { return addDays(d, n * 7); }

/** Returns the most recent Sunday (end of last complete week). */
function lastSundayOf(from: Date = melbourneNow()): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=Sun
  if (dow !== 0) d.setDate(d.getDate() - dow);
  return d;
}

function getPresetDates(preset: Preset): { startDate: string; endDate: string } {
  const today = melbourneNow();
  const thisMonday = getMondayOf(today);

  if (preset === "1w") {
    // Current incomplete week: Mon of this week → today
    return { startDate: toDateStr(thisMonday), endDate: toDateStr(today) };
  }
  if (preset === "lw") {
    // Last complete Mon–Sun week
    const sun = lastSundayOf(today);
    const mon = addWeeks(sun, -1);
    mon.setDate(mon.getDate() + 1); // sun - 6 days = the Monday
    return { startDate: toDateStr(getMondayOf(addDays(sun, -6))), endDate: toDateStr(sun) };
  }

  // For multi-week presets: end on last Sunday, start N weeks back
  const sun = lastSundayOf(today);
  const weeksMap: Record<Exclude<Preset, "custom" | "1w" | "lw">, number> = {
    "2w": 2, "4w": 4, "3m": 13, "6m": 26, "12m": 52,
  };
  const weeks = weeksMap[preset as Exclude<Preset, "custom" | "1w" | "lw">] ?? 4;
  const startMon = getMondayOf(addDays(sun, -(weeks * 7 - 1)));
  return { startDate: toDateStr(startMon), endDate: toDateStr(sun) };
}

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function engagementColor(pct: number | null | undefined): string {
  if (pct == null) return "text-white/50";
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 60) return "text-white/80";
  return "text-red-400";
}

function engagementBadgeClass(pct: number | null | undefined): string {
  if (pct == null) return "text-white/50 border-white/10 bg-white/5";
  if (pct >= 80) return "text-emerald-400 border-emerald-400/30 bg-emerald-400/10";
  if (pct >= 60) return "text-white/80 border-white/20 bg-white/10";
  return "text-red-400 border-red-400/30 bg-red-400/10";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CoachPerformanceReport() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  if (user && user.role !== "admin") { navigate("/"); return null; }

  const [preset, setPreset] = useState<Preset>("lw");
  const [customStart, setCustomStart] = useState(() => toDateStr(addWeeks(getMondayOf(melbourneNow()), -7)));
  const [customEnd, setCustomEnd] = useState(() => toDateStr(getMondayOf(melbourneNow())));

  const { startDate, endDate } = useMemo(() => {
    if (preset === "custom") return { startDate: customStart, endDate: customEnd };
    return getPresetDates(preset);
  }, [preset, customStart, customEnd]);

  const isOneWeek = preset === "1w" || preset === "lw";

  // Actual vs Stated hours
  const { data: hoursData } = trpc.clientCheckins.getCoachHoursBreakdown.useQuery(
    { startDate, endDate },
    { enabled: !!startDate && !!endDate }
  );

  // Coach check-in activity (morning/followup/disengagement records)
  const { data: activityRecords } = trpc.checkins.byDateRange.useQuery(
    { startDate, endDate },
    { enabled: !!startDate && !!endDate }
  );
  const { data: allCoaches } = trpc.coaches.list.useQuery();

  // Last 6 completed weeks for per-coach engagement tracker
  const kpiWeekStarts = useMemo(() => {
    const starts: string[] = [];
    const now = melbourneNow();
    const dow = now.getDay();
    const diff = dow === 0 ? 6 : dow - 1;
    const mon = new Date(now); mon.setDate(mon.getDate() - diff); // current Monday
    const d = new Date(mon); d.setDate(d.getDate() - 7); // last completed week
    for (let i = 0; i < 6; i++) {
      const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,"0"); const dd = String(d.getDate()).padStart(2,"0");
      starts.push(`${y}-${m}-${dd}`);
      d.setDate(d.getDate() - 7);
    }
    return starts;
  }, []);
  const { data: kpiWeeklyStats } = trpc.clientCheckins.getRosterWeeklyStats.useQuery(
    { weekStarts: kpiWeekStarts },
    { enabled: kpiWeekStarts.length > 0, staleTime: 5 * 60 * 1000 },
  );

  // Weekly multi-week query
  const { data: weeklyData, isLoading: weeklyLoading } = trpc.clientCheckins.getPerformanceReport.useQuery(
    { startDate, endDate },
    { enabled: !isOneWeek && !!startDate && !!endDate }
  );

  // Daily 1-week query
  const { data: dailyData, isLoading: dailyLoading } = trpc.clientCheckins.getDailyActivityBreakdown.useQuery(
    { weekStart: startDate },
    { enabled: isOneWeek && !!startDate }
  );

  const isLoading = isOneWeek ? dailyLoading : weeklyLoading;

  // ─── Derived: weekly view ──────────────────────────────────────────────────

  const weeklyChartData = useMemo(() => {
    if (!weeklyData) return [];
    return (weeklyData?.weeks ?? []).map(week => {
      const row: Record<string, string | number> = { week: formatWeekLabel(week) };
      for (const coach of (weeklyData?.coaches ?? [])) {
        row[`${coach.coachName} (Scheduled)`] = coach.scheduledByWeek[week] ?? 0;
        row[`${coach.coachName} (Completed)`] = coach.completedByWeek[week] ?? 0;
      }
      return row;
    });
  }, [weeklyData]);

  // ─── Derived: daily view ───────────────────────────────────────────────────

  const dailyChartData = useMemo(() => {
    if (!dailyData) return [];
    return DAYS.map(day => {
      const row: Record<string, string | number> = { day: DAY_LABELS[day] };
      for (const coach of (dailyData?.coaches ?? [])) {
        row[`${coach.coachName} (Scheduled)`] = coach.scheduledByDay[day] ?? 0;
        row[`${coach.coachName} (Completed)`] = coach.completedByDay[day] ?? 0;
      }
      return row;
    });
  }, [dailyData]);

  // ─── Summary stats ─────────────────────────────────────────────────────────

  const coaches = isOneWeek ? (dailyData?.coaches ?? []) : (weeklyData?.coaches ?? []);
  const grandTotalCompleted = coaches.reduce((s, c) => s + c.totalCompleted, 0);
  const grandTotalScheduled = coaches.reduce((s, c) => s + c.totalScheduled, 0);
  const teamEngagementPct = grandTotalScheduled > 0
    ? Math.round((grandTotalCompleted / grandTotalScheduled) * 1000) / 10
    : null;

  const weekCount = weeklyData?.weeks.length ?? 1;
  const teamWeeklyAvg = isOneWeek
    ? Math.round((grandTotalCompleted / Math.max(coaches.length, 1)) * 10) / 10
    : (weekCount > 0 ? Math.round((grandTotalCompleted / weekCount) * 10) / 10 : 0);
  const teamDailyAvg = isOneWeek
    ? Math.round((grandTotalCompleted / (DAYS.length * Math.max(coaches.length, 1))) * 10) / 10
    : (weekCount > 0 ? Math.round((grandTotalCompleted / (weekCount * 5)) * 10) / 10 : 0);

  const chartData = isOneWeek ? dailyChartData : weeklyChartData;
  const chartXKey = isOneWeek ? "day" : "week";

  // ─── Render ────────────────────────────────────────────────────────────────

  const PRESETS: { key: Preset; label: string }[] = [
    { key: "1w", label: "This week" },
    { key: "lw", label: "Last week" },
    { key: "2w", label: "2 weeks" },
    { key: "4w", label: "4 weeks" },
    { key: "3m", label: "3 months" },
    { key: "6m", label: "6 months" },
    { key: "12m", label: "12 months" },
    { key: "custom", label: "Custom" },
  ];

  // Loading guard — prevent crash when data hasn't loaded yet
  const dataNotReady = isOneWeek ? !dailyData : !weeklyData;

  return (
    <DashboardLayout>
      <div className="px-6 pb-6 pt-20 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Comfortaa', cursive" }}>Coach Activity</h1>
          <p className="text-sm text-white/50">
            Client check-in volumes per coach — completed vs scheduled with engagement %.
          </p>
        </div>

        {/* Preset controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 flex-wrap">
            {PRESETS.map(p => (
              <Button
                key={p.key}
                size="sm"
                variant={preset === p.key ? "default" : "outline"}
                onClick={() => setPreset(p.key)}
                className="text-xs"
              >
                {p.label}
              </Button>
            ))}
          </div>

          {preset === "custom" && (
            <div className="flex items-center gap-2 text-sm">
              <label className="text-white/50">From</label>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                className="border border-white/[0.08] rounded px-2 py-1 bg-white/5 text-white/90 text-sm" />
              <label className="text-white/50">To</label>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                className="border border-white/[0.08] rounded px-2 py-1 bg-white/5 text-white/90 text-sm" />
            </div>
          )}

          {!isLoading && (
            <span className="text-xs text-white/50 ml-auto">
              {isOneWeek
                ? `Week of ${formatWeekLabel(startDate)}`
                : `${weekCount} week${weekCount !== 1 ? "s" : ""} · ${formatWeekLabel(startDate)} – ${formatWeekLabel(endDate)}`}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-white/50 text-sm">Loading…</div>
        ) : coaches.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-white/50 text-sm">
            No check-in data found for this period.
          </div>
        ) : (
          <>
 
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "Completed", value: grandTotalCompleted, sub: "total check-ins", color: "" },
                { icon: <BarChart2 className="w-3.5 h-3.5" />, label: "Scheduled", value: grandTotalScheduled > 0 ? grandTotalScheduled : "—", sub: "from roster", color: "" },
                { icon: <Target className="w-3.5 h-3.5" />, label: "Engagement", value: teamEngagementPct != null ? `${teamEngagementPct}%` : "—", sub: "team overall", color: engagementColor(teamEngagementPct) },
                { icon: <TrendingUp className="w-3.5 h-3.5" />, label: isOneWeek ? "Daily Avg" : "Weekly Avg", value: isOneWeek ? teamDailyAvg : teamWeeklyAvg, sub: isOneWeek ? "completions/day" : "completions/week", color: "" },
                { icon: <Calendar className="w-3.5 h-3.5" />, label: isOneWeek ? "Week Total" : "Daily Avg", value: isOneWeek ? grandTotalCompleted : teamDailyAvg, sub: isOneWeek ? "this week" : "completions/day", color: "" },
                { icon: <Users className="w-3.5 h-3.5" />, label: "Coaches", value: coaches.length, sub: isOneWeek ? "active" : `${weekCount} weeks`, color: "" },
              ].map(card => (
                <Card key={card.label} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
                  <CardHeader className="pb-1 pt-4 px-4">
                    <CardTitle className="text-xs font-medium text-white/50 uppercase tracking-wide flex items-center gap-1">
                      {card.icon} {card.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
                    {card.label === "Engagement" && teamEngagementPct != null && teamEngagementPct >= 80 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 border border-emerald-400/20 mt-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                        KPI ACHIEVED
                      </span>
                    )}
                    <p className="text-xs text-white/50 mt-0.5">{card.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>


            {/* Per-coach weekly engagement tracker */}
            {kpiWeeklyStats && coaches.length > 0 && (() => {
              const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
              // Group by coach
              const byCoach = new Map<number, Array<{ weekStart: string; pct: number }>>();
              for (const r of kpiWeeklyStats) {
                if (!byCoach.has(r.coachId)) byCoach.set(r.coachId, []);
                const eff = Math.max(r.scheduled - (r.excused ?? 0), 1);
                const pct = r.scheduled > 0 ? Math.round((r.completed / eff) * 1000) / 10 : 0;
                byCoach.get(r.coachId)!.push({ weekStart: r.weekStart, pct });
              }
              return (
                <div className="glass rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white/80 mb-4">Weekly Engagement by Coach</h3>
                  <div className="space-y-3">
                    {coaches.map(coach => {
                      const weeks = (byCoach.get(coach.id) ?? []).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
                      return (
                        <div key={coach.id} className="flex items-center gap-3">
                          <span className="text-sm font-medium text-white/70 w-16 shrink-0">{coach.name}</span>
                          <div className="flex items-center gap-1.5 flex-1">
                            {weeks.map(w => {
                              const mon = new Date(w.weekStart + "T00:00:00");
                              const label = `${mon.getDate()} ${months[mon.getMonth()]}`;
                              return (
                                <div key={w.weekStart} className={`flex-1 glass rounded-lg px-2 py-1.5 text-center border ${w.pct >= 80 ? "border-emerald-400/20" : "border-red-400/20"}`}>
                                  <span className={`text-xs font-bold block ${w.pct >= 80 ? "text-emerald-400" : "text-red-400"}`}>{w.pct.toFixed(0)}%</span>
                                  <span className="text-[9px] text-white/30 block">{label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Engagement trend (weekly view only) */}
            {!isOneWeek && weeklyData && (
              <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Engagement % Trend — Week by Week</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart
                      data={(weeklyData?.weeks ?? []).map(week => {
                        const row: Record<string, string | number> = { week: formatWeekLabel(week) };
                        for (const coach of (weeklyData?.coaches ?? [])) {
                          row[coach.coachName] = coach.engagementByWeek[week] ?? 0;
                        }
                        return row;
                      })}
                      margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v: number, n: string) => [`${v}%`, n]}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "12px" }}
                        labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }} />
                      <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
                      {(weeklyData?.coaches ?? []).map((coach, i) => (
                        <Line key={coach.coachId} type="monotone" dataKey={coach.coachName}
                          stroke={COACH_COLORS[i % COACH_COLORS.length]} strokeWidth={2}
                          dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Per-coach summary table */}
            <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Per-Coach Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.08]">
                        <th className="text-left px-4 py-3 font-medium text-white/50">Coach</th>
                        <th className="text-right px-4 py-3 font-medium text-white/50">Completed</th>
                        <th className="text-right px-4 py-3 font-medium text-white/50">Scheduled</th>
                        <th className="text-right px-4 py-3 font-medium text-white/50">Engagement</th>
                        <th className="text-right px-4 py-3 font-medium text-white/50">{isOneWeek ? "Daily Avg" : "Weekly Avg"}</th>
                        {!isOneWeek && <th className="text-right px-4 py-3 font-medium text-white/50">Daily Avg</th>}
                        {!isOneWeek && <th className="text-right px-4 py-3 font-medium text-white/50">Best Week</th>}
                        {!isOneWeek && <th className="text-right px-4 py-3 font-medium text-white/50">Worst Week</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {coaches.map((coach, i) => {
                        const weeklyCoach = !isOneWeek ? ((weeklyData?.coaches ?? []).find(c => c.coachId === coach.coachId)) : null;
                        const weekValues = weeklyCoach ? (weeklyData?.weeks.map(w => weeklyCoach.completedByWeek[w] ?? 0) ?? []) : [];
                        const best = weekValues.length > 0 ? Math.max(...weekValues) : 0;
                        const worst = weekValues.length > 0 ? Math.min(...weekValues) : 0;
                        return (
                          <tr key={coach.coachId} className="border-b border-white/[0.08]/50 hover:bg-white/5/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: COACH_COLORS[i % COACH_COLORS.length] }} />
                                <span className="font-medium">{coach.coachName}</span>
                              </div>
                            </td>
                            <td className="text-right px-4 py-3 font-semibold tabular-nums">{coach.totalCompleted}</td>
                            <td className="text-right px-4 py-3 tabular-nums text-white/50">
                              {coach.totalScheduled > 0 ? coach.totalScheduled : "—"}
                            </td>
                            <td className="text-right px-4 py-3 tabular-nums">
                              {coach.overallEngagementPct != null ? (
                                <Badge variant="outline" className={engagementBadgeClass(coach.overallEngagementPct)}>
                                  {coach.overallEngagementPct}%
                                </Badge>
                              ) : <span className="text-white/50">—</span>}
                            </td>
                            <td className="text-right px-4 py-3 tabular-nums">{coach.weeklyAvg}</td>
                            {!isOneWeek && weeklyCoach && (
                              <>
                                <td className="text-right px-4 py-3 tabular-nums">{weeklyCoach.dailyAvg}</td>
                                <td className="text-right px-4 py-3 tabular-nums">
                                  <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/10">{best}</Badge>
                                </td>
                                <td className="text-right px-4 py-3 tabular-nums">
                                  <Badge variant="outline" className="text-yellow-200 border-yellow-200/30 bg-yellow-400/10">{worst}</Badge>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-white/5/20">
                        <td className="px-4 py-3 font-semibold">Team Total</td>
                        <td className="text-right px-4 py-3 font-bold tabular-nums">{grandTotalCompleted}</td>
                        <td className="text-right px-4 py-3 font-semibold tabular-nums text-white/50">
                          {grandTotalScheduled > 0 ? grandTotalScheduled : "—"}
                        </td>
                        <td className="text-right px-4 py-3 font-semibold tabular-nums">
                          {teamEngagementPct != null ? (
                            <Badge variant="outline" className={engagementBadgeClass(teamEngagementPct)}>{teamEngagementPct}%</Badge>
                          ) : "—"}
                        </td>
                        <td className="text-right px-4 py-3 font-semibold tabular-nums">
                          {isOneWeek ? teamDailyAvg : teamWeeklyAvg}
                        </td>
                        {!isOneWeek && <><td className="text-right px-4 py-3 font-semibold tabular-nums">{teamDailyAvg}</td><td /><td /></>}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* 1-week: daily breakdown table — cleaner layout with Done/Sched combined */}
            {isOneWeek && dailyData && (
              <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Daily Breakdown — Week of {formatWeekLabel(startDate)}</CardTitle>
                  <p className="text-xs text-white/50 mt-0.5">Scheduled / Done per coach · dimmed rows = not yet due</p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.08]">
                          <th className="text-left px-4 py-3 font-medium text-white/50 w-16">Day</th>
                          {(dailyData?.coaches ?? []).map((coach, i) => (
                            <th key={coach.coachId} className="text-center px-3 py-3 font-medium" colSpan={2}
                              style={{ color: COACH_COLORS[i % COACH_COLORS.length] }}>
                              {coach.coachName}
                            </th>
                          ))}
                          <th className="text-center px-3 py-3 font-medium text-white/50" colSpan={2}>Team</th>
                        </tr>
                        <tr className="border-b border-white/[0.08]/50 bg-white/5/10 text-xs text-white/50">
                          <th />
                          {(dailyData?.coaches ?? []).map(coach => (
                            <React.Fragment key={coach.coachId}>
                              <th className="text-center px-3 py-1.5 font-normal">Sched / Done</th>
                              <th className="text-center px-3 py-1.5 font-normal">Eng%</th>
                            </React.Fragment>
                          ))}
                          <th className="text-center px-3 py-1.5 font-normal">Sched / Done</th>
                          <th className="text-center px-3 py-1.5 font-normal">Eng%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DAYS.map(day => {
                          const rowComp = (dailyData?.coaches ?? []).reduce((s, c) => s + (c.completedByDay[day] ?? 0), 0);
                          const rowSched = (dailyData?.coaches ?? []).reduce((s, c) => s + (c.scheduledByDay[day] ?? 0), 0);
                          const rowEng = rowSched > 0 ? Math.round((rowComp / rowSched) * 1000) / 10 : null;
                          const hasData = rowSched > 0 || rowComp > 0;
                          return (
                            <tr key={day} className={`border-b border-white/[0.08]/50 transition-colors ${hasData ? "hover:bg-white/5/30" : "opacity-40"}`}>
                              <td className="px-4 py-3 font-medium">{DAY_LABELS[day]}</td>
                              {(dailyData?.coaches ?? []).map(coach => {
                                const comp = coach.completedByDay[day] ?? null;
                                const sched = coach.scheduledByDay[day] ?? null;
                                const eng = coach.engagementByDay[day] ?? null;
                                const noData = comp == null && sched == null;
                                return (
                                  <React.Fragment key={coach.coachId}>
                                    <td className="text-center px-3 py-3 tabular-nums">
                                      {noData
                                        ? <span className="text-white/50/30">—</span>
                                        : <span className="font-medium">{sched ?? 0}<span className="text-white/50 font-normal">/{comp ?? 0}</span></span>
                                      }
                                    </td>
                                    <td className="text-center px-3 py-3 tabular-nums">
                                      {eng != null
                                        ? <span className={engagementColor(eng)}>{eng}%</span>
                                        : <span className="text-white/50/30">—</span>}
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                              <td className="text-center px-3 py-3 font-semibold tabular-nums">
                                {rowSched > 0
                                  ? <span>{rowSched}<span className="text-white/50 font-normal">/{rowComp}</span></span>
                                  : <span className="text-white/50/30">—</span>}
                              </td>
                              <td className="text-center px-3 py-3 tabular-nums">
                                {rowEng != null ? <span className={engagementColor(rowEng)}>{rowEng}%</span> : <span className="text-white/50/30">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-white/5/20 font-semibold border-t border-white/[0.08]">
                          <td className="px-4 py-3">Total</td>
                          {(dailyData?.coaches ?? []).map(coach => (
                            <React.Fragment key={coach.coachId}>
                              <td className="text-center px-3 py-3 tabular-nums">
                                {coach.totalScheduled > 0
                                  ? <span>{coach.totalScheduled}<span className="text-white/50 font-normal">/{coach.totalCompleted}</span></span>
                                  : coach.totalCompleted}
                              </td>
                              <td className="text-center px-3 py-3 tabular-nums">
                                {coach.overallEngagementPct != null
                                  ? <span className={engagementColor(coach.overallEngagementPct)}>{coach.overallEngagementPct}%</span>
                                  : "—"}
                              </td>
                            </React.Fragment>
                          ))}
                          <td className="text-center px-3 py-3 tabular-nums">
                            {grandTotalScheduled > 0
                              ? <span>{grandTotalCompleted}<span className="text-white/50 font-normal">/{grandTotalScheduled}</span></span>
                              : grandTotalCompleted}
                          </td>
                          <td className="text-center px-3 py-3 tabular-nums">
                            {teamEngagementPct != null ? <span className={engagementColor(teamEngagementPct)}>{teamEngagementPct}%</span> : "—"}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Multi-week: week-by-week detail table */}
            {!isOneWeek && weeklyData && (
              <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Week-by-Week Detail</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.08]">
                          <th className="text-left px-4 py-3 font-medium text-white/50 sticky left-0 bg-zinc-900/95 backdrop-blur-xl z-10 min-w-[90px]">Week of</th>
                          {(weeklyData?.coaches ?? []).map((coach, i) => (
                            <th key={coach.coachId} className="text-right px-4 py-3 font-medium" colSpan={3}
                              style={{ color: COACH_COLORS[i % COACH_COLORS.length] }}>
                              {coach.coachName}
                            </th>
                          ))}
                          <th className="text-right px-4 py-3 font-medium text-white/50" colSpan={2}>Team</th>
                        </tr>
                        <tr className="border-b border-white/[0.08]/50 bg-white/5/10">
                          <th className="sticky left-0 bg-white/5/10 z-10" />
                          {(weeklyData?.coaches ?? []).map(coach => (
                            <React.Fragment key={coach.coachId}>
                              <th className="text-right px-2 py-1.5 text-xs font-normal text-white/50">Done</th>
                              <th className="text-right px-2 py-1.5 text-xs font-normal text-white/50">Sched</th>
                              <th className="text-right px-2 py-1.5 text-xs font-normal text-white/50">Eng%</th>
                            </React.Fragment>
                          ))}
                          <th className="text-right px-2 py-1.5 text-xs font-normal text-white/50">Done</th>
                          <th className="text-right px-2 py-1.5 text-xs font-normal text-white/50">Eng%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(weeklyData?.weeks ?? []).map(week => {
                          const rowComp = (weeklyData?.coaches ?? []).reduce((s, c) => s + (c.completedByWeek[week] ?? 0), 0);
                          const rowSched = (weeklyData?.coaches ?? []).reduce((s, c) => s + (c.scheduledByWeek[week] ?? 0), 0);
                          const rowEng = rowSched > 0 ? Math.round((rowComp / rowSched) * 1000) / 10 : null;
                          return (
                            <tr key={week} className="border-b border-white/[0.08]/50 hover:bg-white/5/30 transition-colors">
                              <td className="px-4 py-2.5 font-medium sticky left-0 bg-zinc-900/95 backdrop-blur-xl z-10">{formatWeekLabel(week)}</td>
                              {(weeklyData?.coaches ?? []).map(coach => {
                                const comp = coach.completedByWeek[week];
                                const sched = coach.scheduledByWeek[week];
                                const eng = coach.engagementByWeek[week];
                                return (
                                  <React.Fragment key={coach.coachId}>
                                    <td className="text-right px-2 py-2.5 tabular-nums">
                                      {comp != null ? <span className="font-medium">{comp}</span> : <span className="text-white/50/40">—</span>}
                                    </td>
                                    <td className="text-right px-2 py-2.5 tabular-nums text-white/50">
                                      {sched != null ? sched : <span className="text-white/50/30">—</span>}
                                    </td>
                                    <td className="text-right px-2 py-2.5 tabular-nums">
                                      {eng != null ? <span className={engagementColor(eng)}>{eng}%</span> : <span className="text-white/50/30">—</span>}
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                              <td className="text-right px-2 py-2.5 font-semibold tabular-nums">{rowComp}</td>
                              <td className="text-right px-2 py-2.5 tabular-nums">
                                {rowEng != null ? <span className={engagementColor(rowEng)}>{rowEng}%</span> : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-white/5/20 font-semibold border-t border-white/[0.08]">
                          <td className="px-4 py-3 sticky left-0 bg-white/5/20 z-10">Totals</td>
                          {(weeklyData?.coaches ?? []).map(coach => (
                            <React.Fragment key={coach.coachId}>
                              <td className="text-right px-2 py-3 tabular-nums">{coach.totalCompleted}</td>
                              <td className="text-right px-2 py-3 tabular-nums text-white/50">
                                {coach.totalScheduled > 0 ? coach.totalScheduled : "—"}
                              </td>
                              <td className="text-right px-2 py-3 tabular-nums">
                                {coach.overallEngagementPct != null ? (
                                  <span className={engagementColor(coach.overallEngagementPct)}>{coach.overallEngagementPct}%</span>
                                ) : "—"}
                              </td>
                            </React.Fragment>
                          ))}
                          <td className="text-right px-2 py-3 tabular-nums">{grandTotalCompleted}</td>
                          <td className="text-right px-2 py-3 tabular-nums">
                            {teamEngagementPct != null ? <span className={engagementColor(teamEngagementPct)}>{teamEngagementPct}%</span> : "—"}
                          </td>
                        </tr>
                        <tr className="text-white/50 text-xs border-b border-white/[0.08]/50">
                          <td className="px-4 py-2 sticky left-0 bg-zinc-900/95 backdrop-blur-xl z-10">Weekly avg</td>
                          {(weeklyData?.coaches ?? []).map(coach => (
                            <React.Fragment key={coach.coachId}>
                              <td className="text-right px-2 py-2 tabular-nums">{coach.weeklyAvg}</td>
                              <td className="text-right px-2 py-2 tabular-nums">—</td>
                              <td className="text-right px-2 py-2 tabular-nums">—</td>
                            </React.Fragment>
                          ))}
                          <td className="text-right px-2 py-2 tabular-nums">{teamWeeklyAvg}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actual vs Stated Hours */}
            {hoursData && hoursData.length > 0 && (
              <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Actual vs Stated Hours</CardTitle>
                  <p className="text-xs text-white/50 mt-0.5">Stated = morning check-in · Actual = first to last client completion</p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.08]">
                          <th className="text-left px-4 py-2.5 font-medium text-white/50">Date</th>
                          <th className="text-left px-4 py-2.5 font-medium text-white/50">Coach</th>
                          <th className="text-left px-4 py-2.5 font-medium text-white/50">Stated Hours</th>
                          <th className="text-center px-4 py-2.5 font-medium text-white/50">First Completion</th>
                          <th className="text-center px-4 py-2.5 font-medium text-white/50">Last Completion</th>
                          <th className="text-right px-4 py-2.5 font-medium text-white/50">Actual Span</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hoursData.map((row, i) => {
                          const d = new Date(row.recordDate + "T00:00:00");
                          const dateLabel = d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
                          return (
                            <tr key={i} className="border-b border-white/[0.08]/50 hover:bg-white/5/10">
                              <td className="px-4 py-3 text-white/50">{dateLabel}</td>
                              <td className="px-4 py-3 font-medium">{row.coachName}</td>
                              <td className="px-4 py-3 text-white/50">{row.statedHours ?? <span className="text-white/50/30">—</span>}</td>
                              <td className="text-center px-4 py-3 tabular-nums">
                                {row.firstCompletion ?? <span className="text-white/50/30">—</span>}
                              </td>
                              <td className="text-center px-4 py-3 tabular-nums">
                                {row.lastCompletion ?? <span className="text-white/50/30">—</span>}
                              </td>
                              <td className="text-right px-4 py-3 tabular-nums font-semibold">
                                {row.actualHours != null
                                  ? <span>{row.actualHours}h</span>
                                  : <span className="text-white/50/30">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Coach activity log (morning/followup submissions) */}
            {activityRecords && activityRecords.length > 0 && (
              <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Coach Submission Log</CardTitle>
                  <p className="text-xs text-white/50 mt-0.5">Morning check-ins and follow-up submissions in this period</p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur-xl z-10">
                        <tr className="border-b border-white/[0.08]">
                          <th className="text-left px-4 py-2.5 font-medium text-white/50">Date</th>
                          <th className="text-left px-4 py-2.5 font-medium text-white/50">Coach</th>
                          <th className="text-left px-4 py-2.5 font-medium text-white/50">Type</th>
                          <th className="text-right px-4 py-2.5 font-medium text-white/50">Scheduled</th>
                          <th className="text-right px-4 py-2.5 font-medium text-white/50">Completed</th>
                          <th className="text-right px-4 py-2.5 font-medium text-white/50">Eng%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activityRecords.slice().reverse().map(r => {
                          const coach = allCoaches?.find(c => c.id === r.coachId);
                          const coachIdx = allCoaches ? allCoaches.findIndex(c => c.id === r.coachId) : 0;
                          return (
                            <tr key={r.id} className="border-b border-white/[0.08]/40 hover:bg-white/5/20 transition-colors">
                              <td className="px-4 py-2 tabular-nums text-white/50 text-xs">
                                {new Date(r.recordDate).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: COACH_COLORS[coachIdx % COACH_COLORS.length] }} />
                                  <span className="text-xs font-medium">{coach?.name ?? `Coach ${r.coachId}`}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2">
                                <Badge variant="outline" className="text-[10px] capitalize">
                                  {r.submissionType}
                                </Badge>
                              </td>
                              <td className="text-right px-4 py-2 tabular-nums text-xs">{r.scheduledCheckins ?? "—"}</td>
                              <td className="text-right px-4 py-2 tabular-nums text-xs font-medium">{r.completedCheckins ?? "—"}</td>
                              <td className="text-right px-4 py-2 tabular-nums text-xs">
                                {r.engagementPct != null
                                  ? <span className={engagementColor(r.engagementPct)}>{r.engagementPct}%</span>
                                  : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
