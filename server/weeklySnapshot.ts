/**
 * Weekly Roster Snapshot
 * ─────────────────────
 * Runs Sunday at ~23:59 AEST. Captures each coach's scheduled/completed/excused
 * counts for the current week and saves them as a frozen snapshot so historical
 * data doesn't change when the live roster is modified.
 */

import { getDb } from "./db";
import { coaches, clientCheckIns, excusedClients, pausedClients, rosterWeeklySnapshots } from "../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";
import { fetchRosterForCoach, DAYS } from "./rosterUtils";

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTodayMelbourne(): string {
  const now = new Date();
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(now);
}

export async function snapshotCurrentWeek(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Snapshot] Database not available — skipping");
    return;
  }

  const today = getTodayMelbourne();
  const weekStart = getMonday(today);

  console.log(`[Snapshot] Snapshotting week ${weekStart}...`);

  const coachList = await db
    .select({ id: coaches.id, name: coaches.name })
    .from(coaches)
    .where(eq(coaches.isActive, 1));

  for (const coach of coachList) {
    // Get live roster
    const roster = await fetchRosterForCoach(coach.name);

    // Get paused clients
    const paused = await db.select().from(pausedClients)
      .where(and(eq(pausedClients.coachId, coach.id), isNull(pausedClients.resumedAt)));
    const pausedSet = new Set(paused.map(p => p.clientName));

    let rosterScheduled = 0;
    for (const day of DAYS) {
      rosterScheduled += (roster[day] ?? []).filter((c: string) => !pausedSet.has(c)).length;
    }

    // Get completions
    const completions = await db.select().from(clientCheckIns)
      .where(and(eq(clientCheckIns.coachId, coach.id), eq(clientCheckIns.weekStart, weekStart)));
    const completed = completions.filter(c => c.completedAt != null).length;
    const clientSubmitted = completions.filter(c => c.clientSubmitted === 1).length;

    // Floor scheduled with distinct check-in rows — captures clients moved off roster mid-week
    const distinctCheckIns = new Set(completions.map(c => `${c.dayOfWeek}|${c.clientName}`)).size;
    const scheduled = Math.max(rosterScheduled, distinctCheckIns);

    // Get excuses
    const excuses = await db.select().from(excusedClients)
      .where(and(eq(excusedClients.coachId, coach.id), eq(excusedClients.weekStart, weekStart), eq(excusedClients.status, "approved")));
    const excusedCount = excuses.length;

    const effectiveScheduled = Math.max(scheduled - excusedCount, 0);
    const engagementPct = effectiveScheduled > 0 ? Math.round((completed / effectiveScheduled) * 1000) / 10 : 0;

    const snap = {
      scheduled,
      completed,
      excused: excusedCount,
      clientSubmitted,
      missed: scheduled - completed,
      engagementPct,
      source: "auto-snapshot",
    };

    // Upsert
    const existing = await db.select().from(rosterWeeklySnapshots)
      .where(and(eq(rosterWeeklySnapshots.coachId, coach.id), eq(rosterWeeklySnapshots.weekStart, weekStart)))
      .limit(1);

    if (existing.length > 0) {
      await db.update(rosterWeeklySnapshots)
        .set({ snapshotJson: snap as any })
        .where(eq(rosterWeeklySnapshots.id, existing[0].id));
    } else {
      await db.insert(rosterWeeklySnapshots).values({
        coachId: coach.id,
        coachName: coach.name,
        weekStart,
        snapshotJson: snap as any,
      });
    }

    console.log(`[Snapshot] ${coach.name}: ${completed}/${scheduled} (${engagementPct}%)`);
  }

  console.log(`[Snapshot] Week ${weekStart} snapshot complete.`);
}

