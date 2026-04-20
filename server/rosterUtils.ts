/**
 * Shared Google Sheets roster utilities.
 *
 * The CLIENT ROSTER sheet is a multi-column layout:
 *   Col A = Monday clients
 *   Col B = Tuesday clients
 *   Col C = Wednesday clients
 *   Col D = Thursday clients
 *   Col E = Friday clients
 *
 * Each coach section starts with a header row like:
 *   "LUKE - MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY"
 *
 * Client rows follow immediately below until the next coach header or a fully
 * blank row.
 */

import { ENV } from "./env";
import { getDb } from "./db";
import { rosterAssignments } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const SHEET_ID = "1puu4oLAmC5jV_GEmRrMxvXuTak_dl6pOJ6iWC44Nfl4";
const SHEET_TAB = "CLIENT ROSTER";

export const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
export type DayKey = (typeof DAYS)[number];

// ─── Fetch raw sheet rows (cached per process tick) ───────────────────────────

let _cachedRows: string[][] | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchSheetRows(): Promise<string[][]> {
  const now = Date.now();
  if (_cachedRows && now - _cacheTime < CACHE_TTL_MS) return _cachedRows;

  const apiKey = ENV.googleSheetsApiKey;
  if (!apiKey) return [];

  const range = encodeURIComponent(`${SHEET_TAB}!A1:J200`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${apiKey}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      const json = (await res.json()) as { values?: string[][] };
      _cachedRows = json.values ?? [];
      _cacheTime = now;
      return _cachedRows;
    } catch {
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return [];
}

// ─── Parse roster for a single coach ─────────────────────────────────────────

/**
 * Returns a map of day → client names for the given coach.
 * Strips UPFRONT/DEC OFFER/pause suffixes from client names.
 */
export async function fetchRosterForCoach(
  coachName: string,
): Promise<Record<DayKey, string[]>> {
  const empty: Record<DayKey, string[]> = {
    monday: [], tuesday: [], wednesday: [], thursday: [], friday: [],
  };

  // Read from DB roster
  const db = await getDb();
  if (db) {
    const rows = await db.select().from(rosterAssignments)
      .where(and(
        eq(rosterAssignments.coachName, coachName),
        eq(rosterAssignments.isActive, 1),
      ));

    if (rows.length > 0) {
      const days: Record<DayKey, string[]> = { ...empty };
      for (const r of rows) {
        const day = r.dayOfWeek as DayKey;
        days[day].push(cleanClientName(r.clientName));
      }
      return days;
    }
  }

  // Fallback: Google Sheets (for coaches not yet in DB roster)
  const roster = await fetchRosterForCoachFromSheet(coachName);

  // Rich's Friday section is onboarding clients, not a real roster day
  if (coachName === "Rich") {
    roster.friday = [];
  }

  return roster;
}

async function fetchRosterForCoachFromSheet(
  coachName: string,
): Promise<Record<DayKey, string[]>> {
  const empty: Record<DayKey, string[]> = {
    monday: [], tuesday: [], wednesday: [], thursday: [], friday: [],
  };

  const rows = await fetchSheetRows();
  if (rows.length === 0) return empty;

  const upperName = coachName.toUpperCase();
  const aliases = [
    upperName,
    upperName.replace("STEVE", "STEPHEN"),
    upperName.replace("STEPHEN", "STEVE"),
  ];

  let sectionStart = -1;
  for (let i = 0; i < rows.length; i++) {
    const cell = (rows[i]?.[0] ?? "").trim().toUpperCase();
    if (aliases.some(a => cell === `${a} - MONDAY`)) {
      sectionStart = i;
      break;
    }
  }
  if (sectionStart === -1) return empty;

  const headerRow = rows[sectionStart];
  const prevRow = sectionStart > 0 ? (rows[sectionStart - 1] ?? []) : [];
  const colToDay: Record<number, DayKey> = { 0: "monday" };

  for (let col = 1; col <= 9; col++) {
    const fromHeader = (headerRow[col] ?? "").trim().toLowerCase();
    const fromPrev = (prevRow[col] ?? "").trim().toLowerCase();
    const dayName = DAYS.includes(fromHeader as DayKey)
      ? fromHeader
      : DAYS.includes(fromPrev as DayKey)
        ? fromPrev
        : null;
    if (dayName) colToDay[col] = dayName as DayKey;
  }

  const days: Record<DayKey, string[]> = { ...empty };

  for (const [colStr, day] of Object.entries(colToDay)) {
    const col = Number(colStr);
    if (col === 0) continue;
    const cell = (headerRow[col] ?? "").trim();
    if (cell && !DAYS.includes(cell.toLowerCase() as DayKey)) {
      const name = cleanClientName(cell);
      if (name) days[day].push(name);
    }
  }

  for (let i = sectionStart + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const firstCell = (row[0] ?? "").trim();

    if (/^[A-Z]+ - MONDAY$/i.test(firstCell) && i !== sectionStart) break;
    if (!firstCell && row.every(c => !c?.trim())) break;

    for (const [colStr, day] of Object.entries(colToDay)) {
      const raw = (row[Number(colStr)] ?? "").trim();
      if (!raw) continue;
      const name = cleanClientName(raw);
      if (name) days[day].push(name);
    }
  }

  return days;
}

/**
 * Strip common suffixes from client names:
 *   "Prue Wilford (16 Mar)" → "Prue Wilford"
 *   "Veronica Hansen (UPFRONT - 6 May)" → "Veronica Hansen"
 *   "Sara Zokaei Fard (DEC OFFER 16 APRIL 26)" → "Sara Zokaei Fard"
 *
 * Returns empty string if the cell is a header/label (e.g. "CLIENT NAME").
 */
function cleanClientName(raw: string): string {
  if (!raw) return "";
  // Skip header labels
  if (/^CLIENT NAME$/i.test(raw.trim())) return "";
  if (/^UPFRONT$/i.test(raw.trim())) return "";
  if (/^---/.test(raw.trim())) return "";
  // Strip parenthetical suffixes
  return raw.replace(/\s*\(.*\)\s*$/, "").trim();
}

/**
 * Same as fetchRosterForCoach but returns RAW names (with parenthetical dates/tags intact).
 */
export async function fetchRawRosterForCoach(
  coachName: string,
): Promise<Record<DayKey, string[]>> {
  const empty: Record<DayKey, string[]> = {
    monday: [], tuesday: [], wednesday: [], thursday: [], friday: [],
  };

  // DB roster stores raw names with suffixes
  const db = await getDb();
  if (db) {
    const rows = await db.select().from(rosterAssignments)
      .where(and(
        eq(rosterAssignments.coachName, coachName),
        eq(rosterAssignments.isActive, 1),
      ));
    if (rows.length > 0) {
      const days: Record<DayKey, string[]> = { ...empty };
      for (const r of rows) days[r.dayOfWeek as DayKey].push(r.clientName);
      return days;
    }
  }

  // Fallback: Google Sheets
  const rows = await fetchSheetRows();
  if (rows.length === 0) return empty;

  const upperName = coachName.toUpperCase();
  const aliases = [upperName, upperName.replace("STEVE", "STEPHEN"), upperName.replace("STEPHEN", "STEVE")];

  let sectionStart = -1;
  for (let i = 0; i < rows.length; i++) {
    const cell = (rows[i]?.[0] ?? "").trim().toUpperCase();
    if (aliases.some(a => cell === `${a} - MONDAY`)) { sectionStart = i; break; }
  }
  if (sectionStart === -1) return empty;

  const headerRow = rows[sectionStart];
  const prevRow = sectionStart > 0 ? (rows[sectionStart - 1] ?? []) : [];
  const colToDay: Record<number, DayKey> = { 0: "monday" };
  for (let col = 1; col <= 9; col++) {
    const fromHeader = (headerRow[col] ?? "").trim().toLowerCase();
    const fromPrev = (prevRow[col] ?? "").trim().toLowerCase();
    const dayName = DAYS.includes(fromHeader as DayKey) ? fromHeader : DAYS.includes(fromPrev as DayKey) ? fromPrev : null;
    if (dayName) colToDay[col] = dayName as DayKey;
  }

  const days: Record<DayKey, string[]> = { ...empty };

  for (const [colStr, day] of Object.entries(colToDay)) {
    const col = Number(colStr);
    if (col === 0) continue;
    const cell = (headerRow[col] ?? "").trim();
    if (cell && !DAYS.includes(cell.toLowerCase() as DayKey) && !/^CLIENT NAME$/i.test(cell) && !/^UPFRONT$/i.test(cell) && !/^---/.test(cell)) {
      days[day].push(cell);
    }
  }

  for (let i = sectionStart + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const firstCell = (row[0] ?? "").trim();
    if (/^[A-Z]+ - MONDAY$/i.test(firstCell) && i !== sectionStart) break;
    if (!firstCell && row.every(c => !c?.trim())) break;
    for (const [colStr, day] of Object.entries(colToDay)) {
      const raw = (row[Number(colStr)] ?? "").trim();
      if (!raw || /^CLIENT NAME$/i.test(raw) || /^UPFRONT$/i.test(raw) || /^---/.test(raw)) continue;
      days[day].push(raw);
    }
  }

  return days;
}
