import { describe, it, expect } from "vitest";
import { parseAdminEmails, isAllowedAdmin, applicationSchema, serverApplicationSchema, ALL_Q } from "./shared";
describe("admin allowlist", () => {
  const list = parseAdminEmails("One@Gmail.com", "two@gmail.com");
  it("parses two valid distinct emails", () => expect(list).toEqual(["one@gmail.com", "two@gmail.com"]));
  it("fails closed when missing, invalid or duplicated", () => {
    expect(parseAdminEmails(undefined, "b@x.com")).toBeNull();
    expect(parseAdminEmails("a@x.com", "nope")).toBeNull();
    expect(parseAdminEmails("a@x.com", "A@x.com")).toBeNull();
    expect(isAllowedAdmin("a@x.com", null)).toBe(false);
  });
  it("allows admin 1 and admin 2, case-insensitively", () => {
    expect(isAllowedAdmin("ONE@gmail.com", list)).toBe(true);
    expect(isAllowedAdmin("two@gmail.com", list)).toBe(true);
  });
  it("denies a third account and empty identities", () => {
    expect(isAllowedAdmin("three@gmail.com", list)).toBe(false);
    expect(isAllowedAdmin(null, list)).toBe(false);
  });
});
const answers = Object.fromEntries(ALL_Q.map((q) => [q.id, "I would review the evidence calmly and act fairly."]));
const valid = { contact_email: "a@b.com", roblox_username: "Player_1", roblox_user_id: "12345", discord_username: "player", discord_user_id: "123456789012345678",
  age_range: "18-24", country: "US", timezone: "America/New_York", preferred_language: "English", staff_position: "support", answers, truthful: true };
describe("application validation", () => {
  it("accepts a valid application", () => expect(applicationSchema.safeParse(valid).success).toBe(true));
  it.each([
    ["bad email", { contact_email: "nope" }], ["non-numeric roblox id", { roblox_user_id: "abc" }], ["bad discord id", { discord_user_id: "12" }],
    ["closed position", { staff_position: "admin" }], ["not truthful", { truthful: false }], ["honeypot filled", { website: "x" }],
    ["short answer", { answers: { ...answers, e1: "no" } }],
  ])("rejects %s", (_n, patch) => expect(applicationSchema.safeParse({ ...valid, ...patch }).success).toBe(false));
  it("server schema requires a UUID submission key", () => {
    expect(serverApplicationSchema.safeParse(valid).success).toBe(false);
    expect(serverApplicationSchema.safeParse({ ...valid, submissionKey: crypto.randomUUID() }).success).toBe(true);
  });
});
