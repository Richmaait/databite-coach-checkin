import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { melbourneNow } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { useLocation } from "wouter";

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
    <div className="relative h-3 w-full rounded-full bg-white/10 overflow-hidden">
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
      className="absolute z-50 top-full left-0 mt-1 bg-white/5 border border-white/10 rounded-xl shadow-2xl p-3 flex flex-col gap-2 min-w-[220px]"
    >
      {/* Rating options */}
      <div className="flex flex-col gap-1">
        {(["green", "yellow", "red"] as Rating[]).map(r => (
          <button
            key={r}
            onClick={() => setPendingRating(r)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
              ${pendingRating === r ? `${RATING_STYLES[r].bg} ${RATING_STYLES[r].text}` : "text-white/70 hover:bg-white/[0.08]"}`}
          >
            <span className={`h-3 w-3 rounded-full ${RATING_STYLES[r].bg}`} />
            {RATING_STYLES[r].label}
          </button>
        ))}
      </div>

      {/* Notes field */}
      <div className="border-t border-white/10 pt-2">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add a note (optional)…"
          maxLength={500}
          rows={2}
          className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-500"
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
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:bg-white/[0.08] transition-colors"
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
            : "bg-white/5 border-white/10 text-white/70 hover:bg-white/[0.08] hover:border-zinc-600"
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
          <span className={`text-xs ${style ? "opacity-75" : "text-white/50"} pl-4 leading-snug line-clamp-1`}>
            {notes}
          </span>
        )}
        {updatedAt && (
          <span className={`text-xs ${style ? "opacity-60" : "text-white/30"} pl-4`}>
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

// ─── Filter type (used by CoachRosterCard and main page) ───────────────────
type FilterRating = "all" | "green" | "yellow" | "red" | "unrated";

// ─── Coach Roster Card ────────────────────────────────────────────────────────
function CoachRosterCard({
  coachId,
  coachName,
  ratings,
  filterRating,
  searchQuery,
  clientSort,
  isFocused,
  isFirst,
  isLast,
  onFocusCoach,
  onMoveCoach,
  onRate,
  onClear,
  onReset,
}: {
  coachId: number;
  coachName: string;
  ratings: Record<string, { rating: Rating; notes: string | null; updatedAt: Date }>;
  filterRating: FilterRating;
  searchQuery: string;
  clientSort: "alpha" | "status";
  isFocused: boolean;
  isFirst: boolean;
  isLast: boolean;
  onFocusCoach: (coachId: number) => void;
  onMoveCoach: (coachId: number, direction: "up" | "down") => void;
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
  const greenPct  = rated > 0 ? Math.round((green  / rated) * 1000) / 10 : 0;
  const yellowPct = rated > 0 ? Math.round((yellow / rated) * 1000) / 10 : 0;
  const redPct    = rated > 0 ? Math.round((red    / rated) * 1000) / 10 : 0;

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
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Up/down order controls — only shown in team-wide view */}
          {!isFocused && (
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => onMoveCoach(coachId, "up")}
                disabled={isFirst}
                className="h-4 w-4 flex items-center justify-center text-white/20 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                title="Move up"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                </svg>
              </button>
              <button
                onClick={() => onMoveCoach(coachId, "down")}
                disabled={isLast}
                className="h-4 w-4 flex items-center justify-center text-white/20 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                title="Move down"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            </div>
          )}
          <button
            onClick={() => onFocusCoach(coachId)}
            className={`text-base font-semibold transition-colors text-left ${
              isFocused
                ? "text-emerald-300"
                : "text-white/90 hover:text-emerald-300"
            }`}
            title="Click to focus on this coach only"
          >
            {coachName}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-white/50">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-emerald-400 font-medium">{green}{rated > 0 ? ` · ${greenPct.toFixed(0)}%` : ""}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-amber-400 font-medium">{yellow}{rated > 0 ? ` · ${yellowPct.toFixed(0)}%` : ""}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-red-400 font-medium">{red}{rated > 0 ? ` · ${redPct.toFixed(0)}%` : ""}</span>
            </span>
          </div>
          {rated > 0 && (
            <button
              onClick={handleResetClick}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                confirmReset
                  ? "bg-red-500/20 border-red-500/50 text-red-400 font-semibold"
                  : "bg-white/5 border-white/10 text-white/50 hover:border-zinc-600 hover:text-white/70"
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
            <div key={i} className="h-10 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <p className="text-sm text-white/30 italic">No clients on roster</p>
      ) : (() => {
        const ratingFiltered = filterRating === "all"
          ? clients
          : filterRating === "unrated"
          ? clients.filter(name => !ratings[name])
          : clients.filter(name => ratings[name]?.rating === filterRating);
        const q = searchQuery.trim().toLowerCase();
        const afterSearch = q ? ratingFiltered.filter(name => name.toLowerCase().includes(q)) : ratingFiltered;
        // Sort: alpha = alphabetical (default), status = Red → Neutral → Green → Unrated
        const STATUS_ORDER: Record<string, number> = { red: 0, yellow: 1, green: 2 };
        const filtered = clientSort === "status"
          ? [...afterSearch].sort((a, b) => {
              const ra = STATUS_ORDER[ratings[a]?.rating ?? ""] ?? 3;
              const rb = STATUS_ORDER[ratings[b]?.rating ?? ""] ?? 3;
              if (ra !== rb) return ra - rb;
              return a.localeCompare(b);
            })
          : [...afterSearch].sort((a, b) => a.localeCompare(b));
        return filtered.length === 0 ? (
          <p className="text-sm text-white/30 italic">No clients match this filter</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map(name => (
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
        );
      })()}
    </div>
  );
}

// ─── Filter Toggle ───────────────────────────────────────────────────────────
const FILTER_OPTIONS: { value: FilterRating; label: string; dot?: string }[] = [
  { value: "all",     label: "All" },
  { value: "red",     label: "Off Track",   dot: "bg-red-500" },
  { value: "yellow",  label: "Neutral",     dot: "bg-amber-400" },
  { value: "green",   label: "On Track",    dot: "bg-emerald-500" },
  { value: "unrated", label: "Not Yet Rated" },
];

// ─── Client Tenure Table ────────────────────────────────────────────────────
type TenureSortKey = "clientName" | "coachName" | "dayOfWeek" | "weeksOnRoster" | "firstWeekStart";

function ClientTenureTable() {
  const { data, isLoading } = trpc.clientCheckins.getClientTenure.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const [sortKey, setSortKey] = useState<TenureSortKey>("weeksOnRoster");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  // Only show clients added in the last 7 days
  const sevenDaysAgo = useMemo(() => {
    const d = melbourneNow();
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Earliest firstWeekStart across all data (for the tracking-since label)
  const trackingSince = useMemo(() => {
    if (!data || data.length === 0) return null;
    const earliest = data.reduce((min, r) => r.firstWeekStart < min ? r.firstWeekStart : min, data[0].firstWeekStart);
    return new Date(earliest + "T00:00:00").toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  }, [data]);

  const rows = useMemo(() => {
    const filtered = (data ?? []).filter(r => {
      // Only clients added in the last 7 days
      const addedDate = new Date(r.firstWeekStart + "T00:00:00");
      if (addedDate < sevenDaysAgo) return false;
      // Search filter
      return !search || r.clientName.toLowerCase().includes(search.toLowerCase()) ||
        r.coachName.toLowerCase().includes(search.toLowerCase());
    });
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, search]);

  function handleSort(key: TenureSortKey) {
    if (key === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const SortIcon = ({ k }: { k: TenureSortKey }) => (
    <span className="ml-1 text-white/30">
      {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  const DAY_LABELS: Record<string, string> = {
    monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri",
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">New Clients This Week</h2>
          {trackingSince && (
            <p className="text-xs text-white/20 mt-0.5">Tracking since {trackingSince}</p>
          )}
        </div>
        <input
          type="text"
          placeholder="Search client or coach…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-sm bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-white/80 placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-52"
        />
      </div>
      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5/60">
            <tr>
              {([
                ["clientName", "Client"],
                ["coachName", "Coach"],
                ["dayOfWeek", "Day"],
                ["weeksOnRoster", "Weeks on Roster"],
                ["firstWeekStart", "Since"],
              ] as [TenureSortKey, string][]).map(([k, label]) => (
                <th
                  key={k}
                  onClick={() => handleSort(k)}
                  className="px-4 py-2.5 text-left text-xs font-semibold text-white/50 uppercase tracking-wider cursor-pointer hover:text-white/80 select-none"
                >
                  {label}<SortIcon k={k} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-white/30 text-sm">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-white/30 text-sm italic">No new clients added in the last 7 days.</td></tr>
            ) : rows.map((r, i) => {
              const sinceDate = new Date(r.firstWeekStart + "T00:00:00");
              const sinceLabel = sinceDate.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
              const tenureColor = r.weeksOnRoster >= 12
                ? "text-emerald-400"
                : r.weeksOnRoster >= 4
                  ? "text-amber-400"
                  : "text-white/50";
              return (
                <tr key={i} className="border-t border-white/[0.08] hover:bg-white/5/40 transition-colors">
                  <td className="px-4 py-2.5 text-white/80 font-medium">{r.clientName}</td>
                  <td className="px-4 py-2.5 text-white/50">{r.coachName}</td>
                  <td className="px-4 py-2.5 text-white/50">{DAY_LABELS[r.dayOfWeek] ?? r.dayOfWeek}</td>
                  <td className={`px-4 py-2.5 font-semibold tabular-nums ${tenureColor}`}>
                    {r.weeksOnRoster} {r.weeksOnRoster === 1 ? "week" : "weeks"}
                  </td>
                  <td className="px-4 py-2.5 text-white/30 text-xs">{sinceLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-white/20 italic">Shows clients added to the roster in the last 7 days. Tracking began {trackingSince ?? "from first roster sync"}.</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClientProgress() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [filterRating, setFilterRating] = useState<FilterRating>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [clientSort, setClientSort] = useState<"alpha" | "status">("alpha");
  const [focusedCoachId, setFocusedCoachId] = useState<number | null>(null);

  // Coach display order — persisted in localStorage
  const [coachOrder, setCoachOrder] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem("clientProgress:coachOrder");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const saveCoachOrder = (order: number[]) => {
    setCoachOrder(order);
    try { localStorage.setItem("clientProgress:coachOrder", JSON.stringify(order)); } catch {}
  };

  const { data: coaches } = trpc.coaches.list.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const activeCoaches = useMemo(() => (coaches ?? []).filter(c => c.isActive), [coaches]);

  // Apply saved order to activeCoaches; new coaches not in saved order go to the end
  const orderedActiveCoaches = useMemo(() => {
    if (coachOrder.length === 0) return activeCoaches;
    const inOrder = coachOrder.map(id => activeCoaches.find(c => c.id === id)).filter(Boolean) as typeof activeCoaches;
    const notInOrder = activeCoaches.filter(c => !coachOrder.includes(c.id));
    return [...inOrder, ...notInOrder];
  }, [activeCoaches, coachOrder]);

  const moveCoach = (coachId: number, direction: "up" | "down") => {
    const ids = orderedActiveCoaches.map(c => c.id);
    const idx = ids.indexOf(coachId);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= ids.length) return;
    const newIds = [...ids];
    [newIds[idx], newIds[newIdx]] = [newIds[newIdx], newIds[idx]];
    saveCoachOrder(newIds);
  };

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

  const [, setLocation] = useLocation();

  // Title dialog state for sweep report generation
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [selectedCoachId, setSelectedCoachId] = useState<number | null>(null); // null = all coaches

  // Compute current Monday as YYYY-MM-DD for weekStart
  const getCurrentWeekStart = () => {
    const now = melbourneNow();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(now);
    mon.setDate(mon.getDate() + diff);
    return mon.toISOString().slice(0, 10);
  };

  const openTitleDialog = () => {
    const now = melbourneNow();
    const dateLabel = now.toLocaleDateString("en-AU", {
      day: "numeric", month: "short", year: "numeric",
      timeZone: "Australia/Melbourne",
    });
    setSelectedCoachId(null);
    setReportTitle(`Post-Sweep Report — ${dateLabel}`);
    setShowTitleDialog(true);
  };

  // When coach selection changes in the dialog, update the default title
  const handleDialogCoachChange = (coachId: number | null) => {
    setSelectedCoachId(coachId);
    const now = melbourneNow();
    const dateLabel = now.toLocaleDateString("en-AU", {
      day: "numeric", month: "short", year: "numeric",
      timeZone: "Australia/Melbourne",
    });
    if (coachId === null) {
      setReportTitle(`Post-Sweep Report — ${dateLabel}`);
    } else {
      const coach = activeCoaches.find(c => c.id === coachId);
      setReportTitle(coach ? `${coach.name} — 1-on-1 Sweep — ${dateLabel}` : `Post-Sweep Report — ${dateLabel}`);
    }
  };

  // Past sweep reports (admin only)
  const { data: pastReports, refetch: refetchPastReports } = trpc.sweepReport.list.useQuery(
    undefined,
    { enabled: isAdmin, staleTime: 60 * 1000 }
  );

  const createSweepReportMutation = trpc.sweepReport.create.useMutation({
    onSuccess: (data) => {
      setShowTitleDialog(false);
      toast.success("Report generated \u2014 review and save when ready.");
      refetchPastReports();
      setLocation(`/sweep-report/${data.id}`);
    },
    onError: (err) => toast.error(err.message ?? "Failed to generate report"),
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

  const allVisibleCoaches = useMemo(() => {
    if (isAdmin) return orderedActiveCoaches;
    const myCoach = activeCoaches.find(c => c.userId === user?.id);
    return myCoach ? [myCoach] : [];
  }, [isAdmin, orderedActiveCoaches, activeCoaches, user?.id]);

  // When a coach is focused, show only that coach's card
  const visibleCoaches = useMemo(() => {
    if (focusedCoachId !== null) {
      return allVisibleCoaches.filter(c => c.id === focusedCoachId);
    }
    return allVisibleCoaches;
  }, [allVisibleCoaches, focusedCoachId]);

  // Derived: how many clients match the current filter across all visible coaches
  const filterMatchCount = useMemo(() => {
    if (filterRating === "all") return null;
    let count = 0;
    // Note: unrated count requires roster data which isn't available here;
    // we show the count per-card instead via the filter label
    if (filterRating === "unrated") return null;
    for (const coach of visibleCoaches) {
      const coachRatings = ratingsMap[coach.id] ?? {};
      for (const v of Object.values(coachRatings)) {
        if (v.rating === filterRating) count++;
      }
    }
    return count;
  }, [filterRating, visibleCoaches, ratingsMap]);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 p-6 max-w-5xl mx-auto">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white/90">Client Progress</h1>
            <p className="text-sm text-white/50 mt-1">
              Click a client to assign a rating and add a note.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={openTitleDialog}
              disabled={createSweepReportMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-lg"
            >
              {createSweepReportMutation.isPending ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
                  </svg>
                  Generate Post-Sweep Report
                </>
              )}
            </button>
          )}
        </div>

        {/* KPI Summary (admin only) */}
        {isAdmin && kpiData && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">
                KPI Summary — Target: {kpiData.target}% On Track
              </h2>
            </div>

            {/* Business-wide card */}
            {kpiData.overall && (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-white/80">Business Wide</span>
                <span className={`text-2xl font-bold ${kpiData.overall.greenPct >= kpiData.target ? "text-emerald-400" : "text-amber-400"}`}>
                  {kpiData.overall.greenPct.toFixed(1)}%
                </span>
              </div>
              <KpiBar pct={kpiData.overall.greenPct} target={kpiData.target} />
              <div className="flex gap-4 mt-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-emerald-400 font-medium">{kpiData.overall.green} On Track</span>
                  {kpiData.overall.total > 0 && <span className="text-emerald-400/70">· {((kpiData.overall.green / kpiData.overall.total) * 100).toFixed(0)}%</span>}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="text-amber-400 font-medium">{kpiData.overall.yellow} Neutral</span>
                  {kpiData.overall.total > 0 && <span className="text-amber-400/70">· {((kpiData.overall.yellow / kpiData.overall.total) * 100).toFixed(0)}%</span>}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span className="text-red-400 font-medium">{kpiData.overall.red} Off Track</span>
                  {kpiData.overall.total > 0 && <span className="text-red-400/70">· {((kpiData.overall.red / kpiData.overall.total) * 100).toFixed(0)}%</span>}
                </span>
                <span className="text-white/30 ml-auto">{kpiData.overall.total} rated</span>
              </div>
            </div>
            )}

            {/* Per-coach KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(kpiData.coaches ?? []).map(c => (
                <button
                  key={c.coachId}
                  onClick={() => setFocusedCoachId(c.coachId)}
                  className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 text-left hover:border-emerald-500/40 hover:bg-white/5/60 transition-all group"
                  title={`Click to focus on ${c.coachName}'s clients`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white/80 group-hover:text-emerald-300 transition-colors">{c.coachName}</span>
                    <span className={`text-lg font-bold ${c.greenPct >= kpiData.target ? "text-emerald-400" : "text-amber-400"}`}>
                      {c.greenPct.toFixed(1)}%
                    </span>
                  </div>
                  <KpiBar pct={c.greenPct} target={kpiData.target} />
                  <div className="flex gap-3 mt-2 text-xs">
                    <span className="flex items-center gap-1 text-emerald-400/80"><span className="h-2 w-2 rounded-full bg-emerald-500" />{c.green}{c.total > 0 ? ` · ${((c.green / c.total) * 100).toFixed(0)}%` : ""}</span>
                    <span className="flex items-center gap-1 text-amber-400/80"><span className="h-2 w-2 rounded-full bg-amber-400" />{c.yellow}{c.total > 0 ? ` · ${((c.yellow / c.total) * 100).toFixed(0)}%` : ""}</span>
                    <span className="flex items-center gap-1 text-red-400/80"><span className="h-2 w-2 rounded-full bg-red-500" />{c.red}{c.total > 0 ? ` · ${((c.red / c.total) * 100).toFixed(0)}%` : ""}</span>
                    {c.total === 0 && <span className="text-white/20 italic">No ratings yet</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search + Filter row */}
        <div className="flex flex-col gap-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input
            type="text"
            placeholder="Search clients…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white/[0.03] border border-white/10 rounded-xl text-white/80 placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
        {/* Sort + Filter row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sort toggle */}
          <div className="flex items-center rounded-lg border border-white/10 overflow-hidden mr-2">
            <button
              onClick={() => setClientSort("alpha")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                clientSort === "alpha"
                  ? "bg-white/10 text-white/90"
                  : "bg-transparent text-white/30 hover:text-white/70"
              }`}
            >
              A–Z
            </button>
            <button
              onClick={() => setClientSort("status")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-white/10 ${
                clientSort === "status"
                  ? "bg-white/10 text-white/90"
                  : "bg-transparent text-white/30 hover:text-white/70"
              }`}
            >
              By Status
            </button>
          </div>
          <span className="text-xs font-medium text-white/30 uppercase tracking-wider mr-1">Filter:</span>
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
                    : "bg-white/10 border-zinc-600 text-white/80"
                  : "bg-transparent border-white/10 text-white/50 hover:border-zinc-600 hover:text-white/70"
              }`}
            >
              {opt.dot && <span className={`h-2 w-2 rounded-full ${opt.dot}`} />}
              {opt.label}
            </button>
          ))}
          {filterRating !== "all" && filterMatchCount !== null && (
            <span className="text-xs text-white/30 ml-1">{filterMatchCount} client{filterMatchCount !== 1 ? "s" : ""}</span>
          )}
        </div>
        </div>

        {/* Focused coach banner */}
        {focusedCoachId !== null && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <span className="text-sm text-emerald-300 font-medium">
              Showing: {allVisibleCoaches.find(c => c.id === focusedCoachId)?.name ?? "Coach"} only
            </span>
            <button
              onClick={() => setFocusedCoachId(null)}
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-200 font-medium transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
              Show all coaches
            </button>
          </div>
        )}

        {/* Rosters */}
        <div className="flex flex-col gap-5">
          {visibleCoaches.length === 0 ? (
            <p className="text-sm text-white/30 italic">No coach profile linked to your account.</p>
          ) : (
            visibleCoaches.map((coach, idx) => (
              <CoachRosterCard
                key={coach.id}
                coachId={coach.id}
                coachName={coach.name}
                ratings={ratingsMap[coach.id] ?? {}}
                filterRating={filterRating}
                searchQuery={searchQuery}
                clientSort={clientSort}
                isFocused={focusedCoachId === coach.id}
                isFirst={idx === 0}
                isLast={idx === visibleCoaches.length - 1}
                onFocusCoach={(id) => setFocusedCoachId(id)}
                onMoveCoach={moveCoach}
                onRate={handleRate}
                onClear={handleClear}
                onReset={handleReset}
              />
            ))
          )}
        </div>

        {/* Past Sweep Reports (admin only) */}
        {isAdmin && pastReports && pastReports.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">Past Sweep Reports</h2>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
              {pastReports.map((report, i) => (
                <button
                  key={report.id}
                  onClick={() => setLocation(`/sweep-report/${report.id}`)}
                  className={`w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/5/60 transition-colors ${
                    i > 0 ? "border-t border-white/[0.08]" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white/80">{report.title ?? `Report #${report.id}`}</span>
                    {report.scopeType === "coach" && report.scopeCoachName && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        1-on-1: {report.scopeCoachName}
                      </span>
                    )}
                    {report.isSaved === 1 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Saved</span>
                    )}
                    {report.weekStart && (
                      <span className="text-xs text-white/30">Week of {new Date(report.weekStart).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {report.createdByName && (
                      <span className="text-xs text-white/30">{report.createdByName}</span>
                    )}
                    <span className="text-xs text-white/20">
                      {new Date(report.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Melbourne" })}
                    </span>
                    <svg className="h-4 w-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Client Tenure Table (admin only) */}
        {isAdmin && <ClientTenureTable />}
      </div>

      {/* Title Dialog for generating sweep report */}
      {showTitleDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-bold text-white/90">Generate Post-Sweep Report</h2>
              <p className="text-sm text-white/50 mt-1">Choose a scope and give this report a name.</p>
            </div>

            {/* Coach scope selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Report Scope</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleDialogCoachChange(null)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    selectedCoachId === null
                      ? "bg-emerald-600 border-emerald-500 text-white"
                      : "bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:border-zinc-500"
                  }`}
                >
                  All Coaches
                </button>
                {activeCoaches.map(coach => (
                  <button
                    key={coach.id}
                    onClick={() => handleDialogCoachChange(coach.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      selectedCoachId === coach.id
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:border-zinc-500"
                    }`}
                  >
                    {coach.name}
                  </button>
                ))}
              </div>
              {selectedCoachId !== null && (
                <p className="text-xs text-blue-400 mt-0.5">1-on-1 report — only this coach's clients will be included</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Report Title</label>
              <input
                type="text"
                value={reportTitle}
                onChange={e => setReportTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && reportTitle.trim()) {
                    createSweepReportMutation.mutate({ title: reportTitle.trim(), weekStart: getCurrentWeekStart(), coachId: selectedCoachId ?? undefined });
                  }
                  if (e.key === "Escape") setShowTitleDialog(false);
                }}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white/90 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Post-Sweep Report — 21 Mar 2026"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowTitleDialog(false)}
                className="px-4 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white/80 hover:border-zinc-600 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => createSweepReportMutation.mutate({ title: reportTitle.trim() || "Post-Sweep Report", weekStart: getCurrentWeekStart(), coachId: selectedCoachId ?? undefined })}
                disabled={createSweepReportMutation.isPending || !reportTitle.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {createSweepReportMutation.isPending ? (
                  <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating…</>
                ) : "Generate Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
