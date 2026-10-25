"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { boardQueryKey } from "@/hooks/useBoard";
import { boardsQueryKey } from "@/hooks/useBoards";

/**
 * @typedef {"connecting" | "connected" | "reconnecting" | "disconnected"} RealtimeStatus
 */

/**
 * @typedef {Object} RealtimeContextValue
 * @property {RealtimeStatus} status
 * @property {string | null} lastEventAt
 */

/** @type {import("react").Context<RealtimeContextValue>} */
const RealtimeContext = createContext({
  status: "connecting",
  lastEventAt: null,
});

/**
 * Read the shared Realtime connection status.
 *
 * @returns {RealtimeContextValue}
 */
export function useRealtime() {
  return useContext(RealtimeContext);
}

/**
 * @param {Array<{ sensor: string }>} readings
 * @returns {Array<{ sensor: string }>}
 */
function sortReadings(readings) {
  return readings.slice().sort((a, b) => String(a.sensor).localeCompare(String(b.sensor)));
}

/**
 * @param {Array<{ relay_number: number }>} relays
 * @returns {Array<{ relay_number: number }>}
 */
function sortRelays(relays) {
  return relays.slice().sort((a, b) => Number(a.relay_number) - Number(b.relay_number));
}

/**
 * Merge a boards Realtime event into the boards list and board detail cache.
 *
 * @param {import("@tanstack/react-query").QueryClient} queryClient
 * @param {{ eventType: string, new: Record<string, unknown>, old: Record<string, unknown> }} payload
 */
function applyBoardChange(queryClient, payload) {
  const nextBoard = payload.new;
  const previousBoard = payload.old;

  queryClient.setQueryData(boardsQueryKey, (current) => {
    if (!Array.isArray(current)) return current;

    if (payload.eventType === "DELETE") {
      if (!previousBoard?.id) return current;
      return current.filter((board) => board.id !== previousBoard.id);
    }

    if (!nextBoard?.id) return current;

    const exists = current.some((board) => board.id === nextBoard.id);
    const next = exists
      ? current.map((board) =>
          board.id === nextBoard.id ? { ...board, ...nextBoard } : board
        )
      : [...current, nextBoard];

    return next.sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
  });

  if (payload.eventType === "DELETE" && previousBoard?.id) {
    queryClient.removeQueries({ queryKey: boardQueryKey(previousBoard.id) });
    return;
  }

  if (nextBoard?.id) {
    queryClient.setQueryData(boardQueryKey(nextBoard.id), (current) => {
      if (!current) return current;
      return { ...current, board: { ...current.board, ...nextBoard } };
    });
  }
}

/**
 * Merge a latest_readings event into the cached board detail.
 *
 * @param {import("@tanstack/react-query").QueryClient} queryClient
 * @param {{ eventType: string, new: Record<string, unknown>, old: Record<string, unknown> }} payload
 */
function applyReadingChange(queryClient, payload) {
  const nextReading = payload.new;
  const previousReading = payload.old;
  const boardId = nextReading?.board_id ?? previousReading?.board_id;

  if (!boardId) return;

  const sensor = nextReading?.sensor ?? previousReading?.sensor;

  if (!sensor) {
    queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) });
    return;
  }

  queryClient.setQueryData(boardQueryKey(boardId), (current) => {
    if (!current) return current;

    const readings = (current.readings ?? []).filter((reading) => reading.sensor !== sensor);
    if (payload.eventType !== "DELETE" && nextReading) readings.push(nextReading);

    return { ...current, readings: sortReadings(readings) };
  });
}

/**
 * Merge a relay_states event into the cached board detail. Relay toggles read
 * their checked value from this cache, so this event is what confirms a
 * command.
 *
 * @param {import("@tanstack/react-query").QueryClient} queryClient
 * @param {{ eventType: string, new: Record<string, unknown>, old: Record<string, unknown> }} payload
 */
function applyRelayChange(queryClient, payload) {
  const nextRelay = payload.new;
  const previousRelay = payload.old;
  const boardId = nextRelay?.board_id ?? previousRelay?.board_id;

  if (!boardId) return;

  const relayNumber = nextRelay?.relay_number ?? previousRelay?.relay_number;

  if (relayNumber === null || relayNumber === undefined) {
    queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) });
    return;
  }

  queryClient.setQueryData(boardQueryKey(boardId), (current) => {
    if (!current) return current;

    const relays = (current.relays ?? []).filter(
      (relay) => Number(relay.relay_number) !== Number(relayNumber)
    );

    if (payload.eventType !== "DELETE" && nextRelay) relays.push(nextRelay);

    return { ...current, relays: sortRelays(relays) };
  });
}

/**
 * One Realtime channel for the whole app. It subscribes to boards,
 * latest_readings, and relay_states, patches the TanStack Query cache, and
 * reconnects with exponential backoff when the socket drops.
 *
 * The raw readings table is intentionally not subscribed to; history is
 * polled by useReadings instead.
 *
 * @param {{ children: React.ReactNode }} props
 */
export default function RealtimeProvider({ children }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(/** @type {RealtimeStatus} */ ("connecting"));
  const [lastEventAt, setLastEventAt] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    // Create the browser client inside the effect so it never runs during SSR.
    const supabase = createClient();
    let disposed = false;
    let currentChannel = null;
    let reconnectTimer = null;
    let retryCount = 0;
    let connectionAttempt = 0;
    let hasConnectedOnce = false;
    let lastUserId = null;

    const markEvent = () => {
      setLastEventAt(new Date().toISOString());
    };

    const teardown = async () => {
      const channel = currentChannel;
      currentChannel = null;

      if (channel) {
        try {
          await supabase.removeChannel(channel);
        } catch {
          // The socket may already be gone; there is nothing else to clean up.
        }
      }
    };

    const scheduleReconnect = () => {
      if (disposed || reconnectTimer) return;

      setStatus("reconnecting");
      const delay = Math.min(30_000, 1_000 * 2 ** retryCount);
      retryCount = Math.min(retryCount + 1, 5);

      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    const connect = async () => {
      if (disposed) return;

      const attempt = ++connectionAttempt;
      await teardown();

      if (disposed || attempt !== connectionAttempt) return;

      const { data, error } = await supabase.auth.getSession();

      if (disposed || attempt !== connectionAttempt) return;

      if (error || !data.session) {
        setStatus("disconnected");
        return;
      }

      // Realtime RLS uses this token. supabase-js also refreshes it on auth
      // events, but setting it explicitly before each (re)subscribe avoids
      // races after a reconnect.
      try {
        await supabase.realtime.setAuth(data.session.access_token);
      } catch {
        // The channel can still be attempted; a missing token will surface as
        // a channel error and trigger the normal reconnect path.
      }

      if (disposed || attempt !== connectionAttempt) return;

      setStatus(hasConnectedOnce || retryCount > 0 ? "reconnecting" : "connecting");

      // A unique topic per attempt avoids reusing a channel that is still
      // being torn down after an error.
      const channel = supabase.channel(`relayboard-realtime-${attempt}`);
      currentChannel = channel;

      channel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "boards" },
          (payload) => {
            markEvent();
            applyBoardChange(queryClient, payload);
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "latest_readings" },
          (payload) => {
            markEvent();
            applyReadingChange(queryClient, payload);
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "relay_states" },
          (payload) => {
            markEvent();
            applyRelayChange(queryClient, payload);
          }
        )
        .subscribe((channelStatus) => {
          if (disposed || currentChannel !== channel) return;

          if (channelStatus === "SUBSCRIBED") {
            retryCount = 0;
            setStatus("connected");

            // Events can be missed while disconnected. Refetch once on every
            // successful reconnection (not on the first load, which already
            // fetches through TanStack Query).
            if (hasConnectedOnce) {
              queryClient.invalidateQueries({ queryKey: boardsQueryKey });
              queryClient.invalidateQueries({ queryKey: ["board"] });
            }
            hasConnectedOnce = true;
            return;
          }

          if (channelStatus === "CHANNEL_ERROR" || channelStatus === "TIMED_OUT") {
            currentChannel = null;
            setStatus("reconnecting");
            supabase.removeChannel(channel).catch(() => {});
            scheduleReconnect();
            return;
          }

          if (channelStatus === "CLOSED") {
            currentChannel = null;
            scheduleReconnect();
          }
        });
    };

    const reconnectNow = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      retryCount = 0;
      connect();
    };

    const handleOnline = () => reconnectNow();
    const handleOffline = () => {
      connectionAttempt += 1;
      setStatus("disconnected");
      teardown();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && currentChannel?.state !== "joined") {
        reconnectNow();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (disposed) return;

      if (event === "SIGNED_OUT" || !session) {
        connectionAttempt += 1;
        teardown();
        lastUserId = null;
        queryClient.clear();
        setStatus("disconnected");
        return;
      }

      if (event === "TOKEN_REFRESHED") {
        supabase.realtime.setAuth(session.access_token).catch(() => {});
        return;
      }

      if (event === "SIGNED_IN") {
        const userId = session.user?.id ?? null;

        // Only clear when a different account signs in. A normal sign-in has
        // no cached data to discard, and clearing here would duplicate the
        // first fetch.
        if (lastUserId && userId && lastUserId !== userId) {
          queryClient.clear();
        }
        lastUserId = userId;
        reconnectNow();
      }
    });

    connect();

    return () => {
      disposed = true;
      connectionAttempt += 1;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      authListener.subscription.unsubscribe();
      teardown();
    };
  }, [queryClient]);

  const value = useMemo(() => ({ status, lastEventAt }), [status, lastEventAt]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
