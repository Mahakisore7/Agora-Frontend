import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// This route is called by Supabase after OAuth completes
// URL: /auth/callback?code=xxx
// We exchange the code for a session, set cookies, and redirect to dashboard
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // Exchange the code for a session — sets the auth cookie
    await supabase.auth.exchangeCodeForSession(code);
    // After exchangeCodeForSession:
const next = requestUrl.searchParams.get("next") || "/dashboard";
return NextResponse.redirect(new URL(next, request.url));

  }

  return NextResponse.redirect(new URL(next, request.url));
}
