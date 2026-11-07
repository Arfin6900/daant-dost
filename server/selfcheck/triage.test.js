// @vitest-environment node
import { describe, expect, test } from "vitest";
import { triage, redFlagsInText } from "./triage.js";
import { PROBLEMS } from "./bank.js";

describe("patient self-check triage", () => {
  test("short twinge with cold is not urgent and points to an early cavity", () => {
    const r = triage("toothache", { trigger: ["Cold drinks or food"], lasts: "A few seconds, then it goes", night: "No", swelling: "No swelling", severity: 3, fever: "No" });
    expect(r.urgency.level).toBe("soon");
    expect(r.causes[0].id).toBe("early_decay");
    expect(r.redFlags).toEqual([]);
  });

  test("lingering night pain means the nerve is inflamed", () => {
    const r = triage("toothache", { trigger: ["Hot drinks or food"], lasts: "Minutes or longer", night: "Yes", swelling: "No swelling" });
    expect(r.causes[0].id).toBe("inflamed_nerve");
  });

  test("spreading swelling is always an emergency", () => {
    expect(triage("toothache", { swelling: "Swelling spreading towards my eye, neck or under my jaw" }).urgency.level).toBe("emergency");
    expect(triage("swelling", { where: "On the gum by a tooth", breathing: "Yes" }).urgency.level).toBe("emergency");
    expect(triage("wisdom", { breathing: "Yes" }).urgency.level).toBe("emergency");
  });

  test("a knocked-out adult tooth is an emergency with first-aid steps; a baby tooth is not put back", () => {
    const adult = triage("knocked_out", { whose: "An adult tooth (age 7 and over)", when: "Less than 1 hour" });
    expect(adult.urgency.level).toBe("emergency");
    expect(adult.immediate.join(" ")).toMatch(/milk/);
    const baby = triage("knocked_out", { whose: "A child's baby tooth" });
    expect(baby.urgency.level).toBe("today");
    expect(baby.immediate[0]).toMatch(/Don't put a baby tooth back/);
  });

  test("a sore lasting over 3 weeks should be checked", () => {
    const r = triage("ulcer", { howlong: "More than 3 weeks" });
    expect(r.causes[0].id).toBe("long_ulcer");
    expect(r.urgency.level).toBe("soon");
  });

  test("the patient's own words can raise the urgency", () => {
    expect(redFlagsInText("my face is swollen and now I can't swallow")).toContain("Trouble swallowing");
    expect(triage("gums", { when: "Only when I brush or floss" }, "it's hard to breathe").urgency.level).toBe("emergency");
  });

  test("every problem gives at least one cause, care advice and questions for the dentist", () => {
    PROBLEMS.forEach((p) => {
      const r = triage(p.id, {});
      expect(r.causes.length).toBeGreaterThan(0);
      expect(r.askDentist.length).toBeGreaterThan(0);
      expect(r.urgency.title).toBeTruthy();
    });
  });
});
