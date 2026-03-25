import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

// ─── Types ────────────────────────────────────────────────────────────────────
type Rating = "green" | "yellow" | "red";
const TARGET_PCT = 70;

// ─── Traffic light colour helpers ────────────────────────────────────────────
const RATING_STYLES: Record<Rating, { bg: string; border: string; text: string; label: string }> = {
  green:  { bg: "bg-emerald-500",  border: "border-emerald-600", text: "text-white", label: "On Track"  },
  yellow: { bg: "bg-amber-400",    border: "border-amber-500",   text: "text-white", label: "Neutral"   },
  red:    { bg: "bg-red-500",      border: "border-red-600",     text: "text-white", label: "Off Track"  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// ─── KPI Bar ─────────────────────────────────────────────────────────────────
function KpiBar({ pct, target }: { pct: number; target: number }) {
  const met = pct >= target;
  return (
    <div className="relative h-3 w-full rounded-full bg-zinc-700 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${met ? "bg-emerald-500" : "bg-amber-400"}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white/60"
        style={{ left: `${target}%` }}
      />
    </div>
  );
}

// ─── Traffic Light Picker + Notes Popover ────────────────────────────────────
function RatingPicker({
  current,
  currentNotes,
  onSelect,
  onClear,
  onClose,
}: {
  current: Rating | null;
  currentNotes: string | null;
  onSelect: (r: Rating, notes: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState(currentNotes ?? "");
  const [pendingRating, setPendingRating] = useState<Rating | null>(current);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleSave = () => {
    if (pendingRating) {
      onSelect(pendingRating, notes.trim());
      onClose();
    }
  };

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full left-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl p-3 flex flex-col gap-2 min-w-[220px]"
    >
      {/* Rating options */}
      <div className="flex flex-col gap-1">
        {(["green", "yellow", "red"] as Rating[]).map(r => (
          <button
            key={r}
            onClick={() => setPendingRating(r)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
              ${pendingRating === r ? `${RATING_STYLES[r].bg} ${RATING_STYLES[r].text}` : "text-zinc-300 hover:bg-zinc-700"}`}
          >
            <span className={`h-3 w-3 rounded-full ${RATING_STYLES[r].bg}`} />
            {RATING_STYLES[r].label}
          </button>
        ))}
      </div>

      {/* Notes field */}
      <div className="border-t border-zinc-700 pt-2">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add a note (optional)…"
          maxLength={500}
          rows={2}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-500"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!pendingRating}
          className="flex-1 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          Save
        </button>
        {current && (
          <button
            onClick={() => { onClear(); onClose(); }}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-700 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Client Button ────────────────────────────────────────────────────────────
function ClientButton({
  name,
  rating,
  notes,
  updatedAt,
  onRate,
  onClear,
}: {
  name: string;
  rating: Rating | null;
  notes: string | null;
  updatedAt: Date | null;
  onRate: (r: Rating, notes: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const style = rating ? RATING_STYLES[rating] : null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`
          w-full text-left px-3 py-2.5 rounded-lg border text-sm font-medium
          transition-all duration-150 flex flex-col gap-0.5
          ${style
            ? `${style.bg} ${style.border} ${style.text}`
            : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600"
          }
        `}
      >
        <div className="flex items-center gap-2">
          {style && <span className="h-2 w-2 rounded-full bg-white/70 shrink-0" />}
          <span className="leading-tight truncate flex-1">{name}</span>
          {style && (
            <span className="text-xs opacity-80 shrink-0">{style.label}</span>
          )}
        </div>
        {notes && (
          <span className={`text-xs ${style ? "opacity-75" : "text-zinc-400"} pl-4 leading-snug line-clamp-1`}>
            {notes}
          </span>
        )}
        {updatedAt && (
          <span className={`text-xs ${style ? "opacity-60" : "text-zinc-500"} pl-4`}>
            {formatRelativeTime(updatedAt)}
          </span>
        )}
      </button>
      {open && (
        <RatingPicker
          current={rating}
          currentNotes={notes}
          onSelect={onRate}
          onClear={onClear}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Coach Roster Card ────────────────────────────────────────────────────────
function CoachRosterCard({
  coachId,
  coachName,
  ratings,
  onRate,
  onClear,
  onReset,
}: {
  coachId: number;
  coachName: string;
  ratings: Record<string, { rating: Rating; notes: string | null; updatedAt: Date }>;
  onRate: (coachId: number, clientName: string, rating: Rating, notes: string) => void;
  onClear: (coachId: number, clientName: string) => void;
  onReset: (coachId: number) => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const { data: rosterData, isLoading } = trpc.performance.rosterForCoach.useQuery(
    { coachId },
    { staleTime: 5 * 60 * 1000 }
  );

  const clients = rosterData?.clients ?? [];
  const green = clients.filter(c => ratings[c]?.rating === "green").length;
  const yellow = clients.filter(c => ratings[c]?.rating === "yellow").length;
  const red = clients.filter(c => ratings[c]?.rating === "red").length;
  const rated = clients.filter(c => ratings[c]).length;
  const greenPct = rated > 0 ? Math.round((green / rated) * 1000) / 10 : 0;

  const handleResetClick = () => {
    if (confirmReset) {
      onReset(coachId);
      setConfirmReset(false);
    } else {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 4000);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-zinc-100">{coachName}</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />{green}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" />{yellow}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" />{red}
            </span>
            {rated > 0 && (
              <span className={`font-semibold ${greenPct >= TARGET_PCT ? "text-emerald-400" : "text-amber-400"}`}>
                {greenPct.toFixed(1)}% green
              </span>
            )}
          </div>
          {rated > 0 && (
            <button
              onClick={handleResetClick}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                confirmReset
                  ? "bg-red-500/20 border-red-500/50 text-red-400 font-semibold"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              {confirmReset ? "Confirm reset?" : "Reset all"}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {rated > 0 && <KpiBar pct={greenPct} target={TARGET_PCT} />}

      {/* Client list */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <p className="text-sm text-zinc-500 italic">No clients on roster</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {clients.map(name => (
            <ClientButton
              key={name}
              name={name}
              rating={ratings[name]?.rating ?? null}
              notes={ratings[name]?.notes ?? null}
              updatedAt={ratings[name]?.updatedAt ?? null}
              onRate={(r, n) => onRate(coachId, name, r, n)}
              onClear={() => onClear(coachId, name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Filter Toggle ───────────────────────────────────────────────────────────
type FilterRating = "all" | "green" | "yellow" | "red";

const FILTER_OPTIONS: { value: FilterRating; label: string; dot?: string }[] = [
  { value: "all",    label: "All" },
  { value: "red",    label: "Off Track",  dot: "bg-red-500" },
  { value: "yellow", label: "Neutral",    dot: "bg-amber-400" },
  { value: "green",  label: "On Track",   dot: "bg-emerald-500" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClientPerformance() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [filterRating, setFilterRating] = useState<FilterRating>("all");

  const { data: coaches } = trpc.coaches.list.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const activeCoaches = useMemo(() => (coaches ?? []).filter(c => c.isActive), [coaches]);

  const { data: allRatingsData, refetch: refetchRatings } = trpc.performance.allRatings.useQuery(
    undefined,
    { enabled: isAdmin, staleTime: 30 * 1000 }
  );
  const { data: myRatingsData, refetch: refetchMyRatings } = trpc.performance.myRatings.useQuery(
    undefined,
    { enabled: !isAdmin, staleTime: 30 * 1000 }
  );

  const { data: kpiData, refetch: refetchKpi } = trpc.performance.kpiSummary.useQuery(
    undefined,
    { enabled: isAdmin, staleTime: 30 * 1000 }
  );

  // Build a lookup: coachId → { clientName → { rating, notes, updatedAt } }
  const ratingsMap = useMemo(() => {
    const raw = isAdmin ? (allRatingsData ?? []) : (myRatingsData ?? []);
    const map: Record<number, Record<string, { rating: Rating; notes: string | null; updatedAt: Date }>> = {};
    for (const r of raw) {
      if (!map[r.coachId]) map[r.coachId] = {};
      map[r.coachId][r.clientName] = {
        rating: r.rating as Rating,
        notes: r.notes ?? null,
        updatedAt: new Date(r.updatedAt),
      };
    }
    return map;
  }, [allRatingsData, myRatingsData, isAdmin]);

  const refetchAll = () => {
    refetchRatings();
    refetchMyRatings();
    refetchKpi();
  };

  const setRatingMutation = trpc.performance.setRating.useMutation({
    onSuccess: refetchAll,
    onError: (err) => toast.error(err.message ?? "Failed to save rating"),
  });

  const clearRatingMutation = trpc.performance.clearRating.useMutation({
    onSuccess: refetchAll,
    onError: (err) => toast.error(err.message ?? "Failed to clear rating"),
  });

  const resetAllMutation = trpc.performance.resetAllRatings.useMutation({
    onSuccess: () => { refetchAll(); toast.success("All ratings cleared"); },
    onError: (err) => toast.error(err.message ?? "Failed to reset ratings"),
  });

  const handleRate = (coachId: number, clientName: string, rating: Rating, notes: string) => {
    setRatingMutation.mutate({ coachId, clientName, rating, notes: notes || null });
  };

  const handleClear = (coachId: number, clientName: string) => {
    clearRatingMutation.mutate({ coachId, clientName });
  };

  const handleReset = (coachId: number) => {
    resetAllMutation.mutate({ coachId });
  };

  // Derived: how many clients match the current filter across all visible coaches
  const filterMatchCount = useMemo(() => {
    if (filterRating === "all") return null;
    let count = 0;
    for (const coach of visibleCoaches) {
      const coachRatings = ratingsMap[coach.id] ?? {};
      for (const v of Object.values(coachRatings)) {
        if (v.rating === filterRating) count++;
      }
    }
    return count;
  }, [filterRating, visibleCoaches, ratingsMap]);

  const visibleCoaches = useMemo(() => {
    if (isAdmin) return activeCoaches;
    const myCoach = activeCoaches.find(c => c.userId === user?.id);
    return myCoach ? [myCoach] : [];
  }, [isAdmin, activeCoaches, user?.id]);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 p-6 max-w-5xl mx-auto">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Client Performance</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Click a client to assign a rating and add a note.
          </p>
        </div>

        {/* KPI Summary (admin only) */}
        {isAdmin && kpiData && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                KPI Summary — Target: {kpiData.target}% On Track
              </h2>
              {kpiData.lastReviewedAt && (
                <span className="text-xs text-zinc-500">
                  Last reviewed {formatRelativeTime(new Date(kpiData.lastReviewedAt))}
                </span>
              )}
            </div>

            {/* Business-wide card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-zinc-200">Business Wide</span>
                <span className={`text-2xl font-bold ${kpiData.business?.greenPct >= kpiData.target ? "text-emerald-400" : "text-amber-400"}`}>
                  {kpiData.business?.greenPct.toFixed(1)}%
                </span>
              </div>
              <KpiBar pct={kpiData.business?.greenPct} target={kpiData.target} />
              <div className="flex gap-4 mt-3 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  {kpiData.business.green} On Track
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  {kpiData.business.yellow} Neutral
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  {kpiData.business.red} Off Track
                </span>
                <span className="text-zinc-500 ml-auto">{kpiData.business?.total} rated</span>
              </div>
            </div>

            {/* Per-coach KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {kpiData.perCoach.map(c => (
                <div key={c.coachId} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-zinc-200">{c.coachName}</span>
                    <span className={`text-lg font-bold ${c.greenPct >= kpiData.target ? "text-emerald-400" : "text-amber-400"}`}>
                      {c.greenPct.toFixed(1)}%
                    </span>
                  </div>
                  <KpiBar pct={c.greenPct} target={kpiData.target} />
                  <div className="flex gap-3 mt-2 text-xs text-zinc-500">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />{c.green}</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />{c.yellow}</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />{c.red}</span>
                    {c.total === 0 && <span className="text-zinc-600 italic">No ratings yet</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider mr-1">Filter:</span>
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterRating(opt.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filterRating === opt.value
                  ? opt.value === "red"
                    ? "bg-red-500/20 border-red-500/50 text-red-300"
                    : opt.value === "yellow"
                    ? "bg-amber-400/20 border-amber-400/50 text-amber-300"
                    : opt.value === "green"
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                    : "bg-zinc-700 border-zinc-600 text-zinc-200"
                  : "bg-transparent border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              {opt.dot && <span className={`h-2 w-2 rounded-full ${opt.dot}`} />}
              {opt.label}
            </button>
          ))}
          {filterRating !== "all" && filterMatchCount !== null && (
            <span className="text-xs text-zinc-500 ml-1">{filterMatchCount} client{filterMatchCount !== 1 ? "s" : ""}</span>
          )}
        </div>

        {/* Rosters */}
        <div className="flex flex-col gap-5">
          {visibleCoaches.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">No coach profile linked to your account.</p>
          ) : (
            visibleCoaches.map(coach => (
              <CoachRosterCard
                key={coach.id}
                coachId={coach.id}
                coachName={coach.name}
                ratings={ratingsMap[coach.id] ?? {}}
                filterRating={filterRating}
                onRate={handleRate}
                onClear={handleClear}
                onReset={handleReset}
              />
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
