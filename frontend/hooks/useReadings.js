import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_RANGE,
  HISTORY_FETCH_LIMIT,
  buildSensorSeries,
  getRangeOption,
} from "@/lib/readings";

/**
 * @typedef {Object} ReadingsData
 * @property {import("@/lib/readings").SensorSeries[]} series
 * @property {number} totalRows
 * @property {string} since
 * @property {"1h" | "24h" | "7d"} range
 */

/**
 * History for the selected range. The raw `readings` table is never added to
 * the Realtime subscription; this query polls instead, and changing the range
 * creates a new query key.
 *
 * @param {string} boardId
 * @param {"1h" | "24h" | "7d"} [range]
 */
export function useReadings(boardId, range = DEFAULT_RANGE) {
  const rangeOption = getRangeOption(range);

  return useQuery({
    queryKey: ["readings", boardId, range],
    queryFn: async () => {
      const supabase = createClient();
      const since = new Date(Date.now() - rangeOption.milliseconds).toISOString();

      // Fetch newest-first with a hard limit, then reverse for the chart. If a
      // Supabase project caps rows below this limit, the UI still works with
      // the most recent data available.
      const { data, error } = await supabase
        .from("readings")
        .select("sensor, value, ts")
        .eq("board_id", boardId)
        .gte("ts", since)
        .order("ts", { ascending: false })
        .limit(HISTORY_FETCH_LIMIT);

      if (error) throw error;

      const rows = (data ?? []).slice().reverse();

      return {
        series: buildSensorSeries(rows),
        totalRows: rows.length,
        since,
        range,
      };
    },
    enabled: Boolean(boardId),
    refetchInterval: rangeOption.refreshInterval,
    staleTime: 30 * 1000,
  });
}
