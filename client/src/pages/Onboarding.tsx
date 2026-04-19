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

const DATE_FIELDS = [
  { key: "sentToClient", label: "Sent to Client" },
] as const;

const DAY_OPTIONS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
const DAY_LABELS: Record<string, string> = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri" };

const MONTH_COLORS = [
  "border-l-blue-400", "border-l-emerald-400", "border-l-violet-400", "border-l-pink-400",
  "border-l-cyan-400", "border-l-amber-400", "border-l-rose-400", "border-l-teal-400",
  "border-l-indigo-400", "border-l-orange-400", "border-l-fuchsia-400", "border-l-lime-400",
];
const MONTH_BG = [
  "bg-blue-500/8", "bg-emerald-500/8", "bg-violet-500/8", "bg-pink-500/8",
  "bg-cyan-500/8", "bg-amber-500/8", "bg-rose-500/8", "bg-teal-500/8",
  "bg-indigo-500/8", "bg-orange-500/8", "bg-fuchsia-500/8", "bg-lime-500/8",
];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type Tab = "onboarding" | "completed";

// Light theme classes for onboarding page
const L = {
  bg: "bg-gray-50 min-h-screen",
  title: "text-gray-900",
  subtitle: "text-gray-500",
  card: "bg-white border border-gray-200 shadow-sm",
  input: "bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-violet-500",
  select: "bg-white border border-gray-300 text-gray-700 focus:border-violet-500",
  label: "text-gray-500",
  text: "text-gray-700",
  textMuted: "text-gray-400",
  th: "text-gray-500 border-b border-gray-200",
  td: "border-b border-gray-100",
  hover: "hover:bg-violet-50",
  tabActive: "bg-white text-gray-900 shadow-sm",
  tabInactive: "text-gray-400 hover:text-gray-600",
  checkOn: "bg-emerald-100 border border-emerald-300 text-emerald-600",
  checkOff: "bg-gray-50 border border-gray-200 text-gray-300 hover:bg-gray-100",
  btn: "bg-violet-600 text-white hover:bg-violet-700",
  btnOutline: "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50",
};

export default function Onboarding() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  if (user && user.role !== "admin") { navigate("/"); return null; }

  const [tab, setTab] = useState<Tab>("onboarding");
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: onboardingClients, refetch: refetchOnboarding, isLoading: loadingOnboarding } = trpc.onboarding.list.useQuery({ status: "onboarding" });
  const { data: activeClients, refetch: refetchActive, isLoading: loadingActive } = trpc.onboarding.list.useQuery({ status: "active" });
  const { data: allCoaches } = trpc.coaches.list.useQuery();
  const coaches = allCoaches ?? [];

  const refetch = () => { refetchOnboarding(); refetchActive(); };

  const updateMutation = trpc.onboarding.update.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });
  const createMutation = trpc.onboarding.create.useMutation({
    onSuccess: () => { refetch(); setShowAddForm(false); toast.success("Client added"); },
    onError: (e) => toast.error(e.message),
  });
  const alertVideoMutation = trpc.onboarding.alertWelcomeVideo.useMutation({
    onSuccess: () => { refetch(); toast.success("Alert sent to #onboarding-alerts"); },
    onError: (e) => toast.error(e.message),
  });
  const finaliseMutation = trpc.onboarding.finalise.useMutation({
    onSuccess: () => { refetch(); toast.success("Client finalised and moved to roster"); },
    onError: (e) => toast.error(e.message),
  });

  const clients = tab === "onboarding" ? onboardingClients : activeClients;
  const isLoading = tab === "onboarding" ? loadingOnboarding : loadingActive;

  const filtered = useMemo(() => {
    if (!clients) return [];
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c => c.clientName.toLowerCase().includes(q) || (c.coach ?? "").toLowerCase().includes(q) || (c.notes ?? "").toLowerCase().includes(q));
  }, [clients, search]);

  // Group completed by month
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

  // Sales stats for completed
  const salesStats = useMemo(() => {
    if (tab !== "completed" || !groupedByMonth) return null;
    const stats: Record<string, { total: number; bySeller: Record<string, number> }> = {};
    for (const [month, clients] of groupedByMonth) {
      stats[month] = { total: clients.length, bySeller: {} };
      for (const c of clients) {
        const seller = (c as any).salesPerson || "Unassigned";
        stats[month].bySeller[seller] = (stats[month].bySeller[seller] || 0) + 1;
      }
    }
    return stats;
  }, [groupedByMonth, tab]);

  const onUpdate = (id: number, field: string, value: any) => updateMutation.mutate({ id, [field]: value });

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className={`${L.bg}`}>
        <div className="flex flex-col gap-4 p-6 pt-20 w-full">
          <div className="flex items-start justify-between">
            <div>
              <h1 className={`text-3xl font-bold ${L.title}`} style={{ fontFamily: "'Comfortaa', cursive" }}>Onboarding</h1>
              <p className={`text-sm ${L.subtitle} mt-1`}>Client onboarding checklist and tracking</p>
            </div>
            {tab === "onboarding" && (
              <button onClick={() => setShowAddForm(true)} className={`px-4 py-2 rounded-xl ${L.btn} text-sm font-semibold transition-colors`}>
                + Add Client
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-200/60 rounded-xl p-1 w-fit">
            <button onClick={() => setTab("onboarding")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "onboarding" ? L.tabActive : L.tabInactive}`}>
              Onboarding{onboardingClients ? ` (${onboardingClients.length})` : ""}
            </button>
            <button onClick={() => setTab("completed")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "completed" ? L.tabActive : L.tabInactive}`}>
              Completed{activeClients ? ` (${activeClients.length})` : ""}
            </button>
          </div>

          <input type="text" placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)}
            className={`px-4 py-2 rounded-xl ${L.input} text-sm focus:outline-none`} />

          {showAddForm && tab === "onboarding" && (
            <div className={`${L.card} rounded-2xl p-5 space-y-4`}>
              <h3 className={`text-sm font-bold ${L.text}`}>New Client</h3>
              <AddClientForm coaches={coaches} onSubmit={data => createMutation.mutate(data)} onCancel={() => setShowAddForm(false)} isPending={createMutation.isPending} />
            </div>
          )}

          {/* Sales widget for completed tab */}
          {tab === "completed" && salesStats && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {Object.entries(salesStats).slice(0, 6).map(([month, data]) => {
                const [y, m] = month.split("-");
                const mi = parseInt(m) - 1;
                return (
                  <div key={month} className={`${L.card} rounded-xl p-3 min-w-[140px] border-l-4 ${MONTH_COLORS[mi % 12]}`}>
                    <div className={`text-xs font-bold ${L.text}`}>{MONTH_NAMES[mi]} {y}</div>
                    <div className="text-2xl font-bold text-violet-600 mt-1">{data.total}</div>
                    <div className="mt-1.5 space-y-0.5">
                      {Object.entries(data.bySeller).sort((a, b) => b[1] - a[1]).map(([seller, count]) => (
                        <div key={seller} className="flex justify-between text-[10px]">
                          <span className={seller === "Yaman" ? "text-blue-500 font-semibold" : seller === "Suzie" ? "text-pink-500 font-semibold" : L.textMuted}>{seller}</span>
                          <span className={L.text}>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isLoading ? (
            <div className={`text-center ${L.textMuted} py-12`}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div className={`text-center ${L.textMuted} py-12`}>{tab === "onboarding" ? "No clients in onboarding." : "No completed clients yet."}</div>
          ) : tab === "onboarding" ? (
            <OnboardingTable clients={filtered} coaches={coaches} onUpdate={onUpdate}
              onAlertVideo={(id) => { if (confirm("Send welcome video alert to Rich?")) alertVideoMutation.mutate({ id }); }}
              onFinalise={(id, coachId, coachName, day, pt, uw) => finaliseMutation.mutate({ id, coachId, coachName, dayOfWeek: day as any, paymentType: pt, upfrontWeeks: uw })}
            />
          ) : (
            <CompletedTable clients={filtered} groupedByMonth={groupedByMonth!} />
          )}

          <div className={`text-xs ${L.textMuted} text-center pb-4`}>
            {filtered.length} client{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function OnboardingTable({ clients, coaches, onUpdate, onAlertVideo, onFinalise }: {
  clients: any[];
  coaches: Array<{ id: number; name: string }>;
  onUpdate: (id: number, field: string, value: any) => void;
  onAlertVideo: (id: number) => void;
  onFinalise: (id: number, coachId: number, coachName: string, day: string, paymentType: "subscription" | "upfront", upfrontWeeks?: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className={`text-left px-3 py-2 font-medium ${L.th} min-w-[150px]`}>Client</th>
            <th className={`text-left px-1 py-2 font-medium ${L.th} min-w-[75px]`}>Paid</th>
            <th className={`text-left px-1 py-2 font-medium ${L.th} min-w-[75px]`}>Due</th>
            <th className={`text-left px-1 py-2 font-medium ${L.th} min-w-[75px]`}>Photos</th>
            {BOOL_FIELDS.map(f => <th key={f.key} className={`text-center px-1 py-2 font-medium ${L.th} min-w-[55px]`}>{f.label}</th>)}
            <th className={`text-center px-1 py-2 font-medium ${L.th} min-w-[45px]`}>Video</th>
            {BOOL_FIELDS_AFTER_VIDEO.map(f => <th key={f.key} className={`text-center px-1 py-2 font-medium ${L.th} min-w-[55px]`}>{f.label}</th>)}
            {DATE_FIELDS.map(f => <th key={f.key} className={`text-center px-1 py-2 font-medium ${L.th} min-w-[65px]`}>{f.label}</th>)}
            <th className={`text-left px-2 py-2 font-medium ${L.th} min-w-[80px]`}>Coach</th>
            <th className={`text-left px-2 py-2 font-medium ${L.th} min-w-[60px]`}>Day</th>
            <th className={`text-center px-2 py-2 font-medium ${L.th} min-w-[70px]`}>Type</th>
            <th className={`text-center px-1 py-2 font-medium ${L.th} min-w-[60px]`}>Sale</th>
            <th className={`text-left px-2 py-2 font-medium ${L.th} min-w-[100px]`}>Notes</th>
            <th className={`text-center px-2 py-2 font-medium ${L.th} min-w-[60px]`}>Finalise</th>
          </tr>
        </thead>
        <tbody>
          {clients.map(client => (
            <OnboardingRow key={client.id} client={client} coaches={coaches}
              onUpdate={(f, v) => onUpdate(client.id, f, v)}
              onAlertVideo={() => onAlertVideo(client.id)}
              onFinalise={(cid, cn, d, pt, uw) => onFinalise(client.id, cid, cn, d, pt, uw)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OnboardingRow({ client, coaches, onUpdate, onAlertVideo, onFinalise }: {
  client: any;
  coaches: Array<{ id: number; name: string }>;
  onUpdate: (field: string, value: any) => void;
  onAlertVideo: () => void;
  onFinalise: (coachId: number, coachName: string, day: string, paymentType: "subscription" | "upfront", upfrontWeeks?: number) => void;
}) {
  const videoSent = !!client.videoAlertSentAt;
  const selectedDay = client.assignedDay || "";
  const paymentType = client.paymentType || "subscription";
  const coach = coaches.find(c => c.name === client.coach);
  const canFinalise = client.coach && selectedDay && coach;

  return (
    <tr className={`${L.td} ${L.hover} transition-colors`}>
      <td className={`px-3 py-2 font-medium ${L.text}`}>{client.clientName}</td>
      <td className="px-1 py-1.5">
        <input type="date" value={client.datePaid || ""} onChange={e => onUpdate("datePaid", e.target.value || null)}
          className={`w-full px-1 py-0.5 rounded ${L.input} text-[10px] focus:outline-none`} />
      </td>
      <td className="px-1 py-1.5">
        <input type="date" value={client.dateDue || ""} onChange={e => onUpdate("dateDue", e.target.value || null)}
          className={`w-full px-1 py-0.5 rounded ${L.input} text-[10px] focus:outline-none`} />
      </td>
      <td className="px-1 py-1.5">
        <input type="date" value={client.requestedPhotos || ""} onChange={e => onUpdate("requestedPhotos", e.target.value || null)}
          className={`w-full px-1 py-0.5 rounded ${L.input} text-[10px] focus:outline-none`} />
      </td>
      {BOOL_FIELDS.map(f => (
        <td key={f.key} className="text-center px-1 py-2">
          <button onClick={() => onUpdate(f.key, !client[f.key])}
            className={`w-6 h-6 rounded-md text-[10px] font-bold transition-colors ${client[f.key] ? L.checkOn : L.checkOff}`}>
            {client[f.key] ? "✓" : ""}
          </button>
        </td>
      ))}
      <td className="text-center px-1 py-2">
        <button onClick={onAlertVideo}
          className={`w-6 h-6 rounded-md text-[10px] transition-colors ${videoSent
            ? L.checkOn : "bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-500 hover:bg-fuchsia-100"}`}>
          🎬
        </button>
      </td>
      {BOOL_FIELDS_AFTER_VIDEO.map(f => (
        <td key={f.key} className="text-center px-1 py-2">
          <button onClick={() => onUpdate(f.key, !client[f.key])}
            className={`w-6 h-6 rounded-md text-[10px] font-bold transition-colors ${client[f.key] ? L.checkOn : L.checkOff}`}>
            {client[f.key] ? "✓" : ""}
          </button>
        </td>
      ))}
      {DATE_FIELDS.map(f => {
        const val = client[f.key];
        const auDate = val ? val.split("-").reverse().join("/") : null;
        return (
          <td key={f.key} className="text-center px-1 py-2">
            <button onClick={() => onUpdate(f.key, val ? null : new Date().toISOString().slice(0, 10))}
              className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${val
                ? L.checkOn : L.checkOff}`}>
              {auDate || "—"}
            </button>
          </td>
        );
      })}
      <td className="px-2 py-2">
        <select value={client.coach || ""} onChange={e => onUpdate("coach", e.target.value || null)}
          className={`w-full px-1.5 py-1 rounded ${L.select} text-[11px] focus:outline-none`}>
          <option value="">—</option>
          {coaches.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </td>
      <td className="px-2 py-2">
        <select value={selectedDay} onChange={e => onUpdate("assignedDay", e.target.value || null)}
          className={`w-full px-1.5 py-1 rounded ${L.select} text-[11px] focus:outline-none`}>
          <option value="">—</option>
          {DAY_OPTIONS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
        </select>
      </td>
      <td className="text-center px-2 py-2">
        <button onClick={() => onUpdate("paymentType", paymentType === "subscription" ? "upfront" : "subscription")}
          className={`px-2 py-1 rounded text-[9px] font-bold transition-colors whitespace-nowrap ${paymentType === "upfront"
            ? "bg-cyan-100 border border-cyan-300 text-cyan-700"
            : "bg-violet-100 border border-violet-300 text-violet-700"}`}>
          {paymentType === "upfront" ? "Upfront" : "Sub"}
        </button>
      </td>
      <td className="text-center px-1 py-2">
        <select value={client.salesPerson || ""} onChange={e => onUpdate("salesPerson", e.target.value || null)}
          className={`w-full px-1 py-1 rounded text-[10px] font-semibold focus:outline-none border ${
            client.salesPerson === "Yaman" ? "bg-blue-50 border-blue-200 text-blue-600"
            : client.salesPerson === "Suzie" ? "bg-pink-50 border-pink-200 text-pink-600"
            : `${L.select}`}`}>
          <option value="">—</option>
          <option value="Yaman">Yaman</option>
          <option value="Suzie">Suzie</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <input type="text" defaultValue={client.notes || ""} placeholder="..."
          onBlur={e => { const v = e.target.value || null; if (v !== (client.notes || null)) onUpdate("notes", v); }}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className={`w-full px-1.5 py-1 rounded ${L.input} text-[10px] focus:outline-none`} />
      </td>
      <td className="px-2 py-2">
        <button disabled={!canFinalise}
          onClick={() => { if (canFinalise) onFinalise(coach!.id, coach!.name, selectedDay, paymentType as "subscription" | "upfront", paymentType === "upfront" ? 14 : undefined); }}
          className="px-2 py-1 rounded bg-emerald-100 border border-emerald-300 text-emerald-700 text-[9px] font-semibold hover:bg-emerald-200 transition-colors disabled:opacity-30 whitespace-nowrap">
          Finalise
        </button>
      </td>
    </tr>
  );
}

function CompletedTable({ clients, groupedByMonth }: { clients: any[]; groupedByMonth: [string, any[]][] }) {
  return (
    <div className="space-y-4">
      {groupedByMonth.map(([month, monthClients]) => {
        const [y, m] = month.split("-");
        const mi = parseInt(m || "1") - 1;
        const label = month === "unknown" ? "Unknown" : `${MONTH_NAMES[mi]} ${y}`;
        return (
          <div key={month}>
            <div className={`flex items-center gap-2 mb-2 px-1`}>
              <span className={`text-sm font-bold ${L.text}`}>{label}</span>
              <span className={`text-xs ${L.textMuted}`}>({monthClients.length} clients)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className={`text-left px-3 py-1.5 font-medium ${L.th} min-w-[150px]`}>Client</th>
                    <th className={`text-center px-1 py-1.5 font-medium ${L.th} min-w-[60px]`}>Sale</th>
                    <th className={`text-left px-2 py-1.5 font-medium ${L.th} min-w-[70px]`}>Paid</th>
                    <th className={`text-left px-2 py-1.5 font-medium ${L.th} min-w-[70px]`}>Due</th>
                    <th className={`text-left px-2 py-1.5 font-medium ${L.th} min-w-[70px]`}>Started</th>
                    <th className={`text-left px-2 py-1.5 font-medium ${L.th}`}>Coach</th>
                    <th className={`text-left px-2 py-1.5 font-medium ${L.th}`}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {monthClients.map(c => (
                    <tr key={c.id} className={`border-l-4 ${MONTH_COLORS[mi % 12]} ${MONTH_BG[mi % 12]} ${L.td} ${L.hover} transition-colors`}>
                      <td className={`px-3 py-1.5 font-medium ${L.text}`}>{c.clientName}</td>
                      <td className="text-center px-1 py-1.5">
                        <span className={`text-[10px] font-semibold ${
                          c.salesPerson === "Yaman" ? "text-blue-600" : c.salesPerson === "Suzie" ? "text-pink-600" : L.textMuted
                        }`}>{c.salesPerson || "—"}</span>
                      </td>
                      <td className={`px-2 py-1.5 ${L.textMuted} text-[10px]`}>{c.datePaid ? c.datePaid.split("-").reverse().join("/") : "—"}</td>
                      <td className={`px-2 py-1.5 ${L.textMuted} text-[10px]`}>{c.dateDue ? c.dateDue.split("-").reverse().join("/") : "—"}</td>
                      <td className={`px-2 py-1.5 ${L.textMuted} text-[10px]`}>{c.sentToClient ? c.sentToClient.split("-").reverse().join("/") : "—"}</td>
                      <td className={`px-2 py-1.5 ${L.text} text-[11px]`}>{c.coach || "—"}</td>
                      <td className={`px-2 py-1.5 ${L.textMuted} text-[10px]`}>{c.notes || ""}</td>
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

  return (
    <div className="grid grid-cols-3 gap-3">
      <input placeholder="Client Name *" value={name} onChange={e => setName(e.target.value)}
        className={`col-span-3 px-3 py-2 rounded-lg ${L.input} text-sm focus:outline-none`} />
      <label className="flex flex-col gap-1">
        <span className={`text-[10px] ${L.label} font-medium`}>Date Paid</span>
        <input type="date" value={datePaid} onChange={e => setDatePaid(e.target.value)}
          className={`px-3 py-2 rounded-lg ${L.input} text-sm focus:outline-none`} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={`text-[10px] ${L.label} font-medium`}>Date Due</span>
        <input type="date" value={dateDue} onChange={e => setDateDue(e.target.value)}
          className={`px-3 py-2 rounded-lg ${L.input} text-sm focus:outline-none`} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={`text-[10px] ${L.label} font-medium`}>Sale By</span>
        <select value={salesPerson} onChange={e => setSalesPerson(e.target.value)}
          className={`px-3 py-2 rounded-lg ${L.select} text-sm focus:outline-none`}>
          <option value="">—</option>
          <option value="Yaman">Yaman</option>
          <option value="Suzie">Suzie</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className={`text-[10px] ${L.label} font-medium`}>Payment Type</span>
        <select value={paymentType} onChange={e => setPaymentType(e.target.value)}
          className={`px-3 py-2 rounded-lg ${L.select} text-sm focus:outline-none`}>
          <option value="subscription">Subscription</option>
          <option value="upfront">Upfront</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className={`text-[10px] ${L.label} font-medium`}>Coach</span>
        <select value={coach} onChange={e => setCoach(e.target.value)}
          className={`px-3 py-2 rounded-lg ${L.select} text-sm focus:outline-none`}>
          <option value="">—</option>
          {coaches.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </label>
      <div className="col-span-3 flex gap-2 justify-end">
        <button onClick={onCancel} className={`px-4 py-2 text-sm ${L.textMuted} hover:text-gray-600`}>Cancel</button>
        <button onClick={() => name.trim() && onSubmit({
          clientName: name.trim(),
          datePaid: datePaid || undefined,
          dateDue: dateDue || undefined,
          salesPerson: salesPerson || undefined,
          paymentType: paymentType || undefined,
          coach: coach || undefined,
        })}
          disabled={!name.trim() || isPending}
          className={`px-4 py-2 rounded-xl ${L.btn} text-sm font-semibold transition-colors disabled:opacity-40`}>
          {isPending ? "Adding..." : "Add Client"}
        </button>
      </div>
    </div>
  );
}
