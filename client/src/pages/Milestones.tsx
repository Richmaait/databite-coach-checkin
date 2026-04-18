import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { useLocation } from "wouter";

const MILESTONE_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  2: { bg: "bg-blue-500/15", border: "border-blue-500/25", text: "text-blue-300" },
  4: { bg: "bg-pink-500/15", border: "border-pink-500/25", text: "text-pink-300" },
  8: { bg: "bg-violet-500/15", border: "border-violet-500/25", text: "text-violet-300" },
  12: { bg: "bg-cyan-500/15", border: "border-cyan-500/25", text: "text-cyan-300" },
};

export default function Milestones() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  if (user && user.role !== "admin") { navigate("/"); return null; }

  const [search, setSearch] = useState("");
  const [coachFilter, setCoachFilter] = useState("");

  const { data: alerts, refetch: refetchAlerts } = trpc.milestones.getAlerts.useQuery();
  const { data: allClients } = trpc.milestones.getAll.useQuery();

  const contactMutation = trpc.milestones.markContacted.useMutation({
    onSuccess: () => { refetchAlerts(); toast.success("Contacted"); },
    onError: (e) => toast.error(e.message),
  });
  const ratingMutation = trpc.milestones.setRating.useMutation({
    onSuccess: () => refetchAlerts(),
    onError: (e) => toast.error(e.message),
  });
  const notesMutation = trpc.milestones.setNotes.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const totalAlerts = alerts?.reduce((s, a) => s + a.clients.length, 0) ?? 0;

  const coaches = useMemo(() => {
    if (!allClients) return [];
    return [...new Set(allClients.map(c => c.coach).filter(Boolean) as string[])].sort();
  }, [allClients]);

  const filtered = useMemo(() => {
    if (!allClients) return [];
    let list = allClients;
    if (coachFilter) list = list.filter(c => c.coach === coachFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.clientName.toLowerCase().includes(q));
    }
    return list.sort((a, b) => (a.weekNumber ?? 0) - (b.weekNumber ?? 0));
  }, [allClients, coachFilter, search]);

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6 pt-20 max-w-5xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-white/90" style={{ fontFamily: "'Comfortaa', cursive" }}>Milestones</h1>
          <p className="text-sm text-white/50 mt-1">Client milestone alerts — weeks 2, 4, 8, 12</p>
        </div>

        {/* This week's alerts */}
        {totalAlerts > 0 ? (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-white/70">This Week's Milestones</h2>
            <div className="space-y-3">
              {alerts!.map(alert => {
                const colors = MILESTONE_COLORS[alert.milestone.week] ?? MILESTONE_COLORS[2];
                return (
                  <div key={alert.milestone.week} className={`rounded-xl ${colors.bg} border ${colors.border} p-4`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-lg font-bold ${colors.text}`}>Week {alert.milestone.week}</span>
                      <span className={`text-xs font-semibold ${colors.text}`}>— {alert.milestone.label}</span>
                      <span className="text-xs text-white/40 ml-1">{alert.milestone.description}</span>
                    </div>
                    <div className="space-y-2">
                      {alert.clients.map((c: any) => (
                        <div key={c.id} className="flex items-center gap-3">
                          <span className="text-sm text-white/80 font-medium min-w-[140px]">{c.clientName}</span>
                          <span className="text-xs text-white/40 min-w-[50px]">{c.coach}</span>

                          {c.contactedAt ? (
                            <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-400/15 border border-emerald-400/25 px-2 py-0.5 rounded-full whitespace-nowrap">
                              ✓ {c.contactedAt.split("-").reverse().join("/")}
                            </span>
                          ) : (
                            <button
                              onClick={() => contactMutation.mutate({ id: c.id, week: alert.milestone.week })}
                              disabled={contactMutation.isPending}
                              className="text-[10px] font-semibold text-white/50 bg-white/10 border border-white/20 px-2 py-0.5 rounded-full hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/30 transition-colors whitespace-nowrap">
                              Contacted
                            </button>
                          )}

                          <div className="flex rounded-lg overflow-hidden border border-white/10">
                            {([["green", "🟢", "On Track"], ["yellow", "🟡", "Neutral"], ["red", "🔴", "Off Track"]] as const).map(([val, emoji, label]) => (
                              <button key={val}
                                onClick={() => ratingMutation.mutate({ id: c.id, week: alert.milestone.week, rating: val })}
                                className={`px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${c.rating === val
                                  ? val === "green" ? "bg-emerald-500/25 text-emerald-300"
                                    : val === "yellow" ? "bg-amber-500/25 text-amber-300"
                                    : "bg-red-500/25 text-red-300"
                                  : "bg-white/5 text-white/30 hover:bg-white/10"
                                }`}>
                                {emoji}
                              </button>
                            ))}
                          </div>

                          <input type="text" defaultValue={c.notes || ""} placeholder="Notes..."
                            onBlur={e => { const v = e.target.value; if (v !== (c.notes || "")) notesMutation.mutate({ id: c.id, week: alert.milestone.week, notes: v }); }}
                            onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            className="flex-1 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/60 text-[10px] placeholder:text-white/20 focus:outline-none focus:border-violet-500/30" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-white/5 border border-white/10 p-6 text-center">
            <p className="text-sm text-white/40">No milestone alerts this week</p>
          </div>
        )}

        {/* All clients */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-white/70">All Active Clients</h2>
          <div className="flex gap-3">
            <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/90 text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-500/40" />
            <select value={coachFilter} onChange={e => setCoachFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm focus:outline-none">
              <option value="">All coaches</option>
              {coaches.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left px-3 py-2 font-medium text-white/50 min-w-[150px]">Client</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Coach</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Started</th>
                  <th className="text-center px-2 py-2 font-medium text-white/50">Week</th>
                  <th className="text-center px-2 py-2 font-medium text-blue-300/60">Wk 2</th>
                  <th className="text-center px-2 py-2 font-medium text-pink-300/60">Wk 4</th>
                  <th className="text-center px-2 py-2 font-medium text-violet-300/60">Wk 8</th>
                  <th className="text-center px-2 py-2 font-medium text-cyan-300/60">Wk 12</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Next</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const milestone = c.currentMilestone;
                  const colors = milestone ? MILESTONE_COLORS[milestone.week] : null;
                  const history = (c as any).milestoneHistory as Array<{ week: number; label: string; contactedAt: string | null; rating: string | null; notes: string | null }> | undefined;
                  return (
                    <tr key={c.id} className="border-b border-white/[0.04] hover:bg-violet-500/[0.08] transition-colors">
                      <td className="px-3 py-2 font-medium text-white/80">{c.clientName}</td>
                      <td className="px-2 py-2 text-white/50">{c.coach || "—"}</td>
                      <td className="px-2 py-2 text-white/50">{c.sentToClient ? c.sentToClient.split("-").reverse().join("/") : "—"}</td>
                      <td className="text-center px-2 py-2">
                        {milestone ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colors!.bg} ${colors!.border} border ${colors!.text}`}>
                            {c.weekNumber}
                          </span>
                        ) : (
                          <span className="text-white/50">{c.weekNumber}</span>
                        )}
                      </td>
                      {(history ?? []).map(h => {
                        const ratingEmoji = h.rating === "green" ? "🟢" : h.rating === "yellow" ? "🟡" : h.rating === "red" ? "🔴" : null;
                        const past = (c.weekNumber ?? 0) >= h.week;
                        return (
                          <td key={h.week} className="text-center px-2 py-2" title={h.notes || undefined}>
                            {h.contactedAt ? (
                              <span className="text-[10px]">
                                {ratingEmoji ?? "✓"}{h.notes ? " 📝" : ""}
                              </span>
                            ) : past ? (
                              <span className="text-white/15">—</span>
                            ) : (
                              <span className="text-white/10">·</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-white/40">
                        {c.nextMilestone ? `Wk ${c.nextMilestone.week}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-white/30 text-center">{filtered.length} clients</div>
        </div>
      </div>
    </DashboardLayout>
  );
}
