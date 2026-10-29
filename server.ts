import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAllowedAdmin } from "./shared";
// In-memory limiter: per server instance only. On Vercel use Upstash/Redis for a shared limit (see README).
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return false; }
  recent.push(now); hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const COMMUNITY = process.env.NEXT_PUBLIC_COMMUNITY_NAME || "Brookhaven RP";
/** Returns true ONLY if the provider accepted the message. False if unconfigured or failed. */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM;
  if (!key || !from || !to) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", { method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to, subject, html }) });
    return r.ok;
  } catch { return false; }
}
const wrap = (body: string) => `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0a1226">${body}<p style="color:#667;font-size:12px">${esc(COMMUNITY)} Staff Team</p></div>`;
export const confirmationEmail = (num: string, code: string) => wrap(`<h2>Application received</h2><p>Your staff application is awaiting review. Submission does not guarantee acceptance.</p><p><b>Application Number:</b> ${esc(num)}<br><b>Application Code:</b> ${esc(code)}</p>`);
export const teamEmail = (num: string) => wrap(`<p>New staff application <b>${esc(num)}</b>.</p><p><a href="${esc(process.env.NEXT_PUBLIC_SITE_URL ?? "")}/admin/${esc(num)}">Open in dashboard</a> (sign-in required).</p>`);
export const decisionEmail = (num: string, accepted: boolean) => wrap(`<h2>Application decision</h2><p>Application <b>${esc(num)}</b>: <b>${accepted ? "Accepted" : "Not accepted"}</b>.</p><p>Thank you for your interest in joining the team.</p>`);
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => store.getAll(),
      setAll: (list) => { try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* Server Component: ignore */ } } },
  });
}
/** Service role: server-only, used solely by the public submission endpoint. */
export function supabaseService() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}
/** getUser() re-validates the JWT with Supabase Auth (not just the cookie). Fails closed. */
export async function getAdmin() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || !user.email_confirmed_at || !isAllowedAdmin(user.email)) return null;
  return { sb, email: user.email!.toLowerCase() };
}
export async function requireAdmin() {
  const a = await getAdmin();
  if (!a) redirect("/admin");
  return a;
}
