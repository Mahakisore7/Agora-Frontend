import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const redirectUrl = siteUrl ? new URL("/", siteUrl) : new URL("/", "https://localhost:3000");
  return NextResponse.redirect(redirectUrl);
}
