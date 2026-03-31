import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

function getTodayMelbourne(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(new Date());
}

export default function Sales() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isSales = user?.role === "sales";
  const today = getTodayMelbourne();

  // Current day's record
  const { data: todayRecord, refetch } = trpc.sales.getToday.useQuery(
    { recordDate: today },
    { enabled: !!user },
  );

  // History (admin view)
  const { data: history } = trpc.sales.getAll.useQuery(
    undefined,
    { enabled: isAdmin },
  );

  // Morning form state
  const [moodScore, setMoodScore] = useState<number>(0);
  const [intendedHours, setIntendedHours] = useState("");
  const [morningNotes, setMorningNotes] = useState("");

  // Evening form state
  const [howDayWent, setHowDayWent] = useState("");
  const [salesMade, setSalesMade] = useState<string>("");
  const [intendedHoursNextDay, setIntendedHoursNextDay] = useState("");

  const submitMorningMutation = trpc.sales.submitMorning.useMutation({
    onSuccess: () => {
      toast.success("Morning check-in submitted!");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const submitEveningMutation = trpc.sales.submitEvening.useMutation({
    onSuccess: () => {
      toast.success("Evening check-in submitted!");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const morningDone = !!todayRecord?.morningSubmittedAt;
  const eveningDone = !!todayRecord?.eveningSubmittedAt;

  // Last 14 days for history
  const recentHistory = useMemo(() => {
    if (!history) return [];
    return history.slice(0, 14);
  }, [history]);

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 p-6 pt-20 max-w-3xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-white/90" style={{ fontFamily: "'Comfortaa', cursive" }}>Sales</h1>
          <p className="text-sm text-white/50 mt-1">Daily check-ins</p>
        </div>

        {/* ── Morning Check-In ── */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="text-xl">🌅</span>
            <h2 className="text-base font-bold text-white/90">Morning Check-In</h2>
            {morningDone && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 border border-emerald-400/20">SUBMITTED</span>
            )}
          </div>

          {morningDone ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/40">Mood:</span>
                <span className="text-white/80">{"⭐".repeat(todayRecord?.moodScore ?? 0)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/40">Intended hours:</span>
                <span className="text-white/80">{todayRecord?.intendedWorkingHours ?? "—"}</span>
              </div>
              {todayRecord?.morningNotes && (
                <div className="text-sm">
                  <span className="text-white/40">Notes:</span>
                  <span className="text-white/80 ml-2">{todayRecord.morningNotes}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mood */}
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider font-medium mb-2">How are you feeling today?</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setMoodScore(n)}
                      className={`w-10 h-10 rounded-xl text-lg transition-all ${moodScore >= n ? "bg-violet-500/30 border-violet-500/40 scale-110" : "bg-white/5 border-white/10"} border`}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
              </div>

              {/* Intended hours */}
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider font-medium mb-2">Intended working hours today</label>
                <input
                  type="text"
                  placeholder="e.g. 9am - 5pm"
                  value={intendedHours}
                  onChange={(e) => setIntendedHours(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/90 placeholder-white/20 outline-none focus:border-violet-500/40 transition-all"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider font-medium mb-2">Notes (optional)</label>
                <textarea
                  placeholder="Anything on your mind..."
                  value={morningNotes}
                  onChange={(e) => setMorningNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/90 placeholder-white/20 outline-none focus:border-violet-500/40 transition-all resize-none"
                />
              </div>

              <button
                onClick={() => submitMorningMutation.mutate({ recordDate: today, moodScore: moodScore || undefined, intendedWorkingHours: intendedHours || undefined, morningNotes: morningNotes || undefined })}
                disabled={submitMorningMutation.isPending || !moodScore}
                className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 disabled:opacity-40 text-white shadow-lg shadow-violet-500/20 transition-all"
              >
                {submitMorningMutation.isPending ? "Submitting..." : "Submit Morning Check-In"}
              </button>
            </div>
          )}
        </div>

        {/* ── Evening Check-In ── */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="text-xl">🌙</span>
            <h2 className="text-base font-bold text-white/90">Evening Check-In</h2>
            {eveningDone && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 border border-emerald-400/20">SUBMITTED</span>
            )}
          </div>

          {eveningDone ? (
            <div className="space-y-2">
              {todayRecord?.howDayWent && (
                <div className="text-sm">
                  <span className="text-white/40">How day went:</span>
                  <span className="text-white/80 ml-2">{todayRecord.howDayWent}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/40">Sales made:</span>
                <span className="text-white/80">{todayRecord?.salesMade ?? 0}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/40">Tomorrow's hours:</span>
                <span className="text-white/80">{todayRecord?.intendedHoursNextDay ?? "—"}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* How day went */}
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider font-medium mb-2">How did your day go?</label>
                <textarea
                  placeholder="How was your day..."
                  value={howDayWent}
                  onChange={(e) => setHowDayWent(e.target.value)}
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/90 placeholder-white/20 outline-none focus:border-violet-500/40 transition-all resize-none"
                />
              </div>

              {/* Sales made */}
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider font-medium mb-2">Sales made today</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={salesMade}
                  onChange={(e) => setSalesMade(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/90 placeholder-white/20 outline-none focus:border-violet-500/40 transition-all"
                />
              </div>

              {/* Intended hours next day */}
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider font-medium mb-2">Intended working hours tomorrow</label>
                <input
                  type="text"
                  placeholder="e.g. 9am - 5pm"
                  value={intendedHoursNextDay}
                  onChange={(e) => setIntendedHoursNextDay(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/90 placeholder-white/20 outline-none focus:border-violet-500/40 transition-all"
                />
              </div>

              <button
                onClick={() => submitEveningMutation.mutate({ recordDate: today, howDayWent: howDayWent || undefined, salesMade: salesMade ? parseInt(salesMade) : undefined, intendedHoursNextDay: intendedHoursNextDay || undefined })}
                disabled={submitEveningMutation.isPending}
                className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 disabled:opacity-40 text-white shadow-lg shadow-violet-500/20 transition-all"
              >
                {submitEveningMutation.isPending ? "Submitting..." : "Submit Evening Check-In"}
              </button>
            </div>
          )}
        </div>

        {/* ── History (admin view) ── */}
        {isAdmin && recentHistory.length > 0 && (
          <div className="glass rounded-2xl p-6">
            <h2 className="text-base font-bold text-white/90 mb-4">Recent History</h2>
            <div className="space-y-3">
              {recentHistory.map((r) => (
                <div key={r.id} className="glass-btn rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white/80">{r.recordDate}</span>
                    <div className="flex items-center gap-2">
                      {r.morningSubmittedAt && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">AM</span>}
                      {r.eveningSubmittedAt && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20">PM</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-white/50">
                    {r.moodScore && <span>Mood: {"⭐".repeat(r.moodScore)}</span>}
                    {r.intendedWorkingHours && <span>Hours: {r.intendedWorkingHours}</span>}
                    {r.salesMade != null && <span>Sales: {r.salesMade}</span>}
                    {r.intendedHoursNextDay && <span>Tomorrow: {r.intendedHoursNextDay}</span>}
                  </div>
                  {r.howDayWent && <p className="text-xs text-white/40 mt-1">{r.howDayWent}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
