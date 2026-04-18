import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { useLocation } from "wouter";

const CHECKLIST_FIELDS = [
  { key: "appInviteSent", label: "App Invite Sent" },
  { key: "contractSent", label: "Contract Sent" },
  { key: "requestedPhotos", label: "Requested Photos", isDate: true },
  { key: "mealPlan", label: "Meal Plan" },
  { key: "training", label: "Training" },
  { key: "sentToRich", label: "Sent to Rich" },
  { key: "welcomeVideo", label: "Welcome Video" },
  { key: "sentToClient", label: "Sent to Client", isDate: true },
  { key: "subscription", label: "Subscription" },
] as const;

export default function Onboarding() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  if (user && user.role !== "admin") { navigate("/"); return null; }

  const [search, setSearch] = useState("");
  const [coachFilter, setCoachFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: clients, refetch, isLoading } = trpc.onboarding.list.useQuery(
    { status: "onboarding", ...(coachFilter ? { coach: coachFilter } : {}) },
  );

  const importMutation = trpc.onboarding.importFromSheet.useMutation({
    onSuccess: (data) => {
      refetch();
      toast.success(`Imported ${data.imported} clients (${data.skipped} duplicates skipped)`);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.onboarding.update.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });

  const createMutation = trpc.onboarding.create.useMutation({
    onSuccess: () => { refetch(); setShowAddForm(false); toast.success("Client added"); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    if (!clients) return [];
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c => c.clientName.toLowerCase().includes(q) || (c.coach ?? "").toLowerCase().includes(q));
  }, [clients, search]);

  const coachOptions = useMemo(() => {
    if (!clients) return [];
    const set = new Set(clients.map(c => c.coach).filter(Boolean) as string[]);
    return [...set].sort();
  }, [clients]);


  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6 pt-20 max-w-4xl mx-auto">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white/90" style={{ fontFamily: "'Comfortaa', cursive" }}>Onboarding</h1>
            <p className="text-sm text-white/50 mt-1">Client onboarding checklist and tracking</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-semibold hover:bg-violet-500/30 transition-colors"
            >
              + Add Client
            </button>
            {!clients?.length && (
              <button
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending}
                className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white/60 text-sm font-semibold hover:bg-white/15 transition-colors"
              >
                {importMutation.isPending ? "Importing..." : "Import from Sheet"}
              </button>
            )}
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/90 text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-500/40"
          />
          <select
            value={coachFilter}
            onChange={e => setCoachFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm focus:outline-none"
          >
            <option value="">All coaches</option>
            {coachOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Add client form */}
        {showAddForm && <AddClientForm onSubmit={(data) => createMutation.mutate(data)} onCancel={() => setShowAddForm(false)} isPending={createMutation.isPending} />}

        {/* Client list */}
        {isLoading ? (
          <div className="text-center text-white/40 py-12">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-white/40 py-12">
            {clients?.length === 0 ? "No clients yet. Import from Google Sheet or add manually." : "No matching clients."}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(client => (
              <ClientRow
                key={client.id}
                client={client}
                isExpanded={expandedId === client.id}
                onToggle={() => setExpandedId(expandedId === client.id ? null : client.id)}
                onUpdate={(field, value) => updateMutation.mutate({ id: client.id, [field]: value })}
              />
            ))}
          </div>
        )}

        <div className="text-xs text-white/30 text-center pb-4">
          {filtered.length} client{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>
    </DashboardLayout>
  );
}

function AddClientForm({ onSubmit, onCancel, isPending }: {
  onSubmit: (data: { clientName: string; coach?: string; datePaid?: string; dateDue?: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [coach, setCoach] = useState("");
  const [datePaid, setDatePaid] = useState("");
  const [dateDue, setDateDue] = useState("");

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <h3 className="text-sm font-bold text-white/80">New Client</h3>
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Client Name *" value={name} onChange={e => setName(e.target.value)}
          className="col-span-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/90 text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-500/40" />
        <input placeholder="Coach" value={coach} onChange={e => setCoach(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/90 text-sm placeholder:text-white/30 focus:outline-none" />
        <input type="date" placeholder="Date Paid" value={datePaid} onChange={e => setDatePaid(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/90 text-sm focus:outline-none" />
        <input type="date" placeholder="Date Due" value={dateDue} onChange={e => setDateDue(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/90 text-sm focus:outline-none" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-white/50 hover:text-white/70">Cancel</button>
        <button
          onClick={() => name.trim() && onSubmit({ clientName: name.trim(), coach: coach || undefined, datePaid: datePaid || undefined, dateDue: dateDue || undefined })}
          disabled={!name.trim() || isPending}
          className="px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-semibold hover:bg-violet-500/30 transition-colors disabled:opacity-40"
        >
          {isPending ? "Adding..." : "Add Client"}
        </button>
      </div>
    </div>
  );
}

function ClientRow({ client, isExpanded, onToggle, onUpdate }: {
  client: any;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (field: string, value: any) => void;
}) {
  const checklistTotal = CHECKLIST_FIELDS.length;
  const checklistDone = CHECKLIST_FIELDS.filter(f => {
    const v = client[f.key];
    return f.isDate ? !!v : !!v;
  }).length;
  const pct = Math.round((checklistDone / checklistTotal) * 100);

  return (
    <div className="glass-btn rounded-xl overflow-hidden">
      <button className="w-full text-left px-4 py-3" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`text-xs transition-transform ${isExpanded ? "rotate-90" : ""}`}>▶</span>
            <span className="text-sm font-medium text-white/80">{client.clientName}</span>
            {client.coach && <span className="text-xs text-white/40">{client.coach}</span>}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-violet-400/60 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-white/40">{checklistDone}/{checklistTotal}</span>
            </div>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-white/[0.06] space-y-3">
          {/* Dates */}
          <div className="flex gap-4 text-xs text-white/50">
            {client.datePaid && <span>Paid: {client.datePaid}</span>}
            {client.dateDue && <span>Due: {client.dateDue}</span>}
            {client.sentToClient && <span>Started: {client.sentToClient}</span>}
          </div>

          {/* Checklist */}
          <div className="grid grid-cols-3 gap-2">
            {CHECKLIST_FIELDS.map(f => {
              const val = client[f.key];
              const checked = f.isDate ? !!val : !!val;
              return (
                <button
                  key={f.key}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (f.isDate) {
                      if (val) onUpdate(f.key, null);
                      else {
                        const today = new Date().toISOString().slice(0, 10);
                        onUpdate(f.key, today);
                      }
                    } else {
                      onUpdate(f.key, !checked);
                    }
                  }}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${checked
                    ? "bg-emerald-400/10 border border-emerald-400/20 text-emerald-300"
                    : "bg-white/[0.03] border border-white/[0.06] text-white/40 hover:bg-white/[0.06]"
                  }`}
                >
                  <span>{checked ? "✓" : "○"}</span>
                  <span>{f.label}</span>
                  {f.isDate && val && <span className="text-[9px] text-white/30">{val}</span>}
                </button>
              );
            })}
          </div>

          {/* Notes */}
          {client.notes && (
            <p className="text-xs text-white/40 italic">{client.notes}</p>
          )}

        </div>
      )}
    </div>
  );
}
