import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { coaches, slackReminderLog } from "../drizzle/schema";
import { like, gte } from "drizzle-orm";
import { ENV } from "./env";

async function main() {
  const conn = await mysql.createConnection(ENV.databaseUrl);
  const db = drizzle(conn);

  // Check Luke's reminder settings
  const lukeRows = await db.select({
    id: coaches.id,
    name: coaches.name,
    reminderTimes: coaches.reminderTimes,
    remindersEnabled: coaches.remindersEnabled,
    workdays: coaches.workdays,
    leaveStartDate: coaches.leaveStartDate,
    leaveEndDate: coaches.leaveEndDate,
  }).from(coaches).where(like(coaches.name, "%Luke%"));
  console.log("Luke's coach record:", JSON.stringify(lukeRows, null, 2));

  // Check today's reminder log entries
  const logRows = await db.select().from(slackReminderLog).where(gte(slackReminderLog.reminderDate, "2026-03-16"));
  console.log("Today's reminder log entries:", JSON.stringify(logRows, null, 2));

  await conn.end();
}

main().catch(console.error);
