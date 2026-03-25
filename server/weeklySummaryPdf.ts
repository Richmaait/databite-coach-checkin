/**
 * Server-side PDF generation for the Weekly Summary report.
 * Uses pdfkit to build a clean A4 PDF from the getWeeklySummary data.
 */

import PDFDocument from "pdfkit";

type WeeklySummaryData = {
  weekStart: string;
  weekEnd: string;
  coachActivity: Array<{
    coachId: number;
    coachName: string;
    workdayCount: number;
    morningDays: number;
    followupDays: number;
    disengagementDays: number;
    avgMoodScore: number | null;
    totalFollowupMsgs: number;
    totalDisengagementMsgs: number;
  }>;
  engagementStats: Array<{
    coachId: number;
    coachName: string;
    scheduled: number;
    completed: number;
    missed: number;
    engagementPct: number;
  }>;
  totalScheduled: number;
  totalCompleted: number;
  overallEngagementPct: number;
  clientHealth: { green: number; yellow: number; red: number; total: number; greenPct: number };
  disengagedThisWeek: Array<{ clientName: string; coachName: string; consecutiveMissed: number }>;
  avgMoodScore: number | null;
  activeCoachCount: number;
  engagementTrend: number | null;
  disengagedTrend: number | null;
  prevWeekStart: string;
  prevOverallEngagementPct: number | null;
  prevDisengagedCount: number | null;
};

const DARK_BG = "#0f172a";
const CARD_BG = "#1e293b";
const BORDER = "#334155";
const TEXT_PRIMARY = "#f1f5f9";
const TEXT_SECONDARY = "#94a3b8";
const TEXT_MUTED = "#64748b";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const BLUE = "#3b82f6";

function engColor(pct: number): string {
  if (pct >= 80) return GREEN;
  if (pct >= 60) return AMBER;
  return RED;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export async function generateWeeklySummaryPdf(data: WeeklySummaryData, weekLabel: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      info: {
        Title: `Weekly Summary — ${weekLabel}`,
        Author: "Coach Check-In Tracker",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const marginL = 40;
    const marginR = 40;
    const contentW = pageW - marginL - marginR;

    // ── Background ──
    doc.rect(0, 0, pageW, pageH).fill(DARK_BG);

    let y = 40;

    // ── Header ──
    doc.rect(marginL, y, contentW, 56).fill(CARD_BG).stroke(BORDER);
    doc.fillColor(TEXT_PRIMARY).fontSize(18).font("Helvetica-Bold")
      .text("Weekly Summary Report", marginL + 16, y + 10, { width: contentW - 32 });
    doc.fillColor(TEXT_MUTED).fontSize(10).font("Helvetica")
      .text(weekLabel, marginL + 16, y + 34);
    const generatedOn = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
    doc.fillColor(TEXT_MUTED).fontSize(9).font("Helvetica")
      .text(`Generated ${generatedOn}`, marginL + 16, y + 46, { width: contentW - 32, align: "right" });
    y += 68;

    // ── KPI Cards (3 across) ──
    const cardW = (contentW - 16) / 3;
    const cardH = 60;
    const kpis = [
      {
        label: "Check-ins Completed",
        value: `${data.totalCompleted}`,
        sub: `of ${data.totalScheduled} scheduled`,
        accent: BLUE,
      },
      {
        label: "Overall Engagement",
        value: `${data.overallEngagementPct}%`,
        sub: data.engagementTrend !== null
          ? `${data.engagementTrend >= 0 ? "+" : ""}${data.engagementTrend}% vs prev week`
          : "vs prev week",
        accent: engColor(data.overallEngagementPct),
      },
      {
        label: "Disengaged Clients",
        value: `${data.disengagedThisWeek.length}`,
        sub: data.disengagedTrend !== null
          ? `${data.disengagedTrend < 0 ? Math.abs(data.disengagedTrend) + " fewer" : data.disengagedTrend > 0 ? data.disengagedTrend + " more" : "same"} than last week`
          : "missed this week",
        accent: data.disengagedThisWeek.length === 0 ? GREEN : AMBER,
      },
    ];
    kpis.forEach((kpi, i) => {
      const x = marginL + i * (cardW + 8);
      doc.rect(x, y, cardW, cardH).fill(CARD_BG).stroke(BORDER);
      // Accent bar on left
      doc.rect(x, y, 3, cardH).fill(kpi.accent);
      doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica")
        .text(kpi.label.toUpperCase(), x + 10, y + 10, { width: cardW - 14 });
      doc.fillColor(kpi.accent).fontSize(22).font("Helvetica-Bold")
        .text(kpi.value, x + 10, y + 22, { width: cardW - 14 });
      doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica")
        .text(kpi.sub, x + 10, y + 46, { width: cardW - 14 });
    });
    y += cardH + 16;

    // ── Section helper ──
    function sectionHeader(title: string, subtitle?: string) {
      doc.fillColor(TEXT_PRIMARY).fontSize(11).font("Helvetica-Bold")
        .text(title, marginL, y);
      if (subtitle) {
        doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica")
          .text(subtitle, marginL, y + 14, { width: contentW });
        y += 28;
      } else {
        y += 18;
      }
    }

    // ── Table helper ──
    function drawTable(
      headers: string[],
      rows: string[][],
      colWidths: number[],
      opts: { lastRowBold?: boolean } = {}
    ) {
      const rowH = 18;
      const headerH = 20;
      const totalW = colWidths.reduce((a, b) => a + b, 0);
      // Header row
      doc.rect(marginL, y, totalW, headerH).fill(CARD_BG).stroke(BORDER);
      let cx = marginL;
      headers.forEach((h, i) => {
        doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica-Bold")
          .text(h, cx + 6, y + 6, { width: colWidths[i] - 8, align: i === 0 ? "left" : "right" });
        cx += colWidths[i];
      });
      y += headerH;
      // Data rows
      rows.forEach((row, ri) => {
        const isLast = ri === rows.length - 1 && opts.lastRowBold;
        const rowBg = isLast ? CARD_BG : ri % 2 === 0 ? DARK_BG : "#111827";
        doc.rect(marginL, y, totalW, rowH).fill(rowBg).stroke(BORDER);
        let cx2 = marginL;
        row.forEach((cell, ci) => {
          const isFirstCol = ci === 0;
          doc.fillColor(isLast ? TEXT_SECONDARY : TEXT_PRIMARY)
            .fontSize(8)
            .font(isLast ? "Helvetica-Bold" : "Helvetica")
            .text(cell, cx2 + 6, y + 5, { width: colWidths[ci] - 8, align: isFirstCol ? "left" : "right" });
          cx2 += colWidths[ci];
        });
        y += rowH;
      });
      y += 8;
    }

    // ── Coach Activity ──
    sectionHeader("Coach Activity", "Daily submissions and outreach messages sent this week.");
    const actHeaders = ["Coach", "Morning Reviews", "Follow-Up Days", "Follow-Up Msgs", "Disengagement Msgs"];
    const actColW = [contentW * 0.28, contentW * 0.18, contentW * 0.18, contentW * 0.18, contentW * 0.18];
    const actRows = data.coachActivity.map(c => [
      c.coachName,
      `${c.morningDays} / ${c.workdayCount}`,
      `${c.followupDays}`,
      `${c.totalFollowupMsgs}`,
      `${c.totalDisengagementMsgs}`,
    ]);
    drawTable(actHeaders, actRows, actColW);

    // ── Client Engagement ──
    sectionHeader("Client Engagement by Coach", "Scheduled vs completed check-ins per coach this week.");
    const engHeaders = ["Coach", "Scheduled", "Completed", "Missed", "Engagement %"];
    const engColW = [contentW * 0.28, contentW * 0.18, contentW * 0.18, contentW * 0.18, contentW * 0.18];
    const activeEngStats = data.engagementStats.filter(e => e.scheduled > 0);
    const engRows = [
      ...activeEngStats.map(e => [
        e.coachName,
        `${e.scheduled}`,
        `${e.completed}`,
        `${e.missed}`,
        `${e.engagementPct}%`,
      ]),
      ...(activeEngStats.length > 0 ? [[
        "Total",
        `${data.totalScheduled}`,
        `${data.totalCompleted}`,
        `${data.totalScheduled - data.totalCompleted}`,
        `${data.overallEngagementPct}%`,
      ]] : []),
    ];
    drawTable(engHeaders, engRows, engColW, { lastRowBold: activeEngStats.length > 0 });

    // ── Check new page if needed ──
    const remainingSpace = pageH - y - 40;
    const disengagedH = Math.max(80, 20 + data.disengagedThisWeek.length * 16);
    const healthH = 100;
    const twoColH = Math.max(disengagedH, healthH);
    if (remainingSpace < twoColH + 40) {
      doc.addPage();
      doc.rect(0, 0, pageW, pageH).fill(DARK_BG);
      y = 40;
    }

    // ── Two-column: Disengaged + Client Health ──
    const colW2 = (contentW - 12) / 2;

    // Disengaged Clients
    const disX = marginL;
    const healthX = marginL + colW2 + 12;
    const twoColY = y;

    // Disengaged header
    doc.rect(disX, twoColY, colW2, 28).fill(CARD_BG).stroke(BORDER);
    doc.fillColor(TEXT_PRIMARY).fontSize(10).font("Helvetica-Bold")
      .text("Disengaged Clients This Week", disX + 10, twoColY + 8, { width: colW2 - 60 });
    const disCount = data.disengagedThisWeek.length;
    doc.fillColor(disCount === 0 ? GREEN : AMBER).fontSize(14).font("Helvetica-Bold")
      .text(`${disCount}`, disX + colW2 - 30, twoColY + 7, { width: 24, align: "right" });

    let disY = twoColY + 28;
    if (disCount === 0) {
      doc.rect(disX, disY, colW2, 28).fill(DARK_BG).stroke(BORDER);
      doc.fillColor(TEXT_MUTED).fontSize(9).font("Helvetica")
        .text("No disengaged clients this week ✓", disX + 10, disY + 9, { width: colW2 - 20, align: "center" });
      disY += 28;
    } else {
      // Group by coach
      const byCoach: Record<string, typeof data.disengagedThisWeek> = {};
      const coachOrder: string[] = [];
      for (const c of data.disengagedThisWeek) {
        if (!byCoach[c.coachName]) { coachOrder.push(c.coachName); byCoach[c.coachName] = []; }
        byCoach[c.coachName].push(c);
      }
      for (const coachName of coachOrder) {
        const clients = byCoach[coachName].sort((a, b) => b.consecutiveMissed - a.consecutiveMissed);
        // Coach label
        doc.rect(disX, disY, colW2, 16).fill(CARD_BG).stroke(BORDER);
        doc.fillColor(TEXT_SECONDARY).fontSize(8).font("Helvetica-Bold")
          .text(coachName.toUpperCase(), disX + 10, disY + 4, { width: colW2 - 20 });
        disY += 16;
        for (const c of clients) {
          const bangs = "!".repeat(Math.min(c.consecutiveMissed, 4));
          const rowColor = c.consecutiveMissed >= 3 ? "#450a0a" : c.consecutiveMissed === 2 ? "#431407" : "#422006";
          doc.rect(disX, disY, colW2, 16).fill(rowColor).stroke(BORDER);
          const textColor = c.consecutiveMissed >= 3 ? "#fca5a5" : c.consecutiveMissed === 2 ? "#fdba74" : "#fde68a";
          doc.fillColor(textColor).fontSize(8).font("Helvetica")
            .text(c.clientName, disX + 10, disY + 4, { width: colW2 - 40 });
          doc.fillColor(textColor).fontSize(9).font("Helvetica-Bold")
            .text(bangs, disX + colW2 - 30, disY + 4, { width: 24, align: "right" });
          disY += 16;
        }
      }
    }

    // Client Health
    const health = data.clientHealth;
    doc.rect(healthX, twoColY, colW2, 28).fill(CARD_BG).stroke(BORDER);
    doc.fillColor(TEXT_PRIMARY).fontSize(10).font("Helvetica-Bold")
      .text("Client Health Snapshot", healthX + 10, twoColY + 8, { width: colW2 - 20 });

    let hY = twoColY + 28;
    doc.rect(healthX, hY, colW2, Math.max(disY - twoColY - 28, 80)).fill(DARK_BG).stroke(BORDER);
    hY += 10;

    if (health.total === 0) {
      doc.fillColor(TEXT_MUTED).fontSize(9).font("Helvetica")
        .text("No ratings recorded yet.", healthX + 10, hY + 10, { width: colW2 - 20, align: "center" });
    } else {
      doc.fillColor(engColor(health.greenPct)).fontSize(26).font("Helvetica-Bold")
        .text(`${health.greenPct}%`, healthX + 10, hY, { width: colW2 - 20 });
      doc.fillColor(TEXT_MUTED).fontSize(9).font("Helvetica")
        .text("clients on track", healthX + 10, hY + 30, { width: colW2 - 20 });
      hY += 44;
      // Progress bar
      const barW = colW2 - 20;
      const barH = 8;
      doc.rect(healthX + 10, hY, barW, barH).fill(CARD_BG);
      const greenW = Math.round((health.green / health.total) * barW);
      const yellowW = Math.round((health.yellow / health.total) * barW);
      const redW = barW - greenW - yellowW;
      if (greenW > 0) doc.rect(healthX + 10, hY, greenW, barH).fill(GREEN);
      if (yellowW > 0) doc.rect(healthX + 10 + greenW, hY, yellowW, barH).fill(AMBER);
      if (redW > 0) doc.rect(healthX + 10 + greenW + yellowW, hY, redW, barH).fill(RED);
      hY += 14;
      // Legend
      const legend = [
        { color: GREEN, count: health.green, label: "On track" },
        { color: AMBER, count: health.yellow, label: "At risk" },
        { color: RED, count: health.red, label: "Needs attention" },
      ];
      legend.forEach(l => {
        doc.circle(healthX + 16, hY + 4, 4).fill(l.color);
        doc.fillColor(TEXT_PRIMARY).fontSize(8).font("Helvetica-Bold")
          .text(`${l.count}`, healthX + 24, hY, { width: 20 });
        doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica")
          .text(l.label, healthX + 44, hY, { width: colW2 - 54 });
        hY += 14;
      });
      doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica")
        .text(`${health.total} clients rated in total.`, healthX + 10, hY + 4, { width: colW2 - 20 });
    }

    y = Math.max(disY, twoColY + Math.max(disY - twoColY, 80 + 28)) + 16;

    // ── Footer ──
    if (y > pageH - 50) {
      doc.addPage();
      doc.rect(0, 0, pageW, pageH).fill(DARK_BG);
      y = pageH - 40;
    } else {
      y = pageH - 30;
    }
    doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica")
      .text(`Coach Check-In Tracker · ${weekLabel}`, marginL, y, { width: contentW, align: "center" });

    doc.end();
  });
}
