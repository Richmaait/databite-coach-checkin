/**
 * renderDisengagementPng.ts
 * ─────────────────────────
 * Generates a styled PNG image of the disengagement list using node-canvas.
 * Produces the same 3-tier (Critical / Alert / Warning) per-coach column
 * layout as the UI, suitable for posting to Slack.
 *
 * Tiers:
 *   Critical  — consecutiveMissed >= 3  (red)
 *   Alert     — consecutiveMissed === 2 (orange)
 *   Warning   — consecutiveMissed === 1 (yellow)
 */
import { createCanvas, CanvasRenderingContext2D } from "canvas";

export interface DisengagedClient {
  clientName: string;
  coachName: string;
  dayOfWeek: string;
  consecutiveMissed: number;
}

interface CoachColumn {
  coachName: string;
  rosterSize: number;
  critical: DisengagedClient[];
  alert: DisengagedClient[];
  warning: DisengagedClient[];
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG       = "#0f1117";
const CARD_BG  = "#1a1d27";
const BORDER   = "#2a2d3e";
const TEXT_PRI = "#e8eaf0";
const TEXT_SEC = "#8b8fa8";
const TEXT_MUT = "#5a5e72";

const RED_BG     = "rgba(127, 29, 29, 0.45)";
const RED_BORDER = "rgba(185, 28, 28, 0.55)";
const RED_TEXT   = "#fca5a5";
const RED_DOT    = "#ef4444";

const ORG_BG     = "rgba(120, 53, 15, 0.35)";
const ORG_BORDER = "rgba(194, 65, 12, 0.45)";
const ORG_TEXT   = "#fdba74";
const ORG_DOT    = "#f97316";

const YEL_BG     = "rgba(113, 63, 18, 0.28)";
const YEL_BORDER = "rgba(161, 98, 7, 0.38)";
const YEL_TEXT   = "#fde68a";
const YEL_DOT    = "#eab308";

// Coach accent colours (same order as UI: Kyah=teal, Luke=orange, Steve=purple)
const COACH_ACCENTS = ["#2dd4bf", "#fb923c", "#a78bfa", "#f472b6", "#f87171"];

// ─── Layout constants ─────────────────────────────────────────────────────────
const PAD        = 24;   // outer padding
const COL_GAP    = 16;   // gap between coach columns
const ROW_H      = 22;   // height of each client row
const ROW_PAD_X  = 10;   // horizontal padding inside a client row
const ROW_PAD_Y  = 4;    // vertical padding inside a client row
const TIER_GAP   = 8;    // gap between tier sections within a column
const HEADER_H   = 52;   // coach column header height
const TITLE_H    = 60;   // image title bar height
const FOOTER_H   = 32;   // footer height
const MIN_COL_W  = 180;  // minimum column width

// ─── Helpers ──────────────────────────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

// ─── Measure column height ────────────────────────────────────────────────────
function measureColHeight(col: CoachColumn): number {
  let h = HEADER_H + 8; // header + gap below
  for (const tier of [col.critical, col.alert, col.warning]) {
    if (tier.length === 0) continue;
    h += 20; // tier label row
    h += tier.length * (ROW_H + 2); // client rows
    h += TIER_GAP;
  }
  return h;
}

// ─── Main render function ─────────────────────────────────────────────────────
export function renderDisengagementPng(
  clients: DisengagedClient[],
  rosterSizeByCoach: Record<string, number>,
  weekLabel: string,
): Buffer {
  // ── Group by coach ──────────────────────────────────────────────────────────
  const coachMap = new Map<string, CoachColumn>();
  for (const c of clients) {
    if (!coachMap.has(c.coachName)) {
      coachMap.set(c.coachName, {
        coachName: c.coachName,
        rosterSize: rosterSizeByCoach[c.coachName] ?? 0,
        critical: [],
        alert: [],
        warning: [],
      });
    }
    const col = coachMap.get(c.coachName)!;
    if (c.consecutiveMissed >= 3) col.critical.push(c);
    else if (c.consecutiveMissed === 2) col.alert.push(c);
    else col.warning.push(c);
  }
  const columns = Array.from(coachMap.values());
  const numCols = Math.max(columns.length, 1);

  // ── Compute canvas size ─────────────────────────────────────────────────────
  // First pass: measure with a temp canvas to get text widths
  const tmpCanvas = createCanvas(1200, 100);
  const tmpCtx = tmpCanvas.getContext("2d");

  // Compute column width based on available space
  const totalWidth = Math.max(600, numCols * (MIN_COL_W + COL_GAP) + PAD * 2 - COL_GAP);
  const colW = Math.floor((totalWidth - PAD * 2 - COL_GAP * (numCols - 1)) / numCols);

  // Compute max column height
  const maxColH = columns.length > 0
    ? Math.max(...columns.map(measureColHeight))
    : 80;

  const canvasW = totalWidth;
  const canvasH = TITLE_H + maxColH + PAD * 2 + FOOTER_H;

  // ── Create final canvas ─────────────────────────────────────────────────────
  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // ── Title bar ───────────────────────────────────────────────────────────────
  ctx.fillStyle = CARD_BG;
  ctx.fillRect(0, 0, canvasW, TITLE_H);
  // Bottom border on title bar
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, TITLE_H);
  ctx.lineTo(canvasW, TITLE_H);
  ctx.stroke();

  // Title text
  ctx.font = "bold 18px sans-serif";
  ctx.fillStyle = TEXT_PRI;
  ctx.fillText("🚨  Disengagement Tracking", PAD, 28);

  // Subtitle
  ctx.font = "13px sans-serif";
  ctx.fillStyle = TEXT_SEC;
  ctx.fillText(`Week of ${weekLabel}`, PAD, 48);

  // Total flagged count (top-right)
  const totalFlagged = clients.length;
  const totalCritical = clients.filter(c => c.consecutiveMissed >= 3).length;
  const totalAlert    = clients.filter(c => c.consecutiveMissed === 2).length;
  const totalWarning  = clients.filter(c => c.consecutiveMissed === 1).length;
  const summaryText = `${totalFlagged} flagged  •  ${totalCritical} critical  •  ${totalAlert} alert  •  ${totalWarning} warning`;
  ctx.font = "12px sans-serif";
  ctx.fillStyle = TEXT_MUT;
  const sw = ctx.measureText(summaryText).width;
  ctx.fillText(summaryText, canvasW - PAD - sw, 48);

  // ── Legend ──────────────────────────────────────────────────────────────────
  const legendY = TITLE_H + 14;
  const legendItems = [
    { dot: RED_DOT, label: "Critical (3+ misses)" },
    { dot: ORG_DOT, label: "Alert (2 misses)" },
    { dot: YEL_DOT, label: "Warning (1 miss)" },
  ];
  let legendX = canvasW - PAD;
  for (let i = legendItems.length - 1; i >= 0; i--) {
    const item = legendItems[i];
    ctx.font = "11px sans-serif";
    ctx.fillStyle = TEXT_SEC;
    const lw = ctx.measureText(item.label).width;
    legendX -= lw;
    ctx.fillText(item.label, legendX, legendY);
    legendX -= 14;
    ctx.fillStyle = item.dot;
    ctx.beginPath();
    ctx.arc(legendX, legendY - 4, 4, 0, Math.PI * 2);
    ctx.fill();
    legendX -= 16;
  }

  // ── Coach columns ───────────────────────────────────────────────────────────
  if (columns.length === 0) {
    ctx.font = "bold 15px sans-serif";
    ctx.fillStyle = TEXT_SEC;
    ctx.textAlign = "center";
    ctx.fillText("✅  All clear — no disengaged clients this week", canvasW / 2, TITLE_H + PAD + 40);
    ctx.textAlign = "left";
  } else {
    for (let ci = 0; ci < columns.length; ci++) {
      const col = columns[ci];
      const colX = PAD + ci * (colW + COL_GAP);
      let colY = TITLE_H + PAD;
      const accent = COACH_ACCENTS[ci % COACH_ACCENTS.length];

      // ── Column header card ────────────────────────────────────────────────
      ctx.fillStyle = CARD_BG;
      roundRect(ctx, colX, colY, colW, HEADER_H, 8);
      ctx.fill();
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 1;
      roundRect(ctx, colX, colY, colW, HEADER_H, 8);
      ctx.stroke();

      // Left accent stripe
      ctx.fillStyle = accent;
      roundRect(ctx, colX, colY, 4, HEADER_H, 4);
      ctx.fill();

      // Coach initial circle
      const circleX = colX + 20;
      const circleY = colY + HEADER_H / 2;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(circleX, circleY, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "bold 12px sans-serif";
      ctx.fillStyle = "#0f1117";
      ctx.textAlign = "center";
      ctx.fillText(col.coachName.charAt(0).toUpperCase(), circleX, circleY + 4);
      ctx.textAlign = "left";

      // Coach name
      ctx.font = "bold 14px sans-serif";
      ctx.fillStyle = TEXT_PRI;
      ctx.fillText(col.coachName, colX + 40, colY + 18);

      // Flagged count
      const flagged = col.critical.length + col.alert.length + col.warning.length;
      const rosterSize = col.rosterSize;
      ctx.font = "12px sans-serif";
      ctx.fillStyle = TEXT_SEC;
      ctx.fillText(`${flagged} / ${rosterSize} flagged`, colX + 40, colY + 36);

      // Per-tier mini stats
      const statsY = colY + HEADER_H - 10;
      const tierStats = [
        { count: col.critical.length, color: RED_DOT, label: "crit" },
        { count: col.alert.length,    color: ORG_DOT, label: "alrt" },
        { count: col.warning.length,  color: YEL_DOT, label: "warn" },
      ].filter(t => t.count > 0);
      let statX = colX + colW - ROW_PAD_X;
      for (let ti = tierStats.length - 1; ti >= 0; ti--) {
        const ts = tierStats[ti];
        ctx.font = "10px sans-serif";
        ctx.fillStyle = TEXT_MUT;
        const pct = rosterSize > 0 ? `${Math.round((ts.count / rosterSize) * 100)}%` : "";
        const statLabel = `${ts.count} ${pct}`;
        statX -= ctx.measureText(statLabel).width;
        ctx.fillText(statLabel, statX, statsY);
        statX -= 10;
        ctx.fillStyle = ts.color;
        ctx.beginPath();
        ctx.arc(statX, statsY - 4, 3, 0, Math.PI * 2);
        ctx.fill();
        statX -= 12;
      }

      colY += HEADER_H + 8;

      // ── Tier sections ─────────────────────────────────────────────────────
      const tiers = [
        { label: "Critical", items: col.critical, bg: RED_BG, border: RED_BORDER, text: RED_TEXT, dot: RED_DOT },
        { label: "Alert",    items: col.alert,    bg: ORG_BG, border: ORG_BORDER, text: ORG_TEXT, dot: ORG_DOT },
        { label: "Warning",  items: col.warning,  bg: YEL_BG, border: YEL_BORDER, text: YEL_TEXT, dot: YEL_DOT },
      ];

      for (const tier of tiers) {
        if (tier.items.length === 0) continue;

        // Tier label row
        ctx.font = "bold 10px sans-serif";
        ctx.fillStyle = tier.text;
        ctx.fillText(`▸ ${tier.label.toUpperCase()} (${tier.items.length})`, colX + ROW_PAD_X, colY + 13);
        colY += 20;

        // Client rows
        for (const client of tier.items) {
          // Row background
          ctx.fillStyle = tier.bg;
          roundRect(ctx, colX, colY, colW, ROW_H, 4);
          ctx.fill();
          ctx.strokeStyle = tier.border;
          ctx.lineWidth = 0.8;
          roundRect(ctx, colX, colY, colW, ROW_H, 4);
          ctx.stroke();

          // Dot
          ctx.fillStyle = tier.dot;
          ctx.beginPath();
          ctx.arc(colX + ROW_PAD_X + 4, colY + ROW_H / 2, 3, 0, Math.PI * 2);
          ctx.fill();

          // Client name
          ctx.font = "11px sans-serif";
          ctx.fillStyle = tier.text;
          const nameMaxW = colW - ROW_PAD_X * 2 - 14 - 40;
          const name = truncate(ctx, client.clientName, nameMaxW);
          ctx.fillText(name, colX + ROW_PAD_X + 14, colY + ROW_H / 2 + 4);

          // Streak bangs (right-aligned)
          const bangs = "!".repeat(Math.min(client.consecutiveMissed, 4));
          ctx.font = "bold 10px sans-serif";
          ctx.fillStyle = tier.dot;
          const bangsW = ctx.measureText(bangs).width;
          ctx.fillText(bangs, colX + colW - ROW_PAD_X - bangsW, colY + ROW_H / 2 + 4);

          colY += ROW_H + 2;
        }
        colY += TIER_GAP;
      }
    }
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  const footerY = canvasH - FOOTER_H;
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(canvasW, footerY);
  ctx.stroke();

  ctx.font = "11px sans-serif";
  ctx.fillStyle = TEXT_MUT;
  ctx.fillText("Coach Check-In Tracker  •  databitecoach.com", PAD, footerY + 20);

  const ts = new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  ctx.textAlign = "right";
  ctx.fillText(`Generated ${ts} AEST`, canvasW - PAD, footerY + 20);
  ctx.textAlign = "left";

  return canvas.toBuffer("image/png");
}
