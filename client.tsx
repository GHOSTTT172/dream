"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Copy, Check } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { applicationSchema, AGE_RANGES, QUESTION_STEPS, type ApplicationInput } from "./shared";


type Pos = { id: string; name: string };
const DRAFT = "brp-draft-v1", KEY = "brp-key-v1";
const CONTACT = [
  { n: "contact_email", l: "Email address", h: "Used only to contact you about your application.", t: "email" },
  { n: "roblox_username", l: "Roblox username", h: "Lets us find your account in-game." },
  { n: "roblox_user_id", l: "Roblox User ID", h: "Numeric ID found in your profile URL.", inputMode: "numeric" },
  { n: "discord_username", l: "Discord username", h: "Self-reported; we do not verify it automatically." },
  { n: "discord_user_id", l: "Discord User ID", h: "Numeric ID (enable Developer Mode, right-click your profile, Copy User ID). Self-reported.", inputMode: "numeric" },
  { n: "discord_display_name", l: "Discord display name (optional)", h: "Optional." },
  { n: "country", l: "Country", h: "Helps us plan staff coverage." },
  { n: "timezone", l: "Time zone", h: "e.g. America/New_York." },
  { n: "preferred_language", l: "Preferred language", h: "Language we should use with you." },
] as const;
const STEP_FIELDS: string[][] = [
  [...CONTACT.map((c) => c.n), "age_range"],
  ["staff_position", ...QUESTION_STEPS[0].questions.map((q) => `answers.${q.id}`)],
  ...QUESTION_STEPS.slice(1).map((s) => s.questions.map((q) => `answers.${q.id}`)),
  ["truthful"],
];
const TITLES = ["Account and contact", ...QUESTION_STEPS.map((s) => s.title), "Review and submit"];

function submissionKey() {
  let k = sessionStorage.getItem(KEY);
  if (!k) { k = crypto.randomUUID(); sessionStorage.setItem(KEY, k); }
  return k;
}

type Result = { applicationNumber: string; applicationCode: string; emailSent: boolean };
export function ApplyForm({ positions, submitAction }: { positions: Pos[]; submitAction: (input: unknown) => Promise<{ error: string } | Result> }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [serverError, setServerError] = useState("");
  const f = useForm<ApplicationInput>({ resolver: zodResolver(applicationSchema), mode: "onTouched", defaultValues: { answers: {} } });
  const reg = (n: string) => f.register(n as never);
  const err = (n: string) => (n.split(".").reduce((o: any, k) => o?.[k], f.formState.errors)?.message as string | undefined);

  useEffect(() => { try { const d = sessionStorage.getItem(DRAFT); if (d) f.reset(JSON.parse(d)); } catch {} }, [f]);
  useEffect(() => {
    const s = f.watch((v) => { try { sessionStorage.setItem(DRAFT, JSON.stringify(v)); } catch {} });
    return () => s.unsubscribe();
  }, [f]);

  const next = async () => { if (await f.trigger(STEP_FIELDS[step] as never)) { setStep(step + 1); window.scrollTo(0, 0); } };
  const submit = f.handleSubmit(async (values) => {
    if (busy) return;
    setBusy(true); setServerError("");
    try {
      const data = await submitAction({ ...values, submissionKey: submissionKey() });
      if ("error" in data) { setServerError(data.error); return; }
      sessionStorage.removeItem(DRAFT); sessionStorage.removeItem(KEY);
      setResult(data); window.scrollTo(0, 0);
    } catch { setServerError("Network error. Your answers are saved; please try again."); }
    finally { setBusy(false); }
  });

  const Field = ({ n, l, h, t, inputMode }: { n: string; l: string; h?: string; t?: string; inputMode?: string }) => (
    <div><label htmlFor={n} className="label">{l}</label>
      <input id={n} type={t ?? "text"} inputMode={inputMode as never} className="input" aria-invalid={!!err(n)} {...reg(n)} />
      {h && <p className="hint">{h}</p>}{err(n) && <p role="alert" className="err">{err(n)}</p>}</div>
  );
  const Area = ({ id, text }: { id: string; text: string }) => (
    <div><label htmlFor={`answers.${id}`} className="label">{text}</label>
      <textarea id={`answers.${id}`} rows={4} className="input" aria-invalid={!!err(`answers.${id}`)} {...reg(`answers.${id}`)} />
      {err(`answers.${id}`) && <p role="alert" className="err">{err(`answers.${id}`)}</p>}</div>
  );

  if (result) return (
    <div className="mx-auto max-w-xl px-4 py-14">
      <h1 className="text-2xl font-semibold uppercase tracking-wide">Application submitted successfully</h1>
      <p className="mt-3 text-muted">Your staff application has been received and is awaiting review.</p>
      <dl className="card mt-6 space-y-3">
        <div><dt className="text-sm text-muted">Application Number</dt><dd className="font-mono text-lg">{result.applicationNumber}</dd></div>
        <div><dt className="text-sm text-muted">Application Code</dt><dd className="font-mono text-lg">{result.applicationCode}</dd></div>
      </dl>
      <p className="mt-3 text-sm text-muted">Save these details for future reference.{result.emailSent ? " A confirmation email was sent." : ""}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <CopyButton label="Copy Application Details" text={`Application Number: ${result.applicationNumber}\nApplication Code: ${result.applicationCode}`} />
        <Link href="/" className="btn btn-primary">Return to Homepage</Link>
      </div>
    </div>
  );

  const v = f.getValues();
  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6" aria-label="Progress">
        <p className="text-sm text-muted">Step {step + 1} of {TITLES.length}: {TITLES[step]}</p>
        <div className="mt-2 h-1.5 rounded bg-white/10"><div className="h-1.5 rounded bg-accent transition-all" style={{ width: `${((step + 1) / TITLES.length) * 100}%` }} /></div>
      </div>
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" {...reg("website")} />
      <div className="space-y-5">
        {step === 0 && (<>
          <p className="text-sm text-muted">Never share any password. We do not ask for passwords or government ID. This information is not public.</p>
          {CONTACT.map((c) => <Field key={c.n} {...c} />)}
          <div><label htmlFor="age_range" className="label">Age range</label>
            <select id="age_range" className="input" {...reg("age_range")} defaultValue=""><option value="" disabled>Select…</option>{AGE_RANGES.map((a) => <option key={a}>{a}</option>)}</select>
            <p className="hint">Used to apply the community's age policy.</p>{err("age_range") && <p role="alert" className="err">{err("age_range")}</p>}</div>
        </>)}
        {step === 1 && (<>
          <div><label htmlFor="staff_position" className="label">Which staff position are you applying for?</label>
            <select id="staff_position" className="input" {...reg("staff_position")} defaultValue=""><option value="" disabled>Select…</option>{positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            {err("staff_position") && <p role="alert" className="err">{err("staff_position")}</p>}</div>
          {QUESTION_STEPS[0].questions.map((q) => <Area key={q.id} id={q.id} text={q.text} />)}
        </>)}
        {step >= 2 && step <= 5 && QUESTION_STEPS[step - 1].questions.map((q) => <Area key={q.id} id={q.id} text={q.text} />)}
        {step === 6 && (<>
          <div className="card text-sm"><h2 className="font-medium">Summary</h2>
            <button type="button" className="btn mt-2" onClick={() => setStep(0)}>Edit contact details</button>
            <dl className="mt-3 grid gap-1 text-muted">{CONTACT.map((c) => <div key={c.n}><dt className="inline">{c.l}: </dt><dd className="inline text-white">{String((v as any)[c.n] ?? "")}</dd></div>)}</dl></div>
          {QUESTION_STEPS.map((s, i) => (<div key={s.title} className="card text-sm"><div className="flex justify-between"><h3 className="font-medium">{s.title}</h3>
            <button type="button" className="btn" onClick={() => setStep(i + 1)}>Edit</button></div>
            {s.questions.map((q) => <p key={q.id} className="mt-2"><span className="text-muted">{q.text}</span><br />{v.answers?.[q.id]}</p>)}</div>))}
          <p className="text-sm text-muted">Privacy: your details are used only to review your application and contact you. Only authorized administrators can read them. Discord details are self-reported and not verified.</p>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" {...reg("truthful")} />I confirm that all information I submitted is truthful.</label>
          {err("truthful") && <p role="alert" className="err">{err("truthful")}</p>}
          {serverError && <p role="alert" className="rounded border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-300">{serverError}</p>}
        </>)}
      </div>
      <div className="mt-8 flex justify-between">
        <button type="button" className="btn" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>Previous</button>
        {step < TITLES.length - 1
          ? <button type="button" className="btn btn-primary" onClick={next}>Next</button>
          : <button type="submit" className="btn btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Submit application</button>}
      </div>
    </form>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="btn" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch {} }}>
      {ok ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}{ok ? "Copied" : label}
    </button>
  );
}

export function ConfirmSubmit({ message, children, className = "btn" }: { message: string; children: React.ReactNode; className?: string }) {
  return <button type="submit" className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>{children}</button>;
}

export function LoginButton() {
  return <button className="btn btn-primary" onClick={() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/auth` } })}>Sign in with Google</button>;
}
