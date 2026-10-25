"use client";

import { useEffect, useState } from "react";
import { formatDateTime, formatRelativeTime } from "@/lib/format";

/**
 * A timestamp that keeps its relative label fresh without re-fetching.
 *
 * @param {{ value?: string | null, fallback?: string, className?: string }} props
 */
export default function RelativeTime({ value, fallback = "never", className = "" }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!value) {
    return <span className={className}>{fallback}</span>;
  }

  return (
    <time dateTime={value} title={formatDateTime(value)} className={className}>
      {formatRelativeTime(value, now)}
    </time>
  );
}
