import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * @typedef {Object} Board
 * @property {string} id
 * @property {string} name
 * @property {string | null} owner_id
 * @property {"online" | "offline" | string} status
 * @property {string | null} last_seen
 */

export const boardsQueryKey = ["boards"];

/**
 * @returns {Promise<Board[]>}
 */
async function fetchBoards() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("boards")
    .select("id, name, owner_id, status, last_seen")
    .order("name", { ascending: true });

  if (error) throw error;

  return data ?? [];
}

/**
 * All boards visible to the current user. Row Level Security limits this to
 * boards the user owns.
 */
export function useBoards() {
  return useQuery({
    queryKey: boardsQueryKey,
    queryFn: fetchBoards,
    // Realtime normally keeps this fresh; the interval is a safety net for
    // dropped connections.
    refetchInterval: 60 * 1000,
  });
}
