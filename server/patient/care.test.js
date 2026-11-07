// @vitest-environment node
import { describe, expect, test } from "vitest";
import { careTurn, cleanProfile, guessIntent, newCase, resolveCase } from "./care.js";
import { nextRemedy, safeRemedies } from "./remedies.js";

process.env.AI_DISABLED = "1";
const profile = (extra = {}) => ({ id: "p", ...cleanProfile(extra) });
const kase = () =>
  newCase({ patientId: "p", input: { problem: "toothache", language: "English" }, result: { problem: "Toothache", urgency: { level: "soon" }, causes: [] } });

describe("remedies respect the patient's history", () => {
  test("an NSAID allergy or blood thinners rule out ibuprofen", () => {
    expect(safeRemedies("toothache", profile({ allergies: ["Aspirin"] })).map((r) => r.id)).not.toContain("ibuprofen");
    expect(safeRemedies("toothache", profile({ medicines: ["Warfarin 5mg"] })).map((r) => r.id)).not.toContain("ibuprofen");
    expect(safeRemedies("toothache", profile()).map((r) => r.id)).toContain("ibuprofen");
  });

  test("young children aren't offered adult-only remedies", () => {
    expect(safeRemedies("toothache", profile(), 4).map((r) => r.id)).not.toContain("clove_oil");
  });

  test("next remedy skips what was tried or refused", () => {
    expect(nextRemedy("toothache", profile(), { tried: ["paracetamol"], rejected: ["ibuprofen"] }).id).toBe("avoid_triggers");
  });
});

describe("care conversation without AI", () => {
  test("reads intent in English and Roman Urdu", () => {
    expect(guessIntent("I'm allergic to that")).toBe("allergic");
    expect(guessIntent("maine pehle hi try kiya")).toBe("tried");
    expect(guessIntent("ab theek hai, behtar hai")).toBe("helped");
    expect(guessIntent("what about tea?")).toBe("question");
  });

  test("offers, moves on when allergic or tried, and closes when resolved", async () => {
    const c = kase();
    const p = profile();
    await careTurn(c, p, null);
    expect(c.care.current).toBe("paracetamol");
    await careTurn(c, p, "I'm allergic to paracetamol");
    expect(c.care.rejected).toContain("paracetamol");
    expect(c.care.current).toBe("ibuprofen");
    await careTurn(c, p, "already tried it, no change");
    expect(c.care.tried).toContain("ibuprofen");
    expect(c.care.current).toBe("avoid_triggers");
    await careTurn(c, p, "that helped a lot, better now");
    expect(c.messages.at(-1).text).toMatch(/solved/);
    resolveCase(c, { whatHelped: "avoid_triggers", note: "Saw dentist, got a filling" });
    expect(c.status).toBe("resolved");
    expect(c.resolution.whatHelped).toBe("Avoid what sets it off");
  });

  test("warning signs in a message say get help now", async () => {
    const c = kase();
    await careTurn(c, profile(), null);
    await careTurn(c, profile(), "now my face is swollen and I can't swallow");
    expect(c.messages.at(-1).urgent).toBe(true);
    expect(c.messages.at(-1).text).toMatch(/A&E/);
  });
});
