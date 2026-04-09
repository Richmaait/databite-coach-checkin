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

export default function FridayAudit() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const weekStart = getMonday();

  const { data: myAudit, refetch } = trpc.audits.getMyAudit.useQuery(
    { weekStart },
    { enabled: !!user && !isAdmin },
  );

  const { data: allAudits } = trpc.audits.getAllForWeek.useQuery(
    { weekStart },
    { enabled: isAdmin },
  );

  const { data: auditHistory } = trpc.audits.getHistory.useQuery(
    undefined,
    { enabled: isAdmin },
  );

  const submitMutation = trpc.audits.submitClient.useMutation({
    onSuccess: (data) => {
      refetch();
      if (data.allDone) {
        toast.success("All 3 audits submitted! Great work.");
      } else {
        toast.success("Audit submitted");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 p-6 pt-20 max-w-3xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-white/90" style={{ fontFamily: "'Comfortaa', cursive" }}>Friday Audit</h1>
          <p className="text-sm text-white/50 mt-1">Weekly quality check — submit Loom links or notes for selected clients</p>
        </div>

        {/* Coach View */}
        {!isAdmin && (
          myAudit ? (
            <AuditCards audit={myAudit} onSubmit={(clientName, loomLink, notes) => {
              submitMutation.mutate({ auditId: myAudit.id, clientName, loomLink, notes });
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
                        {(audit.selectedClients as Array<{ name: string; day: string; loomLink?: string; notes?: string; submitted?: boolean }>).map((c, i) => (
                          <div key={i} className={`rounded-lg px-3 py-2 border ${c.submitted ? "border-emerald-400/15 bg-emerald-400/[0.04]" : "border-white/[0.06] bg-white/[0.02]"}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-white/80">{c.name}</span>
                                <span className="text-xs text-white/40">{DAY_LABELS[c.day] ?? c.day}</span>
                              </div>
                              {c.submitted ? (
                                <span className="text-[9px] text-emerald-400">✓</span>
                              ) : (
                                <span className="text-[9px] text-white/30">pending</span>
                              )}
                            </div>
                            {c.loomLink && (
                              <a href={c.loomLink} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-400 hover:underline block mt-1">
                                🎥 {c.loomLink}
                              </a>
                            )}
                            {c.notes && <p className="text-xs text-white/40 mt-1">{c.notes}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/40">No audits for this week yet.</p>
              )}
            </div>

            {/* History */}
            {auditHistory && auditHistory.length > 0 && (
              <div className="glass rounded-2xl p-6">
                <h2 className="text-base font-bold text-white/90 mb-4">Audit History</h2>
                <div className="space-y-2">
                  {auditHistory.map(a => {
                    const clients = a.selectedClients as Array<{ name: string; submitted?: boolean }>;
                    const done = clients.filter(c => c.submitted).length;
                    return (
                      <div key={a.id} className="glass-btn rounded-xl px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-white/70">{a.coachName}</span>
                          <span className="text-xs text-white/40">{a.weekStart}</span>
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
  onSubmit: (clientName: string, loomLink?: string, notes?: string) => void;
  isPending: boolean;
}) {
  const clients = audit.selectedClients as Array<{ name: string; day: string; loomLink?: string; notes?: string; submitted?: boolean }>;
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
  client: { name: string; day: string; loomLink?: string; notes?: string; submitted?: boolean };
  onSubmit: (clientName: string, loomLink?: string, notes?: string) => void;
  isPending: boolean;
}) {
  const [loomLink, setLoomLink] = useState(client.loomLink ?? "");
  const [notes, setNotes] = useState(client.notes ?? "");

  if (client.submitted) {
    return (
      <div className="glass rounded-2xl p-5 border border-emerald-400/15">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white/80">{client.name}</span>
            <span className="text-xs text-white/40">{DAY_LABELS[client.day]}</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 border border-emerald-400/20">SUBMITTED</span>
        </div>
        {client.loomLink && <a href={client.loomLink} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-400 hover:underline">🎥 {client.loomLink}</a>}
        {client.notes && <p className="text-xs text-white/40 mt-1">{client.notes}</p>}
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-semibold text-white/80">{client.name}</span>
        <span className="text-xs text-white/40">{DAY_LABELS[client.day]}</span>
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-white/40 uppercase tracking-wider font-medium mb-1.5">Loom Link (optional)</label>
          <input type="url" placeholder="https://www.loom.com/share/..." value={loomLink} onChange={e => setLoomLink(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/90 placeholder-white/20 outline-none focus:border-violet-500/40 transition-all" />
        </div>
        <div>
          <label className="block text-xs text-white/40 uppercase tracking-wider font-medium mb-1.5">Notes (optional)</label>
          <textarea placeholder="Notes from the call or check-in..." value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/90 placeholder-white/20 outline-none focus:border-violet-500/40 transition-all resize-none" />
        </div>
        <button
          onClick={() => onSubmit(client.name, loomLink || undefined, notes || undefined)}
          disabled={isPending || (!loomLink && !notes)}
          className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 disabled:opacity-40 text-white shadow-lg shadow-violet-500/20 transition-all"
        >
          {isPending ? "Submitting..." : "Submit"}
        </button>
      </div>
    </div>
  );
}
