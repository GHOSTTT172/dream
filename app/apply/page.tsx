import { headers } from "next/headers";
import { ApplyForm } from "../../client";
import { POSITIONS, serverApplicationSchema } from "../../shared";
import { rateLimit, supabaseService, sendEmail, confirmationEmail, teamEmail } from "../../server";
export const metadata = { title: "Apply for Staff" };

type Result = { applicationNumber: string; applicationCode: string; emailSent: boolean };

async function submit(input: unknown): Promise<{ error: string } | Result> {
  "use server";
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!rateLimit(`apply:${ip}`, 5, 60 * 60 * 1000)) return { error: "Too many submissions. Please try again later." };
  if (JSON.stringify(input ?? null).length > 100_000) return { error: "Submission too large." };
  const parsed = serverApplicationSchema.safeParse(input);
  if (!parsed.success) return { error: "Some fields are invalid. Please review your answers." };
  const { submissionKey, truthful: _t, website, ...data } = parsed.data;
  if (website) return { error: "Invalid request." };
  const { data: rows, error } = await supabaseService().rpc("submit_application", {
    p: data, p_key: submissionKey, p_block_duplicates: (process.env.DUPLICATE_POLICY ?? "block") !== "allow",
  });
  if (error) {
    if (error.message.includes("DUPLICATE_APPLICATION")) return { error: "You already have an open application for this position." };
    console.error("submit_application failed:", error.code); // never log the payload
    return { error: "We could not save your application. Please try again." };
  }
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row?.application_number) return { error: "We could not save your application. Please try again." };
  const emailSent = await sendEmail(data.contact_email, "Your staff application was received", confirmationEmail(row.application_number, row.application_code));
  if (process.env.TEAM_NOTIFY_EMAIL) await sendEmail(process.env.TEAM_NOTIFY_EMAIL, "New staff application", teamEmail(row.application_number));
  return { applicationNumber: row.application_number, applicationCode: row.application_code, emailSent };
}

export default function Apply() {
  const open = POSITIONS.filter((p) => p.open).map(({ id, name }) => ({ id, name }));
  if (!open.length) return <p className="mx-auto max-w-3xl px-4 py-14 text-muted">No positions are currently accepting applications.</p>;
  return <ApplyForm positions={open} submitAction={submit} />;
}
