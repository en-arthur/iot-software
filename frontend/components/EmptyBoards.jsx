import { ChipIcon } from "@/components/icons";

/**
 * Friendly empty state for the boards list.
 *
 * @param {{ onAddBoard: () => void }} props
 */
export default function EmptyBoards({ onAddBoard }) {
  return (
    <div className="mt-8 overflow-hidden rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-600/20">
        <ChipIcon className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-slate-900">No board yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        Power on your extension board and wait for it to come online. Then claim it with the
        board ID printed in its setup log.
      </p>
      <button
        type="button"
        onClick={onAddBoard}
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
      >
        Add your first board
      </button>
      <p className="mt-4 text-xs text-slate-400">
        You can only claim a board that hasn&apos;t been claimed yet.
      </p>
    </div>
  );
}
