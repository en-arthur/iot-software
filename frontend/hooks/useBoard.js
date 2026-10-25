import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * @typedef {Object} LatestReading
 * @property {string} board_id
 * @property {string} sensor
 * @property {number | string} value
 * @property {string} ts
 */

/**
 * @typedef {Object} RelayState
 * @property {string} board_id
 * @property {number} relay_number
 * @property {"on" | "off" | string} state
 * @property {string} updated_at
 */

/**
 * @typedef {Object} BoardDetailData
 * @property {import("@/hooks/useBoards").Board} board
 * @property {LatestReading[]} readings
 * @property {RelayState[]} relays
 */

class BoardNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "BoardNotFoundError";
    this.status = 404;
  }
}

/**
 * @param {string} boardId
 * @returns {Promise<BoardDetailData>}
 */
async function fetchBoardDetail(boardId) {
  const supabase = createClient();

  const [boardResult, readingsResult, relaysResult] = await Promise.all([
    supabase
      .from("boards")
      .select("id, name, owner_id, status, last_seen")
      .eq("id", boardId)
      .single(),
    supabase
      .from("latest_readings")
      .select("board_id, sensor, value, ts")
      .eq("board_id", boardId),
    supabase
      .from("relay_states")
      .select("board_id, relay_number, state, updated_at")
      .eq("board_id", boardId)
      .order("relay_number", { ascending: true }),
  ]);

  if (boardResult.error) {
    if (boardResult.error.code === "PGRST116") {
      throw new BoardNotFoundError("Board not found, or you don't have access to it.");
    }
    throw boardResult.error;
  }

  if (readingsResult.error) throw readingsResult.error;
  if (relaysResult.error) throw relaysResult.error;

  // latest_readings is expected to hold one row per sensor. Deduplicate
  // defensively by keeping the newest timestamp.
  const readingsBySensor = new Map();
  (readingsResult.data ?? []).forEach((reading) => {
    const existing = readingsBySensor.get(reading.sensor);
    if (!existing || new Date(reading.ts).getTime() > new Date(existing.ts).getTime()) {
      readingsBySensor.set(reading.sensor, reading);
    }
  });

  const relaysByNumber = new Map();
  (relaysResult.data ?? []).forEach((relay) => {
    relaysByNumber.set(relay.relay_number, relay);
  });

  return {
    board: boardResult.data,
    readings: Array.from(readingsBySensor.values()).sort((a, b) =>
      a.sensor.localeCompare(b.sensor)
    ),
    relays: Array.from(relaysByNumber.values()).sort(
      (a, b) => a.relay_number - b.relay_number
    ),
  };
}

/**
 * @param {string} boardId
 * @returns {unknown[]}
 */
export function boardQueryKey(boardId) {
  return ["board", boardId];
}

/**
 * Board metadata, latest sensor readings, and confirmed relay states.
 *
 * @param {string} boardId
 */
export function useBoard(boardId) {
  return useQuery({
    queryKey: boardQueryKey(boardId),
    queryFn: () => fetchBoardDetail(boardId),
    enabled: Boolean(boardId),
    refetchInterval: 60 * 1000,
  });
}
