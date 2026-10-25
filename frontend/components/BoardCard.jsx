"use client";

import Link from "next/link";
import RelativeTime from "@/components/RelativeTime";
import StatusBadge from "@/components/StatusBadge";
import { ArrowRightIcon, ChipIcon } from "@/components/icons";

/**
 * Board summary card for the boards list.
 *
 * @param {{ board: import("@/hooks/useBoards").Board }} props
 */
export default function BoardCard({ board }) {
  const isOnline = String(board.status ?? "").toLowerCase() === "online";
  const name = board.name || "Unnamed board";

  return (
    <li>
      <Link
        href={`/boards/${encodeURIComponent(board.id)}`}
        className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition duration-150 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${
                isOnline
                  ? "bg-emerald-50 text-emerald-600 ring-emerald-600/20"
                  : "bg-slate-100 text-slate-500 ring-slate-500/10"
              }`}
            >
              <ChipIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-slate-900">{name}</h2>
              <p className="mt-0.5 truncate font-mono text-xs text-slate-400" title={board.id}>
                {board.id}
              </p>
            </div>
          </div>
          <StatusBadge status={board.status} className="shrink-0" />
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-6 text-sm">
          <span className="text-slate-500">
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
          <ArrowRightIcon className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
        </div>
      </Link>
    </li>
  );
}
