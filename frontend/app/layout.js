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
    "Monitor your extension board, watch live sensor data, and switch relays from anywhere.",
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
            </div>
          </RealtimeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
