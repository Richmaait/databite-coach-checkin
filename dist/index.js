var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/_core/index.ts
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/_core/auth.ts
import { SignJWT, jwtVerify } from "jose";
import { eq as eq2 } from "drizzle-orm";

// server/db.ts
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

// server/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  typeformApiToken: process.env.TYPEFORM_API_TOKEN ?? "",
  typeformWebhookSecret: process.env.TYPEFORM_WEBHOOK_SECRET ?? "",
  appUrl: process.env.APP_URL ?? "https://databitecoach.com",
  slackBotToken: process.env.SLACK_BOT_TOKEN ?? "",
  googleSheetsApiKey: process.env.GOOGLE_SHEETS_API_KEY ?? "",
  managerSlackId: process.env.MANAGER_SLACK_ID ?? "",
  port: parseInt(process.env.PORT ?? "3000", 10),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramManagerChatId: process.env.TELEGRAM_MANAGER_CHAT_ID ?? ""
};

// drizzle/schema.ts
var schema_exports = {};
__export(schema_exports, {
  checkinRecords: () => checkinRecords,
  clientCheckIns: () => clientCheckIns,
  clientRatings: () => clientRatings,
  coaches: () => coaches,
  excusedClients: () => excusedClients,
  kudos: () => kudos,
  pausedClients: () => pausedClients,
  rosterClientStarts: () => rosterClientStarts,
  rosterWeeklySnapshots: () => rosterWeeklySnapshots,
  salesCheckins: () => salesCheckins,
  slackReminderLog: () => slackReminderLog,
  sweepReports: () => sweepReports,
  users: () => users
});
import { mysqlTable, int, varchar, text, timestamp, datetime, mysqlEnum, uniqueIndex, json, tinyint } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }),
  email: varchar("email", { length: 256 }),
  role: varchar("role", { length: 32 }).default("coach").notNull(),
  openId: varchar("openId", { length: 256 }),
  profileImageUrl: varchar("profileImageUrl", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var coaches = mysqlTable("coaches", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  email: varchar("email", { length: 256 }),
  userId: int("userId"),
  slackUserId: varchar("slackUserId", { length: 64 }),
  timezone: varchar("timezone", { length: 64 }).default("Australia/Melbourne"),
  reminderTimes: json("reminderTimes").$type(),
  workdays: json("workdays").$type(),
  remindersEnabled: tinyint("remindersEnabled").default(1),
  leaveStartDate: varchar("leaveStartDate", { length: 10 }),
  leaveEndDate: varchar("leaveEndDate", { length: 10 }),
  isActive: tinyint("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var checkinRecords = mysqlTable("checkin_records", {
  id: int("id").autoincrement().primaryKey(),
  coachId: int("coachId").notNull(),
  recordDate: varchar("recordDate", { length: 10 }).notNull(),
  // YYYY-MM-DD
  // Morning review fields
  scheduledCount: int("scheduledCount"),
  completedCount: int("completedCount"),
  moodScore: int("moodScore"),
  // 1-5
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (t2) => ({
  uqCoachDate: uniqueIndex("uq_coach_date").on(t2.coachId, t2.recordDate)
}));
var clientCheckIns = mysqlTable("client_check_ins", {
  id: int("id").autoincrement().primaryKey(),
  coachId: int("coachId").notNull(),
  coachName: varchar("coachName", { length: 128 }).notNull(),
  clientName: varchar("clientName", { length: 256 }).notNull(),
  dayOfWeek: mysqlEnum("dayOfWeek", ["monday", "tuesday", "wednesday", "thursday", "friday"]).notNull(),
  weekStart: varchar("weekStart", { length: 10 }).notNull(),
  // YYYY-MM-DD (Monday)
  completedByUserId: int("completedByUserId").default(0),
  completedAt: timestamp("completedAt"),
  clientSubmitted: tinyint("clientSubmitted").default(0),
  clientSubmittedAt: timestamp("clientSubmittedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (t2) => ({
  uqClientWeekDay: uniqueIndex("uq_client_week_day").on(t2.coachId, t2.clientName, t2.dayOfWeek, t2.weekStart)
}));
var excusedClients = mysqlTable("excused_clients", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (t2) => ({
  uqCoachClientDayWeek: uniqueIndex("uq_excused_client").on(t2.coachId, t2.clientName, t2.dayOfWeek, t2.weekStart)
}));
var rosterClientStarts = mysqlTable("roster_client_starts", {
  id: int("id").autoincrement().primaryKey(),
  coachId: int("coachId").notNull(),
  coachName: varchar("coachName", { length: 128 }).notNull(),
  clientName: varchar("clientName", { length: 256 }).notNull(),
  dayOfWeek: mysqlEnum("dayOfWeek", ["monday", "tuesday", "wednesday", "thursday", "friday"]).notNull(),
  firstWeekStart: varchar("firstWeekStart", { length: 10 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (t2) => ({
  uqRosterClient: uniqueIndex("uq_roster_client").on(t2.coachId, t2.clientName, t2.dayOfWeek)
}));
var rosterWeeklySnapshots = mysqlTable("roster_weekly_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  coachId: int("coachId").notNull(),
  coachName: varchar("coachName", { length: 128 }).notNull(),
  weekStart: varchar("weekStart", { length: 10 }).notNull(),
  snapshotJson: json("snapshotJson").$type().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (t2) => ({
  uqCoachWeek: uniqueIndex("uq_roster_snapshot").on(t2.coachId, t2.weekStart)
}));
var kudos = mysqlTable("kudos", {
  id: int("id").autoincrement().primaryKey(),
  fromUserId: int("fromUserId").notNull(),
  coachId: int("coachId").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var sweepReports = mysqlTable("sweep_reports", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  createdByName: varchar("createdByName", { length: 256 }).notNull(),
  snapshotJson: json("snapshotJson").notNull(),
  weekStart: varchar("weekStart", { length: 10 }).notNull(),
  isSaved: tinyint("isSaved").default(0).notNull(),
  scopeType: varchar("scopeType", { length: 16 }).default("all").notNull(),
  scopeCoachId: int("scopeCoachId"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var clientRatings = mysqlTable("client_ratings", {
  id: int("id").autoincrement().primaryKey(),
  coachId: int("coachId").notNull(),
  clientName: varchar("clientName", { length: 256 }).notNull(),
  rating: mysqlEnum("rating", ["green", "yellow", "red"]).notNull(),
  notes: text("notes"),
  ratedAt: timestamp("ratedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (t2) => ({
  uqCoachClient: uniqueIndex("uq_client_rating").on(t2.coachId, t2.clientName)
}));
var slackReminderLog = mysqlTable("slack_reminder_log", {
  id: int("id").autoincrement().primaryKey(),
  coachId: int("coachId").notNull(),
  reminderDate: varchar("reminderDate", { length: 10 }).notNull(),
  reminderIndex: int("reminderIndex").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (t2) => ({
  uqReminderSlot: uniqueIndex("uq_reminder_slot").on(t2.coachId, t2.reminderDate, t2.reminderIndex)
}));
var pausedClients = mysqlTable("paused_clients", {
  id: int("id").primaryKey().autoincrement(),
  coachId: int("coachId").notNull(),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  pausedByUserId: int("pausedByUserId"),
  pausedAt: datetime("pausedAt"),
  resumedAt: datetime("resumedAt")
});
var salesCheckins = mysqlTable("sales_checkins", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 128 }).notNull(),
  recordDate: varchar("recordDate", { length: 10 }).notNull(),
  // YYYY-MM-DD
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (t2) => ({
  uqUserDate: uniqueIndex("uq_sales_user_date").on(t2.userId, t2.recordDate)
}));

// server/db.ts
var db = null;
async function getDb() {
  if (db) return db;
  if (!ENV.databaseUrl) {
    console.error("DATABASE_URL is not set");
    return null;
  }
  try {
    const connection = await mysql.createConnection(ENV.databaseUrl);
    db = drizzle(connection, { schema: schema_exports, mode: "default" });
    return db;
  } catch (error) {
    console.error("Failed to connect to database:", error);
    return null;
  }
}
async function getAllCoaches() {
  const db2 = await getDb();
  if (!db2) return [];
  return db2.select().from(coaches);
}
function getMonday(date2) {
  const d = new Date(date2);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
async function getLastWeekSummary() {
  const db2 = await getDb();
  if (!db2) return null;
  const now = /* @__PURE__ */ new Date();
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - 7);
  const startDate = getMonday(lastMonday);
  const endDateObj = /* @__PURE__ */ new Date(startDate + "T00:00:00");
  endDateObj.setDate(endDateObj.getDate() + 4);
  const endDate = endDateObj.toISOString().slice(0, 10);
  const rows = await db2.select().from(checkinRecords).where(and(gte(checkinRecords.recordDate, startDate), lte(checkinRecords.recordDate, endDate)));
  if (rows.length === 0) return null;
  const allCoaches = await db2.select().from(coaches);
  const coachMap = new Map(allCoaches.map((c) => [c.id, c.name]));
  const records = [];
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
        followupMessagesSent: null
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
        followupMessagesSent: r.followupCount
      });
    }
  }
  return { records, startDate, endDate };
}
async function getAllClientCheckInsForWeek(weekStart) {
  const db2 = await getDb();
  if (!db2) return [];
  return db2.select().from(clientCheckIns).where(eq(clientCheckIns.weekStart, weekStart));
}
async function getClientCheckInsForWeek(coachId, weekStart) {
  const db2 = await getDb();
  if (!db2) return [];
  return db2.select().from(clientCheckIns).where(and(eq(clientCheckIns.coachId, coachId), eq(clientCheckIns.weekStart, weekStart)));
}
async function getAllPerformanceRatings() {
  const db2 = await getDb();
  if (!db2) return [];
  return db2.select().from(clientRatings);
}
async function getCheckinRecordsByDateRange(startDate, endDate) {
  const db2 = await getDb();
  if (!db2) return [];
  const rows = await db2.select().from(checkinRecords).where(and(gte(checkinRecords.recordDate, startDate), lte(checkinRecords.recordDate, endDate)));
  const allCoaches = await db2.select().from(coaches);
  const coachMap = new Map(allCoaches.map((c) => [c.id, c.name]));
  const records = [];
  for (const r of rows) {
    const coachName = coachMap.get(r.coachId) ?? `Coach #${r.coachId}`;
    if (r.morningSubmittedAt) {
      records.push({
        coachId: r.coachId,
        coachName,
        submissionType: "morning",
        moodScore: r.moodScore,
        followupMessagesSent: null,
        disengagementMessagesSent: null
      });
    }
    if (r.followupSubmittedAt) {
      records.push({
        coachId: r.coachId,
        coachName,
        submissionType: "followup",
        moodScore: null,
        followupMessagesSent: r.followupCount,
        disengagementMessagesSent: null
      });
    }
    if (r.disengagementSubmittedAt) {
      records.push({
        coachId: r.coachId,
        coachName,
        submissionType: "disengagement",
        moodScore: null,
        followupMessagesSent: null,
        disengagementMessagesSent: r.disengagementCount
      });
    }
  }
  return records;
}
async function getAllClientCheckInsByWeekRange(weeks) {
  const db2 = await getDb();
  if (!db2) return [];
  if (weeks.length === 0) return [];
  return db2.select().from(clientCheckIns).where(inArray(clientCheckIns.weekStart, weeks));
}
async function getAllActivePauses() {
  return [];
}
async function getAllApprovedExcusesForWeeks(weeks) {
  const db2 = await getDb();
  if (!db2) return [];
  if (weeks.length === 0) return [];
  return db2.select().from(excusedClients).where(and(eq(excusedClients.status, "approved"), inArray(excusedClients.weekStart, weeks)));
}
async function toggleClientSubmitted(params) {
  const db2 = await getDb();
  if (!db2) return;
  const existing = await db2.select().from(clientCheckIns).where(
    and(
      eq(clientCheckIns.coachId, params.coachId),
      eq(clientCheckIns.clientName, params.clientName),
      eq(clientCheckIns.dayOfWeek, params.dayOfWeek),
      eq(clientCheckIns.weekStart, params.weekStart)
    )
  ).limit(1);
  if (existing.length > 0) {
    const newVal = params.newValue ? 1 : 0;
    await db2.update(clientCheckIns).set({
      clientSubmitted: newVal,
      clientSubmittedAt: params.newValue ? /* @__PURE__ */ new Date() : null
    }).where(eq(clientCheckIns.id, existing[0].id));
  } else if (params.newValue) {
    await db2.insert(clientCheckIns).values({
      coachId: params.coachId,
      coachName: params.coachName,
      clientName: params.clientName,
      dayOfWeek: params.dayOfWeek,
      weekStart: params.weekStart,
      completedByUserId: params.submittedByUserId,
      clientSubmitted: 1,
      clientSubmittedAt: /* @__PURE__ */ new Date()
    });
  }
}

// shared/const.ts
var UNAUTHED_ERR_MSG = "UNAUTHORIZED";
var CLIENT_CHECKINS_EPOCH = "2026-03-02";
var ADMIN_EMAILS = [
  "rich@databite.com.au"
];
var DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];

// server/_core/auth.ts
var COACH_EMAILS = {
  "steve@databite.com.au": "Steve",
  "luke@databite.com.au": "Luke",
  "kyah@databite.com.au": "Kyah"
};
var SALES_EMAILS = {
  "yaman@databite.com.au": "Yaman"
};
var ALLOWED_EMAILS = [
  ...ADMIN_EMAILS,
  ...Object.keys(COACH_EMAILS),
  ...Object.keys(SALES_EMAILS)
];
var JWT_SECRET = new TextEncoder().encode(ENV.cookieSecret || "dev-secret-change-me");
var COOKIE_NAME = "session";
var COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
async function createToken(userId) {
  return new SignJWT({ userId }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("30d").sign(JWT_SECRET);
}
async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}
async function authenticateRequest(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const db2 = await getDb();
  if (!db2) return null;
  const [user] = await db2.select().from(users).where(eq2(users.id, payload.userId)).limit(1);
  return user || null;
}
async function registerAuthRoutes(app) {
  const cookieParser = await import("cookie");
  app.use((req, _res, next) => {
    const cookieHeader = req.headers.cookie || "";
    req.cookies = {};
    if (cookieHeader) {
      const parsed = cookieParser.parse(cookieHeader);
      req.cookies = parsed;
    }
    next();
  });
  app.get("/api/auth/me", async (req, res) => {
    try {
      const user = await authenticateRequest(req);
      if (!user) {
        return res.status(401).json(null);
      }
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImageUrl: user.profileImageUrl
      });
    } catch {
      res.status(401).json(null);
    }
  });
  app.post("/api/auth/login", async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    const db2 = await getDb();
    if (!db2) {
      return res.status(500).json({ error: "Database unavailable" });
    }
    let [user] = await db2.select().from(users).where(eq2(users.email, email)).limit(1);
    if (!user) {
      const emailLc = email.toLowerCase();
      const isAdmin = ADMIN_EMAILS.includes(emailLc);
      const isSales = SALES_EMAILS[emailLc] != null;
      const knownName = isAdmin ? "Rich" : COACH_EMAILS[emailLc] || SALES_EMAILS[emailLc] || null;
      const [result] = await db2.insert(users).values({
        email,
        name: knownName || email.split("@")[0],
        role: isAdmin ? "admin" : isSales ? "sales" : "coach"
      });
      [user] = await db2.select().from(users).where(eq2(users.id, result.insertId)).limit(1);
    }
    if (ADMIN_EMAILS.includes(email.toLowerCase()) && user.role !== "admin") {
      await db2.update(users).set({ role: "admin" }).where(eq2(users.id, user.id));
      user = { ...user, role: "admin" };
    }
    const emailLower = email.toLowerCase();
    if (COACH_EMAILS[emailLower]) {
      if (user.role !== "coach") {
        await db2.update(users).set({ role: "coach" }).where(eq2(users.id, user.id));
        user = { ...user, role: "coach" };
      }
      const [existingCoach] = await db2.select().from(coaches).where(eq2(coaches.email, emailLower)).limit(1);
      if (existingCoach) {
        if (!existingCoach.userId) {
          await db2.update(coaches).set({ userId: user.id }).where(eq2(coaches.id, existingCoach.id));
        }
      } else {
        await db2.insert(coaches).values({
          name: COACH_EMAILS[emailLower],
          email: emailLower,
          userId: user.id,
          isActive: 1
        });
      }
    }
    const token = await createToken(user.id);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: ENV.isProduction,
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE * 1e3,
      path: "/"
    });
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  });
  if (!ENV.isProduction) {
    app.get("/api/auth/dev-login", async (req, res) => {
      const email = req.query.email || ADMIN_EMAILS[0];
      const db2 = await getDb();
      if (!db2) return res.status(500).json({ error: "Database unavailable" });
      let [user] = await db2.select().from(users).where(eq2(users.email, email)).limit(1);
      if (!user) {
        const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
        const [result] = await db2.insert(users).values({
          email,
          name: isAdmin ? "Rich" : email.split("@")[0],
          role: isAdmin ? "admin" : "coach"
        });
        [user] = await db2.select().from(users).where(eq2(users.id, result.insertId)).limit(1);
      }
      const token = await createToken(user.id);
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE * 1e3,
        path: "/"
      });
      res.redirect("/client-checkins");
    });
  }
  app.get("/api/auth/google", (_req, res) => {
    const redirectUri = `${ENV.appUrl}/api/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account"
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });
  app.get("/api/auth/google/callback", async (req, res) => {
    const { code, error: oauthError } = req.query;
    if (oauthError || !code || typeof code !== "string") {
      return res.redirect("/login?error=google_denied");
    }
    try {
      const redirectUri = `${ENV.appUrl}/api/auth/google/callback`;
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code"
        }).toString()
      });
      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        console.error("[Google OAuth] Token exchange failed:", tokenRes.status, errBody);
        console.error("[Google OAuth] redirect_uri used:", redirectUri);
        console.error("[Google OAuth] client_id used:", ENV.googleClientId);
        return res.redirect("/login?error=google_token_failed");
      }
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        return res.redirect("/login?error=google_token_failed");
      }
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      if (!userInfoRes.ok) {
        return res.redirect("/login?error=google_userinfo_failed");
      }
      const userInfo = await userInfoRes.json();
      const email = userInfo.email?.toLowerCase();
      if (!email) {
        return res.redirect("/login?error=no_email");
      }
      if (!ALLOWED_EMAILS.includes(email)) {
        return res.redirect("/login?error=not_approved");
      }
      const db2 = await getDb();
      if (!db2) {
        return res.redirect("/login?error=db_unavailable");
      }
      let [user] = await db2.select().from(users).where(eq2(users.email, email)).limit(1);
      if (!user) {
        const isAdmin = ADMIN_EMAILS.includes(email);
        const knownName = isAdmin ? "Rich" : COACH_EMAILS[email] || null;
        const [result] = await db2.insert(users).values({
          email,
          name: knownName || userInfo.name || email.split("@")[0],
          role: isAdmin ? "admin" : "coach"
        });
        [user] = await db2.select().from(users).where(eq2(users.id, result.insertId)).limit(1);
      }
      if (ADMIN_EMAILS.includes(email) && user.role !== "admin") {
        await db2.update(users).set({ role: "admin" }).where(eq2(users.id, user.id));
        user = { ...user, role: "admin" };
      }
      if (COACH_EMAILS[email]) {
        if (user.role !== "coach") {
          await db2.update(users).set({ role: "coach" }).where(eq2(users.id, user.id));
          user = { ...user, role: "coach" };
        }
        const [existingCoach] = await db2.select().from(coaches).where(eq2(coaches.email, email)).limit(1);
        if (existingCoach) {
          if (!existingCoach.userId) {
            await db2.update(coaches).set({ userId: user.id }).where(eq2(coaches.id, existingCoach.id));
          }
        } else {
          await db2.insert(coaches).values({
            name: COACH_EMAILS[email],
            email,
            userId: user.id,
            isActive: 1
          });
        }
      }
      const token = await createToken(user.id);
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: ENV.isProduction,
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE * 1e3,
        path: "/"
      });
      res.redirect("/");
    } catch {
      res.redirect("/login?error=google_failed");
    }
  });
  app.post("/api/auth/logout", (_req, res) => {
    res.cookie(COOKIE_NAME, "", {
      httpOnly: true,
      secure: ENV.isProduction,
      sameSite: "lax",
      maxAge: 0,
      path: "/"
    });
    res.json({ ok: true });
  });
}

// server/routers.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import { eq as eq4, and as and2, gte as gte2, lte as lte2, desc, sql, inArray as inArray2, asc, isNull } from "drizzle-orm";

// server/rosterUtils.ts
var SHEET_ID = "1puu4oLAmC5jV_GEmRrMxvXuTak_dl6pOJ6iWC44Nfl4";
var SHEET_TAB = "CLIENT ROSTER";
var DAYS2 = ["monday", "tuesday", "wednesday", "thursday", "friday"];
var _cachedRows = null;
var _cacheTime = 0;
var CACHE_TTL_MS = 5 * 60 * 1e3;
async function fetchSheetRows() {
  const now = Date.now();
  if (_cachedRows && now - _cacheTime < CACHE_TTL_MS) return _cachedRows;
  const apiKey = ENV.googleSheetsApiKey;
  if (!apiKey) return [];
  const range = encodeURIComponent(`${SHEET_TAB}!A1:J200`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${apiKey}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      const json2 = await res.json();
      _cachedRows = json2.values ?? [];
      _cacheTime = now;
      return _cachedRows;
    } catch {
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1e3 * (attempt + 1)));
    }
  }
  return [];
}
async function fetchRosterForCoach(coachName) {
  const empty = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: []
  };
  const rows = await fetchSheetRows();
  if (rows.length === 0) return empty;
  const upperName = coachName.toUpperCase();
  const aliases = [
    upperName,
    upperName.replace("STEVE", "STEPHEN"),
    upperName.replace("STEPHEN", "STEVE")
  ];
  let sectionStart = -1;
  for (let i = 0; i < rows.length; i++) {
    const cell = (rows[i]?.[0] ?? "").trim().toUpperCase();
    if (aliases.some((a) => cell === `${a} - MONDAY`)) {
      sectionStart = i;
      break;
    }
  }
  if (sectionStart === -1) return empty;
  const headerRow = rows[sectionStart];
  const prevRow = sectionStart > 0 ? rows[sectionStart - 1] ?? [] : [];
  const colToDay = { 0: "monday" };
  for (let col = 1; col <= 9; col++) {
    const fromHeader = (headerRow[col] ?? "").trim().toLowerCase();
    const fromPrev = (prevRow[col] ?? "").trim().toLowerCase();
    const dayName = DAYS2.includes(fromHeader) ? fromHeader : DAYS2.includes(fromPrev) ? fromPrev : null;
    if (dayName) colToDay[col] = dayName;
  }
  const days = { ...empty };
  for (const [colStr, day] of Object.entries(colToDay)) {
    const col = Number(colStr);
    if (col === 0) continue;
    const cell = (headerRow[col] ?? "").trim();
    if (cell && !DAYS2.includes(cell.toLowerCase())) {
      const name = cleanClientName(cell);
      if (name) days[day].push(name);
    }
  }
  for (let i = sectionStart + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const firstCell = (row[0] ?? "").trim();
    if (/^[A-Z]+ - MONDAY$/i.test(firstCell) && i !== sectionStart) break;
    if (!firstCell && row.every((c) => !c?.trim())) break;
    for (const [colStr, day] of Object.entries(colToDay)) {
      const raw = (row[Number(colStr)] ?? "").trim();
      if (!raw) continue;
      const name = cleanClientName(raw);
      if (name) days[day].push(name);
    }
  }
  return days;
}
function cleanClientName(raw) {
  if (!raw) return "";
  if (/^CLIENT NAME$/i.test(raw.trim())) return "";
  if (/^UPFRONT$/i.test(raw.trim())) return "";
  if (/^---/.test(raw.trim())) return "";
  return raw.replace(/\s*\(.*\)\s*$/, "").trim();
}
async function fetchRawRosterForCoach(coachName) {
  const empty = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: []
  };
  const rows = await fetchSheetRows();
  if (rows.length === 0) return empty;
  const upperName = coachName.toUpperCase();
  const aliases = [upperName, upperName.replace("STEVE", "STEPHEN"), upperName.replace("STEPHEN", "STEVE")];
  let sectionStart = -1;
  for (let i = 0; i < rows.length; i++) {
    const cell = (rows[i]?.[0] ?? "").trim().toUpperCase();
    if (aliases.some((a) => cell === `${a} - MONDAY`)) {
      sectionStart = i;
      break;
    }
  }
  if (sectionStart === -1) return empty;
  const headerRow = rows[sectionStart];
  const prevRow = sectionStart > 0 ? rows[sectionStart - 1] ?? [] : [];
  const colToDay = { 0: "monday" };
  for (let col = 1; col <= 9; col++) {
    const fromHeader = (headerRow[col] ?? "").trim().toLowerCase();
    const fromPrev = (prevRow[col] ?? "").trim().toLowerCase();
    const dayName = DAYS2.includes(fromHeader) ? fromHeader : DAYS2.includes(fromPrev) ? fromPrev : null;
    if (dayName) colToDay[col] = dayName;
  }
  const days = { ...empty };
  for (const [colStr, day] of Object.entries(colToDay)) {
    const col = Number(colStr);
    if (col === 0) continue;
    const cell = (headerRow[col] ?? "").trim();
    if (cell && !DAYS2.includes(cell.toLowerCase()) && !/^CLIENT NAME$/i.test(cell) && !/^UPFRONT$/i.test(cell) && !/^---/.test(cell)) {
      days[day].push(cell);
    }
  }
  for (let i = sectionStart + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const firstCell = (row[0] ?? "").trim();
    if (/^[A-Z]+ - MONDAY$/i.test(firstCell) && i !== sectionStart) break;
    if (!firstCell && row.every((c) => !c?.trim())) break;
    for (const [colStr, day] of Object.entries(colToDay)) {
      const raw = (row[Number(colStr)] ?? "").trim();
      if (!raw || /^CLIENT NAME$/i.test(raw) || /^UPFRONT$/i.test(raw) || /^---/.test(raw)) continue;
      days[day].push(raw);
    }
  }
  return days;
}

// server/typeformBackfill.ts
var TYPEFORM_API_TOKEN = ENV.typeformApiToken ?? "";
var FORM_CONFIGS = [
  {
    formId: "lRvWjdgl",
    coachName: "Steve",
    firstNameFieldId: "zTLboa1Y892a",
    lastNameFieldId: "KLsh0B5X4l2V"
  },
  {
    formId: "i9de5jMN",
    coachName: "Luke",
    firstNameFieldId: "X9l68HkBqahH",
    lastNameFieldId: "kkVVNqmKSCZp"
  },
  {
    formId: "hrGCn0V0",
    coachName: "Kyah",
    firstNameFieldId: "x0Li5tbrkvGK",
    lastNameFieldId: "GIqMvcsNnfLH"
  }
];
function getWeekStart(date2) {
  const AEST_OFFSET_MS = 10 * 60 * 60 * 1e3;
  const local = new Date(date2.getTime() + AEST_OFFSET_MS);
  const day = local.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  local.setUTCDate(local.getUTCDate() + diff);
  return local.toISOString().slice(0, 10);
}
function getDayOfWeek(submittedAt) {
  const AEST_OFFSET_MS = 10 * 60 * 60 * 1e3;
  const local = new Date(new Date(submittedAt).getTime() + AEST_OFFSET_MS);
  const day = local.getUTCDay();
  const map = {
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday"
  };
  return map[day] ?? null;
}
function normaliseName(s) {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}
function matchClientName(firstName, lastName, rosterClients) {
  const fullName = normaliseName(`${firstName} ${lastName}`);
  for (const c of rosterClients) {
    if (normaliseName(c) === fullName) return c;
  }
  for (const c of rosterClients) {
    const cn = normaliseName(c);
    if (cn.startsWith(fullName) || fullName.startsWith(cn)) return c;
  }
  const lastNorm = normaliseName(lastName);
  const firstInitial = normaliseName(firstName).charAt(0);
  for (const c of rosterClients) {
    const cn = normaliseName(c);
    if (cn.includes(lastNorm) && cn.includes(firstInitial)) return c;
  }
  const first3 = normaliseName(firstName).slice(0, 3);
  const last3 = normaliseName(lastName).slice(0, 3);
  for (const c of rosterClients) {
    const cn = normaliseName(c);
    if (cn.includes(first3) && cn.includes(last3)) return c;
  }
  return null;
}
async function backfillForm(config, weekStart) {
  const result = {
    formId: config.formId,
    coachName: config.coachName,
    totalResponses: 0,
    matched: 0,
    unmatched: [],
    errors: []
  };
  const allCoaches = await getAllCoaches();
  const coach = allCoaches.find((c) => c.name.toLowerCase() === config.coachName.toLowerCase());
  if (!coach) {
    result.errors.push(`No coach record found for ${config.coachName}`);
    return result;
  }
  const roster = await fetchRosterForCoach(config.coachName);
  const allClients = [];
  for (const day of DAYS2) {
    allClients.push(...roster[day] ?? []);
  }
  const uniqueClients = Array.from(new Set(allClients));
  const sundayBeforeWeek = /* @__PURE__ */ new Date(`${weekStart}T00:00:00+10:00`);
  sundayBeforeWeek.setDate(sundayBeforeWeek.getDate() - 1);
  const sinceDate = sundayBeforeWeek.toISOString().replace(/\.\d{3}Z$/, "Z");
  const url = `https://api.typeform.com/forms/${config.formId}/responses?page_size=200&since=${sinceDate}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${TYPEFORM_API_TOKEN}` }
  });
  if (!resp.ok) {
    result.errors.push(`Typeform API error: ${resp.status} ${resp.statusText}`);
    return result;
  }
  const data = await resp.json();
  const items = data.items ?? [];
  result.totalResponses = items.length;
  for (const item of items) {
    const answers = item.answers ?? [];
    const firstNameAnswer = answers.find((a) => a.field?.id === config.firstNameFieldId);
    const lastNameAnswer = answers.find((a) => a.field?.id === config.lastNameFieldId);
    if (!firstNameAnswer || !lastNameAnswer) continue;
    const firstName = (firstNameAnswer.text ?? "").trim();
    const lastName = (lastNameAnswer.text ?? "").trim();
    if (!firstName && !lastName) continue;
    const submittedAt = item.submitted_at ?? "";
    const dayOfWeek = getDayOfWeek(submittedAt);
    if (!dayOfWeek) continue;
    const submissionWeekStart = getWeekStart(new Date(submittedAt));
    const matchedClient = matchClientName(firstName, lastName, uniqueClients);
    if (!matchedClient) {
      result.unmatched.push(`${firstName} ${lastName}`);
      continue;
    }
    try {
      await toggleClientSubmitted({
        coachId: coach.id,
        coachName: coach.name,
        clientName: matchedClient,
        dayOfWeek,
        weekStart: submissionWeekStart,
        newValue: true,
        submittedByUserId: 0
        // 0 = system/Typeform backfill
      });
      result.matched++;
    } catch (err) {
      result.errors.push(`Failed to mark ${matchedClient}: ${err.message}`);
    }
  }
  return result;
}
async function runTypeformBackfill() {
  const weekStart = getWeekStart(/* @__PURE__ */ new Date());
  const results = await Promise.all(FORM_CONFIGS.map((c) => backfillForm(c, weekStart)));
  return results;
}

// server/slackReminders.ts
import { eq as eq3 } from "drizzle-orm";
var SLACK_BOT_TOKEN = ENV.slackBotToken;
var APP_URL = ENV.appUrl || "https://databitecoach.com";
var REMINDER_LABELS = [
  { index: 0, label: "Morning Review", path: "/coach?form=morning", emoji: "\u{1F305}" },
  { index: 1, label: "Follow-Up Outreach", path: "/coach?form=followup", emoji: "\u{1F4E8}" },
  { index: 2, label: "Disengagement Outreach", path: "/coach?form=disengagement", emoji: "\u{1F50D}" }
];
var REMINDER_DESCRIPTIONS = [
  "Time to submit your morning review \u2014 log last work day's scheduled vs completed check-ins.",
  "Check-in cut-off has passed \u2014 log how many follow-up messages you've sent to clients who missed their check-in.",
  "Time to log your disengagement outreach \u2014 how many clients haven't logged weight/nutrition for 3+ days did you reach out to?"
];
async function sendSlackDM(slackUserId, text2) {
  if (!SLACK_BOT_TOKEN) {
    console.warn("[Slack] SLACK_BOT_TOKEN not set \u2014 skipping DM");
    return false;
  }
  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`
      },
      body: JSON.stringify({
        channel: slackUserId,
        text: text2,
        unfurl_links: false
      })
    });
    const data = await response.json();
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
function getLocalHHMM(timezone) {
  const now = /* @__PURE__ */ new Date();
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(now);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}
function getLocalDateString(timezone) {
  const now = /* @__PURE__ */ new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}
function getLocalDayOfWeek(timezone) {
  const now = /* @__PURE__ */ new Date();
  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: timezone,
    weekday: "short"
  });
  const day = formatter.format(now);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[day] ?? (/* @__PURE__ */ new Date()).getDay();
}
function parseJSON(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
var DEFAULT_WORKDAYS = [1, 2, 3, 4, 5];
var DEFAULT_TIMES = ["08:30", "11:00", "14:00"];
async function claimReminderSlot(coachId, reminderDate, reminderIndex) {
  const db2 = await getDb();
  if (!db2) return false;
  try {
    await db2.insert(slackReminderLog).values({ coachId, reminderDate, reminderIndex });
    return true;
  } catch (err) {
    const anyErr = err;
    const causeCode = anyErr?.cause?.code;
    const causeErrno = anyErr?.cause?.errno;
    const causeMsg = anyErr?.cause?.message ?? "";
    const topMsg = anyErr?.message ?? "";
    const isDuplicate = causeCode === "ER_DUP_ENTRY" || causeErrno === 1062 || causeMsg.includes("Duplicate entry") || topMsg.includes("Duplicate entry");
    if (isDuplicate) {
      console.log(`[Slack Reminders] Slot already claimed for coach ${coachId} on ${reminderDate} index ${reminderIndex} \u2014 skipping duplicate`);
      return false;
    }
    console.error("[Slack Reminders] claimReminderSlot unexpected error:", err);
    return false;
  }
}
async function runReminderTick() {
  const db2 = await getDb();
  if (!db2) return;
  const allCoaches = await db2.select().from(coaches).where(eq3(coaches.isActive, 1));
  for (const coach of allCoaches) {
    if (!coach.slackUserId || !coach.remindersEnabled) continue;
    const timezone = coach.timezone ?? "Australia/Melbourne";
    const workdays = parseJSON(coach.workdays, DEFAULT_WORKDAYS);
    const reminderTimes = parseJSON(coach.reminderTimes, DEFAULT_TIMES);
    const localDay = getLocalDayOfWeek(timezone);
    const localTime = getLocalHHMM(timezone);
    const localDate = getLocalDateString(timezone);
    if (coach.leaveStartDate && coach.leaveEndDate) {
      if (localDate >= coach.leaveStartDate && localDate <= coach.leaveEndDate) {
        console.log(`[Slack Reminders] Coach ${coach.id} is on scheduled leave (${coach.leaveStartDate} \u2013 ${coach.leaveEndDate}) \u2014 skipping`);
        continue;
      }
    } else if (coach.leaveStartDate && !coach.leaveEndDate) {
      if (localDate >= coach.leaveStartDate) {
        console.log(`[Slack Reminders] Coach ${coach.id} is on open-ended leave from ${coach.leaveStartDate} \u2014 skipping`);
        continue;
      }
    }
    if (!workdays.includes(localDay)) continue;
    const matchIndex = reminderTimes.indexOf(localTime);
    if (matchIndex === -1) continue;
    const reminder = REMINDER_LABELS[matchIndex];
    if (!reminder) continue;
    const claimed = await claimReminderSlot(coach.id, localDate, matchIndex);
    if (!claimed) continue;
    const desc2 = REMINDER_DESCRIPTIONS[matchIndex] ?? "";
    const url = `${APP_URL}${reminder.path}`;
    const message = `${reminder.emoji} *Coach Check-In Reminder \u2014 ${reminder.label}*
${desc2}

\u{1F449} <${url}|Open the form here>`;
    await sendSlackDM(coach.slackUserId, message);
  }
}
var SALES_TEAM = [
  { name: "Yaman", slackUserId: "U0AN8E2RE5S", timezone: "Australia/Melbourne", workdays: [1, 2, 3, 4, 5], morningTime: "08:30", eveningTime: "18:00" }
];
var SALES_REMINDERS = [
  { index: 10, time: "morningTime", label: "Morning Check-In", emoji: "\u{1F305}", desc: "Time to submit your morning check-in \u2014 how are you feeling and what are your planned hours?", path: "/sales" },
  { index: 11, time: "eveningTime", label: "Evening Check-In", emoji: "\u{1F319}", desc: "End of day \u2014 how did your day go, any sales, and what are your planned hours for tomorrow?", path: "/sales" }
];
async function runSalesReminderTick() {
  for (const person of SALES_TEAM) {
    const localDay = getLocalDayOfWeek(person.timezone);
    const localTime = getLocalHHMM(person.timezone);
    const localDate = getLocalDateString(person.timezone);
    if (!person.workdays.includes(localDay)) continue;
    for (const reminder of SALES_REMINDERS) {
      const targetTime = person[reminder.time];
      if (localTime !== targetTime) continue;
      const claimed = await claimReminderSlot(9e3 + SALES_TEAM.indexOf(person), localDate, reminder.index);
      if (!claimed) continue;
      const url = `${APP_URL}${reminder.path}`;
      const message = `${reminder.emoji} *Sales Check-In Reminder \u2014 ${reminder.label}*
${reminder.desc}

\u{1F449} <${url}|Open the form here>`;
      await sendSlackDM(person.slackUserId, message);
    }
  }
}
async function sendFortnightlyPerformanceReviewReminder() {
  const MANAGER_SLACK_ID4 = ENV.managerSlackId;
  if (!SLACK_BOT_TOKEN || !MANAGER_SLACK_ID4) {
    console.warn("[Slack Fortnightly] SLACK_BOT_TOKEN or MANAGER_SLACK_ID not set \u2014 skipping");
    return;
  }
  const now = /* @__PURE__ */ new Date();
  const aestDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  const aestDate = /* @__PURE__ */ new Date(aestDateStr + "T00:00:00Z");
  const dayOfWeek = aestDate.getUTCDay() || 7;
  const thursday = new Date(aestDate);
  thursday.setUTCDate(aestDate.getUTCDate() + (4 - dayOfWeek));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  if (isoWeek % 2 !== 0) {
    console.log(`[Slack Fortnightly] ISO week ${isoWeek} is odd \u2014 coach review week, no manager reminder`);
    return;
  }
  const APP_URL_LOCAL = ENV.appUrl || "https://databitecoach.com";
  const url = `${APP_URL_LOCAL}/client-progress`;
  const message = `\u{1F4CA} *Fortnightly Client Progress Review*
It's your fortnightly check-in to review and update client ratings in the performance tracker.

*What to do:*
\u2022 Review each coach's roster and update the traffic light ratings (\u{1F7E2} On Track / \u{1F7E1} Neutral / \u{1F534} Off Track)
\u2022 Add notes for any clients who have changed status since the last review
\u2022 Check the KPI summary \u2014 target is *70% On Track* across the business

\u{1F449} <${url}|Open Client Progress Tracker>`;
  await sendSlackDM(MANAGER_SLACK_ID4, message);
  console.log("[Slack Fortnightly] Performance review reminder sent to manager");
}
async function sendFortnightlySweepReportReminder() {
  const MANAGER_SLACK_ID4 = ENV.managerSlackId;
  if (!SLACK_BOT_TOKEN || !MANAGER_SLACK_ID4) {
    console.warn("[Slack Sweep Reminder] SLACK_BOT_TOKEN or MANAGER_SLACK_ID not set \u2014 skipping");
    return;
  }
  const now = /* @__PURE__ */ new Date();
  const aestDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  const aestDate = /* @__PURE__ */ new Date(aestDateStr + "T00:00:00Z");
  const dayOfWeek = aestDate.getUTCDay() || 7;
  const thursday = new Date(aestDate);
  thursday.setUTCDate(aestDate.getUTCDate() + (4 - dayOfWeek));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  if (isoWeek % 2 === 0) {
    console.log(`[Slack Sweep Reminder] ISO week ${isoWeek} is even \u2014 performance review week, no sweep reminder`);
    return;
  }
  const APP_URL_LOCAL = ENV.appUrl || "https://databitecoach.com";
  const url = `${APP_URL_LOCAL}/client-progress`;
  const message = `\u{1F4CB} *Fortnightly Post-Sweep Report*
Time to generate and save this fortnight's sweep report.

*What to do:*
\u2022 Head to Client Progress and click *Generate Post-Sweep Report*
\u2022 Give the report a title (e.g. "Sweep \u2014 Week ${isoWeek}, ${(/* @__PURE__ */ new Date()).getFullYear()}")
\u2022 Review the report, then click *Save Report* to add it to the history
\u2022 Use *Compare to Previous* to see what changed since the last sweep

\u{1F449} <${url}|Open Client Progress Tracker>`;
  await sendSlackDM(MANAGER_SLACK_ID4, message);
  console.log("[Slack Sweep Reminder] Fortnightly sweep report reminder sent to manager");
}

// server/routers.ts
function getTodayMelbourne() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(/* @__PURE__ */ new Date());
}
function getMelbourneNow() {
  const now = /* @__PURE__ */ new Date();
  const melbStr = now.toLocaleString("en-US", { timeZone: "Australia/Melbourne" });
  return new Date(melbStr);
}
async function computeDisengagedClients(coachId, coachName, weekStart) {
  const db2 = await getDb();
  if (!db2) return [];
  const epochWeek = getMonday2(CLIENT_CHECKINS_EPOCH);
  const roster = await fetchRosterForCoach(coachName);
  const allWeeks = getWeeksBetween(epochWeek, weekStart);
  const completions = await db2.select().from(clientCheckIns).where(eq4(clientCheckIns.coachId, coachId));
  const approvedExcuses = await db2.select().from(excusedClients).where(and2(eq4(excusedClients.coachId, coachId), eq4(excusedClients.status, "approved")));
  const starts = await db2.select().from(rosterClientStarts).where(eq4(rosterClientStarts.coachId, coachId));
  const completionSet = new Set(
    completions.filter((c) => c.completedAt != null).map((c) => `${c.clientName}|${c.dayOfWeek}|${c.weekStart}`)
  );
  const excuseSet = new Set(
    approvedExcuses.map((e) => `${e.clientName}|${e.dayOfWeek}|${e.weekStart}`)
  );
  const startMap = new Map(
    starts.map((s) => [`${s.clientName}|${s.dayOfWeek}`, s.firstWeekStart])
  );
  const results = [];
  for (const day of DAYS) {
    const clients = roster[day] ?? [];
    for (const clientName of clients) {
      const clientStart = startMap.get(`${clientName}|${day}`) ?? epochWeek;
      let missed = 0;
      let lastCompleted = null;
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
          lastCompletedWeek: lastCompleted
        });
      }
    }
  }
  return results;
}
function getMonday2(dateStr) {
  const d = /* @__PURE__ */ new Date(dateStr + "T12:00:00+10:00");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
function getDayKey(dateStr) {
  const d = /* @__PURE__ */ new Date(dateStr + "T12:00:00+10:00");
  const day = d.getUTCDay();
  const map = { 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday" };
  return map[day] ?? null;
}
function getWeeksBetween(startWeek, endWeek) {
  const weeks = [];
  let current = /* @__PURE__ */ new Date(endWeek + "T12:00:00+10:00");
  const start = /* @__PURE__ */ new Date(startWeek + "T12:00:00+10:00");
  while (current >= start) {
    weeks.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() - 7);
  }
  return weeks;
}
function addDays(dateStr, n) {
  const d = /* @__PURE__ */ new Date(dateStr + "T12:00:00+10:00");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
async function requireDb() {
  const db2 = await getDb();
  if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db2;
}
var t = initTRPC.context().create({
  transformer: superjson
});
var publicProcedure = t.procedure;
var protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
var adminProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
async function notifyManagerOfSubmission(coachId, submissionType, details) {
  const managerSlackId = ENV.managerSlackId;
  if (!managerSlackId || !ENV.slackBotToken) return;
  try {
    const db2 = await requireDb();
    const [coach] = await db2.select().from(coaches).where(eq4(coaches.id, coachId)).limit(1);
    if (!coach) return;
    const appUrl = ENV.appUrl || "https://coach.databite.com.au";
    const emojis = { morning: "\u{1F305}", followup: "\u{1F4E8}", disengagement: "\u{1F50D}" };
    const labels = { morning: "Morning Review", followup: "Follow-Up Outreach", disengagement: "Disengagement Outreach" };
    const emoji = emojis[submissionType] ?? "\u{1F4CB}";
    const label = labels[submissionType] ?? submissionType;
    const isSales = !!details._isSales;
    const displayName = isSales ? details._salesUser ?? "Sales" : coach.name;
    const MOOD_EMOJIS = ["\u{1F614}", "\u{1F615}", "\u{1F610}", "\u{1F642}", "\u{1F929}"];
    const MOOD_LABELS = ["Not good", "Below average", "Okay", "Good", "Amazing"];
    let summary = "";
    if (isSales && submissionType === "morning") {
      const moodVal = details.moodScore;
      const mood = moodVal ? `${MOOD_EMOJIS[moodVal - 1]} ${MOOD_LABELS[moodVal - 1]}` : "Not set";
      const hours = details.intendedWorkingHours ?? "Not set";
      summary = `*Mood:* ${mood}
*Intended Hours:* ${hours}`;
      if (details.morningNotes) summary += `
*Notes:* ${details.morningNotes}`;
    } else if (submissionType === "morning") {
      const moodVal = details.moodScore;
      const mood = moodVal ? `${MOOD_EMOJIS[moodVal - 1]} ${MOOD_LABELS[moodVal - 1]}` : "Not set";
      const hours = details.workingHours ? `${details.workingHours}` : "Not set";
      const notes = details.morningNotes ? `${details.morningNotes}` : "";
      summary = `*Mood:* ${mood}
*Working Hours:* ${hours}`;
      if (details.actionPlan) summary += `
*Action Plan:* ${details.actionPlan}`;
      if (notes) summary += `
*Notes:* ${notes}`;
    } else if (submissionType === "followup") {
      const count = details.followupMessagesSent ?? 0;
      summary = `*Messages Sent:* ${count}`;
      if (details.notes) summary += `
*Notes:* ${details.notes}`;
    } else if (submissionType === "disengagement") {
      const count = details.disengagementMessagesSent ?? 0;
      summary = `*Outreach Sent:* ${count}`;
      if (details.notes) summary += `
*Notes:* ${details.notes}`;
    }
    const link = isSales ? `${appUrl}/sales` : `${appUrl}/dashboard`;
    const message = `${emoji} *${displayName}* \u2014 ${label}

${summary}

\u{1F449} <${link}|${isSales ? "View Sales" : "View Dashboard"}>`;
    await sendSlackDM(managerSlackId, message);
    console.log(`[Slack Notify] Sent ${submissionType} notification for ${displayName}`);
  } catch (err) {
    console.error("[Slack Notify] Error notifying manager:", err);
  }
}
var checkinsRouter = t.router({
  /** Upsert morning check-in for today. */
  submitMorning: protectedProcedure.input(
    z.object({
      coachId: z.number(),
      recordDate: z.string(),
      scheduledCount: z.number().optional(),
      completedCount: z.number().optional(),
      moodScore: z.number().min(1).max(5).optional(),
      actionPlan: z.string().optional(),
      workingHours: z.string().optional(),
      morningNotes: z.string().optional()
    })
  ).mutation(async ({ input }) => {
    const db2 = await requireDb();
    const existing = await db2.select().from(checkinRecords).where(and2(eq4(checkinRecords.coachId, input.coachId), eq4(checkinRecords.recordDate, input.recordDate))).limit(1);
    if (existing.length > 0) {
      await db2.update(checkinRecords).set({
        scheduledCount: input.scheduledCount ?? existing[0].scheduledCount,
        completedCount: input.completedCount ?? existing[0].completedCount,
        moodScore: input.moodScore ?? existing[0].moodScore,
        actionPlan: input.actionPlan ?? existing[0].actionPlan,
        workingHours: input.workingHours ?? existing[0].workingHours,
        morningNotes: input.morningNotes ?? existing[0].morningNotes,
        morningSubmittedAt: /* @__PURE__ */ new Date()
      }).where(eq4(checkinRecords.id, existing[0].id));
      notifyManagerOfSubmission(input.coachId, "morning", input).catch(() => {
      });
      return { id: existing[0].id, updated: true };
    }
    const [result] = await db2.insert(checkinRecords).values({
      coachId: input.coachId,
      recordDate: input.recordDate,
      scheduledCount: input.scheduledCount,
      completedCount: input.completedCount,
      moodScore: input.moodScore,
      actionPlan: input.actionPlan,
      workingHours: input.workingHours,
      morningNotes: input.morningNotes,
      morningSubmittedAt: /* @__PURE__ */ new Date()
    });
    notifyManagerOfSubmission(input.coachId, "morning", input).catch(() => {
    });
    return { id: result.insertId, updated: false };
  }),
  /** Update today's record with follow-up fields. */
  submitFollowup: protectedProcedure.input(
    z.object({
      coachId: z.number(),
      recordDate: z.string(),
      followupMessagesSent: z.number().optional(),
      notes: z.string().optional()
    })
  ).mutation(async ({ input }) => {
    const db2 = await requireDb();
    const existing = await db2.select().from(checkinRecords).where(and2(eq4(checkinRecords.coachId, input.coachId), eq4(checkinRecords.recordDate, input.recordDate))).limit(1);
    if (existing.length > 0) {
      await db2.update(checkinRecords).set({
        followupCount: input.followupMessagesSent ?? existing[0].followupCount,
        followupNotes: input.notes ?? existing[0].followupNotes,
        followupSubmittedAt: /* @__PURE__ */ new Date()
      }).where(eq4(checkinRecords.id, existing[0].id));
      notifyManagerOfSubmission(input.coachId, "followup", input).catch(() => {
      });
      return { id: existing[0].id, updated: true };
    }
    const [result] = await db2.insert(checkinRecords).values({
      coachId: input.coachId,
      recordDate: input.recordDate,
      followupCount: input.followupMessagesSent,
      followupNotes: input.notes,
      followupSubmittedAt: /* @__PURE__ */ new Date()
    });
    notifyManagerOfSubmission(input.coachId, "followup", input).catch(() => {
    });
    return { id: result.insertId, updated: false };
  }),
  /** Update today's record with disengagement fields. */
  submitDisengagement: protectedProcedure.input(
    z.object({
      coachId: z.number(),
      recordDate: z.string(),
      disengagementMessagesSent: z.number().optional(),
      notes: z.string().optional()
    })
  ).mutation(async ({ input }) => {
    const db2 = await requireDb();
    const existing = await db2.select().from(checkinRecords).where(and2(eq4(checkinRecords.coachId, input.coachId), eq4(checkinRecords.recordDate, input.recordDate))).limit(1);
    if (existing.length > 0) {
      await db2.update(checkinRecords).set({
        disengagementCount: input.disengagementMessagesSent ?? existing[0].disengagementCount,
        disengagementNotes: input.notes ?? existing[0].disengagementNotes,
        disengagementSubmittedAt: /* @__PURE__ */ new Date()
      }).where(eq4(checkinRecords.id, existing[0].id));
      notifyManagerOfSubmission(input.coachId, "disengagement", input).catch(() => {
      });
      return { id: existing[0].id, updated: true };
    }
    const [result] = await db2.insert(checkinRecords).values({
      coachId: input.coachId,
      recordDate: input.recordDate,
      disengagementCount: input.disengagementMessagesSent,
      disengagementNotes: input.notes,
      disengagementSubmittedAt: /* @__PURE__ */ new Date()
    });
    notifyManagerOfSubmission(input.coachId, "disengagement", input).catch(() => {
    });
    return { id: result.insertId, updated: false };
  }),
  /** Get today's checkin record for a specific coach — returns structured list by submission type. */
  todayByCoach: protectedProcedure.input(
    z.object({
      coachId: z.number(),
      recordDate: z.string()
    })
  ).query(async ({ input }) => {
    const db2 = await requireDb();
    const rows = await db2.select().from(checkinRecords).where(and2(eq4(checkinRecords.coachId, input.coachId), eq4(checkinRecords.recordDate, input.recordDate))).limit(1);
    if (rows.length === 0) return [];
    const rec = rows[0];
    const results = [];
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
        submittedAt: rec.morningSubmittedAt
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
        submittedAt: rec.followupSubmittedAt
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
        submittedAt: rec.disengagementSubmittedAt
      });
    }
    return results;
  }),
  /** Aggregated stats across coaches for a date range. */
  aggregate: adminProcedure.input(
    z.object({
      days: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional()
    })
  ).query(async ({ input }) => {
    const db2 = await requireDb();
    const today = getTodayMelbourne();
    const endDate = input.endDate ?? today;
    const startDate = input.startDate ?? (input.days ? addDays(today, -(input.days - 1)) : addDays(today, -6));
    const rows = await db2.select().from(checkinRecords).where(and2(gte2(checkinRecords.recordDate, startDate), lte2(checkinRecords.recordDate, endDate)));
    const totalRecords = rows.length;
    const morningCount = rows.filter((r) => r.morningSubmittedAt).length;
    const followupCount = rows.filter((r) => r.followupSubmittedAt).length;
    const disengagementCount = rows.filter((r) => r.disengagementSubmittedAt).length;
    const moodScores = rows.filter((r) => r.moodScore != null).map((r) => r.moodScore);
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
      totalCompleted
    };
  }),
  /** Raw records for a date range — returns flat list with submissionType markers. */
  byDateRange: adminProcedure.input(
    z.object({
      startDate: z.string(),
      endDate: z.string()
    })
  ).query(async ({ input }) => {
    const db2 = await requireDb();
    const rows = await db2.select({
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
      disengagementSubmittedAt: checkinRecords.disengagementSubmittedAt
    }).from(checkinRecords).where(and2(gte2(checkinRecords.recordDate, input.startDate), lte2(checkinRecords.recordDate, input.endDate))).orderBy(desc(checkinRecords.recordDate));
    const flat = [];
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
          followupMessagesSent: null,
          disengagementMessagesSent: null,
          submittedAt: r.morningSubmittedAt
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
          followupMessagesSent: r.followupCount,
          disengagementMessagesSent: null,
          submittedAt: r.followupSubmittedAt
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
          followupMessagesSent: null,
          disengagementMessagesSent: r.disengagementCount,
          submittedAt: r.disengagementSubmittedAt
        });
      }
    }
    return flat;
  }),
  /** Records where moodScore <= 2 from the last 7 days. */
  lowMoodAlerts: adminProcedure.query(async () => {
    const db2 = await requireDb();
    const today = getTodayMelbourne();
    const weekAgo = addDays(today, -7);
    const rows = await db2.select({
      id: checkinRecords.id,
      coachId: checkinRecords.coachId,
      recordDate: checkinRecords.recordDate,
      moodScore: checkinRecords.moodScore,
      morningNotes: checkinRecords.morningNotes,
      coachName: coaches.name
    }).from(checkinRecords).leftJoin(coaches, eq4(checkinRecords.coachId, coaches.id)).where(and2(gte2(checkinRecords.recordDate, weekAgo), lte2(checkinRecords.moodScore, 2))).orderBy(desc(checkinRecords.recordDate));
    return rows;
  }),
  /** Last 10 morning notes with coach name. */
  recentNotes: adminProcedure.query(async () => {
    const db2 = await requireDb();
    const rows = await db2.select({
      id: checkinRecords.id,
      coachId: checkinRecords.coachId,
      recordDate: checkinRecords.recordDate,
      morningNotes: checkinRecords.morningNotes,
      followupNotes: checkinRecords.followupNotes,
      disengagementNotes: checkinRecords.disengagementNotes,
      morningSubmittedAt: checkinRecords.morningSubmittedAt,
      followupSubmittedAt: checkinRecords.followupSubmittedAt,
      disengagementSubmittedAt: checkinRecords.disengagementSubmittedAt,
      coachName: coaches.name
    }).from(checkinRecords).leftJoin(coaches, eq4(checkinRecords.coachId, coaches.id)).orderBy(desc(checkinRecords.recordDate)).limit(20);
    const notes = [];
    for (const r of rows) {
      if (r.morningNotes && r.morningSubmittedAt) {
        notes.push({
          id: r.id,
          coachId: r.coachId,
          coachName: r.coachName,
          recordDate: r.recordDate,
          note: r.morningNotes,
          submissionType: "morning",
          submittedAt: r.morningSubmittedAt
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
          submittedAt: r.followupSubmittedAt
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
          submittedAt: r.disengagementSubmittedAt
        });
      }
    }
    notes.sort((a, b) => {
      const aTime = a.submittedAt?.getTime() ?? 0;
      const bTime = b.submittedAt?.getTime() ?? 0;
      return bTime - aTime;
    });
    return notes.slice(0, 10);
  })
});
var clientCheckinsRouter = t.router({
  /** For a coach + week, get roster from Google Sheets, get completions from DB, compute stats. */
  getRosterWeeklyStats: protectedProcedure.input(
    z.object({
      coachId: z.number().optional(),
      weekStart: z.string().optional(),
      weekStarts: z.array(z.string()).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional()
    })
  ).query(async ({ input }) => {
    const db2 = await requireDb();
    const weekStartList = input.weekStarts && input.weekStarts.length > 0 ? input.weekStarts : input.weekStart ? [input.weekStart] : [];
    if (weekStartList.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "weekStart or weekStarts required" });
    const weekStart = weekStartList[0];
    let coachList;
    if (input.coachId) {
      const [coach] = await db2.select().from(coaches).where(eq4(coaches.id, input.coachId)).limit(1);
      coachList = coach ? [{ id: coach.id, name: coach.name }] : [];
    } else {
      coachList = await db2.select({ id: coaches.id, name: coaches.name }).from(coaches).where(eq4(coaches.isActive, 1));
    }
    const results = [];
    const todayMelb = getTodayMelbourne();
    const currentWeekMon = getMonday2(todayMelb);
    const allSnapshots = await db2.select().from(rosterWeeklySnapshots).where(inArray2(rosterWeeklySnapshots.weekStart, weekStartList));
    const snapshotMap = /* @__PURE__ */ new Map();
    for (const s of allSnapshots) snapshotMap.set(`${s.coachId}|${s.weekStart}`, s);
    const coachData = await Promise.all(coachList.map(async (coach) => {
      const roster = await fetchRosterForCoach(coach.name);
      const paused = await db2.select().from(pausedClients).where(and2(eq4(pausedClients.coachId, coach.id), isNull(pausedClients.resumedAt)));
      const pausedSet = new Set(paused.map((p) => p.clientName));
      let scheduled = 0;
      for (const day of DAYS) {
        scheduled += (roster[day] ?? []).filter((c) => !pausedSet.has(c)).length;
      }
      return { coach, scheduled };
    }));
    for (const ws of weekStartList) {
      const isPastWeek = ws < currentWeekMon;
      for (const { coach, scheduled: liveScheduled } of coachData) {
        const snapshot = snapshotMap.get(`${coach.id}|${ws}`);
        const snapStats = snapshot?.snapshotJson;
        if (isPastWeek && snapStats?.scheduled != null) {
          const liveExcuses = await db2.select().from(excusedClients).where(and2(
            eq4(excusedClients.coachId, coach.id),
            eq4(excusedClients.weekStart, ws),
            eq4(excusedClients.status, "approved")
          ));
          const liveExcusedCount = liveExcuses.length;
          const snapScheduled = snapStats.scheduled;
          const snapCompleted = snapStats.completed ?? 0;
          const effSched = Math.max(snapScheduled - liveExcusedCount, 1);
          const recalcPct = effSched > 0 ? Math.round(snapCompleted / effSched * 1e3) / 10 : 0;
          results.push({
            coachId: coach.id,
            coachName: coach.name,
            weekStart: ws,
            scheduled: snapScheduled,
            completed: snapCompleted,
            excused: liveExcusedCount,
            clientSubmitted: snapStats.clientSubmitted ?? 0,
            pct: Math.round(recalcPct)
          });
        } else {
          const completions = await db2.select().from(clientCheckIns).where(and2(eq4(clientCheckIns.coachId, coach.id), eq4(clientCheckIns.weekStart, ws)));
          const completed = completions.filter((c) => c.completedAt != null).length;
          const clientSubmittedCount = completions.filter((c) => c.clientSubmitted === 1).length;
          const excuses = await db2.select().from(excusedClients).where(and2(
            eq4(excusedClients.coachId, coach.id),
            eq4(excusedClients.weekStart, ws),
            eq4(excusedClients.status, "approved")
          ));
          const excusedCount = excuses.length;
          const effectiveScheduled = Math.max(liveScheduled - excusedCount, 0);
          const pct = effectiveScheduled > 0 ? Math.round(completed / effectiveScheduled * 100) : 0;
          results.push({
            coachId: coach.id,
            coachName: coach.name,
            weekStart: ws,
            scheduled: liveScheduled,
            completed,
            excused: excusedCount,
            clientSubmitted: clientSubmittedCount,
            pct
          });
        }
      }
    }
    return results;
  }),
  /** Daily breakdown for activity report. */
  getRosterDailyStats: adminProcedure.input(
    z.object({
      weekStart: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional()
    })
  ).query(async ({ input }) => {
    if (!input.weekStart && input.startDate) {
      input.weekStart = input.startDate;
    }
    if (!input.weekStart) throw new TRPCError({ code: "BAD_REQUEST", message: "weekStart or startDate required" });
    const db2 = await requireDb();
    const coachList = await db2.select({ id: coaches.id, name: coaches.name }).from(coaches).where(eq4(coaches.isActive, 1));
    const results = [];
    for (const coach of coachList) {
      const roster = await fetchRosterForCoach(coach.name);
      for (const day of DAYS) {
        const clients = roster[day] ?? [];
        const completions = await db2.select().from(clientCheckIns).where(
          and2(
            eq4(clientCheckIns.coachId, coach.id),
            eq4(clientCheckIns.weekStart, input.weekStart),
            eq4(clientCheckIns.dayOfWeek, day)
          )
        );
        const completed = completions.filter((c) => c.completedAt != null).length;
        results.push({
          coachId: coach.id,
          coachName: coach.name,
          day,
          scheduled: clients.length,
          completed
        });
      }
    }
    return results;
  }),
  /** Compare actual check-in times vs stated working hours. Accepts { startDate, endDate } or { date }. */
  getActivityReport: adminProcedure.input(z.object({
    date: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional()
  })).query(async ({ input }) => {
    const db2 = await requireDb();
    const startDate = input.startDate ?? input.date;
    const endDate = input.endDate ?? input.date;
    if (!startDate || !endDate) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "startDate/endDate or date required" });
    }
    const records = await db2.select({
      coachId: checkinRecords.coachId,
      recordDate: checkinRecords.recordDate,
      workingHours: checkinRecords.workingHours,
      actionPlan: checkinRecords.actionPlan,
      morningNotes: checkinRecords.morningNotes,
      moodScore: checkinRecords.moodScore,
      morningSubmittedAt: checkinRecords.morningSubmittedAt,
      followupSubmittedAt: checkinRecords.followupSubmittedAt,
      disengagementSubmittedAt: checkinRecords.disengagementSubmittedAt,
      coachName: coaches.name
    }).from(checkinRecords).leftJoin(coaches, eq4(checkinRecords.coachId, coaches.id)).where(
      and2(
        gte2(checkinRecords.recordDate, startDate),
        lte2(checkinRecords.recordDate, endDate)
      )
    ).orderBy(desc(checkinRecords.recordDate));
    const results = [];
    for (const r of records) {
      const weekStart = getMonday2(r.recordDate);
      const dayKey = getDayKey(r.recordDate);
      const completions = dayKey ? await db2.select().from(clientCheckIns).where(
        and2(
          eq4(clientCheckIns.coachId, r.coachId),
          eq4(clientCheckIns.weekStart, weekStart),
          eq4(clientCheckIns.dayOfWeek, dayKey)
        )
      ) : [];
      const coachCompletions = completions.filter((c) => c.completedAt != null);
      const allTimestamps = coachCompletions.map((c) => c.completedAt).sort((a, b) => a.getTime() - b.getTime());
      const firstCheckIn = allTimestamps.length > 0 ? allTimestamps[0] : null;
      const lastCheckIn = allTimestamps.length > 0 ? allTimestamps[allTimestamps.length - 1] : null;
      const durationMins = firstCheckIn && lastCheckIn ? Math.round((lastCheckIn.getTime() - firstCheckIn.getTime()) / 6e4) : null;
      results.push({
        coachId: r.coachId,
        coachName: r.coachName,
        date: r.recordDate,
        workingHours: r.workingHours,
        actionPlan: r.actionPlan,
        morningNotes: r.morningNotes,
        moodScore: r.moodScore,
        firstCheckIn,
        lastCheckIn,
        allTimestamps,
        checkInCount: coachCompletions.length,
        durationMins
      });
    }
    return results;
  }),
  /** Compute disengaged clients — missed 1+ consecutive weeks. */
  getAllDisengagedClients: protectedProcedure.query(async () => {
    const db2 = await requireDb();
    const today = getTodayMelbourne();
    const currentWeek = getMonday2(today);
    const lastWeek = (() => {
      const d = /* @__PURE__ */ new Date(currentWeek + "T00:00:00");
      d.setDate(d.getDate() - 7);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();
    const epochWeek = getMonday2(CLIENT_CHECKINS_EPOCH);
    const coachList = await db2.select({ id: coaches.id, name: coaches.name }).from(coaches).where(eq4(coaches.isActive, 1));
    const allWeeks = getWeeksBetween(epochWeek, lastWeek);
    const disengaged = [];
    for (const coach of coachList) {
      const roster = await fetchRosterForCoach(coach.name);
      const completions = await db2.select().from(clientCheckIns).where(and2(eq4(clientCheckIns.coachId, coach.id)));
      const approvedExcuses = await db2.select().from(excusedClients).where(and2(eq4(excusedClients.coachId, coach.id), eq4(excusedClients.status, "approved")));
      const paused = await db2.select().from(pausedClients).where(and2(eq4(pausedClients.coachId, coach.id), isNull(pausedClients.resumedAt)));
      const pausedSet = new Set(paused.map((p) => p.clientName));
      const starts = await db2.select().from(rosterClientStarts).where(eq4(rosterClientStarts.coachId, coach.id));
      const completionSet = /* @__PURE__ */ new Set();
      for (const c of completions) {
        if (c.completedAt == null) continue;
        completionSet.add(`${c.clientName}|${c.dayOfWeek}|${c.weekStart}`);
        const baseName = c.clientName.replace(/\s*\(.*\)\s*$/, "").trim();
        if (baseName !== c.clientName) completionSet.add(`${baseName}|${c.dayOfWeek}|${c.weekStart}`);
      }
      const excuseSet = /* @__PURE__ */ new Set();
      for (const e of approvedExcuses) {
        excuseSet.add(`${e.clientName}|${e.weekStart}`);
        const baseName = e.clientName.replace(/\s*\(.*\)\s*$/, "").trim();
        if (baseName !== e.clientName) excuseSet.add(`${baseName}|${e.weekStart}`);
      }
      const startMap = new Map(
        starts.map((s) => [`${s.clientName}|${s.dayOfWeek}`, s.firstWeekStart])
      );
      for (const day of DAYS) {
        const clients = roster[day] ?? [];
        for (const clientName of clients) {
          if (pausedSet.has(clientName)) continue;
          const clientStart = startMap.get(`${clientName}|${day}`) ?? epochWeek;
          let missed = 0;
          let lastCompleted = null;
          for (const week of allWeeks) {
            if (week < clientStart) break;
            if (week > currentWeek) continue;
            const compKey = `${clientName}|${day}|${week}`;
            const excKey = `${clientName}|${week}`;
            const baseName = clientName.replace(/\s*\(.*\)\s*$/, "").trim();
            const baseExcKey = baseName !== clientName ? `${baseName}|${week}` : null;
            if (completionSet.has(compKey) || excuseSet.has(excKey) || baseExcKey && excuseSet.has(baseExcKey)) {
              if (!lastCompleted) lastCompleted = week;
              break;
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
              lastCompletedWeek: lastCompleted
            });
          }
        }
      }
    }
    return disengaged;
  }),
  /** Consecutive missed weeks per client. */
  getAllMissedStreaks: protectedProcedure.query(async () => {
    const db2 = await requireDb();
    const today = getTodayMelbourne();
    const currentWeek = getMonday2(today);
    const lastWeek = (() => {
      const d = /* @__PURE__ */ new Date(currentWeek + "T00:00:00");
      d.setDate(d.getDate() - 7);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();
    const epochWeek = getMonday2(CLIENT_CHECKINS_EPOCH);
    const coachList = await db2.select({ id: coaches.id, name: coaches.name }).from(coaches).where(eq4(coaches.isActive, 1));
    const allWeeks = getWeeksBetween(epochWeek, lastWeek);
    const streaks = [];
    for (const coach of coachList) {
      const roster = await fetchRosterForCoach(coach.name);
      const paused = await db2.select().from(pausedClients).where(and2(eq4(pausedClients.coachId, coach.id), isNull(pausedClients.resumedAt)));
      const pausedSet = new Set(paused.map((p) => p.clientName));
      const completions = await db2.select().from(clientCheckIns).where(eq4(clientCheckIns.coachId, coach.id));
      const approvedExcuses = await db2.select().from(excusedClients).where(and2(eq4(excusedClients.coachId, coach.id), eq4(excusedClients.status, "approved")));
      const completionSet = /* @__PURE__ */ new Set();
      for (const c of completions) {
        if (c.completedAt == null) continue;
        completionSet.add(`${c.clientName}|${c.dayOfWeek}|${c.weekStart}`);
        const baseName = c.clientName.replace(/\s*\(.*\)\s*$/, "").trim();
        if (baseName !== c.clientName) completionSet.add(`${baseName}|${c.dayOfWeek}|${c.weekStart}`);
      }
      const excuseSet = /* @__PURE__ */ new Set();
      for (const e of approvedExcuses) {
        excuseSet.add(`${e.clientName}|${e.weekStart}`);
        const baseName = e.clientName.replace(/\s*\(.*\)\s*$/, "").trim();
        if (baseName !== e.clientName) excuseSet.add(`${baseName}|${e.weekStart}`);
      }
      for (const day of DAYS) {
        const clients = roster[day] ?? [];
        for (const clientName of clients) {
          if (pausedSet.has(clientName)) continue;
          let missed = 0;
          for (const week of allWeeks) {
            const compKey = `${clientName}|${day}|${week}`;
            const excKey = `${clientName}|${week}`;
            const baseName = clientName.replace(/\s*\(.*\)\s*$/, "").trim();
            const baseExcKey = baseName !== clientName ? `${baseName}|${week}` : null;
            if (completionSet.has(compKey) || excuseSet.has(excKey) || baseExcKey && excuseSet.has(baseExcKey)) break;
            missed++;
          }
          if (missed >= 2) {
            streaks.push({
              coachId: coach.id,
              coachName: coach.name,
              clientName,
              dayOfWeek: day,
              consecutiveMissed: missed
            });
          }
        }
      }
    }
    return streaks;
  }),
  /** All morning submissions for today. */
  getAllTodayMorning: adminProcedure.query(async () => {
    const db2 = await requireDb();
    const today = getTodayMelbourne();
    const rows = await db2.select({
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
      coachName: coaches.name
    }).from(checkinRecords).leftJoin(coaches, eq4(checkinRecords.coachId, coaches.id)).where(and2(eq4(checkinRecords.recordDate, today), sql`${checkinRecords.morningSubmittedAt} IS NOT NULL`));
    return rows;
  }),
  /** New clients from roster_client_starts — includes computed weeksOnRoster. */
  getClientTenure: adminProcedure.query(async () => {
    const db2 = await requireDb();
    const today = getTodayMelbourne();
    const currentMonday = getMonday2(today);
    const rows = await db2.select({
      id: rosterClientStarts.id,
      coachId: rosterClientStarts.coachId,
      coachName: rosterClientStarts.coachName,
      clientName: rosterClientStarts.clientName,
      dayOfWeek: rosterClientStarts.dayOfWeek,
      firstWeekStart: rosterClientStarts.firstWeekStart
    }).from(rosterClientStarts).orderBy(desc(rosterClientStarts.firstWeekStart));
    return rows.map((r) => {
      const startDate = /* @__PURE__ */ new Date(r.firstWeekStart + "T12:00:00+10:00");
      const currentDate = /* @__PURE__ */ new Date(currentMonday + "T12:00:00+10:00");
      const weeksOnRoster = Math.max(1, Math.round((currentDate.getTime() - startDate.getTime()) / (7 * 864e5)) + 1);
      return { ...r, weeksOnRoster };
    });
  }),
  /** Working hours analysis. */
  getCoachHoursBreakdown: adminProcedure.input(
    z.object({
      startDate: z.string(),
      endDate: z.string()
    })
  ).query(async ({ input }) => {
    const db2 = await requireDb();
    const rows = await db2.select({
      coachId: checkinRecords.coachId,
      recordDate: checkinRecords.recordDate,
      workingHours: checkinRecords.workingHours,
      coachName: coaches.name
    }).from(checkinRecords).leftJoin(coaches, eq4(checkinRecords.coachId, coaches.id)).where(
      and2(
        gte2(checkinRecords.recordDate, input.startDate),
        lte2(checkinRecords.recordDate, input.endDate),
        sql`${checkinRecords.workingHours} IS NOT NULL`,
        sql`${checkinRecords.workingHours} != ''`
      )
    ).orderBy(asc(checkinRecords.recordDate));
    return rows;
  }),
  /** Per-day stats for a week. */
  getDailyActivityBreakdown: adminProcedure.input(
    z.object({
      weekStart: z.string()
    })
  ).query(async ({ input }) => {
    const db2 = await requireDb();
    const coachList = await db2.select({ id: coaches.id, name: coaches.name }).from(coaches).where(eq4(coaches.isActive, 1));
    const result = [];
    for (let i = 0; i < DAYS.length; i++) {
      const day = DAYS[i];
      const dateStr = addDays(input.weekStart, i);
      const dayCoaches = [];
      for (const coach of coachList) {
        const roster = await fetchRosterForCoach(coach.name);
        const clients = roster[day] ?? [];
        const completions = await db2.select().from(clientCheckIns).where(
          and2(
            eq4(clientCheckIns.coachId, coach.id),
            eq4(clientCheckIns.weekStart, input.weekStart),
            eq4(clientCheckIns.dayOfWeek, day)
          )
        );
        const excuses = await db2.select().from(excusedClients).where(
          and2(
            eq4(excusedClients.coachId, coach.id),
            eq4(excusedClients.weekStart, input.weekStart),
            eq4(excusedClients.dayOfWeek, day),
            eq4(excusedClients.status, "approved")
          )
        );
        dayCoaches.push({
          coachId: coach.id,
          coachName: coach.name,
          scheduled: clients.length,
          completed: completions.filter((c) => c.completedAt != null).length,
          excused: excuses.length
        });
      }
      result.push({ day, date: dateStr, coaches: dayCoaches });
    }
    const coachPivot = /* @__PURE__ */ new Map();
    for (const dayEntry of result) {
      for (const ce of dayEntry.coaches) {
        if (!coachPivot.has(ce.coachId)) {
          coachPivot.set(ce.coachId, {
            coachId: ce.coachId,
            coachName: ce.coachName,
            totalScheduled: 0,
            totalCompleted: 0,
            scheduledByDay: {},
            completedByDay: {},
            scheduledByWeek: {},
            completedByWeek: {},
            engagementByWeek: {}
          });
        }
        const entry = coachPivot.get(ce.coachId);
        entry.totalScheduled += ce.scheduled;
        entry.totalCompleted += ce.completed;
        entry.scheduledByDay[dayEntry.day] = ce.scheduled;
        entry.completedByDay[dayEntry.day] = ce.completed;
      }
    }
    const enrichedDaily = [...coachPivot.values()].map((c) => {
      const overallEngagementPct = c.totalScheduled > 0 ? Math.round(c.totalCompleted / c.totalScheduled * 1e3) / 10 : 0;
      const engagementByDay = {};
      for (const day of DAYS) {
        const s = c.scheduledByDay[day] ?? 0;
        const comp = c.completedByDay[day] ?? 0;
        engagementByDay[day] = s > 0 ? Math.round(comp / s * 100) : 0;
      }
      return {
        ...c,
        overallEngagementPct,
        weeklyAvg: overallEngagementPct,
        engagementByDay
      };
    });
    return {
      coaches: enrichedDaily,
      days: result
    };
  }),
  /** Excuse counts per coach for a week. */
  getExcuseCountsByCoach: adminProcedure.input(
    z.object({
      weekStart: z.string().optional()
    }).optional()
  ).query(async ({ input }) => {
    const db2 = await requireDb();
    const weekStart = input?.weekStart ?? getTodayMelbourne().slice(0, 8) + "01";
    const rows = await db2.select({
      coachId: excusedClients.coachId,
      coachName: excusedClients.coachName,
      status: excusedClients.status
    }).from(excusedClients).where(eq4(excusedClients.weekStart, weekStart));
    const byCoach = /* @__PURE__ */ new Map();
    for (const r of rows) {
      if (!byCoach.has(r.coachId)) {
        byCoach.set(r.coachId, { coachName: r.coachName, pending: 0, approved: 0, rejected: 0 });
      }
      const entry = byCoach.get(r.coachId);
      if (r.status === "pending") entry.pending++;
      else if (r.status === "approved") entry.approved++;
      else if (r.status === "rejected") entry.rejected++;
    }
    return Array.from(byCoach.entries()).map(([coachId, data]) => ({
      coachId,
      ...data
    }));
  }),
  /** All pending excuse requests. */
  getPendingExcuses: adminProcedure.query(async () => {
    const db2 = await requireDb();
    const rows = await db2.select().from(excusedClients).where(eq4(excusedClients.status, "pending")).orderBy(desc(excusedClients.submittedAt));
    return rows;
  }),
  /** Coach performance metrics over time. */
  getPerformanceReport: adminProcedure.input(
    z.object({
      days: z.number().optional(),
      coachId: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional()
    })
  ).query(async ({ input }) => {
    const db2 = await requireDb();
    const today = getTodayMelbourne();
    const numDays = input.days ?? (input.startDate && input.endDate ? Math.ceil((new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) / 864e5) : 28);
    const startDate = addDays(today, -numDays);
    const startWeek = getMonday2(startDate);
    const endWeek = getMonday2(today);
    const weeks = getWeeksBetween(startWeek, endWeek).reverse();
    let coachList;
    if (input.coachId) {
      const [coach] = await db2.select().from(coaches).where(eq4(coaches.id, input.coachId)).limit(1);
      coachList = coach ? [{ id: coach.id, name: coach.name }] : [];
    } else {
      coachList = await db2.select({ id: coaches.id, name: coaches.name }).from(coaches).where(eq4(coaches.isActive, 1));
    }
    const weeklyData = [];
    for (const week of weeks) {
      const coachEntries = [];
      for (const coach of coachList) {
        const roster = await fetchRosterForCoach(coach.name);
        let scheduled = 0;
        for (const day of DAYS) scheduled += (roster[day] ?? []).length;
        const completions = await db2.select().from(clientCheckIns).where(and2(eq4(clientCheckIns.coachId, coach.id), eq4(clientCheckIns.weekStart, week)));
        const completed = completions.filter((c) => c.completedAt != null).length;
        const pct = scheduled > 0 ? Math.round(completed / scheduled * 100) : 0;
        coachEntries.push({ coachId: coach.id, coachName: coach.name, scheduled, completed, pct });
      }
      weeklyData.push({ weekStart: week, coaches: coachEntries });
    }
    const coachMap = /* @__PURE__ */ new Map();
    for (const wd of weeklyData) {
      for (const ce of wd.coaches) {
        if (!coachMap.has(ce.coachId)) {
          coachMap.set(ce.coachId, {
            coachId: ce.coachId,
            coachName: ce.coachName,
            totalScheduled: 0,
            totalCompleted: 0,
            scheduledByWeek: {},
            completedByWeek: {},
            engagementByWeek: {},
            scheduledByDay: {},
            completedByDay: {}
          });
        }
        const entry = coachMap.get(ce.coachId);
        entry.totalScheduled += ce.scheduled;
        entry.totalCompleted += ce.completed;
        entry.scheduledByWeek[wd.weekStart] = ce.scheduled;
        entry.completedByWeek[wd.weekStart] = ce.completed;
        entry.engagementByWeek[wd.weekStart] = ce.pct;
      }
    }
    const enrichedCoaches = [...coachMap.values()].map((c) => {
      const overallEngagementPct = c.totalScheduled > 0 ? Math.round(c.totalCompleted / c.totalScheduled * 1e3) / 10 : 0;
      const weekCount = Object.keys(c.engagementByWeek).length;
      const weeklyAvg = weekCount > 0 ? Math.round(Object.values(c.engagementByWeek).reduce((s, v) => s + v, 0) / weekCount * 10) / 10 : 0;
      return {
        ...c,
        overallEngagementPct,
        weeklyAvg,
        engagementByDay: {}
      };
    });
    return {
      coaches: enrichedCoaches,
      weeks,
      weeklyData
    };
  }),
  /** Clients not yet completed today. */
  getTodayPendingClients: protectedProcedure.input(
    z.object({
      coachId: z.number(),
      date: z.string()
    })
  ).query(async ({ input }) => {
    const db2 = await requireDb();
    const weekStart = getMonday2(input.date);
    const dayKey = getDayKey(input.date);
    if (!dayKey) return [];
    const [coach] = await db2.select().from(coaches).where(eq4(coaches.id, input.coachId)).limit(1);
    if (!coach) return [];
    const roster = await fetchRosterForCoach(coach.name);
    const todayClients = roster[dayKey] ?? [];
    const completions = await db2.select().from(clientCheckIns).where(
      and2(
        eq4(clientCheckIns.coachId, input.coachId),
        eq4(clientCheckIns.weekStart, weekStart),
        eq4(clientCheckIns.dayOfWeek, dayKey)
      )
    );
    const completedSet = new Set(
      completions.filter((c) => c.completedAt != null).map((c) => c.clientName)
    );
    const excuses = await db2.select().from(excusedClients).where(
      and2(
        eq4(excusedClients.coachId, input.coachId),
        eq4(excusedClients.weekStart, weekStart),
        eq4(excusedClients.dayOfWeek, dayKey),
        eq4(excusedClients.status, "approved")
      )
    );
    const excusedSet = new Set(excuses.map((e) => e.clientName));
    return todayClients.filter((name) => !completedSet.has(name) && !excusedSet.has(name));
  }),
  /** Mark a client check-in as completed. */
  markComplete: protectedProcedure.input(
    z.object({
      coachId: z.number(),
      coachName: z.string(),
      clientName: z.string(),
      dayOfWeek: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday"]),
      weekStart: z.string()
    })
  ).mutation(async ({ input, ctx }) => {
    const db2 = await requireDb();
    const existing = await db2.select().from(clientCheckIns).where(
      and2(
        eq4(clientCheckIns.coachId, input.coachId),
        eq4(clientCheckIns.clientName, input.clientName),
        eq4(clientCheckIns.dayOfWeek, input.dayOfWeek),
        eq4(clientCheckIns.weekStart, input.weekStart)
      )
    ).limit(1);
    if (existing.length > 0) {
      await db2.update(clientCheckIns).set({
        completedAt: /* @__PURE__ */ new Date(),
        completedByUserId: ctx.user.id
      }).where(eq4(clientCheckIns.id, existing[0].id));
      return { id: existing[0].id };
    }
    const [result] = await db2.insert(clientCheckIns).values({
      coachId: input.coachId,
      coachName: input.coachName,
      clientName: input.clientName,
      dayOfWeek: input.dayOfWeek,
      weekStart: input.weekStart,
      completedAt: /* @__PURE__ */ new Date(),
      completedByUserId: ctx.user.id
    });
    return { id: result.insertId };
  }),
  /** Undo a completion. */
  undoComplete: protectedProcedure.input(
    z.object({
      coachId: z.number(),
      clientName: z.string(),
      dayOfWeek: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday"]),
      weekStart: z.string()
    })
  ).mutation(async ({ input }) => {
    const db2 = await requireDb();
    await db2.update(clientCheckIns).set({
      completedAt: null,
      completedByUserId: 0
    }).where(
      and2(
        eq4(clientCheckIns.coachId, input.coachId),
        eq4(clientCheckIns.clientName, input.clientName),
        eq4(clientCheckIns.dayOfWeek, input.dayOfWeek),
        eq4(clientCheckIns.weekStart, input.weekStart)
      )
    );
    return { success: true };
  }),
  /** Toggle the clientSubmitted flag. */
  toggleClientSubmitted: protectedProcedure.input(
    z.object({
      coachId: z.number().optional(),
      clientName: z.string(),
      dayOfWeek: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday"]),
      weekStart: z.string()
    })
  ).mutation(async ({ input, ctx }) => {
    const db2 = await requireDb();
    let coachId = input.coachId;
    if (!coachId) {
      const [myCoach] = await db2.select().from(coaches).where(eq4(coaches.userId, ctx.user.id)).limit(1);
      if (!myCoach) throw new TRPCError({ code: "BAD_REQUEST", message: "No coach profile linked" });
      coachId = myCoach.id;
    }
    const [coach] = await db2.select().from(coaches).where(eq4(coaches.id, coachId)).limit(1);
    if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach not found" });
    const existing = await db2.select().from(clientCheckIns).where(
      and2(
        eq4(clientCheckIns.coachId, coachId),
        eq4(clientCheckIns.clientName, input.clientName),
        eq4(clientCheckIns.dayOfWeek, input.dayOfWeek),
        eq4(clientCheckIns.weekStart, input.weekStart)
      )
    ).limit(1);
    if (existing.length > 0) {
      const newVal = existing[0].clientSubmitted === 1 ? 0 : 1;
      await db2.update(clientCheckIns).set({
        clientSubmitted: newVal,
        clientSubmittedAt: newVal === 1 ? /* @__PURE__ */ new Date() : null
      }).where(eq4(clientCheckIns.id, existing[0].id));
      return { id: existing[0].id, clientSubmitted: newVal === 1 };
    }
    const [result] = await db2.insert(clientCheckIns).values({
      coachId,
      coachName: coach.name,
      clientName: input.clientName,
      dayOfWeek: input.dayOfWeek,
      weekStart: input.weekStart,
      clientSubmitted: 1,
      clientSubmittedAt: /* @__PURE__ */ new Date()
    });
    return { id: result.insertId, clientSubmitted: true };
  }),
  /** Submit a valid excuse request. */
  submitExcuse: protectedProcedure.input(
    z.object({
      coachId: z.number(),
      coachName: z.string(),
      clientName: z.string(),
      dayOfWeek: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday"]),
      weekStart: z.string(),
      reason: z.string().min(1)
    })
  ).mutation(async ({ input, ctx }) => {
    const db2 = await requireDb();
    const existing = await db2.select().from(excusedClients).where(
      and2(
        eq4(excusedClients.coachId, input.coachId),
        eq4(excusedClients.clientName, input.clientName),
        eq4(excusedClients.dayOfWeek, input.dayOfWeek),
        eq4(excusedClients.weekStart, input.weekStart)
      )
    ).limit(1);
    if (existing.length > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "An excuse has already been submitted for this client/day/week"
      });
    }
    const [result] = await db2.insert(excusedClients).values({
      coachId: input.coachId,
      coachName: input.coachName,
      clientName: input.clientName,
      dayOfWeek: input.dayOfWeek,
      weekStart: input.weekStart,
      reason: input.reason,
      status: "pending",
      submittedByUserId: ctx.user.id
    });
    const managerSlackId = ENV.managerSlackId;
    if (managerSlackId && ENV.slackBotToken) {
      const appUrl = ENV.appUrl || "https://coach.databite.com.au";
      const message = `\u26A0\uFE0F *Valid Excuse Request*
*Coach:* ${input.coachName}
*Client:* ${input.clientName}
*Day:* ${input.dayOfWeek}
*Reason:* ${input.reason}

\u{1F449} <${appUrl}/client-checkins|Approve or reject>`;
      sendSlackDM(managerSlackId, message).catch((err) => console.error("[Slack Notify] DM error:", err));
    }
    if (ENV.telegramBotToken && ENV.telegramManagerChatId) {
      const tgMessage = `\u26A0\uFE0F Valid Excuse Request

Coach: ${input.coachName}
Client: ${input.clientName}
Day: ${input.dayOfWeek}
Reason: ${input.reason}

Open the app to approve or reject.`;
      fetch(`https://api.telegram.org/bot${ENV.telegramBotToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: ENV.telegramManagerChatId, text: tgMessage })
      }).catch((err) => console.error("[Telegram Notify] error:", err));
    }
    return { id: result.insertId };
  }),
  /** Approve or reject an excuse. */
  reviewExcuse: adminProcedure.input(
    z.object({
      id: z.number(),
      status: z.enum(["approved", "rejected"])
    })
  ).mutation(async ({ input, ctx }) => {
    const db2 = await requireDb();
    await db2.update(excusedClients).set({
      status: input.status,
      reviewedByUserId: ctx.user.id,
      reviewedAt: /* @__PURE__ */ new Date()
    }).where(eq4(excusedClients.id, input.id));
    return { success: true };
  }),
  /** Trigger Typeform backfill for current week. */
  syncTypeform: protectedProcedure.mutation(async () => {
    const results = await runTypeformBackfill();
    return results;
  }),
  /** Get ALL client check-in rows for a given week (across all coaches). */
  getWeekStatusAll: protectedProcedure.input(z.object({ weekStart: z.string() })).query(async ({ input }) => {
    const db2 = await requireDb();
    const rows = await db2.select().from(clientCheckIns).where(eq4(clientCheckIns.weekStart, input.weekStart));
    return rows.map((r) => ({
      id: r.id,
      coachId: r.coachId,
      coachName: r.coachName,
      clientName: r.clientName,
      dayOfWeek: r.dayOfWeek,
      weekStart: r.weekStart,
      completedAt: r.completedAt,
      completedByUserId: r.completedByUserId,
      clientSubmitted: r.clientSubmitted,
      clientSubmittedAt: r.clientSubmittedAt
    }));
  }),
  /** Get the Google Sheets roster for a specific coach. */
  getRosterByCoach: protectedProcedure.input(z.object({ coachId: z.number(), weekStart: z.string().optional() })).query(async ({ input }) => {
    const db2 = await requireDb();
    const [coach] = await db2.select().from(coaches).where(eq4(coaches.id, input.coachId)).limit(1);
    if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach not found" });
    const roster = await fetchRosterForCoach(coach.name);
    return roster;
  }),
  /** Get active pauses for a coach. */
  getActivePauses: protectedProcedure.input(z.object({ coachId: z.number() })).query(async ({ input }) => {
    const db2 = await requireDb();
    const rows = await db2.select().from(pausedClients).where(and2(eq4(pausedClients.coachId, input.coachId), isNull(pausedClients.resumedAt)));
    return rows.map((r) => r.clientName);
  }),
  /** Pause a client — excludes from disengagement tracking. */
  pauseClient: protectedProcedure.input(z.object({ coachId: z.number(), clientName: z.string() })).mutation(async ({ input, ctx }) => {
    const db2 = await requireDb();
    const [existing] = await db2.select().from(pausedClients).where(and2(eq4(pausedClients.coachId, input.coachId), eq4(pausedClients.clientName, input.clientName), isNull(pausedClients.resumedAt))).limit(1);
    if (existing) {
      throw new TRPCError({ code: "CONFLICT", message: "Client is already paused" });
    }
    await db2.insert(pausedClients).values({
      coachId: input.coachId,
      clientName: input.clientName,
      pausedByUserId: ctx.user.id
    });
    return { ok: true };
  }),
  /** Resume a paused client. */
  resumeClient: protectedProcedure.input(z.object({ coachId: z.number(), clientName: z.string() })).mutation(async ({ input }) => {
    const db2 = await requireDb();
    await db2.update(pausedClients).set({ resumedAt: sql`NOW()` }).where(and2(eq4(pausedClients.coachId, input.coachId), eq4(pausedClients.clientName, input.clientName), isNull(pausedClients.resumedAt)));
    return { ok: true };
  }),
  /** Get excuses for a given week, optionally filtered by coach. */
  getExcusesForWeek: protectedProcedure.input(z.object({ weekStart: z.string(), coachId: z.number().optional() })).query(async ({ input }) => {
    const db2 = await requireDb();
    const conditions = [eq4(excusedClients.weekStart, input.weekStart)];
    if (input.coachId != null) {
      conditions.push(eq4(excusedClients.coachId, input.coachId));
    }
    const rows = await db2.select().from(excusedClients).where(and2(...conditions));
    return rows;
  }),
  /** Get clients with upcoming UPFRONT end dates (parsed from client names). */
  /** Import weekly stats snapshots (admin only — for importing Manus historical data). */
  importWeeklySnapshots: adminProcedure.input(z.array(z.object({
    coachId: z.number(),
    coachName: z.string(),
    weekStart: z.string(),
    scheduled: z.number(),
    completed: z.number(),
    engagementPct: z.number()
  }))).mutation(async ({ input }) => {
    const db2 = await requireDb();
    let imported = 0;
    for (const r of input) {
      const snap = { scheduled: r.scheduled, completed: r.completed, missed: r.scheduled - r.completed, engagementPct: r.engagementPct, source: "manus" };
      const existing = await db2.select().from(rosterWeeklySnapshots).where(and2(eq4(rosterWeeklySnapshots.coachId, r.coachId), eq4(rosterWeeklySnapshots.weekStart, r.weekStart))).limit(1);
      if (existing.length > 0) {
        await db2.update(rosterWeeklySnapshots).set({ snapshotJson: snap }).where(eq4(rosterWeeklySnapshots.id, existing[0].id));
      } else {
        await db2.insert(rosterWeeklySnapshots).values({ coachId: r.coachId, coachName: r.coachName, weekStart: r.weekStart, snapshotJson: snap });
      }
      imported++;
    }
    return { imported };
  }),
  getUpfrontAlertsAll: protectedProcedure.query(async () => {
    const db2 = await requireDb();
    const coachList = await db2.select({ id: coaches.id, name: coaches.name }).from(coaches).where(eq4(coaches.isActive, 1));
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const now = /* @__PURE__ */ new Date();
    const alerts = [];
    for (const coach of coachList) {
      const roster = await fetchRawRosterForCoach(coach.name);
      for (const day of DAYS) {
        const clients = roster[day] ?? [];
        for (const clientName of clients) {
          const matchUpfront = clientName.match(/UPFRONT\s*[-–—]\s*(\d{1,2}[\s/.-]+\w+[\s/.-]*\d{0,4})/i);
          const matchDec = clientName.match(/DEC\s*OFFER\s*[-–—]?\s*(\d{1,2}[\s/.-]+\w+[\s/.-]*\d{0,4})/i);
          const match = matchUpfront || matchDec;
          const offerType = matchUpfront ? "UPFRONT" : matchDec ? "DEC OFFER" : null;
          if (!match || !offerType) continue;
          const raw = match[1].trim();
          let parsed = null;
          const namedMonth = raw.match(/^(\d{1,2})\s+(\w{3,})\s*(\d{2,4})?$/i);
          if (namedMonth) {
            const d = parseInt(namedMonth[1]);
            const m = months[namedMonth[2].toLowerCase().slice(0, 3)];
            const y = namedMonth[3] ? namedMonth[3].length === 2 ? 2e3 + parseInt(namedMonth[3]) : parseInt(namedMonth[3]) : now.getFullYear();
            if (m !== void 0) parsed = new Date(y, m, d);
          }
          if (!parsed) {
            const slashed = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-]?(\d{2,4})?$/);
            if (slashed) {
              const d = parseInt(slashed[1]);
              const m = parseInt(slashed[2]) - 1;
              const y = slashed[3] ? slashed[3].length === 2 ? 2e3 + parseInt(slashed[3]) : parseInt(slashed[3]) : now.getFullYear();
              parsed = new Date(y, m, d);
            }
          }
          if (parsed && !isNaN(parsed.getTime())) {
            if (parsed < now && !raw.match(/\d{4}/)) parsed.setFullYear(parsed.getFullYear() + 1);
            const daysLeft = Math.ceil((parsed.getTime() - now.getTime()) / 864e5);
            const endDate = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
            if (daysLeft <= 14 && daysLeft >= -7) {
              alerts.push({ coachId: coach.id, coachName: coach.name, clientName, dayOfWeek: day, offerType, endDate, daysLeft });
            }
          }
        }
      }
    }
    return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
  }),
  /** Public: client self-check-in. Finds the client by name (case-insensitive) and marks submitted. */
  clientSelfCheckin: publicProcedure.input(
    z.object({
      clientName: z.string().min(1)
    })
  ).mutation(async ({ input }) => {
    const db2 = await requireDb();
    const melbNow = new Date((/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "Australia/Melbourne" }));
    const dayIdx = melbNow.getDay();
    const diff = melbNow.getDate() - dayIdx + (dayIdx === 0 ? -6 : 1);
    const monday = new Date(melbNow);
    monday.setDate(diff);
    const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const todayName = dayNames[melbNow.getDay()];
    if (!["monday", "tuesday", "wednesday", "thursday", "friday"].includes(todayName)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Check-ins are only available Monday to Friday." });
    }
    const dayOfWeek = todayName;
    const allCoaches = await db2.select().from(coaches).where(eq4(coaches.isActive, 1));
    let foundCoach = null;
    let foundClientName = null;
    const searchName = input.clientName.toLowerCase().trim();
    for (const coach of allCoaches) {
      const roster = await fetchRosterForCoach(coach.name);
      const dayClients = roster[dayOfWeek] ?? [];
      const match = dayClients.find((c) => c.toLowerCase().includes(searchName));
      if (match) {
        foundCoach = { id: coach.id, name: coach.name };
        foundClientName = match;
        break;
      }
    }
    if (!foundCoach || !foundClientName) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Could not find your name on today's roster. Please check with your coach." });
    }
    const existing = await db2.select().from(clientCheckIns).where(
      and2(
        eq4(clientCheckIns.coachId, foundCoach.id),
        eq4(clientCheckIns.clientName, foundClientName),
        eq4(clientCheckIns.dayOfWeek, dayOfWeek),
        eq4(clientCheckIns.weekStart, weekStart)
      )
    ).limit(1);
    if (existing.length > 0) {
      if (existing[0].clientSubmitted === 1) {
        return { alreadySubmitted: true, clientName: foundClientName, coachName: foundCoach.name, dayOfWeek };
      }
      await db2.update(clientCheckIns).set({ clientSubmitted: 1, clientSubmittedAt: /* @__PURE__ */ new Date() }).where(eq4(clientCheckIns.id, existing[0].id));
      return { alreadySubmitted: false, clientName: foundClientName, coachName: foundCoach.name, dayOfWeek };
    }
    await db2.insert(clientCheckIns).values({
      coachId: foundCoach.id,
      coachName: foundCoach.name,
      clientName: foundClientName,
      dayOfWeek,
      weekStart,
      clientSubmitted: 1,
      clientSubmittedAt: /* @__PURE__ */ new Date()
    });
    return { alreadySubmitted: false, clientName: foundClientName, coachName: foundCoach.name, dayOfWeek };
  })
});
var coachesRouter = t.router({
  /** All active coaches. */
  list: protectedProcedure.query(async () => {
    const db2 = await requireDb();
    return db2.select().from(coaches).where(eq4(coaches.isActive, 1)).orderBy(asc(coaches.name));
  }),
  /** Coach profile linked to current user. */
  myCoach: protectedProcedure.query(async ({ ctx }) => {
    const db2 = await requireDb();
    const [coach] = await db2.select().from(coaches).where(eq4(coaches.userId, ctx.user.id)).limit(1);
    return coach ?? null;
  }),
  /** Coaches with no userId linked. */
  unclaimed: protectedProcedure.query(async () => {
    const db2 = await requireDb();
    return db2.select().from(coaches).where(and2(eq4(coaches.isActive, 1), isNull(coaches.userId)));
  }),
  /** Submission streaks per coach. */
  streaks: protectedProcedure.query(async () => {
    const db2 = await requireDb();
    const today = getTodayMelbourne();
    const coachList = await db2.select({ id: coaches.id, name: coaches.name }).from(coaches).where(eq4(coaches.isActive, 1));
    const results = [];
    for (const coach of coachList) {
      const records = await db2.select({ recordDate: checkinRecords.recordDate, morningSubmittedAt: checkinRecords.morningSubmittedAt }).from(checkinRecords).where(eq4(checkinRecords.coachId, coach.id)).orderBy(desc(checkinRecords.recordDate));
      const submittedDates = new Set(
        records.filter((r) => r.morningSubmittedAt).map((r) => r.recordDate)
      );
      let current = 0;
      let checkDate = today;
      if (!submittedDates.has(checkDate)) {
        checkDate = addDays(checkDate, -1);
      }
      while (true) {
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
        if (current > 365) break;
      }
      const sortedDates = Array.from(submittedDates).sort();
      let longest = 0;
      let streak = 0;
      let prevDate = "";
      for (const d of sortedDates) {
        if (!prevDate) {
          streak = 1;
        } else {
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
        longestStreak: longest
      });
    }
    return results;
  }),
  /** Create new coach. */
  create: adminProcedure.input(
    z.object({
      name: z.string().min(1),
      email: z.string().optional()
    })
  ).mutation(async ({ input }) => {
    const db2 = await requireDb();
    const [result] = await db2.insert(coaches).values({
      name: input.name,
      email: input.email
    });
    return { id: result.insertId };
  }),
  /** Update coach. */
  update: adminProcedure.input(
    z.object({
      id: z.number(),
      name: z.string().optional(),
      email: z.string().optional(),
      isActive: z.number().optional()
    })
  ).mutation(async ({ input }) => {
    const db2 = await requireDb();
    const { id, ...updates } = input;
    const setObj = {};
    if (updates.name !== void 0) setObj.name = updates.name;
    if (updates.email !== void 0) setObj.email = updates.email;
    if (updates.isActive !== void 0) setObj.isActive = updates.isActive;
    if (Object.keys(setObj).length > 0) {
      await db2.update(coaches).set(setObj).where(eq4(coaches.id, id));
    }
    return { success: true };
  }),
  /** Link current user to a coach profile. */
  claimProfile: protectedProcedure.input(
    z.object({
      coachId: z.number()
    })
  ).mutation(async ({ input, ctx }) => {
    const db2 = await requireDb();
    const [existing] = await db2.select().from(coaches).where(eq4(coaches.id, input.coachId)).limit(1);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Coach not found" });
    if (existing.userId) {
      throw new TRPCError({ code: "CONFLICT", message: "This coach profile is already claimed" });
    }
    await db2.update(coaches).set({ userId: ctx.user.id, email: ctx.user.email }).where(eq4(coaches.id, input.coachId));
    return { success: true };
  }),
  /** Link a user to a coach (admin). */
  linkUser: adminProcedure.input(
    z.object({
      coachId: z.number(),
      userId: z.number()
    })
  ).mutation(async ({ input }) => {
    const db2 = await requireDb();
    await db2.update(coaches).set({ userId: input.userId }).where(eq4(coaches.id, input.coachId));
    return { success: true };
  }),
  /** Update coach's Slack/reminder settings. */
  updateSlackConfig: adminProcedure.input(
    z.object({
      id: z.number(),
      slackUserId: z.string().optional(),
      timezone: z.string().optional(),
      reminderTimes: z.array(z.string()).optional(),
      workdays: z.array(z.string()).optional(),
      remindersEnabled: z.number().optional(),
      leaveStartDate: z.string().nullable().optional(),
      leaveEndDate: z.string().nullable().optional()
    })
  ).mutation(async ({ input }) => {
    const db2 = await requireDb();
    const { id, ...updates } = input;
    const setObj = {};
    if (updates.slackUserId !== void 0) setObj.slackUserId = updates.slackUserId;
    if (updates.timezone !== void 0) setObj.timezone = updates.timezone;
    if (updates.reminderTimes !== void 0) setObj.reminderTimes = updates.reminderTimes;
    if (updates.workdays !== void 0) setObj.workdays = updates.workdays;
    if (updates.remindersEnabled !== void 0) setObj.remindersEnabled = updates.remindersEnabled;
    if (updates.leaveStartDate !== void 0) setObj.leaveStartDate = updates.leaveStartDate;
    if (updates.leaveEndDate !== void 0) setObj.leaveEndDate = updates.leaveEndDate;
    if (Object.keys(setObj).length > 0) {
      await db2.update(coaches).set(setObj).where(eq4(coaches.id, id));
    }
    return { success: true };
  })
});
var performanceRouter = t.router({
  /** Business-wide and per-coach green/yellow/red counts vs 70% target. */
  kpiSummary: protectedProcedure.query(async () => {
    const db2 = await requireDb();
    const coachList = await db2.select({ id: coaches.id, name: coaches.name }).from(coaches).where(eq4(coaches.isActive, 1));
    const allRatings = await db2.select().from(clientRatings);
    const TARGET = 70;
    const coachStats = coachList.map((coach) => {
      const coachRatings = allRatings.filter((r) => r.coachId === coach.id);
      const green = coachRatings.filter((r) => r.rating === "green").length;
      const yellow = coachRatings.filter((r) => r.rating === "yellow").length;
      const red = coachRatings.filter((r) => r.rating === "red").length;
      const total = green + yellow + red;
      const greenPct = total > 0 ? Math.round(green / total * 100) : 0;
      return {
        coachId: coach.id,
        coachName: coach.name,
        green,
        yellow,
        red,
        total,
        greenPct,
        meetsTarget: greenPct >= TARGET
      };
    });
    const totalGreen = coachStats.reduce((s, c) => s + c.green, 0);
    const totalYellow = coachStats.reduce((s, c) => s + c.yellow, 0);
    const totalRed = coachStats.reduce((s, c) => s + c.red, 0);
    const totalAll = totalGreen + totalYellow + totalRed;
    const overallGreenPct = totalAll > 0 ? Math.round(totalGreen / totalAll * 100) : 0;
    return {
      target: TARGET,
      overall: {
        green: totalGreen,
        yellow: totalYellow,
        red: totalRed,
        total: totalAll,
        greenPct: overallGreenPct,
        meetsTarget: overallGreenPct >= TARGET
      },
      coaches: coachStats
    };
  }),
  /** Get roster for a coach (from Google Sheets). Accepts coachName or coachId. */
  rosterForCoach: protectedProcedure.input(
    z.object({
      coachName: z.string().optional(),
      coachId: z.number().optional()
    })
  ).query(async ({ input }) => {
    let coachName = input.coachName;
    if (!coachName && input.coachId) {
      const db2 = await requireDb();
      const [coach] = await db2.select().from(coaches).where(eq4(coaches.id, input.coachId)).limit(1);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach not found" });
      coachName = coach.name;
    }
    if (!coachName) throw new TRPCError({ code: "BAD_REQUEST", message: "coachName or coachId required" });
    const roster = await fetchRosterForCoach(coachName);
    const rawRoster = await fetchRawRosterForCoach(coachName);
    const rawNameMap = {};
    for (const day of DAYS) {
      const clean = roster[day] ?? [];
      const raw = rawRoster[day] ?? [];
      for (let i = 0; i < clean.length && i < raw.length; i++) {
        if (clean[i] !== raw[i]) rawNameMap[clean[i]] = raw[i];
      }
    }
    const allClients = /* @__PURE__ */ new Set();
    for (const day of DAYS) {
      for (const c of roster[day] ?? []) allClients.add(c);
    }
    return { ...roster, clients: [...allClients].sort(), rawNameMap };
  }),
  /** All client ratings. */
  allRatings: adminProcedure.query(async () => {
    const db2 = await requireDb();
    return db2.select().from(clientRatings).orderBy(asc(clientRatings.coachId), asc(clientRatings.clientName));
  }),
  /** Ratings for current user's coach. */
  myRatings: protectedProcedure.query(async ({ ctx }) => {
    const db2 = await requireDb();
    const [myCoach] = await db2.select().from(coaches).where(eq4(coaches.userId, ctx.user.id)).limit(1);
    if (!myCoach) return [];
    return db2.select().from(clientRatings).where(eq4(clientRatings.coachId, myCoach.id)).orderBy(asc(clientRatings.clientName));
  }),
  /** Aggregated weekly summary. */
  getWeeklySummary: adminProcedure.input(
    z.object({
      weekStart: z.string()
    })
  ).query(async ({ input }) => {
    const db2 = await requireDb();
    const coachList = await db2.select({ id: coaches.id, name: coaches.name, workdays: coaches.workdays }).from(coaches).where(eq4(coaches.isActive, 1));
    const coachSummaries = [];
    const todayMelb = getTodayMelbourne();
    const currentWeekMon = getMonday2(todayMelb);
    const isPastWeek = input.weekStart < currentWeekMon;
    const snapshots = isPastWeek ? await db2.select().from(rosterWeeklySnapshots).where(eq4(rosterWeeklySnapshots.weekStart, input.weekStart)) : [];
    const snapMap = new Map(snapshots.map((s) => [s.coachId, s.snapshotJson]));
    for (const coach of coachList) {
      const snap = snapMap.get(coach.id);
      let scheduled;
      let completed;
      let excusedCount;
      let effectiveScheduled;
      if (isPastWeek && snap?.scheduled != null) {
        scheduled = snap.scheduled;
        completed = snap.completed ?? 0;
        const liveExcuses = await db2.select().from(excusedClients).where(and2(
          eq4(excusedClients.coachId, coach.id),
          eq4(excusedClients.weekStart, input.weekStart),
          eq4(excusedClients.status, "approved")
        ));
        excusedCount = liveExcuses.length;
        effectiveScheduled = Math.max(scheduled - excusedCount, 0);
      } else {
        const roster = await fetchRosterForCoach(coach.name);
        scheduled = 0;
        for (const day of DAYS) scheduled += (roster[day] ?? []).length;
        const completions = await db2.select().from(clientCheckIns).where(and2(eq4(clientCheckIns.coachId, coach.id), eq4(clientCheckIns.weekStart, input.weekStart)));
        completed = completions.filter((c) => c.completedAt != null).length;
        const excuses = await db2.select().from(excusedClients).where(
          and2(
            eq4(excusedClients.coachId, coach.id),
            eq4(excusedClients.weekStart, input.weekStart),
            eq4(excusedClients.status, "approved")
          )
        );
        excusedCount = excuses.length;
        effectiveScheduled = Math.max(scheduled - excusedCount, 0);
      }
      const pct = effectiveScheduled > 0 ? Math.round(completed / effectiveScheduled * 100) : 0;
      const weekEnd2 = addDays(input.weekStart, 4);
      const records = await db2.select().from(checkinRecords).where(
        and2(
          eq4(checkinRecords.coachId, coach.id),
          gte2(checkinRecords.recordDate, input.weekStart),
          lte2(checkinRecords.recordDate, weekEnd2)
        )
      );
      const moods = records.filter((r) => r.moodScore != null).map((r) => r.moodScore);
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
        disengagementSubmitted: records.some((r) => r.disengagementSubmittedAt)
      });
    }
    const totalScheduled = coachSummaries.reduce((s, c) => s + c.scheduled, 0);
    const totalCompleted = coachSummaries.reduce((s, c) => s + c.completed, 0);
    const totalExcused = coachSummaries.reduce((s, c) => s + c.excused, 0);
    const effectiveTotal = Math.max(totalScheduled - totalExcused, 0);
    const overallPct = effectiveTotal > 0 ? Math.round(totalCompleted / effectiveTotal * 100) : 0;
    const weekEnd = addDays(input.weekStart, 4);
    const allRecords = await db2.select().from(checkinRecords).where(
      and2(
        gte2(checkinRecords.recordDate, input.weekStart),
        lte2(checkinRecords.recordDate, weekEnd)
      )
    );
    const today = getTodayMelbourne();
    let elapsedWeekdays = 5;
    if (weekEnd > today) {
      const todayDate = /* @__PURE__ */ new Date(today + "T12:00:00+10:00");
      const weekStartDate = /* @__PURE__ */ new Date(input.weekStart + "T12:00:00+10:00");
      const diff = Math.floor((todayDate.getTime() - weekStartDate.getTime()) / 864e5) + 1;
      elapsedWeekdays = Math.max(1, Math.min(5, diff));
    }
    const coachActivity = coachList.map((coach) => {
      const coachRecords = allRecords.filter((r) => r.coachId === coach.id);
      const morningDays = coachRecords.filter((r) => r.morningSubmittedAt).length;
      const followupDays = coachRecords.filter((r) => r.followupSubmittedAt).length;
      const totalFollowupMsgs = coachRecords.reduce((s, r) => s + (r.followupCount ?? 0), 0);
      const totalDisengagementMsgs = coachRecords.reduce((s, r) => s + (r.disengagementCount ?? 0), 0);
      let coachWorkdays = [1, 2, 3, 4, 5];
      if (coach.workdays) {
        try {
          const parsed = typeof coach.workdays === "string" ? JSON.parse(coach.workdays) : coach.workdays;
          if (Array.isArray(parsed) && parsed.length > 0) coachWorkdays = parsed.filter((d) => d >= 1 && d <= 5);
        } catch {
        }
      }
      const workdayCount = weekEnd > today ? coachWorkdays.filter((d) => d <= elapsedWeekdays).length : coachWorkdays.length;
      return {
        coachId: coach.id,
        coachName: coach.name,
        morningDays,
        workdayCount: Math.max(1, workdayCount),
        followupDays,
        totalFollowupMsgs,
        totalDisengagementMsgs
      };
    });
    const engagementStats = coachSummaries.map((c) => ({
      coachId: c.coachId,
      coachName: c.coachName,
      scheduled: c.scheduled,
      completed: c.completed,
      missed: c.scheduled - c.completed,
      engagementPct: c.pct
    }));
    const disengagedThisWeek = [];
    for (const coach of coachList) {
      const results = await computeDisengagedClients(coach.id, coach.name, input.weekStart);
      for (const r of results) {
        disengagedThisWeek.push({
          coachId: r.coachId,
          coachName: r.coachName,
          clientName: r.clientName,
          consecutiveMissed: r.consecutiveMissed
        });
      }
    }
    const prevWeekStart = addDays(input.weekStart, -7);
    const prevSnapshots = await db2.select().from(rosterWeeklySnapshots).where(eq4(rosterWeeklySnapshots.weekStart, prevWeekStart));
    const prevSnapMap = new Map(prevSnapshots.map((s) => [s.coachId, s.snapshotJson]));
    let prevTotalScheduled = 0;
    let prevTotalCompleted = 0;
    for (const coach of coachList) {
      const prevSnap = prevSnapMap.get(coach.id);
      if (prevSnap?.scheduled != null) {
        prevTotalScheduled += prevSnap.scheduled;
        prevTotalCompleted += prevSnap.completed ?? 0;
      } else {
        const roster = await fetchRosterForCoach(coach.name);
        let scheduled = 0;
        for (const day of DAYS) scheduled += (roster[day] ?? []).length;
        const completions = await db2.select().from(clientCheckIns).where(and2(eq4(clientCheckIns.coachId, coach.id), eq4(clientCheckIns.weekStart, prevWeekStart)));
        const completed = completions.filter((c) => c.completedAt != null).length;
        prevTotalScheduled += scheduled;
        prevTotalCompleted += completed;
      }
    }
    const prevPct = prevTotalScheduled > 0 ? Math.round(prevTotalCompleted / prevTotalScheduled * 100) : 0;
    const engagementTrend = overallPct - prevPct;
    let prevDisengagedCount = 0;
    for (const coach of coachList) {
      const results = await computeDisengagedClients(coach.id, coach.name, prevWeekStart);
      prevDisengagedCount += results.length;
    }
    const disengagedTrend = disengagedThisWeek.length - prevDisengagedCount;
    const allRatings = await db2.select().from(clientRatings);
    const green = allRatings.filter((r) => r.rating === "green").length;
    const yellow = allRatings.filter((r) => r.rating === "yellow").length;
    const red = allRatings.filter((r) => r.rating === "red").length;
    const totalRated = green + yellow + red;
    const greenPct = totalRated > 0 ? Math.round(green / totalRated * 100) : 0;
    return {
      weekStart: input.weekStart,
      totalScheduled,
      totalCompleted,
      overallEngagementPct: overallPct,
      engagementTrend,
      disengagedThisWeek,
      disengagedTrend,
      coachActivity,
      engagementStats,
      clientHealth: {
        total: totalRated,
        green,
        yellow,
        red,
        greenPct
      },
      // Keep legacy shape too
      overall: {
        scheduled: totalScheduled,
        completed: totalCompleted,
        excused: totalExcused,
        pct: overallPct
      },
      coaches: coachSummaries
    };
  }),
  /** Set client rating. */
  setRating: protectedProcedure.input(
    z.object({
      coachId: z.number(),
      clientName: z.string(),
      rating: z.enum(["green", "yellow", "red"]),
      notes: z.string().optional()
    })
  ).mutation(async ({ input }) => {
    const db2 = await requireDb();
    const existing = await db2.select().from(clientRatings).where(
      and2(eq4(clientRatings.coachId, input.coachId), eq4(clientRatings.clientName, input.clientName))
    ).limit(1);
    if (existing.length > 0) {
      await db2.update(clientRatings).set({ rating: input.rating, notes: input.notes ?? existing[0].notes }).where(eq4(clientRatings.id, existing[0].id));
      return { id: existing[0].id };
    }
    const [result] = await db2.insert(clientRatings).values({
      coachId: input.coachId,
      clientName: input.clientName,
      rating: input.rating,
      notes: input.notes
    });
    return { id: result.insertId };
  }),
  /** Remove a client rating. */
  clearRating: protectedProcedure.input(
    z.object({
      coachId: z.number(),
      clientName: z.string()
    })
  ).mutation(async ({ input }) => {
    const db2 = await requireDb();
    await db2.delete(clientRatings).where(
      and2(eq4(clientRatings.coachId, input.coachId), eq4(clientRatings.clientName, input.clientName))
    );
    return { success: true };
  }),
  /** Clear all ratings, or for a specific coach if coachId provided. */
  resetAllRatings: adminProcedure.input(z.object({ coachId: z.number().optional() }).optional()).mutation(async ({ input }) => {
    const db2 = await requireDb();
    const ratingsToBackup = input?.coachId ? await db2.select().from(clientRatings).where(eq4(clientRatings.coachId, input.coachId)) : await db2.select().from(clientRatings);
    const backupSnapshot = {
      _isRatingBackup: true,
      ratings: ratingsToBackup.map((r) => ({
        coachId: r.coachId,
        clientName: r.clientName,
        rating: r.rating,
        notes: r.notes
      }))
    };
    const [backupResult] = await db2.insert(sweepReports).values({
      title: `[Rating Backup] ${(/* @__PURE__ */ new Date()).toISOString()}`,
      createdByUserId: 0,
      createdByName: "System Backup",
      snapshotJson: backupSnapshot,
      weekStart: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
      scopeType: input?.coachId ? "coach" : "all",
      scopeCoachId: input?.coachId ?? null
    });
    if (input?.coachId) {
      await db2.delete(clientRatings).where(eq4(clientRatings.coachId, input.coachId));
    } else {
      await db2.delete(clientRatings);
    }
    return { success: true, backupId: backupResult.insertId, backedUp: ratingsToBackup.length };
  }),
  /** Undo a rating reset by restoring from backup. */
  undoResetRatings: adminProcedure.input(z.object({ backupId: z.number() })).mutation(async ({ input }) => {
    const db2 = await requireDb();
    const [backup] = await db2.select().from(sweepReports).where(eq4(sweepReports.id, input.backupId)).limit(1);
    if (!backup) throw new TRPCError({ code: "NOT_FOUND", message: "Backup not found" });
    const snapshot = backup.snapshotJson;
    if (!snapshot?._isRatingBackup || !snapshot?.ratings) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Not a valid rating backup" });
    }
    let restored = 0;
    for (const r of snapshot.ratings) {
      const existing = await db2.select().from(clientRatings).where(and2(eq4(clientRatings.coachId, r.coachId), eq4(clientRatings.clientName, r.clientName))).limit(1);
      if (existing.length > 0) {
        await db2.update(clientRatings).set({ rating: r.rating, notes: r.notes }).where(eq4(clientRatings.id, existing[0].id));
      } else {
        await db2.insert(clientRatings).values({
          coachId: r.coachId,
          clientName: r.clientName,
          rating: r.rating,
          notes: r.notes
        });
      }
      restored++;
    }
    await db2.delete(sweepReports).where(eq4(sweepReports.id, input.backupId));
    return { success: true, restored };
  })
});
var sweepReportRouter = t.router({
  /** Create sweep report snapshot. */
  create: adminProcedure.input(
    z.object({
      title: z.string(),
      weekStart: z.string(),
      coachId: z.number().optional()
    })
  ).mutation(async ({ input, ctx }) => {
    const db2 = await requireDb();
    const coachList = input.coachId ? await db2.select().from(coaches).where(eq4(coaches.id, input.coachId)) : await db2.select().from(coaches).where(eq4(coaches.isActive, 1));
    const snapshot = { coaches: [] };
    for (const coach of coachList) {
      const roster = await fetchRosterForCoach(coach.name);
      let scheduled = 0;
      for (const day of DAYS) scheduled += (roster[day] ?? []).length;
      const completions = await db2.select().from(clientCheckIns).where(and2(eq4(clientCheckIns.coachId, coach.id), eq4(clientCheckIns.weekStart, input.weekStart)));
      const completed = completions.filter((c) => c.completedAt != null).length;
      const excuses = await db2.select().from(excusedClients).where(
        and2(
          eq4(excusedClients.coachId, coach.id),
          eq4(excusedClients.weekStart, input.weekStart),
          eq4(excusedClients.status, "approved")
        )
      );
      const ratings = await db2.select().from(clientRatings).where(eq4(clientRatings.coachId, coach.id));
      const green = ratings.filter((r) => r.rating === "green").length;
      const yellow = ratings.filter((r) => r.rating === "yellow").length;
      const red = ratings.filter((r) => r.rating === "red").length;
      snapshot.coaches.push({
        coachId: coach.id,
        coachName: coach.name,
        scheduled,
        completed,
        excused: excuses.length,
        pct: scheduled > 0 ? Math.round(completed / Math.max(scheduled - excuses.length, 1) * 100) : 0,
        ratings: { green, yellow, red },
        roster,
        ratingDetails: ratings.map((r) => ({
          clientName: r.clientName,
          rating: r.rating,
          notes: r.notes
        }))
      });
    }
    const [result] = await db2.insert(sweepReports).values({
      title: input.title,
      createdByUserId: ctx.user.id,
      createdByName: ctx.user.name ?? ctx.user.email ?? "Unknown",
      snapshotJson: snapshot,
      weekStart: input.weekStart,
      scopeType: input.coachId ? "coach" : "all",
      scopeCoachId: input.coachId ?? null
    });
    return { id: result.insertId };
  }),
  /** Mark report as saved. */
  save: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db2 = await requireDb();
    await db2.update(sweepReports).set({ isSaved: 1 }).where(eq4(sweepReports.id, input.id));
    return { success: true };
  }),
  /** Get report by ID (public for sharing). */
  getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db2 = await requireDb();
    const [report] = await db2.select().from(sweepReports).where(eq4(sweepReports.id, input.id)).limit(1);
    if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });
    return report;
  }),
  /** All reports. */
  list: adminProcedure.query(async () => {
    const db2 = await requireDb();
    return db2.select().from(sweepReports).orderBy(desc(sweepReports.createdAt));
  }),
  /** Saved reports only. */
  listSaved: adminProcedure.query(async () => {
    const db2 = await requireDb();
    return db2.select().from(sweepReports).where(eq4(sweepReports.isSaved, 1)).orderBy(desc(sweepReports.createdAt));
  }),
  /** Compare two reports. */
  compare: adminProcedure.input(
    z.object({
      idA: z.number(),
      idB: z.number()
    })
  ).query(async ({ input }) => {
    const db2 = await requireDb();
    const [reportA] = await db2.select().from(sweepReports).where(eq4(sweepReports.id, input.idA)).limit(1);
    const [reportB] = await db2.select().from(sweepReports).where(eq4(sweepReports.id, input.idB)).limit(1);
    if (!reportA || !reportB) {
      throw new TRPCError({ code: "NOT_FOUND", message: "One or both reports not found" });
    }
    return { reportA, reportB };
  })
});
var usersRouter = t.router({
  /** All users. */
  list: adminProcedure.query(async () => {
    const db2 = await requireDb();
    return db2.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      profileImageUrl: users.profileImageUrl,
      createdAt: users.createdAt
    }).from(users).orderBy(asc(users.name));
  }),
  /** Change user role. */
  updateRole: adminProcedure.input(
    z.object({
      id: z.number(),
      role: z.string()
    })
  ).mutation(async ({ input }) => {
    const db2 = await requireDb();
    await db2.update(users).set({ role: input.role }).where(eq4(users.id, input.id));
    return { success: true };
  })
});
var kudosRouter = t.router({
  /** Send kudos — also sends Slack DM to the coach. */
  send: adminProcedure.input(
    z.object({
      coachId: z.number(),
      message: z.string().min(1)
    })
  ).mutation(async ({ input, ctx }) => {
    const db2 = await requireDb();
    const [result] = await db2.insert(kudos).values({
      fromUserId: ctx.user.id,
      coachId: input.coachId,
      message: input.message
    });
    const [coach] = await db2.select().from(coaches).where(eq4(coaches.id, input.coachId)).limit(1);
    if (coach?.slackUserId) {
      const senderName = ctx.user.name ?? ctx.user.email ?? "Your manager";
      const slackMsg = `\u2728 *Kudos from ${senderName}!*

${input.message}`;
      await sendSlackDM(coach.slackUserId, slackMsg).catch(
        (err) => console.error("[Kudos] Slack DM failed:", err)
      );
    }
    return { id: result.insertId };
  }),
  /** Recent kudos. */
  history: adminProcedure.query(async () => {
    const db2 = await requireDb();
    return db2.select({
      id: kudos.id,
      fromUserId: kudos.fromUserId,
      coachId: kudos.coachId,
      message: kudos.message,
      createdAt: kudos.createdAt,
      coachName: coaches.name
    }).from(kudos).leftJoin(coaches, eq4(kudos.coachId, coaches.id)).orderBy(desc(kudos.createdAt)).limit(50);
  })
});
var salesRouter = t.router({
  /** Submit or update morning check-in. */
  submitMorning: protectedProcedure.input(z.object({
    recordDate: z.string(),
    moodScore: z.number().min(1).max(5).optional(),
    intendedWorkingHours: z.string().optional(),
    morningNotes: z.string().optional()
  })).mutation(async ({ input, ctx }) => {
    const db2 = await requireDb();
    const existing = await db2.select().from(salesCheckins).where(and2(eq4(salesCheckins.userId, ctx.user.id), eq4(salesCheckins.recordDate, input.recordDate))).limit(1);
    if (existing.length > 0) {
      await db2.update(salesCheckins).set({
        moodScore: input.moodScore ?? existing[0].moodScore,
        intendedWorkingHours: input.intendedWorkingHours ?? existing[0].intendedWorkingHours,
        morningNotes: input.morningNotes ?? existing[0].morningNotes,
        morningSubmittedAt: /* @__PURE__ */ new Date()
      }).where(eq4(salesCheckins.id, existing[0].id));
    } else {
      await db2.insert(salesCheckins).values({
        userId: ctx.user.id,
        userName: ctx.user.name ?? ctx.user.email ?? "Unknown",
        recordDate: input.recordDate,
        moodScore: input.moodScore,
        intendedWorkingHours: input.intendedWorkingHours,
        morningNotes: input.morningNotes,
        morningSubmittedAt: /* @__PURE__ */ new Date()
      });
    }
    notifyManagerOfSubmission(0, "morning", {
      ...input,
      _salesUser: ctx.user.name ?? ctx.user.email,
      _isSales: true
    }).catch(() => {
    });
    return { success: true };
  }),
  /** Submit or update evening check-in. */
  submitEvening: protectedProcedure.input(z.object({
    recordDate: z.string(),
    howDayWent: z.string().optional(),
    salesMade: z.number().optional(),
    intendedHoursNextDay: z.string().optional(),
    eveningNotes: z.string().optional()
  })).mutation(async ({ input, ctx }) => {
    const db2 = await requireDb();
    const existing = await db2.select().from(salesCheckins).where(and2(eq4(salesCheckins.userId, ctx.user.id), eq4(salesCheckins.recordDate, input.recordDate))).limit(1);
    if (existing.length > 0) {
      await db2.update(salesCheckins).set({
        howDayWent: input.howDayWent ?? existing[0].howDayWent,
        salesMade: input.salesMade ?? existing[0].salesMade,
        intendedHoursNextDay: input.intendedHoursNextDay ?? existing[0].intendedHoursNextDay,
        eveningNotes: input.eveningNotes ?? existing[0].eveningNotes,
        eveningSubmittedAt: /* @__PURE__ */ new Date()
      }).where(eq4(salesCheckins.id, existing[0].id));
    } else {
      await db2.insert(salesCheckins).values({
        userId: ctx.user.id,
        userName: ctx.user.name ?? ctx.user.email ?? "Unknown",
        recordDate: input.recordDate,
        howDayWent: input.howDayWent,
        salesMade: input.salesMade,
        intendedHoursNextDay: input.intendedHoursNextDay,
        eveningNotes: input.eveningNotes,
        eveningSubmittedAt: /* @__PURE__ */ new Date()
      });
    }
    const managerSlackId = ENV.managerSlackId;
    if (managerSlackId && ENV.slackBotToken) {
      const appUrl = ENV.appUrl || "https://coach.databite.com.au";
      const name = ctx.user.name ?? ctx.user.email ?? "Sales";
      let summary = "";
      if (input.howDayWent) summary += `*How day went:* ${input.howDayWent}
`;
      if (input.salesMade != null) summary += `*Sales made:* ${input.salesMade}
`;
      if (input.intendedHoursNextDay) summary += `*Tomorrow's hours:* ${input.intendedHoursNextDay}
`;
      if (input.eveningNotes) summary += `*Notes:* ${input.eveningNotes}`;
      const message = `\u{1F319} *${name}* \u2014 Evening Check-In

${summary}

\u{1F449} <${appUrl}/sales|View Sales>`;
      sendSlackDM(managerSlackId, message).catch((err) => console.error("[Slack Notify] DM error:", err));
    }
    return { success: true };
  }),
  /** Get today's check-in for the current user. */
  getToday: protectedProcedure.input(z.object({ recordDate: z.string() })).query(async ({ input, ctx }) => {
    const db2 = await requireDb();
    const [record] = await db2.select().from(salesCheckins).where(and2(eq4(salesCheckins.userId, ctx.user.id), eq4(salesCheckins.recordDate, input.recordDate))).limit(1);
    return record ?? null;
  }),
  /** Get all check-ins (admin view). */
  getAll: adminProcedure.input(z.object({ startDate: z.string().optional(), endDate: z.string().optional() }).optional()).query(async ({ input }) => {
    const db2 = await requireDb();
    const conditions = [];
    if (input?.startDate) conditions.push(gte2(salesCheckins.recordDate, input.startDate));
    if (input?.endDate) conditions.push(lte2(salesCheckins.recordDate, input.endDate));
    return db2.select().from(salesCheckins).where(conditions.length > 0 ? and2(...conditions) : void 0).orderBy(desc(salesCheckins.recordDate));
  })
});
var appRouter = t.router({
  checkins: checkinsRouter,
  clientCheckins: clientCheckinsRouter,
  coaches: coachesRouter,
  performance: performanceRouter,
  sweepReport: sweepReportRouter,
  users: usersRouter,
  kudos: kudosRouter,
  sales: salesRouter
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await authenticateRequest(opts.req);
  } catch {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
async function setupVite(app) {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createServer2 } = await import("vite");
    const projectRoot = path.resolve(__dirname, "../..");
    const vite = await createServer2({
      configFile: path.resolve(projectRoot, "vite.config.ts"),
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }
}
async function serveStatic(app) {
  const { default: express2 } = await import("express");
  const candidates = [
    path.resolve(__dirname, "public"),
    // dist/public (relative to bundle)
    path.resolve(process.cwd(), "dist/public"),
    // dist/public (relative to cwd)
    path.resolve(process.cwd(), "public")
    // public (if cwd is dist/)
  ];
  let distPath = candidates[0];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "index.html"))) {
      distPath = candidate;
      break;
    }
  }
  console.log(`[Static] __dirname: ${__dirname}`);
  console.log(`[Static] process.cwd(): ${process.cwd()}`);
  console.log(`[Static] Serving files from: ${distPath}`);
  console.log(`[Static] index.html exists: ${fs.existsSync(path.join(distPath, "index.html"))}`);
  app.use(express2.static(distPath));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "Not found" });
    }
    const indexPath = path.join(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(500).send("index.html not found at " + indexPath);
    }
  });
}

// server/slackWeeklySummary.ts
var MANAGER_SLACK_ID = ENV.managerSlackId;
var APP_URL2 = ENV.appUrl || "https://databitecoach.com";
function formatDate(dateStr) {
  const d = /* @__PURE__ */ new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
async function sendWeeklySummary() {
  if (!MANAGER_SLACK_ID) {
    console.warn("[Slack Weekly] MANAGER_SLACK_ID not set \u2014 skipping summary");
    return;
  }
  const data = await getLastWeekSummary();
  if (!data || data.records.length === 0) {
    console.log("[Slack Weekly] No data for last week \u2014 skipping summary");
    return;
  }
  const { records, startDate, endDate } = data;
  const lastWeekStart = startDate;
  const allClientCheckIns = await getAllClientCheckInsForWeek(lastWeekStart);
  const allCoaches = await getAllCoaches();
  const clientCheckInsByCoach = {};
  for (const ci of allClientCheckIns) {
    clientCheckInsByCoach[ci.coachId] = (clientCheckInsByCoach[ci.coachId] ?? 0) + 1;
  }
  const byCoach = {};
  for (const r of records) {
    if (!byCoach[r.coachId]) {
      byCoach[r.coachId] = {
        name: r.coachName ?? `Coach #${r.coachId}`,
        totalScheduled: 0,
        totalCompleted: 0,
        totalFollowups: 0,
        lowMoodCount: 0,
        morningDays: 0
      };
    }
    const s = byCoach[r.coachId];
    if (r.submissionType === "morning") {
      s.totalScheduled += r.scheduledCheckins ?? 0;
      s.totalCompleted += r.completedCheckins ?? 0;
      s.morningDays += 1;
      if (r.moodScore !== null && r.moodScore !== void 0 && r.moodScore <= 2) {
        s.lowMoodCount += 1;
      }
    }
    if (r.submissionType === "followup") {
      s.totalFollowups += r.followupMessagesSent ?? 0;
    }
  }
  const weekLabel = `${formatDate(startDate)} \u2013 ${formatDate(endDate)}`;
  let msg = `\u{1F4CA} *Weekly Check-In Summary \u2014 ${weekLabel}*

`;
  let anyLowMood = false;
  for (const stats of Object.values(byCoach)) {
    const pct = stats.totalScheduled > 0 ? Math.round(stats.totalCompleted / stats.totalScheduled * 100) : 0;
    const engEmoji = pct >= 90 ? "\u{1F7E2}" : pct >= 75 ? "\u{1F7E1}" : "\u{1F534}";
    msg += `*${stats.name}*
`;
    msg += `  ${engEmoji} Engagement: ${stats.totalCompleted}/${stats.totalScheduled} = *${pct}%*
`;
    msg += `  \u{1F4E8} Follow-ups sent: ${stats.totalFollowups}
`;
    const coachRecord = allCoaches.find((c) => c.name === stats.name);
    if (coachRecord) {
      const clientCount = clientCheckInsByCoach[coachRecord.id] ?? 0;
      msg += `  \u2705 Client check-ins logged: *${clientCount}*
`;
    }
    if (stats.lowMoodCount > 0) {
      msg += `  \u26A0\uFE0F Low mood days: ${stats.lowMoodCount}
`;
      anyLowMood = true;
    }
    msg += "\n";
  }
  if (anyLowMood) {
    msg += `\u26A0\uFE0F *One or more coaches had low mood scores last week.* Consider a 1-on-1 check-in.

`;
  }
  msg += `\u{1F449} <${APP_URL2}/dashboard|View Full Dashboard>`;
  await sendSlackDM(MANAGER_SLACK_ID, msg);
  console.log("[Slack Weekly] Summary sent to manager");
}

// server/screenshotDisengagement.ts
async function screenshotDisengagementCard() {
  return null;
}

// server/slackDisengagementAlert.ts
var MANAGER_SLACK_ID2 = ENV.managerSlackId;
var SLACK_BOT_TOKEN2 = ENV.slackBotToken;
var APP_URL3 = ENV.appUrl || "https://databitecoach.com";
var SEAL_TEAM_SIX_CHANNEL = "C09AD6EDCDU";
function getMondayLocal(date2) {
  const d = new Date(date2);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}
function toDateAU(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const y = d.getFullYear();
  return `${dd}/${m}/${y}`;
}
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
async function uploadPngToSlackChannel(pngBuffer, filename, channelId, initialComment) {
  if (!SLACK_BOT_TOKEN2) {
    console.warn("[Slack Disengagement] SLACK_BOT_TOKEN not set \u2014 cannot upload PNG");
    return false;
  }
  try {
    const urlRes = await fetch("https://slack.com/api/files.getUploadURLExternal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${SLACK_BOT_TOKEN2}`
      },
      body: JSON.stringify({
        filename,
        length: pngBuffer.length
      })
    });
    const urlData = await urlRes.json();
    if (!urlData.ok || !urlData.upload_url || !urlData.file_id) {
      console.error("[Slack Disengagement] getUploadURLExternal failed:", urlData.error);
      return false;
    }
    const uploadRes = await fetch(urlData.upload_url, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: new Uint8Array(pngBuffer)
    });
    if (!uploadRes.ok) {
      console.error("[Slack Disengagement] File upload failed:", uploadRes.status);
      return false;
    }
    const completeRes = await fetch("https://slack.com/api/files.completeUploadExternal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${SLACK_BOT_TOKEN2}`
      },
      body: JSON.stringify({
        files: [{ id: urlData.file_id, title: filename }],
        channel_id: channelId,
        initial_comment: initialComment
      })
    });
    const completeData = await completeRes.json();
    if (!completeData.ok) {
      console.error("[Slack Disengagement] completeUploadExternal failed:", completeData.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Slack Disengagement] PNG upload error:", err);
    return false;
  }
}
async function sendDisengagementAlert() {
  const now = /* @__PURE__ */ new Date();
  const currentMonday = getMondayLocal(now);
  const weekLabelAU = toDateAU(currentMonday);
  const weekLabelISO = toDateStr(currentMonday);
  console.log(`[Slack Disengagement] Starting Monday alert for week of ${weekLabelAU}`);
  let pngUploaded = false;
  try {
    console.log("[Slack Disengagement] Launching Puppeteer screenshot...");
    const pngBuffer = await screenshotDisengagementCard();
    if (!pngBuffer) {
      console.log("[Slack Disengagement] Screenshot not available \u2014 skipping PNG upload");
    } else {
      const filename = `disengagement-${weekLabelISO}.png`;
      const comment = `Hey Team, hope everyone had a good weekend!

Here is our focus list for this week based on last week's check ins. Let's get quick looms out to anyone in red who we are yet to hear from!

\u{1F449} <${APP_URL3}/client-checkins?tab=disengagement|View full disengagement list>`;
      pngUploaded = await uploadPngToSlackChannel(pngBuffer, filename, SEAL_TEAM_SIX_CHANNEL, comment);
    }
    if (pngUploaded) {
      console.log(`[Slack Disengagement] PNG posted to #seal-team-six for week of ${weekLabelAU}`);
    }
  } catch (err) {
    console.error("[Slack Disengagement] Puppeteer screenshot failed:", err);
  }
  if (!pngUploaded) {
    if (!MANAGER_SLACK_ID2) {
      console.warn("[Slack Disengagement] MANAGER_SLACK_ID not set \u2014 skipping fallback DM");
      return;
    }
    const msg = `\u{1F6A8} *Disengagement Alert \u2014 Week of ${weekLabelAU}*

_(PNG screenshot failed \u2014 check server logs)_

\u{1F449} <${APP_URL3}/client-checkins?tab=disengagement|View Disengagement Tracking>`;
    await sendSlackDM(MANAGER_SLACK_ID2, msg);
    console.log("[Slack Disengagement] Fallback text DM sent to manager");
  }
}

// server/slackFridaySummary.ts
var MANAGER_SLACK_ID3 = ENV.managerSlackId;
var APP_URL4 = ENV.appUrl || "https://databitecoach.com";
function getMondayLocal2(date2) {
  const d = new Date(date2);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}
function toDateStr2(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function addDays2(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function formatShortDate(dateStr) {
  const d = /* @__PURE__ */ new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
var DAY_OFFSET = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4
};
var DAY_LABEL = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri"
};
async function sendFridayWeeklySummary() {
  if (!MANAGER_SLACK_ID3) {
    console.warn("[Slack Friday Summary] MANAGER_SLACK_ID not set \u2014 skipping");
    return;
  }
  const now = /* @__PURE__ */ new Date();
  const epochDate = /* @__PURE__ */ new Date(CLIENT_CHECKINS_EPOCH + "T00:00:00");
  const weekStart = getMondayLocal2(now);
  if (weekStart < epochDate) {
    console.log("[Slack Friday Summary] Before tracking epoch \u2014 skipping");
    return;
  }
  const weekStartStr = toDateStr2(weekStart);
  const fridayDate = addDays2(weekStart, 4);
  const weekLabel = `${formatShortDate(weekStartStr)} \u2013 ${formatShortDate(toDateStr2(fridayDate))}`;
  const allCoaches = await getAllCoaches();
  const activeCoaches = allCoaches.filter((c) => c.isActive);
  if (activeCoaches.length === 0) {
    console.log("[Slack Friday Summary] No active coaches \u2014 skipping");
    return;
  }
  let totalScheduled = 0;
  let totalCompleted = 0;
  const coachSections = [];
  for (const coach of activeCoaches) {
    const roster = await fetchRosterForCoach(coach.name);
    const completions = await getClientCheckInsForWeek(coach.id, weekStartStr);
    const completedSet = new Set(completions.map((c) => `${c.clientName}|${c.dayOfWeek}`));
    let coachScheduled = 0;
    let coachCompleted = 0;
    const pendingByDay = {};
    const completedByDay = {};
    for (const day of DAYS2) {
      const clients = roster[day];
      if (clients.length === 0) continue;
      const dayDate = addDays2(weekStart, DAY_OFFSET[day]);
      const cutoff = new Date(dayDate);
      cutoff.setHours(17, 0, 0, 0);
      const dayHasPassed = now >= cutoff;
      for (const client of clients) {
        const isDone = completedSet.has(`${client}|${day}`);
        coachScheduled++;
        if (isDone) {
          coachCompleted++;
          if (!completedByDay[day]) completedByDay[day] = [];
          completedByDay[day].push(client);
        } else if (dayHasPassed) {
          if (!pendingByDay[day]) pendingByDay[day] = [];
          pendingByDay[day].push(client);
        }
      }
    }
    totalScheduled += coachScheduled;
    totalCompleted += coachCompleted;
    const coachPct = coachScheduled > 0 ? Math.round(coachCompleted / coachScheduled * 100) : 0;
    const engEmoji = coachPct >= 90 ? "\u{1F7E2}" : coachPct >= 75 ? "\u{1F7E1}" : "\u{1F534}";
    let section = `*${coach.name}* \u2014 ${engEmoji} ${coachCompleted}/${coachScheduled} (${coachPct}%)
`;
    const completedDays = DAYS2.filter((d) => (completedByDay[d]?.length ?? 0) > 0);
    if (completedDays.length > 0) {
      for (const day of completedDays) {
        const clients = completedByDay[day];
        const dayDate = addDays2(weekStart, DAY_OFFSET[day]);
        const dateLabel = formatShortDate(toDateStr2(dayDate));
        section += `  \u2705 ${DAY_LABEL[day]} ${dateLabel}: ${clients.join(", ")}
`;
      }
    }
    const pendingDays = DAYS2.filter((d) => (pendingByDay[d]?.length ?? 0) > 0);
    if (pendingDays.length > 0) {
      for (const day of pendingDays) {
        const clients = pendingByDay[day];
        const dayDate = addDays2(weekStart, DAY_OFFSET[day]);
        const dateLabel = formatShortDate(toDateStr2(dayDate));
        section += `  \u274C ${DAY_LABEL[day]} ${dateLabel}: ${clients.join(", ")}
`;
      }
    }
    coachSections.push(section);
  }
  const overallPct = totalScheduled > 0 ? Math.round(totalCompleted / totalScheduled * 100) : 0;
  const overallEmoji = overallPct >= 90 ? "\u{1F7E2}" : overallPct >= 75 ? "\u{1F7E1}" : "\u{1F534}";
  let msg = `\u{1F4CB} *Weekly Client Check-In Summary \u2014 ${weekLabel}*
`;
  msg += `${overallEmoji} Overall: *${totalCompleted}/${totalScheduled} completed (${overallPct}%)*

`;
  for (const section of coachSections) {
    msg += section + "\n";
  }
  msg += `\u{1F449} <${APP_URL4}/client-checkins|View Client Check-Ins>`;
  await sendSlackDM(MANAGER_SLACK_ID3, msg);
  console.log(`[Slack Friday Summary] Sent \u2014 ${totalCompleted}/${totalScheduled} (${overallPct}%)`);
}

// server/typeformWebhook.ts
import crypto from "crypto";
import { and as and3, eq as eq5 } from "drizzle-orm";
var FORM_TO_COACH = {
  hrGCn0V0: "Kyah",
  i9de5jMN: "Luke",
  lRvWjdgl: "Steve"
  // Rich's form is excluded — he is the founder, not a tracked coach
};
var SHEET_ID2 = "1puu4oLAmC5jV_GEmRrMxvXuTak_dl6pOJ6iWC44Nfl4";
var SHEET_TAB2 = "CLIENT ROSTER";
var DAYS3 = ["monday", "tuesday", "wednesday", "thursday", "friday"];
function getAESTWeekStart(date2) {
  const aest = new Date(date2.getTime() + 10 * 60 * 60 * 1e3);
  const day = aest.getUTCDay();
  let monday;
  if (day === 0) {
    monday = new Date(aest.getTime() + 1 * 24 * 60 * 60 * 1e3);
  } else {
    const daysFromMonday = day - 1;
    monday = new Date(aest.getTime() - daysFromMonday * 24 * 60 * 60 * 1e3);
  }
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const d = String(monday.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function getAESTDayOfWeek(date2) {
  const aest = new Date(date2.getTime() + 10 * 60 * 60 * 1e3);
  const dayIndex = aest.getUTCDay();
  const map = { 0: "monday", 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday" };
  return map[dayIndex] ?? null;
}
function normaliseName2(name) {
  return name.toLowerCase().replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
}
var NICKNAME_MAP = {
  // Existing
  jess: "jessica",
  jessica: "jess",
  chris: "christopher",
  christopher: "chris",
  eleni: "elaine",
  elaine: "eleni",
  liz: "elizabeth",
  elizabeth: "liz",
  kate: "katherine",
  katherine: "kate",
  kath: "katherine",
  matt: "matthew",
  matthew: "matt",
  rob: "robert",
  robert: "rob",
  mike: "michael",
  michael: "mike",
  dan: "daniel",
  daniel: "dan",
  sam: "samantha",
  samantha: "sam",
  ben: "benjamin",
  benjamin: "ben",
  nick: "nicholas",
  nicholas: "nick",
  tom: "thomas",
  thomas: "tom",
  alex: "alexander",
  alexander: "alex",
  nat: "natalie",
  natalie: "nat",
  steph: "stephanie",
  stephanie: "steph",
  // Added from roster analysis
  gen: "genevieve",
  genevieve: "gen",
  bec: "rebecca",
  rebecca: "bec",
  jo: "joanne",
  joanne: "jo",
  josephine: "jo",
  jen: "jennifer",
  jennifer: "jen",
  ange: "angela",
  angela: "ange",
  cat: "catherine",
  catherine: "cat",
  cath: "catherine",
  lou: "louise",
  loui: "louise",
  louise: "lou",
  prue: "prudence",
  prudence: "prue",
  tess: "teresa",
  teresa: "tess",
  susy: "susanne",
  suzi: "susanne",
  susanne: "susy",
  sue: "susan",
  susan: "sue",
  suzan: "susan",
  liv: "olivia",
  olivia: "liv",
  ash: "ashley",
  ashley: "ash",
  demi: "demeter",
  demeter: "demi",
  elie: "eleanor",
  eleanor: "elie",
  lia: "julia",
  julia: "lia",
  dee: "denise",
  denise: "dee"
};
function matchScore(submitted, rosterName) {
  const s = normaliseName2(submitted);
  const r = normaliseName2(rosterName);
  if (s === r) return 100;
  const sParts = s.split(" ");
  const rParts = r.split(" ");
  if (sParts.length < 2 || rParts.length < 2) return 0;
  const sFirst = sParts[0];
  const sLast = sParts.slice(1).join(" ");
  const rFirst = rParts[0];
  const rLast = rParts.slice(1).join(" ");
  const firstMatch = sFirst === rFirst || NICKNAME_MAP[sFirst] === rFirst || NICKNAME_MAP[rFirst] === sFirst;
  if (!firstMatch) return 0;
  if (sLast === rLast) return 90;
  if (sLast.length >= 4 && rLast.startsWith(sLast)) return 70;
  if (rLast.length >= 4 && sLast.startsWith(rLast)) return 70;
  const minLen = Math.min(sLast.length, rLast.length);
  if (minLen >= 4 && sLast.substring(0, 4) === rLast.substring(0, 4)) return 50;
  if (sLast.length >= 4 && rLast.length >= 4) {
    const longer = sLast.length >= rLast.length ? sLast : rLast;
    const shorter = sLast.length >= rLast.length ? rLast : sLast;
    if (longer.length - shorter.length <= 1) {
      let mismatches = 0;
      let si = 0, li = 0;
      while (si < shorter.length && li < longer.length) {
        if (shorter[si] !== longer[li]) {
          mismatches++;
          if (mismatches > 1) break;
          li++;
        } else {
          si++;
          li++;
        }
      }
      if (mismatches <= 1) return 45;
    }
  }
  return 0;
}
async function fetchRosterClients(coachName) {
  const API_KEY = ENV.googleSheetsApiKey;
  if (!API_KEY) return [];
  const range = encodeURIComponent(`${SHEET_TAB2}!A1:J200`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID2}/values/${range}?key=${API_KEY}`;
  let rows = [];
  try {
    const res = await fetch(url);
    const data = await res.json();
    rows = data.values ?? [];
  } catch (err) {
    console.error("[Webhook] Failed to fetch roster:", err);
    return [];
  }
  const headerPrefix = `${coachName.toUpperCase()} - MONDAY`;
  let sectionStart = -1;
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i]?.[0] ?? "").trim().toUpperCase() === headerPrefix) {
      sectionStart = i;
      break;
    }
  }
  if (sectionStart === -1) return [];
  const headerRow = rows[sectionStart];
  const prevRow = sectionStart > 0 ? rows[sectionStart - 1] ?? [] : [];
  const colToDay = { 0: "monday" };
  for (let col = 1; col <= 9; col++) {
    const fromHeader = (headerRow[col] ?? "").trim().toLowerCase();
    const fromPrev = (prevRow[col] ?? "").trim().toLowerCase();
    const dayName = DAYS3.includes(fromHeader) ? fromHeader : DAYS3.includes(fromPrev) ? fromPrev : null;
    if (dayName) colToDay[col] = dayName;
  }
  const clients = [];
  for (const [colStr, day] of Object.entries(colToDay)) {
    const col = Number(colStr);
    if (col === 0) continue;
    const cellInHeader = (headerRow[col] ?? "").trim();
    if (cellInHeader && !DAYS3.includes(cellInHeader.toLowerCase())) {
      clients.push({ clientName: cellInHeader, day });
    }
  }
  for (let i = sectionStart + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const firstCell = (row[0] ?? "").trim();
    if (!firstCell && row.every((c) => !c?.trim())) break;
    if (/^[A-Z]+ - MONDAY$/i.test(firstCell) && i !== sectionStart) break;
    for (const [colStr, day] of Object.entries(colToDay)) {
      const client = (row[Number(colStr)] ?? "").trim();
      if (client) clients.push({ clientName: client, day });
    }
  }
  return clients;
}
async function markClientSubmitted(params) {
  const db2 = await getDb();
  if (!db2) return;
  const existing = await db2.select().from(clientCheckIns).where(
    and3(
      eq5(clientCheckIns.coachId, params.coachId),
      eq5(clientCheckIns.clientName, params.clientName),
      eq5(clientCheckIns.dayOfWeek, params.dayOfWeek),
      eq5(clientCheckIns.weekStart, params.weekStart)
    )
  ).limit(1);
  if (existing.length > 0) {
    if (!existing[0].clientSubmitted) {
      await db2.update(clientCheckIns).set({ clientSubmitted: true, clientSubmittedAt: /* @__PURE__ */ new Date() }).where(
        and3(
          eq5(clientCheckIns.coachId, params.coachId),
          eq5(clientCheckIns.clientName, params.clientName),
          eq5(clientCheckIns.dayOfWeek, params.dayOfWeek),
          eq5(clientCheckIns.weekStart, params.weekStart)
        )
      );
    }
  } else {
    await db2.insert(clientCheckIns).values({
      coachId: params.coachId,
      coachName: params.coachName,
      clientName: params.clientName,
      dayOfWeek: params.dayOfWeek,
      weekStart: params.weekStart,
      completedByUserId: 0,
      // 0 = not yet completed by coach
      clientSubmitted: true,
      clientSubmittedAt: /* @__PURE__ */ new Date()
    });
  }
}
function registerTypeformWebhook(app) {
  app.post(
    "/api/webhooks/typeform",
    // Parse body as raw Buffer for signature verification
    (req, res, next) => {
      let data = Buffer.alloc(0);
      req.on("data", (chunk) => {
        data = Buffer.concat([data, chunk]);
      });
      req.on("end", () => {
        req.rawBody = data;
        next();
      });
    },
    async (req, res) => {
      try {
        const rawBody = req.rawBody;
        if (!rawBody) {
          res.status(400).json({ error: "No body" });
          return;
        }
        const secret = ENV.typeformWebhookSecret;
        if (secret) {
          const signature = req.headers["typeform-signature"];
          if (!signature) {
            console.warn("[Webhook] Missing typeform-signature header");
            res.status(401).json({ error: "Missing signature" });
            return;
          }
          const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
          if (signature !== expected) {
            console.warn("[Webhook] Invalid typeform-signature");
            res.status(401).json({ error: "Invalid signature" });
            return;
          }
        }
        let payload;
        try {
          payload = JSON.parse(rawBody.toString("utf8"));
        } catch {
          res.status(400).json({ error: "Invalid JSON" });
          return;
        }
        const formId = payload.form_response?.form_id;
        const submittedAt = payload.form_response?.submitted_at;
        const answers = payload.form_response?.answers ?? [];
        if (!formId || !submittedAt) {
          res.status(400).json({ error: "Missing form_id or submitted_at" });
          return;
        }
        const coachName = FORM_TO_COACH[formId];
        if (!coachName) {
          res.status(200).json({ ok: true, skipped: true });
          return;
        }
        let firstName = "";
        let lastName = "";
        for (const ans of answers) {
          if (ans.type === "short_text" && !firstName) {
            firstName = (ans.text ?? "").trim();
          } else if (ans.type === "short_text" && firstName && !lastName) {
            lastName = (ans.text ?? "").trim();
            break;
          }
        }
        const submittedName = `${firstName} ${lastName}`.trim();
        if (!submittedName) {
          console.warn("[Webhook] Could not extract client name from payload");
          res.status(200).json({ ok: true, skipped: true, reason: "no_name" });
          return;
        }
        const submittedDate = new Date(submittedAt);
        const weekStart = getAESTWeekStart(submittedDate);
        const dayOfWeek = getAESTDayOfWeek(submittedDate);
        if (!dayOfWeek) {
          console.log(`[Webhook] Saturday submission skipped for ${coachName}`);
          res.status(200).json({ ok: true, skipped: true, reason: "saturday" });
          return;
        }
        const db2 = await getDb();
        if (!db2) {
          res.status(500).json({ error: "Database unavailable" });
          return;
        }
        const coachRows = await db2.select().from(coaches).where(eq5(coaches.name, coachName)).limit(1);
        if (!coachRows.length) {
          console.warn(`[Webhook] Coach not found in DB: ${coachName}`);
          res.status(200).json({ ok: true, skipped: true, reason: "coach_not_found" });
          return;
        }
        const coach = coachRows[0];
        const rosterClients = await fetchRosterClients(coachName);
        let bestScore = 0;
        let matched = null;
        for (const entry of rosterClients) {
          const score = matchScore(submittedName, entry.clientName);
          if (score > bestScore) {
            const dayBonus = entry.day === dayOfWeek ? 5 : 0;
            if (score + dayBonus > bestScore) {
              bestScore = score + dayBonus;
              matched = entry;
            }
          }
        }
        if (bestScore < 50) matched = null;
        if (!matched) {
          console.warn(`[Webhook] No roster match for "${submittedName}" (coach: ${coachName}, day: ${dayOfWeek})`);
          res.status(200).json({ ok: true, skipped: true, reason: "no_roster_match", name: submittedName });
          return;
        }
        await markClientSubmitted({
          coachId: coach.id,
          coachName: coach.name,
          clientName: matched.clientName,
          dayOfWeek: matched.day,
          weekStart
        });
        console.log(`[Webhook] Marked submitted: ${matched.clientName} (${coachName}, ${matched.day}, week ${weekStart})`);
        res.status(200).json({ ok: true, clientName: matched.clientName, day: matched.day, weekStart });
      } catch (err) {
        console.error("[Webhook] Unexpected error:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );
}

// server/weeklySummaryPdf.ts
import PDFDocument from "pdfkit";
var DARK_BG = "#0f172a";
var CARD_BG = "#1e293b";
var BORDER = "#334155";
var TEXT_PRIMARY = "#f1f5f9";
var TEXT_SECONDARY = "#94a3b8";
var TEXT_MUTED = "#64748b";
var GREEN = "#10b981";
var AMBER = "#f59e0b";
var RED = "#ef4444";
var BLUE = "#3b82f6";
function engColor(pct) {
  if (pct >= 80) return GREEN;
  if (pct >= 60) return AMBER;
  return RED;
}
async function generateWeeklySummaryPdf(data, weekLabel) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      info: {
        Title: `Weekly Summary \u2014 ${weekLabel}`,
        Author: "Coach Check-In Tracker"
      }
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const marginL = 40;
    const marginR = 40;
    const contentW = pageW - marginL - marginR;
    doc.rect(0, 0, pageW, pageH).fill(DARK_BG);
    let y = 40;
    doc.rect(marginL, y, contentW, 56).fill(CARD_BG).stroke(BORDER);
    doc.fillColor(TEXT_PRIMARY).fontSize(18).font("Helvetica-Bold").text("Weekly Summary Report", marginL + 16, y + 10, { width: contentW - 32 });
    doc.fillColor(TEXT_MUTED).fontSize(10).font("Helvetica").text(weekLabel, marginL + 16, y + 34);
    const generatedOn = (/* @__PURE__ */ new Date()).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
    doc.fillColor(TEXT_MUTED).fontSize(9).font("Helvetica").text(`Generated ${generatedOn}`, marginL + 16, y + 46, { width: contentW - 32, align: "right" });
    y += 68;
    const cardW = (contentW - 16) / 3;
    const cardH = 60;
    const kpis = [
      {
        label: "Check-ins Completed",
        value: `${data.totalCompleted}`,
        sub: `of ${data.totalScheduled} scheduled`,
        accent: BLUE
      },
      {
        label: "Overall Engagement",
        value: `${data.overallEngagementPct}%`,
        sub: data.engagementTrend !== null ? `${data.engagementTrend >= 0 ? "+" : ""}${data.engagementTrend}% vs prev week` : "vs prev week",
        accent: engColor(data.overallEngagementPct)
      },
      {
        label: "Disengaged Clients",
        value: `${data.disengagedThisWeek.length}`,
        sub: data.disengagedTrend !== null ? `${data.disengagedTrend < 0 ? Math.abs(data.disengagedTrend) + " fewer" : data.disengagedTrend > 0 ? data.disengagedTrend + " more" : "same"} than last week` : "missed this week",
        accent: data.disengagedThisWeek.length === 0 ? GREEN : AMBER
      }
    ];
    kpis.forEach((kpi, i) => {
      const x = marginL + i * (cardW + 8);
      doc.rect(x, y, cardW, cardH).fill(CARD_BG).stroke(BORDER);
      doc.rect(x, y, 3, cardH).fill(kpi.accent);
      doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica").text(kpi.label.toUpperCase(), x + 10, y + 10, { width: cardW - 14 });
      doc.fillColor(kpi.accent).fontSize(22).font("Helvetica-Bold").text(kpi.value, x + 10, y + 22, { width: cardW - 14 });
      doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica").text(kpi.sub, x + 10, y + 46, { width: cardW - 14 });
    });
    y += cardH + 16;
    function sectionHeader(title, subtitle) {
      doc.fillColor(TEXT_PRIMARY).fontSize(11).font("Helvetica-Bold").text(title, marginL, y);
      if (subtitle) {
        doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica").text(subtitle, marginL, y + 14, { width: contentW });
        y += 28;
      } else {
        y += 18;
      }
    }
    function drawTable(headers, rows, colWidths, opts = {}) {
      const rowH = 18;
      const headerH = 20;
      const totalW = colWidths.reduce((a, b) => a + b, 0);
      doc.rect(marginL, y, totalW, headerH).fill(CARD_BG).stroke(BORDER);
      let cx = marginL;
      headers.forEach((h, i) => {
        doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica-Bold").text(h, cx + 6, y + 6, { width: colWidths[i] - 8, align: i === 0 ? "left" : "right" });
        cx += colWidths[i];
      });
      y += headerH;
      rows.forEach((row, ri) => {
        const isLast = ri === rows.length - 1 && opts.lastRowBold;
        const rowBg = isLast ? CARD_BG : ri % 2 === 0 ? DARK_BG : "#111827";
        doc.rect(marginL, y, totalW, rowH).fill(rowBg).stroke(BORDER);
        let cx2 = marginL;
        row.forEach((cell, ci) => {
          const isFirstCol = ci === 0;
          doc.fillColor(isLast ? TEXT_SECONDARY : TEXT_PRIMARY).fontSize(8).font(isLast ? "Helvetica-Bold" : "Helvetica").text(cell, cx2 + 6, y + 5, { width: colWidths[ci] - 8, align: isFirstCol ? "left" : "right" });
          cx2 += colWidths[ci];
        });
        y += rowH;
      });
      y += 8;
    }
    sectionHeader("Coach Activity", "Daily submissions and outreach messages sent this week.");
    const actHeaders = ["Coach", "Morning Reviews", "Follow-Up Days", "Follow-Up Msgs", "Disengagement Msgs"];
    const actColW = [contentW * 0.28, contentW * 0.18, contentW * 0.18, contentW * 0.18, contentW * 0.18];
    const actRows = data.coachActivity.map((c) => [
      c.coachName,
      `${c.morningDays} / ${c.workdayCount}`,
      `${c.followupDays}`,
      `${c.totalFollowupMsgs}`,
      `${c.totalDisengagementMsgs}`
    ]);
    drawTable(actHeaders, actRows, actColW);
    sectionHeader("Client Engagement by Coach", "Scheduled vs completed check-ins per coach this week.");
    const engHeaders = ["Coach", "Scheduled", "Completed", "Missed", "Engagement %"];
    const engColW = [contentW * 0.28, contentW * 0.18, contentW * 0.18, contentW * 0.18, contentW * 0.18];
    const activeEngStats = data.engagementStats.filter((e) => e.scheduled > 0);
    const engRows = [
      ...activeEngStats.map((e) => [
        e.coachName,
        `${e.scheduled}`,
        `${e.completed}`,
        `${e.missed}`,
        `${e.engagementPct}%`
      ]),
      ...activeEngStats.length > 0 ? [[
        "Total",
        `${data.totalScheduled}`,
        `${data.totalCompleted}`,
        `${data.totalScheduled - data.totalCompleted}`,
        `${data.overallEngagementPct}%`
      ]] : []
    ];
    drawTable(engHeaders, engRows, engColW, { lastRowBold: activeEngStats.length > 0 });
    const remainingSpace = pageH - y - 40;
    const disengagedH = Math.max(80, 20 + data.disengagedThisWeek.length * 16);
    const healthH = 100;
    const twoColH = Math.max(disengagedH, healthH);
    if (remainingSpace < twoColH + 40) {
      doc.addPage();
      doc.rect(0, 0, pageW, pageH).fill(DARK_BG);
      y = 40;
    }
    const colW2 = (contentW - 12) / 2;
    const disX = marginL;
    const healthX = marginL + colW2 + 12;
    const twoColY = y;
    doc.rect(disX, twoColY, colW2, 28).fill(CARD_BG).stroke(BORDER);
    doc.fillColor(TEXT_PRIMARY).fontSize(10).font("Helvetica-Bold").text("Disengaged Clients This Week", disX + 10, twoColY + 8, { width: colW2 - 60 });
    const disCount = data.disengagedThisWeek.length;
    doc.fillColor(disCount === 0 ? GREEN : AMBER).fontSize(14).font("Helvetica-Bold").text(`${disCount}`, disX + colW2 - 30, twoColY + 7, { width: 24, align: "right" });
    let disY = twoColY + 28;
    if (disCount === 0) {
      doc.rect(disX, disY, colW2, 28).fill(DARK_BG).stroke(BORDER);
      doc.fillColor(TEXT_MUTED).fontSize(9).font("Helvetica").text("No disengaged clients this week \u2713", disX + 10, disY + 9, { width: colW2 - 20, align: "center" });
      disY += 28;
    } else {
      const byCoach = {};
      const coachOrder = [];
      for (const c of data.disengagedThisWeek) {
        if (!byCoach[c.coachName]) {
          coachOrder.push(c.coachName);
          byCoach[c.coachName] = [];
        }
        byCoach[c.coachName].push(c);
      }
      for (const coachName of coachOrder) {
        const clients = byCoach[coachName].sort((a, b) => b.consecutiveMissed - a.consecutiveMissed);
        doc.rect(disX, disY, colW2, 16).fill(CARD_BG).stroke(BORDER);
        doc.fillColor(TEXT_SECONDARY).fontSize(8).font("Helvetica-Bold").text(coachName.toUpperCase(), disX + 10, disY + 4, { width: colW2 - 20 });
        disY += 16;
        for (const c of clients) {
          const bangs = "!".repeat(Math.min(c.consecutiveMissed, 4));
          const rowColor = c.consecutiveMissed >= 3 ? "#450a0a" : c.consecutiveMissed === 2 ? "#431407" : "#422006";
          doc.rect(disX, disY, colW2, 16).fill(rowColor).stroke(BORDER);
          const textColor = c.consecutiveMissed >= 3 ? "#fca5a5" : c.consecutiveMissed === 2 ? "#fdba74" : "#fde68a";
          doc.fillColor(textColor).fontSize(8).font("Helvetica").text(c.clientName, disX + 10, disY + 4, { width: colW2 - 40 });
          doc.fillColor(textColor).fontSize(9).font("Helvetica-Bold").text(bangs, disX + colW2 - 30, disY + 4, { width: 24, align: "right" });
          disY += 16;
        }
      }
    }
    const health = data.clientHealth;
    doc.rect(healthX, twoColY, colW2, 28).fill(CARD_BG).stroke(BORDER);
    doc.fillColor(TEXT_PRIMARY).fontSize(10).font("Helvetica-Bold").text("Client Health Snapshot", healthX + 10, twoColY + 8, { width: colW2 - 20 });
    let hY = twoColY + 28;
    doc.rect(healthX, hY, colW2, Math.max(disY - twoColY - 28, 80)).fill(DARK_BG).stroke(BORDER);
    hY += 10;
    if (health.total === 0) {
      doc.fillColor(TEXT_MUTED).fontSize(9).font("Helvetica").text("No ratings recorded yet.", healthX + 10, hY + 10, { width: colW2 - 20, align: "center" });
    } else {
      doc.fillColor(engColor(health.greenPct)).fontSize(26).font("Helvetica-Bold").text(`${health.greenPct}%`, healthX + 10, hY, { width: colW2 - 20 });
      doc.fillColor(TEXT_MUTED).fontSize(9).font("Helvetica").text("clients on track", healthX + 10, hY + 30, { width: colW2 - 20 });
      hY += 44;
      const barW = colW2 - 20;
      const barH = 8;
      doc.rect(healthX + 10, hY, barW, barH).fill(CARD_BG);
      const greenW = Math.round(health.green / health.total * barW);
      const yellowW = Math.round(health.yellow / health.total * barW);
      const redW = barW - greenW - yellowW;
      if (greenW > 0) doc.rect(healthX + 10, hY, greenW, barH).fill(GREEN);
      if (yellowW > 0) doc.rect(healthX + 10 + greenW, hY, yellowW, barH).fill(AMBER);
      if (redW > 0) doc.rect(healthX + 10 + greenW + yellowW, hY, redW, barH).fill(RED);
      hY += 14;
      const legend = [
        { color: GREEN, count: health.green, label: "On track" },
        { color: AMBER, count: health.yellow, label: "At risk" },
        { color: RED, count: health.red, label: "Needs attention" }
      ];
      legend.forEach((l) => {
        doc.circle(healthX + 16, hY + 4, 4).fill(l.color);
        doc.fillColor(TEXT_PRIMARY).fontSize(8).font("Helvetica-Bold").text(`${l.count}`, healthX + 24, hY, { width: 20 });
        doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica").text(l.label, healthX + 44, hY, { width: colW2 - 54 });
        hY += 14;
      });
      doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica").text(`${health.total} clients rated in total.`, healthX + 10, hY + 4, { width: colW2 - 20 });
    }
    y = Math.max(disY, twoColY + Math.max(disY - twoColY, 80 + 28)) + 16;
    if (y > pageH - 50) {
      doc.addPage();
      doc.rect(0, 0, pageW, pageH).fill(DARK_BG);
      y = pageH - 40;
    } else {
      y = pageH - 30;
    }
    doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica").text(`Coach Check-In Tracker \xB7 ${weekLabel}`, marginL, y, { width: contentW, align: "center" });
    doc.end();
  });
}

// server/weeklySummaryPdfRoute.ts
function registerWeeklySummaryPdfRoute(app) {
  app.get("/api/weekly-summary-pdf", async (req, res) => {
    try {
      let user;
      try {
        user = await authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const weekStart = req.query.weekStart ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
        res.status(400).json({ error: "Invalid weekStart parameter" });
        return;
      }
      const weekStartDate = /* @__PURE__ */ new Date(weekStart + "T00:00:00Z");
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 4);
      const weekEnd = weekEndDate.toISOString().slice(0, 10);
      const prevWeekStartDate = /* @__PURE__ */ new Date(weekStart + "T00:00:00");
      prevWeekStartDate.setDate(prevWeekStartDate.getDate() - 7);
      const prevWeekStart = prevWeekStartDate.toISOString().slice(0, 10);
      const prevWeekEndDate = new Date(prevWeekStartDate);
      prevWeekEndDate.setDate(prevWeekStartDate.getDate() + 4);
      const prevWeekEnd = prevWeekEndDate.toISOString().slice(0, 10);
      const allCoachesRaw = await getAllCoaches();
      const activeCoaches = allCoachesRaw.filter((c) => c.isActive);
      const [checkinRecords2, allRatings, disengagedAll, rosters, allCompletions, allPauses, prevCompletions, prevDisengagedAll, weekExcuses] = await Promise.all([
        getCheckinRecordsByDateRange(weekStart, weekEnd),
        getAllPerformanceRatings(),
        Promise.all(activeCoaches.map((c) => computeDisengagedClients(c.id, c.name, weekStart))).then((r) => r.flat()),
        Promise.all(activeCoaches.map(async (coach) => {
          try {
            const days = await fetchRosterForCoach(coach.name);
            return { coachId: coach.id, coachName: coach.name, roster: { days } };
          } catch {
            return { coachId: coach.id, coachName: coach.name, roster: null };
          }
        })),
        getAllClientCheckInsByWeekRange([weekStart]),
        getAllActivePauses(),
        getAllClientCheckInsByWeekRange([prevWeekStart]),
        Promise.all(activeCoaches.map((c) => computeDisengagedClients(c.id, c.name, prevWeekStart))).then((r) => r.flat()),
        getAllApprovedExcusesForWeeks([weekStart, prevWeekStart])
      ]);
      const coachActivityMap = /* @__PURE__ */ new Map();
      for (const coach of activeCoaches) {
        let workdays = [1, 2, 3, 4, 5];
        if (coach.workdays) {
          try {
            workdays = JSON.parse(coach.workdays);
          } catch {
          }
        }
        const workdayCount = workdays.filter((d) => d >= 1 && d <= 5).length;
        coachActivityMap.set(coach.id, {
          coachId: coach.id,
          coachName: coach.name,
          workdayCount,
          morningDays: 0,
          followupDays: 0,
          disengagementDays: 0,
          avgMoodScore: null,
          totalFollowupMsgs: 0,
          totalDisengagementMsgs: 0
        });
      }
      for (const r of checkinRecords2) {
        const entry = coachActivityMap.get(r.coachId);
        if (!entry) continue;
        if (r.submissionType === "morning") entry.morningDays++;
        else if (r.submissionType === "followup") {
          entry.followupDays++;
          entry.totalFollowupMsgs += r.followupMessagesSent ?? 0;
        } else if (r.submissionType === "disengagement") {
          entry.disengagementDays++;
          entry.totalDisengagementMsgs += r.disengagementMessagesSent ?? 0;
        }
      }
      for (const [coachId, entry] of Array.from(coachActivityMap)) {
        const coachMoods = checkinRecords2.filter((r) => r.coachId === coachId && r.submissionType === "morning" && r.moodScore !== null).map((r) => r.moodScore);
        entry.avgMoodScore = coachMoods.length > 0 ? Math.round(coachMoods.reduce((a, b) => a + b, 0) / coachMoods.length * 10) / 10 : null;
      }
      const coachActivity = Array.from(coachActivityMap.values());
      const completedSet = new Set(
        allCompletions.filter((c) => c.completedByUserId !== 0 || c.clientSubmitted).map((c) => `${c.coachId}|${c.clientName}|${c.dayOfWeek}|${c.weekStart}`)
      );
      const pausedSet = new Set(allPauses.map((p) => `${p.coachId}|${p.clientName.toLowerCase().trim()}`));
      const weekExcuseSet = new Set(
        weekExcuses.filter((e) => e.weekStart === weekStart).map((e) => `${e.coachId}|${e.clientName}|${e.dayOfWeek}|${e.weekStart}`)
      );
      const prevWeekExcuseSet = new Set(
        weekExcuses.filter((e) => e.weekStart === prevWeekStart).map((e) => `${e.coachId}|${e.clientName}|${e.dayOfWeek}|${e.weekStart}`)
      );
      const todayStr = getMelbourneNow().toISOString().slice(0, 10);
      const engagementMap = /* @__PURE__ */ new Map();
      for (const coach of activeCoaches) engagementMap.set(coach.id, { scheduled: 0, completed: 0 });
      const DAYS_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday"];
      for (const { coachId, roster } of rosters) {
        if (!roster) continue;
        const entry = engagementMap.get(coachId);
        if (!entry) continue;
        const weekDate = /* @__PURE__ */ new Date(weekStart + "T00:00:00");
        for (const [day, clients] of Object.entries(roster.days)) {
          const dayOffset = DAYS_ORDER.indexOf(day);
          const dayDate = new Date(weekDate);
          dayDate.setDate(weekDate.getDate() + dayOffset);
          const dateStr = dayDate.toISOString().slice(0, 10);
          if (dateStr > todayStr) continue;
          for (const clientName of clients) {
            if (pausedSet.has(`${coachId}|${clientName.toLowerCase().trim()}`)) continue;
            if (weekExcuseSet.has(`${coachId}|${clientName}|${day}|${weekStart}`)) continue;
            entry.scheduled++;
            if (completedSet.has(`${coachId}|${clientName}|${day}|${weekStart}`)) entry.completed++;
          }
        }
      }
      const engagementStats = Array.from(engagementMap.entries()).map(([coachId, e]) => ({
        coachId,
        coachName: allCoachesRaw.find((c) => c.id === coachId)?.name ?? `Coach #${coachId}`,
        scheduled: e.scheduled,
        completed: e.completed,
        missed: e.scheduled - e.completed,
        engagementPct: e.scheduled > 0 ? Math.round(e.completed / e.scheduled * 1e3) / 10 : 0
      }));
      const totalScheduled = engagementStats.reduce((s, e) => s + e.scheduled, 0);
      const totalCompleted = engagementStats.reduce((s, e) => s + e.completed, 0);
      const overallEngagementPct = totalScheduled > 0 ? Math.round(totalCompleted / totalScheduled * 1e3) / 10 : 0;
      const totalGreen = allRatings.filter((r) => r.rating === "green").length;
      const totalYellow = allRatings.filter((r) => r.rating === "yellow").length;
      const totalRed = allRatings.filter((r) => r.rating === "red").length;
      const totalRated = allRatings.length;
      const greenPct = totalRated > 0 ? Math.round(totalGreen / totalRated * 1e3) / 10 : 0;
      const disengagedThisWeek = disengagedAll.filter((c) => c.lastMissedWeek === weekStart).map((c) => ({ clientName: c.clientName, coachName: c.coachName, consecutiveMissed: c.consecutiveMissed })).sort((a, b) => b.consecutiveMissed - a.consecutiveMissed || a.coachName.localeCompare(b.coachName));
      const prevCompletedSet = new Set(
        prevCompletions.filter((c) => c.completedByUserId !== 0 || c.clientSubmitted).map((c) => `${c.coachId}|${c.clientName}|${c.dayOfWeek}|${c.weekStart}`)
      );
      let prevTotalScheduled = 0;
      let prevTotalCompleted = 0;
      for (const { coachId, roster } of rosters) {
        if (!roster) continue;
        const prevWeekDate = /* @__PURE__ */ new Date(prevWeekStart + "T00:00:00");
        for (const [day, clients] of Object.entries(roster.days)) {
          const dayOffset = DAYS_ORDER.indexOf(day);
          const dayDate = new Date(prevWeekDate);
          dayDate.setDate(prevWeekDate.getDate() + dayOffset);
          const dateStr = dayDate.toISOString().slice(0, 10);
          if (dateStr > prevWeekEnd) continue;
          for (const clientName of clients) {
            if (pausedSet.has(`${coachId}|${clientName.toLowerCase().trim()}`)) continue;
            if (prevWeekExcuseSet.has(`${coachId}|${clientName}|${day}|${prevWeekStart}`)) continue;
            prevTotalScheduled++;
            if (prevCompletedSet.has(`${coachId}|${clientName}|${day}|${prevWeekStart}`)) prevTotalCompleted++;
          }
        }
      }
      const prevOverallEngagementPct = prevTotalScheduled > 0 ? Math.round(prevTotalCompleted / prevTotalScheduled * 1e3) / 10 : null;
      const prevDisengagedCount = prevDisengagedAll.filter((c) => c.lastMissedWeek === prevWeekStart).reduce((acc, c) => {
        const key = `${c.clientName}|${c.coachName}`;
        if (!acc.has(key)) acc.set(key, true);
        return acc;
      }, /* @__PURE__ */ new Map()).size;
      const engagementTrend = prevOverallEngagementPct !== null ? Math.round((overallEngagementPct - prevOverallEngagementPct) * 10) / 10 : null;
      const disengagedTrend = prevDisengagedCount !== null ? disengagedThisWeek.length - prevDisengagedCount : null;
      const startD = /* @__PURE__ */ new Date(weekStart + "T00:00:00Z");
      const endD = /* @__PURE__ */ new Date(weekEnd + "T00:00:00Z");
      const fmt = (d) => d.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });
      const weekLabel = `${fmt(startD)} \u2013 ${fmt(endD)}`;
      const summaryData = {
        weekStart,
        weekEnd,
        coachActivity,
        engagementStats,
        totalScheduled,
        totalCompleted,
        overallEngagementPct,
        clientHealth: { green: totalGreen, yellow: totalYellow, red: totalRed, total: totalRated, greenPct },
        disengagedThisWeek,
        avgMoodScore: null,
        activeCoachCount: activeCoaches.length,
        engagementTrend,
        disengagedTrend,
        prevWeekStart,
        prevOverallEngagementPct,
        prevDisengagedCount
      };
      const pdfBuffer = await generateWeeklySummaryPdf(summaryData, weekLabel);
      const filename = `Weekly_Summary_${weekStart}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err) {
      console.error("[PDF Export] Error:", err);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });
}

// server/weeklySnapshot.ts
import { eq as eq6, and as and4, isNull as isNull2 } from "drizzle-orm";
function getMonday3(dateStr) {
  const d = /* @__PURE__ */ new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getTodayMelbourne2() {
  const now = /* @__PURE__ */ new Date();
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(now);
}
async function snapshotCurrentWeek() {
  const db2 = await getDb();
  if (!db2) {
    console.warn("[Snapshot] Database not available \u2014 skipping");
    return;
  }
  const today = getTodayMelbourne2();
  const weekStart = getMonday3(today);
  console.log(`[Snapshot] Snapshotting week ${weekStart}...`);
  const coachList = await db2.select({ id: coaches.id, name: coaches.name }).from(coaches).where(eq6(coaches.isActive, 1));
  for (const coach of coachList) {
    const roster = await fetchRosterForCoach(coach.name);
    const paused = await db2.select().from(pausedClients).where(and4(eq6(pausedClients.coachId, coach.id), isNull2(pausedClients.resumedAt)));
    const pausedSet = new Set(paused.map((p) => p.clientName));
    let scheduled = 0;
    for (const day of DAYS2) {
      scheduled += (roster[day] ?? []).filter((c) => !pausedSet.has(c)).length;
    }
    const completions = await db2.select().from(clientCheckIns).where(and4(eq6(clientCheckIns.coachId, coach.id), eq6(clientCheckIns.weekStart, weekStart)));
    const completed = completions.filter((c) => c.completedAt != null).length;
    const clientSubmitted = completions.filter((c) => c.clientSubmitted === 1).length;
    const excuses = await db2.select().from(excusedClients).where(and4(eq6(excusedClients.coachId, coach.id), eq6(excusedClients.weekStart, weekStart), eq6(excusedClients.status, "approved")));
    const excusedCount = excuses.length;
    const effectiveScheduled = Math.max(scheduled - excusedCount, 0);
    const engagementPct = effectiveScheduled > 0 ? Math.round(completed / effectiveScheduled * 1e3) / 10 : 0;
    const snap = {
      scheduled,
      completed,
      excused: excusedCount,
      clientSubmitted,
      missed: scheduled - completed,
      engagementPct,
      source: "auto-snapshot"
    };
    const existing = await db2.select().from(rosterWeeklySnapshots).where(and4(eq6(rosterWeeklySnapshots.coachId, coach.id), eq6(rosterWeeklySnapshots.weekStart, weekStart))).limit(1);
    if (existing.length > 0) {
      await db2.update(rosterWeeklySnapshots).set({ snapshotJson: snap }).where(eq6(rosterWeeklySnapshots.id, existing[0].id));
    } else {
      await db2.insert(rosterWeeklySnapshots).values({
        coachId: coach.id,
        coachName: coach.name,
        weekStart,
        snapshotJson: snap
      });
    }
    console.log(`[Snapshot] ${coach.name}: ${completed}/${scheduled} (${engagementPct}%)`);
  }
  console.log(`[Snapshot] Week ${weekStart} snapshot complete.`);
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express();
  const server = createServer(app);
  registerTypeformWebhook(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  await registerAuthRoutes(app);
  registerWeeklySummaryPdfRoute(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app);
  } else {
    await serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
  setInterval(() => {
    runReminderTick().catch((err) => console.error("[Slack Reminders] tick error:", err));
    runSalesReminderTick().catch((err) => console.error("[Slack Sales Reminders] tick error:", err));
  }, 60 * 1e3);
  setInterval(() => {
    runTypeformBackfill().catch((err) => console.error("[Typeform Sync] error:", err));
  }, 60 * 1e3);
  setTimeout(() => {
    runTypeformBackfill().catch((err) => console.error("[Typeform Sync] startup error:", err));
  }, 10 * 1e3);
  setInterval(() => {
    const now = /* @__PURE__ */ new Date();
    const aestParts = new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Melbourne",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(now);
    const weekday = aestParts.find((p) => p.type === "weekday")?.value;
    const hour = aestParts.find((p) => p.type === "hour")?.value;
    const minute = aestParts.find((p) => p.type === "minute")?.value;
    const minuteInt = minute ? parseInt(minute) : -1;
    if (weekday === "Mon" && hour === "08" && minuteInt < 5) {
      sendWeeklySummary().catch((err) => console.error("[Slack Weekly] error:", err));
      sendDisengagementAlert().catch((err) => console.error("[Slack Disengagement] error:", err));
      sendFortnightlyPerformanceReviewReminder().catch((err) => console.error("[Slack Fortnightly] error:", err));
    }
    if (weekday === "Mon" && hour === "09" && minuteInt < 5) {
      sendFortnightlySweepReportReminder().catch((err) => console.error("[Slack Sweep Reminder] error:", err));
    }
    if (weekday === "Fri" && hour === "20" && minuteInt < 5) {
      sendFridayWeeklySummary().catch((err) => console.error("[Slack Friday Summary] error:", err));
    }
    if (weekday === "Sun" && hour === "23" && minuteInt >= 55) {
      snapshotCurrentWeek().catch((err) => console.error("[Snapshot] error:", err));
    }
  }, 5 * 60 * 1e3);
}
startServer().catch(console.error);
