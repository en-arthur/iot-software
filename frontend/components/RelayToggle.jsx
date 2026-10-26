"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { sendRelayCommand } from "@/lib/api";

const CONFIRMATION_TIMEOUT_MS = 5000;

/**
 * One relay switch.
 *
 * The checked value always comes from the confirmed relay_states row. Sending
 * a command only enters a pending state; the switch flips when the Realtime
 * event lands in the query cache. If that doesn't happen within 5 seconds, the
 * pending state is cleared and the last confirmed value remains on screen.
 *
 * @param {{
 *   boardId: string,
 *   relay: import("@/hooks/useBoard").RelayState,
 *   disabled?: boolean,
 * }} props
 */
export default function RelayToggle({ boardId, relay, disabled = false }) {
  const [pendingTarget, setPendingTarget] = useState(null);
  const [error, setError] = useState("");
  const timeoutRef = useRef(null);
  const timedOutTargetRef = useRef(null);

  const confirmedState = String(relay.state ?? "").toLowerCase() === "on" ? "on" : "off";
  const isOn = confirmedState === "on";
  const targetState = isOn ? "off" : "on";
  const relayNumber = relay.relay_number;

  const mutation = useMutation({
    mutationFn: (state) => sendRelayCommand(boardId, relayNumber, state),
    onSuccess: (_data, state) => {
      setError("");
      setPendingTarget(state);
      timedOutTargetRef.current = null;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        timedOutTargetRef.current = state;
        setPendingTarget(null);
        setError(
          "No confirmation from the board within 5 seconds. Showing the last confirmed state."
        );
      }, CONFIRMATION_TIMEOUT_MS);
    },
    onError: (caughtError) => {
      setPendingTarget(null);
      timedOutTargetRef.current = null;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (caughtError?.status === 403) {
        setError("Not your board");
      } else if (caughtError?.status === 409) {
        setError("Extension board is offline");
      } else {
        setError(caughtError?.message || "Could not send the relay command.");
      }
    },
  });

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // A Realtime relay_states event updates `relay.state` through the query
  // cache. Only that confirmation clears the pending state.
  useEffect(() => {
    if (!pendingTarget) {
      // A confirmation can arrive after the 5 second timeout. Clear the stale
      // error when the switch finally catches up.
      if (timedOutTargetRef.current && confirmedState === timedOutTargetRef.current) {
        timedOutTargetRef.current = null;
        setError("");
      }
      return;
    }

    if (confirmedState !== pendingTarget) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    timedOutTargetRef.current = null;
    setPendingTarget(null);
    setError("");
  }, [confirmedState, pendingTarget]);

  const isBusy = mutation.isPending || pendingTarget !== null;
  const isDisabled = disabled || isBusy;

  let statusText = isOn ? "On" : "Off";
  if (disabled) {
    statusText = `${isOn ? "On" : "Off"} · board offline`;
  } else if (mutation.isPending) {
    statusText = "Sending command…";
  } else if (pendingTarget) {
    statusText = `Waiting for the board to confirm ${pendingTarget}…`;
  }

  function handleToggle() {
    if (isDisabled) return;
    setError("");
    mutation.mutate(targetState);
  }

  return (
    <div
      className={`rounded-2xl border p-5 shadow-card transition ${
        disabled
          ? "border-slate-200 bg-slate-50 opacity-60 grayscale"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Relay {relayNumber}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            {isBusy ? (
              <span
                className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
                aria-hidden="true"
              />
            ) : null}
            <span>{statusText}</span>
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          aria-label={`Relay ${relayNumber}: ${isOn ? "on" : "off"}`}
          onClick={handleToggle}
          disabled={isDisabled}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed ${
            disabled ? "bg-slate-300" : isOn ? "bg-emerald-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-1 ring-slate-900/5 transition-transform ${
              isOn ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {pendingTarget ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Command accepted. The switch will flip when the board reports the new state.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-700 ring-1 ring-inset ring-red-200"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
