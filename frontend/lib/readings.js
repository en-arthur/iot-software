/**
 * @typedef {Object} ReadingPoint
 * @property {string} ts
 * @property {number} value
 */

/**
 * @typedef {Object} SensorSeries
 * @property {string} sensor
 * @property {ReadingPoint[]} points
 * @property {number} rawCount
 */

export const RANGE_OPTIONS = [
  {
    value: "1h",
    label: "1 hour",
    shortLabel: "1h",
    milliseconds: 60 * 60 * 1000,
    refreshInterval: 30 * 1000,
  },
  {
    value: "24h",
    label: "24 hours",
    shortLabel: "24h",
    milliseconds: 24 * 60 * 60 * 1000,
    refreshInterval: 60 * 1000,
  },
  {
    value: "7d",
    label: "7 days",
    shortLabel: "7d",
    milliseconds: 7 * 24 * 60 * 60 * 1000,
    refreshInterval: 120 * 1000,
  },
];

export const DEFAULT_RANGE = "24h";

/**
 * Maximum number of rows requested from PostgREST for a history query.
 * Supabase projects may cap this lower; the chart still downsamples whatever
 * comes back.
 */
export const HISTORY_FETCH_LIMIT = 3000;

/**
 * Maximum plotted points per sensor. Keeps SVG charts responsive on phones.
 */
export const MAX_POINTS_PER_SENSOR = 120;

/**
 * @param {string} range
 * @returns {(typeof RANGE_OPTIONS)[number]}
 */
export function getRangeOption(range) {
  return RANGE_OPTIONS.find((option) => option.value === range) ?? RANGE_OPTIONS[1];
}

/**
 * Bucket-average a series down to at most `maxPoints` points. The final real
 * point is always kept so the chart ends at the newest reading.
 *
 * @param {ReadingPoint[]} points
 * @param {number} [maxPoints]
 * @returns {ReadingPoint[]}
 */
export function downsampleSeries(points, maxPoints = MAX_POINTS_PER_SENSOR) {
  if (!Array.isArray(points) || points.length <= maxPoints) return points;

  const bucketSize = points.length / maxPoints;
  /** @type {ReadingPoint[]} */
  const sampled = [];

  for (let index = 0; index < maxPoints; index += 1) {
    const start = Math.floor(index * bucketSize);
    const end = Math.min(points.length, Math.floor((index + 1) * bucketSize));

    if (end <= start) continue;

    let sum = 0;
    let count = 0;

    for (let pointIndex = start; pointIndex < end; pointIndex += 1) {
      sum += points[pointIndex].value;
      count += 1;
    }

    const representative =
      points[Math.min(end - 1, start + Math.floor((end - start) / 2))];

    sampled.push({ ts: representative.ts, value: sum / count });
  }

  const lastPoint = points[points.length - 1];
  if (sampled.length === 0 || sampled[sampled.length - 1].ts !== lastPoint.ts) {
    sampled.push(lastPoint);
  }

  return sampled;
}

/**
 * Group raw readings by sensor, coerce values to numbers, sort by time, and
 * downsample each series.
 *
 * @param {Array<{ sensor?: string | null, value?: unknown, ts?: string | null }>} rows
 * @returns {SensorSeries[]}
 */
export function buildSensorSeries(rows) {
  /** @type {Map<string, ReadingPoint[]>} */
  const bySensor = new Map();

  (rows ?? []).forEach((row) => {
    const value = Number(row.value);
    if (!Number.isFinite(value) || !row.ts) return;
    if (Number.isNaN(new Date(row.ts).getTime())) return;

    const sensor = row.sensor || "unknown";
    const points = bySensor.get(sensor) ?? [];
    points.push({ ts: row.ts, value });
    bySensor.set(sensor, points);
  });

  return Array.from(bySensor.entries())
    .map(([sensor, points]) => {
      const sortedPoints = points
        .slice()
        .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

      return {
        sensor,
        points: downsampleSeries(sortedPoints),
        rawCount: sortedPoints.length,
      };
    })
    .sort((a, b) => a.sensor.localeCompare(b.sensor));
}
