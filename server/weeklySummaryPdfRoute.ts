/**
 * Express route: GET /api/weekly-summary-pdf?weekStart=YYYY-MM-DD
 * Generates and streams a PDF of the weekly summary report.
 * Requires a valid session (admin/owner only).
 */

import type { Express, Request, Response } from "express";
import { authenticateRequest } from "./_core/auth";
import { generateWeeklySummaryPdf } from "./weeklySummaryPdf";
import {
  getAllCoaches,
  getAllPerformanceRatings,
  getCheckinRecordsByDateRange,
  getAllClientCheckInsByWeekRange,
  getAllActivePauses,
  getAllApprovedExcusesForWeeks,
} from "./db";
import { fetchCoachRoster, computeDisengagedClients, getMelbourneNow } from "./routers";

export function registerWeeklySummaryPdfRoute(app: Express) {
  app.get("/api/weekly-summary-pdf", async (req: Request, res: Response) => {
    try {
      // Auth check — require a valid session
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

      const weekStart = (req.query.weekStart as string) ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
        res.status(400).json({ error: "Invalid weekStart parameter" });
        return;
      }

      // Compute week range
      const weekStartDate = new Date(weekStart + "T00:00:00Z");
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 4);
      const weekEnd = weekEndDate.toISOString().slice(0, 10);

      const prevWeekStartDate = new Date(weekStart + "T00:00:00");
      prevWeekStartDate.setDate(prevWeekStartDate.getDate() - 7);
      const prevWeekStart = prevWeekStartDate.toISOString().slice(0, 10);
      const prevWeekEndDate = new Date(prevWeekStartDate);
      prevWeekEndDate.setDate(prevWeekStartDate.getDate() + 4);
      const prevWeekEnd = prevWeekEndDate.toISOString().slice(0, 10);

      // Fetch data (same as getWeeklySummary procedure)
      const allCoachesRaw = await getAllCoaches();
      const activeCoaches = allCoachesRaw.filter(c => c.isActive);

      const [checkinRecords, allRatings, disengagedAll, rosters, allCompletions, allPauses, prevCompletions, prevDisengagedAll, weekExcuses] = await Promise.all([
        getCheckinRecordsByDateRange(weekStart, weekEnd),
        getAllPerformanceRatings(),
        Promise.all(activeCoaches.map(c => computeDisengagedClients(c.id, c.name, weekStart))).then(r => r.flat()),
        Promise.all(activeCoaches.map(async (coach) => {
          try {
            const days = await fetchCoachRoster(coach.name);
            return { coachId: coach.id, coachName: coach.name, roster: { days } };
          } catch {
            return { coachId: coach.id, coachName: coach.name, roster: null };
          }
        })),
        getAllClientCheckInsByWeekRange([weekStart]),
        getAllActivePauses(),
        getAllClientCheckInsByWeekRange([prevWeekStart]),
        Promise.all(activeCoaches.map(c => computeDisengagedClients(c.id, c.name, prevWeekStart))).then(r => r.flat()),
        getAllApprovedExcusesForWeeks([weekStart, prevWeekStart]),
      ]);

      // Coach Activity
      const coachActivityMap = new Map<number, {
        coachId: number; coachName: string; workdayCount: number;
        morningDays: number; followupDays: number; disengagementDays: number;
        avgMoodScore: number | null; totalFollowupMsgs: number; totalDisengagementMsgs: number;
      }>();
      for (const coach of activeCoaches) {
        let workdays: number[] = [1, 2, 3, 4, 5];
        if (coach.workdays) {
          try { workdays = JSON.parse(coach.workdays) as number[]; } catch { /* use default */ }
        }
        const workdayCount = workdays.filter(d => d >= 1 && d <= 5).length;
        coachActivityMap.set(coach.id, {
          coachId: coach.id, coachName: coach.name, workdayCount,
          morningDays: 0, followupDays: 0, disengagementDays: 0,
          avgMoodScore: null, totalFollowupMsgs: 0, totalDisengagementMsgs: 0,
        });
      }
      for (const r of checkinRecords) {
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
        const coachMoods = checkinRecords
          .filter(r => r.coachId === coachId && r.submissionType === "morning" && r.moodScore !== null)
          .map(r => r.moodScore as number);
        entry.avgMoodScore = coachMoods.length > 0
          ? Math.round((coachMoods.reduce((a, b) => a + b, 0) / coachMoods.length) * 10) / 10
          : null;
      }
      const coachActivity = Array.from(coachActivityMap.values());

      // Engagement stats
      const completedSet = new Set(
        allCompletions
          .filter(c => c.completedByUserId !== 0 || c.clientSubmitted)
          .map(c => `${c.coachId}|${c.clientName}|${c.dayOfWeek}|${c.weekStart}`)
      );
      const pausedSet = new Set(allPauses.map(p => `${p.coachId}|${p.clientName.toLowerCase().trim()}`));
      const weekExcuseSet = new Set(
        weekExcuses.filter(e => e.weekStart === weekStart)
          .map(e => `${e.coachId}|${e.clientName}|${e.dayOfWeek}|${e.weekStart}`)
      );
      const prevWeekExcuseSet = new Set(
        weekExcuses.filter(e => e.weekStart === prevWeekStart)
          .map(e => `${e.coachId}|${e.clientName}|${e.dayOfWeek}|${e.weekStart}`)
      );
      const todayStr = getMelbourneNow().toISOString().slice(0, 10);
      const engagementMap = new Map<number, { scheduled: number; completed: number }>();
      for (const coach of activeCoaches) engagementMap.set(coach.id, { scheduled: 0, completed: 0 });
      const DAYS_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday"];
      for (const { coachId, roster } of rosters) {
        if (!roster) continue;
        const entry = engagementMap.get(coachId);
        if (!entry) continue;
        const weekDate = new Date(weekStart + "T00:00:00");
        for (const [day, clients] of Object.entries(roster.days) as [string, string[]][]) {
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
        coachName: allCoachesRaw.find(c => c.id === coachId)?.name ?? `Coach #${coachId}`,
        scheduled: e.scheduled,
        completed: e.completed,
        missed: e.scheduled - e.completed,
        engagementPct: e.scheduled > 0 ? Math.round((e.completed / e.scheduled) * 1000) / 10 : 0,
      }));
      const totalScheduled = engagementStats.reduce((s, e) => s + e.scheduled, 0);
      const totalCompleted = engagementStats.reduce((s, e) => s + e.completed, 0);
      const overallEngagementPct = totalScheduled > 0
        ? Math.round((totalCompleted / totalScheduled) * 1000) / 10 : 0;

      // Client health
      const totalGreen = allRatings.filter(r => r.rating === "green").length;
      const totalYellow = allRatings.filter(r => r.rating === "yellow").length;
      const totalRed = allRatings.filter(r => r.rating === "red").length;
      const totalRated = allRatings.length;
      const greenPct = totalRated > 0 ? Math.round((totalGreen / totalRated) * 1000) / 10 : 0;

      // Disengaged
      const disengagedThisWeek = disengagedAll
        .filter(c => c.lastMissedWeek === weekStart)
        .map(c => ({ clientName: c.clientName, coachName: c.coachName, consecutiveMissed: c.consecutiveMissed }))
        .sort((a, b) => b.consecutiveMissed - a.consecutiveMissed || a.coachName.localeCompare(b.coachName));

      // Trends
      const prevCompletedSet = new Set(
        prevCompletions.filter(c => c.completedByUserId !== 0 || c.clientSubmitted)
          .map(c => `${c.coachId}|${c.clientName}|${c.dayOfWeek}|${c.weekStart}`)
      );
      let prevTotalScheduled = 0;
      let prevTotalCompleted = 0;
      for (const { coachId, roster } of rosters) {
        if (!roster) continue;
        const prevWeekDate = new Date(prevWeekStart + "T00:00:00");
        for (const [day, clients] of Object.entries(roster.days) as [string, string[]][]) {
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
      const prevOverallEngagementPct = prevTotalScheduled > 0
        ? Math.round((prevTotalCompleted / prevTotalScheduled) * 1000) / 10 : null;
      const prevDisengagedCount = prevDisengagedAll
        .filter(c => c.lastMissedWeek === prevWeekStart)
        .reduce((acc, c) => {
          const key = `${c.clientName}|${c.coachName}`;
          if (!acc.has(key)) acc.set(key, true);
          return acc;
        }, new Map<string, boolean>()).size;
      const engagementTrend = prevOverallEngagementPct !== null
        ? Math.round((overallEngagementPct - prevOverallEngagementPct) * 10) / 10 : null;
      const disengagedTrend = prevDisengagedCount !== null
        ? disengagedThisWeek.length - prevDisengagedCount : null;

      // Build week label
      const startD = new Date(weekStart + "T00:00:00Z");
      const endD = new Date(weekEnd + "T00:00:00Z");
      const fmt = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });
      const weekLabel = `${fmt(startD)} – ${fmt(endD)}`;

      const summaryData = {
        weekStart, weekEnd, coachActivity, engagementStats,
        totalScheduled, totalCompleted, overallEngagementPct,
        clientHealth: { green: totalGreen, yellow: totalYellow, red: totalRed, total: totalRated, greenPct },
        disengagedThisWeek,
        avgMoodScore: null,
        activeCoachCount: activeCoaches.length,
        engagementTrend, disengagedTrend,
        prevWeekStart, prevOverallEngagementPct, prevDisengagedCount,
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
