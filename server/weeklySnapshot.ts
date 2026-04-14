/**
 * Weekly Roster Snapshot
 * ─────────────────────
 * Runs Sunday at ~23:59 AEST. Captures each coach's scheduled/completed/excused
 * counts for the current week and saves them as a frozen snapshot so historical
 * data doesn't change when the live roster is modified.
 */

import { getDb } from "./db";
import { coaches, rosterWeeklySnapshots } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { computeCoachWeekStats, engagementPct } from "./engagementStats";

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
    const stats = await computeCoachWeekStats(db, coach.id, coach.name, weekStart);
    const snap = {
      scheduled: stats.scheduled,
      completed: stats.completed,
      excused: stats.excused,
      clientSubmitted: stats.clientSubmitted,
      scheduledByDay: stats.scheduledByDay,
      completedByDay: stats.completedByDay,
      missed: stats.scheduled - stats.completed,
      engagementPct: engagementPct(stats.completed, stats.scheduled, stats.excused),
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

    console.log(`[Snapshot] ${coach.name}: ${snap.completed}/${snap.scheduled} (${snap.engagementPct}%)`);
  }

  console.log(`[Snapshot] Week ${weekStart} snapshot complete.`);
}

