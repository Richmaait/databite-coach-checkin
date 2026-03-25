import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { ENV } from "./env";
import * as schema from "../drizzle/schema";
import {
  coaches,
  checkinRecords,
  clientCheckIns,
  excusedClients,
  clientRatings,
} from "../drizzle/schema";

let db: ReturnType<typeof drizzle> | null = null;

/**
 * Get or create the database connection.
 */
export async function getDb() {
  if (db) return db;

  if (!ENV.databaseUrl) {
    console.error("DATABASE_URL is not set");
    return null;
  }

  try {
    const connection = await mysql.createConnection(ENV.databaseUrl);
    db = drizzle(connection, { schema, mode: "default" });
    return db;
  } catch (error) {
    console.error("Failed to connect to database:", error);
    return null;
  }
}

// ─── Helper functions used by Slack / Typeform / PDF modules ──────────────────

/** Get all coaches. */
export async function getAllCoaches() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(coaches);
}

/** Get the Monday (YYYY-MM-DD) of the week containing a date. */
function getMonday(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Get last week's check-in summary.
 * Returns records normalised to the shape expected by slackWeeklySummary:
 *   { coachId, coachName, submissionType, scheduledCheckins, completedCheckins, moodScore, followupMessagesSent }
 */
export async function getLastWeekSummary() {
  const db = await getDb();
  if (!db) return null;

  const now = new Date();
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - 7);
  const startDate = getMonday(lastMonday);
  const endDateObj = new Date(startDate + "T00:00:00");
  endDateObj.setDate(endDateObj.getDate() + 4);
  const endDate = endDateObj.toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(checkinRecords)
    .where(and(gte(checkinRecords.recordDate, startDate), lte(checkinRecords.recordDate, endDate)));

  if (rows.length === 0) return null;

  // Look up coach names
  const allCoaches = await db.select().from(coaches);
  const coachMap = new Map(allCoaches.map(c => [c.id, c.name]));

  // Flatten each checkin row into separate "submission type" records
  type FlatRecord = {
    coachId: number;
    coachName: string;
    submissionType: "morning" | "followup" | "disengagement";
    scheduledCheckins: number | null;
    completedCheckins: number | null;
    moodScore: number | null;
    followupMessagesSent: number | null;
  };
  const records: FlatRecord[] = [];

  for (const r of rows) {
    const coachName = coachMap.get(r.coachId) ?? `Coach #${r.coachId}`;
    if (r.morningSubmittedAt) {
      records.push({
        coachId: r.coachId,
        coachName,
        submissionType: "morning",
        scheduledCheckins: r.scheduledCount,
        completedCheckins: r.completedCount,
        moodScore: r.moodScore,
        followupMessagesSent: null,
      });
    }
    if (r.followupSubmittedAt) {
      records.push({
        coachId: r.coachId,
        coachName,
        submissionType: "followup",
        scheduledCheckins: null,
        completedCheckins: null,
        moodScore: null,
        followupMessagesSent: r.followupCount,
      });
    }
  }

  return { records, startDate, endDate };
}

/** Get all client check-ins for a given week (all coaches). */
export async function getAllClientCheckInsForWeek(weekStart: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(clientCheckIns)
    .where(eq(clientCheckIns.weekStart, weekStart));
}

/** Get client check-ins for a specific coach and week. */
export async function getClientCheckInsForWeek(coachId: number, weekStart: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(clientCheckIns)
    .where(and(eq(clientCheckIns.coachId, coachId), eq(clientCheckIns.weekStart, weekStart)));
}

/** Get all performance ratings (client ratings). */
export async function getAllPerformanceRatings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientRatings);
}

/**
 * Get checkin records for a date range.
 * Returns rows normalised with submissionType / followupMessagesSent / disengagementMessagesSent.
 */
export async function getCheckinRecordsByDateRange(startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(checkinRecords)
    .where(and(gte(checkinRecords.recordDate, startDate), lte(checkinRecords.recordDate, endDate)));

  // Look up coach names
  const allCoaches = await db.select().from(coaches);
  const coachMap = new Map(allCoaches.map(c => [c.id, c.name]));

  type FlatRecord = {
    coachId: number;
    coachName: string;
    submissionType: "morning" | "followup" | "disengagement";
    moodScore: number | null;
    followupMessagesSent: number | null;
    disengagementMessagesSent: number | null;
  };
  const records: FlatRecord[] = [];

  for (const r of rows) {
    const coachName = coachMap.get(r.coachId) ?? `Coach #${r.coachId}`;
    if (r.morningSubmittedAt) {
      records.push({
        coachId: r.coachId,
        coachName,
        submissionType: "morning",
        moodScore: r.moodScore,
        followupMessagesSent: null,
        disengagementMessagesSent: null,
      });
    }
    if (r.followupSubmittedAt) {
      records.push({
        coachId: r.coachId,
        coachName,
        submissionType: "followup",
        moodScore: null,
        followupMessagesSent: r.followupCount,
        disengagementMessagesSent: null,
      });
    }
    if (r.disengagementSubmittedAt) {
      records.push({
        coachId: r.coachId,
        coachName,
        submissionType: "disengagement",
        moodScore: null,
        followupMessagesSent: null,
        disengagementMessagesSent: r.disengagementCount,
      });
    }
  }

  return records;
}

/** Get all client check-ins for multiple weeks. */
export async function getAllClientCheckInsByWeekRange(weeks: string[]) {
  const db = await getDb();
  if (!db) return [];
  if (weeks.length === 0) return [];
  return db
    .select()
    .from(clientCheckIns)
    .where(inArray(clientCheckIns.weekStart, weeks));
}

/** Get all active pauses (no pause table exists yet — returns empty array). */
export async function getAllActivePauses(): Promise<Array<{ coachId: number; clientName: string }>> {
  return [];
}

/** Get all approved excuses for the given weeks. */
export async function getAllApprovedExcusesForWeeks(weeks: string[]) {
  const db = await getDb();
  if (!db) return [];
  if (weeks.length === 0) return [];
  return db
    .select()
    .from(excusedClients)
    .where(and(eq(excusedClients.status, "approved"), inArray(excusedClients.weekStart, weeks)));
}

/**
 * Toggle the clientSubmitted flag for a client check-in row.
 * Used by typeformBackfill.
 */
export async function toggleClientSubmitted(params: {
  coachId: number;
  coachName: string;
  clientName: string;
  dayOfWeek: "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
  weekStart: string;
  newValue: boolean;
  submittedByUserId: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await db.select().from(clientCheckIns).where(
    and(
      eq(clientCheckIns.coachId, params.coachId),
      eq(clientCheckIns.clientName, params.clientName),
      eq(clientCheckIns.dayOfWeek, params.dayOfWeek),
      eq(clientCheckIns.weekStart, params.weekStart),
    )
  ).limit(1);

  if (existing.length > 0) {
    const newVal = params.newValue ? 1 : 0;
    await db
      .update(clientCheckIns)
      .set({
        clientSubmitted: newVal,
        clientSubmittedAt: params.newValue ? new Date() : null,
      })
      .where(eq(clientCheckIns.id, existing[0].id));
  } else if (params.newValue) {
    await db.insert(clientCheckIns).values({
      coachId: params.coachId,
      coachName: params.coachName,
      clientName: params.clientName,
      dayOfWeek: params.dayOfWeek,
      weekStart: params.weekStart,
      completedByUserId: params.submittedByUserId,
      clientSubmitted: 1,
      clientSubmittedAt: new Date(),
    });
  }
}
