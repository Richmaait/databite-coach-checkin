import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type Rating = "green" | "yellow" | "red";

interface ClientEntry {
  clientName: string;
  rating: string;
  notes: string | null;
  updatedAt: string | null;
  consecutiveMissed: number;
  lastMissedWeek: string | null;
}

interface CoachSection {
  coachId: number;
  coachName: string;
  engagement: { scheduled: number; completed: number; pct: number };
  clients: ClientEntry[];
  green: number;
  yellow: number;
  red: number;
  total: number;
}

interface Snapshot {
  generatedAt: string;
  weekStart: string;
  business: { green: number; yellow: number; red: number; total: number; greenPct: number };
  coaches: CoachSection[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const RATING_CONFIG: Record<Rating, { label: string; bg: string; text: string; dot: string; border: string }> = {
  green:  { label: "On Track",  bg: "bg-emerald-500/15", text: "text-emerald-300", dot: "bg-emerald-500", border: "border-emerald-500/30" },
  yellow: { label: "Neutral",   bg: "bg-yellow-400/15",  text: "text-yellow-200",  dot: "bg-yellow-200/80", border: "border-yellow-200/30" },
  red:    { label: "Off Track", bg: "bg-red-400/15",     text: "text-red-400",     dot: "bg-red-400",     border: "border-red-400/30"     },
};

function formatDateAU(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Melbourne" });
}

function formatDateTimeAU(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
    timeZone: "Australia/Melbourne",
  }) + " AEST";
}

function DisengagementBadge({ streak }: { streak: number }) {
  if (streak === 0) return null;
  const color = streak >= 3 ? "bg-red-400/20 text-red-400 border-red-400/40"
    : streak === 2 ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
    : "bg-yellow-400/20 text-yellow-200 border-yellow-200/40";
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${color} font-medium`}>
      {"!".repeat(Math.min(streak, 3))} {streak}w missed
    </span>
  );
}

function RatingBadge({ rating }: { rating: string }) {
  const cfg = RATING_CONFIG[rating as Rating];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Client Row ───────────────────────────────────────────────────────────────
function ClientRow({ client }: { client: ClientEntry }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-white/80">{client.clientName}</span>
          <RatingBadge rating={client.rating} />
          {client.consecutiveMissed > 0 && <DisengagementBadge streak={client.consecutiveMissed} />}
        </div>
        {client.notes && (
          <p className="text-xs text-white/50 mt-1 leading-relaxed">{client.notes}</p>
        )}
      </div>
    </div>
  );
}

// ─── Coach Card ───────────────────────────────────────────────────────────────
function CoachCard({ section }: { section: CoachSection }) {
  const greenClients = section.clients.filter(c => c.rating === "green");
  const yellowClients = section.clients.filter(c => c.rating === "yellow");
  const redClients = section.clients.filter(c => c.rating === "red");

  const engPct = section.engagement.pct;
  const engColor = engPct >= 80 ? "text-emerald-400" : engPct >= 60 ? "text-yellow-200" : "text-red-400";

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
      {/* Coach header */}
      <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-base font-bold text-white/90">{section.coachName}</h3>
        <div className="flex items-center gap-4 text-xs text-white/50">
          {/* Traffic light counts */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-emerald-400 font-semibold">{section.green}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-yellow-200/80" />
              <span className="text-yellow-200 font-semibold">{section.yellow}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              <span className="text-red-400 font-semibold">{section.red}</span>
            </span>
          </div>
          {/* Engagement */}
          {section.engagement.scheduled > 0 && (
            <span className="flex items-center gap-1 border-l border-white/10 pl-4">
              <span className="text-white/30">Engagement:</span>
              <span className={`font-bold ${engColor}`}>{engPct.toFixed(1)}%</span>
              <span className="text-white/20">({section.engagement.completed}/{section.engagement.scheduled})</span>
            </span>
          )}
        </div>
      </div>

      {/* Clients grouped by rating */}
      <div className="divide-y divide-white/[0.06]">
        {redClients.length > 0 && (
          <div className="px-5 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Off Track ({redClients.length})</span>
            </div>
            {redClients.map(c => <ClientRow key={c.clientName} client={c} />)}
          </div>
        )}
        {yellowClients.length > 0 && (
          <div className="px-5 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-yellow-200/80" />
              <span className="text-xs font-semibold uppercase tracking-wider text-yellow-200">Neutral ({yellowClients.length})</span>
            </div>
            {yellowClients.map(c => <ClientRow key={c.clientName} client={c} />)}
          </div>
        )}
        {greenClients.length > 0 && (
          <div className="px-5 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">On Track ({greenClients.length})</span>
            </div>
            {greenClients.map(c => <ClientRow key={c.clientName} client={c} />)}
          </div>
        )}
        {section.total === 0 && (
          <div className="px-5 py-4 text-sm text-white/30 italic">No ratings recorded for this coach.</div>
        )}
      </div>
    </div>
  );
}

// ─── Business Summary ─────────────────────────────────────────────────────────
function BusinessSummary({ snapshot }: { snapshot: Snapshot }) {
  const { business } = snapshot;
  const onTrackPct = business.greenPct;
  const onTrackColor = onTrackPct >= 70 ? "text-emerald-400" : onTrackPct >= 50 ? "text-yellow-200" : "text-red-400";

  // Count disengaged clients across all coaches
  const disengagedCount = snapshot.coaches.reduce((sum, c) =>
    sum + c.clients.filter(cl => cl.consecutiveMissed > 0).length, 0);

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50 mb-4">Business-Wide Summary</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="text-center">
          <div className={`text-3xl font-bold ${onTrackColor}`}>{onTrackPct.toFixed(1)}%</div>
          <div className="text-xs text-white/30 mt-1">On Track</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-emerald-400">{business.green}</div>
          <div className="text-xs text-white/30 mt-1">Green</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-yellow-200">{business.yellow}</div>
          <div className="text-xs text-white/30 mt-1">Neutral</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-red-400">{business.red}</div>
          <div className="text-xs text-white/30 mt-1">Off Track</div>
        </div>
      </div>
      {/* Progress bar */}
      <div className="mt-5 relative h-3 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${Math.min(onTrackPct, 100)}%` }}
        />
        {/* 70% target line */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-white/40" style={{ left: "70%" }} />
      </div>
      <div className="flex justify-between text-xs text-white/30 mt-1">
        <span>{business.total} clients rated</span>
        <span>Target: 70% On Track</span>
      </div>
      {disengagedCount > 0 && (
        <div className="mt-4 flex items-center gap-2 text-sm text-yellow-200 bg-yellow-400/10 border border-yellow-200/20 rounded-xl px-4 py-2.5">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span><strong>{disengagedCount} client{disengagedCount !== 1 ? "s" : ""}</strong> with missed check-in streaks</span>
        </div>
      )}
    </div>
  );
}

// ─── Comparison Panel ─────────────────────────────────────────────────────────
function ComparisonPanel({
  currentId,
  previousId,
  onClose,
}: {
  currentId: number;
  previousId: number;
  onClose: () => void;
}) {
  const { data, isLoading, error } = trpc.sweepReport.compare.useQuery(
    { currentId, previousId },
    { retry: false }
  );

  const RATING_LABELS: Record<string, string> = { green: "On Track", yellow: "Neutral", red: "Off Track" };
  const RATING_ARROW: Record<string, { icon: string; color: string; bg: string }> = {
    improved: { icon: "↑", color: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/30" },
    declined:  { icon: "↓", color: "text-red-400",     bg: "bg-red-400/10 border-red-400/30"         },
    unchanged: { icon: "→", color: "text-white/50",    bg: "bg-white/[0.03] border-white/[0.06]"    },
  };

  // Helper: diff value with colour
  const Diff = ({ curr, prev, suffix = "", higherIsBetter = true }: { curr: number; prev: number; suffix?: string; higherIsBetter?: boolean }) => {
    const delta = curr - prev;
    if (Math.abs(delta) < 0.05) return <span className="text-white/30 text-xs">—</span>;
    const positive = higherIsBetter ? delta > 0 : delta < 0;
    const color = positive ? "text-emerald-400" : "text-red-400";
    return (
      <span className={`text-xs font-semibold ${color}`}>
        {delta > 0 ? "+" : ""}{delta.toFixed(1)}{suffix}
      </span>
    );
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden no-print">
      {/* Panel header */}
      <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white/90">Sweep Comparison</h2>
          <p className="text-xs text-white/30 mt-0.5">Side-by-side vs. previous saved report</p>
        </div>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/70 transition-colors p-1 rounded-lg hover:bg-white/5"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-10 gap-3">
          <div className="h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-white/50">Loading comparison…</span>
        </div>
      )}

      {error && (
        <div className="px-5 py-6 text-sm text-red-400">Failed to load comparison data.</div>
      )}

      {data && (
        <div className="p-5 space-y-6">
          {/* Side-by-side metrics */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-3">Business Metrics</h3>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {/* Header row */}
              <div className="text-white/30 font-medium"></div>
              <div className="text-center">
                <div className="text-white/50 font-semibold truncate" title={data.previous.title}>Previous</div>
                <div className="text-white/20 text-[10px] mt-0.5">
                  {new Date(data.previous.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Melbourne" })}
                </div>
              </div>
              <div className="text-center">
                <div className="text-white/90 font-semibold truncate" title={data.current.title}>Current</div>
                <div className="text-white/30 text-[10px] mt-0.5">
                  {new Date(data.current.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Melbourne" })}
                </div>
              </div>

              {/* On Track % */}
              <div className="text-white/50 flex items-center gap-1.5 py-2 border-t border-white/[0.08]">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" /> On Track %
              </div>
              <div className="text-center py-2 border-t border-white/[0.08]">
                <span className={`font-bold ${data.previous.business.greenPct >= 70 ? "text-emerald-400" : data.previous.business.greenPct >= 50 ? "text-yellow-200" : "text-red-400"}`}>
                  {data.previous.business.greenPct.toFixed(1)}%
                </span>
              </div>
              <div className="text-center py-2 border-t border-white/[0.08] flex flex-col items-center gap-0.5">
                <span className={`font-bold ${data.current.business.greenPct >= 70 ? "text-emerald-400" : data.current.business.greenPct >= 50 ? "text-yellow-200" : "text-red-400"}`}>
                  {data.current.business.greenPct.toFixed(1)}%
                </span>
                <Diff curr={data.current.business.greenPct} prev={data.previous.business.greenPct} suffix="%" />
              </div>

              {/* Green */}
              <div className="text-white/50 flex items-center gap-1.5 py-2 border-t border-white/[0.08]">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" /> Green
              </div>
              <div className="text-center py-2 border-t border-white/[0.08] text-emerald-400 font-bold">{data.previous.business.green}</div>
              <div className="text-center py-2 border-t border-white/[0.08] flex flex-col items-center gap-0.5">
                <span className="text-emerald-400 font-bold">{data.current.business.green}</span>
                <Diff curr={data.current.business.green} prev={data.previous.business.green} />
              </div>

              {/* Neutral */}
              <div className="text-white/50 flex items-center gap-1.5 py-2 border-t border-white/[0.08]">
                <span className="h-2 w-2 rounded-full bg-yellow-200/80 shrink-0" /> Neutral
              </div>
              <div className="text-center py-2 border-t border-white/[0.08] text-yellow-200 font-bold">{data.previous.business.yellow}</div>
              <div className="text-center py-2 border-t border-white/[0.08] flex flex-col items-center gap-0.5">
                <span className="text-yellow-200 font-bold">{data.current.business.yellow}</span>
                <Diff curr={data.current.business.yellow} prev={data.previous.business.yellow} higherIsBetter={false} />
              </div>

              {/* Off Track */}
              <div className="text-white/50 flex items-center gap-1.5 py-2 border-t border-white/[0.08]">
                <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" /> Off Track
              </div>
              <div className="text-center py-2 border-t border-white/[0.08] text-red-400 font-bold">{data.previous.business.red}</div>
              <div className="text-center py-2 border-t border-white/[0.08] flex flex-col items-center gap-0.5">
                <span className="text-red-400 font-bold">{data.current.business.red}</span>
                <Diff curr={data.current.business.red} prev={data.previous.business.red} higherIsBetter={false} />
              </div>

              {/* Engagement */}
              <div className="text-white/50 flex items-center gap-1.5 py-2 border-t border-white/[0.08]">
                <span className="h-2 w-2 rounded-full bg-blue-400 shrink-0" /> Engagement
              </div>
              <div className="text-center py-2 border-t border-white/[0.08]">
                <span className={`font-bold ${data.previous.engagementPct >= 80 ? "text-emerald-400" : data.previous.engagementPct >= 60 ? "text-yellow-200" : "text-red-400"}`}>
                  {data.previous.engagementPct.toFixed(1)}%
                </span>
              </div>
              <div className="text-center py-2 border-t border-white/[0.08] flex flex-col items-center gap-0.5">
                <span className={`font-bold ${data.current.engagementPct >= 80 ? "text-emerald-400" : data.current.engagementPct >= 60 ? "text-yellow-200" : "text-red-400"}`}>
                  {data.current.engagementPct.toFixed(1)}%
                </span>
                <Diff curr={data.current.engagementPct} prev={data.previous.engagementPct} suffix="%" />
              </div>
            </div>
          </div>

          {/* Status Changes */}
          {data.changes.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-3">
                Status Changes ({data.changes.length})
              </h3>
              <div className="space-y-1.5">
                {data.changes.map((change, i) => {
                  const cfg = RATING_ARROW[change.direction];
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-xs ${cfg.bg}`}
                    >
                      <span className={`text-base font-bold w-4 text-center shrink-0 ${cfg.color}`}>{cfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-white/80">{change.clientName}</span>
                        <span className="text-white/30 ml-1.5">({change.coachName})</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <RatingBadge rating={change.from} />
                        <svg className="h-3 w-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                        <RatingBadge rating={change.to} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data.changes.length === 0 && (
            <div className="text-sm text-white/30 italic text-center py-4">
              No status changes between these two reports.
            </div>
          )}

          {/* New / Removed clients */}
          {(data.newClients.length > 0 || data.removedClients.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.newClients.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-2">New Clients ({data.newClients.length})</h3>
                  <div className="space-y-1">
                    {data.newClients.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                        <span className="text-white/70 font-medium">{c.clientName}</span>
                        <span className="text-white/30">({c.coachName})</span>
                        <RatingBadge rating={c.rating} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {data.removedClients.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-2">No Longer Listed ({data.removedClients.length})</h3>
                  <div className="space-y-1">
                    {data.removedClients.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                        <span className="text-white/50 font-medium line-through">{c.clientName}</span>
                        <span className="text-white/30">({c.coachName})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SweepReportPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const reportId = parseInt(params.id ?? "0", 10);
  const printRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data, isLoading, error, refetch } = trpc.sweepReport.getById.useQuery(
    { id: reportId },
    { enabled: reportId > 0, retry: false }
  );

  // Fetch saved reports list to find the previous one for comparison
  const { data: savedReports } = trpc.sweepReport.listSaved.useQuery(undefined, {
    staleTime: 60 * 1000,
  });

  // Find the previous saved report (the one just before this one in the saved list)
  const previousReport = savedReports
    ? (() => {
        const idx = savedReports.findIndex(r => r.id === reportId);
        // savedReports is newest-first; so the "previous" is the next index
        if (idx === -1) {
          // current report may not be saved yet — find the most recent saved one
          return savedReports[0] ?? null;
        }
        return savedReports[idx + 1] ?? null;
      })()
    : null;

  const [showComparison, setShowComparison] = useState(false);

  const [saved, setSaved] = useState(false);
  const saveMutation = trpc.sweepReport.save.useMutation({
    onSuccess: () => {
      setSaved(true);
      toast.success("Report saved to history!");
      refetch();
    },
    onError: (err) => toast.error(err.message ?? "Failed to save report"),
  });

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    const btn = document.getElementById("copy-link-btn");
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => { if (btn) btn.textContent = orig; }, 2000);
    }
  };

  if (!reportId || isNaN(reportId)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center">
        <div className="glass p-8 text-center">
          <p className="text-white/50 text-lg">Invalid report ID.</p>
          <button onClick={() => setLocation("/client-progress")} className="mt-4 text-sm text-violet-400 hover:underline">
            ← Back to Client Progress
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center">
        <div className="glass p-8 flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/50 text-sm">Loading report…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center">
        <div className="glass p-8 text-center">
          <p className="text-white/50 text-lg">Report not found.</p>
          <button onClick={() => setLocation("/client-progress")} className="mt-4 text-sm text-violet-400 hover:underline">
            ← Back to Client Progress
          </button>
        </div>
      </div>
    );
  }

  // Transform raw DB snapshot into the expected Snapshot shape
  const snapshot: Snapshot = (() => {
    const raw = (data as any).snapshotJson ?? (data as any).snapshot ?? {};
    const rawCoaches: any[] = raw.coaches ?? [];

    let totalGreen = 0, totalYellow = 0, totalRed = 0, totalRated = 0;
    const coachSections: CoachSection[] = rawCoaches.map((c: any) => {
      const ratingDetails: any[] = c.ratingDetails ?? [];
      const clients: ClientEntry[] = ratingDetails.map((rd: any) => ({
        name: rd.clientName,
        rating: rd.rating as Rating,
        notes: rd.notes ?? null,
        streak: 0,
      }));

      const g = c.ratings?.green ?? clients.filter(cl => cl.rating === "green").length;
      const y = c.ratings?.yellow ?? clients.filter(cl => cl.rating === "yellow").length;
      const r = c.ratings?.red ?? clients.filter(cl => cl.rating === "red").length;
      totalGreen += g; totalYellow += y; totalRed += r; totalRated += g + y + r;

      return {
        coachId: c.coachId,
        coachName: c.coachName,
        engagement: { scheduled: c.scheduled ?? 0, completed: c.completed ?? 0, pct: c.pct ?? 0 },
        clients,
        green: g,
        yellow: y,
        red: r,
        total: g + y + r,
      };
    });

    const greenPct = totalRated > 0 ? Math.round((totalGreen / totalRated) * 1000) / 10 : 0;

    return {
      generatedAt: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString(),
      weekStart: data.weekStart ?? "",
      business: { green: totalGreen, yellow: totalYellow, red: totalRed, total: totalRated, greenPct },
      coaches: coachSections,
    };
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white/90">
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 { background: white !important; }
          .bg-white/[0.03] { background: #f9fafb !important; border-color: #e5e7eb !important; }
          .bg-white/5 { background: #f3f4f6 !important; }
          .text-white/90, .text-white/80, .text-white/70 { color: #111827 !important; }
          .text-white/50, .text-white/30 { color: #6b7280 !important; }
          .border-white/[0.08], .border-white/10 { border-color: #e5e7eb !important; }
        }
      `}</style>

      <div ref={printRef} className="max-w-4xl mx-auto px-4 pt-8 pb-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-2xl font-bold text-white/90" style={{ fontFamily: "'Comfortaa', cursive" }}>{data.title}</h1>
                {data.scopeType === "coach" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                    1-on-1: {((data as any).scopeCoachName) || (snapshot.coaches.find(c => c.coachId === (data as any).scopeCoachId)?.coachName) || "Coach"}
                  </span>
                )}
                {(!data.scopeType || data.scopeType === "all") && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/50 border border-white/10">
                    All Coaches
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-white/50">
                {data.weekStart && (
                  <span>Week of {formatDateAU(data.weekStart)}</span>
                )}
                <span>Generated {formatDateTimeAU(snapshot.generatedAt)}</span>
                {data.createdByName && (
                  <span>by {data.createdByName}</span>
                )}
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-2 no-print flex-wrap">
              {isAdmin && !data.isSaved && !saved && (
                <button
                  onClick={() => saveMutation.mutate({ id: reportId })}
                  disabled={saveMutation.isPending}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white transition-colors font-semibold shadow-lg shadow-violet-500/20"
                >
                  {saveMutation.isPending ? (
                    <><span className="h-3.5 w-3.5 border-2 border-emerald-300/40 border-t-emerald-100 rounded-full animate-spin" /> Saving…</>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Save Report
                    </>
                  )}
                </button>
              )}
              {(data.isSaved || saved) && (
                <span className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl glass-btn text-emerald-400">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Saved
                </span>
              )}
              {/* Compare button — shown when a previous saved report exists */}
              {previousReport && previousReport.id !== reportId && (
                <button
                  onClick={() => setShowComparison(v => !v)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-colors font-medium ${
                    showComparison
                      ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-500/20"
                      : "glass-btn text-white/70"
                  }`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                  {showComparison ? "Hide Comparison" : "Compare to Previous"}
                </button>
              )}
              <button
                id="copy-link-btn"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl glass-btn text-white/70"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                </svg>
                Copy Link
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white transition-colors font-medium shadow-lg shadow-violet-500/20"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
                </svg>
                Print / Save PDF
              </button>
              <button
                onClick={() => setLocation("/client-progress")}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl glass-btn text-white/50 no-print"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>

        {/* Comparison Panel */}
        {showComparison && previousReport && (
          <div className="mb-6">
            <ComparisonPanel
              currentId={reportId}
              previousId={previousReport.id}
              onClose={() => setShowComparison(false)}
            />
          </div>
        )}

        {/* Business Summary */}
        <div className="mb-6">
          <BusinessSummary snapshot={snapshot} />
        </div>

        {/* Per-coach sections */}
        <div className="flex flex-col gap-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">
            Per-Coach Breakdown
          </h2>
          {snapshot.coaches.map(section => (
            <CoachCard key={section.coachId} section={section} />
          ))}
          {snapshot.coaches.length === 0 && (
            <p className="text-sm text-white/30 italic">No coach data available in this report.</p>
          )}
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-white/[0.08] text-xs text-white/20 flex justify-between flex-wrap gap-2">
          <span>Databite Coach — Post-Sweep Report</span>
          <span>Generated {formatDateTimeAU(snapshot.generatedAt)}</span>
        </div>
      </div>
    </div>
  );
}
