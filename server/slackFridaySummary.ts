/**
 * Friday Afternoon Weekly Client Check-In Summary
 * ─────────────────────────────────────────────────
 * Fires at 20:00 AEDT every Friday.
 * Sends a Slack DM to the manager with a full breakdown of the current week's
 * client check-in statuses for every active coach:
 *
 *   - Per-coach section showing each day's scheduled clients, how many were
 *     completed, and which specific clients are still pending / missed.
 *   - Overall engagement % for the week.
 *   - A "Still Pending" list of clients who haven't been ticked off yet
 *     (i.e. their scheduled day has passed but no completion recorded).
 *   - A direct link to the Client Check-Ins page.
 */

import { getAllCoaches, getClientCheckInsForWeek } from "./db";
import { ENV } from "./env";
import { sendSlackDM } from "./slackReminders";
import { fetchRosterForCoach, DAYS, type DayKey } from "./rosterUtils";
import { CLIENT_CHECKINS_EPOCH } from "../shared/const";

const MANAGER_SLACK_ID = ENV.managerSlackId;
const APP_URL = ENV.appUrl || "https://databitecoach.com";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getMondayLocal(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

const DAY_OFFSET: Record<DayKey, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4,
};

const DAY_LABEL: Record<DayKey, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri",
};

// ─── Main summary function ────────────────────────────────────────────────────

export async function sendFridayWeeklySummary(): Promise<void> {
  if (!MANAGER_SLACK_ID) {
    console.warn("[Slack Friday Summary] MANAGER_SLACK_ID not set — skipping");
    return;
  }

  const now = new Date();
  const epochDate = new Date(CLIENT_CHECKINS_EPOCH + "T00:00:00");
  const weekStart = getMondayLocal(now);

  if (weekStart < epochDate) {
    console.log("[Slack Friday Summary] Before tracking epoch — skipping");
    return;
  }

  const weekStartStr = toDateStr(weekStart);
  const fridayDate = addDays(weekStart, 4);
  const weekLabel = `${formatShortDate(weekStartStr)} – ${formatShortDate(toDateStr(fridayDate))}`;

  const allCoaches = await getAllCoaches();
  const activeCoaches = allCoaches.filter(c => c.isActive);

  if (activeCoaches.length === 0) {
    console.log("[Slack Friday Summary] No active coaches — skipping");
    return;
  }

  let totalScheduled = 0;
  let totalCompleted = 0;

  // Build per-coach sections
  const coachSections: string[] = [];

  for (const coach of activeCoaches) {
    // Use shared multi-column roster parser (fixes Kyah/Luke showing 0/0)
    const roster = await fetchRosterForCoach(coach.name);
    const completions = await getClientCheckInsForWeek(coach.id, weekStartStr);

    // Build a set of completed client names for quick lookup
    // The DB stores exact client names (with UPFRONT suffixes stripped by the app),
    // so we match against the cleaned name from rosterUtils.
    const completedSet = new Set<string>(completions.map(c => `${c.clientName}|${c.dayOfWeek}`));

    let coachScheduled = 0;
    let coachCompleted = 0;
    const pendingByDay: Partial<Record<DayKey, string[]>> = {};
    const completedByDay: Partial<Record<DayKey, string[]>> = {};

    for (const day of DAYS) {
      const clients = roster[day];
      if (clients.length === 0) continue;

      const dayDate = addDays(weekStart, DAY_OFFSET[day]);
      const cutoff = new Date(dayDate);
      cutoff.setHours(17, 0, 0, 0);
      const dayHasPassed = now >= cutoff;

      for (const client of clients) {
        const isDone = completedSet.has(`${client}|${day}`);
        coachScheduled++;
        if (isDone) {
          coachCompleted++;
          if (!completedByDay[day]) completedByDay[day] = [];
          completedByDay[day]!.push(client);
        } else if (dayHasPassed) {
          // Only flag as pending/missed if the day's 5pm cutoff has passed
          if (!pendingByDay[day]) pendingByDay[day] = [];
          pendingByDay[day]!.push(client);
        }
      }
    }

    totalScheduled += coachScheduled;
    totalCompleted += coachCompleted;

    const coachPct = coachScheduled > 0
      ? Math.round((coachCompleted / coachScheduled) * 100)
      : 0;
    const engEmoji = coachPct >= 90 ? "🟢" : coachPct >= 75 ? "🟡" : "🔴";

    let section = `*${coach.name}* — ${engEmoji} ${coachCompleted}/${coachScheduled} (${coachPct}%)\n`;

    // Show completed days compactly
    const completedDays = DAYS.filter(d => (completedByDay[d]?.length ?? 0) > 0);
    if (completedDays.length > 0) {
      for (const day of completedDays) {
        const clients = completedByDay[day]!;
        const dayDate = addDays(weekStart, DAY_OFFSET[day]);
        const dateLabel = formatShortDate(toDateStr(dayDate));
        section += `  ✅ ${DAY_LABEL[day]} ${dateLabel}: ${clients.join(", ")}\n`;
      }
    }

    // Show missed/pending clients prominently
    const pendingDays = DAYS.filter(d => (pendingByDay[d]?.length ?? 0) > 0);
    if (pendingDays.length > 0) {
      for (const day of pendingDays) {
        const clients = pendingByDay[day]!;
        const dayDate = addDays(weekStart, DAY_OFFSET[day]);
        const dateLabel = formatShortDate(toDateStr(dayDate));
        section += `  ❌ ${DAY_LABEL[day]} ${dateLabel}: ${clients.join(", ")}\n`;
      }
    }

    coachSections.push(section);
  }

  const overallPct = totalScheduled > 0
    ? Math.round((totalCompleted / totalScheduled) * 100)
    : 0;
  const overallEmoji = overallPct >= 90 ? "🟢" : overallPct >= 75 ? "🟡" : "🔴";

  // Compose the full message
  let msg = `📋 *Weekly Client Check-In Summary — ${weekLabel}*\n`;
  msg += `${overallEmoji} Overall: *${totalCompleted}/${totalScheduled} completed (${overallPct}%)*\n\n`;

  for (const section of coachSections) {
    msg += section + "\n";
  }

  msg += `👉 <${APP_URL}/client-checkins|View Client Check-Ins>`;

  await sendSlackDM(MANAGER_SLACK_ID, msg);
  console.log(`[Slack Friday Summary] Sent — ${totalCompleted}/${totalScheduled} (${overallPct}%)`);
}
