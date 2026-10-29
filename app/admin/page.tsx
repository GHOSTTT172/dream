import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { POSITIONS, QUESTION_STEPS } from "../../shared";
import { getAdmin, requireAdmin, sendEmail, decisionEmail, supabaseServer } from "../../server";
import { CopyButton, ConfirmSubmit, LoginButton } from "../../client";
export const dynamic = "force-dynamic";
type SB = Awaited<ReturnType<typeof supabaseServer>>;
const NUMBER = z.string().regex(/^BRP-\d{4}-\d{6}$/);
const Status = z.object({ number: NUMBER, action: z.enum(["pending", "under_review", "accepted", "rejected", "archive", "unarchive"]), reason: z.string().trim().max(1000).optional() });
const Note = z.object({ number: NUMBER, content: z.string().trim().min(1).max(2000) });

function SignIn({ denied }: { denied: boolean }) {
  return (
    <div className="mx-auto max-w-sm px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Administrator sign-in</h1>
      <p className="mt-2 text-sm text-muted">Restricted to the two authorized administrator accounts.</p>
      {denied && <p role="alert" className="mt-4 rounded border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-300">This account is not authorized.</p>}
      <div className="mt-6"><LoginButton /></div>
    </div>
  );
}


async function Detail({ number, sb }: { number: string; sb: SB }) {
  if (!/^BRP-\d{4}-\d{6}$/.test(number)) notFound();
  const { data: a } = await sb.from("applications").select("*").eq("application_number", number).single();
  if (!a) notFound();
  const [{ data: notes }, { data: audit }, { data: related }] = await Promise.all([
    sb.from("application_notes").select("*").eq("application_id", a.id).order("created_at", { ascending: false }),
    sb.from("application_audit_logs").select("*").eq("application_id", a.id).order("created_at", { ascending: false }),
    sb.from("applications").select("application_number,status,staff_position,submitted_at").eq("discord_user_id", a.discord_user_id).neq("id", a.id).order("submitted_at", { ascending: false }),
  ]);

  async function changeStatus(fd: FormData) {
      "use server";
    const { sb } = await requireAdmin();                       // server-side check on every action
    const p = Status.parse(Object.fromEntries(fd));
    const { error } = await sb.rpc("change_status", { p_number: p.number, p_action: p.action, p_reason: p.reason ?? null });
    if (error) throw new Error(error.message.includes("REASON_REQUIRED") ? "A reason (min 5 characters) is required for a decision." : "Could not update the application.");
    if ((p.action === "accepted" || p.action === "rejected") && process.env.APPLICANT_DECISION_EMAILS === "true") {
      const { data } = await sb.from("applications").select("contact_email").eq("application_number", p.number).single();
      if (data) await sendEmail(data.contact_email, "Your staff application decision", decisionEmail(p.number, p.action === "accepted"));
    }
    revalidatePath("/admin");
  }

  async function addNote(fd: FormData) {
      "use server";
    const { sb, email } = await requireAdmin();
    const p = Note.parse(Object.fromEntries(fd));
    const { data: a } = await sb.from("applications").select("id").eq("application_number", p.number).single();
    if (!a) throw new Error("Application not found.");
    const { error } = await sb.from("application_notes").insert({ application_id: a.id, author_email: email, content: p.content });
    if (error) throw new Error("Could not save the note.");
    revalidatePath("/admin");
  }

  const pos = POSITIONS.find((p) => p.id === a.staff_position)?.name ?? a.staff_position;
  const Row = ({ l, v }: { l: string; v: string | null }) => <div><dt className="text-xs text-muted">{l}</dt><dd className="text-sm">{v || "—"}</dd></div>;
  const Act = ({ action, label, ask, primary }: { action: string; label: string; ask: string; primary?: boolean }) => (
    <form action={changeStatus} className="flex flex-wrap items-center gap-2"><input type="hidden" name="number" value={number} /><input type="hidden" name="action" value={action} />
      {(action === "accepted" || action === "rejected") && <input name="reason" required minLength={5} maxLength={1000} placeholder="Reason for decision" className="input w-56" aria-label="Decision reason" />}
      <ConfirmSubmit message={ask} className={primary ? "btn btn-primary" : "btn"}>{label}</ConfirmSubmit></form>);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/admin" className="text-sm text-accent underline">← All applications</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3"><h1 className="font-mono text-2xl">{a.application_number}</h1>
        <span className="rounded bg-white/10 px-2 py-0.5 text-sm">{a.status.replace("_", " ")}{a.archived_at ? " · archived" : ""}</span></div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm"><span className="font-mono">{a.application_code}</span>
        <CopyButton text={a.application_number} label="Copy number" /><CopyButton text={a.application_code} label="Copy code" /></div>
      <section className="card mt-6"><h2 className="font-medium">Discord (self-reported, not verified)</h2>
        <p className="mt-1 text-lg">{a.discord_username} <span className="font-mono text-muted">{a.discord_user_id}</span></p>
        {a.discord_display_name && <p className="text-sm text-muted">Display name: {a.discord_display_name}</p>}
        {!!related?.length && <div className="mt-3 text-sm"><p className="text-muted">Other applications from this Discord ID ({related.length}):</p>
          <ul>{related.map((r) => <li key={r.application_number}><Link className="text-accent underline" href={`/admin?app=${r.application_number}`}>{r.application_number}</Link> — {r.status.replace("_", " ")} · {POSITIONS.find((p) => p.id === r.staff_position)?.name ?? r.staff_position} · {new Date(r.submitted_at).toLocaleDateString("en-US")}</li>)}</ul></div>}</section>
      <section className="card mt-4"><h2 className="font-medium">Applicant</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3"><Row l="Email" v={a.contact_email} /><Row l="Roblox username" v={a.roblox_username} /><Row l="Roblox User ID" v={a.roblox_user_id} />
          <Row l="Age range" v={a.age_range} /><Row l="Country" v={a.country} /><Row l="Time zone" v={a.timezone} /><Row l="Language" v={a.preferred_language} />
          <Row l="Position" v={pos} /><Row l="Submitted" v={new Date(a.submitted_at).toLocaleString("en-US")} />
          {a.decision_at && <Row l="Decision" v={`${new Date(a.decision_at).toLocaleString("en-US")} — ${a.decision_reason}`} />}</dl></section>
      <section className="card mt-4"><h2 className="font-medium">Decision</h2><div className="mt-3 flex flex-col gap-3">
        <Act action="pending" label="Mark as Pending" ask="Mark this application as Pending?" />
        <Act action="under_review" label="Mark as Under Review" ask="Mark this application as Under Review?" />
        <Act action="accepted" label="Accept" ask="Accept this application? This is recorded in the audit log." primary />
        <Act action="rejected" label="Reject" ask="Reject this application? This is recorded in the audit log." />
        {a.archived_at ? <Act action="unarchive" label="Unarchive" ask="Unarchive this application?" /> : <Act action="archive" label="Archive" ask="Archive this application?" />}
        {a.status === "rejected" && <p className="text-xs text-muted">To reopen, mark as Pending or Under Review.</p>}</div></section>
      {QUESTION_STEPS.map((s) => (<section key={s.title} className="card mt-4"><h2 className="font-medium">{s.title}</h2>
        {s.questions.map((q) => <div key={q.id} className="mt-3"><p className="text-sm text-muted">{q.text}</p><p className="whitespace-pre-wrap text-sm">{(a.answers as Record<string, string>)[q.id] ?? "—"}</p></div>)}</section>))}
      <section className="card mt-4"><h2 className="font-medium">Internal notes</h2>
        <form action={addNote} className="mt-3 flex gap-2"><input type="hidden" name="number" value={number} /><textarea name="content" required maxLength={2000} rows={2} className="input" aria-label="Note" /><button className="btn btn-primary">Add note</button></form>
        {notes?.map((n) => <p key={n.id} className="mt-3 text-sm"><span className="text-muted">{n.author_email} · {new Date(n.created_at).toLocaleString("en-US")}</span><br /><span className="whitespace-pre-wrap">{n.content}</span></p>)}</section>
      <section className="card mt-4"><h2 className="font-medium">Review history</h2>
        {!audit?.length ? <p className="mt-2 text-sm text-muted">No actions yet.</p> : audit.map((l) => <p key={l.id} className="mt-2 text-sm text-muted">{new Date(l.created_at).toLocaleString("en-US")} · {l.admin_email} · {l.action}{l.previous_status !== l.new_status ? ` (${l.previous_status} → ${l.new_status})` : ""}{l.reason ? ` — ${l.reason}` : ""}</p>)}</section>
    </div>
  );
}

const PAGE = 20, STATUSES = ["pending", "under_review", "accepted", "rejected"] as const;
const badge: Record<string, string> = { pending: "bg-amber-500/15 text-amber-300", under_review: "bg-blue-500/15 text-blue-300", accepted: "bg-emerald-500/15 text-emerald-300", rejected: "bg-red-500/15 text-red-300" };
type SP = Record<string, string | undefined>;

export default async function Admin({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const a = await getAdmin();
  if (!a) return <SignIn denied={!!sp.denied} />;
  const { sb, email } = a;
  if (sp.app) return <Detail number={sp.app} sb={sb} />;
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);
  const q = (sp.q ?? "").replace(/[^\w@.\- ]/g, "").trim().slice(0, 60);
  let query = sb.from("applications")
    .select("application_number,application_code,submitted_at,roblox_username,roblox_user_id,contact_email,discord_username,discord_user_id,age_range,staff_position,status,assigned_reviewer,archived_at", { count: "exact" })
    .order("submitted_at", { ascending: sp.sort === "asc" }).range((page - 1) * PAGE, page * PAGE - 1);
  query = sp.archived === "1" ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (sp.status && (STATUSES as readonly string[]).includes(sp.status)) query = query.eq("status", sp.status);
  if (sp.position && POSITIONS.some((p) => p.id === sp.position)) query = query.eq("staff_position", sp.position);
  if (q) query = query.or(["application_number", "application_code", "roblox_username", "discord_username", "discord_user_id", "contact_email"].map((c) => `${c}.ilike.%${q}%`).join(","));

  const count = (s?: string) => { const b = sb.from("applications").select("id", { count: "exact", head: true }).is("archived_at", null); return (s ? b.eq("status", s) : b).then((r) => r.count ?? 0); };
  const [{ data: rows, count: total, error }, all, ...byStatus] = await Promise.all([query, count(), ...STATUSES.map((s) => count(s))]);
  const ids = [...new Set((rows ?? []).map((r) => r.discord_user_id))];
  const { data: same } = ids.length ? await sb.from("applications").select("discord_user_id").in("discord_user_id", ids) : { data: [] };
  const tally: Record<string, number> = {}; (same ?? []).forEach((r) => { tally[r.discord_user_id] = (tally[r.discord_user_id] ?? 0) + 1; });
  const link = (over: SP) => `/admin?${new URLSearchParams(Object.entries({ ...sp, ...over }).filter(([, v]) => v) as [string, string][])}`;
  const pages = Math.max(1, Math.ceil((total ?? 0) / PAGE));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Applications</h1>
        <form action="/auth" method="post" className="flex items-center gap-3 text-sm text-muted">{email}<button className="btn">Sign out</button></form></div>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["Total", all], ["Pending", byStatus[0]], ["Under review", byStatus[1]], ["Accepted", byStatus[2]], ["Rejected", byStatus[3]]].map(([l, n]) => (<div key={l as string} className="card"><p className="text-sm text-muted">{l}</p><p className="text-2xl font-semibold">{n}</p></div>))}
      </div>
      <form className="mt-6 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Number, code, Roblox, Discord, email…" className="input max-w-xs" aria-label="Search" />
        <select name="status" defaultValue={sp.status ?? ""} className="input w-auto" aria-label="Status"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select name="position" defaultValue={sp.position ?? ""} className="input w-auto" aria-label="Position"><option value="">All positions</option>{POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select name="sort" defaultValue={sp.sort ?? "desc"} className="input w-auto" aria-label="Sort"><option value="desc">Newest first</option><option value="asc">Oldest first</option></select>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="archived" value="1" defaultChecked={sp.archived === "1"} />Archived</label>
        <button className="btn btn-primary">Apply</button>
      </form>
      {error ? <p role="alert" className="mt-6 text-red-300">Could not load applications.</p> : !rows?.length ? <p className="mt-6 text-muted">No applications match.</p> : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-white/10"><table className="w-full text-left text-sm">
          <thead className="bg-navy-950 text-muted"><tr>{["Number", "Submitted", "Roblox", "Email", "Discord", "Age", "Position", "Status", "Reviewer"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => (<tr key={r.application_number} className="border-t border-white/10 hover:bg-white/5">
            <td className="px-3 py-2 font-mono"><Link href={`/admin?app=${r.application_number}`} className="text-accent underline">{r.application_number}</Link></td>
            <td className="px-3 py-2">{new Date(r.submitted_at).toLocaleDateString("en-US")}</td>
            <td className="px-3 py-2">{r.roblox_username}<br /><span className="text-muted">{r.roblox_user_id}</span></td>
            <td className="px-3 py-2">{r.contact_email}</td>
            <td className="px-3 py-2">{r.discord_username}<br /><span className="text-muted">{r.discord_user_id}</span>{tally[r.discord_user_id] > 1 && <span className="ml-1 rounded bg-white/10 px-1 text-xs">repeat ×{tally[r.discord_user_id]}</span>}</td>
            <td className="px-3 py-2">{r.age_range}</td><td className="px-3 py-2">{POSITIONS.find((p) => p.id === r.staff_position)?.name ?? r.staff_position}</td>
            <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs ${badge[r.status]}`}>{r.status.replace("_", " ")}</span></td>
            <td className="px-3 py-2 text-muted">{r.assigned_reviewer ?? "—"}</td></tr>))}</tbody></table></div>)}
      <div className="mt-4 flex items-center justify-between text-sm text-muted"><span>Page {page} of {pages}</span>
        <span className="flex gap-2">{page > 1 && <Link className="btn" href={link({ page: String(page - 1) })}>Previous</Link>}{page < pages && <Link className="btn" href={link({ page: String(page + 1) })}>Next</Link>}</span></div>
    </div>
  );
}
