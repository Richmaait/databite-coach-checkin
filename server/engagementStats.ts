/**
 * Single source of truth for weekly engagement stats.
 * All read endpoints and the snapshot writer MUST use this — never recompute inline.
 *
 * Contract: `scheduled` is the max of (roster at fetch time) and
 * (distinct check-in rows for the week). This protects against mid-week
 * roster consolidation silently shrinking the denominator.
 */

import { and, eq, isNull } from "drizzle-orm";
import { clientCheckIns, excusedClients, pausedClients, rosterWeeklySnapshots } from "../drizzle/schema";
import { DAYS, fetchRosterForCoach, DayKey } from "./rosterUtils";

export interface CoachWeekStats {
  scheduled: number;
  completed: number;
  excused: number;
  clientSubmitted: number;
  scheduledByDay: Record<DayKey, number>;
  completedByDay: Record<DayKey, number>;
  excusedByDay: Record<DayKey, number>;
  source: "snapshot+live-ci" | "live";
}

export async function computeCoachWeekStats(
  db: any,
  coachId: number,
  coachName: string,
  weekStart: string,
  opts: { preferSnapshot?: boolean } = {},
): Promise<CoachWeekStats> {
  // Always load check-ins and excuses for the week — cheap and needed in every path
  const completions = await db.select().from(clientCheckIns)
    .where(and(eq(clientCheckIns.coachId, coachId), eq(clientCheckIns.weekStart, weekStart)));
  const excuses = await db.select().from(excusedClients)
    .where(and(
      eq(excusedClients.coachId, coachId),
      eq(excusedClients.weekStart, weekStart),
      eq(excusedClients.status, "approved"),
    ));

  const completedByDay = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0 } as Record<DayKey, number>;
  const excusedByDay = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0 } as Record<DayKey, number>;
  const checkInClientsByDay: Record<DayKey, Set<string>> = {
    monday: new Set(), tuesday: new Set(), wednesday: new Set(), thursday: new Set(), friday: new Set(),
  };

  let completed = 0;
  let clientSubmitted = 0;
  for (const c of completions) {
    const day = c.dayOfWeek as DayKey;
    if (!checkInClientsByDay[day]) continue;
    checkInClientsByDay[day].add(c.clientName);
    if (c.completedAt != null) { completed++; completedByDay[day]++; }
    if (c.clientSubmitted === 1) clientSubmitted++;
  }
  for (const e of excuses) {
    const day = e.dayOfWeek as DayKey;
    if (excusedByDay[day] != null) excusedByDay[day]++;
  }

  // Try snapshot first when asked
  let rosterByDay: Record<DayKey, number> | null = null;
  if (opts.preferSnapshot) {
    const snapRows = await db.select().from(rosterWeeklySnapshots)
      .where(and(eq(rosterWeeklySnapshots.coachId, coachId), eq(rosterWeeklySnapshots.weekStart, weekStart)))
      .limit(1);
    const snap = snapRows[0]?.snapshotJson as any;
    if (snap?.scheduledByDay) {
      rosterByDay = snap.scheduledByDay;
    } else if (snap?.scheduled != null) {
      // Older snapshots only stored the total — distribute back to days using check-in rows as a hint
      rosterByDay = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0 };
      for (const d of DAYS) rosterByDay[d] = checkInClientsByDay[d].size;
      const checkInTotal = DAYS.reduce((s, d) => s + checkInClientsByDay[d].size, 0);
      const extra = Math.max(snap.scheduled - checkInTotal, 0);
      // Put unaccounted scheduled on Monday as a fallback
      if (extra > 0) rosterByDay.monday += extra;
    }
  }

  // Fallback: live roster minus paused clients
  if (!rosterByDay) {
    const roster = await fetchRosterForCoach(coachName);
    const paused = await db.select().from(pausedClients)
      .where(and(eq(pausedClients.coachId, coachId), isNull(pausedClients.resumedAt)));
    const pausedSet = new Set(paused.map((p: any) => p.clientName));
    rosterByDay = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0 };
    for (const d of DAYS) {
      rosterByDay[d] = (roster[d] ?? []).filter((c: string) => !pausedSet.has(c)).length;
    }
  }

  // Floor each day with distinct check-in rows — a row existing proves the client was scheduled
  const scheduledByDay = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0 } as Record<DayKey, number>;
  for (const d of DAYS) {
    scheduledByDay[d] = Math.max(rosterByDay[d] ?? 0, checkInClientsByDay[d].size);
  }
  const scheduled = DAYS.reduce((s, d) => s + scheduledByDay[d], 0);
  const excused = excuses.length;

  return {
    scheduled,
    completed,
    excused,
    clientSubmitted,
    scheduledByDay,
    completedByDay,
    excusedByDay,
    source: opts.preferSnapshot ? "snapshot+live-ci" : "live",
  };
}

export function engagementPct(completed: number, scheduled: number, excused: number): number {
  const eff = Math.max(scheduled - excused, 0);
  return eff > 0 ? Math.round((completed / eff) * 1000) / 10 : 0;
}
