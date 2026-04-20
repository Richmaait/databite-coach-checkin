/**
 * Typeform Webhook Handler
 *
 * Receives POST /api/webhooks/typeform when a client submits a check-in form.
 * Verifies the HMAC-SHA256 signature, extracts the client name, maps the form
 * to the correct coach, and sets clientSubmitted=true on the matching roster row
 * (inserting a stub row if the coach hasn't ticked the client yet this week).
 *
 * READ-ONLY Typeform access: this handler never calls any Typeform write endpoints.
 */

import crypto from "crypto";
import { Request, Response, Express } from "express";
import { getDb } from "./db";
import { ENV } from "./env";
import { clientCheckIns, coaches } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";

// Map Typeform form IDs → coach names (must match the "name" column in the coaches table)
export const FORM_TO_COACH: Record<string, string> = {
  hrGCn0V0: "Kyah",
  i9de5jMN: "Luke",
  lRvWjdgl: "Steve",
  Ol9CZ2Lu: "Rich",
  Ink0VfO1: "Alex ",
};

const SHEET_ID = "1puu4oLAmC5jV_GEmRrMxvXuTak_dl6pOJ6iWC44Nfl4";
const SHEET_TAB = "CLIENT ROSTER";
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
type DayKey = (typeof DAYS)[number];

/** Returns YYYY-MM-DD for the Monday of the week containing `date`, using AEST (UTC+10). */
export function getAESTWeekStart(date: Date): string {
  // Convert to AEST by adding 10 hours (UTC+10 — conservative; handles both AEST and AEDT)
  const aest = new Date(date.getTime() + 10 * 60 * 60 * 1000);
  const day = aest.getUTCDay(); // 0=Sun, 1=Mon, …
  // Sunday submissions belong to the NEXT week (clients submit Sunday for Monday check-in)
  // So Sunday (0) → add 1 day to get the upcoming Monday
  // Mon-Fri (1-5) → subtract back to Monday of current week
  let monday: Date;
  if (day === 0) {
    monday = new Date(aest.getTime() + 1 * 24 * 60 * 60 * 1000); // Sunday → next Monday
  } else {
    const daysFromMonday = day - 1;
    monday = new Date(aest.getTime() - daysFromMonday * 24 * 60 * 60 * 1000);
  }
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const d = String(monday.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns the day of week (monday…friday) for a given UTC timestamp, in AEST.
 * Sunday AEST (day 0) maps to "monday" — clients submit on Sunday for their Monday check-in.
 * Saturday AEST (day 6) returns null and is skipped. */
export function getAESTDayOfWeek(date: Date): DayKey | null {
  const aest = new Date(date.getTime() + 10 * 60 * 60 * 1000);
  const dayIndex = aest.getUTCDay(); // 0=Sun
  // Sunday submissions count as Monday (clients submit Sunday for Monday check-in)
  const map: Record<number, DayKey> = { 0: "monday", 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday" };
  return map[dayIndex] ?? null; // Saturday (6) returns null → skipped
}

/** Normalise a name for fuzzy matching: lowercase, strip parenthetical suffixes, collapse spaces. */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")   // strip "(UPFRONT - 5 May)" etc.
    .replace(/\s+/g, " ")
    .trim();
}

/** Common nickname → formal name mappings (bidirectional) */
const NICKNAME_MAP: Record<string, string> = {
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
  denise: "dee",
};

/**
 * Score how well a Typeform submitted name matches a roster name.
 * Returns 0 if no match, higher = better match.
 * Handles: exact, normalised (UPFRONT stripped), truncated last names, nickname variations.
 */
export function matchScore(submitted: string, rosterName: string): number {
  const s = normaliseName(submitted);
  const r = normaliseName(rosterName);

  // Exact normalised match
  if (s === r) return 100;

  const sParts = s.split(" ");
  const rParts = r.split(" ");
  if (sParts.length < 2 || rParts.length < 2) return 0;

  const sFirst = sParts[0];
  const sLast = sParts.slice(1).join(" ");
  const rFirst = rParts[0];
  const rLast = rParts.slice(1).join(" ");

  // First names must match (or be nickname variants)
  const firstMatch = sFirst === rFirst ||
    NICKNAME_MAP[sFirst] === rFirst ||
    NICKNAME_MAP[rFirst] === sFirst;
  if (!firstMatch) return 0;

  // Exact last name match
  if (sLast === rLast) return 90;

  // Truncated last name: Typeform may cut off at ~10 chars
  if (sLast.length >= 4 && rLast.startsWith(sLast)) return 70;
  if (rLast.length >= 4 && sLast.startsWith(rLast)) return 70;

  // Last name starts with same 4+ chars
  const minLen = Math.min(sLast.length, rLast.length);
  if (minLen >= 4 && sLast.substring(0, 4) === rLast.substring(0, 4)) return 50;

  // One-character typo in last name (e.g. Cullity vs Culity)
  if (sLast.length >= 4 && rLast.length >= 4) {
    const longer = sLast.length >= rLast.length ? sLast : rLast;
    const shorter = sLast.length >= rLast.length ? rLast : sLast;
    if (longer.length - shorter.length <= 1) {
      // Check if they differ by at most 1 char (insertion/deletion)
      let mismatches = 0;
      let si = 0, li = 0;
      while (si < shorter.length && li < longer.length) {
        if (shorter[si] !== longer[li]) {
          mismatches++;
          if (mismatches > 1) break;
          li++; // skip one char in longer
        } else {
          si++; li++;
        }
      }
      if (mismatches <= 1) return 45;
    }
  }

  return 0;
}

/** Fetch the roster for a coach from Google Sheets. Returns a flat list of { clientName, day }. */
export async function fetchRosterClients(coachName: string): Promise<Array<{ clientName: string; day: DayKey }>> {
  const API_KEY = ENV.googleSheetsApiKey;
  if (!API_KEY) return [];

  const range = encodeURIComponent(`${SHEET_TAB}!A1:J200`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;

  let rows: string[][] = [];
  try {
    const res = await fetch(url);
    const data = await res.json() as { values?: string[][] };
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
  // Handle Kyah's layout: day names may be in the row ABOVE the coach header
  // (col 1 of the header row contains a client name instead of "TUESDAY")
  const prevRow = sectionStart > 0 ? (rows[sectionStart - 1] ?? []) : [];
  const colToDay: Record<number, DayKey> = { 0: "monday" };
  for (let col = 1; col <= 9; col++) {
    const fromHeader = (headerRow[col] ?? "").trim().toLowerCase();
    const fromPrev   = (prevRow[col]   ?? "").trim().toLowerCase();
    const dayName = DAYS.includes(fromHeader as DayKey) ? fromHeader
                  : DAYS.includes(fromPrev   as DayKey) ? fromPrev
                  : null;
    if (dayName) colToDay[col] = dayName as DayKey;
  }

  const clients: Array<{ clientName: string; day: DayKey }> = [];

  // Also collect clients from the header row itself (Kyah's layout: col 1 is a client name)
  for (const [colStr, day] of Object.entries(colToDay)) {
    const col = Number(colStr);
    if (col === 0) continue;
    const cellInHeader = (headerRow[col] ?? "").trim();
    if (cellInHeader && !DAYS.includes(cellInHeader.toLowerCase() as DayKey)) {
      clients.push({ clientName: cellInHeader, day });
    }
  }

  for (let i = sectionStart + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const firstCell = (row[0] ?? "").trim();
    if (!firstCell && row.every(c => !c?.trim())) break;
    if (/^[A-Z]+ - MONDAY$/i.test(firstCell) && i !== sectionStart) break;
    for (const [colStr, day] of Object.entries(colToDay)) {
      const client = (row[Number(colStr)] ?? "").trim();
      if (client) clients.push({ clientName: client, day });
    }
  }
  return clients;
}

/** Mark clientSubmitted=true for a client in the DB. Upserts if no row exists yet. */
export async function markClientSubmitted(params: {
  coachId: number;
  coachName: string;
  clientName: string;   // exact name from the roster (may have UPFRONT suffix)
  dayOfWeek: DayKey;
  weekStart: string;
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
    if (!existing[0].clientSubmitted) {
      await db.update(clientCheckIns)
        .set({ clientSubmitted: true, clientSubmittedAt: new Date() })
        .where(
          and(
            eq(clientCheckIns.coachId, params.coachId),
            eq(clientCheckIns.clientName, params.clientName),
            eq(clientCheckIns.dayOfWeek, params.dayOfWeek),
            eq(clientCheckIns.weekStart, params.weekStart),
          )
        );
    }
    // already marked — idempotent, do nothing
  } else {
    // No coach-tick row yet — insert a stub so the sub icon appears immediately
    await db.insert(clientCheckIns).values({
      coachId: params.coachId,
      coachName: params.coachName,
      clientName: params.clientName,
      dayOfWeek: params.dayOfWeek,
      weekStart: params.weekStart,
      completedByUserId: 0,   // 0 = not yet completed by coach
      clientSubmitted: true,
      clientSubmittedAt: new Date(),
    });
  }
}

export function registerTypeformWebhook(app: Express): void {
  /**
   * IMPORTANT: This route must be registered BEFORE express.json() so we can
   * read the raw body for HMAC verification. We use express.raw() here.
   */
  app.post(
    "/api/webhooks/typeform",
    // Parse body as raw Buffer for signature verification
    (req: Request, res: Response, next) => {
      let data = Buffer.alloc(0);
      req.on("data", (chunk: Buffer) => { data = Buffer.concat([data, chunk]); });
      req.on("end", () => {
        (req as Request & { rawBody: Buffer }).rawBody = data;
        next();
      });
    },
    async (req: Request, res: Response) => {
      try {
        const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
        if (!rawBody) {
          res.status(400).json({ error: "No body" });
          return;
        }

        // --- Signature verification ---
        const secret = ENV.typeformWebhookSecret;
        if (secret) {
          const signature = req.headers["typeform-signature"] as string | undefined;
          if (!signature) {
            console.warn("[Webhook] Missing typeform-signature header");
            res.status(401).json({ error: "Missing signature" });
            return;
          }
          const expected = "sha256=" + crypto
            .createHmac("sha256", secret)
            .update(rawBody)
            .digest("base64");
          if (signature !== expected) {
            console.warn("[Webhook] Invalid typeform-signature");
            res.status(401).json({ error: "Invalid signature" });
            return;
          }
        }

        // --- Parse payload ---
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(rawBody.toString("utf8"));
        } catch {
          res.status(400).json({ error: "Invalid JSON" });
          return;
        }

        const formId = (payload.form_response as Record<string, unknown>)?.form_id as string | undefined;
        const submittedAt = (payload.form_response as Record<string, unknown>)?.submitted_at as string | undefined;
        const answers = ((payload.form_response as Record<string, unknown>)?.answers ?? []) as Array<Record<string, unknown>>;

        if (!formId || !submittedAt) {
          res.status(400).json({ error: "Missing form_id or submitted_at" });
          return;
        }

        const coachName = FORM_TO_COACH[formId];
        if (!coachName) {
          // Not a tracked coach form (e.g. Rich's form, cancellation form) — silently accept
          res.status(200).json({ ok: true, skipped: true });
          return;
        }

        // Extract first + last name from answers (first two short_text fields)
        let firstName = "";
        let lastName = "";
        for (const ans of answers) {
          if ((ans.type as string) === "short_text" && !firstName) {
            firstName = ((ans.text as string) ?? "").trim();
          } else if ((ans.type as string) === "short_text" && firstName && !lastName) {
            lastName = ((ans.text as string) ?? "").trim();
            break;
          }
        }
        const submittedName = `${firstName} ${lastName}`.trim();
        if (!submittedName) {
          console.warn("[Webhook] Could not extract client name from payload");
          res.status(200).json({ ok: true, skipped: true, reason: "no_name" });
          return;
        }

        // --- Determine week + day ---
        const submittedDate = new Date(submittedAt);
        const weekStart = getAESTWeekStart(submittedDate);
        const dayOfWeek = getAESTDayOfWeek(submittedDate);
        if (!dayOfWeek) {
          // Saturday submission — skip (Sunday maps to Monday, only Saturday is truly skipped)
          console.log(`[Webhook] Saturday submission skipped for ${coachName}`);
          res.status(200).json({ ok: true, skipped: true, reason: "saturday" });
          return;
        }

        // --- Look up coach in DB ---
        const db = await getDb();
        if (!db) {
          res.status(500).json({ error: "Database unavailable" });
          return;
        }
        const coachRows = await db.select().from(coaches).where(eq(coaches.name, coachName)).limit(1);
        if (!coachRows.length) {
          console.warn(`[Webhook] Coach not found in DB: ${coachName}`);
          res.status(200).json({ ok: true, skipped: true, reason: "coach_not_found" });
          return;
        }
        const coach = coachRows[0];

        // --- Match name against roster using scored fuzzy matching ---
        const rosterClients = await fetchRosterClients(coachName);

        // Score every roster entry; pick the best match with score >= 50
        let bestScore = 0;
        let matched: { clientName: string; day: DayKey } | null = null;

        for (const entry of rosterClients) {
          const score = matchScore(submittedName, entry.clientName);
          if (score > bestScore) {
            // Prefer same-day matches; give a bonus to same-day entries
            const dayBonus = entry.day === dayOfWeek ? 5 : 0;
            if (score + dayBonus > bestScore) {
              bestScore = score + dayBonus;
              matched = entry;
            }
          }
        }

        // Require a minimum score of 50 to avoid false positives
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
          weekStart,
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
