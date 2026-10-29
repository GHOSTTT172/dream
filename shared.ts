import { z } from "zod";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Exactly two distinct valid emails, otherwise null (fail closed). */
export function parseAdminEmails(a?: string, b?: string): string[] | null {
  const list = [a, b].map((x) => (x ?? "").trim().toLowerCase());
  if (!list.every((x) => EMAIL.test(x)) || list[0] === list[1]) return null;
  return list;
}
export function isAllowedAdmin(
  email: string | null | undefined,
  list: string[] | null = parseAdminEmails(process.env.ADMIN_EMAIL_1, process.env.ADMIN_EMAIL_2),
): boolean {
  return !!list && !!email && list.includes(email.trim().toLowerCase());
}
export type Position = { id: string; name: string; open: boolean; description: string; responsibilities: string[]; requirements: string[] };
// Owner config: set `open` to control which positions accept applications.
export const POSITIONS: Position[] = [
  { id: "support", name: "Support Team", open: true, description: "First point of contact for player questions and tickets.",
    responsibilities: ["Answer player questions", "Triage tickets", "Escalate rule violations"], requirements: ["Clear, respectful communication", "Knowledge of server rules"] },
  { id: "trial-mod", name: "Trial Moderator", open: true, description: "Probationary moderator working under supervision.",
    responsibilities: ["Handle reports with evidence", "Issue warnings", "Document actions"], requirements: ["Good judgement", "Active weekly"] },
  { id: "moderator", name: "Moderator", open: false, description: "Full moderation duties in-game and on Discord.",
    responsibilities: ["Enforce rules consistently", "Resolve disputes", "Review appeals"], requirements: ["Prior staff or trial experience", "Reliable availability"] },
  { id: "senior-mod", name: "Senior Moderator", open: false, description: "Guides moderators and handles escalations.",
    responsibilities: ["Mentor staff", "Handle escalated cases", "Review moderation quality"], requirements: ["Proven moderation record", "Leadership skills"] },
  { id: "admin", name: "Administrator", open: false, description: "Senior team member shaping community operations.",
    responsibilities: ["Oversee staff", "Maintain policies", "Manage tools and permissions"], requirements: ["Extensive staff experience", "High trust and discretion"] },
];
export type Q = { id: string; text: string; min?: number; max?: number };
export type QStep = { title: string; questions: Q[] };
const S = { min: 1, max: 300 };
// Owner config: edit/add questions here; validation and the form adapt automatically.
export const QUESTION_STEPS: QStep[] = [
  { title: "Position and experience", questions: [
    { id: "why_join", text: "Why do you want to join our staff team?" },
    { id: "prev_exp", text: "Do you have previous moderation experience?", ...S },
    { id: "prev_roles", text: "If yes, describe your previous roles and responsibilities (write N/A if none).", min: 2 },
    { id: "hours", text: "How many hours per week can you dedicate?", ...S },
    { id: "availability", text: "What time zone and hours are you usually available?", min: 5, max: 300 },
    { id: "skills", text: "What skills make you suitable for this position?" },
    { id: "unavailable", text: "What would you do if you could not fulfill your staff responsibilities?" },
    { id: "criticism", text: "How would you handle constructive criticism from a senior staff member?" } ] },
  { title: "Ethics and professionalism", questions: [
    { id: "e1", text: "Your close friend breaks a server rule. Would you punish them? Explain your decision." },
    { id: "e2", text: "You discover that an administrator is abusing their permissions. What would you do?" },
    { id: "e3", text: "A player insults you after receiving a punishment. How would you respond?" },
    { id: "e4", text: "You realize that you punished a player incorrectly. What steps would you take?" },
    { id: "e5", text: "A senior administrator makes a decision you disagree with. How would you handle it?" },
    { id: "e6", text: "What does impartiality mean in staff moderation?" },
    { id: "e7", text: "A player offers you an in-game advantage in exchange for removing a punishment. What would you do?" },
    { id: "e8", text: "You accidentally share confidential staff information. How would you handle the situation?" },
    { id: "e9", text: "How would you protect a player's private information?" },
    { id: "e10", text: "What is more important: protecting your friends or enforcing the rules fairly? Explain why." } ] },
  { title: "Roleplay knowledge", questions: [
    { id: "r1", text: "Explain what Fail RP means." },
    { id: "r2", text: "Explain the difference between Meta Gaming and Power Gaming." },
    { id: "r3", text: "A player uses information obtained from Discord that their character does not know. What rule may have been violated?" },
    { id: "r4", text: "Two players disagree about the outcome of a roleplay scene. How would you handle the report?" },
    { id: "r5", text: "A player claims another person broke the rules but provides no evidence. What would you do?" },
    { id: "r6", text: "How would you distinguish legitimate roleplay conflict from actual rule-breaking?" },
    { id: "r7", text: "A player repeatedly interrupts other people's roleplay. How would you investigate the situation?" },
    { id: "r8", text: "What would you do if a rule is ambiguous or does not clearly cover a particular situation?" } ] },
  { title: "Moderation scenarios", questions: [
    { id: "m1", text: "You receive several reports simultaneously. How do you prioritize them?" },
    { id: "m2", text: "A player submits a video that contradicts the original report. What do you do?" },
    { id: "m3", text: "A player claims their punishment was unfair. Explain the appeal process you would follow." },
    { id: "m4", text: "When would you issue a warning instead of a temporary or permanent punishment?" },
    { id: "m5", text: "A player repeatedly evades moderation using alternate accounts. How would you respond?" },
    { id: "m6", text: "You witness another moderator violating staff rules. What steps would you take?" },
    { id: "m7", text: "A report involves your friend or someone you dislike. How would you avoid bias?" },
    { id: "m8", text: "You are unsure whether an incident deserves a punishment. What do you do?" },
    { id: "m9", text: "A player is being harassed by several other players. How would you respond?" },
    { id: "m10", text: "How would you document a moderation action so that another staff member can review it?" } ] },
  { title: "Technical knowledge", questions: [
    { id: "t1", text: "Have you used Discord moderation tools?", min: 2 },
    { id: "t2", text: "Do you know how to document reports and moderation actions?", min: 2 },
    { id: "t3", text: "How would you handle a suspicious link sent to staff?" },
    { id: "t4", text: "What would you do if someone requested unauthorized administrator permissions?" },
    { id: "t5", text: "Do you have experience with tickets, moderation bots, logs, or community management?", min: 2 },
    { id: "t6", text: "How would you respond if a player attempted to obtain another user's private information?" },
    { id: "t7", text: "What steps would you take if a moderation bot stopped working?" } ] },
];
export const ALL_Q: Q[] = QUESTION_STEPS.flatMap((s) => s.questions);

export const AGE_RANGES = ["13-15", "16-17", "18-24", "25+"] as const;
const answerShape = Object.fromEntries(
  ALL_Q.map((q) => [q.id, z.string().trim().min(q.min ?? 30, "Please write a more complete answer.").max(q.max ?? 2500, "Answer is too long.")]),
) as Record<string, z.ZodString>;

export const applicationSchema = z.object({
  contact_email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  roblox_username: z.string().trim().min(3, "3–20 characters.").max(20, "3–20 characters.").regex(/^[A-Za-z0-9_]+$/, "Letters, numbers and underscores only."),
  roblox_user_id: z.string().trim().regex(/^[0-9]{1,15}$/, "Roblox User ID must be numeric."),
  discord_username: z.string().trim().min(2).max(40),
  discord_user_id: z.string().trim().regex(/^[0-9]{15,22}$/, "Discord User ID is a 15–22 digit number."),
  discord_display_name: z.string().trim().max(60).optional().or(z.literal("")),
  age_range: z.enum(AGE_RANGES, { errorMap: () => ({ message: "Select your age range." }) }),
  country: z.string().trim().min(2, "Required.").max(80),
  timezone: z.string().trim().min(2, "Required.").max(60),
  preferred_language: z.string().trim().min(2, "Required.").max(40),
  staff_position: z.string().refine((v) => POSITIONS.some((p) => p.id === v && p.open), "Select an open position."),
  answers: z.object(answerShape),
  truthful: z.literal(true, { errorMap: () => ({ message: "You must confirm your answers are truthful." }) }),
  website: z.string().max(0).optional(), // honeypot
});
export const serverApplicationSchema = applicationSchema.extend({ submissionKey: z.string().uuid() });
export type ApplicationInput = z.infer<typeof applicationSchema>;
