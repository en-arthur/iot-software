import "./globals.css";
import Header from "@/components/Header";
import QueryProvider from "@/providers/QueryProvider";
import RealtimeProvider from "@/providers/RealtimeProvider";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: {
    default: "Relayboard — IoT extension board console",
    template: "%s · Relayboard",
  },
  description:
    "Monitor ESP32 extension boards, watch live sensor data, and switch relays from anywhere.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

// Auth cookies are read in the layout, so every route is rendered dynamically.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <RealtimeProvider>
            <div className="flex min-h-screen flex-col">
              <Header userEmail={user?.email ?? null} />
              <main className="flex-1">{children}</main>
              <footer className="border-t border-slate-200/70 bg-white/60">
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-5 text-xs text-slate-500 sm:px-6 lg:px-8">
                  <span className="font-medium text-slate-600">Relayboard</span>
                  <span className="hidden sm:inline">Live data via Supabase Realtime</span>
                </div>
              </footer>
            </div>
          </RealtimeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
