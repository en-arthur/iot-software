import { createBrowserClient } from "@supabase/ssr";

let browserClient;

/**
 * Create (or reuse) the browser-side Supabase client.
 *
 * @supabase/ssr stores the auth session in cookies so the middleware and
 * server components can read it. Only the anon key belongs here; the service
 * role key must never be shipped to the browser.
 *
 * @returns {import("@supabase/supabase-js").SupabaseClient}
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  // Client Components are also pre-rendered on the server. Do not cache that
  // server-side instance, because it has no access to document.cookie.
  if (typeof window === "undefined") {
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  return browserClient;
}
