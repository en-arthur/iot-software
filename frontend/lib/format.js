const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const RELATIVE_DIVISIONS = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
});

const dayTimeFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const fullDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "medium",
});

/**
 * Format a timestamp as a short relative label such as "2 min ago".
 *
 * @param {string | number | Date | null | undefined} value
 * @param {number} [now]
 * @returns {string}
 */
export function formatRelativeTime(value, now = Date.now()) {
  if (!value) return "never";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "unknown";

  let duration = (timestamp - now) / 1000;

  if (Math.abs(duration) < 5) return "just now";

  for (const division of RELATIVE_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return relativeTimeFormatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return "unknown";
}

/**
 * Format a timestamp for a tooltip.
 *
 * @param {string | number | Date | null | undefined} value
 * @returns {string}
 */
export function formatDateTime(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return fullDateTimeFormatter.format(date);
}

/**
 * Format a timestamp for a chart x-axis.
 *
 * @param {string | number | Date} value
 * @param {"1h" | "24h" | "7d"} range
 * @returns {string}
 */
export function formatChartTime(value, range) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  if (range === "7d") return dayTimeFormatter.format(date);
  return timeFormatter.format(date);
}

/**
 * Format a timestamp for a chart tooltip.
 *
 * @param {string | number | Date} value
 * @returns {string}
 */
export function formatChartTooltipTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return fullDateTimeFormatter.format(date);
}

/**
 * Format a numeric sensor value without noisy decimal places.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";

  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return String(value);

  if (Number.isInteger(number)) return number.toLocaleString("en-US");

  const absolute = Math.abs(number);
  const maximumFractionDigits = absolute < 1 ? 3 : absolute < 100 ? 2 : 1;

  return number.toLocaleString("en-US", { maximumFractionDigits });
}

/**
 * Turn a sensor key such as "soil_moisture" into "Soil Moisture".
 *
 * @param {string | null | undefined} sensor
 * @returns {string}
 */
export function formatSensorName(sensor) {
  if (!sensor) return "Unknown sensor";

  return String(sensor)
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * Make long board IDs easier to scan.
 *
 * @param {string | null | undefined} id
 * @param {number} [visibleCharacters]
 * @returns {string}
 */
export function truncateId(id, visibleCharacters = 12) {
  if (!id) return "";
  const value = String(id);
  if (value.length <= visibleCharacters) return value;
  return `${value.slice(0, visibleCharacters)}…`;
}
