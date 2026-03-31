import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

function getTodayMelbourne(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(new Date());
}

const MOOD_OPTIONS = [
  { score: 1, emoji: "😔", label: "Not good" },
  { score: 2, emoji: "😕", label: "Below average" },
  { score: 3, emoji: "😐", label: "Okay" },
  { score: 4, emoji: "🙂", label: "Good" },
  { score: 5, emoji: "🤩", label: "Amazing" },
];

// Time options (same as coach portal)
const TIME_OPTIONS: string[] = [];
for (let h = 5; h <= 23; h++) {
  for (const m of [0, 30]) {
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const ampm = h < 12 ? "am" : "pm";
    const minStr = m === 0 ? ":00" : ":30";
    TIME_OPTIONS.push(`${hour12}${minStr}${ampm}`);
  }
}

function buildWorkingHours(b1s: string, b1e: string, split: boolean, b2s: string, b2e: string): string {
  if (!b1s || !b1e) return "";
  const block1 = `${b1s}-${b1e}`;
  if (split && b2s && b2e) return `${block1}, ${b2s}-${b2e}`;
  return block1;
}

function timeIdx(t: string): number { return TIME_OPTIONS.indexOf(t); }

function validateTimeBlocks(b1s: string, b1e: string, split: boolean, b2s: string, b2e: string): string[] {
  const warnings: string[] = [];
  if (b1s && b1e && timeIdx(b1e) <= timeIdx(b1s)) warnings.push("Block 1: end time must be after start time.");
  if (split) {
    if (b2s && b2e && timeIdx(b2e) <= timeIdx(b2s)) warnings.push("Block 2: end time must be after start time.");
    if (b1e && b2s && timeIdx(b2s) < timeIdx(b1e)) warnings.push("Block 2 should start after Block 1 ends.");
  }
  return warnings;
}

function TimeBlockSelector({ block1Start, setBlock1Start, block1End, setBlock1End, hasSplitDay, setHasSplitDay, block2Start, setBlock2Start, block2End, setBlock2End }: {
  block1Start: string; setBlock1Start: (v: string) => void;
  block1End: string; setBlock1End: (v: string) => void;
  hasSplitDay: boolean; setHasSplitDay: (v: boolean) => void;
  block2Start: string; setBlock2Start: (v: string) => void;
  block2End: string; setBlock2End: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select value={block1Start} onValueChange={setBlock1Start}>
          <SelectTrigger className="bg-white/5 border-white/10 text-sm flex-1"><SelectValue placeholder="Start" /></SelectTrigger>
          <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-xs text-white/50 shrink-0">to</span>
        <Select value={block1End} onValueChange={setBlock1End}>
          <SelectTrigger className="bg-white/5 border-white/10 text-sm flex-1"><SelectValue placeholder="End" /></SelectTrigger>
          <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {hasSplitDay && (
        <div className="flex items-center gap-2">
          <Select value={block2Start} onValueChange={setBlock2Start}>
            <SelectTrigger className="bg-white/5 border-white/10 text-sm flex-1"><SelectValue placeholder="Start" /></SelectTrigger>
            <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <span className="text-xs text-white/50 shrink-0">to</span>
          <Select value={block2End} onValueChange={setBlock2End}>
            <SelectTrigger className="bg-white/5 border-white/10 text-sm flex-1"><SelectValue placeholder="End" /></SelectTrigger>
            <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <Button type="button" variant="outline" size="sm" className="text-xs w-full"
        onClick={() => { setHasSplitDay(!hasSplitDay); if (hasSplitDay) { setBlock2Start(""); setBlock2End(""); } }}>
        {hasSplitDay ? "Remove second block" : "+ Add second time block (split day)"}
      </Button>
      {validateTimeBlocks(block1Start, block1End, hasSplitDay, block2Start, block2End).map((warn, i) => (
        <p key={i} className="text-xs text-amber-300 flex items-center gap-1"><span>⚠</span> {warn}</p>
      ))}
    </div>
  );
}

export default function Sales() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const today = getTodayMelbourne();

  const { data: todayRecord, refetch } = trpc.sales.getToday.useQuery({ recordDate: today }, { enabled: !!user });
  const { data: history } = trpc.sales.getAll.useQuery(undefined, { enabled: isAdmin });

  // Morning
  const [moodScore, setMoodScore] = useState<number | null>(null);
  const [morningNotes, setMorningNotes] = useState("");
  const [m1Start, setM1Start] = useState(""); const [m1End, setM1End] = useState("");
  const [mSplit, setMSplit] = useState(false);
  const [m2Start, setM2Start] = useState(""); const [m2End, setM2End] = useState("");

  // Evening
  const [eveningMood, setEveningMood] = useState<number | null>(null);
  const [eveningNotes, setEveningNotes] = useState("");
  const [salesMade, setSalesMade] = useState("");
  const [e1Start, setE1Start] = useState(""); const [e1End, setE1End] = useState("");
  const [eSplit, setESplit] = useState(false);
  const [e2Start, setE2Start] = useState(""); const [e2End, setE2End] = useState("");

  const submitMorningMutation = trpc.sales.submitMorning.useMutation({
    onSuccess: () => { toast.success("Morning check-in submitted!"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const submitEveningMutation = trpc.sales.submitEvening.useMutation({
    onSuccess: () => { toast.success("Evening check-in submitted!"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const morningDone = !!todayRecord?.morningSubmittedAt;
  const eveningDone = !!todayRecord?.eveningSubmittedAt;
  const recentHistory = useMemo(() => (history ?? []).slice(0, 14), [history]);

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 p-6 pt-20 max-w-3xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-white/90" style={{ fontFamily: "'Comfortaa', cursive" }}>Sales</h1>
          <p className="text-sm text-white/50 mt-1">Daily check-ins</p>
        </div>

        {/* ── Morning ── */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="text-xl">🌅</span>
            <h2 className="text-base font-bold text-white/90">Morning Check-In</h2>
            {morningDone && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 border border-emerald-400/20">SUBMITTED</span>}
          </div>
          {morningDone ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/40">Mood:</span>
                <span className="text-xl">{todayRecord?.moodScore ? MOOD_OPTIONS[todayRecord.moodScore - 1]?.emoji : "—"}</span>
                <span className="text-white/60 text-xs">{todayRecord?.moodScore ? MOOD_OPTIONS[todayRecord.moodScore - 1]?.label : ""}</span>
              </div>
              {todayRecord?.intendedWorkingHours && <div className="text-sm"><span className="text-white/40">Hours:</span> <span className="text-white/80">{todayRecord.intendedWorkingHours}</span></div>}
              {todayRecord?.morningNotes && <div className="text-sm"><span className="text-white/40">Notes:</span> <span className="text-white/80">{todayRecord.morningNotes}</span></div>}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider font-medium mb-2">How are you feeling today?</label>
                <div className="flex gap-2">
                  {MOOD_OPTIONS.map(({ score, emoji, label }) => (
                    <button key={score} onClick={() => setMoodScore(moodScore === score ? null : score)} title={label}
                      className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl border transition-all duration-150 ${moodScore === score ? "bg-violet-500/20 border-violet-500/40 scale-105" : "bg-white/5 border-white/10 hover:bg-white/[0.08]"}`}>
                      <span className="text-2xl leading-none">{emoji}</span>
                      <span className="text-[10px] text-white/50 leading-tight text-center">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider font-medium mb-2">Working hours today</label>
                <TimeBlockSelector block1Start={m1Start} setBlock1Start={setM1Start} block1End={m1End} setBlock1End={setM1End}
                  hasSplitDay={mSplit} setHasSplitDay={setMSplit} block2Start={m2Start} setBlock2Start={setM2Start} block2End={m2End} setBlock2End={setM2End} />
              </div>
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider font-medium mb-2">Notes (optional)</label>
                <textarea placeholder="Anything on your mind..." value={morningNotes} onChange={(e) => setMorningNotes(e.target.value)} rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/90 placeholder-white/20 outline-none focus:border-violet-500/40 transition-all resize-none" />
              </div>
              <button
                onClick={() => submitMorningMutation.mutate({ recordDate: today, moodScore: moodScore ?? undefined, intendedWorkingHours: buildWorkingHours(m1Start, m1End, mSplit, m2Start, m2End) || undefined, morningNotes: morningNotes || undefined })}
                disabled={submitMorningMutation.isPending || !moodScore}
                className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 disabled:opacity-40 text-white shadow-lg shadow-violet-500/20 transition-all">
                {submitMorningMutation.isPending ? "Submitting..." : "Submit Morning Check-In"}
              </button>
            </div>
          )}
        </div>

        {/* ── Evening ── */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="text-xl">🌙</span>
            <h2 className="text-base font-bold text-white/90">Evening Check-In</h2>
            {eveningDone && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 border border-emerald-400/20">SUBMITTED</span>}
          </div>
          {eveningDone ? (
            <div className="space-y-2">
              {todayRecord?.howDayWent && <div className="text-sm"><span className="text-white/40">How day went:</span> <span className="text-white/80">{todayRecord.howDayWent}</span></div>}
              <div className="text-sm"><span className="text-white/40">Sales made:</span> <span className="text-white/80 font-semibold">{todayRecord?.salesMade ?? 0}</span></div>
              {todayRecord?.intendedHoursNextDay && <div className="text-sm"><span className="text-white/40">Start tomorrow:</span> <span className="text-white/80"> {todayRecord.intendedHoursNextDay === "not-working" ? "Not working" : todayRecord.intendedHoursNextDay}</span></div>}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider font-medium mb-2">How did your day go?</label>
                <div className="flex gap-2">
                  {MOOD_OPTIONS.map(({ score, emoji, label }) => (
                    <button key={score} onClick={() => setEveningMood(eveningMood === score ? null : score)} title={label}
                      className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl border transition-all duration-150 ${eveningMood === score ? "bg-violet-500/20 border-violet-500/40 scale-105" : "bg-white/5 border-white/10 hover:bg-white/[0.08]"}`}>
                      <span className="text-2xl leading-none">{emoji}</span>
                      <span className="text-[10px] text-white/50 leading-tight text-center">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider font-medium mb-2">Notes (optional)</label>
                <textarea placeholder="Anything to add about your day..." value={eveningNotes} onChange={(e) => setEveningNotes(e.target.value)} rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/90 placeholder-white/20 outline-none focus:border-violet-500/40 transition-all resize-none" />
              </div>
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider font-medium mb-2">Sales made today</label>
                <input type="number" min="0" placeholder="0" value={salesMade} onChange={(e) => setSalesMade(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/90 placeholder-white/20 outline-none focus:border-violet-500/40 transition-all" />
              </div>
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider font-medium mb-2">Intended start time tomorrow</label>
                <div className="space-y-2">
                  <Select value={e1Start} onValueChange={setE1Start}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-sm w-full"><SelectValue placeholder="Select start time" /></SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.filter(t => {
                        const match = t.match(/^(\d+):(\d+)(am|pm)$/);
                        if (!match) return false;
                        let h = parseInt(match[1]);
                        if (match[3] === "pm" && h !== 12) h += 12;
                        if (match[3] === "am" && h === 12) h = 0;
                        return h >= 7 && h <= 13;
                      }).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      <SelectItem value="not-working">Not working tomorrow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <button
                onClick={() => {
                  const moodLabel = eveningMood ? `${MOOD_OPTIONS[eveningMood - 1].emoji} ${MOOD_OPTIONS[eveningMood - 1].label}` : undefined;
                  const notes = eveningNotes.trim() ? `${moodLabel ? moodLabel + " — " : ""}${eveningNotes.trim()}` : moodLabel;
                  submitEveningMutation.mutate({ recordDate: today, howDayWent: notes || undefined, salesMade: salesMade ? parseInt(salesMade) : undefined, intendedHoursNextDay: e1Start || undefined });
                }}
                disabled={submitEveningMutation.isPending}
                className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 disabled:opacity-40 text-white shadow-lg shadow-violet-500/20 transition-all">
                {submitEveningMutation.isPending ? "Submitting..." : "Submit Evening Check-In"}
              </button>
            </div>
          )}
        </div>

        {/* ── Admin History ── */}
        {isAdmin && recentHistory.length > 0 && (
          <div className="glass rounded-2xl p-6">
            <h2 className="text-base font-bold text-white/90 mb-4">Recent Check-Ins</h2>
            <div className="space-y-3">
              {recentHistory.map((r) => (
                <div key={r.id} className="glass-btn rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white/80">{r.recordDate}</span>
                      <span className="text-xs text-white/40">{r.userName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.morningSubmittedAt && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">🌅 AM</span>}
                      {r.eveningSubmittedAt && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20">🌙 PM</span>}
                    </div>
                  </div>
                  {r.morningSubmittedAt && (
                    <div className="flex items-center gap-4 text-xs text-white/50 mb-1">
                      {r.moodScore && <span>{MOOD_OPTIONS[r.moodScore - 1]?.emoji} {MOOD_OPTIONS[r.moodScore - 1]?.label}</span>}
                      {r.intendedWorkingHours && <span>Hours: {r.intendedWorkingHours}</span>}
                    </div>
                  )}
                  {r.morningNotes && <p className="text-xs text-white/40 mb-1">AM: {r.morningNotes}</p>}
                  {r.eveningSubmittedAt && (
                    <div className="flex items-center gap-4 text-xs text-white/50 mb-1">
                      {r.salesMade != null && <span className="font-semibold text-emerald-400">Sales: {r.salesMade}</span>}
                      {r.intendedHoursNextDay && <span>Tomorrow: {r.intendedHoursNextDay}</span>}
                    </div>
                  )}
                  {r.howDayWent && <p className="text-xs text-white/40">PM: {r.howDayWent}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
