import { mysqlTable, int, varchar, text, timestamp, datetime, mysqlEnum, uniqueIndex, json, boolean, tinyint, date } from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────
// Managed by auth system. Stores all authenticated users.
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }),
  email: varchar("email", { length: 256 }),
  role: varchar("role", { length: 32 }).default("coach").notNull(),
  openId: varchar("openId", { length: 256 }),
  profileImageUrl: varchar("profileImageUrl", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Coaches ─────────────────────────────────────────────
// Coach profiles linked to user accounts.
export const coaches = mysqlTable("coaches", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  email: varchar("email", { length: 256 }),
  userId: int("userId"),
  slackUserId: varchar("slackUserId", { length: 64 }),
  timezone: varchar("timezone", { length: 64 }).default("Australia/Melbourne"),
  reminderTimes: json("reminderTimes").$type<string[]>(),
  workdays: json("workdays").$type<string[]>(),
  remindersEnabled: tinyint("remindersEnabled").default(1),
  leaveStartDate: varchar("leaveStartDate", { length: 10 }),
  leaveEndDate: varchar("leaveEndDate", { length: 10 }),
  isActive: tinyint("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Coach = typeof coaches.$inferSelect;
export type InsertCoach = typeof coaches.$inferInsert;

// ─── Check-In Records ───────────────────────────────────
// Daily coach check-in submissions (morning, follow-up, disengagement).
export const checkinRecords = mysqlTable("checkin_records", {
  id: int("id").autoincrement().primaryKey(),
  coachId: int("coachId").notNull(),
  recordDate: varchar("recordDate", { length: 10 }).notNull(), // YYYY-MM-DD
  // Morning review fields
  scheduledCount: int("scheduledCount"),
  completedCount: int("completedCount"),
  moodScore: int("moodScore"),               // 1-5
  actionPlan: text("actionPlan"),
  workingHours: varchar("workingHours", { length: 256 }),
  morningNotes: text("morningNotes"),
  morningSubmittedAt: timestamp("morningSubmittedAt"),
  // Follow-up outreach fields
  followupCount: int("followupCount"),
  followupNotes: text("followupNotes"),
  followupSubmittedAt: timestamp("followupSubmittedAt"),
  // Disengagement outreach fields
  disengagementCount: int("disengagementCount"),
  disengagementNotes: text("disengagementNotes"),
  disengagementSubmittedAt: timestamp("disengagementSubmittedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  uqCoachDate: uniqueIndex("uq_coach_date").on(t.coachId, t.recordDate),
}));

export type CheckinRecord = typeof checkinRecords.$inferSelect;
export type InsertCheckinRecord = typeof checkinRecords.$inferInsert;

// ─── Client Check-Ins ────────────────────────────────────
// Tracks whether each client's check-in was completed each week.
export const clientCheckIns = mysqlTable("client_check_ins", {
  id: int("id").autoincrement().primaryKey(),
  coachId: int("coachId").notNull(),
  coachName: varchar("coachName", { length: 128 }).notNull(),
  clientName: varchar("clientName", { length: 256 }).notNull(),
  dayOfWeek: mysqlEnum("dayOfWeek", ["monday", "tuesday", "wednesday", "thursday", "friday"]).notNull(),
  weekStart: varchar("weekStart", { length: 10 }).notNull(), // YYYY-MM-DD (Monday)
  completedByUserId: int("completedByUserId").default(0),
  completedAt: timestamp("completedAt"),
  clientSubmitted: tinyint("clientSubmitted").default(0),
  clientSubmittedAt: timestamp("clientSubmittedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  uqClientWeekDay: uniqueIndex("uq_client_week_day").on(t.coachId, t.clientName, t.dayOfWeek, t.weekStart),
}));

export type ClientCheckIn = typeof clientCheckIns.$inferSelect;
export type InsertClientCheckIn = typeof clientCheckIns.$inferInsert;

// ─── Excused Clients ─────────────────────────────────────
// Valid excuse submissions for missed check-ins.
export const excusedClients = mysqlTable("excused_clients", {
  id: int("id").autoincrement().primaryKey(),
  coachId: int("coachId").notNull(),
  coachName: varchar("coachName", { length: 128 }).notNull(),
  clientName: varchar("clientName", { length: 256 }).notNull(),
  dayOfWeek: mysqlEnum("dayOfWeek", ["monday", "tuesday", "wednesday", "thursday", "friday"]).notNull(),
  weekStart: varchar("weekStart", { length: 10 }).notNull(),
  reason: text("reason").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  submittedByUserId: int("submittedByUserId").notNull(),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  reviewedByUserId: int("reviewedByUserId"),
  reviewedAt: timestamp("reviewedAt"),
  slackMessageTs: varchar("slackMessageTs", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  uqCoachClientDayWeek: uniqueIndex("uq_excused_client").on(t.coachId, t.clientName, t.dayOfWeek, t.weekStart),
}));

export type ExcusedClient = typeof excusedClients.$inferSelect;
export type InsertExcusedClient = typeof excusedClients.$inferInsert;

// ─── Roster Client Starts ────────────────────────────────
// Tracks when each client first appeared on a coach's roster.
export const rosterClientStarts = mysqlTable("roster_client_starts", {
  id: int("id").autoincrement().primaryKey(),
  coachId: int("coachId").notNull(),
  coachName: varchar("coachName", { length: 128 }).notNull(),
  clientName: varchar("clientName", { length: 256 }).notNull(),
  dayOfWeek: mysqlEnum("dayOfWeek", ["monday", "tuesday", "wednesday", "thursday", "friday"]).notNull(),
  firstWeekStart: varchar("firstWeekStart", { length: 10 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  uqRosterClient: uniqueIndex("uq_roster_client").on(t.coachId, t.clientName, t.dayOfWeek),
}));

export type RosterClientStart = typeof rosterClientStarts.$inferSelect;
export type InsertRosterClientStart = typeof rosterClientStarts.$inferInsert;

// ─── Roster Weekly Snapshots ─────────────────────────────
// Snapshots of the roster for each week (for historical accuracy).
export const rosterWeeklySnapshots = mysqlTable("roster_weekly_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  coachId: int("coachId").notNull(),
  coachName: varchar("coachName", { length: 128 }).notNull(),
  weekStart: varchar("weekStart", { length: 10 }).notNull(),
  snapshotJson: json("snapshotJson").$type<Record<string, string[]>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  uqCoachWeek: uniqueIndex("uq_roster_snapshot").on(t.coachId, t.weekStart),
}));

export type RosterWeeklySnapshot = typeof rosterWeeklySnapshots.$inferSelect;

// ─── Kudos ───────────────────────────────────────────────
// Recognition messages from managers to coaches.
export const kudos = mysqlTable("kudos", {
  id: int("id").autoincrement().primaryKey(),
  fromUserId: int("fromUserId").notNull(),
  coachId: int("coachId").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Kudos = typeof kudos.$inferSelect;
export type InsertKudos = typeof kudos.$inferInsert;

// ─── Sweep Reports ───────────────────────────────────────
// Fortnightly performance sweep snapshots.
export const sweepReports = mysqlTable("sweep_reports", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  createdByName: varchar("createdByName", { length: 256 }).notNull(),
  snapshotJson: json("snapshotJson").notNull(),
  weekStart: varchar("weekStart", { length: 10 }).notNull(),
  isSaved: tinyint("isSaved").default(0).notNull(),
  scopeType: varchar("scopeType", { length: 16 }).default("all").notNull(),
  scopeCoachId: int("scopeCoachId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SweepReport = typeof sweepReports.$inferSelect;
export type InsertSweepReport = typeof sweepReports.$inferInsert;

// ─── Client Ratings ──────────────────────────────────────
// Traffic light performance ratings for clients.
export const clientRatings = mysqlTable("client_ratings", {
  id: int("id").autoincrement().primaryKey(),
  coachId: int("coachId").notNull(),
  clientName: varchar("clientName", { length: 256 }).notNull(),
  rating: mysqlEnum("rating", ["green", "yellow", "red"]).notNull(),
  notes: text("notes"),
  ratedAt: timestamp("ratedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  uqCoachClient: uniqueIndex("uq_client_rating").on(t.coachId, t.clientName),
}));

export type ClientRating = typeof clientRatings.$inferSelect;
export type InsertClientRating = typeof clientRatings.$inferInsert;

// ─── Slack Reminder Log ──────────────────────────────────
// Deduplication log for Slack reminders (prevents duplicate sends).
export const slackReminderLog = mysqlTable("slack_reminder_log", {
  id: int("id").autoincrement().primaryKey(),
  coachId: int("coachId").notNull(),
  reminderDate: varchar("reminderDate", { length: 10 }).notNull(),
  reminderIndex: int("reminderIndex").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  uqReminderSlot: uniqueIndex("uq_reminder_slot").on(t.coachId, t.reminderDate, t.reminderIndex),
}));

export type SlackReminderLog = typeof slackReminderLog.$inferSelect;

// ─── Paused Clients ─────────────────────────────────────────────────────────
export const pausedClients = mysqlTable("paused_clients", {
  id: int("id").primaryKey().autoincrement(),
  coachId: int("coachId").notNull(),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  pausedByUserId: int("pausedByUserId"),
  pausedAt: datetime("pausedAt"),
  resumedAt: datetime("resumedAt"),
});

export type PausedClient = typeof pausedClients.$inferSelect;

// ─── Sales Check-Ins ────────────────────────────────────────────────────────
// Daily morning + evening check-ins for sales team members.
export const salesCheckins = mysqlTable("sales_checkins", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 128 }).notNull(),
  recordDate: varchar("recordDate", { length: 10 }).notNull(), // YYYY-MM-DD
  // Morning
  moodScore: int("moodScore"),
  intendedWorkingHours: varchar("intendedWorkingHours", { length: 128 }),
  morningNotes: text("morningNotes"),
  morningSubmittedAt: timestamp("morningSubmittedAt"),
  // Evening
  howDayWent: text("howDayWent"),
  salesMade: int("salesMade"),
  intendedHoursNextDay: varchar("intendedHoursNextDay", { length: 128 }),
  eveningNotes: text("eveningNotes"),
  eveningSubmittedAt: timestamp("eveningSubmittedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  uqUserDate: uniqueIndex("uq_sales_user_date").on(t.userId, t.recordDate),
}));

export type SalesCheckin = typeof salesCheckins.$inferSelect;
