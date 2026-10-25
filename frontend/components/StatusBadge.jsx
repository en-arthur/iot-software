/**
 * Online/offline pill for a board.
 *
 * @param {{ status?: string | null, className?: string }} props
 */
export default function StatusBadge({ status, className = "" }) {
  const normalizedStatus = String(status ?? "").toLowerCase();
  const isOnline = normalizedStatus === "online";
  const isOffline = normalizedStatus === "offline";

  const styles = isOnline
    ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
    : isOffline
      ? "bg-slate-100 text-slate-600 ring-slate-500/20"
      : "bg-amber-50 text-amber-700 ring-amber-600/20";

  const dotStyles = isOnline
    ? "bg-emerald-500"
    : isOffline
      ? "bg-slate-400"
      : "bg-amber-500";

  const label = isOnline ? "Online" : isOffline ? "Offline" : "Unknown";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${styles} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotStyles}`} aria-hidden="true" />
      {label}
    </span>
  );
}
