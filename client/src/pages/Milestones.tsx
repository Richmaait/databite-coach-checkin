import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { useLocation } from "wouter";

const MILESTONE_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  2: { bg: "bg-blue-500/15", border: "border-blue-500/25", text: "text-blue-300" },
  4: { bg: "bg-emerald-500/15", border: "border-emerald-500/25", text: "text-emerald-300" },
  8: { bg: "bg-violet-500/15", border: "border-violet-500/25", text: "text-violet-300" },
  12: { bg: "bg-cyan-500/15", border: "border-cyan-500/25", text: "text-cyan-300" },
};

export default function Milestones() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  if (user && user.role !== "admin") { navigate("/"); return null; }

  const [search, setSearch] = useState("");
  const [coachFilter, setCoachFilter] = useState("");

  const { data: alerts } = trpc.milestones.getAlerts.useQuery();
  const { data: allClients } = trpc.milestones.getAll.useQuery();

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {alerts!.map(alert => {
                const colors = MILESTONE_COLORS[alert.milestone.week] ?? MILESTONE_COLORS[2];
                return (
                  <div key={alert.milestone.week} className={`rounded-xl ${colors.bg} border ${colors.border} p-4`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-lg font-bold ${colors.text}`}>Week {alert.milestone.week}</span>
                      <span className={`text-xs font-semibold ${colors.text}`}>— {alert.milestone.label}</span>
                    </div>
                    <p className="text-xs text-white/50 mb-3">{alert.milestone.description}</p>
                    <div className="space-y-1.5">
                      {alert.clients.map(c => (
                        <div key={c.id} className="flex items-center justify-between">
                          <span className="text-sm text-white/80 font-medium">{c.clientName}</span>
                          <span className="text-xs text-white/40">{c.coach}</span>
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left px-4 py-2 font-medium text-white/50">Client</th>
                  <th className="text-left px-4 py-2 font-medium text-white/50">Coach</th>
                  <th className="text-left px-4 py-2 font-medium text-white/50">Started</th>
                  <th className="text-center px-4 py-2 font-medium text-white/50">Week</th>
                  <th className="text-left px-4 py-2 font-medium text-white/50">Next Milestone</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const milestone = c.currentMilestone;
                  const colors = milestone ? MILESTONE_COLORS[milestone.week] : null;
                  return (
                    <tr key={c.id} className="border-b border-white/[0.04] hover:bg-violet-500/[0.08] transition-colors">
                      <td className="px-4 py-2.5 font-medium text-white/80">{c.clientName}</td>
                      <td className="px-4 py-2.5 text-white/50">{c.coach || "—"}</td>
                      <td className="px-4 py-2.5 text-white/50">{c.sentToClient ? c.sentToClient.split("-").reverse().join("/") : "—"}</td>
                      <td className="text-center px-4 py-2.5">
                        {milestone ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors!.bg} ${colors!.border} border ${colors!.text}`}>
                            {c.weekNumber}
                          </span>
                        ) : (
                          <span className="text-white/50">{c.weekNumber}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-white/40">
                        {c.nextMilestone ? `Week ${c.nextMilestone.week} — ${c.nextMilestone.label}` : "—"}
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
