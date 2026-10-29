import Link from "next/link";
import { ClipboardList, Search, MessageSquare, Gavel } from "lucide-react";
import { POSITIONS } from "../shared";
const STEPS = [
  { icon: ClipboardList, t: "Submit your application", d: "Complete the form with accurate information." },
  { icon: Search, t: "Application review", d: "The staff team reviews every answer." },
  { icon: MessageSquare, t: "Interview, if required", d: "Some applicants are invited to a short interview." },
  { icon: Gavel, t: "Final decision", d: "You are notified of the outcome." },
];
const FAQ = [
  ["How long does review take?", "Timelines vary with the number of applications. Please do not submit duplicates."],
  ["Can I apply for more than one position?", "You may apply again, but an open application for the same position is not duplicated."],
  ["What personal data do you collect?", "Only what is needed to review and contact you. We never ask for passwords or government ID."],
];
export default function Home() {
  return (
    <>
      <section className="border-b border-white/10 bg-gradient-to-b from-navy-950 to-navy-900">
        <div className="mx-auto max-w-4xl px-4 py-20">
          <h1 className="text-4xl font-semibold tracking-tight">Join Our Staff Team</h1>
          <p className="mt-4 max-w-2xl text-muted">Help keep our Brookhaven roleplay community fair, safe and enjoyable. We look for reliable, impartial people who communicate clearly and put the community first.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/apply" className="btn btn-primary">Apply for Staff</Link>
            <Link href="#requirements" className="btn">View Requirements</Link>
          </div>
        </div>
      </section>
      <section id="positions" className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-semibold">Available positions</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {POSITIONS.map((p) => (
            <article key={p.id} className="card">
              <div className="flex items-start justify-between gap-3"><h3 className="font-medium">{p.name}</h3>
                <span className={`rounded px-2 py-0.5 text-xs ${p.open ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-muted"}`}>{p.open ? "Accepting applications" : "Not currently open"}</span></div>
              <p className="mt-2 text-sm text-muted">{p.description}</p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted">Responsibilities</p>
              <ul className="list-disc pl-5 text-sm">{p.responsibilities.map((r) => <li key={r}>{r}</li>)}</ul>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted">Minimum requirements</p>
              <ul className="list-disc pl-5 text-sm">{p.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
            </article>))}
        </div>
      </section>
      <section id="requirements" className="border-y border-white/10 bg-navy-950/50 py-14"><div className="mx-auto max-w-4xl px-4">
        <h2 className="text-2xl font-semibold">Recruitment requirements</h2>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>A Roblox account and a Discord account in good standing.</li><li>Willingness to follow the staff code of conduct and keep information confidential.</li>
          <li>Consistent weekly availability and a working microphone is not required unless stated for your position.</li><li>Age requirements are set by the community and shown on the form.</li></ul></div></section>
      <section id="process" className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-semibold">Selection process</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-4">{STEPS.map(({ icon: I, t, d }, i) => (
          <li key={t} className="card"><I className="h-5 w-5 text-accent" aria-hidden /><p className="mt-3 text-sm font-medium">{i + 1}. {t}</p><p className="mt-1 text-sm text-muted">{d}</p></li>))}</ol>
        <p className="mt-6 rounded-md border border-white/10 bg-navy-800/60 p-3 text-sm text-muted">Submitting an application does not guarantee acceptance.</p>
      </section>
      <section id="faq" className="mx-auto max-w-3xl px-4 pb-16">
        <h2 className="text-2xl font-semibold">Frequently asked questions</h2>
        <div className="mt-4 space-y-2">{FAQ.map(([q, a]) => (<details key={q} className="card"><summary className="cursor-pointer font-medium">{q}</summary><p className="mt-2 text-sm text-muted">{a}</p></details>))}</div>
      </section>
      <section id="privacy" className="mx-auto max-w-3xl px-4 pb-10">
        <h2 className="text-2xl font-semibold">Privacy Policy</h2>
        <p className="mt-3 text-sm text-muted">We collect only the details you enter (email, Roblox and Discord identifiers, age range, country, time zone, language and your answers) to review and contact you about your staff application. Discord details are self-reported and not verified. We never ask for passwords or government ID. Applications are visible only to two authorized administrators and are kept only as long as the recruitment process requires. Contact the community owners to request correction or deletion.</p>
      </section>
      <section id="terms" className="mx-auto max-w-3xl px-4 pb-16">
        <h2 className="text-2xl font-semibold">Terms</h2>
        <p className="mt-3 text-sm text-muted">By applying you confirm your answers are truthful. Submitting an application does not guarantee acceptance. False information may lead to rejection or removal from staff. This community is independent and is not affiliated with Roblox Corporation.</p>
      </section>
    </>);
}
