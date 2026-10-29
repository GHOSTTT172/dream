import { NextResponse } from "next/server";
import { supabaseServer, getAdmin } from "../../server";

// GET = Google OAuth callback. Non-allowlisted accounts are signed out immediately.
export async function GET(req: Request) {
  const url = new URL(req.url), code = url.searchParams.get("code");
  if (code) await (await supabaseServer()).auth.exchangeCodeForSession(code);
  if (!(await getAdmin())) {
    await (await supabaseServer()).auth.signOut();
    return NextResponse.redirect(new URL("/admin?denied=1", url.origin));
  }
  return NextResponse.redirect(new URL("/admin", url.origin));
}
// POST = sign out
export async function POST(req: Request) {
  await (await supabaseServer()).auth.signOut();
  return NextResponse.redirect(new URL("/admin", req.url), 303);
}
