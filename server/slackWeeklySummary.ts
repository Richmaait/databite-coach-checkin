/**
 * Monday Morning Weekly Summary
 * ─────────────────────────────
 * Fires at 08:00 AEST every Monday.
 * Sends a Slack DM to the manager summarising last week:
 *   - Per-coach engagement %
 *   - Total follow-ups sent
 *   - Any low mood flags (score 1 or 2)
 */

import { getLastWeekSummary, getAllClientCheckInsForWeek, getAllCoaches } from "./db";
import { ENV } from "./env";
import { sendSlackDM } from "./slackReminders";

const MANAGER_SLACK_ID = ENV.managerSlackId;
const APP_URL = ENV.appUrl || "https://databitecoach.com";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export async function sendWeeklySummary(): Promise<void> {
  if (!MANAGER_SLACK_ID) {
    console.warn("[Slack Weekly] MANAGER_SLACK_ID not set — skipping summary");
    return;
  }

  const data = await getLastWeekSummary();
  if (!data || data.records.length === 0) {
    console.log("[Slack Weekly] No data for last week — skipping summary");
    return;
  }

  const { records, startDate, endDate } = data;

  // Fetch client check-in completions for last week
  const lastWeekStart = startDate; // startDate is the Monday of last week
  const allClientCheckIns = await getAllClientCheckInsForWeek(lastWeekStart);
  const allCoaches = await getAllCoaches();
  // Build a map of coachId -> completed client check-in count
  const clientCheckInsByCoach: Record<number, number> = {};
  for (const ci of allClientCheckIns) {
    clientCheckInsByCoach[ci.coachId] = (clientCheckInsByCoach[ci.coachId] ?? 0) + 1;
  }

  // Aggregate per coach
  type CoachStats = {
    name: string;
    totalScheduled: number;
    totalCompleted: number;
    totalFollowups: number;
    lowMoodCount: number;
    morningDays: number;
  };
  const byCoach: Record<number, CoachStats> = {};

  for (const r of records) {
    if (!byCoach[r.coachId]) {
      byCoach[r.coachId] = {
        name: r.coachName ?? `Coach #${r.coachId}`,
        totalScheduled: 0,
        totalCompleted: 0,
        totalFollowups: 0,
        lowMoodCount: 0,
        morningDays: 0,
      };
    }
    const s = byCoach[r.coachId];
    if (r.submissionType === "morning") {
      s.totalScheduled += r.scheduledCheckins ?? 0;
      s.totalCompleted += r.completedCheckins ?? 0;
      s.morningDays += 1;
      if (r.moodScore !== null && r.moodScore !== undefined && r.moodScore <= 2) {
        s.lowMoodCount += 1;
      }
    }
    if (r.submissionType === "followup") {
      s.totalFollowups += r.followupMessagesSent ?? 0;
    }
  }

  // Build message
  const weekLabel = `${formatDate(startDate)} – ${formatDate(endDate)}`;
  let msg = `📊 *Weekly Check-In Summary — ${weekLabel}*\n\n`;

  let anyLowMood = false;
  for (const stats of Object.values(byCoach)) {
    const pct = stats.totalScheduled > 0
      ? Math.round((stats.totalCompleted / stats.totalScheduled) * 100)
      : 0;
    const engEmoji = pct >= 90 ? "🟢" : pct >= 75 ? "🟡" : "🔴";
    msg += `*${stats.name}*\n`;
    msg += `  ${engEmoji} Engagement: ${stats.totalCompleted}/${stats.totalScheduled} = *${pct}%*\n`;
    msg += `  📨 Follow-ups sent: ${stats.totalFollowups}\n`;
    // Find coachId for this coach name
    const coachRecord = allCoaches.find(c => c.name === stats.name);
    if (coachRecord) {
      const clientCount = clientCheckInsByCoach[coachRecord.id] ?? 0;
      msg += `  ✅ Client check-ins logged: *${clientCount}*\n`;
    }
    if (stats.lowMoodCount > 0) {
      msg += `  ⚠️ Low mood days: ${stats.lowMoodCount}\n`;
      anyLowMood = true;
    }
    msg += "\n";
  }

  if (anyLowMood) {
    msg += `⚠️ *One or more coaches had low mood scores last week.* Consider a 1-on-1 check-in.\n\n`;
  }

  msg += `👉 <${APP_URL}/dashboard|View Full Dashboard>`;

  await sendSlackDM(MANAGER_SLACK_ID, msg);
  console.log("[Slack Weekly] Summary sent to manager");
}
