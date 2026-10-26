"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon, PlusIcon, XIcon } from "@/components/icons";
import { claimBoard } from "@/lib/api";
import { boardsQueryKey } from "@/hooks/useBoards";

/**
 * Modal for claiming an unowned board through the FastAPI backend.
 *
 * @param {{ open: boolean, onClose: () => void }} props
 */
export default function AddBoardDialog({ open, onClose }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [boardId, setBoardId] = useState("");
  const inputRef = useRef(null);
  const pendingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const resetRef = useRef(null);

  const mutation = useMutation({
    mutationFn: (id) => claimBoard(id),
    onSuccess: async (_data, claimedBoardId) => {
      await queryClient.invalidateQueries({ queryKey: boardsQueryKey });
      onClose();
      router.push(`/boards/${encodeURIComponent(claimedBoardId)}`);
    },
  });

  pendingRef.current = mutation.isPending;
  onCloseRef.current = onClose;
  resetRef.current = mutation.reset;

  useEffect(() => {
    if (!open) return;

    setBoardId("");
    resetRef.current?.();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 40);

    function handleKeyDown(event) {
      if (event.key === "Escape" && !pendingRef.current) {
        onCloseRef.current();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!open) return null;

  function handleBackdropMouseDown(event) {
    if (event.target === event.currentTarget && !mutation.isPending) {
      onClose();
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const trimmedBoardId = boardId.trim();
    if (!trimmedBoardId || mutation.isPending) return;
    mutation.mutate(trimmedBoardId);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-board-title"
        className="w-full max-w-md animate-fade-in rounded-t-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-600/20">
              <PlusIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 id="add-board-title" className="text-lg font-semibold text-slate-900">
                Add an extension board
              </h2>
              <p className="text-sm text-slate-500">Claim an unowned extension board.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close dialog"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
          <div>
            <label htmlFor="board-id" className="block text-sm font-medium text-slate-700">
              Extension board ID
            </label>
            <input
              ref={inputRef}
              id="board-id"
              name="board-id"
              type="text"
              required
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={boardId}
              onChange={(event) => setBoardId(event.target.value)}
              disabled={mutation.isPending}
              placeholder="e.g. relayboard-a1b2c3d4"
              className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 shadow-sm outline-none transition placeholder:font-sans placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Find this in the extension board&apos;s setup log after it connects. Extension board
              IDs are case-sensitive.
            </p>
          </div>

          {mutation.isError ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
            >
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{mutation.error?.message || "Could not claim this extension board."}</span>
            </div>
          ) : null}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!boardId.trim() || mutation.isPending}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mutation.isPending ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden="true"
                  />
                  Claiming…
                </>
              ) : (
                "Claim board"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
