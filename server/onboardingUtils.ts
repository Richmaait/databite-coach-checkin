import { ENV } from "./env";

const SHEET_ID = "1gaBzRTfxwaWc3iEIa4NAqffAPJJpc47A7B_1yffyduI";
const SHEET_TAB = "ONBOARDING";

let _cachedRows: string[][] | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchOnboardingRows(): Promise<string[][]> {
  if (_cachedRows && Date.now() - _cacheTime < CACHE_TTL_MS) return _cachedRows;
  const apiKey = ENV.googleSheetsApiKey;
  if (!apiKey) throw new Error("GOOGLE_SHEETS_API_KEY not set");
  const range = `${SHEET_TAB}!B6:O1000`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?key=${apiKey}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
      const data = await res.json();
      _cachedRows = data.values ?? [];
      _cacheTime = Date.now();
      return _cachedRows;
    } catch (err) {
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      else throw err;
    }
  }
  return [];
}

function parseDDMMYYYY(s: string): string | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function toBool(v: string): boolean {
  const u = (v ?? "").trim().toUpperCase();
  return u === "TRUE" || u === "YES";
}

export interface OnboardingRow {
  clientName: string;
  datePaid: string | null;
  dateDue: string | null;
  appInviteSent: boolean;
  contractSent: boolean;
  requestedPhotos: string | null;
  mealPlan: boolean;
  training: boolean;
  sentToRich: boolean;
  welcomeVideo: boolean;
  sentToClient: string | null;
  subscription: boolean;
  coach: string;
  notes: string;
}

export async function fetchOnboardingClients(): Promise<OnboardingRow[]> {
  const rows = await fetchOnboardingRows();
  const results: OnboardingRow[] = [];
  for (const row of rows) {
    const name = (row[0] ?? "").trim();
    if (!name) continue;
    results.push({
      clientName: name,
      datePaid: parseDDMMYYYY(row[1] ?? ""),
      dateDue: parseDDMMYYYY(row[2] ?? ""),
      appInviteSent: toBool(row[3] ?? ""),
      contractSent: toBool(row[4] ?? ""),
      requestedPhotos: parseDDMMYYYY(row[5] ?? ""),
      mealPlan: toBool(row[6] ?? ""),
      training: toBool(row[7] ?? ""),
      sentToRich: toBool(row[8] ?? ""),
      welcomeVideo: toBool(row[9] ?? ""),
      sentToClient: parseDDMMYYYY(row[10] ?? ""),
      subscription: toBool(row[11] ?? ""),
      coach: (row[12] ?? "").trim(),
      notes: (row[13] ?? "").trim(),
    });
  }
  return results;
}
