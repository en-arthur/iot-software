import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

/**
 * Refresh the Supabase session on every matched request and protect the
 * /boards routes. Cookie writes are mirrored onto the outgoing response.
 *
 * @param {import("next/server").NextRequest} request
 * @returns {Promise<import("next/server").NextResponse>}
 */
export async function middleware(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, responseHeaders) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        // Prevent CDNs from caching a response that contains a new session.
        Object.entries(responseHeaders ?? {}).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  // getUser() validates the JWT with Supabase Auth. Do not use getSession()
  // for an authorization decision in middleware.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isProtectedRoute = pathname === "/boards" || pathname.startsWith("/boards/");
  const isAuthRoute = pathname === "/login" || pathname === "/register";

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("redirectTo", `${pathname}${search}`);
    return copyCookies(response, NextResponse.redirect(url));
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/boards";
    url.search = "";
    return copyCookies(response, NextResponse.redirect(url));
  }

  return response;
}

/**
 * Copy refreshed auth cookies from the Supabase response onto a redirect.
 *
 * @param {import("next/server").NextResponse} from
 * @param {import("next/server").NextResponse} to
 * @returns {import("next/server").NextResponse}
 */
function copyCookies(from, to) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value, cookie);
  });

  ["cache-control", "expires", "pragma"].forEach((header) => {
    const value = from.headers.get(header);
    if (value) to.headers.set(header, value);
  });

  return to;
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static image assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
