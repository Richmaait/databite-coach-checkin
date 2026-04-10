import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

function getMonday(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Melbourne" }));
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_LABELS: Record<string, string> = { monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday" };

type Rating = "green" | "yellow" | "red";
const RATINGS: Array<{ value: Rating; label: string; emoji: string; bg: string; border: string; text: string }> = [
  { value: "green", label: "On Track", emoji: "🟢", bg: "bg-emerald-400/20", border: "border-emerald-400/30", text: "text-emerald-300" },
  { value: "yellow", label: "Neutral", emoji: "🟡", bg: "bg-amber-300/15", border: "border-amber-300/25", text: "text-amber-200" },
  { value: "red", label: "Off Track", emoji: "🔴", bg: "bg-red-400/20", border: "border-red-400/30", text: "text-red-300" },
];

type AuditClient = { name: string; day: string; loomLink?: string; notes?: string; rating?: Rating; submitted?: boolean };

export default function FridayAudit() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const weekStart = getMonday();

  const { data: myAudit, refetch } = trpc.audits.getMyAudit.useQuery(
    { weekStart },
    { enabled: !!user && !isAdmin },
  );
  const { data: allAudits, refetch: refetchAll } = trpc.audits.getAllForWeek.useQuery(
    { weekStart },
    { enabled: isAdmin },
  );
  const { data: auditHistory } = trpc.audits.getHistory.useQuery(
    undefined,
    { enabled: isAdmin },
  );

  const submitMutation = trpc.audits.submitClient.useMutation({
    onSuccess: (data) => {
      refetch(); refetchAll();
      if (data.allDone) toast.success("All 3 audits submitted! Great work.");
      else toast.success("Audit submitted");
    },
    onError: (e) => toast.error(e.message),
  });

  const triggerMutation = trpc.audits.triggerNow.useMutation({
    onSuccess: () => { refetchAll(); toast.success("Audit triggered — check Slack"); },
    onError: (e) => toast.error(e.message),
  });

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 p-6 pt-20 max-w-3xl mx-auto">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white/90" style={{ fontFamily: "'Comfortaa', cursive" }}>Friday Audit</h1>
            <p className="text-sm text-white/50 mt-1">Weekly quality check — submit Loom/Fireflies links and rate each client</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => triggerMutation.mutate()}
              disabled={triggerMutation.isPending}
              className="px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-semibold hover:bg-violet-500/30 transition-colors"
            >
              {triggerMutation.isPending ? "Triggering..." : "Trigger Audit Now"}
            </button>
          )}
        </div>

        {/* Coach View */}
        {!isAdmin && (
          myAudit ? (
            <AuditCards audit={myAudit} onSubmit={(clientName, loomLink, notes, rating) => {
              submitMutation.mutate({ auditId: myAudit.id, clientName, loomLink, notes, rating });
            }} isPending={submitMutation.isPending} />
          ) : (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-white/50">No audit assigned for this week yet.</p>
              <p className="text-xs text-white/30 mt-2">Audits are sent every Friday at 2:30pm.</p>
            </div>
          )
        )}

        {/* Admin View */}
        {isAdmin && (
          <>
            <div className="glass rounded-2xl p-6">
              <h2 className="text-base font-bold text-white/90 mb-4">This Week's Audits</h2>
              {allAudits && allAudits.length > 0 ? (
                <div className="space-y-4">
                  {allAudits.map(audit => (
                    <div key={audit.id} className="glass-btn rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-white/80">{audit.coachName}</span>
                        {audit.allSubmittedAt ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 border border-emerald-400/20">ALL SUBMITTED</span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-400/15 text-red-400 border border-red-400/20">PENDING</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {(audit.selectedClients as AuditClient[]).map((c, i) => {
                          const ratingInfo = RATINGS.find(r => r.value === c.rating);
                          return (
                            <div key={i} className={`rounded-lg px-3 py-2 border ${c.submitted ? "border-emerald-400/15 bg-emerald-400/[0.04]" : "border-white/[0.06] bg-white/[0.02]"}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-white/80">{c.name}</span>
                                  <span className="text-xs text-white/40">{DAY_LABELS[c.day] ?? c.day}</span>
                                  {ratingInfo && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ratingInfo.bg} ${ratingInfo.border} ${ratingInfo.text}`}>{ratingInfo.emoji} {ratingInfo.label}</span>}
                                </div>
                                {c.submitted ? <span className="text-[9px] text-emerald-400">✓</span> : <span className="text-[9px] text-white/30">pending</span>}
                              </div>
                              {c.loomLink && (
                                <a href={c.loomLink} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-400 hover:underline block mt-1">
                                  🎥 {c.loomLink}
                                </a>
                              )}
                              {c.notes && <p className="text-xs text-white/40 mt-1">{c.notes}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/40">No audits for this week yet. Click "Trigger Audit Now" to test.</p>
              )}
            </div>

            {auditHistory && auditHistory.length > 0 && (
              <div className="glass rounded-2xl p-6">
                <h2 className="text-base font-bold text-white/90 mb-4">Audit History</h2>
                <div className="space-y-2">
                  {auditHistory.map(a => {
                    const clients = a.selectedClients as AuditClient[];
                    const done = clients.filter(c => c.submitted).length;
                    return (
                      <div key={a.id} className="glass-btn rounded-xl px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-white/70">{a.coachName}</span>
                          <span className="text-xs text-white/40">{a.weekStart}</span>
                          <div className="flex gap-1">
                            {clients.map((c, i) => {
                              const r = RATINGS.find(rt => rt.value === c.rating);
                              return r ? <span key={i} className="text-xs">{r.emoji}</span> : <span key={i} className="text-xs text-white/20">○</span>;
                            })}
                          </div>
                        </div>
                        <span className={`text-xs font-semibold ${done === clients.length ? "text-emerald-400" : "text-red-400"}`}>
                          {done}/{clients.length}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function AuditCards({ audit, onSubmit, isPending }: {
  audit: any;
  onSubmit: (clientName: string, loomLink?: string, notes?: string, rating?: Rating) => void;
  isPending: boolean;
}) {
  const clients = audit.selectedClients as AuditClient[];
  const allDone = clients.every(c => c.submitted);

  return (
    <div className="space-y-4">
      {allDone && (
        <div className="glass rounded-2xl p-6 text-center border border-emerald-400/20">
          <div className="text-4xl mb-2">✅</div>
          <h2 className="text-lg font-bold text-emerald-300">All Audits Submitted</h2>
          <p className="text-sm text-white/40 mt-1">Great work this week!</p>
        </div>
      )}
      {clients.map((c, i) => (
        <ClientAuditCard key={i} client={c} onSubmit={onSubmit} isPending={isPending} />
      ))}
    </div>
  );
}

function ClientAuditCard({ client, onSubmit, isPending }: {
  client: AuditClient;
  onSubmit: (clientName: string, loomLink?: string, notes?: string, rating?: Rating) => void;
  isPending: boolean;
}) {
  const [loomLink, setLoomLink] = useState(client.loomLink ?? "");
  const [notes, setNotes] = useState(client.notes ?? "");
  const [rating, setRating] = useState<Rating | null>(client.rating ?? null);

  if (client.submitted) {
    const ratingInfo = RATINGS.find(r => r.value === client.rating);
    return (
      <div className="glass rounded-2xl p-5 border border-emerald-400/15">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-white/90">{client.name}</span>
            <span className="text-xs text-white/40">{DAY_LABELS[client.day]}</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 border border-emerald-400/20">SUBMITTED</span>
        </div>
        {ratingInfo && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${ratingInfo.bg} ${ratingInfo.border} ${ratingInfo.text} mb-2`}>
            {ratingInfo.emoji} {ratingInfo.label}
          </span>
        )}
        {client.loomLink && <a href={client.loomLink} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-400 hover:underline block">🎥 {client.loomLink}</a>}
        {client.notes && <p className="text-xs text-white/40 mt-1">{client.notes}</p>}
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-base font-semibold text-white/90">{client.name}</span>
        <span className="text-xs text-white/40">{DAY_LABELS[client.day]}</span>
      </div>

      {/* Traffic light rating */}
      <div className="mb-4">
        <label className="block text-xs text-white/40 uppercase tracking-wider font-medium mb-2">Client Status</label>
        <div className="flex gap-2">
          {RATINGS.map(r => (
            <button
              key={r.value}
              onClick={() => setRating(rating === r.value ? null : r.value)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border transition-all duration-150 ${
                rating === r.value
                  ? `${r.bg} ${r.border} ${r.text} scale-105`
                  : "bg-white/5 border-white/10 text-white/50 hover:bg-white/[0.08]"
              }`}
            >
              <span className="text-sm">{r.emoji}</span>
              <span className="text-xs font-medium">{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Loom/Fireflies link */}
      <div className="mb-3">
        <label className="block text-xs text-white/40 uppercase tracking-wider font-medium mb-1.5">Loom or Fireflies Link</label>
        <input type="url" placeholder="https://www.loom.com/share/... or Fireflies link" value={loomLink} onChange={e => setLoomLink(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/90 placeholder-white/20 outline-none focus:border-violet-500/40 transition-all" />
      </div>

      {/* Notes */}
      <div className="mb-4">
        <label className="block text-xs text-white/40 uppercase tracking-wider font-medium mb-1.5">Notes</label>
        <textarea placeholder="Notes from the call or check-in..." value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/90 placeholder-white/20 outline-none focus:border-violet-500/40 transition-all resize-none" />
      </div>

      <button
        onClick={() => onSubmit(client.name, loomLink || undefined, notes || undefined, rating ?? undefined)}
        disabled={isPending || !rating}
        className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 disabled:opacity-40 text-white shadow-lg shadow-violet-500/20 transition-all"
      >
        {isPending ? "Submitting..." : "Submit Audit"}
      </button>
      {!rating && <p className="text-xs text-white/30 text-center mt-2">Select a status to submit</p>}
    </div>
  );
}
