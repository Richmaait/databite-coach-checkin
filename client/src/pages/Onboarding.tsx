import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { useLocation } from "wouter";

const BOOL_FIELDS = [
  { key: "appInviteSent", label: "App Invite" },
  { key: "contractSent", label: "Contract" },
  { key: "mealPlan", label: "Meal Plan" },
  { key: "welcomeVideo", label: "Welcome Video" },
  { key: "training", label: "Training" },
  { key: "subscription", label: "Subscription" },
] as const;

const DATE_FIELDS = [
  { key: "sentToClient", label: "Sent to Client" },
] as const;

const DAY_OPTIONS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
const DAY_LABELS: Record<string, string> = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri" };

export default function Onboarding() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  if (user && user.role !== "admin") { navigate("/"); return null; }

  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: clients, refetch, isLoading } = trpc.onboarding.list.useQuery({ status: "onboarding" });
  const { data: allCoaches } = trpc.coaches.list.useQuery();
  const coaches = allCoaches ?? [];

  const updateMutation = trpc.onboarding.update.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });
  const createMutation = trpc.onboarding.create.useMutation({
    onSuccess: () => { refetch(); setShowAddForm(false); toast.success("Client added"); },
    onError: (e) => toast.error(e.message),
  });
  const alertVideoMutation = trpc.onboarding.alertWelcomeVideo.useMutation({
    onSuccess: () => toast.success("Alert sent to #onboarding-alerts"),
    onError: (e) => toast.error(e.message),
  });
  const finaliseMutation = trpc.onboarding.finalise.useMutation({
    onSuccess: () => { refetch(); toast.success("Client finalised and moved to roster"); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    if (!clients) return [];
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c => c.clientName.toLowerCase().includes(q) || (c.coach ?? "").toLowerCase().includes(q));
  }, [clients, search]);

  const onUpdate = (id: number, field: string, value: any) => updateMutation.mutate({ id, [field]: value });

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 p-6 pt-20 max-w-[1400px] mx-auto">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white/90" style={{ fontFamily: "'Comfortaa', cursive" }}>Onboarding</h1>
            <p className="text-sm text-white/50 mt-1">Client onboarding checklist and tracking</p>
          </div>
          <button onClick={() => setShowAddForm(true)}
            className="px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-semibold hover:bg-violet-500/30 transition-colors">
            + Add Client
          </button>
        </div>

        <input type="text" placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)}
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/90 text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-500/40" />

        {showAddForm && (
          <div className="glass rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white/80">New Client</h3>
            <AddClientForm onSubmit={data => createMutation.mutate(data)} onCancel={() => setShowAddForm(false)} isPending={createMutation.isPending} />
          </div>
        )}

        {isLoading ? (
          <div className="text-center text-white/40 py-12">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-white/40 py-12">No clients in onboarding.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left px-3 py-2 font-medium text-white/50 min-w-[160px]">Client</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50 min-w-[90px]">Paid</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50 min-w-[90px]">Due</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50 min-w-[90px]">Photos</th>
                  {BOOL_FIELDS.map(f => (
                    <th key={f.key} className="text-center px-1 py-2 font-medium text-white/50 min-w-[60px]">{f.label}</th>
                  ))}
                  {DATE_FIELDS.map(f => (
                    <th key={f.key} className="text-center px-1 py-2 font-medium text-white/50 min-w-[70px]">{f.label}</th>
                  ))}
                  <th className="text-left px-2 py-2 font-medium text-white/50 min-w-[90px]">Coach</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50 min-w-[70px]">Day</th>
                  <th className="text-center px-2 py-2 font-medium text-white/50 min-w-[60px]">Type</th>
                  <th className="text-center px-2 py-2 font-medium text-white/50 min-w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(client => (
                  <OnboardingRow
                    key={client.id}
                    client={client}
                    coaches={coaches}
                    onUpdate={(field, value) => onUpdate(client.id, field, value)}
                    onAlertVideo={() => alertVideoMutation.mutate({ id: client.id })}
                    onFinalise={(coachId, coachName, day, pt, uw) =>
                      finaliseMutation.mutate({ id: client.id, coachId, coachName, dayOfWeek: day as any, paymentType: pt, upfrontWeeks: uw })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-xs text-white/30 text-center pb-4">
          {filtered.length} client{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>
    </DashboardLayout>
  );
}

function OnboardingRow({ client, coaches, onUpdate, onAlertVideo, onFinalise }: {
  client: any;
  coaches: Array<{ id: number; name: string }>;
  onUpdate: (field: string, value: any) => void;
  onAlertVideo: () => void;
  onFinalise: (coachId: number, coachName: string, day: string, paymentType: "subscription" | "upfront", upfrontWeeks?: number) => void;
}) {
  const [selectedDay, setSelectedDay] = useState("");
  const [paymentType, setPaymentType] = useState<"subscription" | "upfront">("subscription");
  const [upfrontWeeks, setUpfrontWeeks] = useState(14);

  const coach = coaches.find(c => c.name === client.coach);
  const canFinalise = client.coach && selectedDay && coach;

  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
      {/* Name */}
      <td className="px-3 py-2 font-medium text-white/80">{client.clientName}</td>

      {/* Paid date */}
      <td className="px-2 py-2">
        <input type="date" value={client.datePaid || ""} onChange={e => onUpdate("datePaid", e.target.value || null)}
          className="w-full px-1.5 py-1 rounded bg-white/5 border border-white/10 text-white/70 text-[11px] focus:outline-none" />
      </td>

      {/* Due date */}
      <td className="px-2 py-2">
        <input type="date" value={client.dateDue || ""} onChange={e => onUpdate("dateDue", e.target.value || null)}
          className="w-full px-1.5 py-1 rounded bg-white/5 border border-white/10 text-white/70 text-[11px] focus:outline-none" />
      </td>

      {/* Photos date */}
      <td className="px-2 py-2">
        <input type="date" value={client.requestedPhotos || ""} onChange={e => onUpdate("requestedPhotos", e.target.value || null)}
          className="w-full px-1.5 py-1 rounded bg-white/5 border border-white/10 text-white/70 text-[11px] focus:outline-none" />
      </td>

      {/* Boolean checklist toggles */}
      {BOOL_FIELDS.map(f => {
        const checked = !!client[f.key];
        return (
          <td key={f.key} className="text-center px-1 py-2">
            <button onClick={() => onUpdate(f.key, !checked)}
              className={`w-6 h-6 rounded-md text-[10px] font-bold transition-colors ${checked
                ? "bg-emerald-400/20 border border-emerald-400/30 text-emerald-300"
                : "bg-white/[0.03] border border-white/[0.08] text-white/20 hover:bg-white/[0.06]"
              }`}>
              {checked ? "✓" : ""}
            </button>
          </td>
        );
      })}

      {/* Date checklist fields */}
      {DATE_FIELDS.map(f => {
        const val = client[f.key];
        return (
          <td key={f.key} className="text-center px-1 py-2">
            <button onClick={() => onUpdate(f.key, val ? null : new Date().toISOString().slice(0, 10))}
              className={`px-1.5 py-1 rounded text-[9px] font-medium transition-colors ${val
                ? "bg-emerald-400/15 border border-emerald-400/25 text-emerald-300"
                : "bg-white/[0.03] border border-white/[0.08] text-white/30 hover:bg-white/[0.06]"
              }`}>
              {val || "—"}
            </button>
          </td>
        );
      })}

      {/* Coach */}
      <td className="px-2 py-2">
        <select value={client.coach || ""} onChange={e => onUpdate("coach", e.target.value || null)}
          className="w-full px-1.5 py-1 rounded bg-white/5 border border-white/10 text-white/70 text-[11px] focus:outline-none">
          <option value="">—</option>
          {coaches.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </td>

      {/* Day */}
      <td className="px-2 py-2">
        <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)}
          className="w-full px-1.5 py-1 rounded bg-white/5 border border-white/10 text-white/70 text-[11px] focus:outline-none">
          <option value="">—</option>
          {DAY_OPTIONS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
        </select>
      </td>

      {/* Payment type */}
      <td className="text-center px-2 py-2">
        <button onClick={() => setPaymentType(p => p === "subscription" ? "upfront" : "subscription")}
          className={`px-2 py-1 rounded text-[9px] font-bold transition-colors whitespace-nowrap ${paymentType === "upfront"
            ? "bg-cyan-500/20 border border-cyan-500/30 text-cyan-300"
            : "bg-violet-500/15 border border-violet-500/25 text-violet-300"
          }`}>
          {paymentType === "upfront" ? `Upfront ${upfrontWeeks}w` : "Sub"}
        </button>
      </td>

      {/* Actions */}
      <td className="px-2 py-2">
        <div className="flex gap-1">
          <button onClick={onAlertVideo}
            className="px-2 py-1 rounded bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300 text-[9px] font-semibold hover:bg-fuchsia-500/20 transition-colors whitespace-nowrap">
            🎬 Video
          </button>
          <button disabled={!canFinalise}
            onClick={() => { if (canFinalise) onFinalise(coach!.id, coach!.name, selectedDay, paymentType, paymentType === "upfront" ? upfrontWeeks : undefined); }}
            className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[9px] font-semibold hover:bg-emerald-500/20 transition-colors disabled:opacity-30 whitespace-nowrap">
            Finalise
          </button>
        </div>
      </td>
    </tr>
  );
}

function AddClientForm({ onSubmit, onCancel, isPending }: {
  onSubmit: (data: { clientName: string; datePaid?: string; dateDue?: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [datePaid, setDatePaid] = useState("");
  const [dateDue, setDateDue] = useState("");

  return (
    <div className="grid grid-cols-2 gap-3">
      <input placeholder="Client Name *" value={name} onChange={e => setName(e.target.value)}
        className="col-span-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/90 text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-500/40" />
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-white/40 font-medium">Date Paid</span>
        <input type="date" value={datePaid} onChange={e => setDatePaid(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/90 text-sm focus:outline-none" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-white/40 font-medium">Date Due</span>
        <input type="date" value={dateDue} onChange={e => setDateDue(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/90 text-sm focus:outline-none" />
      </label>
      <div className="col-span-2 flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-white/50 hover:text-white/70">Cancel</button>
        <button onClick={() => name.trim() && onSubmit({ clientName: name.trim(), datePaid: datePaid || undefined, dateDue: dateDue || undefined })}
          disabled={!name.trim() || isPending}
          className="px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-semibold hover:bg-violet-500/30 transition-colors disabled:opacity-40">
          {isPending ? "Adding..." : "Add Client"}
        </button>
      </div>
    </div>
  );
}
