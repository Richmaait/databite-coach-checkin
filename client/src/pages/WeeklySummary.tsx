import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Download, FileBarChart2, Loader2 } from "lucide-react";
import { useRef, useMemo, useState } from "react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CLIENT_CHECKINS_EPOCH = "2026-03-02";

function getMondayOf(date: Date): string {
  const d = new Date(date);
  const dow = d.getUTCDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - daysFromMon);
  return d.toISOString().slice(0, 10);
}

function generateWeekOptions(): Array<{ value: string; label: string }> {
  const weeks: string[] = [];
  const today = new Date();
  let current = new Date(getMondayOf(today) + "T00:00:00Z");
  const epoch = new Date(CLIENT_CHECKINS_EPOCH + "T00:00:00Z");
  while (current >= epoch) {
    weeks.push(current.toISOString().slice(0, 10));
    current = new Date(current);
    current.setUTCDate(current.getUTCDate() - 7);
  }
  return weeks.map(w => {
    const start = new Date(w + "T00:00:00Z");
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 4);
    const fmt = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });
    const isCurrentWeek = w === getMondayOf(new Date());
    return {
      value: w,
      label: `${fmt(start)} – ${fmt(end)}${isCurrentWeek ? " (This week)" : ""}`,
    };
  });
}

function streakBangs(n: number): string {
  return "!".repeat(Math.min(n, 4));
}

function engagementColor(pct: number): string {
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 60) return "text-amber-400";
  return "text-red-400";
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WeeklySummary() {
  const weekOptions = useMemo(() => generateWeekOptions(), []);
  // Default to the previous week (index 1) so the summary always shows a completed week.
  // The current week (index 0) has no disengagement data until days have passed.
  const [selectedWeek, setSelectedWeek] = useState(() => weekOptions[1]?.value ?? weekOptions[0]?.value ?? "");
  const [exporting, setExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = trpc.performance.getWeeklySummary.useQuery(
    { weekStart: selectedWeek },
    { enabled: !!selectedWeek, staleTime: 5 * 60 * 1000 }
  );

  const selectedLabel = weekOptions.find(w => w.value === selectedWeek)?.label ?? selectedWeek;

  const handleExportPDF = async () => {
    if (!data || !selectedWeek) return;
    setExporting(true);
    try {
      // Use the server-side PDF endpoint — avoids html2canvas oklch() incompatibility
      const response = await fetch(`/api/weekly-summary-pdf?weekStart=${encodeURIComponent(selectedWeek)}`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "PDF generation failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const weekLabel = selectedLabel.replace(/\s*\(.*\)/, "").replace(/[^\w\s–-]/g, "").replace(/\s+/g, "_");
      a.download = `Weekly_Summary_${weekLabel}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <FileBarChart2 className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold text-foreground">Weekly Summary</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Key metrics for the selected week — ready to share with the team.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-full sm:w-72">
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger className="h-9 text-sm bg-card border-border">
                  <SelectValue placeholder="Select week…" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {weekOptions.map(w => (
                    <SelectItem key={w.value} value={w.value} className="text-sm">{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {data && !isLoading && (
              <Button
                onClick={handleExportPDF}
                disabled={exporting}
                size="sm"
                className="shrink-0 gap-2"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {exporting ? "Exporting…" : "Export PDF"}
              </Button>
            )}
          </div>
        </div>

        {isLoading && (
          <div className="py-24 text-center text-muted-foreground text-sm">
            <Loader2 className="mx-auto mb-3 h-8 w-8 opacity-30 animate-spin" />
            Loading summary…
          </div>
        )}

        {error && (
          <div className="py-16 text-center text-destructive text-sm">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6" />
            Failed to load summary. Please try again.
          </div>
        )}

        {data && !isLoading && (
          /* ── Printable content area — dark theme ── */
          <div
            ref={printRef}
            className="space-y-6 rounded-xl p-6"
            style={{ background: "#0f172a", color: "#e2e8f0" }}
          >

            {/* PDF Header */}
            <div style={{ borderBottom: "1px solid #1e293b", paddingBottom: "16px" }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
                    Weekly Summary Report
                  </h2>
                  <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>{selectedLabel}</p>
                </div>
                <div style={{ textAlign: "right", fontSize: "11px", color: "#475569" }}>
                  <div>Coach Check-In Tracker</div>
                  <div>{new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}</div>
                </div>
              </div>
            </div>

            {/* ── Top stat cards ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
              <StatCard
                label="Check-ins Completed"
                value={`${data.totalCompleted}`}
                sub={`of ${data.totalScheduled} scheduled`}
                accent="#10b981"
              />
              <StatCard
                label="Overall Engagement"
                value={`${data.overallEngagementPct}%`}
                sub={data.overallEngagementPct >= 80 ? "On track" : data.overallEngagementPct >= 60 ? "Needs attention" : "Below target"}
                accent={data.overallEngagementPct >= 80 ? "#10b981" : data.overallEngagementPct >= 60 ? "#f59e0b" : "#ef4444"}
                trend={data.engagementTrend}
                trendLabel="%"
                trendPositiveIsGood={true}
              />
              <StatCard
                label="Disengaged Clients"
                value={`${(data.disengagedThisWeek ?? []).length}`}
                sub={data.disengagedTrend !== null && data.disengagedTrend !== undefined
                  ? `${data.disengagedTrend < 0 ? Math.abs(data.disengagedTrend) + " fewer" : data.disengagedTrend > 0 ? data.disengagedTrend + " more" : "same"} than last week`
                  : "missed this week"}
                accent={(data.disengagedThisWeek ?? []).length === 0 ? "#10b981" : "#f59e0b"}
                trend={data.disengagedTrend}
                trendPositiveIsGood={false}
              />

            </div>

            {/* ── Coach Activity ── */}
            <Section title="Coach Activity" subtitle="Daily submissions and outreach messages sent this week.">
              <DarkTable
                headers={["Coach", "Morning Reviews", "Follow-Up Days", "Follow-Up Msgs", "Disengagement Msgs"]}
                rows={(data.coachActivity ?? []).map(c => [
                  <span style={{ fontWeight: 600, color: "#f1f5f9" }}>{c.coachName}</span>,
                  <span>
                    <span style={{ fontWeight: 700, color: c.morningDays >= (c as any).workdayCount ? "#10b981" : c.morningDays >= Math.ceil((c as any).workdayCount / 2) ? "#f59e0b" : "#ef4444" }}>
                      {c.morningDays}
                    </span>
                    <span style={{ color: "#475569", fontSize: "12px" }}> / {(c as any).workdayCount ?? 5}</span>
                  </span>,
                  c.followupDays,
                  c.totalFollowupMsgs,
                  c.totalDisengagementMsgs,
                ])}
                emptyMessage="No activity recorded."
              />
            </Section>

            {/* ── Client Engagement ── */}
            <Section title="Client Engagement by Coach" subtitle="Scheduled vs completed check-ins per coach this week.">
              <DarkTable
                headers={["Coach", "Scheduled", "Completed", "Missed", "Engagement %"]}
                rows={[
                  ...(data.engagementStats ?? []).filter(e => e.scheduled > 0).map(e => [
                    <span style={{ fontWeight: 600, color: "#f1f5f9" }}>{e.coachName}</span>,
                    e.scheduled,
                    <span style={{ fontWeight: 600, color: "#10b981" }}>{e.completed}</span>,
                    <span style={{ fontWeight: 600, color: "#ef4444" }}>{e.missed}</span>,
                    <span style={{ fontWeight: 700, fontSize: "16px", color: e.engagementPct >= 80 ? "#10b981" : e.engagementPct >= 60 ? "#f59e0b" : "#ef4444" }}>
                      {e.engagementPct}%
                    </span>,
                  ]),
                  // Totals row
                  ...((data.engagementStats ?? []).filter(e => e.scheduled > 0).length > 0 ? [[
                    <span style={{ fontWeight: 700, color: "#94a3b8" }}>Total</span>,
                    <span style={{ fontWeight: 700 }}>{data.totalScheduled}</span>,
                    <span style={{ fontWeight: 700, color: "#10b981" }}>{data.totalCompleted}</span>,
                    <span style={{ fontWeight: 700, color: "#ef4444" }}>{data.totalScheduled - data.totalCompleted}</span>,
                    <span style={{ fontWeight: 700, fontSize: "16px", color: data.overallEngagementPct >= 80 ? "#10b981" : data.overallEngagementPct >= 60 ? "#f59e0b" : "#ef4444" }}>
                      {data.overallEngagementPct}%
                    </span>,
                  ]] : []),
                ]}
                emptyMessage="No engagement data recorded."
                lastRowHighlight
              />
            </Section>

            {/* ── Two-column: Disengaged + Client Health ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

              {/* Disengaged Clients — grouped by coach */}
              <div style={{ border: "1px solid #1e293b", borderRadius: "8px", overflow: "hidden" }}>
                <div style={{ background: "#1e293b", padding: "12px 16px", borderBottom: "1px solid #334155", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "#f1f5f9", fontSize: "13px" }}>Disengaged Clients This Week</div>
                    <div style={{ color: "#64748b", fontSize: "11px", marginTop: "2px" }}>! = consecutive misses · grouped by coach</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "18px", color: (data.disengagedThisWeek ?? []).length === 0 ? "#10b981" : "#f59e0b" }}>
                    {(data.disengagedThisWeek ?? []).length}
                  </div>
                </div>
                <div style={{ padding: "12px 16px" }}>
                  {(data.disengagedThisWeek ?? []).length === 0 ? (
                    <div style={{ textAlign: "center", color: "#475569", fontSize: "13px", padding: "16px 0" }}>
                      No disengaged clients this week ✓
                    </div>
                  ) : (() => {
                    // Group by coachName, preserving order of first appearance
                    const coachOrder: string[] = [];
                    const disengagedList = data.disengagedThisWeek ?? [];
                    const byCoach: Record<string, typeof disengagedList> = {};
                    for (const c of disengagedList) {
                      if (!byCoach[c.coachName]) { coachOrder.push(c.coachName); byCoach[c.coachName] = []; }
                      byCoach[c.coachName].push(c);
                    }
                    // Tier colour helper matching the disengagement tracker
                    const tierStyle = (n: number) =>
                      n >= 3
                        ? { bg: "rgba(69,10,10,0.5)", border: "rgba(185,28,28,0.6)", text: "#fca5a5", dot: "#ef4444", label: "Critical" }
                        : n === 2
                        ? { bg: "rgba(67,20,7,0.4)", border: "rgba(194,65,12,0.5)", text: "#fdba74", dot: "#f97316", label: "Alert" }
                        : { bg: "rgba(66,32,6,0.3)", border: "rgba(161,98,7,0.4)", text: "#fde68a", dot: "#eab308", label: "Warning" };

                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        {coachOrder.map(coachName => {
                          const clients = byCoach[coachName];
                          // Sort: critical first, then alert, then warning
                          const sorted = [...clients].sort((a, b) => b.consecutiveMissed - a.consecutiveMissed);
                          // Group into tiers
                          const critical = sorted.filter(c => c.consecutiveMissed >= 3);
                          const alert    = sorted.filter(c => c.consecutiveMissed === 2);
                          const warning  = sorted.filter(c => c.consecutiveMissed === 1);
                          return (
                            <div key={coachName}>
                              {/* Coach header */}
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                                <span style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>{coachName}</span>
                                <span style={{ fontSize: "11px", color: "#475569", background: "#1e293b", borderRadius: "999px", padding: "1px 8px" }}>{clients.length} client{clients.length !== 1 ? "s" : ""}</span>
                              </div>
                              {/* Tier sections */}
                              {([critical, alert, warning] as const).map((group, gi) => {
                                if (group.length === 0) return null;
                                const firstTs = tierStyle(gi === 0 ? 3 : gi === 1 ? 2 : 1);
                                return (
                                  <div key={gi} style={{ marginBottom: gi < 2 ? "6px" : 0 }}>
                                    {/* Tier label row */}
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                                      <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: firstTs.dot, flexShrink: 0 }} />
                                      <span style={{ fontSize: "9px", fontWeight: 700, color: firstTs.dot, textTransform: "uppercase", letterSpacing: "0.1em" }}>{firstTs.label}</span>
                                      <div style={{ flex: 1, height: "1px", background: firstTs.border }} />
                                    </div>
                                    {/* Client cards */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                      {group.map((c, i) => {
                                        const ts = tierStyle(c.consecutiveMissed);
                                        const bangs = "!".repeat(Math.min(c.consecutiveMissed, 4));
                                        return (
                                          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", borderRadius: "4px", background: ts.bg, border: `1px solid ${ts.border}` }}>
                                            <span style={{ fontSize: "11px", fontWeight: 500, color: ts.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>{c.clientName}</span>
                                            <span style={{ fontWeight: 700, letterSpacing: "2px", fontSize: "11px", color: ts.text, flexShrink: 0 }}>{bangs}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Client Health */}
              <div style={{ border: "1px solid #1e293b", borderRadius: "8px", overflow: "hidden" }}>
                <div style={{ background: "#1e293b", padding: "12px 16px", borderBottom: "1px solid #334155" }}>
                  <div style={{ fontWeight: 600, color: "#f1f5f9", fontSize: "13px" }}>Client Health Snapshot</div>
                  <div style={{ color: "#64748b", fontSize: "11px", marginTop: "2px" }}>Current traffic light ratings</div>
                </div>
                <div style={{ padding: "16px" }}>
                  {(data.clientHealth?.total ?? 0) === 0 ? (
                    <div style={{ textAlign: "center", color: "#475569", fontSize: "13px", padding: "16px 0" }}>
                      No ratings recorded yet.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                        <span style={{ fontSize: "36px", fontWeight: 700, color: (data.clientHealth?.greenPct ?? 0) >= 70 ? "#10b981" : (data.clientHealth?.greenPct ?? 0) >= 50 ? "#f59e0b" : "#ef4444" }}>
                          {data.clientHealth?.greenPct ?? 0}%
                        </span>
                        <span style={{ fontSize: "13px", color: "#64748b" }}>clients on track</span>
                      </div>
                      <div style={{ height: "10px", borderRadius: "999px", background: "#1e293b", overflow: "hidden", display: "flex" }}>
                        <div style={{ background: "#10b981", width: `${data.clientHealth?.greenPct ?? 0}%` }} />
                        <div style={{ background: "#f59e0b", width: `${(data.clientHealth?.total ?? 0) > 0 ? Math.round((data.clientHealth?.yellow ?? 0) / (data.clientHealth?.total ?? 1) * 100) : 0}%` }} />
                        <div style={{ background: "#ef4444", width: `${(data.clientHealth?.total ?? 0) > 0 ? Math.round((data.clientHealth?.red ?? 0) / (data.clientHealth?.total ?? 1) * 100) : 0}%` }} />
                      </div>
                      <div style={{ display: "flex", gap: "20px", fontSize: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981" }} />
                          <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{data.clientHealth?.green ?? 0}</span>
                          <span style={{ color: "#64748b" }}>On track</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b" }} />
                          <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{data.clientHealth?.yellow ?? 0}</span>
                          <span style={{ color: "#64748b" }}>At risk</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444" }} />
                          <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{data.clientHealth?.red ?? 0}</span>
                          <span style={{ color: "#64748b" }}>Needs attention</span>
                        </div>
                      </div>
                      <div style={{ fontSize: "11px", color: "#475569" }}>{data.clientHealth?.total ?? 0} clients rated in total.</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ borderTop: "1px solid #1e293b", paddingTop: "12px", textAlign: "center", fontSize: "11px", color: "#475569" }}>
              Coach Check-In Tracker · {selectedLabel}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent, trend, trendLabel, trendPositiveIsGood = true }: {
  label: string; value: string; sub?: string; accent: string;
  trend?: number | null; trendLabel?: string; trendPositiveIsGood?: boolean;
}) {
  const trendGood = trend !== null && trend !== undefined
    ? (trendPositiveIsGood ? trend > 0 : trend < 0)
    : null;
  const trendNeutral = trend === 0;
  const trendColor = trendNeutral ? "#64748b" : trendGood ? "#10b981" : "#ef4444";
  const trendArrow = trend === null || trend === undefined ? null
    : trend > 0 ? "↑" : trend < 0 ? "↓" : "→";
  return (
    <div style={{ borderRadius: "8px", border: `1px solid ${accent}33`, background: `${accent}11`, padding: "12px" }}>
      <div style={{ fontSize: "11px", fontWeight: 500, color: "#94a3b8", marginBottom: "4px" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
        <div style={{ fontSize: "24px", fontWeight: 700, color: accent }}>{value}</div>
        {trendArrow !== null && trend !== undefined && trend !== null && (
          <div style={{ fontSize: "13px", fontWeight: 600, color: trendColor }}>
            {trendArrow}{Math.abs(trend)}{trendLabel ?? ""}
          </div>
        )}
      </div>
      {sub && <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{sub}</div>}
    </div>
  );
}

function Section({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ marginBottom: "8px" }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "#f1f5f9" }}>{title}</div>
        {subtitle && <div style={{ fontSize: "11px", color: "#64748b" }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function DarkTable({ headers, rows, emptyMessage, lastRowHighlight }: {
  headers: string[];
  rows: Array<Array<React.ReactNode | string | number>>;
  emptyMessage: string;
  lastRowHighlight?: boolean;
}) {
  const dataRows = lastRowHighlight && rows.length > 1 ? rows.slice(0, -1) : rows;
  const totalRow = lastRowHighlight && rows.length > 1 ? rows[rows.length - 1] : null;

  return (
    <div style={{ border: "1px solid #1e293b", borderRadius: "8px", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
        <thead>
          <tr style={{ background: "#1e293b" }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: "8px 12px", textAlign: i === 0 ? "left" : "center", fontSize: "11px", fontWeight: 600, color: "#64748b", borderBottom: "1px solid #334155" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.length === 0 && (
            <tr>
              <td colSpan={headers.length} style={{ padding: "16px", textAlign: "center", color: "#475569" }}>
                {emptyMessage}
              </td>
            </tr>
          )}
          {dataRows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "#0f172a22", borderBottom: "1px solid #1e293b" }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: "8px 12px", textAlign: ci === 0 ? "left" : "center", color: "#cbd5e1" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {totalRow && (
            <tr style={{ background: "#1e293b", borderTop: "1px solid #334155" }}>
              {totalRow.map((cell, ci) => (
                <td key={ci} style={{ padding: "8px 12px", textAlign: ci === 0 ? "left" : "center", color: "#94a3b8" }}>
                  {cell}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
