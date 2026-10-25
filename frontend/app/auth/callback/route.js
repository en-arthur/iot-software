import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Keep post-confirmation redirects on this origin.
 *
 * @param {string | null} value
 * @returns {string}
 */
function safeNext(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/boards";
  return value;
}

/**
 * Supabase email-confirmation callback. Exchanges the PKCE code for a cookie
 * session, then sends the user into the app.
 *
 * @param {import("next/server").NextRequest} request
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const errorDescription = searchParams.get("error_description");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription)}`
    );
  }

  return NextResponse.redirect(`${origin}/login`);
}
