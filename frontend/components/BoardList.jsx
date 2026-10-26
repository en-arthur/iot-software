"use client";

import { useState } from "react";
import AddBoardDialog from "@/components/AddBoardDialog";
import BoardCard from "@/components/BoardCard";
import EmptyBoards from "@/components/EmptyBoards";
import ErrorState from "@/components/ErrorState";
import { BoardGridSkeleton } from "@/components/Skeletons";
import { PlusIcon, RefreshIcon } from "@/components/icons";
import { useBoards } from "@/hooks/useBoards";

export default function BoardList() {
  const { data: boards, isPending, isError, error, refetch, isFetching } = useBoards();
  const [dialogOpen, setDialogOpen] = useState(false);

  const onlineCount = (boards ?? []).filter(
    (board) => String(board.status ?? "").toLowerCase() === "online"
  ).length;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Overview
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            Your board
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Live sensor values and relay controls for your extension board.
          </p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Refresh board"
            title="Refresh board"
          >
            <RefreshIcon className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 sm:flex-none"
          >
            <PlusIcon className="h-4 w-4" />
            Add board
          </button>
        </div>
      </div>

      {isPending ? <BoardGridSkeleton /> : null}

      {isError ? (
        <ErrorState
          className="mt-8"
          title="Couldn't load your board"
          message={
            error?.message ||
            "Check your connection and make sure your Supabase project is configured."
          }
          onRetry={() => refetch()}
        />
      ) : null}

      {!isPending && !isError && boards?.length === 0 ? (
        <EmptyBoards onAddBoard={() => setDialogOpen(true)} />
      ) : null}

      {!isPending && !isError && boards?.length > 0 ? (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-500">
            <span>
              <span className="font-semibold text-slate-900">{boards.length}</span>{" "}
              {boards.length === 1 ? "board" : "boards"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              <span>
                <span className="font-semibold text-slate-900">{onlineCount}</span> online
              </span>
            </span>
          </div>

          <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {boards.map((board) => (
              <BoardCard key={board.id} board={board} />
            ))}
          </ul>
        </>
      ) : null}

      <AddBoardDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
