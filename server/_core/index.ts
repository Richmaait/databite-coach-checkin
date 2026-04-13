import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes } from "./auth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { runReminderTick, runSalesReminderTick, sendFortnightlyPerformanceReviewReminder, sendFortnightlySweepReportReminder } from "../slackReminders";
import { sendWeeklySummary } from "../slackWeeklySummary";
import { sendDisengagementAlert } from "../slackDisengagementAlert";
import { sendFridayWeeklySummary } from "../slackFridaySummary";
import { registerTypeformWebhook } from "../typeformWebhook";
import { runTypeformBackfill } from "../typeformBackfill";
import { registerWeeklySummaryPdfRoute } from "../weeklySummaryPdfRoute";
import { snapshotCurrentWeek } from "../weeklySnapshot";
import { sendFridayAudit, checkMissedAudits } from "../slackFridayAudit";
import { sendMondayDigest } from "../slackMondayDigest";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
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

  // Register Typeform webhook BEFORE express.json() so we can read raw body for HMAC verification
  registerTypeformWebhook(app);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Auth routes (login, logout, me)
  await registerAuthRoutes(app);

  // Weekly Summary PDF export
  registerWeeklySummaryPdfRoute(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Development mode uses Vite, production mode uses static files
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

  // Slack reminder cron — fires every minute, checks per-coach timezone + workday + time
  setInterval(() => {
    runReminderTick().catch(err => console.error("[Slack Reminders] tick error:", err));
    runSalesReminderTick().catch(err => console.error("[Slack Sales Reminders] tick error:", err));
  }, 60 * 1000);

  // Typeform sync — runs every minute to pick up client submissions
  setInterval(() => {
    runTypeformBackfill().catch(err => console.error("[Typeform Sync] error:", err));
  }, 60 * 1000);
  // Also run once on startup
  setTimeout(() => {
    runTypeformBackfill().catch(err => console.error("[Typeform Sync] startup error:", err));
  }, 10 * 1000);

  // Monday / Friday Slack alerts — fires every 5 minutes, checks AEST day + time
  setInterval(() => {
    const now = new Date();
    const aestParts = new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Melbourne",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const weekday = aestParts.find(p => p.type === "weekday")?.value;
    const hour = aestParts.find(p => p.type === "hour")?.value;
    const minute = aestParts.find(p => p.type === "minute")?.value;
    const minuteInt = minute ? parseInt(minute) : -1;

    // Monday 08:00 AEST — consolidated digest (replaces separate summary/disengagement/fortnightly messages)
    if (weekday === "Mon" && hour === "08" && minuteInt < 5) {
      sendMondayDigest().catch(err => console.error("[Monday Digest] error:", err));
    }

    // Weekday 14:30 AEST — quality audit (fires on each coach's last workday)
    if (["Mon","Tue","Wed","Thu","Fri"].includes(weekday ?? "") && hour === "14" && minuteInt >= 25 && minuteInt < 35) {
      sendFridayAudit().catch(err => console.error("[Weekly Audit] error:", err));
    }

    // Friday 20:00 AEST — current-week client check-in summary
    if (weekday === "Fri" && hour === "20" && minuteInt < 5) {
      sendFridayWeeklySummary().catch(err => console.error("[Slack Friday Summary] error:", err));
    }

    // Weekday 20:00 AEST — missed audit check (fires on each coach's last workday)
    if (["Mon","Tue","Wed","Thu","Fri"].includes(weekday ?? "") && hour === "20" && minuteInt < 5) {
      checkMissedAudits().catch(err => console.error("[Weekly Audit] missed check error:", err));
    }

    // Sunday 23:59 AEST — snapshot the current week's roster stats
    if (weekday === "Sun" && hour === "23" && minuteInt >= 55) {
      snapshotCurrentWeek().catch(err => console.error("[Snapshot] error:", err));
    }
  }, 5 * 60 * 1000);
}

startServer().catch(console.error);
