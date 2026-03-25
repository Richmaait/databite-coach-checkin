import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Clock, MessageSquare, Sun, TrendingDown, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function getTodayDate() {
  // Use Intl API for Australia/Melbourne — handles DST automatically (AEDT UTC+11 in summer, AEST UTC+10 in winter)
  // en-CA locale returns YYYY-MM-DD format which is what the backend expects
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Generate time options in 30-minute increments from 5:00am to 11:00pm
const TIME_OPTIONS: string[] = [];
for (let h = 5; h <= 23; h++) {
  for (const m of [0, 30]) {
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const ampm = h < 12 ? "am" : "pm";
    const minStr = m === 0 ? ":00" : ":30";
    TIME_OPTIONS.push(`${hour12}${minStr}${ampm}`);
  }
}

function buildWorkingHours(
  b1s: string, b1e: string,
  split: boolean, b2s: string, b2e: string
): string {
  if (!b1s || !b1e) return "";
  const block1 = `${b1s}-${b1e}`;
  if (split && b2s && b2e) return `${block1}, ${b2s}-${b2e}`;
  return block1;
}
function timeIdx(t: string): number {
  return TIME_OPTIONS.indexOf(t);
}
function validateTimeBlocks(
  b1s: string, b1e: string,
  split: boolean, b2s: string, b2e: string
): string[] {
  const warnings: string[] = [];
  if (b1s && b1e && timeIdx(b1e) <= timeIdx(b1s)) {
    warnings.push("Block 1: end time must be after start time.");
  }
  if (split) {
    if (b2s && b2e && timeIdx(b2e) <= timeIdx(b2s)) {
      warnings.push("Block 2: end time must be after start time.");
    }
    if (b1e && b2s && timeIdx(b2s) < timeIdx(b1e)) {
      warnings.push("Block 2 starts before block 1 ends — the two blocks overlap.");
    }
  }
  return warnings;
}

export default function CoachPortal() {
  const { user } = useAuth();
  const today = getTodayDate();
  const utils = trpc.useUtils();

  const { data: coaches } = trpc.coaches.list.useQuery();
  // Admins can submit for any coach; non-admins need their own profile
  const { data: myCoach } = trpc.coaches.myCoach.useQuery(undefined, {
    enabled: !!user && user?.role !== "admin",
  });

  const isAdmin = user?.role === "admin";

  // For admins, allow selecting any coach; for coaches, use their own profile
  const [selectedCoachId, setSelectedCoachId] = useState<number | null>(null);
  const effectiveCoachId = isAdmin ? selectedCoachId : (myCoach?.id ?? null);

  const { data: pendingClients } = trpc.clientCheckins.getTodayPendingClients.useQuery(
    { coachId: effectiveCoachId!, date: today },
    { enabled: !!effectiveCoachId, staleTime: 60 * 1000 }
  );

  const { data: todayRecords, refetch: refetchToday } = trpc.checkins.todayByCoach.useQuery(
    { coachId: effectiveCoachId!, recordDate: today },
    { enabled: !!effectiveCoachId }
  );

  const morningRecord = todayRecords?.find(r => r.submissionType === "morning");
  const followupRecord = todayRecords?.find(r => r.submissionType === "followup");
  const disengagementRecord = todayRecords?.find(r => r.submissionType === "disengagement");

  // Edit mode flags
  const [editingMorning, setEditingMorning] = useState(false);
  const [editingFollowup, setEditingFollowup] = useState(false);
  const [editingDisengagement, setEditingDisengagement] = useState(false);

  // Morning form state
  const [morningNotes, setMorningNotes] = useState("");
  const [moodScore, setMoodScore] = useState<number | null>(null);
  const [actionPlan, setActionPlan] = useState("");
  // Working hours time-block state
  const [block1Start, setBlock1Start] = useState("");
  const [block1End, setBlock1End] = useState("");
  const [hasSplitDay, setHasSplitDay] = useState(false);
  const [block2Start, setBlock2Start] = useState("");
  const [block2End, setBlock2End] = useState("");

  // Follow-up form state
  const [followupCount, setFollowupCount] = useState("");
  const [followupNotes, setFollowupNotes] = useState("");

  // Disengagement form state
  const [disengagementCount, setDisengagementCount] = useState("");
  const [disengagementNotes, setDisengagementNotes] = useState("");


  const submitMorning = trpc.checkins.submitMorning.useMutation({
    onSuccess: (data) => {
      const verb = data.updated ? "updated" : "submitted";
      toast.success(`Morning review ${verb}`);
      setMorningNotes(""); setMoodScore(null); setActionPlan("");
      setBlock1Start(""); setBlock1End(""); setHasSplitDay(false); setBlock2Start(""); setBlock2End("");
      setEditingMorning(false);
      refetchToday();
    },
    onError: (e) => toast.error(e.message),
  });

  const submitFollowup = trpc.checkins.submitFollowup.useMutation({
    onSuccess: (data) => {
      toast.success(data.updated ? "Follow-up outreach updated" : "Follow-up outreach logged");
      setFollowupCount(""); setFollowupNotes("");
      setEditingFollowup(false);
      refetchToday();
    },
    onError: (e) => toast.error(e.message),
  });

  const submitDisengagement = trpc.checkins.submitDisengagement.useMutation({
    onSuccess: (data) => {
      toast.success(data.updated ? "Disengagement outreach updated" : "Disengagement outreach logged");
      setDisengagementCount(""); setDisengagementNotes("");
      setEditingDisengagement(false);
      refetchToday();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!user) return null;

  if (!isAdmin && !myCoach) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto py-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted border border-border flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">No Coach Profile Linked</h2>
          <p className="text-muted-foreground text-sm">
            Your account hasn't been linked to a coach profile. Please ask your manager to link your account in Team Management.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const coachName = isAdmin
    ? coaches?.find(c => c.id === selectedCoachId)?.name ?? "Select a coach"
    : myCoach?.name ?? user.name ?? "You";

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6 py-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Daily Check-Ins</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {new Date().toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          {isAdmin && coaches && (
            <Select
              value={selectedCoachId?.toString() ?? ""}
              onValueChange={(v) => setSelectedCoachId(parseInt(v))}
            >
              <SelectTrigger className="w-44 bg-secondary border-border">
                <SelectValue placeholder="Select coach" />
              </SelectTrigger>
              <SelectContent>
                {coaches.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {!effectiveCoachId && isAdmin && (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center text-muted-foreground text-sm">
              Select a coach above to view or submit their check-ins.
            </CardContent>
          </Card>
        )}

        {effectiveCoachId && (
          <>
            {/* ── 1. Morning Review ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Sun className="h-4 w-4 text-amber-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Morning Review</CardTitle>
                    <CardDescription className="text-xs">Complete before starting new work day</CardDescription>
                  </div>
                  {morningRecord && (
                    <Badge className="ml-auto bg-primary/10 text-primary border-primary/20 text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Submitted
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {morningRecord && !editingMorning ? (
                  <div className="space-y-3">

                    {morningRecord.moodScore && (
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-sm text-muted-foreground">How you felt</span>
                        <span className="text-xl">{["😔","😕","😐","🙂","🤩"][morningRecord.moodScore - 1]}</span>
                        <span className="text-xs text-muted-foreground">{["Not good","Below average","Okay","Good","Amazing"][morningRecord.moodScore - 1]}</span>
                      </div>
                    )}
                    {morningRecord.actionPlan && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Action plan</p>
                        <p className="text-sm text-foreground bg-muted rounded-lg px-3 py-2 whitespace-pre-wrap">{morningRecord.actionPlan}</p>
                      </div>
                    )}
                    {morningRecord.workingHours && (
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-sm text-muted-foreground">Working hours</span>
                        <span className="text-sm font-semibold text-foreground">{morningRecord.workingHours}</span>
                      </div>
                    )}
                    {morningRecord.notes && (
                      <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">{morningRecord.notes}</p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs mt-1"
                      onClick={() => {
                        setMorningNotes(morningRecord.notes ?? "");
                        setMoodScore(morningRecord.moodScore ?? null);
                        setActionPlan(morningRecord.actionPlan ?? "");
                        // Parse workingHours back into time blocks
                        const wh = morningRecord.workingHours ?? "";
                        const parts = wh.split(",").map((s: string) => s.trim());
                        const [b1s, b1e] = parts[0] ? parts[0].split("-") : ["", ""];
                        setBlock1Start(b1s ?? ""); setBlock1End(b1e ?? "");
                        if (parts[1]) {
                          const [b2s, b2e] = parts[1].split("-");
                          setBlock2Start(b2s ?? ""); setBlock2End(b2e ?? "");
                          setHasSplitDay(true);
                        } else {
                          setBlock2Start(""); setBlock2End(""); setHasSplitDay(false);
                        }
                        setEditingMorning(true);
                      }}
                    >
                      Edit Today&apos;s Submission
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Mood picker — first question */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">How are you feeling today?</Label>
                      <div className="flex gap-2">
                        {[
                          { score: 1, emoji: "😔", label: "Not good" },
                          { score: 2, emoji: "😕", label: "Below average" },
                          { score: 3, emoji: "😐", label: "Okay" },
                          { score: 4, emoji: "🙂", label: "Good" },
                          { score: 5, emoji: "🤩", label: "Amazing" },
                        ].map(({ score, emoji, label }) => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => setMoodScore(moodScore === score ? null : score)}
                            title={label}
                            className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl border transition-all duration-150 ${
                              moodScore === score
                                ? "border-primary bg-primary/10 scale-105"
                                : "border-border bg-secondary hover:border-primary/40 hover:bg-secondary/80"
                            }`}
                          >
                            <span className="text-2xl leading-none">{emoji}</span>
                            <span className="text-[10px] text-muted-foreground leading-tight text-center">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>





                    {/* Action plan + hours */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">What is your action plan for today?</Label>
                      <Textarea
                        placeholder="e.g. Morning check-ins, follow-up with disengaged clients, team meeting at 2pm..."
                        value={actionPlan}
                        onChange={e => setActionPlan(e.target.value)}
                        className="bg-input border-border resize-none text-sm"
                        rows={3}
                      />
                    </div>
                    {/* Working hours time-block selector */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Working hours today</Label>
                      {/* Block 1 */}
                      <div className="flex items-center gap-2">
                        <Select value={block1Start} onValueChange={setBlock1Start}>
                          <SelectTrigger className="bg-input border-border text-sm flex-1">
                            <SelectValue placeholder="Start time" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground shrink-0">to</span>
                        <Select value={block1End} onValueChange={setBlock1End}>
                          <SelectTrigger className="bg-input border-border text-sm flex-1">
                            <SelectValue placeholder="End time" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Block 2 (split day) */}
                      {hasSplitDay && (
                        <div className="flex items-center gap-2">
                          <Select value={block2Start} onValueChange={setBlock2Start}>
                            <SelectTrigger className="bg-input border-border text-sm flex-1">
                              <SelectValue placeholder="Start time" />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground shrink-0">to</span>
                          <Select value={block2End} onValueChange={setBlock2End}>
                            <SelectTrigger className="bg-input border-border text-sm flex-1">
                              <SelectValue placeholder="End time" />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs w-full"
                        onClick={() => { setHasSplitDay(v => !v); if (hasSplitDay) { setBlock2Start(""); setBlock2End(""); } }}
                      >
                        {hasSplitDay ? "Remove second block" : "+ Add second time block (split day)"}
                      </Button>
                      {/* Validation warnings */}
                      {validateTimeBlocks(block1Start, block1End, hasSplitDay, block2Start, block2End).map((warn, i) => (
                        <p key={i} className="text-xs text-amber-400 flex items-center gap-1">
                          <span>⚠</span> {warn}
                        </p>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Notes (optional, however please ensure you include any deviation from your regular working hours)</Label>
                      <Textarea
                        placeholder="Any context or observations..."
                        value={morningNotes}
                        onChange={e => setMorningNotes(e.target.value)}
                        className="bg-input border-border resize-none text-sm"
                        rows={2}
                      />
                    </div>

                    <div className="flex gap-2">
                      {editingMorning && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => { setEditingMorning(false); setMorningNotes(""); setMoodScore(null); setActionPlan(""); setBlock1Start(""); setBlock1End(""); setHasSplitDay(false); setBlock2Start(""); setBlock2End(""); }}
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        onClick={() => submitMorning.mutate({
                          coachId: effectiveCoachId,
                          recordDate: today,
                          moodScore: moodScore ?? undefined,
                          actionPlan: actionPlan || undefined,
                          workingHours: buildWorkingHours(block1Start, block1End, hasSplitDay, block2Start, block2End) || undefined,
                          notes: morningNotes || undefined,
                        })}
                        disabled={submitMorning.isPending}
                        className="flex-1"
                      >
                        {submitMorning.isPending ? "Saving..." : editingMorning ? "Update Morning Review" : "Submit Morning Review"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── 2. Follow-Up Outreach ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Follow-Up Outreach</CardTitle>
                    <CardDescription className="text-xs">Between 10:30–11:00am (after check-in cut-off)</CardDescription>
                  </div>
                  {followupRecord && (
                    <Badge className="ml-auto bg-primary/10 text-primary border-primary/20 text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Submitted
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {followupRecord && !editingFollowup ? (
                  <div className="space-y-2">
                    <div className="rounded-xl bg-secondary p-4 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Messages sent to missed check-ins</span>
                      <span className="text-2xl font-bold text-foreground">{followupRecord.followupMessagesSent}</span>
                    </div>
                    {followupRecord.notes && (
                      <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">{followupRecord.notes}</p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        setFollowupCount(String(followupRecord.followupMessagesSent ?? ""));
                        setFollowupNotes(followupRecord.notes ?? "");
                        setEditingFollowup(true);
                      }}
                    >
                      Edit Today&apos;s Submission
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Follow-up messages sent today</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="e.g. 5"
                        value={followupCount}
                        onChange={e => setFollowupCount(e.target.value)}
                        className="bg-input border-border"
                      />
                      <p className="text-xs text-muted-foreground">Number of clients contacted who missed their scheduled check-in</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                      <Textarea
                        placeholder="Any context or observations..."
                        value={followupNotes}
                        onChange={e => setFollowupNotes(e.target.value)}
                        className="bg-input border-border resize-none text-sm"
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      {editingFollowup && (
                        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => { setEditingFollowup(false); setFollowupCount(""); setFollowupNotes(""); }}>Cancel</Button>
                      )}
                      <Button
                        onClick={() => submitFollowup.mutate({
                          coachId: effectiveCoachId,
                          recordDate: today,
                          followupMessagesSent: parseInt(followupCount) || 0,
                          notes: followupNotes || undefined,
                        })}
                        disabled={!followupCount || submitFollowup.isPending}
                        className="flex-1"
                      >
                        {submitFollowup.isPending ? "Saving..." : editingFollowup ? "Update Follow-Up" : "Log Follow-Up Outreach"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── 3. Disengagement Outreach ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                    <TrendingDown className="h-4 w-4 text-rose-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Disengagement Outreach</CardTitle>
                    <CardDescription className="text-xs">Clients not logging weight/nutrition for 3+ days</CardDescription>
                  </div>
                  {disengagementRecord && (
                    <Badge className="ml-auto bg-primary/10 text-primary border-primary/20 text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Submitted
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {disengagementRecord && !editingDisengagement ? (
                  <div className="space-y-2">
                    <div className="rounded-xl bg-secondary p-4 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Disengagement messages sent</span>
                      <span className="text-2xl font-bold text-foreground">{disengagementRecord.disengagementMessagesSent}</span>
                    </div>
                    {disengagementRecord.notes && (
                      <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">{disengagementRecord.notes}</p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        setDisengagementCount(String(disengagementRecord.disengagementMessagesSent ?? ""));
                        setDisengagementNotes(disengagementRecord.notes ?? "");
                        setEditingDisengagement(true);
                      }}
                    >
                      Edit Today&apos;s Submission
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Disengagement messages sent today</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="e.g. 3"
                        value={disengagementCount}
                        onChange={e => setDisengagementCount(e.target.value)}
                        className="bg-input border-border"
                      />
                      <p className="text-xs text-muted-foreground">Number of clients reached out to who haven't logged data for 3+ days</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                      <Textarea
                        placeholder="Any context or observations..."
                        value={disengagementNotes}
                        onChange={e => setDisengagementNotes(e.target.value)}
                        className="bg-input border-border resize-none text-sm"
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      {editingDisengagement && (
                        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => { setEditingDisengagement(false); setDisengagementCount(""); setDisengagementNotes(""); }}>Cancel</Button>
                      )}
                      <Button
                        onClick={() => submitDisengagement.mutate({
                          coachId: effectiveCoachId,
                          recordDate: today,
                          disengagementMessagesSent: parseInt(disengagementCount) || 0,
                          notes: disengagementNotes || undefined,
                        })}
                        disabled={!disengagementCount || submitDisengagement.isPending}
                        className="flex-1"
                      >
                        {submitDisengagement.isPending ? "Saving..." : editingDisengagement ? "Update Disengagement" : "Log Disengagement Outreach"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Daily summary */}
            {todayRecords && todayRecords.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                <Clock className="h-3.5 w-3.5" />
                <span>{todayRecords.length} of 3 check-ins submitted today for {coachName}</span>
              </div>
            )}
          </>
        )}

      </div>
    </DashboardLayout>
  );
}
