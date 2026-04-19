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
] as const;

const BOOL_FIELDS_AFTER_VIDEO = [
  { key: "welcomeVideo", label: "Welcome Video" },
  { key: "subscription", label: "Subscription" },
] as const;

const DAY_OPTIONS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
const DAY_LABELS: Record<string, string> = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri" };

const COACH_COLORS: Record<string, string> = {
  Steve: "text-blue-600", Luke: "text-emerald-600", Kyah: "text-fuchsia-600",
  Rich: "text-violet-600", "Alex ": "text-amber-600", Alex: "text-amber-600",
};

const MONTH_COLORS = [
  "border-l-blue-400", "border-l-emerald-400", "border-l-violet-400", "border-l-pink-400",
  "border-l-cyan-400", "border-l-amber-400", "border-l-rose-400", "border-l-teal-400",
  "border-l-indigo-400", "border-l-orange-400", "border-l-fuchsia-400", "border-l-lime-400",
];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type Tab = "onboarding" | "completed";

export default function Onboarding() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  if (user && user.role !== "admin") { navigate("/"); return null; }

  const [tab, setTab] = useState<Tab>("onboarding");
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: onboardingClients, refetch: refetchOnboarding, isLoading: loadingOnboarding } = trpc.onboarding.list.useQuery({ status: "onboarding" });
  const { data: activeClients, refetch: refetchActive, isLoading: loadingActive } = trpc.onboarding.list.useQuery({ status: "completed" as any });
  const { data: allCoaches } = trpc.coaches.list.useQuery();
  const { data: salesStats } = trpc.onboarding.salesStats.useQuery();
  const coaches = allCoaches ?? [];

  const refetch = () => { refetchOnboarding(); refetchActive(); };

  const updateMutation = trpc.onboarding.update.useMutation({ onSuccess: () => refetch(), onError: (e) => toast.error(e.message) });
  const createMutation = trpc.onboarding.create.useMutation({ onSuccess: () => { refetch(); setShowAddForm(false); toast.success("Client added"); }, onError: (e) => toast.error(e.message) });
  const alertVideoMutation = trpc.onboarding.alertWelcomeVideo.useMutation({ onSuccess: () => { refetch(); toast.success("Alert sent to #onboarding-alerts"); }, onError: (e) => toast.error(e.message) });
  const undoVideoMutation = trpc.onboarding.undoVideoAlert.useMutation({ onSuccess: () => { refetch(); toast.success("Video alert undone"); }, onError: (e) => toast.error(e.message) });
  const finaliseMutation = trpc.onboarding.finalise.useMutation({ onSuccess: () => { refetch(); toast.success("Client finalised and moved to roster"); }, onError: (e) => toast.error(e.message) });
  const deleteMutation = trpc.onboarding.deleteClient.useMutation({ onSuccess: () => { refetch(); toast.success("Client deleted"); }, onError: (e) => toast.error(e.message) });

  const clients = tab === "onboarding" ? onboardingClients : activeClients;
  const isLoading = tab === "onboarding" ? loadingOnboarding : loadingActive;

  const filtered = useMemo(() => {
    if (!clients) return [];
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c => c.clientName.toLowerCase().includes(q) || (c.coach ?? "").toLowerCase().includes(q) || (c.notes ?? "").toLowerCase().includes(q));
  }, [clients, search]);

  const groupedByMonth = useMemo(() => {
    if (tab !== "completed" || !filtered.length) return null;
    const groups: Record<string, typeof filtered> = {};
    for (const c of filtered) {
      const d = c.datePaid || c.sentToClient || "";
      const key = d ? d.slice(0, 7) : "unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered, tab]);


  const onUpdate = (id: number, field: string, value: any) => updateMutation.mutate({ id, [field]: value });

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="bg-[#fafafa] min-h-screen">
        <div className="w-full px-6 pt-20 pb-32">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <img src="/databite-logo-navy.svg" alt="databite" className="h-6" />
              <div className="h-6 w-px bg-gray-200" />
              <span className="text-lg font-light text-gray-400 tracking-tight" style={{ fontFamily: "'Comfortaa', cursive" }}>Onboarding</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setTab("onboarding")}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${tab === "onboarding" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
                  Onboarding{onboardingClients ? ` (${onboardingClients.length})` : ""}
                </button>
                <button onClick={() => setTab("completed")}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${tab === "completed" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
                  Completed{activeClients ? ` (${activeClients.length})` : ""}
                </button>
              </div>
              {tab === "onboarding" && (
                <button onClick={() => setShowAddForm(!showAddForm)}
                  className="px-4 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors shadow-sm">
                  + Add Client
                </button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="mb-4">
            <input type="text" placeholder="Search by name, coach, or notes..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full max-w-md px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 text-sm placeholder:text-gray-300 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400/30 shadow-sm" />
          </div>

          {/* Add client modal */}
          {showAddForm && tab === "onboarding" && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddForm(false)} />
              <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 w-full max-w-lg mx-4">
                <h3 className="text-base font-bold text-gray-800 mb-4">New Client</h3>
                <AddClientForm coaches={coaches} onSubmit={data => createMutation.mutate(data)} onCancel={() => setShowAddForm(false)} isPending={createMutation.isPending} />
              </div>
            </div>
          )}

          {/* Sales summary */}
          {tab === "completed" && salesStats && salesStats.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Month</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Total</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-blue-500 uppercase tracking-wider text-[10px]">Yaman</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-pink-500 uppercase tracking-wider text-[10px]">Suzie</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Other</th>
                  </tr>
                </thead>
                <tbody>
                  {salesStats.slice(0, 8).map((row: any, idx: number) => {
                    const [y, m] = row.month.split("-");
                    const mi = parseInt(m) - 1;
                    return (
                      <tr key={row.month} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"} border-b border-gray-100 border-l-4 ${MONTH_COLORS[mi % 12]}`}>
                        <td className="px-4 py-2 font-semibold text-gray-800">{MONTH_NAMES[mi]} {y}</td>
                        <td className="text-center px-3 py-2 font-bold text-gray-900 text-sm">{row.total}</td>
                        <td className="text-center px-3 py-2 font-semibold text-blue-600">{row.bySeller?.Yaman || "—"}</td>
                        <td className="text-center px-3 py-2 font-semibold text-pink-600">{row.bySeller?.Suzie || "—"}</td>
                        <td className="text-center px-3 py-2 text-gray-400">{row.bySeller?.Unassigned || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Content */}
          {isLoading ? (
            <div className="text-center text-gray-400 py-16">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-gray-400 py-16">{tab === "onboarding" ? "No clients in onboarding." : "No completed clients yet."}</div>
          ) : tab === "onboarding" ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="w-6" />
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Client</th>
                    <th className="text-left px-1 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Paid</th>
                    <th className="text-left px-1 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Due</th>
                    <th className="text-left px-1 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Photos</th>
                    {BOOL_FIELDS.map(f => <th key={f.key} className="text-center px-1 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">{f.label}</th>)}
                    <th className="text-center px-1 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Video</th>
                    {BOOL_FIELDS_AFTER_VIDEO.map(f => <th key={f.key} className="text-center px-1 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">{f.label}</th>)}
                    <th className="text-center px-1 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Sent</th>
                    <th className="text-left px-2 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Coach</th>
                    <th className="text-left px-2 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Day</th>
                    <th className="text-center px-2 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Type</th>
                    <th className="text-center px-1 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Sale</th>
                    <th className="text-left px-2 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px] min-w-[180px]">Notes</th>
                    <th className="text-center px-2 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((client, idx) => (
                    <OnboardingRow key={client.id} client={client} coaches={coaches} idx={idx}
                      onUpdate={(f, v) => onUpdate(client.id, f, v)}
                      onAlertVideo={() => { if (confirm(`Send welcome video alert to Rich for ${client.clientName}?`)) alertVideoMutation.mutate({ id: client.id }); }}
                      onUndoVideo={() => { if (confirm(`Undo video alert for ${client.clientName}?`)) undoVideoMutation.mutate({ id: client.id }); }}
                      onDelete={() => { if (confirm(`Delete ${client.clientName}? This cannot be undone.`)) deleteMutation.mutate({ id: client.id }); }}
                      onFinalise={(cid, cn, d, pt, uw) => finaliseMutation.mutate({ id: client.id, coachId: cid, coachName: cn, dayOfWeek: d as any, paymentType: pt, upfrontWeeks: uw })} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <CompletedTable groupedByMonth={groupedByMonth!} />
          )}

          <div className="text-xs text-gray-300 text-center mt-6">{filtered.length} client{filtered.length !== 1 ? "s" : ""}</div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function OnboardingRow({ client, coaches, idx, onUpdate, onAlertVideo, onUndoVideo, onDelete, onFinalise }: {
  client: any; coaches: Array<{ id: number; name: string }>; idx: number;
  onUpdate: (field: string, value: any) => void; onAlertVideo: () => void; onUndoVideo: () => void; onDelete: () => void;
  onFinalise: (coachId: number, coachName: string, day: string, paymentType: "subscription" | "upfront", upfrontWeeks?: number) => void;
}) {
  const videoSent = !!client.videoAlertSentAt;
  const selectedDay = client.assignedDay || "";
  const paymentType = client.paymentType || "subscription";
  const coach = coaches.find(c => c.name === client.coach);
  const canFinalise = client.coach && selectedDay && coach;
  const stripe = idx % 2 === 0 ? "bg-white" : "bg-gray-50/70";

  return (
    <tr className={`${stripe} border-b border-gray-100 hover:bg-violet-100/80 transition-colors group`}>
      {/* Delete */}
      <td className="pl-2 py-2">
        <button onClick={onDelete} className="w-5 h-5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 text-[10px] font-bold">✕</button>
      </td>
      {/* Name */}
      <td className="px-3 py-2 font-semibold text-gray-800 text-[11px]">{client.clientName}</td>
      {/* Dates */}
      {(["datePaid", "dateDue", "requestedPhotos"] as const).map(field => (
        <td key={field} className="px-1 py-1">
          <input type="date" value={client[field] || ""} onChange={e => onUpdate(field, e.target.value || null)}
            onClick={e => (e.target as HTMLInputElement).showPicker?.()}
            className="w-full px-1 py-0.5 rounded border border-gray-200 text-gray-700 text-[10px] focus:outline-none focus:border-violet-400 bg-transparent cursor-pointer hover:bg-gray-50" />
        </td>
      ))}
      {/* Bool checklist */}
      {BOOL_FIELDS.map(f => (
        <td key={f.key} className="text-center px-1 py-2">
          <button onClick={() => onUpdate(f.key, !client[f.key])}
            className={`w-5 h-5 rounded text-[9px] font-bold transition-all ${client[f.key]
              ? "bg-emerald-500 text-white shadow-sm" : "bg-gray-100 border border-gray-200 text-transparent hover:border-gray-300"}`}>
            ✓
          </button>
        </td>
      ))}
      {/* Video */}
      <td className="text-center px-1 py-2">
        <button onClick={videoSent ? onUndoVideo : onAlertVideo}
          className={`w-5 h-5 rounded text-[9px] transition-all ${videoSent
            ? "bg-emerald-500 text-white shadow-sm hover:bg-red-400" : "bg-fuchsia-100 border border-fuchsia-200 text-fuchsia-500 hover:bg-fuchsia-200"}`}>
          🎬
        </button>
      </td>
      {/* Bool after video */}
      {BOOL_FIELDS_AFTER_VIDEO.map(f => (
        <td key={f.key} className="text-center px-1 py-2">
          <button onClick={() => onUpdate(f.key, !client[f.key])}
            className={`w-5 h-5 rounded text-[9px] font-bold transition-all ${client[f.key]
              ? "bg-emerald-500 text-white shadow-sm" : "bg-gray-100 border border-gray-200 text-transparent hover:border-gray-300"}`}>
            ✓
          </button>
        </td>
      ))}
      {/* Sent to Client */}
      <td className="text-center px-1 py-2">
        {(() => {
          const val = client.sentToClient;
          const auDate = val ? `${val.slice(8)}/${val.slice(5,7)}` : null;
          return (
            <button onClick={() => onUpdate("sentToClient", val ? null : new Date().toISOString().slice(0, 10))}
              className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${val
                ? "bg-emerald-500 text-white shadow-sm" : "bg-gray-100 border border-gray-200 text-gray-400 hover:border-gray-300"}`}>
              {auDate || "—"}
            </button>
          );
        })()}
      </td>
      {/* Coach */}
      <td className="px-2 py-1">
        {(() => {
          const bg = client.coach === "Steve" ? "bg-blue-50 border-blue-200 text-blue-700"
            : client.coach === "Luke" ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : client.coach === "Kyah" ? "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700"
            : client.coach === "Rich" ? "bg-violet-50 border-violet-200 text-violet-700"
            : client.coach?.startsWith("Alex") ? "bg-amber-50 border-amber-200 text-amber-700"
            : "bg-transparent border-gray-200 text-gray-400";
          return (
            <select value={client.coach || ""} onChange={e => onUpdate("coach", e.target.value || null)}
              className={`w-full px-1 py-0.5 rounded border text-[10px] font-semibold focus:outline-none focus:border-violet-400 ${bg}`}>
              <option value="">—</option>
              {coaches.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          );
        })()}
      </td>
      {/* Day */}
      <td className="px-2 py-1">
        <select value={selectedDay} onChange={e => onUpdate("assignedDay", e.target.value || null)}
          className="w-full px-1 py-0.5 rounded border border-gray-200 text-gray-700 text-[10px] focus:outline-none focus:border-violet-400 bg-transparent">
          <option value="">—</option>
          {DAY_OPTIONS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
        </select>
      </td>
      {/* Type */}
      <td className="text-center px-1 py-2">
        <button onClick={() => {
            const newType = paymentType === "subscription" ? "upfront" : "subscription";
            onUpdate("paymentType", newType);
            if (newType === "upfront" && !client.subscription) onUpdate("subscription", true);
          }}
          className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all whitespace-nowrap ${paymentType === "upfront"
            ? "bg-cyan-500 text-white shadow-sm" : "bg-violet-100 text-violet-600 border border-violet-200"}`}>
          {paymentType === "upfront" ? "Upfront" : "Sub"}
        </button>
      </td>
      {/* Sale */}
      <td className="text-center px-1 py-1">
        <select value={client.salesPerson || ""} onChange={e => onUpdate("salesPerson", e.target.value || null)}
          className={`w-full px-1 py-0.5 rounded text-[10px] font-semibold focus:outline-none border ${
            client.salesPerson === "Yaman" ? "bg-blue-50 border-blue-200 text-blue-600"
            : client.salesPerson === "Suzie" ? "bg-pink-50 border-pink-200 text-pink-600"
            : "bg-transparent border-gray-200 text-gray-400"}`}>
          <option value="">—</option>
          <option value="Yaman">Yaman</option>
          <option value="Suzie">Suzie</option>
        </select>
      </td>
      {/* Notes */}
      <td className="px-2 py-1">
        <input type="text" defaultValue={client.notes || ""} placeholder="..."
          onBlur={e => { const v = e.target.value || null; if (v !== (client.notes || null)) onUpdate("notes", v); }}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="w-full px-1.5 py-0.5 rounded border border-gray-200 text-gray-600 text-[10px] placeholder:text-gray-300 focus:outline-none focus:border-violet-400 bg-transparent" />
      </td>
      {/* Finalise */}
      <td className="px-2 py-2">
        <button disabled={!canFinalise}
          onClick={() => { if (canFinalise) onFinalise(coach!.id, coach!.name, selectedDay, paymentType as any, paymentType === "upfront" ? 14 : undefined); }}
          className="px-2.5 py-1 rounded-md bg-emerald-500 text-white text-[9px] font-semibold hover:bg-emerald-600 transition-colors disabled:bg-gray-200 disabled:text-gray-400 whitespace-nowrap shadow-sm">
          Finalise
        </button>
      </td>
    </tr>
  );
}

function CompletedTable({ groupedByMonth }: { groupedByMonth: [string, any[]][] }) {
  return (
    <div className="space-y-6">
      {groupedByMonth.map(([month, monthClients]) => {
        const [y, m] = month.split("-");
        const mi = parseInt(m || "1") - 1;
        const label = month === "unknown" ? "Unknown" : `${MONTH_NAMES[mi]} ${y}`;
        return (
          <div key={month}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-sm font-bold text-gray-800">{label}</span>
              <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">{monthClients.length} clients</span>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Client</th>
                    <th className="text-center px-2 py-2 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Sale</th>
                    <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Paid</th>
                    <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Due</th>
                    <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Started</th>
                    <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Coach</th>
                    <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {monthClients.map((c, idx) => (
                    <tr key={c.id} className={`border-l-4 ${MONTH_COLORS[mi % 12]} ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"} border-b border-gray-100 hover:bg-violet-100/80 transition-colors`}>
                      <td className="px-3 py-2 font-semibold text-gray-800">{c.clientName}</td>
                      <td className="text-center px-2 py-2">
                        <span className={`text-[10px] font-semibold ${c.salesPerson === "Yaman" ? "text-blue-600" : c.salesPerson === "Suzie" ? "text-pink-600" : "text-gray-300"}`}>{c.salesPerson || "—"}</span>
                      </td>
                      <td className="px-2 py-2 text-gray-500 text-[10px]">{c.datePaid ? c.datePaid.split("-").reverse().join("/") : "—"}</td>
                      <td className="px-2 py-2 text-gray-500 text-[10px]">{c.dateDue ? c.dateDue.split("-").reverse().join("/") : "—"}</td>
                      <td className="px-2 py-2 text-gray-500 text-[10px]">{c.sentToClient ? c.sentToClient.split("-").reverse().join("/") : "—"}</td>
                      <td className={`px-2 py-2 text-[11px] font-semibold ${COACH_COLORS[c.coach] || "text-gray-400"}`}>{c.coach || "—"}</td>
                      <td className="px-2 py-2 text-gray-400 text-[10px]">{c.notes || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AddClientForm({ coaches, onSubmit, onCancel, isPending }: {
  coaches: Array<{ id: number; name: string }>;
  onSubmit: (data: { clientName: string; datePaid?: string; dateDue?: string; salesPerson?: string; paymentType?: string; coach?: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [datePaid, setDatePaid] = useState("");
  const [dateDue, setDateDue] = useState("");
  const [salesPerson, setSalesPerson] = useState("");
  const [paymentType, setPaymentType] = useState("subscription");
  const [coach, setCoach] = useState("");

  const inputCls = "px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400/30";
  const labelCls = "text-[10px] text-gray-500 font-semibold uppercase tracking-wider";

  return (
    <div className="grid grid-cols-3 gap-3">
      <input placeholder="Client Name *" value={name} onChange={e => setName(e.target.value)}
        className={`col-span-3 ${inputCls}`} />
      <label className="flex flex-col gap-1"><span className={labelCls}>Date Paid</span>
        <input type="date" value={datePaid} onChange={e => setDatePaid(e.target.value)} onClick={e => (e.target as HTMLInputElement).showPicker?.()} className={`${inputCls} cursor-pointer`} />
      </label>
      <label className="flex flex-col gap-1"><span className={labelCls}>Date Due</span>
        <input type="date" value={dateDue} onChange={e => setDateDue(e.target.value)} onClick={e => (e.target as HTMLInputElement).showPicker?.()} className={`${inputCls} cursor-pointer`} />
      </label>
      <label className="flex flex-col gap-1"><span className={labelCls}>Sale By</span>
        <select value={salesPerson} onChange={e => setSalesPerson(e.target.value)} className={inputCls}>
          <option value="">—</option><option value="Yaman">Yaman</option><option value="Suzie">Suzie</option>
        </select>
      </label>
      <label className="flex flex-col gap-1"><span className={labelCls}>Payment Type</span>
        <select value={paymentType} onChange={e => setPaymentType(e.target.value)} className={inputCls}>
          <option value="subscription">Subscription</option><option value="upfront">Upfront</option>
        </select>
      </label>
      <label className="flex flex-col gap-1"><span className={labelCls}>Coach</span>
        <select value={coach} onChange={e => setCoach(e.target.value)} className={inputCls}>
          <option value="">—</option>
          {coaches.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </label>
      <div className="col-span-3 flex gap-2 justify-end pt-1">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
        <button onClick={() => name.trim() && onSubmit({ clientName: name.trim(), datePaid: datePaid || undefined, dateDue: dateDue || undefined, salesPerson: salesPerson || undefined, paymentType: paymentType || undefined, coach: coach || undefined })}
          disabled={!name.trim() || isPending}
          className="px-5 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-40 shadow-sm">
          {isPending ? "Adding..." : "Add Client"}
        </button>
      </div>
    </div>
  );
}
