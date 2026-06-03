import { useMemo, useState } from "react";
import { useSearch } from "wouter";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { projectWeights, PROJECTION_LABELS, ProjectionRate, weeksToTarget } from "../../../shared/weightProjection";

/** Format YYYY-MM-DD → "12 Jun" */
function shortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function todayMelbourne(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Melbourne" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Preview() {
  const search = useSearch();
  const params = new URLSearchParams(search);

  const initialWeight = parseFloat(params.get("weight") || "82.5");
  const initialTarget = params.get("target") ? parseFloat(params.get("target")!) : null;
  const initialStart = params.get("start") || todayMelbourne();
  const initialWeeks = parseInt(params.get("weeks") || "24", 10);

  const [weight, setWeight] = useState(initialWeight);
  const [target, setTarget] = useState<number | "">(initialTarget ?? "");
  const [startDate, setStartDate] = useState(initialStart);
  const [weeks, setWeeks] = useState(initialWeeks);
  const [visibleRates, setVisibleRates] = useState<Record<ProjectionRate, boolean>>({
    slow: true,
    steady: true,
    aggressive: true,
  });

  const projections = useMemo(
    () => projectWeights(weight, startDate, weeks),
    [weight, startDate, weeks],
  );

  // Combine into single chart data
  const chartData = useMemo(() => {
    const max = Math.max(...projections.map((p) => p.series.length));
    const rows: Array<Record<string, number | string>> = [];
    for (let i = 0; i < max; i++) {
      const point: Record<string, number | string> = {
        week: i,
        date: projections[0]?.series[i]?.date ?? "",
        label: i === 0 ? "Start" : `W${i}`,
      };
      for (const p of projections) {
        point[p.rate] = p.series[i]?.weightKg ?? null!;
      }
      rows.push(point);
    }
    return rows;
  }, [projections]);

  const targetDates = useMemo(() => {
    if (!target || target >= weight) return null;
    return {
      slow: projections[0].series[weeksToTarget(weight, +target, "slow")]?.date,
      steady: projections[1].series[weeksToTarget(weight, +target, "steady")]?.date,
      aggressive: projections[2].series[weeksToTarget(weight, +target, "aggressive")]?.date,
    };
  }, [target, weight, projections]);

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white/90 px-4 py-6 sm:py-10">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <img src="/databite-logo-white.svg" alt="databite" className="h-9" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2" style={{ fontFamily: "'Comfortaa', cursive" }}>
            Weight loss projection
          </h1>
          <p className="text-white/50 text-sm">
            Your projected weight at different rates of loss.
          </p>
        </div>

        {/* Inputs */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1.5">Start weight (kg)</label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1.5">Target weight (kg)</label>
            <input
              type="number"
              step="0.1"
              placeholder="optional"
              value={target}
              onChange={(e) => setTarget(e.target.value ? parseFloat(e.target.value) : "")}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1.5">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1.5">Weeks to show</label>
            <input
              type="number"
              min="4"
              max="104"
              value={weeks}
              onChange={(e) => setWeeks(parseInt(e.target.value) || 24)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
            />
          </div>
        </div>

        {/* Rate toggles */}
        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {(Object.keys(PROJECTION_LABELS) as ProjectionRate[]).map((rate) => {
            const color = rate === "slow" ? "violet" : rate === "steady" ? "emerald" : "pink";
            const isOn = visibleRates[rate];
            return (
              <button
                key={rate}
                onClick={() => setVisibleRates((p) => ({ ...p, [rate]: !p[rate] }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  isOn
                    ? `bg-${color}-500/20 border-${color}-400/40 text-${color}-300`
                    : "bg-white/5 border-white/10 text-white/30"
                }`}
              >
                {PROJECTION_LABELS[rate]}
              </button>
            );
          })}
        </div>

        {/* Chart */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:p-6 mb-6">
          <ResponsiveContainer width="100%" height={350} minHeight={280}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="label"
                stroke="rgba(255,255,255,0.4)"
                tick={{ fontSize: 11 }}
                interval={Math.max(Math.floor(weeks / 8), 1)}
              />
              <YAxis
                stroke="rgba(255,255,255,0.4)"
                tick={{ fontSize: 11 }}
                domain={["auto", "auto"]}
                tickFormatter={(v) => `${v}kg`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15,15,20,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelFormatter={(label, payload) => {
                  const d = payload?.[0]?.payload?.date;
                  return d ? `${label} · ${shortDate(d)}` : label;
                }}
                formatter={(value: number, name: string) => [`${value.toFixed(1)} kg`, PROJECTION_LABELS[name as ProjectionRate] || name]}
              />
              <Legend wrapperStyle={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }} formatter={(value) => PROJECTION_LABELS[value as ProjectionRate] || value} />
              {target && +target > 0 && (
                <ReferenceLine y={+target} stroke="rgba(255,255,255,0.4)" strokeDasharray="4 4" label={{ value: `Target ${target}kg`, position: "right", fontSize: 10, fill: "rgba(255,255,255,0.6)" }} />
              )}
              {visibleRates.slow && (
                <Line type="monotone" dataKey="slow" stroke="#a78bfa" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              )}
              {visibleRates.steady && (
                <Line type="monotone" dataKey="steady" stroke="#34d399" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              )}
              {visibleRates.aggressive && (
                <Line type="monotone" dataKey="aggressive" stroke="#f472b6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Target dates */}
        {targetDates && target && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 mb-6">
            <h3 className="text-sm font-semibold text-white/80 mb-3">When you'll hit {target}kg</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-[10px] text-violet-300/70 uppercase tracking-wide mb-1">Slow · 0.5%</div>
                <div className="text-sm font-bold text-white/90">{targetDates.slow ? shortDate(targetDates.slow) : "—"}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-emerald-300/70 uppercase tracking-wide mb-1">Steady · 0.75%</div>
                <div className="text-sm font-bold text-white/90">{targetDates.steady ? shortDate(targetDates.steady) : "—"}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-pink-300/70 uppercase tracking-wide mb-1">Aggressive · 1%</div>
                <div className="text-sm font-bold text-white/90">{targetDates.aggressive ? shortDate(targetDates.aggressive) : "—"}</div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-[11px] text-white/30 mt-8">
          Rates are calculated as a percentage of current body weight per week. Actual results vary based on training, nutrition, sleep, and consistency.
        </p>
      </div>
    </div>
  );
}
