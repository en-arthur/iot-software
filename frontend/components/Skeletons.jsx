export function Skeleton({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`}
      aria-hidden="true"
    />
  );
}

export function AuthFormSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading form">
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function BoardGridSkeleton({ count = 6 }) {
  return (
    <div
      className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      role="status"
      aria-label="Loading extension board"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <div className="mt-6 flex items-center justify-between">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-4 w-4" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading extension board…</span>
    </div>
  );
}

export function BoardDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8" role="status" aria-label="Loading extension board">
      <Skeleton className="h-4 w-24" />
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
            <Skeleton className="mt-3 h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-2 h-3 w-28" />
            <Skeleton className="mt-5 h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>

      <div className="mt-10">
        <Skeleton className="h-6 w-40" />
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
      <span className="sr-only">Loading extension board…</span>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="mt-5 h-56 w-full rounded-xl" />
    </div>
  );
}
