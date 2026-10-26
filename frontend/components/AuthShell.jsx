import { CheckCircleIcon } from "@/components/icons";

const FEATURES = [
  "Live sensor values streamed from your board",
  "Relay switches that only flip after the board confirms",
  "History charts with 1h, 24h, and 7d ranges",
];

/**
 * Shared two-column layout for the login and register pages.
 *
 * @param {{
 *   title: string,
 *   subtitle: string,
 *   children: React.ReactNode,
 *   footer?: React.ReactNode,
 * }} props
 */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.1),transparent_42%)]"
      />

      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-12 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div className="hidden lg:block">
          <h2 className="max-w-lg text-4xl font-semibold tracking-tight text-slate-900">
            Your extension board, live in one place.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-slate-600">
            Watch readings arrive, switch relays, and review history without touching the hardware.
          </p>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-slate-600">
                <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-card backdrop-blur sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</p>
            <div className="mt-7">{children}</div>
          </div>

          {footer ? (
            <div className="mt-6 text-center text-sm text-slate-600">{footer}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
