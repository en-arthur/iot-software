"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatChartTime,
  formatChartTooltipTime,
  formatSensorName,
  formatSensorValue,
  formatValue,
} from "@/lib/format";

/**
 * @param {{
 *   active?: boolean,
 *   payload?: Array<{ value?: number }>,
 *   label?: string,
 *   sensor: string,
 * }} props
 */
function ChartTooltip({ active, payload, label, sensor }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs text-slate-500">{formatChartTooltipTime(label)}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
        {formatSensorValue(sensor, payload[0]?.value)}
      </p>
      <p className="text-xs text-slate-500">{formatSensorName(sensor)}</p>
    </div>
  );
}

/**
 * History line chart for one sensor. Loaded dynamically with ssr disabled by
 * BoardDetail so Recharts only runs in the browser.
 *
 * @param {{
 *   sensor: string,
 *   data: Array<{ ts: string, value: number }>,
 *   range: "1h" | "24h" | "7d",
 * }} props
 */
export default function SensorChart({ sensor, data, range }) {
  const points = data ?? [];
  const latestPoint = points[points.length - 1];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">
            {formatSensorName(sensor)}
          </h3>
          <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{sensor}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-slate-900">
            {formatSensorValue(sensor, latestPoint?.value)}
          </p>
          <p className="text-[11px] text-slate-400">{points.length} pts</p>
        </div>
      </div>

      <div className="mt-4 h-56 w-full" role="img" aria-label={`${sensor} history chart`}>
        {points.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 text-center text-sm text-slate-500">
            No readings in this range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="ts"
                tickFormatter={(value) => formatChartTime(value, range)}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                minTickGap={36}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(value) => formatValue(value)}
                domain={["auto", "auto"]}
              />
              <Tooltip
                content={<ChartTooltip sensor={sensor} />}
                cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#059669"
                strokeWidth={2}
                dot={points.length === 1 ? { r: 3, fill: "#059669", strokeWidth: 0 } : false}
                activeDot={{ r: 4, fill: "#059669", stroke: "#ffffff", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
