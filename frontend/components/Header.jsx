"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "@/components/Logo";
import { LogOutIcon } from "@/components/icons";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/providers/RealtimeProvider";

const CONNECTION_STYLES = {
  connected: {
    label: "Live",
    dot: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  },
  connecting: {
    label: "Connecting",
    dot: "bg-amber-500 animate-pulse",
    pill: "bg-amber-50 text-amber-700 ring-amber-600/20",
  },
  reconnecting: {
    label: "Reconnecting",
    dot: "bg-amber-500 animate-pulse",
    pill: "bg-amber-50 text-amber-700 ring-amber-600/20",
  },
  disconnected: {
    label: "Offline",
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-600 ring-slate-500/20",
  },
};

function ConnectionIndicator() {
  const { status, lastEventAt } = useRealtime();
  const config = CONNECTION_STYLES[status] ?? CONNECTION_STYLES.disconnected;
  const title = lastEventAt
    ? `Realtime connection: ${config.label}. Last event ${formatDateTime(lastEventAt)}.`
    : `Realtime connection: ${config.label}.`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${config.pill}`}
      title={title}
      aria-label={`Realtime connection: ${config.label}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      <span className="hidden sm:inline">{config.label}</span>
    </span>
  );
}

/**
 * Global header with auth actions and the Realtime connection indicator.
 *
 * @param {{ userEmail?: string | null }} props
 */
export default function Header({ userEmail }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      // If the global sign-out call fails (for example, while offline), clear
      // the local session anyway so the user isn't stuck in the app.
      if (error) {
        await supabase.auth.signOut({ scope: "local" });
      }
    } catch {
      // Still navigate to /login; middleware will send the user back if the
      // session truly could not be cleared.
    } finally {
      setSigningOut(false);
      router.replace("/login");
      router.refresh();
    }
  }

  const authLinkClass = (href) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${
      pathname === href
        ? "bg-slate-900 text-white"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href={userEmail ? "/boards" : "/login"}
          className="rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600"
          aria-label="Relayboard home"
        >
          <Logo />
        </Link>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {userEmail ? <ConnectionIndicator /> : null}

          {userEmail ? (
            <>
              <span className="hidden max-w-[14rem] truncate text-sm text-slate-500 md:block">
                {userEmail}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                aria-label={signingOut ? "Signing out" : "Sign out"}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3"
              >
                <LogOutIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{signingOut ? "Signing out…" : "Sign out"}</span>
              </button>
            </>
          ) : (
            <nav className="flex items-center gap-1" aria-label="Account">
              <Link href="/login" className={authLinkClass("/login")}>
                Sign in
              </Link>
              <Link
                href="/register"
                className={`hidden sm:inline-flex ${authLinkClass("/register")}`}
              >
                Create account
              </Link>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
