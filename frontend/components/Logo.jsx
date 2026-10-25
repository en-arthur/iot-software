import { ChipIcon } from "@/components/icons";

/**
 * Product mark and wordmark.
 *
 * @param {{ className?: string, compact?: boolean }} props
 */
export default function Logo({ className = "", compact = false }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-emerald-400 shadow-sm ring-1 ring-slate-900/5">
        <ChipIcon className="h-5 w-5" />
      </span>
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span className="text-base font-semibold tracking-tight text-slate-900">Relayboard</span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
            IoT console
          </span>
        </span>
      ) : null}
    </span>
  );
}
