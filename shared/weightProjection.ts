/**
 * Weight loss projection math — shared between client and server.
 *
 * Model: weight_at_week_n = startWeight × (1 - rate)^n
 * where rate is a fraction of body weight lost per week.
 */

export type ProjectionRate = "slow" | "steady" | "aggressive";

export const PROJECTION_RATES: Record<ProjectionRate, number> = {
  slow: 0.005,        // 0.5% per week
  steady: 0.0075,     // 0.75% per week
  aggressive: 0.01,   // 1% per week
};

export const PROJECTION_LABELS: Record<ProjectionRate, string> = {
  slow: "0.5% / wk",
  steady: "0.75% / wk",
  aggressive: "1% / wk",
};

export interface ProjectionPoint {
  week: number;
  date: string;          // YYYY-MM-DD
  weightKg: number;      // rounded to 1 decimal
}

export interface ProjectionSeries {
  rate: ProjectionRate;
  ratePct: number;       // 0.5, 0.75, 1.0
  series: ProjectionPoint[];
}

/** Add days to a YYYY-MM-DD string, returns YYYY-MM-DD. */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Generate three weight projection series at slow/steady/aggressive rates.
 *
 * @param startWeightKg starting body weight in kg
 * @param startDate YYYY-MM-DD anchor date (week 0)
 * @param weeks number of weeks to project (inclusive of week 0)
 */
export function projectWeights(
  startWeightKg: number,
  startDate: string,
  weeks: number,
): ProjectionSeries[] {
  return (Object.keys(PROJECTION_RATES) as ProjectionRate[]).map((rate) => {
    const r = PROJECTION_RATES[rate];
    const series: ProjectionPoint[] = [];
    for (let n = 0; n <= weeks; n++) {
      const weightKg = startWeightKg * Math.pow(1 - r, n);
      series.push({
        week: n,
        date: addDays(startDate, n * 7),
        weightKg: Math.round(weightKg * 10) / 10,
      });
    }
    return { rate, ratePct: r * 100, series };
  });
}

/**
 * Given a target weight and rate, compute how many weeks to reach it.
 * Returns Infinity if rate is zero or target >= start.
 */
export function weeksToTarget(
  startWeightKg: number,
  targetWeightKg: number,
  rate: ProjectionRate,
): number {
  if (targetWeightKg >= startWeightKg) return 0;
  const r = PROJECTION_RATES[rate];
  if (r <= 0) return Infinity;
  // targetWeight = startWeight × (1-r)^n  →  n = ln(target/start) / ln(1-r)
  return Math.ceil(Math.log(targetWeightKg / startWeightKg) / Math.log(1 - r));
}

/**
 * Given a target weight and target date, compute the required rate.
 * Returns the rate as a fraction per week. May exceed the standard 0.5–1% range.
 */
export function requiredRatePerWeek(
  startWeightKg: number,
  targetWeightKg: number,
  startDate: string,
  targetDate: string,
): number {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(targetDate + "T00:00:00");
  const weeks = Math.max((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000), 0.1);
  if (targetWeightKg >= startWeightKg) return 0;
  // (1-r)^weeks = target/start  →  r = 1 - (target/start)^(1/weeks)
  return 1 - Math.pow(targetWeightKg / startWeightKg, 1 / weeks);
}
