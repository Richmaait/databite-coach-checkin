/**
 * Typeform backfill service.
 *
 * Fetches responses submitted since the start of the current week from all three
 * coach forms and marks clientSubmitted=true for any matched roster client.
 *
 * Form → coach mapping:
 *   lRvWjdgl → Steve  (first name field: zTLboa1Y892a, last name: KLsh0B5X4l2V)
 *   i9de5jMN → Luke   (first name field: X9l68HkBqahH, last name: kkVVNqmKSCZp)
 *   hrGCn0V0 → Kyah   (first name field: x0Li5tbrkvGK, last name: GIqMvcsNnfLH)
 *   Ol9CZ2Lu → Rich   (first name field: de7XNkkJt4ST, last name: Q1ixmNUmrUJ1)
 */

import { getAllCoaches, toggleClientSubmitted } from "./db";
import { ENV } from "./env";
import { fetchRosterForCoach, DAYS as ROSTER_DAYS } from "./rosterUtils";

const SHEET_ID = "1puu4oLAmC5jV_GEmRrMxvXuTak_dl6pOJ6iWC44Nfl4";
const SHEET_TAB = "CLIENT ROSTER";

type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
type RosterResult = { days: Record<DayKey, string[]> };

async function fetchCoachRoster(coachName: string): Promise<RosterResult> {
  const empty: RosterResult = { days: { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [] } };
  const API_KEY = ENV.googleSheetsApiKey;
  if (!API_KEY) return empty;
  const range = encodeURIComponent(`${SHEET_TAB}!A1:F130`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;
  const resp = await fetch(url);
  if (!resp.ok) return empty;
  const data = (await resp.json()) as { values?: string[][] };
  const rows = data.values ?? [];
  const result: RosterResult = { days: { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [] } };
  const DAYS: DayKey[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
  let inSection = false;
  let dayIndex = 0;
  for (const row of rows) {
    const cell = (row[0] ?? "").trim();
    if (!cell) continue;
    if (cell.toUpperCase().includes(coachName.toUpperCase()) && cell.toUpperCase().includes("ROSTER")) {
      inSection = true; dayIndex = 0; continue;
    }
    if (inSection) {
      if (cell.toUpperCase().includes("ROSTER") && !cell.toUpperCase().includes(coachName.toUpperCase())) break;
      const lower = cell.toLowerCase();
      if (["monday","tuesday","wednesday","thursday","friday"].includes(lower)) {
        dayIndex = DAYS.indexOf(lower as DayKey);
      } else if (dayIndex >= 0 && dayIndex < 5) {
        result.days[DAYS[dayIndex]].push(cell);
      }
    }
  }
  return result;
}

const TYPEFORM_API_TOKEN = ENV.typeformApiToken ?? "";

interface FormConfig {
  formId: string;
  coachName: string;
  firstNameFieldId: string;
  lastNameFieldId: string;
}

const FORM_CONFIGS: FormConfig[] = [
  {
    formId: "lRvWjdgl",
    coachName: "Steve",
    firstNameFieldId: "zTLboa1Y892a",
    lastNameFieldId: "KLsh0B5X4l2V",
  },
  {
    formId: "i9de5jMN",
    coachName: "Luke",
    firstNameFieldId: "X9l68HkBqahH",
    lastNameFieldId: "kkVVNqmKSCZp",
  },
  {
    formId: "hrGCn0V0",
    coachName: "Kyah",
    firstNameFieldId: "x0Li5tbrkvGK",
    lastNameFieldId: "GIqMvcsNnfLH",
  },
  {
    formId: "Ol9CZ2Lu",
    coachName: "Rich",
    firstNameFieldId: "de7XNkkJt4ST",
    lastNameFieldId: "Q1ixmNUmrUJ1",
  },
];

/** Returns the ISO date string (YYYY-MM-DD) for Monday of the week containing `date`, in AEST (UTC+10). */
function getWeekStart(date: Date): string {
  const AEST_OFFSET_MS = 10 * 60 * 60 * 1000;
  const local = new Date(date.getTime() + AEST_OFFSET_MS);
  const day = local.getUTCDay(); // 0=Sun, 1=Mon, ...
  // Sunday submissions belong to the NEXT week (clients submit Sunday for Monday check-in)
  if (day === 0) {
    local.setUTCDate(local.getUTCDate() + 1); // Sunday → next Monday
    return local.toISOString().slice(0, 10);
  }
  const diff = 1 - day; // shift to Monday
  local.setUTCDate(local.getUTCDate() + diff);
  return local.toISOString().slice(0, 10);
}

/** Map a UTC submission timestamp to the day-of-week key (AEST UTC+10/+11).
 * Sunday maps to "monday" — clients submit Sunday for their Monday check-in.
 * Saturday returns null and is skipped. */
function getDayOfWeek(
  submittedAt: string
): "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | null {
  const AEST_OFFSET_MS = 10 * 60 * 60 * 1000;
  const local = new Date(new Date(submittedAt).getTime() + AEST_OFFSET_MS);
  const day = local.getUTCDay();
  const map: Record<number, "monday" | "tuesday" | "wednesday" | "thursday" | "friday"> = {
    0: "monday", // Sunday → Monday
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
  };
  return map[day] ?? null;
}

/** Normalise a name for fuzzy matching (lowercase, trim, collapse spaces, strip suffixes). */
function normaliseName(s: string): string {
  return s.toLowerCase().replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
}

/** Find the best matching client name from the roster. Returns null if no match.
 *
 * Handles common roster patterns:
 *   - Full name: "Melanie Secrieru" ↔ "Melanie Secrieru"
 *   - Last initial: "MELANIE S" ↔ "Melanie Secrieru"
 *   - First name only: "MALIA" ↔ "Malia Franklin-Apted"
 *   - First initial: "E Khoury" ↔ "Elie Khoury"
 *   - Abbreviated: "CHRIS" ↔ "Chris Borg"
 */
function matchClientName(
  firstName: string,
  lastName: string,
  rosterClients: string[]
): string | null {
  const fn = normaliseName(firstName);
  const ln = normaliseName(lastName);
  const fullName = `${fn} ${ln}`.trim();

  // Pass 1: exact match
  for (const c of rosterClients) {
    if (normaliseName(c) === fullName) return c;
  }

  // Pass 2: roster has "FIRSTNAME L" (first name + last initial)
  for (const c of rosterClients) {
    const cn = normaliseName(c);
    const parts = cn.split(" ");
    if (parts.length === 2 && parts[1].length === 1) {
      // Roster is "firstname X" — match if first names match and initial matches last name
      if (parts[0] === fn && ln.startsWith(parts[1])) return c;
    }
  }

  // Pass 3: roster has first name only (e.g. "MALIA", "CHRIS", "AMELIA")
  for (const c of rosterClients) {
    const cn = normaliseName(c);
    if (!cn.includes(" ") && cn === fn) return c;
  }

  // Pass 4: submitted name starts with roster name or vice versa
  for (const c of rosterClients) {
    const cn = normaliseName(c);
    if (cn.startsWith(fullName) || fullName.startsWith(cn)) return c;
  }

  // Pass 5: first name match + last name starts with roster last part (or vice versa)
  for (const c of rosterClients) {
    const cn = normaliseName(c);
    const parts = cn.split(" ");
    if (parts.length >= 2) {
      const rosterFirst = parts[0];
      const rosterLast = parts.slice(1).join(" ");
      if (rosterFirst === fn && (ln.startsWith(rosterLast) || rosterLast.startsWith(ln))) return c;
    }
  }

  // Pass 6: first 3 chars of first name + first 3 chars of last name
  if (fn.length >= 3 && ln.length >= 3) {
    const f3 = fn.slice(0, 3);
    const l3 = ln.slice(0, 3);
    for (const c of rosterClients) {
      const cn = normaliseName(c);
      if (cn.includes(f3) && cn.includes(l3)) return c;
    }
  }

  // Pass 7: first name only match (no last name in roster, fuzzy on first)
  for (const c of rosterClients) {
    const cn = normaliseName(c);
    if (!cn.includes(" ") && fn.startsWith(cn)) return c;
  }

  // Pass 8: close-enough first name (1-2 char difference) + matching last initial or no last name
  for (const c of rosterClients) {
    const cn = normaliseName(c);
    const parts = cn.split(" ");
    const rosterFirst = parts[0];
    const rosterLastPart = parts[1] || "";
    // Allow 1-2 character Levenshtein distance on first name
    if (rosterFirst.length >= 3 && fn.length >= 3 && levenshtein(rosterFirst, fn) <= 2) {
      // If roster has no last name or just an initial that matches, accept
      if (!rosterLastPart || (rosterLastPart.length === 1 && ln.startsWith(rosterLastPart))) return c;
      // If roster has full last name that matches
      if (rosterLastPart.length > 1 && (ln.startsWith(rosterLastPart) || rosterLastPart.startsWith(ln))) return c;
    }
  }

  return null;
}

/** Simple Levenshtein distance for short strings. */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

export interface BackfillResult {
  formId: string;
  coachName: string;
  totalResponses: number;
  matched: number;
  unmatched: string[];
  errors: string[];
}

/** Run the backfill for a single form. */
async function backfillForm(config: FormConfig, weekStart: string): Promise<BackfillResult> {
  const result: BackfillResult = {
    formId: config.formId,
    coachName: config.coachName,
    totalResponses: 0,
    matched: 0,
    unmatched: [],
    errors: [],
  };

  // Fetch coach record by name
  const allCoaches = await getAllCoaches();
  const coach = allCoaches.find(c => c.name.toLowerCase() === config.coachName.toLowerCase());
  if (!coach) {
    result.errors.push(`No coach record found for ${config.coachName}`);
    return result;
  }

  // Fetch roster for this coach using the shared roster parser
  const roster = await fetchRosterForCoach(config.coachName);
  const allClients: string[] = [];
  for (const day of ROSTER_DAYS) {
    allClients.push(...(roster[day] ?? []));
  }
  const uniqueClients = Array.from(new Set(allClients));

  // Fetch responses since Sunday 14:00 UTC = Monday 00:00 AEST (UTC+10)
  // This ensures we capture all responses from Monday morning AEST onwards
  const sundayBeforeWeek = new Date(`${weekStart}T00:00:00+10:00`);
  sundayBeforeWeek.setDate(sundayBeforeWeek.getDate() - 1); // go back to Sunday AEST
  const sinceDate = sundayBeforeWeek.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const url = `https://api.typeform.com/forms/${config.formId}/responses?page_size=200&since=${sinceDate}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${TYPEFORM_API_TOKEN}` },
  });
  if (!resp.ok) {
    result.errors.push(`Typeform API error: ${resp.status} ${resp.statusText}`);
    return result;
  }
  const data = (await resp.json()) as { items: any[] };
  const items = data.items ?? [];
  result.totalResponses = items.length;

  for (const item of items) {
    const answers: any[] = item.answers ?? [];
    const firstNameAnswer = answers.find((a: any) => a.field?.id === config.firstNameFieldId);
    const lastNameAnswer = answers.find((a: any) => a.field?.id === config.lastNameFieldId);

    if (!firstNameAnswer || !lastNameAnswer) continue;

    const firstName = (firstNameAnswer.text ?? "").trim();
    const lastName = (lastNameAnswer.text ?? "").trim();
    if (!firstName && !lastName) continue;

    const submittedAt: string = item.submitted_at ?? "";
    const dayOfWeek = getDayOfWeek(submittedAt);
    if (!dayOfWeek) continue; // weekend submission — skip

    // weekStart for this submission (may differ from current week if backfilling old data)
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
        submittedByUserId: 0, // 0 = system/Typeform backfill
      });
      result.matched++;
    } catch (err: any) {
      result.errors.push(`Failed to mark ${matchedClient}: ${err.message}`);
    }
  }

  return result;
}

/** Run the full backfill across all three forms for the current week. */
export async function runTypeformBackfill(): Promise<BackfillResult[]> {
  const weekStart = getWeekStart(new Date());
  const results = await Promise.all(FORM_CONFIGS.map(c => backfillForm(c, weekStart)));
  return results;
}
