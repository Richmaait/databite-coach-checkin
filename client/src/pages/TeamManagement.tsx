import DashboardLayout from "@/components/DashboardLayout";
import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bell, BellOff, Calendar, ChevronDown, ChevronUp, Clock, Link2, Pencil, Plus, Shield, Sparkles, UserCheck, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// IANA timezone options relevant to the team
const TIMEZONES = [
  { value: "Australia/Melbourne", label: "Melbourne / Sydney (AEST/AEDT)" },
  { value: "Australia/Perth", label: "Perth (AWST)" },
  { value: "Australia/Brisbane", label: "Brisbane (AEST, no DST)" },
  { value: "Australia/Adelaide", label: "Adelaide (ACST/ACDT)" },
  { value: "Australia/Darwin", label: "Darwin (ACST, no DST)" },
  { value: "Pacific/Auckland", label: "Auckland (NZST/NZDT)" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseArr<T>(val: string | null | undefined, fallback: T[]): T[] {
  if (!val) return fallback;
  try { return JSON.parse(val) as T[]; } catch { return fallback; }
}

const DEFAULT_WORKDAYS = [1, 2, 3, 4, 5];
const DEFAULT_TIMES = ["08:30", "11:00", "14:00"];

// ─── Edit Coach Modal ─────────────────────────────────────────────────────────

interface EditCoachModalProps {
  coach: { id: number; name: string; email?: string | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function EditCoachModal({ coach, open, onOpenChange, onSaved }: EditCoachModalProps) {
  const [name, setName] = useState(coach.name);
  const [email, setEmail] = useState(coach.email ?? "");

  const updateCoach = trpc.coaches.update.useMutation({
    onSuccess: () => {
      toast.success(`${name} updated successfully`);
      onSaved();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!name.trim()) return;
    updateCoach.mutate({
      coachId: coach.id,
      name: name.trim(),
      email: email.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            Edit Coach Profile
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Update the name and email for this coach profile.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Full Name *</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              className="bg-input border-border"
              placeholder="e.g. Steve Johnson"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="bg-input border-border"
              placeholder="e.g. steve@example.com"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-transparent">Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || updateCoach.isPending}
          >
            {updateCoach.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Kudos Modal ─────────────────────────────────────────────────────────────

interface KudosModalProps {
  coach: { id: number; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function KudosModal({ coach, open, onOpenChange }: KudosModalProps) {
  const [message, setMessage] = useState("");
  const utils = trpc.useUtils();

  const sendKudos = trpc.kudos.send.useMutation({
    onSuccess: () => {
      toast.success(`Kudos sent to ${coach.name}! 🌟`, {
        description: "Delivered via Slack DM and posted to the team channel.",
      });
      setMessage("");
      onOpenChange(false);
      utils.kudos.history.invalidate();
    },
    onError: (e) => toast.error(`Failed to send kudos: ${e.message}`),
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendKudos.mutate({ coachId: coach.id, message: message.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            Send Kudos to {coach.name}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Your message will be sent as a private Slack DM to {coach.name} and posted to the shared team channel.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Your message</Label>
            <Textarea
              placeholder={`e.g. "Great work this week, ${coach.name}! Your engagement numbers have been outstanding."`}
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="bg-input border-border resize-none min-h-[100px] text-sm"
              maxLength={1000}
            />
            <p className="text-[10px] text-muted-foreground text-right">{message.length}/1000</p>
          </div>
          <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-xs text-amber-300/80 space-y-1">
            <p className="font-medium text-amber-300">What happens when you send:</p>
            <p>• 🔒 Private DM to {coach.name} on Slack</p>
            <p>• 📢 Public shoutout posted to the team channel</p>
            <p>• 📋 Logged in Kudos History on the Dashboard</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-transparent">
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sendKudos.isPending}
            className="gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {sendKudos.isPending ? "Sending..." : "Send Kudos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Role Change Confirmation Dialog ─────────────────────────────────────────

interface RoleConfirmDialogProps {
  user: { id: number; name?: string | null; email?: string | null; role: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

function RoleConfirmDialog({ user, open, onOpenChange, onConfirm, isPending }: RoleConfirmDialogProps) {
  if (!user) return null;
  const isPromoting = user.role !== "admin";
  const displayName = user.name ?? user.email ?? `User #${user.id}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            {isPromoting ? "Promote to Manager?" : "Demote to Coach?"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isPromoting
              ? `This will give ${displayName} full manager access — they will be able to view all dashboards, send kudos, manage team settings, and see all coach data.`
              : `This will remove ${displayName}'s manager access. They will only be able to submit their own check-ins.`
            }
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-transparent">Cancel</Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            className={isPromoting ? "" : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"}
          >
            {isPending
              ? "Updating..."
              : isPromoting ? "Yes, Promote" : "Yes, Demote"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Slack Config Panel ───────────────────────────────────────────────────────

interface SlackConfigPanelProps {
  coach: {
    id: number;
    name: string;
    slackUserId?: string | null;
    timezone?: string | null;
    workdays?: string | null;
    reminderTimes?: string | null;
    remindersEnabled?: number | null;
  };
  onSaved: () => void;
}

function SlackConfigPanel({ coach, onSaved }: SlackConfigPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [slackId, setSlackId] = useState(coach.slackUserId ?? "");
  const [timezone, setTimezone] = useState(coach.timezone ?? "Australia/Melbourne");
  const [workdays, setWorkdays] = useState<number[]>(parseArr(coach.workdays, DEFAULT_WORKDAYS));
  const [times, setTimes] = useState<string[]>(parseArr(coach.reminderTimes, DEFAULT_TIMES));
  const [enabled, setEnabled] = useState((coach.remindersEnabled ?? 1) === 1);

  const updateSlackConfig = trpc.coaches.updateSlackConfig.useMutation({
    onSuccess: () => {
      toast.success(`Slack reminders updated for ${coach.name}`);
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleDay = (day: number) => {
    setWorkdays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const updateTime = (index: number, value: string) => {
    setTimes(prev => prev.map((t, i) => (i === index ? value : t)));
  };

  const handleSave = () => {
    updateSlackConfig.mutate({
      coachId: coach.id,
      slackUserId: slackId || undefined,
      timezone,
      workdays,
      reminderTimes: times as [string, string, string],
      remindersEnabled: enabled,
    });
  };

  const reminderLabels = ["🌅 Morning Review", "📨 Follow-Up Outreach", "🔍 Disengagement Outreach"];

  return (
    <div className="mt-3 border-t border-border/40 pt-3">
      <button
        type="button"
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        onClick={() => setExpanded(v => !v)}
      >
        {enabled && coach.slackUserId ? (
          <Bell className="h-3.5 w-3.5 text-primary" />
        ) : (
          <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="font-medium">Slack Reminders</span>
        {enabled && coach.slackUserId && (
          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0">Active</Badge>
        )}
        {(!coach.slackUserId) && (
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] px-1.5 py-0">Slack ID needed</Badge>
        )}
        <span className="ml-auto">{expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Enable reminders</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Slack User ID</Label>
            <Input
              placeholder="e.g. U0AG3CHPXGB"
              value={slackId}
              onChange={e => setSlackId(e.target.value)}
              className="bg-input border-border text-xs h-8 font-mono"
            />
            <p className="text-[10px] text-muted-foreground">Find this in Slack: click their profile → ⋯ → Copy member ID</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="bg-input border-border text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => (
                  <SelectItem key={tz.value} value={tz.value} className="text-xs">
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Working days</Label>
            <div className="flex gap-1.5">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                    workdays.includes(i)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Reminder times (local time)</Label>
            {reminderLabels.map((label, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-44 shrink-0">{label}</span>
                <Input
                  type="time"
                  value={times[i] ?? DEFAULT_TIMES[i]}
                  onChange={e => updateTime(i, e.target.value)}
                  className="bg-input border-border text-xs h-8 w-28"
                />
              </div>
            ))}
          </div>

          <Button
            size="sm"
            className="w-full text-xs h-8"
            onClick={handleSave}
            disabled={updateSlackConfig.isPending}
          >
            {updateSlackConfig.isPending ? "Saving..." : "Save Reminder Settings"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Reminder Schedule Tab ──────────────────────────────────────────────────

const REMINDER_LABELS = ["🌅 Morning Review", "📨 Follow-Up Outreach", "🔍 Disengagement Outreach"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

type CoachRow = {
  id: number;
  name: string;
  slackUserId?: string | null;
  timezone?: string | null;
  workdays?: string | null;
  reminderTimes?: string | null;
  remindersEnabled?: number | null;
  leaveStartDate?: string | null;
  leaveEndDate?: string | null;
};

interface ReminderScheduleTabProps {
  coaches: CoachRow[];
  onSave: (coachId: number, cfg: { slackUserId?: string; timezone: string; workdays: number[]; reminderTimes: [string, string, string]; remindersEnabled: boolean; leaveStartDate?: string | null; leaveEndDate?: string | null }) => void;
  onToggleLeave: (coachId: number, currentlyEnabled: boolean) => void;
  isSaving: boolean;
}

function ReminderScheduleTab({ coaches, onSave, onToggleLeave, isSaving }: ReminderScheduleTabProps) {
  const activeCoaches = coaches.filter(c => c);

  // Per-coach editing state
  const [editing, setEditing] = useState<number | null>(null);
  const [editState, setEditState] = useState<{
    timezone: string;
    workdays: number[];
    times: [string, string, string];
    enabled: boolean;
    leaveStartDate: string;
    leaveEndDate: string;
  } | null>(null);

  const startEdit = (coach: CoachRow) => {
    setEditing(coach.id);
    setEditState({
      timezone: coach.timezone ?? "Australia/Melbourne",
      workdays: parseArr(coach.workdays, [1, 2, 3, 4, 5]),
      times: parseArr(coach.reminderTimes, DEFAULT_TIMES) as [string, string, string],
      enabled: (coach.remindersEnabled ?? 1) === 1,
      leaveStartDate: coach.leaveStartDate ?? "",
      leaveEndDate: coach.leaveEndDate ?? "",
    });
  };

  const cancelEdit = () => { setEditing(null); setEditState(null); };

  const saveEdit = (coachId: number) => {
    if (!editState) return;
    onSave(coachId, {
      timezone: editState.timezone,
      workdays: editState.workdays,
      reminderTimes: editState.times,
      remindersEnabled: editState.enabled,
      leaveStartDate: editState.leaveStartDate || null,
      leaveEndDate: editState.leaveEndDate || null,
    });
    setEditing(null);
    setEditState(null);
  };

  const toggleDay = (day: number) => {
    if (!editState) return;
    setEditState(prev => prev ? {
      ...prev,
      workdays: prev.workdays.includes(day)
        ? prev.workdays.filter(d => d !== day)
        : [...prev.workdays, day].sort(),
    } : prev);
  };

  if (activeCoaches.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          No coaches yet. Add coaches first.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Reminder Schedule
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Set which days and times each coach receives their 3 daily Slack reminders. Times are in the coach's local timezone.</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed" style={{ minWidth: "780px" }}>
              <colgroup>
                <col style={{ width: "13%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Coach</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Timezone</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Work Days</th>
                  {REMINDER_LABELS.map((label, i) => (
                    <th key={i} className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">{label}</th>
                  ))}
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {activeCoaches.map(coach => {
                  const isEditing = editing === coach.id;
                  const times = parseArr(coach.reminderTimes, DEFAULT_TIMES) as [string, string, string];
                  const workdays = parseArr(coach.workdays, [1, 2, 3, 4, 5]);
                  const tz = coach.timezone ?? "Australia/Melbourne";
                  const enabled = (coach.remindersEnabled ?? 1) === 1;
                  const tzLabel = TIMEZONES.find(t => t.value === tz)?.label ?? tz;

                  return (
                    <React.Fragment key={coach.id}>
                      {/* Read-only summary row */}
                      <tr className={`border-b ${isEditing ? "border-primary/20 bg-primary/5" : "border-border/30 hover:bg-secondary/50"} transition-colors`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                              {coach.name.charAt(0)}
                            </div>
                            <span className="font-medium text-foreground text-sm">{coach.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <Badge className={enabled && coach.slackUserId
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] px-1.5 w-fit"
                              : "bg-muted text-muted-foreground border-border text-[10px] px-1.5 w-fit"
                            }>
                              {!coach.slackUserId ? "No Slack ID" : enabled ? "Active" : "Paused"}
                            </Badge>
                            {(coach.leaveStartDate || coach.leaveEndDate) && (
                              <span className="text-[10px] text-amber-400">
                                Leave: {coach.leaveStartDate ?? "?"} to {coach.leaveEndDate ?? "?"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground">{tzLabel.split(" (")[0]}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            {ALL_DAYS.map(d => (
                              <span key={d} className={`h-5 w-6 rounded text-[9px] font-medium flex items-center justify-center ${
                                workdays.includes(d) ? "bg-primary/15 text-primary" : "bg-transparent text-muted-foreground/30"
                              }`}>{DAY_SHORT[d]}</span>
                            ))}
                          </div>
                        </td>
                        {([0, 1, 2] as const).map(i => (
                          <td key={i} className="px-4 py-3">
                            <span className="text-xs font-mono text-foreground">{times[i]}</span>
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end items-center gap-1.5">
                            {isEditing ? (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 bg-transparent text-muted-foreground" onClick={cancelEdit}>
                                Cancel
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 bg-transparent" onClick={() => startEdit(coach)}>
                                <Pencil className="h-3 w-3" />
                                Edit
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded edit panel */}
                      {isEditing && editState && (
                        <tr className="border-b border-primary/20 bg-primary/5">
                          <td colSpan={8} className="px-6 py-5">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-4 max-w-2xl">
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reminders</label>
                                <div className="flex items-center gap-2.5">
                                  <Switch
                                    checked={editState.enabled}
                                    onCheckedChange={v => setEditState(prev => prev ? { ...prev, enabled: v } : prev)}
                                  />
                                  <span className="text-sm text-foreground">{editState.enabled ? "Enabled" : "Disabled"}</span>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Timezone</label>
                                <Select value={editState.timezone} onValueChange={v => setEditState(prev => prev ? { ...prev, timezone: v } : prev)}>
                                  <SelectTrigger className="h-8 text-sm bg-input border-border w-full max-w-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TIMEZONES.map(t => (
                                      <SelectItem key={t.value} value={t.value} className="text-sm">{t.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5 col-span-2">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Work Days</label>
                                <div className="flex gap-2">
                                  {ALL_DAYS.map(d => (
                                    <button
                                      key={d}
                                      type="button"
                                      onClick={() => toggleDay(d)}
                                      className={`h-8 w-10 rounded text-xs font-medium transition-colors ${
                                        editState.workdays.includes(d)
                                          ? "bg-primary text-primary-foreground"
                                          : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                                      }`}
                                    >{DAY_SHORT[d]}</button>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-3 col-span-2">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reminder Times</label>
                                {([0, 1, 2] as const).map(i => (
                                  <div key={i} className="flex items-center gap-3">
                                    <span className="text-sm text-foreground w-52 shrink-0">{REMINDER_LABELS[i]}</span>
                                    <input
                                      type="time"
                                      value={editState.times[i]}
                                      onChange={e => {
                                        const val = e.target.value;
                                        setEditState(prev => {
                                          if (!prev) return prev;
                                          const newTimes = [...prev.times] as [string, string, string];
                                          newTimes[i] = val;
                                          return { ...prev, times: newTimes };
                                        });
                                      }}
                                      className="h-8 text-sm bg-input border border-border rounded px-3 text-foreground w-32"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="space-y-1.5 col-span-2">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Scheduled Leave (optional)</label>
                                <p className="text-[11px] text-muted-foreground">Reminders are automatically paused between these dates. Leave blank to clear.</p>
                                <div className="flex items-center gap-3 flex-wrap">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground w-10">From</span>
                                    <input
                                      type="date"
                                      value={editState.leaveStartDate}
                                      onChange={e => setEditState(prev => prev ? { ...prev, leaveStartDate: e.target.value } : prev)}
                                      className="h-8 text-sm bg-input border border-border rounded px-3 text-foreground w-40"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground w-10">To</span>
                                    <input
                                      type="date"
                                      value={editState.leaveEndDate}
                                      onChange={e => setEditState(prev => prev ? { ...prev, leaveEndDate: e.target.value } : prev)}
                                      className="h-8 text-sm bg-input border border-border rounded px-3 text-foreground w-40"
                                    />
                                  </div>
                                  {(editState.leaveStartDate || editState.leaveEndDate) && (
                                    <button
                                      type="button"
                                      onClick={() => setEditState(prev => prev ? { ...prev, leaveStartDate: "", leaveEndDate: "" } : prev)}
                                      className="text-[11px] text-muted-foreground hover:text-foreground underline"
                                    >Clear dates</button>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-5">
                              <div className="flex gap-2">
                                <Button size="sm" className="px-4" onClick={() => saveEdit(coach.id)} disabled={isSaving}>
                                  {isSaving ? "Saving..." : "Save Changes"}
                                </Button>
                                <Button size="sm" variant="outline" className="bg-transparent" onClick={cancelEdit}>
                                  Cancel
                                </Button>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className={`h-8 text-xs gap-1.5 bg-transparent ${
                                  !editState?.enabled ? "border-amber-500/50 text-amber-400 hover:bg-amber-500/10" : "text-muted-foreground hover:text-foreground"
                                }`}
                                onClick={() => onToggleLeave(coach.id, enabled)}
                                title={enabled ? "Disable all reminders while coach is on leave" : "Re-enable reminders"}
                              >
                                {enabled ? "🏖️ On Leave" : "↩ Return from Leave"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Times shown in coach's local timezone</div>
        <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Highlighted days = active work days</div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TeamManagement() {
  const { user } = useAuth();

  const { data: coaches, refetch: refetchCoaches } = trpc.coaches.list.useQuery(undefined, { enabled: !!user });
  const { data: users, refetch: refetchUsers } = trpc.users.list.useQuery(undefined, { enabled: user?.role === "admin" });

  const [newCoachName, setNewCoachName] = useState("");
  const [newCoachEmail, setNewCoachEmail] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const [linkCoachId, setLinkCoachId] = useState<number | null>(null);
  const [linkUserId, setLinkUserId] = useState<number | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  // Edit coach state
  const [editCoach, setEditCoach] = useState<{ id: number; name: string; email?: string | null } | null>(null);

  // Kudos state
  const [kudosCoach, setKudosCoach] = useState<{ id: number; name: string } | null>(null);

  // Role change confirmation state
  type UserRow = NonNullable<typeof users>[number];
  const [roleChangeUser, setRoleChangeUser] = useState<UserRow | null>(null);
  const [roleConfirmOpen, setRoleConfirmOpen] = useState(false);

  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState<"coaches" | "reminders" | "roles">("coaches");

  const updateReminderSchedule = trpc.coaches.updateSlackConfig.useMutation({
    onSuccess: () => { toast.success("Reminder schedule saved"); refetchCoaches(); },
    onError: (e) => toast.error(e.message),
  });

  const createCoach = trpc.coaches.create.useMutation({
    onSuccess: () => {
      toast.success(`Coach "${newCoachName}" added successfully`);
      setNewCoachName(""); setNewCoachEmail("");
      setAddDialogOpen(false);
      refetchCoaches();
    },
    onError: (e) => toast.error(e.message),
  });

  const deactivateCoach = trpc.coaches.update.useMutation({
    onSuccess: () => {
      toast.success("Coach deactivated");
      refetchCoaches();
    },
    onError: (e) => toast.error(e.message),
  });

  const linkUser = trpc.coaches.linkUser.useMutation({
    onSuccess: () => {
      toast.success("Account linked successfully");
      setLinkDialogOpen(false);
      setLinkCoachId(null); setLinkUserId(null);
      refetchCoaches();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateRole = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated");
      setRoleConfirmOpen(false);
      setRoleChangeUser(null);
      refetchUsers();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto py-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted border border-border flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Admin Access Required</h2>
          <p className="text-muted-foreground text-sm">Team management is only available to managers and founders.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 py-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Team Management</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Add coaches, send kudos, configure Slack reminders, and manage roles</p>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Coach
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Add New Coach</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Create a coach profile. They can link their account later via the claim feature.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Full Name *</Label>
                  <Input
                    placeholder="e.g. Steve Johnson"
                    value={newCoachName}
                    onChange={e => setNewCoachName(e.target.value)}
                    className="bg-input border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Email (optional)</Label>
                  <Input
                    type="email"
                    placeholder="e.g. steve@example.com"
                    value={newCoachEmail}
                    onChange={e => setNewCoachEmail(e.target.value)}
                    className="bg-input border-border"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => createCoach.mutate({ name: newCoachName, email: newCoachEmail || undefined })}
                  disabled={!newCoachName.trim() || createCoach.isPending}
                >
                  {createCoach.isPending ? "Adding..." : "Add Coach"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)}>
          <TabsList className="bg-secondary border border-border/50 h-9">
            <TabsTrigger value="coaches" className="text-xs gap-1.5"><Users className="h-3.5 w-3.5" />Coaches</TabsTrigger>
            <TabsTrigger value="reminders" className="text-xs gap-1.5"><Bell className="h-3.5 w-3.5" />Reminder Schedule</TabsTrigger>
            <TabsTrigger value="roles" className="text-xs gap-1.5"><Shield className="h-3.5 w-3.5" />User Roles</TabsTrigger>
          </TabsList>

          {/* ── Coaches tab ── */}
          <TabsContent value="coaches" className="mt-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Active Coaches
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!coaches || coaches.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No coaches yet. Add your first coach above.
              </div>
            ) : (
              <div className="space-y-3">
                {coaches.filter(c => c.isActive).map((coach) => {
                  const linkedUser = users?.find(u => u.id === coach.userId);
                  return (
                    <div
                      key={coach.id}
                      className="p-4 rounded-xl bg-secondary border border-border/50 hover:border-border transition-colors"
                    >
                      {/* Coach header row */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                            {coach.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-foreground text-sm">{coach.name}</p>
                            <p className="text-xs text-muted-foreground">{coach.email ?? "No email set"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {linkedUser ? (
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs gap-1">
                              <UserCheck className="h-3 w-3" />
                              {linkedUser.name ?? linkedUser.email ?? "Linked"}
                            </Badge>
                          ) : (
                            <Badge className="bg-muted text-muted-foreground border-border text-xs">
                              Not linked
                            </Badge>
                          )}
                          {/* Edit button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5 bg-transparent"
                            onClick={() => setEditCoach({ id: coach.id, name: coach.name, email: coach.email })}
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </Button>
                          {/* Send Kudos button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5 bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 hover:text-amber-200"
                            onClick={() => setKudosCoach({ id: coach.id, name: coach.name })}
                          >
                            <Sparkles className="h-3 w-3" />
                            Send Kudos
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5 bg-transparent"
                            onClick={() => {
                              setLinkCoachId(coach.id);
                              setLinkDialogOpen(true);
                            }}
                          >
                            <Link2 className="h-3 w-3" />
                            Link Account
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:text-destructive bg-transparent border-destructive/30 hover:bg-destructive/10"
                            onClick={() => deactivateCoach.mutate({ coachId: coach.id, isActive: 0 })}
                          >
                            Deactivate
                          </Button>
                        </div>
                      </div>

                      {/* Slack reminder config */}
                      <SlackConfigPanel
                        coach={coach}
                        onSaved={() => refetchCoaches()}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

          </TabsContent>

          {/* ── Reminder Schedule tab ── */}
          <TabsContent value="reminders" className="mt-4">
            <ReminderScheduleTab
              coaches={coaches ?? []}
              onSave={(coachId, cfg) => updateReminderSchedule.mutate({ coachId, ...cfg })}
              onToggleLeave={(coachId, currentlyEnabled) => updateReminderSchedule.mutate({ coachId, remindersEnabled: !currentlyEnabled })}
              isSaving={updateReminderSchedule.isPending}
            />
          </TabsContent>

          {/* ── User Roles tab ── */}
          <TabsContent value="roles" className="mt-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              User Roles
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!users || users.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No users have logged in yet.
              </div>
            ) : (
              <div className="space-y-2">
                {users.map(u => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-secondary border border-border/50 hover:border-border transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-bold text-muted-foreground">
                        {(u.name ?? u.email ?? "U").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{u.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{u.email ?? u.openId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={u.role === "admin"
                        ? "bg-primary/10 text-primary border-primary/20 text-xs"
                        : "bg-muted text-muted-foreground border-border text-xs"
                      }>
                        {u.role === "admin" ? "Manager" : "Coach"}
                      </Badge>
                      {u.id !== user?.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs bg-transparent"
                          onClick={() => {
                            setRoleChangeUser(u);
                            setRoleConfirmOpen(true);
                          }}
                          disabled={updateRole.isPending}
                        >
                          {u.role === "admin" ? "Demote" : "Promote to Manager"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

          </TabsContent>
        </Tabs>

        {/* Edit coach modal */}
        {editCoach && (
          <EditCoachModal
            coach={editCoach}
            open={!!editCoach}
            onOpenChange={(open) => { if (!open) setEditCoach(null); }}
            onSaved={() => refetchCoaches()}
          />
        )}

        {/* Kudos modal */}
        {kudosCoach && (
          <KudosModal
            coach={kudosCoach}
            open={!!kudosCoach}
            onOpenChange={(open) => { if (!open) setKudosCoach(null); }}
          />
        )}

        {/* Link account dialog */}
        <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Link User Account</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Link a logged-in user account to this coach profile so they can submit check-ins.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Select User Account</Label>
                <Select
                  value={linkUserId?.toString() ?? ""}
                  onValueChange={v => setLinkUserId(parseInt(v))}
                >
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.map(u => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.name ?? u.email ?? `User #${u.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (linkCoachId && linkUserId) {
                    linkUser.mutate({ coachId: linkCoachId, userId: linkUserId });
                  }
                }}
                disabled={!linkUserId || linkUser.isPending}
              >
                {linkUser.isPending ? "Linking..." : "Link Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Role change confirmation dialog */}
        <RoleConfirmDialog
          user={roleChangeUser}
          open={roleConfirmOpen}
          onOpenChange={(open) => {
            setRoleConfirmOpen(open);
            if (!open) setRoleChangeUser(null);
          }}
          onConfirm={() => {
            if (roleChangeUser) {
              updateRole.mutate({
                userId: roleChangeUser.id,
                role: roleChangeUser.role === "admin" ? "user" : "admin",
              });
            }
          }}
          isPending={updateRole.isPending}
        />
      </div>
    </DashboardLayout>
  );
}
