import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle, Clock, TrendingDown, TrendingUp, MinusCircle, ChevronDown, ChevronRight } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse a time string like "9:00am" or "11:30pm" into minutes-since-midnight */
function parseTimeMins(t: string): number | null {
  if (!t) return null;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3].toLowerCase();
  if (ampm === "pm" && h !== 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return h * 60 + min;
}

/** Parse a workingHours string into an array of {start, end} blocks in minutes-since-midnight */
function parseWorkingHours(wh: string | null): Array<{ start: number; end: number; label: string }> {
  if (!wh) return [];
  // Support "9:00am-5:00pm" or "7:00am-11:00am, 2:00pm-6:00pm"
  return wh.split(",").map(s => s.trim()).flatMap(block => {
    const parts = block.split(/[-–]/);
    if (parts.length < 2) return [];
    const start = parseTimeMins(parts[0].trim());
    const end = parseTimeMins(parts[1].trim());
    if (start === null || end === null) return [];
    return [{ start, end, label: block }];
  });
}

/** Convert a Date to minutes-since-midnight in local time */
function toLocalMins(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Format minutes-since-midnight as "9:03am" */
function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

/** Format a Date as "9:03am" in local time */
function fmtTime(d: Date): string {
  return fmtMins(toLocalMins(d));
}

/** Format duration in minutes as "2h 15m" or "45m" */
function fmtDuration(mins: number | null): string {
  if (mins === null) return "—";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Format a date string "2026-03-03" as "Mon 3 Mar" */
function fmtDate(d: string): string {
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

type StatusKey = "within" | "early" | "over" | "under" | "no_hours" | "no_activity";

interface StatusInfo {
  key: StatusKey;
  label: string;
  detail: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}

const UNDER_THRESHOLD_MINS = 30; // flag as "came in under" if last check-in is ≥30 min before stated end

function computeStatus(
  workingHours: string | null,
  firstCheckIn: Date | null,
  lastCheckIn: Date | null,
): StatusInfo {
  const noHours: StatusInfo = {
    key: "no_hours",
    label: "No stated hours",
    detail: "No morning check-in submitted",
    color: "text-muted-foreground",
    bgColor: "bg-muted/40",
    icon: <MinusCircle className="w-4 h-4" />,
  };
  const noActivity: StatusInfo = {
    key: "no_activity",
    label: "No activity",
    detail: "No client check-ins recorded",
    color: "text-muted-foreground",
    bgColor: "bg-muted/40",
    icon: <MinusCircle className="w-4 h-4" />,
  };

  if (!workingHours) return noHours;
  if (!firstCheckIn || !lastCheckIn) return noActivity;

  const blocks = parseWorkingHours(workingHours);
  if (blocks.length === 0) return noHours;

  const statedStart = Math.min(...blocks.map(b => b.start));
  const statedEnd = Math.max(...blocks.map(b => b.end));

  const firstMins = toLocalMins(firstCheckIn);
  const lastMins = toLocalMins(lastCheckIn);

  const startedEarly = firstMins < statedStart - 5; // 5 min grace
  const ranOver = lastMins > statedEnd + 5;
  const cameUnder = !ranOver && (statedEnd - lastMins) >= UNDER_THRESHOLD_MINS;

  if (startedEarly && ranOver) {
    return {
      key: "over",
      label: "Started early & ran over",
      detail: `Started ${fmtMins(statedStart - firstMins)} early, finished ${fmtMins(lastMins - statedEnd)} late`,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      icon: <TrendingUp className="w-4 h-4" />,
    };
  }
  if (startedEarly) {
    return {
      key: "early",
      label: "Started early",
      detail: `First check-in was ${fmtMins(statedStart - firstMins)} before stated start`,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      icon: <TrendingUp className="w-4 h-4" />,
    };
  }
  if (ranOver) {
    return {
      key: "over",
      label: "Ran over",
      detail: `Last check-in was ${fmtMins(lastMins - statedEnd)} after stated end`,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      icon: <TrendingUp className="w-4 h-4" />,
    };
  }
  if (cameUnder) {
    return {
      key: "under",
      label: "Came in under",
      detail: `Last check-in was ${fmtMins(statedEnd - lastMins)} before stated end`,
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      icon: <TrendingDown className="w-4 h-4" />,
    };
  }
  return {
    key: "within",
    label: "Within window",
    detail: "All activity within stated hours",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    icon: <CheckCircle className="w-4 h-4" />,
  };
}

// ─── Date range helpers ───────────────────────────────────────────────────────

function getLocalDateStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMondayOfWeek(d = new Date()): Date {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ActivityReport() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";

  const [range, setRange] = useState<"this_week" | "last_week" | "last_14" | "last_30">("this_week");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filterCoach, setFilterCoach] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    if (range === "this_week") {
      const mon = getMondayOfWeek(today);
      return { startDate: getLocalDateStr(mon), endDate: getLocalDateStr(today) };
    }
    if (range === "last_week") {
      const mon = getMondayOfWeek(today);
      mon.setDate(mon.getDate() - 7);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { startDate: getLocalDateStr(mon), endDate: getLocalDateStr(sun) };
    }
    if (range === "last_14") {
      const from = new Date(today);
      from.setDate(today.getDate() - 13);
      return { startDate: getLocalDateStr(from), endDate: getLocalDateStr(today) };
    }
    // last_30
    const from = new Date(today);
    from.setDate(today.getDate() - 29);
    return { startDate: getLocalDateStr(from), endDate: getLocalDateStr(today) };
  }, [range]);

  const { data: rawRows, isLoading } = trpc.clientCheckins.getActivityReport.useQuery(
    { startDate, endDate },
    { enabled: isAdmin, staleTime: 2 * 60 * 1000 },
  );

  // Hydrate dates (tRPC superjson keeps them as Date, but just in case)
  const rows = useMemo(() => {
    if (!rawRows) return [];
    return rawRows.map(r => ({
      ...r,
      firstCheckIn: r.firstCheckIn ? new Date(r.firstCheckIn) : null,
      lastCheckIn: r.lastCheckIn ? new Date(r.lastCheckIn) : null,
      allTimestamps: (r.allTimestamps ?? []).map((t: Date | string) => new Date(t)),
    }));
  }, [rawRows]);

  const coachNames = useMemo(() => {
    const names = Array.from(new Set(rows.map(r => r.coachName))).sort();
    return names;
  }, [rows]);

  const processedRows = useMemo(() => {
    return rows.map(r => ({
      ...r,
      status: computeStatus(r.workingHours, r.firstCheckIn, r.lastCheckIn),
    }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return processedRows.filter(r => {
      if (filterCoach !== "all" && r.coachName !== filterCoach) return false;
      if (filterStatus !== "all" && r.status.key !== filterStatus) return false;
      return true;
    });
  }, [processedRows, filterCoach, filterStatus]);

  // Summary counts
  const summary = useMemo(() => {
    const counts: Record<StatusKey, number> = { within: 0, early: 0, over: 0, under: 0, no_hours: 0, no_activity: 0 };
    for (const r of processedRows) counts[r.status.key]++;
    return counts;
  }, [processedRows]);

  const toggleRow = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (loading) return null;
  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Access restricted to managers only.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Activity Report</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Compare actual check-in timestamps against each coach's declared working hours.
              <span className="ml-2 text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded font-medium">
                Manager only — not visible to coaches
              </span>
            </p>
          </div>
          <Select value={range} onValueChange={v => setRange(v as typeof range)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_week">This week</SelectItem>
              <SelectItem value="last_week">Last week</SelectItem>
              <SelectItem value="last_14">Last 14 days</SelectItem>
              <SelectItem value="last_30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary badges */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { key: "within", label: "Within window", color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { key: "under", label: "Came in under", color: "text-red-400", bg: "bg-red-500/10" },
            { key: "over", label: "Ran over / early", color: "text-orange-400", bg: "bg-orange-500/10" },
            { key: "early", label: "Started early", color: "text-blue-400", bg: "bg-blue-500/10" },
            { key: "no_hours", label: "No stated hours", color: "text-muted-foreground", bg: "bg-muted/40" },
            { key: "no_activity", label: "No activity", color: "text-muted-foreground", bg: "bg-muted/40" },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setFilterStatus(filterStatus === s.key ? "all" : s.key)}
              className={`rounded-xl p-3 text-left transition-all border ${
                filterStatus === s.key ? "border-primary ring-1 ring-primary" : "border-transparent"
              } ${s.bg}`}
            >
              <div className={`text-2xl font-bold ${s.color}`}>{summary[s.key as StatusKey]}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Select value={filterCoach} onValueChange={setFilterCoach}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All coaches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All coaches</SelectItem>
              {coachNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          {filterStatus !== "all" && (
            <button
              onClick={() => setFilterStatus("all")}
              className="text-xs text-muted-foreground underline self-center"
            >
              Clear filter
            </button>
          )}
        </div>

        {/* Table */}
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-semibold text-foreground">
              {filteredRows.length} day{filteredRows.length !== 1 ? "s" : ""} shown
              {filterCoach !== "all" && ` · ${filterCoach}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
            ) : filteredRows.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No data for this period.</div>
            ) : (
              <div className="divide-y divide-border">
                {filteredRows.map(row => {
                  const rowKey = `${row.coachId}|${row.date}`;
                  const expanded = expandedRows.has(rowKey);
                  const blocks = parseWorkingHours(row.workingHours);
                  const statedStart = blocks.length > 0 ? Math.min(...blocks.map(b => b.start)) : null;
                  const statedEnd = blocks.length > 0 ? Math.max(...blocks.map(b => b.end)) : null;

                  return (
                    <div key={rowKey}>
                      {/* Main row */}
                      <button
                        className="w-full text-left px-5 py-4 hover:bg-muted/30 transition-colors"
                        onClick={() => toggleRow(rowKey)}
                      >
                        <div className="grid grid-cols-[1fr_auto] gap-4 items-center">
                          <div className="grid grid-cols-[120px_140px_1fr_1fr_1fr_auto] gap-4 items-center min-w-0">
                            {/* Date */}
                            <span className="text-sm font-medium text-foreground">{fmtDate(row.date)}</span>

                            {/* Coach */}
                            <span className="text-sm text-muted-foreground truncate">{row.coachName}</span>

                            {/* Stated hours */}
                            <div className="text-sm">
                              {row.workingHours ? (
                                <span className="text-foreground font-mono">{row.workingHours}</span>
                              ) : (
                                <span className="text-muted-foreground italic">Not stated</span>
                              )}
                            </div>

                            {/* First / Last check-in */}
                            <div className="text-sm">
                              {row.firstCheckIn ? (
                                <span className="font-mono text-foreground">
                                  {fmtTime(row.firstCheckIn)}
                                  {row.firstCheckIn !== row.lastCheckIn && (
                                    <span className="text-muted-foreground"> → {fmtTime(row.lastCheckIn!)}</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">No activity</span>
                              )}
                            </div>

                            {/* Duration */}
                            <div className="text-sm text-muted-foreground font-mono">
                              {fmtDuration(row.durationMins)}
                              {row.checkInCount > 0 && (
                                <span className="ml-1 text-xs">({row.checkInCount} check-ins)</span>
                              )}
                            </div>

                            {/* Status badge */}
                            <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${row.status.bgColor} ${row.status.color}`}>
                              {row.status.icon}
                              {row.status.label}
                            </div>
                          </div>

                          {/* Expand toggle */}
                          <div className="text-muted-foreground">
                            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                        </div>

                        {/* Status detail line */}
                        {row.status.key !== "within" && row.status.key !== "no_hours" && row.status.key !== "no_activity" && (
                          <div className={`mt-1.5 text-xs ml-0 ${row.status.color} opacity-80`}>
                            {row.status.detail}
                            {statedStart !== null && statedEnd !== null && (
                              <span className="text-muted-foreground ml-2">
                                (stated: {fmtMins(statedStart)} – {fmtMins(statedEnd)})
                              </span>
                            )}
                          </div>
                        )}
                      </button>

                      {/* Expanded detail */}
                      {expanded && (
                        <div className="px-5 pb-4 bg-muted/20 border-t border-border/50 space-y-3">
                          {/* Action plan */}
                          {row.actionPlan && (
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Action Plan</div>
                              <div className="text-sm text-foreground bg-card rounded-lg p-3 border border-border">
                                {row.actionPlan}
                              </div>
                            </div>
                          )}

                          {/* Notes */}
                          {row.morningNotes && (
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Morning Notes</div>
                              <div className="text-sm text-foreground bg-card rounded-lg p-3 border border-border">
                                {row.morningNotes}
                              </div>
                            </div>
                          )}

                          {/* All timestamps */}
                          {row.allTimestamps.length > 0 && (
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                All Check-In Times ({row.allTimestamps.length})
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {row.allTimestamps.map((ts: Date, i: number) => {
                                  const mins = toLocalMins(ts);
                                  const outsideWindow = statedStart !== null && statedEnd !== null &&
                                    (mins < statedStart - 5 || mins > statedEnd + 5);
                                  return (
                                    <span
                                      key={i}
                                      className={`text-xs font-mono px-2 py-1 rounded ${
                                        outsideWindow
                                          ? "bg-orange-500/20 text-orange-300"
                                          : "bg-muted text-muted-foreground"
                                      }`}
                                    >
                                      {fmtTime(ts)}
                                    </span>
                                  );
                                })}
                              </div>
                              {statedStart !== null && statedEnd !== null && (
                                <div className="mt-2 text-xs text-muted-foreground">
                                  Stated window: <span className="font-mono">{fmtMins(statedStart)} – {fmtMins(statedEnd)}</span>
                                  <span className="ml-2 text-orange-400">Orange = outside window</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Mood */}
                          {row.moodScore && (
                            <div className="text-xs text-muted-foreground">
                              Mood: {["", "😞 Not good", "😕 Below average", "😐 Okay", "🙂 Good", "😄 Amazing"][row.moodScore]}
                            </div>
                          )}
                        </div>
                      )}
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
