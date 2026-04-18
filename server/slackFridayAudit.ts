/**
 * Friday Quality Audit
 * ────────────────────
 * Fires Friday at 14:30 AEST. Selects 3 random completed clients (1 per day)
 * from each coach's roster and sends a Slack DM asking for Loom links or notes.
 *
 * At 20:00 in each coach's timezone, checks for missed submissions and alerts manager.
 */

import { getDb } from "./db";
import { coaches, clientCheckIns, fridayAudits, auditHistory } from "../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";
import { fetchRosterForCoach, DAYS, type DayKey } from "./rosterUtils";
import { sendSlackDM, claimReminderSlot } from "./slackReminders";
import { ENV } from "./env";

/** Day number to DayKey mapping (0=Sun, 1=Mon, ..., 6=Sat) */
const DAY_NUM_TO_KEY: Record<number, DayKey> = { 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday" };

function getLocalTimeParts(timezone: string): { dow: number; hour: string; minute: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const dayStr = parts.find(p => p.type === "weekday")?.value ?? "";
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    dow: map[dayStr] ?? 0,
    hour: parts.find(p => p.type === "hour")?.value ?? "",
    minute: parseInt(parts.find(p => p.type === "minute")?.value ?? "-1"),
  };
}

function getMonday(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Melbourne" }));
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTodayMelbourne(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(new Date());
}

export async function sendFridayAudit(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const weekStart = getMonday(getTodayMelbourne());
  const appUrl = ENV.appUrl || "https://coach.databite.com.au";

  const allCoaches = await db.select().from(coaches).where(eq(coaches.isActive, 1));

  for (const coach of allCoaches) {
    if (!coach.slackUserId) continue;

    // Check if it's 14:25-14:34 in the coach's timezone AND their last workday
    const timezone = coach.timezone ?? "Australia/Melbourne";
    const local = getLocalTimeParts(timezone);
    const workdays: number[] = Array.isArray(coach.workdays) ? coach.workdays as number[] : [1, 2, 3, 4, 5];
    const lastWorkday = Math.max(...workdays);
    if (local.dow !== lastWorkday) continue;
    if (local.hour !== "14" || local.minute < 25 || local.minute >= 35) continue;

    // Dedup: use reminderIndex 20 for weekly audit
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
    const claimed = await claimReminderSlot(coach.id, localDate, 20);
    if (!claimed) continue;

    // Check if audit already exists for this week
    const existing = await db.select().from(fridayAudits)
      .where(and(eq(fridayAudits.coachId, coach.id), eq(fridayAudits.weekStart, weekStart)))
      .limit(1);
    if (existing.length > 0) continue;

    // Get roster
    const roster = await fetchRosterForCoach(coach.name);

    // Get completed check-ins for this week (both submitted AND completed)
    const completions = await db.select().from(clientCheckIns)
      .where(and(eq(clientCheckIns.coachId, coach.id), eq(clientCheckIns.weekStart, weekStart)));
    const completedSet = new Set(
      completions
        .filter(c => c.completedAt != null && c.clientSubmitted === 1)
        .map(c => `${c.clientName}|${c.dayOfWeek}`)
    );
    // Also add fuzzy matches (strip parenthetical suffixes)
    for (const c of completions) {
      if (c.completedAt != null && c.clientSubmitted === 1) {
        const base = c.clientName.replace(/\s*\(.*\)\s*$/, "").trim();
        if (base !== c.clientName) completedSet.add(`${base}|${c.dayOfWeek}`);
      }
    }

    // Get previously audited clients for this coach
    const prevAudited = await db.select().from(auditHistory)
      .where(eq(auditHistory.coachId, coach.id));
    const auditedSet = new Set(prevAudited.map(a => a.clientName));

    // Build eligible clients per day (completed + not recently audited)
    const eligibleByDay: Partial<Record<DayKey, string[]>> = {};
    let totalEligible = 0;
    for (const day of DAYS) {
      const clients = roster[day] ?? [];
      const eligible = clients.filter(name => {
        const key = `${name}|${day}`;
        return completedSet.has(key) && !auditedSet.has(name);
      });
      if (eligible.length > 0) {
        eligibleByDay[day] = eligible;
        totalEligible += eligible.length;
      }
    }

    // If all clients have been audited, reset history and start fresh
    if (totalEligible === 0) {
      await db.delete(auditHistory).where(eq(auditHistory.coachId, coach.id));
      // Rebuild eligible list
      for (const day of DAYS) {
        const clients = roster[day] ?? [];
        const eligible = clients.filter(name => completedSet.has(`${name}|${day}`));
        if (eligible.length > 0) {
          eligibleByDay[day] = eligible;
          totalEligible += eligible.length;
        }
      }
    }

    // Pick 3 clients — spread across days where possible, but always pick 3
    const allEligible: Array<{ name: string; day: string }> = [];
    for (const day of DAYS) {
      for (const name of (eligibleByDay[day] ?? [])) {
        allEligible.push({ name, day });
      }
    }

    // Try to pick from different days first, then fill from any day
    const selected: Array<{ name: string; day: string }> = [];
    const usedDays = new Set<string>();
    const usedNames = new Set<string>();
    const shuffled = allEligible.sort(() => Math.random() - 0.5);

    // First pass: 1 per day
    for (const item of shuffled) {
      if (selected.length >= 3) break;
      if (!usedDays.has(item.day) && !usedNames.has(item.name)) {
        selected.push(item);
        usedDays.add(item.day);
        usedNames.add(item.name);
      }
    }
    // Second pass: fill remaining from any day (different clients)
    if (selected.length < 3) {
      for (const item of shuffled) {
        if (selected.length >= 3) break;
        if (!usedNames.has(item.name)) {
          selected.push(item);
          usedNames.add(item.name);
        }
      }
    }

    if (selected.length === 0) {
      console.log(`[Friday Audit] ${coach.name}: no eligible clients this week — skipping`);
      continue;
    }

    // Save audit record
    const selectedWithSubmission = selected.map(s => ({ ...s, submitted: false }));
    await db.insert(fridayAudits).values({
      coachId: coach.id,
      coachName: coach.name,
      weekStart,
      selectedClients: selectedWithSubmission,
    });

    // Update audit history
    for (const s of selected) {
      const existingHistory = await db.select().from(auditHistory)
        .where(and(eq(auditHistory.coachId, coach.id), eq(auditHistory.clientName, s.name)))
        .limit(1);
      if (existingHistory.length > 0) {
        await db.update(auditHistory)
          .set({ lastAuditedWeek: weekStart })
          .where(eq(auditHistory.id, existingHistory[0].id));
      } else {
        await db.insert(auditHistory).values({
          coachId: coach.id,
          clientName: s.name,
          lastAuditedWeek: weekStart,
        });
      }
    }

    // Send Slack DM
    const DAY_LABELS: Record<string, string> = { monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday" };
    const clientList = selected.map(s => `• *${s.name}* (${DAY_LABELS[s.day] ?? s.day})`).join("\n");
    const message =
      `📋 *Friday Quality Audit*\n\n` +
      `These 3 clients have been randomly selected for review this week:\n\n` +
      `${clientList}\n\n` +
      `Please submit a Loom link or notes for each client's check-in by *8:00pm today*.\n\n` +
      `👉 <${appUrl}/audit|Submit your audit>`;

    await sendSlackDM(coach.slackUserId, message);
    console.log(`[Friday Audit] ${coach.name}: sent audit for ${selected.map(s => s.name).join(", ")}`);
  }
}

export async function checkMissedAudits(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const managerSlackId = ENV.managerSlackId;
  if (!managerSlackId) return;

  const weekStart = getMonday(getTodayMelbourne());

  const audits = await db.select().from(fridayAudits)
    .where(and(eq(fridayAudits.weekStart, weekStart), isNull(fridayAudits.allSubmittedAt)));

  for (const audit of audits) {
    // Only check on the coach's last workday
    const [coach] = await db.select().from(coaches).where(eq(coaches.id, audit.coachId)).limit(1);
    if (!coach) continue;
    const timezone = coach.timezone ?? "Australia/Melbourne";
    const todayDow = getLocalTimeParts(timezone).dow;
    const workdays: number[] = Array.isArray(coach.workdays) ? coach.workdays as number[] : [1, 2, 3, 4, 5];
    const lastWorkday = Math.max(...workdays);
    if (todayDow !== lastWorkday) continue;

    const clients = audit.selectedClients as Array<{ name: string; day: string; submitted?: boolean }>;
    const pending = clients.filter(c => !c.submitted);
    if (pending.length === 0) continue;

    const message =
      `⚠️ *${audit.coachName}* has not completed their weekly audit\n\n` +
      `${pending.length} of ${clients.length} clients still pending:\n` +
      pending.map(c => `• ${c.name}`).join("\n");

    // Dedup with index 21
    const claimed = await claimReminderSlot(audit.coachId, getTodayMelbourne(), 21);
    if (claimed) {
      await sendSlackDM(managerSlackId, message);
    }
  }
}
