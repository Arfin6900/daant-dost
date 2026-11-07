import { z } from "zod/v4";
import { aiEnabled, askJson } from "./ai.js";
import { validateCommands } from "../src/shared/sceneCommands.js";
import { LANGUAGES, languageNote } from "./i18n.js";

// Narrated 3D walkthroughs of common treatments, for patients and students.

const c = (type, extra = {}) => ({ type, ...extra });
const reset = [c("clearHighlights"), c("clearConditions"), c("section", { tooth: null }), c("setLayer", { layer: "gums" })];

export const TREATMENTS = {
  filling: {
    title: "A filling",
    steps: [
      { say: "This is the lower left first molar. Decay has made a small hole in its biting surface.", commands: [...reset, c("focusTeeth", { teeth: ["36"] }), c("showCondition", { tooth: "36", condition: "caries", surfaces: ["O"] })] },
      { say: "Inside, the decay has gone through the hard enamel into the softer dentine, but it has not reached the nerve.", commands: [c("section", { tooth: "36" })] },
      { say: "After numbing the area, the dentist removes the decay and shapes the cavity.", commands: [c("section", { tooth: null }), c("wait", { ms: 400 })] },
      { say: "The hole is then filled with a tooth-coloured or metal filling and shaped to your bite.", commands: [c("clearConditions"), c("showCondition", { tooth: "36", condition: "filling", surfaces: ["O"] })] },
      { say: "That's it. The tooth is sealed again, and the sensitivity usually settles within days.", commands: [c("setView", { view: "left" })] },
    ],
  },
  root_canal: {
    title: "Root canal treatment",
    steps: [
      { say: "This is the lower right first molar. Deep decay has reached the nerve, the pulp, which has become inflamed or infected.", commands: [...reset, c("focusTeeth", { teeth: ["46"] }), c("showCondition", { tooth: "46", condition: "caries", surfaces: ["O", "D"] })] },
      { say: "The pulp runs from the middle of the crown down inside each root. In the X-ray view you can see these canals.", commands: [c("setLayer", { layer: "xray" })] },
      { say: "Under local anaesthetic, the dentist opens the top of the tooth and cleans the infected pulp out of every canal.", commands: [c("section", { tooth: "46" })] },
      { say: "The clean canals are filled and sealed so bacteria cannot get back in.", commands: [c("section", { tooth: null }), c("setLayer", { layer: "roots" }), c("clearConditions"), c("showCondition", { tooth: "46", condition: "root_treated" })] },
      { say: "Back teeth usually get a crown afterwards to protect them from cracking.", commands: [c("setLayer", { layer: "gums" }), c("showCondition", { tooth: "46", condition: "crown" })] },
    ],
  },
  crown: {
    title: "A crown",
    steps: [
      { say: "This is the upper right first molar. A large old filling has left a cusp that has broken off.", commands: [...reset, c("setView", { view: "right" }), c("focusTeeth", { teeth: ["16"] }), c("showCondition", { tooth: "16", condition: "fractured" })] },
      { say: "To protect what is left, the dentist trims the tooth evenly all round and takes a scan or impression.", commands: [c("section", { tooth: "16" })] },
      { say: "A lab makes a crown, a cap that fits over the whole tooth, in porcelain, zirconia or gold.", commands: [c("section", { tooth: null })] },
      { say: "The crown is cemented in place and holds the tooth together like a helmet.", commands: [c("clearConditions"), c("showCondition", { tooth: "16", condition: "crown" })] },
    ],
  },
  extraction: {
    title: "Taking a tooth out",
    steps: [
      { say: "This is the lower left wisdom tooth. It is stuck against the tooth in front, which keeps causing infections.", commands: [...reset, c("setView", { view: "left" }), c("focusTeeth", { teeth: ["38"] }), c("highlight", { teeth: ["38"], color: "#FF7A2F" })] },
      { say: "Its roots sit deep in the jaw bone, close to a nerve, so the dentist checks an X-ray first.", commands: [c("setLayer", { layer: "xray" })] },
      { say: "After numbing, the tooth is gently loosened and removed, sometimes in pieces.", commands: [c("setLayer", { layer: "bone" }), c("clearHighlights"), c("showCondition", { tooth: "38", condition: "missing" })] },
      { say: "A blood clot forms in the socket. Don't smoke, rinse hard or use a straw for a few days, so the clot stays and it heals well.", commands: [c("setLayer", { layer: "gums" })] },
    ],
  },
  implant: {
    title: "A dental implant",
    steps: [
      { say: "Here the lower right first molar is missing, leaving a gap.", commands: [...reset, c("focusTeeth", { teeth: ["46"] }), c("showCondition", { tooth: "46", condition: "missing" })] },
      { say: "An implant is a small titanium screw placed in the jaw bone where the root used to be.", commands: [c("setLayer", { layer: "bone" })] },
      { say: "Over about three months the bone grows tightly around it.", commands: [c("setLayer", { layer: "xray" })] },
      { say: "Then a crown is fixed on top, and it works like a natural tooth.", commands: [c("setLayer", { layer: "gums" }), c("clearConditions"), c("showCondition", { tooth: "46", condition: "implant" })] },
    ],
  },
};

export { LANGUAGES };

const SYSTEM = `You are a kind dentist explaining a treatment to a patient with a 3D model of their mouth.
You are given a scripted walkthrough: each step has narration and 3D commands. Rewrite ONLY the narration in the requested language, in warm, plain, reassuring words a patient understands (short sentences, no jargon, 1-2 sentences per step). Keep the same number of steps and the same meaning; do not add medical advice beyond the script.
Also give a short title in that language.`;

export const explainPlan = async (treatment, language = "English") => {
  const script = TREATMENTS[treatment];
  if (!script) return null;
  const base = { treatment, language: "English", title: script.title, steps: script.steps.map((s) => ({ ...s, commands: validateCommands(s.commands).commands })), ai: false };
  if (language === "English" || !LANGUAGES.includes(language)) return base;
  if (!aiEnabled()) return { ...base, note: `Shown in English: ${language} needs the AI to be connected.` };
  try {
    const out = await askJson({
      system: SYSTEM,
      effort: "low",
      schema: z.object({ title: z.string(), narration: z.array(z.string()) }),
      prompt: `${languageNote(language)}\nTreatment: ${script.title}\nSteps:\n${script.steps.map((s, i) => `${i + 1}. ${s.say}`).join("\n")}`,
    });
    if (out.narration.length !== script.steps.length) throw new Error("step count changed");
    return { ...base, language, title: out.title, steps: base.steps.map((s, i) => ({ ...s, say: out.narration[i] })), ai: true };
  } catch (err) {
    console.warn("[explain] fell back:", err?.reason || err?.message);
    return { ...base, note: `Shown in English: ${language} needs the AI to be connected.` };
  }
};
