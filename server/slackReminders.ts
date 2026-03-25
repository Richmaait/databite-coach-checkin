/**
 * Slack Reminder Service
 * ─────────────────────
 * Sends three daily DMs to each coach at their configured local times:
 *   1. Morning Review   (default 08:30 local)
 *   2. Follow-Up Outreach (default 11:00 local)
 *   3. Disengagement Outreach (default 14:00 local)
 *
 * Each coach can have their own timezone, reminder times, and workdays.
 * The cron job runs every minute and fires when the current local minute
 * matches one of the coach's configured reminder times on a workday.
 *
 * Deduplication: before sending, we attempt to INSERT a row into
 * slack_reminder_log with a unique constraint on (coachId, reminderDate, reminderIndex).
 * If the insert succeeds we own the send; if it fails (duplicate key) another
 * replica already sent it and we skip. This prevents triple-sends when the
 * production platform runs multiple server instances.
 */
import { getDb } from "./db";
import { ENV } from "./env";
import { coaches, slackReminderLog } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const SLACK_BOT_TOKEN = ENV.slackBotToken;
const APP_URL = ENV.appUrl || "https://databitecoach.com";

const REMINDER_LABELS = [
  { index: 0, label: "Morning Review", path: "/coach?form=morning", emoji: "🌅" },
  { index: 1, label: "Follow-Up Outreach", path: "/coach?form=followup", emoji: "📨" },
  { index: 2, label: "Disengagement Outreach", path: "/coach?form=disengagement", emoji: "🔍" },
];

const REMINDER_DESCRIPTIONS = [
  "Time to submit your morning review — log last work day's scheduled vs completed check-ins.",
  "Check-in cut-off has passed — log how many follow-up messages you've sent to clients who missed their check-in.",
  "Time to log your disengagement outreach — how many clients haven't logged weight/nutrition for 3+ days did you reach out to?",
];

/**
 * Send a Slack DM to a user.
 */
export async function sendSlackDM(slackUserId: string, text: string): Promise<boolean> {
  if (!SLACK_BOT_TOKEN) {
    console.warn("[Slack] SLACK_BOT_TOKEN not set — skipping DM");
    return false;
  }

  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        channel: slackUserId,
        text,
        unfurl_links: false,
      }),
    });

    const data = await response.json() as { ok: boolean; error?: string };
    if (!data.ok) {
      console.error(`[Slack] Failed to send DM to ${slackUserId}: ${data.error}`);
      return false;
    }
    console.log(`[Slack] DM sent to ${slackUserId}`);
    return true;
  } catch (err) {
    console.error(`[Slack] Error sending DM to ${slackUserId}:`, err);
    return false;
  }
}

/**
 * Get the current HH:MM in a given IANA timezone.
 */
function getLocalHHMM(timezone: string): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = parts.find(p => p.type === "hour")?.value ?? "00";
  const minute = parts.find(p => p.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

/**
 * Get the current YYYY-MM-DD date string in a given IANA timezone.
 */
function getLocalDateString(timezone: string): string {
  const now = new Date();
  // en-CA locale formats as YYYY-MM-DD natively
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Get the current day-of-week (0=Sun ... 6=Sat) in a given IANA timezone.
 */
function getLocalDayOfWeek(timezone: string): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: timezone,
    weekday: "short",
  });
  const day = formatter.format(now);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[day] ?? new Date().getDay();
}

/**
 * Parse JSON safely, returning a fallback on failure.
 */
function parseJSON<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

const DEFAULT_WORKDAYS = [1, 2, 3, 4, 5]; // Mon-Fri
const DEFAULT_TIMES = ["08:30", "11:00", "14:00"];

/**
 * Attempt to claim the send slot by inserting a deduplication row.
 * Returns true if this instance should send the message (insert succeeded),
 * false if another instance already sent it (duplicate key error).
 */
async function claimReminderSlot(
  coachId: number,
  reminderDate: string,
  reminderIndex: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.insert(slackReminderLog).values({ coachId, reminderDate, reminderIndex });
    return true; // we own this send
  } catch (err: unknown) {
    // DrizzleQueryError stores the original MySQL error on `.cause`.
    // The MySQL error has `.code` and `.errno` on the cause object.
    // We also check the top-level error message as a fallback.
    const anyErr = err as { message?: string; cause?: { code?: string; errno?: number; message?: string } };
    const causeCode = anyErr?.cause?.code;
    const causeErrno = anyErr?.cause?.errno;
    const causeMsg = anyErr?.cause?.message ?? "";
    const topMsg = anyErr?.message ?? "";
    const isDuplicate =
      causeCode === "ER_DUP_ENTRY" ||
      causeErrno === 1062 ||
      causeMsg.includes("Duplicate entry") ||
      topMsg.includes("Duplicate entry");
    if (isDuplicate) {
      console.log(`[Slack Reminders] Slot already claimed for coach ${coachId} on ${reminderDate} index ${reminderIndex} — skipping duplicate`);
      return false;
    }
    // Unexpected error — log and skip to avoid spam
    console.error("[Slack Reminders] claimReminderSlot unexpected error:", err);
    return false;
  }
}

/**
 * Main cron tick — called every minute by the scheduler.
 * Checks each active coach with a Slack user ID and fires reminders as needed.
 * Uses DB-based deduplication to ensure only one server replica sends each message.
 */
export async function runReminderTick(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const allCoaches = await db.select().from(coaches).where(eq(coaches.isActive, 1));

  for (const coach of allCoaches) {
    if (!coach.slackUserId || !coach.remindersEnabled) continue;

    const timezone = coach.timezone ?? "Australia/Melbourne";
    const workdays = parseJSON<number[]>(coach.workdays, DEFAULT_WORKDAYS);
    const reminderTimes = parseJSON<string[]>(coach.reminderTimes, DEFAULT_TIMES);

    const localDay = getLocalDayOfWeek(timezone);
    const localTime = getLocalHHMM(timezone);
    const localDate = getLocalDateString(timezone);

    // Skip coach if today falls within their scheduled leave range
    if (coach.leaveStartDate && coach.leaveEndDate) {
      if (localDate >= coach.leaveStartDate && localDate <= coach.leaveEndDate) {
        console.log(`[Slack Reminders] Coach ${coach.id} is on scheduled leave (${coach.leaveStartDate} – ${coach.leaveEndDate}) — skipping`);
        continue;
      }
    } else if (coach.leaveStartDate && !coach.leaveEndDate) {
      // Open-ended leave: start date set but no end date
      if (localDate >= coach.leaveStartDate) {
        console.log(`[Slack Reminders] Coach ${coach.id} is on open-ended leave from ${coach.leaveStartDate} — skipping`);
        continue;
      }
    }

    if (!workdays.includes(localDay)) continue;

    const matchIndex = reminderTimes.indexOf(localTime);
    if (matchIndex === -1) continue;

    const reminder = REMINDER_LABELS[matchIndex];
    if (!reminder) continue;

    // Attempt to claim this send slot — only one replica will succeed
    const claimed = await claimReminderSlot(coach.id, localDate, matchIndex);
    if (!claimed) continue;

    const desc = REMINDER_DESCRIPTIONS[matchIndex] ?? "";
    const url = `${APP_URL}${reminder.path}`;

    const message =
      `${reminder.emoji} *Coach Check-In Reminder — ${reminder.label}*\n` +
      `${desc}\n\n` +
      `👉 <${url}|Open the form here>`;

    await sendSlackDM(coach.slackUserId, message);
  }
}

/**
 * Fortnightly performance review reminder — sent to the manager on alternate Mondays.
 *
 * Review cycle (fortnightly):
 *   Week A: Manager reviews all clients and sets traffic light ratings.
 *   Week B: Coaches review their own clients' progress against last ratings.
 *   Week C: Manager reviews again to assess improvements.
 *
 * The reminder fires every Monday at 08:00 AEST but only sends on alternate
 * Mondays (fortnightly). We use a simple epoch-week parity check:
 *   - ISO week number is even  → Manager review week
 *   - ISO week number is odd   → Coach review week
 *
 * This means the manager gets a reminder every other Monday, alternating with
 * a coach-facing prompt (which can be added later).
 */
export async function sendFortnightlyPerformanceReviewReminder(): Promise<void> {
  const MANAGER_SLACK_ID = ENV.managerSlackId;
  if (!SLACK_BOT_TOKEN || !MANAGER_SLACK_ID) {
    console.warn("[Slack Fortnightly] SLACK_BOT_TOKEN or MANAGER_SLACK_ID not set — skipping");
    return;
  }

  // Calculate ISO week number in AEST
  const now = new Date();
  const aestDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const aestDate = new Date(aestDateStr + "T00:00:00Z");
  // ISO week number: Thursday of the week determines the year/week
  const dayOfWeek = aestDate.getUTCDay() || 7; // 1=Mon ... 7=Sun
  const thursday = new Date(aestDate);
  thursday.setUTCDate(aestDate.getUTCDate() + (4 - dayOfWeek));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);

  // Only send on even ISO weeks (manager review weeks)
  if (isoWeek % 2 !== 0) {
    console.log(`[Slack Fortnightly] ISO week ${isoWeek} is odd — coach review week, no manager reminder`);
    return;
  }

  const APP_URL_LOCAL = ENV.appUrl || "https://databitecoach.com";
  const url = `${APP_URL_LOCAL}/client-progress`;

  const message =
    `📊 *Fortnightly Client Progress Review*\n` +
    `It's your fortnightly check-in to review and update client ratings in the performance tracker.\n\n` +
    `*What to do:*\n` +
    `• Review each coach's roster and update the traffic light ratings (🟢 On Track / 🟡 Neutral / 🔴 Off Track)\n` +
    `• Add notes for any clients who have changed status since the last review\n` +
    `• Check the KPI summary — target is *70% On Track* across the business\n\n` +
    `👉 <${url}|Open Client Progress Tracker>`;

  await sendSlackDM(MANAGER_SLACK_ID, message);
  console.log("[Slack Fortnightly] Performance review reminder sent to manager");
}

/**
 * Fortnightly Post-Sweep Report reminder — sent to the manager on the alternate
 * Mondays to the performance review reminder.
 *
 * Fires on odd ISO weeks (the weeks the performance review reminder is silent).
 * This creates a clean fortnightly alternation:
 *   Even ISO week → Performance review reminder (update ratings)
 *   Odd ISO week  → Sweep report reminder (generate + save the report)
 */
export async function sendFortnightlySweepReportReminder(): Promise<void> {
  const MANAGER_SLACK_ID = ENV.managerSlackId;
  if (!SLACK_BOT_TOKEN || !MANAGER_SLACK_ID) {
    console.warn("[Slack Sweep Reminder] SLACK_BOT_TOKEN or MANAGER_SLACK_ID not set — skipping");
    return;
  }

  // Calculate ISO week number in AEST
  const now = new Date();
  const aestDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const aestDate = new Date(aestDateStr + "T00:00:00Z");
  const dayOfWeek = aestDate.getUTCDay() || 7; // 1=Mon ... 7=Sun
  const thursday = new Date(aestDate);
  thursday.setUTCDate(aestDate.getUTCDate() + (4 - dayOfWeek));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);

  // Only send on odd ISO weeks (sweep report weeks)
  if (isoWeek % 2 === 0) {
    console.log(`[Slack Sweep Reminder] ISO week ${isoWeek} is even — performance review week, no sweep reminder`);
    return;
  }

  const APP_URL_LOCAL = ENV.appUrl || "https://databitecoach.com";
  const url = `${APP_URL_LOCAL}/client-progress`;

  const message =
    `📋 *Fortnightly Post-Sweep Report*\n` +
    `Time to generate and save this fortnight's sweep report.\n\n` +
    `*What to do:*\n` +
    `• Head to Client Progress and click *Generate Post-Sweep Report*\n` +
    `• Give the report a title (e.g. "Sweep — Week ${isoWeek}, ${new Date().getFullYear()}")\n` +
    `• Review the report, then click *Save Report* to add it to the history\n` +
    `• Use *Compare to Previous* to see what changed since the last sweep\n\n` +
    `👉 <${url}|Open Client Progress Tracker>`;

  await sendSlackDM(MANAGER_SLACK_ID, message);
  console.log("[Slack Sweep Reminder] Fortnightly sweep report reminder sent to manager");
}
