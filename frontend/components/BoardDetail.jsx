"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import ErrorState from "@/components/ErrorState";
import RelativeTime from "@/components/RelativeTime";
import RelayToggle from "@/components/RelayToggle";
import StatusBadge from "@/components/StatusBadge";
import { BoardDetailSkeleton, ChartSkeleton } from "@/components/Skeletons";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  RefreshIcon,
} from "@/components/icons";
import { useBoard } from "@/hooks/useBoard";
import { useReadings } from "@/hooks/useReadings";
import { formatSensorName, formatValue } from "@/lib/format";
import { DEFAULT_RANGE, RANGE_OPTIONS } from "@/lib/readings";

const SensorChart = dynamic(() => import("@/components/SensorChart"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

/**
 * @param {{
 *   value: string,
 *   onChange: (range: "1h" | "24h" | "7d") => void,
 * }} props
 */
function RangeSelector({ value, onChange }) {
  return (
    <div
      className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
      role="group"
      aria-label="History time range"
    >
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            value === option.value
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          {option.shortLabel}
        </button>
      ))}
    </div>
  );
}

/**
 * Board detail: live readings, confirmed relay states, and sensor history.
 *
 * @param {{ boardId: string }} props
 */
export default function BoardDetail({ boardId }) {
  const [range, setRange] = useState(DEFAULT_RANGE);

  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = useBoard(boardId);

  const readingsQuery = useReadings(boardId, range);

  if (isPending) {
    return <BoardDetailSkeleton />;
  }

  if (isError || !data) {
    const notFound = error?.status === 404;

    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <Link
          href="/boards"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          All boards
        </Link>
        <ErrorState
          className="mt-6"
          title={notFound ? "Board not found" : "Couldn't load this board"}
          message={
            notFound
              ? "This board doesn't exist, or it belongs to another account."
              : error?.message ||
                "Check your connection and make sure your Supabase project is configured."
          }
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const { board, readings, relays } = data;
  const isOnline = String(board.status ?? "").toLowerCase() === "online";
  const refreshing = isFetching || readingsQuery.isFetching;
  const series = readingsQuery.data?.series ?? [];

  function handleRefresh() {
    refetch();
    readingsQuery.refetch();
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Link
        href="/boards"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        All boards
      </Link>

      <header className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              {board.name || "Unnamed board"}
            </h1>
            <StatusBadge status={board.status} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span className="max-w-full break-all font-mono text-xs text-slate-400" title={board.id}>
              {board.id}
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" aria-hidden="true" />
            <span>
              {board.last_seen ? (
                <>
                  Last seen{" "}
                  <RelativeTime
                    value={board.last_seen}
                    className="font-medium text-slate-700"
                  />
                </>
              ) : (
                "Never seen"
              )}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshIcon className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      {!isOnline ? (
        <div
          role="status"
          className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900"
        >
          <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p>
            <span className="font-semibold">Board offline.</span> Relay controls are disabled until
            it reconnects. Sensor values show the last data received.
          </p>
        </div>
      ) : null}

      <section className="mt-8" aria-labelledby="live-readings-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="live-readings-heading"
              className="text-lg font-semibold tracking-tight text-slate-900"
            >
              Live readings
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Latest value per sensor, updated as the board publishes.
            </p>
          </div>
          <span className="text-xs text-slate-400">
            {readings.length} {readings.length === 1 ? "sensor" : "sensors"}
          </span>
        </div>

        {readings.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">No sensor data yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Values will appear here as soon as the board publishes to MQTT.
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {readings.map((reading) => (
              <li
                key={reading.sensor}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {formatSensorName(reading.sensor)}
                  </p>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      isOnline ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
                  {formatValue(reading.value)}
                </p>
                <p
                  className="mt-1 truncate font-mono text-[11px] text-slate-400"
                  title={reading.sensor}
                >
                  {reading.sensor}
                </p>
                <p className="mt-3 text-xs text-slate-400">
                  Updated <RelativeTime value={reading.ts} />
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="relays-heading">
        <div>
          <h2
            id="relays-heading"
            className="text-lg font-semibold tracking-tight text-slate-900"
          >
            Relays
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Switches follow the state confirmed by the board, not the click.
          </p>
        </div>

        {relays.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">No relay states yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Relays appear here once the board reports its relay_states rows.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {relays.map((relay) => (
              <RelayToggle
                key={relay.relay_number}
                boardId={board.id}
                relay={relay}
                disabled={!isOnline}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10" aria-labelledby="history-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="history-heading"
              className="text-lg font-semibold tracking-tight text-slate-900"
            >
              History
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Downsampled to keep charts fast. Refreshes automatically.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {readingsQuery.isFetching && !readingsQuery.isPending ? (
              <span className="text-xs text-slate-400">Refreshing…</span>
            ) : null}
            <RangeSelector value={range} onChange={setRange} />
          </div>
        </div>

        <div className="mt-4">
          {readingsQuery.isPending ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <ChartSkeleton />
              <ChartSkeleton />
            </div>
          ) : null}

          {readingsQuery.isError ? (
            <ErrorState
              title="Couldn't load history"
              message={readingsQuery.error?.message || "Please try again."}
              onRetry={() => readingsQuery.refetch()}
            />
          ) : null}

          {!readingsQuery.isPending &&
          !readingsQuery.isError &&
          series.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">No history in this range</p>
              <p className="mt-1 text-sm text-slate-500">
                Try a wider time range, or wait for the next reading.
              </p>
            </div>
          ) : null}

          {!readingsQuery.isPending && !readingsQuery.isError && series.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {series.map((sensorSeries) => (
                <SensorChart
                  key={sensorSeries.sensor}
                  sensor={sensorSeries.sensor}
                  data={sensorSeries.points}
                  range={range}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
