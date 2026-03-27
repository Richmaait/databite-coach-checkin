/**
 * tRPC Router — Coach Check-In Tracking App
 *
 * All date logic uses Australia/Melbourne timezone.
 * Week starts on Monday, format YYYY-MM-DD.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import { eq, and, gte, lte, desc, sql, inArray, asc, isNull, ne } from "drizzle-orm";

import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { fetchRosterForCoach, type DayKey } from "./rosterUtils";
import {
  UNAUTHED_ERR_MSG,
  CLIENT_CHECKINS_EPOCH,
  DAYS,
  TEAM_SLACK_CHANNEL,
} from "../shared/const";
import { ENV } from "./env";
import {
  users,
  coaches,
  checkinRecords,
  clientCheckIns,
  excusedClients,
  rosterClientStarts,
  rosterWeeklySnapshots,
  kudos,
  sweepReports,
  clientRatings,
  slackReminderLog,
} from "../drizzle/schema";
import { runTypeformBackfill } from "./typeformBackfill";
import { sendSlackDM } from "./slackReminders";

// Re-export fetchRosterForCoach under the alias used by weeklySummaryPdfRoute
export { fetchRosterForCoach as fetchCoachRoster } from "./rosterUtils";

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Get today's date in Australia/Melbourne as YYYY-MM-DD. */
function getTodayMelbourne(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Get the current Date in Australia/Melbourne. Exported for weeklySummaryPdfRoute. */
export function getMelbourneNow(): Date {
  // Return a Date whose UTC representation matches the current Melbourne wall-clock time
  const now = new Date();
  const melbStr = now.toLocaleString("en-US", { timeZone: "Australia/Melbourne" });
  return new Date(melbStr);
}

/**
 * Compute disengaged clients for a single coach in a given week.
 * Exported for weeklySummaryPdfRoute.
 */
export async function computeDisengagedClients(
  coachId: number,
  coachName: string,
  weekStart: string,
): Promise<Array<{
  coachId: number;
  coachName: string;
  clientName: string;
  dayOfWeek: string;
  consecutiveMissed: number;
  lastMissedWeek: string;
  lastCompletedWeek: string | null;
}>> {
  const db = await getDb();
  if (!db) return [];

  const epochWeek = getMonday(CLIENT_CHECKINS_EPOCH);
  const roster = await fetchRosterForCoach(coachName);
  const allWeeks = getWeeksBetween(epochWeek, weekStart); // newest first

  const completions = await db
    .select()
    .from(clientCheckIns)
    .where(eq(clientCheckIns.coachId, coachId));

  const approvedExcuses = await db
    .select()
    .from(excusedClients)
    .where(and(eq(excusedClients.coachId, coachId), eq(excusedClients.status, "approved")));

  const starts = await db
    .select()
    .from(rosterClientStarts)
    .where(eq(rosterClientStarts.coachId, coachId));

  const completionSet = new Set(
    completions
      .filter((c) => c.completedAt != null)
      .map((c) => `${c.clientName}|${c.dayOfWeek}|${c.weekStart}`),
  );
  const excuseSet = new Set(
    approvedExcuses.map((e) => `${e.clientName}|${e.dayOfWeek}|${e.weekStart}`),
  );
  const startMap = new Map(
    starts.map((s) => [`${s.clientName}|${s.dayOfWeek}`, s.firstWeekStart]),
  );

  const results: Array<{
    coachId: number;
    coachName: string;
    clientName: string;
    dayOfWeek: string;
    consecutiveMissed: number;
    lastMissedWeek: string;
    lastCompletedWeek: string | null;
  }> = [];

  for (const day of DAYS) {
    const clients = roster[day] ?? [];
    for (const clientName of clients) {
      const clientStart = startMap.get(`${clientName}|${day}`) ?? epochWeek;
      let missed = 0;
      let lastCompleted: string | null = null;

      for (const week of allWeeks) {
        if (week < clientStart) break;
        if (week > weekStart) continue;
        const key = `${clientName}|${day}|${week}`;
        if (completionSet.has(key) || excuseSet.has(key)) {
          if (!lastCompleted) lastCompleted = week;
          break;
        }
        missed++;
      }

      if (missed >= 1) {
        results.push({
          coachId,
          coachName,
          clientName,
          dayOfWeek: day,
          consecutiveMissed: missed,
          lastMissedWeek: weekStart,
          lastCompletedWeek: lastCompleted,
        });
      }
    }
  }

  return results;
}

/** Get the Monday (week start) of the week containing a YYYY-MM-DD date. */
function getMonday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00+10:00"); // noon AEST to avoid DST issues
  const day = d.getUTCDay(); // 0=Sun, 1=Mon …
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Get the day-of-week key for a YYYY-MM-DD date. */
function getDayKey(dateStr: string): DayKey | null {
  const d = new Date(dateStr + "T12:00:00+10:00");
  const day = d.getUTCDay();
  const map: Record<number, DayKey> = { 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday" };
  return map[day] ?? null;
}

/** Return an array of Monday dates (YYYY-MM-DD) from startWeek to endWeek, newest first. */
function getWeeksBetween(startWeek: string, endWeek: string): string[] {
  const weeks: string[] = [];
  let current = new Date(endWeek + "T12:00:00+10:00");
  const start = new Date(startWeek + "T12:00:00+10:00");
  while (current >= start) {
    weeks.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() - 7);
  }
  return weeks;
}

/** Add N days to a YYYY-MM-DD date string. */
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00+10:00");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Require db or throw. */
async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

// ─── tRPC Init ─────────────────────────────────────────────────────────────────

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

const publicProcedure = t.procedure;

const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const adminProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// ─── Checkins Router ───────────────────────────────────────────────────────────

const checkinsRouter = t.router({
  /** Upsert morning check-in for today. */
  submitMorning: protectedProcedure
    .input(
      z.object({
        coachId: z.number(),
        recordDate: z.string(),
        scheduledCount: z.number().optional(),
        completedCount: z.number().optional(),
        moodScore: z.number().min(1).max(5).optional(),
        actionPlan: z.string().optional(),
        workingHours: z.string().optional(),
        morningNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const existing = await db
        .select()
        .from(checkinRecords)
        .where(and(eq(checkinRecords.coachId, input.coachId), eq(checkinRecords.recordDate, input.recordDate)))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(checkinRecords)
          .set({
            scheduledCount: input.scheduledCount ?? existing[0].scheduledCount,
            completedCount: input.completedCount ?? existing[0].completedCount,
            moodScore: input.moodScore ?? existing[0].moodScore,
            actionPlan: input.actionPlan ?? existing[0].actionPlan,
            workingHours: input.workingHours ?? existing[0].workingHours,
            morningNotes: input.morningNotes ?? existing[0].morningNotes,
            morningSubmittedAt: new Date(),
          })
          .where(eq(checkinRecords.id, existing[0].id));
        return { id: existing[0].id, updated: true };
      }

      const [result] = await db.insert(checkinRecords).values({
        coachId: input.coachId,
        recordDate: input.recordDate,
        scheduledCount: input.scheduledCount,
        completedCount: input.completedCount,
        moodScore: input.moodScore,
        actionPlan: input.actionPlan,
        workingHours: input.workingHours,
        morningNotes: input.morningNotes,
        morningSubmittedAt: new Date(),
      });
      return { id: result.insertId, updated: false };
    }),

  /** Update today's record with follow-up fields. */
  submitFollowup: protectedProcedure
    .input(
      z.object({
        coachId: z.number(),
        recordDate: z.string(),
        followupMessagesSent: z.number().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const existing = await db
        .select()
        .from(checkinRecords)
        .where(and(eq(checkinRecords.coachId, input.coachId), eq(checkinRecords.recordDate, input.recordDate)))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(checkinRecords)
          .set({
            followupCount: input.followupMessagesSent ?? existing[0].followupCount,
            followupNotes: input.notes ?? existing[0].followupNotes,
            followupSubmittedAt: new Date(),
          })
          .where(eq(checkinRecords.id, existing[0].id));
        return { id: existing[0].id, updated: true };
      }

      const [result] = await db.insert(checkinRecords).values({
        coachId: input.coachId,
        recordDate: input.recordDate,
        followupCount: input.followupMessagesSent,
        followupNotes: input.notes,
        followupSubmittedAt: new Date(),
      });
      return { id: result.insertId, updated: false };
    }),

  /** Update today's record with disengagement fields. */
  submitDisengagement: protectedProcedure
    .input(
      z.object({
        coachId: z.number(),
        recordDate: z.string(),
        disengagementMessagesSent: z.number().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const existing = await db
        .select()
        .from(checkinRecords)
        .where(and(eq(checkinRecords.coachId, input.coachId), eq(checkinRecords.recordDate, input.recordDate)))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(checkinRecords)
          .set({
            disengagementCount: input.disengagementMessagesSent ?? existing[0].disengagementCount,
            disengagementNotes: input.notes ?? existing[0].disengagementNotes,
            disengagementSubmittedAt: new Date(),
          })
          .where(eq(checkinRecords.id, existing[0].id));
        return { id: existing[0].id, updated: true };
      }

      const [result] = await db.insert(checkinRecords).values({
        coachId: input.coachId,
        recordDate: input.recordDate,
        disengagementCount: input.disengagementMessagesSent,
        disengagementNotes: input.notes,
        disengagementSubmittedAt: new Date(),
      });
      return { id: result.insertId, updated: false };
    }),

  /** Get today's checkin record for a specific coach — returns structured list by submission type. */
  todayByCoach: protectedProcedure
    .input(
      z.object({
        coachId: z.number(),
        recordDate: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const db = await requireDb();
      const rows = await db
        .select()
        .from(checkinRecords)
        .where(and(eq(checkinRecords.coachId, input.coachId), eq(checkinRecords.recordDate, input.recordDate)))
        .limit(1);

      if (rows.length === 0) return [];

      const rec = rows[0];
      const results: Array<{
        submissionType: "morning" | "followup" | "disengagement";
        coachId: number;
        recordDate: string;
        moodScore: number | null;
        actionPlan: string | null;
        workingHours: string | null;
        notes: string | null;
        scheduledCount: number | null;
        completedCount: number | null;
        followupCount: number | null;
        disengagementCount: number | null;
        submittedAt: Date | null;
      }> = [];

      if (rec.morningSubmittedAt) {
        results.push({
          submissionType: "morning",
          coachId: rec.coachId,
          recordDate: rec.recordDate,
          moodScore: rec.moodScore,
          actionPlan: rec.actionPlan,
          workingHours: rec.workingHours,
          notes: rec.morningNotes,
          scheduledCount: rec.scheduledCount,
          completedCount: rec.completedCount,
          followupCount: null,
          disengagementCount: null,
          submittedAt: rec.morningSubmittedAt,
        });
      }

      if (rec.followupSubmittedAt) {
        results.push({
          submissionType: "followup",
          coachId: rec.coachId,
          recordDate: rec.recordDate,
          moodScore: null,
          actionPlan: null,
          workingHours: null,
          notes: rec.followupNotes,
          scheduledCount: null,
          completedCount: null,
          followupCount: rec.followupCount,
          disengagementCount: null,
          submittedAt: rec.followupSubmittedAt,
        });
      }

      if (rec.disengagementSubmittedAt) {
        results.push({
          submissionType: "disengagement",
          coachId: rec.coachId,
          recordDate: rec.recordDate,
          moodScore: null,
          actionPlan: null,
          workingHours: null,
          notes: rec.disengagementNotes,
          scheduledCount: null,
          completedCount: null,
          followupCount: null,
          disengagementCount: rec.disengagementCount,
          submittedAt: rec.disengagementSubmittedAt,
        });
      }

      return results;
    }),

  /** Aggregated stats across coaches for a date range. */
  aggregate: adminProcedure
    .input(
      z.object({
        days: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = await requireDb();
      const today = getTodayMelbourne();
      const endDate = input.endDate ?? today;
      const startDate = input.startDate ?? (input.days ? addDays(today, -(input.days - 1)) : addDays(today, -6));

      const rows = await db
        .select()
        .from(checkinRecords)
        .where(and(gte(checkinRecords.recordDate, startDate), lte(checkinRecords.recordDate, endDate)));

      const totalRecords = rows.length;
      const morningCount = rows.filter((r) => r.morningSubmittedAt).length;
      const followupCount = rows.filter((r) => r.followupSubmittedAt).length;
      const disengagementCount = rows.filter((r) => r.disengagementSubmittedAt).length;

      const moodScores = rows.filter((r) => r.moodScore != null).map((r) => r.moodScore!);
      const avgMood = moodScores.length > 0 ? moodScores.reduce((a, b) => a + b, 0) / moodScores.length : null;

      const totalScheduled = rows.reduce((s, r) => s + (r.scheduledCount ?? 0), 0);
      const totalCompleted = rows.reduce((s, r) => s + (r.completedCount ?? 0), 0);

      return {
        startDate,
        endDate,
        totalRecords,
        morningCount,
        followupCount,
        disengagementCount,
        avgMood,
        totalScheduled,
        totalCompleted,
      };
    }),

  /** Raw records for a date range — returns flat list with submissionType markers. */
  byDateRange: adminProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const db = await requireDb();
      const rows = await db
        .select({
          id: checkinRecords.id,
          coachId: checkinRecords.coachId,
          recordDate: checkinRecords.recordDate,
          scheduledCount: checkinRecords.scheduledCount,
          completedCount: checkinRecords.completedCount,
          moodScore: checkinRecords.moodScore,
          actionPlan: checkinRecords.actionPlan,
          workingHours: checkinRecords.workingHours,
          morningNotes: checkinRecords.morningNotes,
          morningSubmittedAt: checkinRecords.morningSubmittedAt,
          followupCount: checkinRecords.followupCount,
          followupNotes: checkinRecords.followupNotes,
          followupSubmittedAt: checkinRecords.followupSubmittedAt,
          disengagementCount: checkinRecords.disengagementCount,
          disengagementNotes: checkinRecords.disengagementNotes,
          disengagementSubmittedAt: checkinRecords.disengagementSubmittedAt,
        })
        .from(checkinRecords)
        .where(and(gte(checkinRecords.recordDate, input.startDate), lte(checkinRecords.recordDate, input.endDate)))
        .orderBy(desc(checkinRecords.recordDate));

      // Flatten into one entry per submission type for frontend consumption
      type FlatRecord = {
        id: number;
        coachId: number;
        recordDate: string;
        submissionType: "morning" | "followup" | "disengagement";
        moodScore: number | null;
        actionPlan: string | null;
        workingHours: string | null;
        notes: string | null;
        scheduledCount: number | null;
        completedCount: number | null;
        followupCount: number | null;
        disengagementCount: number | null;
        submittedAt: Date | null;
      };

      const flat: FlatRecord[] = [];
      for (const r of rows) {
        if (r.morningSubmittedAt) {
          flat.push({
            id: r.id,
            coachId: r.coachId,
            recordDate: r.recordDate,
            submissionType: "morning",
            moodScore: r.moodScore,
            actionPlan: r.actionPlan,
            workingHours: r.workingHours,
            notes: r.morningNotes,
            scheduledCount: r.scheduledCount,
            completedCount: r.completedCount,
            followupCount: null,
            disengagementCount: null,
            submittedAt: r.morningSubmittedAt,
          });
        }
        if (r.followupSubmittedAt) {
          flat.push({
            id: r.id,
            coachId: r.coachId,
            recordDate: r.recordDate,
            submissionType: "followup",
            moodScore: null,
            actionPlan: null,
            workingHours: null,
            notes: r.followupNotes,
            scheduledCount: null,
            completedCount: null,
            followupCount: r.followupCount,
            disengagementCount: null,
            submittedAt: r.followupSubmittedAt,
          });
        }
        if (r.disengagementSubmittedAt) {
          flat.push({
            id: r.id,
            coachId: r.coachId,
            recordDate: r.recordDate,
            submissionType: "disengagement",
            moodScore: null,
            actionPlan: null,
            workingHours: null,
            notes: r.disengagementNotes,
            scheduledCount: null,
            completedCount: null,
            followupCount: null,
            disengagementCount: r.disengagementCount,
            submittedAt: r.disengagementSubmittedAt,
          });
        }
      }

      return flat;
    }),

  /** Records where moodScore <= 2 from the last 7 days. */
  lowMoodAlerts: adminProcedure.query(async () => {
    const db = await requireDb();
    const today = getTodayMelbourne();
    const weekAgo = addDays(today, -7);

    const rows = await db
      .select({
        id: checkinRecords.id,
        coachId: checkinRecords.coachId,
        recordDate: checkinRecords.recordDate,
        moodScore: checkinRecords.moodScore,
        morningNotes: checkinRecords.morningNotes,
        coachName: coaches.name,
      })
      .from(checkinRecords)
      .leftJoin(coaches, eq(checkinRecords.coachId, coaches.id))
      .where(and(gte(checkinRecords.recordDate, weekAgo), lte(checkinRecords.moodScore, 2)))
      .orderBy(desc(checkinRecords.recordDate));

    return rows;
  }),

  /** Last 10 morning notes with coach name. */
  recentNotes: adminProcedure.query(async () => {
    const db = await requireDb();

    const rows = await db
      .select({
        id: checkinRecords.id,
        coachId: checkinRecords.coachId,
        recordDate: checkinRecords.recordDate,
        morningNotes: checkinRecords.morningNotes,
        followupNotes: checkinRecords.followupNotes,
        disengagementNotes: checkinRecords.disengagementNotes,
        morningSubmittedAt: checkinRecords.morningSubmittedAt,
        followupSubmittedAt: checkinRecords.followupSubmittedAt,
        disengagementSubmittedAt: checkinRecords.disengagementSubmittedAt,
        coachName: coaches.name,
      })
      .from(checkinRecords)
      .leftJoin(coaches, eq(checkinRecords.coachId, coaches.id))
      .orderBy(desc(checkinRecords.recordDate))
      .limit(20);

    // Flatten into individual notes with type info, return last 10
    const notes: Array<{
      id: number;
      coachId: number;
      coachName: string | null;
      recordDate: string;
      note: string;
      submissionType: "morning" | "followup" | "disengagement";
      submittedAt: Date | null;
    }> = [];

    for (const r of rows) {
      if (r.morningNotes && r.morningSubmittedAt) {
        notes.push({
          id: r.id,
          coachId: r.coachId,
          coachName: r.coachName,
          recordDate: r.recordDate,
          note: r.morningNotes,
          submissionType: "morning",
          submittedAt: r.morningSubmittedAt,
        });
      }
      if (r.followupNotes && r.followupSubmittedAt) {
        notes.push({
          id: r.id,
          coachId: r.coachId,
          coachName: r.coachName,
          recordDate: r.recordDate,
          note: r.followupNotes,
          submissionType: "followup",
          submittedAt: r.followupSubmittedAt,
        });
      }
      if (r.disengagementNotes && r.disengagementSubmittedAt) {
        notes.push({
          id: r.id,
          coachId: r.coachId,
          coachName: r.coachName,
          recordDate: r.recordDate,
          note: r.disengagementNotes,
          submissionType: "disengagement",
          submittedAt: r.disengagementSubmittedAt,
        });
      }
    }

    // Sort by submittedAt desc, take 10
    notes.sort((a, b) => {
      const aTime = a.submittedAt?.getTime() ?? 0;
      const bTime = b.submittedAt?.getTime() ?? 0;
      return bTime - aTime;
    });

    return notes.slice(0, 10);
  }),
});

// ─── Client Checkins Router ────────────────────────────────────────────────────

const clientCheckinsRouter = t.router({
  /** For a coach + week, get roster from Google Sheets, get completions from DB, compute stats. */
  getRosterWeeklyStats: protectedProcedure
    .input(
      z.object({
        coachId: z.number().optional(),
        weekStart: z.string().optional(),
        weekStarts: z.array(z.string()).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = await requireDb();

      // Support both weekStart (single) and weekStarts (array)
      const weekStart = input.weekStart || (input.weekStarts ? input.weekStarts[0] : undefined);
      if (!weekStart) throw new TRPCError({ code: "BAD_REQUEST", message: "weekStart or weekStarts required" });

      // Get all coaches if no specific coachId
      let coachList: Array<{ id: number; name: string }>;
      if (input.coachId) {
        const [coach] = await db.select().from(coaches).where(eq(coaches.id, input.coachId)).limit(1);
        coachList = coach ? [{ id: coach.id, name: coach.name }] : [];
      } else {
        coachList = await db
          .select({ id: coaches.id, name: coaches.name })
          .from(coaches)
          .where(eq(coaches.isActive, 1));
      }

      const results: Array<{
        coachId: number;
        coachName: string;
        scheduled: number;
        completed: number;
        excused: number;
        clientSubmitted: number;
        pct: number;
      }> = [];

      for (const coach of coachList) {
        const roster = await fetchRosterForCoach(coach.name);
        let scheduled = 0;
        for (const day of DAYS) {
          scheduled += (roster[day] ?? []).length;
        }

        // Get completions for this coach/week
        const completions = await db
          .select()
          .from(clientCheckIns)
          .where(
            and(eq(clientCheckIns.coachId, coach.id), eq(clientCheckIns.weekStart, weekStart)),
          );

        let completed = completions.filter((c) => c.completedAt != null).length;
        const clientSubmittedCount = completions.filter((c) => c.clientSubmitted === 1).length;

        // Fallback to weekly snapshots if no client_check_ins data
        if (completed === 0) {
          const [snapshot] = await db
            .select()
            .from(rosterWeeklySnapshots)
            .where(
              and(eq(rosterWeeklySnapshots.coachId, coach.id), eq(rosterWeeklySnapshots.weekStart, weekStart)),
            )
            .limit(1);
          if (snapshot?.snapshotJson) {
            const snap = typeof snapshot.snapshotJson === "string" ? JSON.parse(snapshot.snapshotJson) : snapshot.snapshotJson;
            completed = snap.completed ?? 0;
            if (snap.scheduled) scheduled = snap.scheduled;
          }
        }

        // Get approved excuses for this coach/week
        const excuses = await db
          .select()
          .from(excusedClients)
          .where(
            and(
              eq(excusedClients.coachId, coach.id),
              eq(excusedClients.weekStart, weekStart),
              eq(excusedClients.status, "approved"),
            ),
          );

        const excusedCount = excuses.length;
        const effectiveScheduled = Math.max(scheduled - excusedCount, 0);
        const pct = effectiveScheduled > 0 ? Math.round((completed / effectiveScheduled) * 100) : 0;

        results.push({
          coachId: coach.id,
          coachName: coach.name,
          scheduled,
          completed,
          excused: excusedCount,
          clientSubmitted: clientSubmittedCount,
          pct,
        });
      }

      return results;
    }),

  /** Daily breakdown for activity report. */
  getRosterDailyStats: adminProcedure
    .input(
      z.object({
        weekStart: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      // Support both weekStart and startDate/endDate
      if (!input.weekStart && input.startDate) {
        input.weekStart = input.startDate;
      }
      if (!input.weekStart) throw new TRPCError({ code: "BAD_REQUEST", message: "weekStart or startDate required" });
      const db = await requireDb();
      const coachList = await db
        .select({ id: coaches.id, name: coaches.name })
        .from(coaches)
        .where(eq(coaches.isActive, 1));

      const results: Array<{
        coachId: number;
        coachName: string;
        day: string;
        scheduled: number;
        completed: number;
      }> = [];

      for (const coach of coachList) {
        const roster = await fetchRosterForCoach(coach.name);
        for (const day of DAYS) {
          const clients = roster[day] ?? [];
          const completions = await db
            .select()
            .from(clientCheckIns)
            .where(
              and(
                eq(clientCheckIns.coachId, coach.id),
                eq(clientCheckIns.weekStart, input.weekStart),
                eq(clientCheckIns.dayOfWeek, day),
              ),
            );
          const completed = completions.filter((c) => c.completedAt != null).length;
          results.push({
            coachId: coach.id,
            coachName: coach.name,
            day,
            scheduled: clients.length,
            completed,
          });
        }
      }

      return results;
    }),

  /** Compare actual check-in times vs stated working hours. */
  getActivityReport: adminProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const weekStart = getMonday(input.date);

      // Get all checkin records for this date
      const records = await db
        .select({
          coachId: checkinRecords.coachId,
          recordDate: checkinRecords.recordDate,
          workingHours: checkinRecords.workingHours,
          morningSubmittedAt: checkinRecords.morningSubmittedAt,
          followupSubmittedAt: checkinRecords.followupSubmittedAt,
          disengagementSubmittedAt: checkinRecords.disengagementSubmittedAt,
          coachName: coaches.name,
        })
        .from(checkinRecords)
        .leftJoin(coaches, eq(checkinRecords.coachId, coaches.id))
        .where(eq(checkinRecords.recordDate, input.date));

      // Get client check-in completions for the same date
      const dayKey = getDayKey(input.date);
      const completions = dayKey
        ? await db
            .select()
            .from(clientCheckIns)
            .where(and(eq(clientCheckIns.weekStart, weekStart), eq(clientCheckIns.dayOfWeek, dayKey)))
        : [];

      return records.map((r) => {
        const coachCompletions = completions.filter(
          (c) => c.coachId === r.coachId && c.completedAt != null,
        );
        return {
          coachId: r.coachId,
          coachName: r.coachName,
          recordDate: r.recordDate,
          workingHours: r.workingHours,
          morningSubmittedAt: r.morningSubmittedAt,
          followupSubmittedAt: r.followupSubmittedAt,
          disengagementSubmittedAt: r.disengagementSubmittedAt,
          completionsCount: coachCompletions.length,
          firstCompletionAt: coachCompletions.length > 0
            ? coachCompletions.reduce(
                (earliest, c) =>
                  c.completedAt && (!earliest || c.completedAt < earliest) ? c.completedAt : earliest,
                null as Date | null,
              )
            : null,
          lastCompletionAt: coachCompletions.length > 0
            ? coachCompletions.reduce(
                (latest, c) =>
                  c.completedAt && (!latest || c.completedAt > latest) ? c.completedAt : latest,
                null as Date | null,
              )
            : null,
        };
      });
    }),

  /** Compute disengaged clients — missed 1+ consecutive weeks. */
  getAllDisengagedClients: protectedProcedure.query(async () => {
    const db = await requireDb();
    const today = getTodayMelbourne();
    const currentWeek = getMonday(today);
    const epochWeek = getMonday(CLIENT_CHECKINS_EPOCH);

    const coachList = await db
      .select({ id: coaches.id, name: coaches.name })
      .from(coaches)
      .where(eq(coaches.isActive, 1));

    const allWeeks = getWeeksBetween(epochWeek, currentWeek); // newest first

    type DisengagedClient = {
      coachId: number;
      coachName: string;
      clientName: string;
      dayOfWeek: string;
      consecutiveMissedWeeks: number;
      lastCompletedWeek: string | null;
    };

    const disengaged: DisengagedClient[] = [];

    for (const coach of coachList) {
      const roster = await fetchRosterForCoach(coach.name);

      // Get all completions for this coach
      const completions = await db
        .select()
        .from(clientCheckIns)
        .where(and(eq(clientCheckIns.coachId, coach.id)));

      // Get approved excuses
      const approvedExcuses = await db
        .select()
        .from(excusedClients)
        .where(and(eq(excusedClients.coachId, coach.id), eq(excusedClients.status, "approved")));

      // Get start dates
      const starts = await db
        .select()
        .from(rosterClientStarts)
        .where(eq(rosterClientStarts.coachId, coach.id));

      const completionSet = new Set(
        completions
          .filter((c) => c.completedAt != null)
          .map((c) => `${c.clientName}|${c.dayOfWeek}|${c.weekStart}`),
      );
      const excuseSet = new Set(
        approvedExcuses.map((e) => `${e.clientName}|${e.dayOfWeek}|${e.weekStart}`),
      );
      const startMap = new Map(
        starts.map((s) => [`${s.clientName}|${s.dayOfWeek}`, s.firstWeekStart]),
      );

      for (const day of DAYS) {
        const clients = roster[day] ?? [];
        for (const clientName of clients) {
          const clientStart = startMap.get(`${clientName}|${day}`) ?? epochWeek;
          let missed = 0;
          let lastCompleted: string | null = null;

          // Iterate weeks newest to oldest
          for (const week of allWeeks) {
            if (week < clientStart) break; // client wasn't on roster yet
            if (week > currentWeek) continue;

            const key = `${clientName}|${day}|${week}`;
            if (completionSet.has(key) || excuseSet.has(key)) {
              if (!lastCompleted) lastCompleted = week;
              break; // stop counting consecutive misses
            }
            missed++;
          }

          if (missed >= 1) {
            disengaged.push({
              coachId: coach.id,
              coachName: coach.name,
              clientName,
              dayOfWeek: day,
              consecutiveMissedWeeks: missed,
              lastCompletedWeek: lastCompleted,
            });
          }
        }
      }
    }

    return disengaged;
  }),

  /** Consecutive missed weeks per client. */
  getAllMissedStreaks: protectedProcedure.query(async () => {
    const db = await requireDb();
    const today = getTodayMelbourne();
    const currentWeek = getMonday(today);
    const epochWeek = getMonday(CLIENT_CHECKINS_EPOCH);

    const coachList = await db
      .select({ id: coaches.id, name: coaches.name })
      .from(coaches)
      .where(eq(coaches.isActive, 1));

    const allWeeks = getWeeksBetween(epochWeek, currentWeek);

    type MissedStreak = {
      coachId: number;
      coachName: string;
      clientName: string;
      dayOfWeek: string;
      consecutiveMissed: number;
    };

    const streaks: MissedStreak[] = [];

    for (const coach of coachList) {
      const roster = await fetchRosterForCoach(coach.name);

      const completions = await db
        .select()
        .from(clientCheckIns)
        .where(eq(clientCheckIns.coachId, coach.id));

      const approvedExcuses = await db
        .select()
        .from(excusedClients)
        .where(and(eq(excusedClients.coachId, coach.id), eq(excusedClients.status, "approved")));

      const completionSet = new Set(
        completions
          .filter((c) => c.completedAt != null)
          .map((c) => `${c.clientName}|${c.dayOfWeek}|${c.weekStart}`),
      );
      const excuseSet = new Set(
        approvedExcuses.map((e) => `${e.clientName}|${e.dayOfWeek}|${e.weekStart}`),
      );

      for (const day of DAYS) {
        const clients = roster[day] ?? [];
        for (const clientName of clients) {
          let missed = 0;
          for (const week of allWeeks) {
            const key = `${clientName}|${day}|${week}`;
            if (completionSet.has(key) || excuseSet.has(key)) break;
            missed++;
          }
          if (missed >= 2) {
            streaks.push({
              coachId: coach.id,
              coachName: coach.name,
              clientName,
              dayOfWeek: day,
              consecutiveMissed: missed,
            });
          }
        }
      }
    }

    return streaks;
  }),

  /** All morning submissions for today. */
  getAllTodayMorning: adminProcedure.query(async () => {
    const db = await requireDb();
    const today = getTodayMelbourne();

    const rows = await db
      .select({
        id: checkinRecords.id,
        coachId: checkinRecords.coachId,
        recordDate: checkinRecords.recordDate,
        scheduledCount: checkinRecords.scheduledCount,
        completedCount: checkinRecords.completedCount,
        moodScore: checkinRecords.moodScore,
        actionPlan: checkinRecords.actionPlan,
        workingHours: checkinRecords.workingHours,
        morningNotes: checkinRecords.morningNotes,
        morningSubmittedAt: checkinRecords.morningSubmittedAt,
        coachName: coaches.name,
      })
      .from(checkinRecords)
      .leftJoin(coaches, eq(checkinRecords.coachId, coaches.id))
      .where(and(eq(checkinRecords.recordDate, today), sql`${checkinRecords.morningSubmittedAt} IS NOT NULL`));

    return rows;
  }),

  /** New clients from roster_client_starts. */
  getClientTenure: adminProcedure.query(async () => {
    const db = await requireDb();

    const rows = await db
      .select({
        id: rosterClientStarts.id,
        coachId: rosterClientStarts.coachId,
        coachName: rosterClientStarts.coachName,
        clientName: rosterClientStarts.clientName,
        dayOfWeek: rosterClientStarts.dayOfWeek,
        firstWeekStart: rosterClientStarts.firstWeekStart,
      })
      .from(rosterClientStarts)
      .orderBy(desc(rosterClientStarts.firstWeekStart));

    return rows;
  }),

  /** Working hours analysis. */
  getCoachHoursBreakdown: adminProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const db = await requireDb();

      const rows = await db
        .select({
          coachId: checkinRecords.coachId,
          recordDate: checkinRecords.recordDate,
          workingHours: checkinRecords.workingHours,
          coachName: coaches.name,
        })
        .from(checkinRecords)
        .leftJoin(coaches, eq(checkinRecords.coachId, coaches.id))
        .where(
          and(
            gte(checkinRecords.recordDate, input.startDate),
            lte(checkinRecords.recordDate, input.endDate),
            sql`${checkinRecords.workingHours} IS NOT NULL`,
            sql`${checkinRecords.workingHours} != ''`,
          ),
        )
        .orderBy(asc(checkinRecords.recordDate));

      return rows;
    }),

  /** Per-day stats for a week. */
  getDailyActivityBreakdown: adminProcedure
    .input(
      z.object({
        weekStart: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const db = await requireDb();
      const coachList = await db
        .select({ id: coaches.id, name: coaches.name })
        .from(coaches)
        .where(eq(coaches.isActive, 1));

      const result: Array<{
        day: string;
        date: string;
        coaches: Array<{
          coachId: number;
          coachName: string;
          scheduled: number;
          completed: number;
          excused: number;
        }>;
      }> = [];

      for (let i = 0; i < DAYS.length; i++) {
        const day = DAYS[i];
        const dateStr = addDays(input.weekStart, i);
        const dayCoaches: Array<{
          coachId: number;
          coachName: string;
          scheduled: number;
          completed: number;
          excused: number;
        }> = [];

        for (const coach of coachList) {
          const roster = await fetchRosterForCoach(coach.name);
          const clients = roster[day] ?? [];

          const completions = await db
            .select()
            .from(clientCheckIns)
            .where(
              and(
                eq(clientCheckIns.coachId, coach.id),
                eq(clientCheckIns.weekStart, input.weekStart),
                eq(clientCheckIns.dayOfWeek, day),
              ),
            );

          const excuses = await db
            .select()
            .from(excusedClients)
            .where(
              and(
                eq(excusedClients.coachId, coach.id),
                eq(excusedClients.weekStart, input.weekStart),
                eq(excusedClients.dayOfWeek, day),
                eq(excusedClients.status, "approved"),
              ),
            );

          dayCoaches.push({
            coachId: coach.id,
            coachName: coach.name,
            scheduled: clients.length,
            completed: completions.filter((c) => c.completedAt != null).length,
            excused: excuses.length,
          });
        }

        result.push({ day, date: dateStr, coaches: dayCoaches });
      }

      return result;
    }),

  /** Excuse counts per coach for a week. */
  getExcuseCountsByCoach: adminProcedure
    .input(
      z.object({
        weekStart: z.string().optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = await requireDb();
      const weekStart = input?.weekStart ?? getTodayMelbourne().slice(0, 8) + "01";

      const rows = await db
        .select({
          coachId: excusedClients.coachId,
          coachName: excusedClients.coachName,
          status: excusedClients.status,
        })
        .from(excusedClients)
        .where(eq(excusedClients.weekStart, weekStart));

      // Group by coach
      const byCoach = new Map<number, { coachName: string; pending: number; approved: number; rejected: number }>();
      for (const r of rows) {
        if (!byCoach.has(r.coachId)) {
          byCoach.set(r.coachId, { coachName: r.coachName, pending: 0, approved: 0, rejected: 0 });
        }
        const entry = byCoach.get(r.coachId)!;
        if (r.status === "pending") entry.pending++;
        else if (r.status === "approved") entry.approved++;
        else if (r.status === "rejected") entry.rejected++;
      }

      return Array.from(byCoach.entries()).map(([coachId, data]) => ({
        coachId,
        ...data,
      }));
    }),

  /** All pending excuse requests. */
  getPendingExcuses: adminProcedure.query(async () => {
    const db = await requireDb();

    const rows = await db
      .select()
      .from(excusedClients)
      .where(eq(excusedClients.status, "pending"))
      .orderBy(desc(excusedClients.submittedAt));

    return rows;
  }),

  /** Coach performance metrics over time. */
  getPerformanceReport: adminProcedure
    .input(
      z.object({
        days: z.number().optional(),
        coachId: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = await requireDb();
      const today = getTodayMelbourne();
      const numDays = input.days ?? 28;
      const startDate = addDays(today, -numDays);
      const startWeek = getMonday(startDate);
      const endWeek = getMonday(today);

      const weeks = getWeeksBetween(startWeek, endWeek).reverse(); // oldest first

      let coachList: Array<{ id: number; name: string }>;
      if (input.coachId) {
        const [coach] = await db.select().from(coaches).where(eq(coaches.id, input.coachId)).limit(1);
        coachList = coach ? [{ id: coach.id, name: coach.name }] : [];
      } else {
        coachList = await db
          .select({ id: coaches.id, name: coaches.name })
          .from(coaches)
          .where(eq(coaches.isActive, 1));
      }

      const weeklyData: Array<{
        weekStart: string;
        coaches: Array<{
          coachId: number;
          coachName: string;
          scheduled: number;
          completed: number;
          pct: number;
        }>;
      }> = [];

      for (const week of weeks) {
        const coachEntries: Array<{
          coachId: number;
          coachName: string;
          scheduled: number;
          completed: number;
          pct: number;
        }> = [];

        for (const coach of coachList) {
          const roster = await fetchRosterForCoach(coach.name);
          let scheduled = 0;
          for (const day of DAYS) scheduled += (roster[day] ?? []).length;

          const completions = await db
            .select()
            .from(clientCheckIns)
            .where(and(eq(clientCheckIns.coachId, coach.id), eq(clientCheckIns.weekStart, week)));

          const completed = completions.filter((c) => c.completedAt != null).length;
          const pct = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;

          coachEntries.push({ coachId: coach.id, coachName: coach.name, scheduled, completed, pct });
        }

        weeklyData.push({ weekStart: week, coaches: coachEntries });
      }

      return weeklyData;
    }),

  /** Clients not yet completed today. */
  getTodayPendingClients: protectedProcedure
    .input(
      z.object({
        coachId: z.number(),
        date: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const db = await requireDb();
      const weekStart = getMonday(input.date);
      const dayKey = getDayKey(input.date);
      if (!dayKey) return [];

      const [coach] = await db.select().from(coaches).where(eq(coaches.id, input.coachId)).limit(1);
      if (!coach) return [];

      const roster = await fetchRosterForCoach(coach.name);
      const todayClients = roster[dayKey] ?? [];

      // Get completions for today
      const completions = await db
        .select()
        .from(clientCheckIns)
        .where(
          and(
            eq(clientCheckIns.coachId, input.coachId),
            eq(clientCheckIns.weekStart, weekStart),
            eq(clientCheckIns.dayOfWeek, dayKey),
          ),
        );

      const completedSet = new Set(
        completions.filter((c) => c.completedAt != null).map((c) => c.clientName),
      );

      // Get approved excuses
      const excuses = await db
        .select()
        .from(excusedClients)
        .where(
          and(
            eq(excusedClients.coachId, input.coachId),
            eq(excusedClients.weekStart, weekStart),
            eq(excusedClients.dayOfWeek, dayKey),
            eq(excusedClients.status, "approved"),
          ),
        );

      const excusedSet = new Set(excuses.map((e) => e.clientName));

      return todayClients.filter((name) => !completedSet.has(name) && !excusedSet.has(name));
    }),

  /** Mark a client check-in as completed. */
  markComplete: protectedProcedure
    .input(
      z.object({
        coachId: z.number(),
        coachName: z.string(),
        clientName: z.string(),
        dayOfWeek: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday"]),
        weekStart: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      // Upsert: check if row exists
      const existing = await db
        .select()
        .from(clientCheckIns)
        .where(
          and(
            eq(clientCheckIns.coachId, input.coachId),
            eq(clientCheckIns.clientName, input.clientName),
            eq(clientCheckIns.dayOfWeek, input.dayOfWeek),
            eq(clientCheckIns.weekStart, input.weekStart),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(clientCheckIns)
          .set({
            completedAt: new Date(),
            completedByUserId: ctx.user.id,
          })
          .where(eq(clientCheckIns.id, existing[0].id));
        return { id: existing[0].id };
      }

      const [result] = await db.insert(clientCheckIns).values({
        coachId: input.coachId,
        coachName: input.coachName,
        clientName: input.clientName,
        dayOfWeek: input.dayOfWeek,
        weekStart: input.weekStart,
        completedAt: new Date(),
        completedByUserId: ctx.user.id,
      });
      return { id: result.insertId };
    }),

  /** Undo a completion. */
  undoComplete: protectedProcedure
    .input(
      z.object({
        coachId: z.number(),
        clientName: z.string(),
        dayOfWeek: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday"]),
        weekStart: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();

      await db
        .update(clientCheckIns)
        .set({
          completedAt: null,
          completedByUserId: 0,
        })
        .where(
          and(
            eq(clientCheckIns.coachId, input.coachId),
            eq(clientCheckIns.clientName, input.clientName),
            eq(clientCheckIns.dayOfWeek, input.dayOfWeek),
            eq(clientCheckIns.weekStart, input.weekStart),
          ),
        );

      return { success: true };
    }),

  /** Toggle the clientSubmitted flag. */
  toggleClientSubmitted: protectedProcedure
    .input(
      z.object({
        coachId: z.number().optional(),
        clientName: z.string(),
        dayOfWeek: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday"]),
        weekStart: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      // Resolve coachId: if not provided, look up from user's linked coach
      let coachId = input.coachId;
      if (!coachId) {
        const [myCoach] = await db.select().from(coaches).where(eq(coaches.userId, ctx.user.id)).limit(1);
        if (!myCoach) throw new TRPCError({ code: "BAD_REQUEST", message: "No coach profile linked" });
        coachId = myCoach.id;
      }

      const [coach] = await db.select().from(coaches).where(eq(coaches.id, coachId)).limit(1);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach not found" });

      // Find existing row
      const existing = await db
        .select()
        .from(clientCheckIns)
        .where(
          and(
            eq(clientCheckIns.coachId, coachId),
            eq(clientCheckIns.clientName, input.clientName),
            eq(clientCheckIns.dayOfWeek, input.dayOfWeek),
            eq(clientCheckIns.weekStart, input.weekStart),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        const newVal = existing[0].clientSubmitted === 1 ? 0 : 1;
        await db
          .update(clientCheckIns)
          .set({
            clientSubmitted: newVal,
            clientSubmittedAt: newVal === 1 ? new Date() : null,
          })
          .where(eq(clientCheckIns.id, existing[0].id));
        return { id: existing[0].id, clientSubmitted: newVal === 1 };
      }

      // Create new row with clientSubmitted = true
      const [result] = await db.insert(clientCheckIns).values({
        coachId,
        coachName: coach.name,
        clientName: input.clientName,
        dayOfWeek: input.dayOfWeek,
        weekStart: input.weekStart,
        clientSubmitted: 1,
        clientSubmittedAt: new Date(),
      });
      return { id: result.insertId, clientSubmitted: true };
    }),

  /** Submit a valid excuse request. */
  submitExcuse: protectedProcedure
    .input(
      z.object({
        coachId: z.number(),
        coachName: z.string(),
        clientName: z.string(),
        dayOfWeek: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday"]),
        weekStart: z.string(),
        reason: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      // Check for existing excuse
      const existing = await db
        .select()
        .from(excusedClients)
        .where(
          and(
            eq(excusedClients.coachId, input.coachId),
            eq(excusedClients.clientName, input.clientName),
            eq(excusedClients.dayOfWeek, input.dayOfWeek),
            eq(excusedClients.weekStart, input.weekStart),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An excuse has already been submitted for this client/day/week",
        });
      }

      const [result] = await db.insert(excusedClients).values({
        coachId: input.coachId,
        coachName: input.coachName,
        clientName: input.clientName,
        dayOfWeek: input.dayOfWeek,
        weekStart: input.weekStart,
        reason: input.reason,
        status: "pending",
        submittedByUserId: ctx.user.id,
      });

      return { id: result.insertId };
    }),

  /** Approve or reject an excuse. */
  reviewExcuse: adminProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["approved", "rejected"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      await db
        .update(excusedClients)
        .set({
          status: input.status,
          reviewedByUserId: ctx.user.id,
          reviewedAt: new Date(),
        })
        .where(eq(excusedClients.id, input.id));

      return { success: true };
    }),

  /** Trigger Typeform backfill for current week. */
  syncTypeform: protectedProcedure.mutation(async () => {
    const results = await runTypeformBackfill();
    return results;
  }),
});

// ─── Coaches Router ────────────────────────────────────────────────────────────

const coachesRouter = t.router({
  /** All active coaches. */
  list: protectedProcedure.query(async () => {
    const db = await requireDb();
    return db.select().from(coaches).where(eq(coaches.isActive, 1)).orderBy(asc(coaches.name));
  }),

  /** Coach profile linked to current user. */
  myCoach: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const [coach] = await db
      .select()
      .from(coaches)
      .where(eq(coaches.userId, ctx.user.id))
      .limit(1);
    return coach ?? null;
  }),

  /** Coaches with no userId linked. */
  unclaimed: protectedProcedure.query(async () => {
    const db = await requireDb();
    return db
      .select()
      .from(coaches)
      .where(and(eq(coaches.isActive, 1), isNull(coaches.userId)));
  }),

  /** Submission streaks per coach. */
  streaks: protectedProcedure.query(async () => {
    const db = await requireDb();
    const today = getTodayMelbourne();

    const coachList = await db
      .select({ id: coaches.id, name: coaches.name })
      .from(coaches)
      .where(eq(coaches.isActive, 1));

    const results: Array<{
      coachId: number;
      coachName: string;
      currentStreak: number;
      longestStreak: number;
    }> = [];

    for (const coach of coachList) {
      // Get all records for this coach ordered by date desc
      const records = await db
        .select({ recordDate: checkinRecords.recordDate, morningSubmittedAt: checkinRecords.morningSubmittedAt })
        .from(checkinRecords)
        .where(eq(checkinRecords.coachId, coach.id))
        .orderBy(desc(checkinRecords.recordDate));

      const submittedDates = new Set(
        records.filter((r) => r.morningSubmittedAt).map((r) => r.recordDate),
      );

      // Calculate current streak (consecutive weekdays ending at today or yesterday)
      let current = 0;
      let checkDate = today;
      // If today has no submission yet, start checking from yesterday
      if (!submittedDates.has(checkDate)) {
        checkDate = addDays(checkDate, -1);
      }
      while (true) {
        // Skip weekends
        const dayOfWeek = getDayKey(checkDate);
        if (!dayOfWeek) {
          checkDate = addDays(checkDate, -1);
          continue;
        }
        if (submittedDates.has(checkDate)) {
          current++;
          checkDate = addDays(checkDate, -1);
        } else {
          break;
        }
        // Safety: don't go back more than 365 days
        if (current > 365) break;
      }

      // Calculate longest streak
      const sortedDates = Array.from(submittedDates).sort();
      let longest = 0;
      let streak = 0;
      let prevDate = "";
      for (const d of sortedDates) {
        if (!prevDate) {
          streak = 1;
        } else {
          // Check if this is the next weekday after prevDate
          let expected = addDays(prevDate, 1);
          while (expected <= d && !getDayKey(expected)) {
            expected = addDays(expected, 1);
          }
          if (expected === d) {
            streak++;
          } else {
            streak = 1;
          }
        }
        longest = Math.max(longest, streak);
        prevDate = d;
      }

      results.push({
        coachId: coach.id,
        coachName: coach.name,
        currentStreak: current,
        longestStreak: longest,
      });
    }

    return results;
  }),

  /** Create new coach. */
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const [result] = await db.insert(coaches).values({
        name: input.name,
        email: input.email,
      });
      return { id: result.insertId };
    }),

  /** Update coach. */
  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().optional(),
        isActive: z.number().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const { id, ...updates } = input;
      const setObj: Record<string, any> = {};
      if (updates.name !== undefined) setObj.name = updates.name;
      if (updates.email !== undefined) setObj.email = updates.email;
      if (updates.isActive !== undefined) setObj.isActive = updates.isActive;

      if (Object.keys(setObj).length > 0) {
        await db.update(coaches).set(setObj).where(eq(coaches.id, id));
      }
      return { success: true };
    }),

  /** Link current user to a coach profile. */
  claimProfile: protectedProcedure
    .input(
      z.object({
        coachId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      // Check not already claimed
      const [existing] = await db
        .select()
        .from(coaches)
        .where(eq(coaches.id, input.coachId))
        .limit(1);

      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Coach not found" });
      if (existing.userId) {
        throw new TRPCError({ code: "CONFLICT", message: "This coach profile is already claimed" });
      }

      await db
        .update(coaches)
        .set({ userId: ctx.user.id, email: ctx.user.email })
        .where(eq(coaches.id, input.coachId));

      return { success: true };
    }),

  /** Link a user to a coach (admin). */
  linkUser: adminProcedure
    .input(
      z.object({
        coachId: z.number(),
        userId: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db.update(coaches).set({ userId: input.userId }).where(eq(coaches.id, input.coachId));
      return { success: true };
    }),

  /** Update coach's Slack/reminder settings. */
  updateSlackConfig: adminProcedure
    .input(
      z.object({
        id: z.number(),
        slackUserId: z.string().optional(),
        timezone: z.string().optional(),
        reminderTimes: z.array(z.string()).optional(),
        workdays: z.array(z.string()).optional(),
        remindersEnabled: z.number().optional(),
        leaveStartDate: z.string().nullable().optional(),
        leaveEndDate: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const { id, ...updates } = input;
      const setObj: Record<string, any> = {};
      if (updates.slackUserId !== undefined) setObj.slackUserId = updates.slackUserId;
      if (updates.timezone !== undefined) setObj.timezone = updates.timezone;
      if (updates.reminderTimes !== undefined) setObj.reminderTimes = updates.reminderTimes;
      if (updates.workdays !== undefined) setObj.workdays = updates.workdays;
      if (updates.remindersEnabled !== undefined) setObj.remindersEnabled = updates.remindersEnabled;
      if (updates.leaveStartDate !== undefined) setObj.leaveStartDate = updates.leaveStartDate;
      if (updates.leaveEndDate !== undefined) setObj.leaveEndDate = updates.leaveEndDate;

      if (Object.keys(setObj).length > 0) {
        await db.update(coaches).set(setObj).where(eq(coaches.id, id));
      }
      return { success: true };
    }),
});

// ─── Performance Router ────────────────────────────────────────────────────────

const performanceRouter = t.router({
  /** Business-wide and per-coach green/yellow/red counts vs 70% target. */
  kpiSummary: protectedProcedure.query(async () => {
    const db = await requireDb();

    const coachList = await db
      .select({ id: coaches.id, name: coaches.name })
      .from(coaches)
      .where(eq(coaches.isActive, 1));

    const allRatings = await db.select().from(clientRatings);

    const TARGET = 70; // 70% green target

    const coachStats = coachList.map((coach) => {
      const coachRatings = allRatings.filter((r) => r.coachId === coach.id);
      const green = coachRatings.filter((r) => r.rating === "green").length;
      const yellow = coachRatings.filter((r) => r.rating === "yellow").length;
      const red = coachRatings.filter((r) => r.rating === "red").length;
      const total = green + yellow + red;
      const greenPct = total > 0 ? Math.round((green / total) * 100) : 0;

      return {
        coachId: coach.id,
        coachName: coach.name,
        green,
        yellow,
        red,
        total,
        greenPct,
        meetsTarget: greenPct >= TARGET,
      };
    });

    const totalGreen = coachStats.reduce((s, c) => s + c.green, 0);
    const totalYellow = coachStats.reduce((s, c) => s + c.yellow, 0);
    const totalRed = coachStats.reduce((s, c) => s + c.red, 0);
    const totalAll = totalGreen + totalYellow + totalRed;
    const overallGreenPct = totalAll > 0 ? Math.round((totalGreen / totalAll) * 100) : 0;

    return {
      target: TARGET,
      overall: {
        green: totalGreen,
        yellow: totalYellow,
        red: totalRed,
        total: totalAll,
        greenPct: overallGreenPct,
        meetsTarget: overallGreenPct >= TARGET,
      },
      coaches: coachStats,
    };
  }),

  /** Get roster for a coach (from Google Sheets). */
  rosterForCoach: protectedProcedure
    .input(
      z.object({
        coachName: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const roster = await fetchRosterForCoach(input.coachName);
      return roster;
    }),

  /** All client ratings. */
  allRatings: adminProcedure.query(async () => {
    const db = await requireDb();
    return db.select().from(clientRatings).orderBy(asc(clientRatings.coachId), asc(clientRatings.clientName));
  }),

  /** Ratings for current user's coach. */
  myRatings: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const [myCoach] = await db.select().from(coaches).where(eq(coaches.userId, ctx.user.id)).limit(1);
    if (!myCoach) return [];

    return db
      .select()
      .from(clientRatings)
      .where(eq(clientRatings.coachId, myCoach.id))
      .orderBy(asc(clientRatings.clientName));
  }),

  /** Aggregated weekly summary. */
  getWeeklySummary: adminProcedure
    .input(
      z.object({
        weekStart: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const db = await requireDb();
      const coachList = await db
        .select({ id: coaches.id, name: coaches.name })
        .from(coaches)
        .where(eq(coaches.isActive, 1));

      const coachSummaries: Array<{
        coachId: number;
        coachName: string;
        scheduled: number;
        completed: number;
        excused: number;
        pct: number;
        moodScores: number[];
        avgMood: number | null;
        morningSubmitted: boolean;
        followupSubmitted: boolean;
        disengagementSubmitted: boolean;
      }> = [];

      for (const coach of coachList) {
        const roster = await fetchRosterForCoach(coach.name);
        let scheduled = 0;
        for (const day of DAYS) scheduled += (roster[day] ?? []).length;

        const completions = await db
          .select()
          .from(clientCheckIns)
          .where(and(eq(clientCheckIns.coachId, coach.id), eq(clientCheckIns.weekStart, input.weekStart)));
        const completed = completions.filter((c) => c.completedAt != null).length;

        const excuses = await db
          .select()
          .from(excusedClients)
          .where(
            and(
              eq(excusedClients.coachId, coach.id),
              eq(excusedClients.weekStart, input.weekStart),
              eq(excusedClients.status, "approved"),
            ),
          );
        const excusedCount = excuses.length;
        const effectiveScheduled = Math.max(scheduled - excusedCount, 0);
        const pct = effectiveScheduled > 0 ? Math.round((completed / effectiveScheduled) * 100) : 0;

        // Get checkin records for the week (Monday to Friday)
        const weekEnd = addDays(input.weekStart, 4);
        const records = await db
          .select()
          .from(checkinRecords)
          .where(
            and(
              eq(checkinRecords.coachId, coach.id),
              gte(checkinRecords.recordDate, input.weekStart),
              lte(checkinRecords.recordDate, weekEnd),
            ),
          );

        const moods = records.filter((r) => r.moodScore != null).map((r) => r.moodScore!);
        const avgMood = moods.length > 0 ? moods.reduce((a, b) => a + b, 0) / moods.length : null;

        coachSummaries.push({
          coachId: coach.id,
          coachName: coach.name,
          scheduled,
          completed,
          excused: excusedCount,
          pct,
          moodScores: moods,
          avgMood,
          morningSubmitted: records.some((r) => r.morningSubmittedAt),
          followupSubmitted: records.some((r) => r.followupSubmittedAt),
          disengagementSubmitted: records.some((r) => r.disengagementSubmittedAt),
        });
      }

      const totalScheduled = coachSummaries.reduce((s, c) => s + c.scheduled, 0);
      const totalCompleted = coachSummaries.reduce((s, c) => s + c.completed, 0);
      const totalExcused = coachSummaries.reduce((s, c) => s + c.excused, 0);
      const effectiveTotal = Math.max(totalScheduled - totalExcused, 0);
      const overallPct = effectiveTotal > 0 ? Math.round((totalCompleted / effectiveTotal) * 100) : 0;

      return {
        weekStart: input.weekStart,
        overall: {
          scheduled: totalScheduled,
          completed: totalCompleted,
          excused: totalExcused,
          pct: overallPct,
        },
        coaches: coachSummaries,
      };
    }),

  /** Set client rating. */
  setRating: protectedProcedure
    .input(
      z.object({
        coachId: z.number(),
        clientName: z.string(),
        rating: z.enum(["green", "yellow", "red"]),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();

      // Upsert
      const existing = await db
        .select()
        .from(clientRatings)
        .where(
          and(eq(clientRatings.coachId, input.coachId), eq(clientRatings.clientName, input.clientName)),
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(clientRatings)
          .set({ rating: input.rating, notes: input.notes ?? existing[0].notes })
          .where(eq(clientRatings.id, existing[0].id));
        return { id: existing[0].id };
      }

      const [result] = await db.insert(clientRatings).values({
        coachId: input.coachId,
        clientName: input.clientName,
        rating: input.rating,
        notes: input.notes,
      });
      return { id: result.insertId };
    }),

  /** Remove a client rating. */
  clearRating: protectedProcedure
    .input(
      z.object({
        coachId: z.number(),
        clientName: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db
        .delete(clientRatings)
        .where(
          and(eq(clientRatings.coachId, input.coachId), eq(clientRatings.clientName, input.clientName)),
        );
      return { success: true };
    }),

  /** Clear all ratings. */
  resetAllRatings: adminProcedure.mutation(async () => {
    const db = await requireDb();
    await db.delete(clientRatings);
    return { success: true };
  }),
});

// ─── Sweep Report Router ───────────────────────────────────────────────────────

const sweepReportRouter = t.router({
  /** Create sweep report snapshot. */
  create: adminProcedure
    .input(
      z.object({
        title: z.string(),
        weekStart: z.string(),
        coachId: z.number().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      // Build snapshot data — aggregate current performance data
      const coachList = input.coachId
        ? await db.select().from(coaches).where(eq(coaches.id, input.coachId))
        : await db.select().from(coaches).where(eq(coaches.isActive, 1));

      const snapshot: Record<string, any> = { coaches: [] };

      for (const coach of coachList) {
        const roster = await fetchRosterForCoach(coach.name);
        let scheduled = 0;
        for (const day of DAYS) scheduled += (roster[day] ?? []).length;

        const completions = await db
          .select()
          .from(clientCheckIns)
          .where(and(eq(clientCheckIns.coachId, coach.id), eq(clientCheckIns.weekStart, input.weekStart)));
        const completed = completions.filter((c) => c.completedAt != null).length;

        const excuses = await db
          .select()
          .from(excusedClients)
          .where(
            and(
              eq(excusedClients.coachId, coach.id),
              eq(excusedClients.weekStart, input.weekStart),
              eq(excusedClients.status, "approved"),
            ),
          );

        const ratings = await db
          .select()
          .from(clientRatings)
          .where(eq(clientRatings.coachId, coach.id));

        const green = ratings.filter((r) => r.rating === "green").length;
        const yellow = ratings.filter((r) => r.rating === "yellow").length;
        const red = ratings.filter((r) => r.rating === "red").length;

        snapshot.coaches.push({
          coachId: coach.id,
          coachName: coach.name,
          scheduled,
          completed,
          excused: excuses.length,
          pct: scheduled > 0 ? Math.round((completed / Math.max(scheduled - excuses.length, 1)) * 100) : 0,
          ratings: { green, yellow, red },
          roster,
          ratingDetails: ratings.map((r) => ({
            clientName: r.clientName,
            rating: r.rating,
            notes: r.notes,
          })),
        });
      }

      const [result] = await db.insert(sweepReports).values({
        title: input.title,
        createdByUserId: ctx.user.id,
        createdByName: ctx.user.name ?? ctx.user.email ?? "Unknown",
        snapshotJson: snapshot,
        weekStart: input.weekStart,
        scopeType: input.coachId ? "coach" : "all",
        scopeCoachId: input.coachId ?? null,
      });

      return { id: result.insertId };
    }),

  /** Mark report as saved. */
  save: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db.update(sweepReports).set({ isSaved: 1 }).where(eq(sweepReports.id, input.id));
      return { success: true };
    }),

  /** Get report by ID (public for sharing). */
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const [report] = await db.select().from(sweepReports).where(eq(sweepReports.id, input.id)).limit(1);
      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });
      return report;
    }),

  /** All reports. */
  list: adminProcedure.query(async () => {
    const db = await requireDb();
    return db.select().from(sweepReports).orderBy(desc(sweepReports.createdAt));
  }),

  /** Saved reports only. */
  listSaved: adminProcedure.query(async () => {
    const db = await requireDb();
    return db
      .select()
      .from(sweepReports)
      .where(eq(sweepReports.isSaved, 1))
      .orderBy(desc(sweepReports.createdAt));
  }),

  /** Compare two reports. */
  compare: adminProcedure
    .input(
      z.object({
        idA: z.number(),
        idB: z.number(),
      }),
    )
    .query(async ({ input }) => {
      const db = await requireDb();
      const [reportA] = await db.select().from(sweepReports).where(eq(sweepReports.id, input.idA)).limit(1);
      const [reportB] = await db.select().from(sweepReports).where(eq(sweepReports.id, input.idB)).limit(1);

      if (!reportA || !reportB) {
        throw new TRPCError({ code: "NOT_FOUND", message: "One or both reports not found" });
      }

      return { reportA, reportB };
    }),
});

// ─── Users Router ──────────────────────────────────────────────────────────────

const usersRouter = t.router({
  /** All users. */
  list: adminProcedure.query(async () => {
    const db = await requireDb();
    return db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        profileImageUrl: users.profileImageUrl,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.name));
  }),

  /** Change user role. */
  updateRole: adminProcedure
    .input(
      z.object({
        id: z.number(),
        role: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db.update(users).set({ role: input.role }).where(eq(users.id, input.id));
      return { success: true };
    }),
});

// ─── Kudos Router ──────────────────────────────────────────────────────────────

const kudosRouter = t.router({
  /** Send kudos — also sends Slack DM to the coach. */
  send: adminProcedure
    .input(
      z.object({
        coachId: z.number(),
        message: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      const [result] = await db.insert(kudos).values({
        fromUserId: ctx.user.id,
        coachId: input.coachId,
        message: input.message,
      });

      // Send Slack DM if coach has a Slack user ID
      const [coach] = await db.select().from(coaches).where(eq(coaches.id, input.coachId)).limit(1);
      if (coach?.slackUserId) {
        const senderName = ctx.user.name ?? ctx.user.email ?? "Your manager";
        const slackMsg = `\u2728 *Kudos from ${senderName}!*\n\n${input.message}`;
        await sendSlackDM(coach.slackUserId, slackMsg).catch((err) =>
          console.error("[Kudos] Slack DM failed:", err),
        );
      }

      return { id: result.insertId };
    }),

  /** Recent kudos. */
  list: adminProcedure.query(async () => {
    const db = await requireDb();
    return db
      .select({
        id: kudos.id,
        fromUserId: kudos.fromUserId,
        coachId: kudos.coachId,
        message: kudos.message,
        createdAt: kudos.createdAt,
        coachName: coaches.name,
      })
      .from(kudos)
      .leftJoin(coaches, eq(kudos.coachId, coaches.id))
      .orderBy(desc(kudos.createdAt))
      .limit(50);
  }),
});

// ─── App Router ────────────────────────────────────────────────────────────────

export const appRouter = t.router({
  checkins: checkinsRouter,
  clientCheckins: clientCheckinsRouter,
  coaches: coachesRouter,
  performance: performanceRouter,
  sweepReport: sweepReportRouter,
  users: usersRouter,
  kudos: kudosRouter,
});

export type AppRouter = typeof appRouter;
