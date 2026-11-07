import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod/v4";
import { languageNote } from "../i18n.js";
import { aiEnabled, askJson } from "../ai.js";
import { toothById } from "../../src/data/teeth.js";
import { validateCommands } from "../../src/shared/sceneCommands.js";
import { plainTooth } from "../../src/shared/plainTooth.js";
import { PROBLEM_BY_ID, PROBLEMS, URGENCY } from "./bank.js";
import { triage } from "./triage.js";
import { interviewText, ownWords } from "./interview.js";
import { REMEDIES, unsafeBecause } from "../patient/remedies.js";
import { describeProfile } from "../patient/care.js";

// The patient's self-check result: the rules decide how urgent it is; the AI
// (Qwen) explains it kindly, in the patient's language, without jargon.

const URGENCY_COLOR = { emergency: "#FF3D5E", today: "#FF7A2F", soon: "#FFB020", routine: "#2BD19A" };

// ---- Questions in the patient's language ---------------------------------
// The English values stay the answers the rules read; `display` is what the
// patient sees. Translations are made once by the AI and saved: a file next to
// this one wins (committed, works offline), then server/data/ (made at runtime).

const HERE = dirname(fileURLToPath(import.meta.url));
const slug = (lang) => lang.toLowerCase().replace(/[^a-z]+/g, "-");
const shippedFile = (lang) => join(HERE, `bank.${slug(lang)}.json`);
const cacheFile = (lang) => join(HERE, "..", "data", `bank.${slug(lang)}.json`);
const bankCache = new Map();

const englishStrings = () =>
  PROBLEMS.map((p) => ({
    id: p.id,
    label: p.label,
    hint: p.hint,
    questions: p.questions.map((q) => ({ id: q.id, text: q.text, options: q.options || [], labels: q.labels || [] })),
  }));

const TranslatedBank = z.object({
  problems: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      hint: z.string(),
      questions: z.array(z.object({ id: z.string(), text: z.string(), options: z.array(z.string()), labels: z.array(z.string()) })),
    }),
  ),
});

const readJson = (file) => {
  try {
    return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  } catch {
    return null;
  }
};

// The same shape as englishStrings(), checked so options line up one to one.
const fits = (t) => {
  const en = englishStrings();
  return (
    Array.isArray(t) &&
    t.length === en.length &&
    t.every((p, i) => p.id === en[i].id && p.questions.length === en[i].questions.length && p.questions.every((q, j) => q.options.length === en[i].questions[j].options.length))
  );
};

export const translateBank = async (language) => {
  if (language === "English") return null;
  if (bankCache.has(language)) return bankCache.get(language);
  const saved = readJson(shippedFile(language)) || readJson(cacheFile(language));
  if (fits(saved)) {
    bankCache.set(language, saved);
    return saved;
  }
  if (!aiEnabled()) return null;
  const out = await askJson({
    system: `You translate a dental self-check questionnaire for members of the public. Keep it warm, very simple and natural, never clinical. ${languageNote(language)}
Translate every string. Keep every "id" unchanged, and keep the same number and order of problems, questions, options and labels.`,
    prompt: JSON.stringify({ problems: englishStrings() }),
    schema: TranslatedBank,
    effort: "low",
    maxTokens: 8000,
  });
  if (!fits(out.problems)) throw new Error("translation did not line up");
  bankCache.set(language, out.problems);
  try {
    mkdirSync(dirname(cacheFile(language)), { recursive: true });
    writeFileSync(cacheFile(language), JSON.stringify(out.problems, null, 1));
  } catch {
    // Cache is optional.
  }
  return out.problems;
};

export const publicBank = async (language = "English") => {
  let t = null;
  try {
    t = await translateBank(language);
  } catch (err) {
    console.warn("[selfcheck] question translation fell back:", err?.message);
  }
  return PROBLEMS.map((p, i) => ({
    id: p.id,
    icon: p.icon,
    label: p.label,
    hint: p.hint,
    display: t ? { label: t[i].label, hint: t[i].hint } : null,
    questions: p.questions.map((q, j) => ({
      ...q,
      display: t ? { text: t[i].questions[j].text, options: t[i].questions[j].options, labels: t[i].questions[j].labels } : null,
    })),
  }));
};

const SYSTEM = `You are a kind, calm dental nurse helping a member of the public who knows no dental words.
They did a self-check. You are given what they told you and a SAFETY RESULT worked out by rules: the urgency and the possible causes. You must:
- Never change or soften the urgency; you may only repeat it in your own words.
- Only talk about the possible causes listed; never add others and never say for certain what they have. Say "it could be", "often".
- Use very plain, warm words, short sentences, no jargon. When you must use a dental word, explain it in brackets.
- Write everything in the requested language.
summary: 2-3 sentences that reflect back what they told you and what it most likely means.
causeNotes: one short personal sentence per listed cause (same order) linking it to what they said.
reassurance: one sentence to reduce worry, honest and not falsely comforting.
words: 2-5 dental words they may hear from the dentist with plain meanings.
This is information, not a diagnosis; they should see a dentist.`;

const Out = z.object({
  summary: z.string(),
  causeNotes: z.array(z.string()),
  reassurance: z.string(),
  words: z.array(z.object({ word: z.string(), meaning: z.string() })),
});

// For other languages the fixed advice is translated too, line for line.
const Translated = z.object({
  urgencyTitle: z.string(),
  urgencyAction: z.string(),
  redFlags: z.array(z.string()),
  causes: z.array(z.object({ name: z.string(), explain: z.string() })),
  immediate: z.array(z.string()),
  selfCare: z.array(z.string()),
  getHelpIf: z.array(z.string()),
  askDentist: z.array(z.string()),
});
const OutTranslated = Out.extend({ translation: Translated });

const describeAnswers = (problem, answers) =>
  problem.questions
    .filter((q) => answers[q.id] !== undefined && answers[q.id] !== "")
    .map((q) => `- ${q.text} ${[].concat(answers[q.id]).join(", ")}`)
    .join("\n");

// Painkiller advice that fits the person's allergies, conditions and age.
const painAdvice = (profile, age) => {
  const ok = (id) => !unsafeBecause(Object.values(REMEDIES).flat().find((r) => r.id === id), profile || {}, age);
  const both = ["paracetamol", "ibuprofen"].filter(ok);
  if (both.length === 2) return null;
  if (both[0] === "paracetamol") return "Paracetamol from a pharmacy can help with pain; follow the dose on the packet. Because of your history, avoid ibuprofen and aspirin unless a doctor says it's fine.";
  if (both[0] === "ibuprofen") return "Ibuprofen from a pharmacy can help with pain; follow the dose on the packet. Because of your history, avoid paracetamol.";
  return "Because of your allergies or health conditions, ask a pharmacist which painkiller is safe for you before taking anything.";
};

export const selfCheckResult = async ({ problem: problemId, answers = {}, story = "", teeth = [], who = "me", age, language = "English", profile = null, qa = [], feedback = [] }) => {
  const problem = PROBLEM_BY_ID[problemId];
  if (!problem) return null;
  const base = triage(problemId, answers, ownWords({ story, qa, feedback }));
  const swap = painAdvice(profile, who === "child" ? age : undefined);
  if (swap) base.selfCare = base.selfCare.map((s) => (/paracetamol or ibuprofen/.test(s) ? swap : s));
  const validTeeth = [].concat(teeth).map(String).filter((id) => toothById(id)).slice(0, 4);
  const color = URGENCY_COLOR[base.urgency.level];
  const commands = validTeeth.length
    ? validateCommands([
        { type: "clearHighlights" },
        { type: "setLayer", layer: "gums" },
        { type: "focusTeeth", teeth: validTeeth },
        { type: "highlight", teeth: validTeeth, color },
      ]).commands
    : [];
  const result = {
    ...base,
    color,
    teeth: validTeeth.map((id) => ({ id, plain: plainTooth(id) })),
    commands,
    summary: `You told us about ${problem.label.toLowerCase()}${validTeeth.length ? ` around your ${plainTooth(validTeeth[0])}` : ""}. Based on your answers, here is what it could be and what to do next.`,
    reassurance: "Most dental problems are very treatable, especially when they're seen early.",
    words: base.causes.map((c) => ({ word: c.term, meaning: c.name })),
    language: "English",
    ai: false,
  };
  if (!aiEnabled()) return result;
  try {
    const translate = language !== "English";
    const out = await askJson({
      system: SYSTEM,
      effort: "medium",
      schema: translate ? OutTranslated : Out,
      maxTokens: translate ? 6000 : 3000,
      prompt: `${languageNote(language)}
Who: ${who === "child" ? `their child${age ? `, aged ${age}` : ""}` : "themselves"}
Their dental and medical history: ${profile ? describeProfile(profile) : "not given"} (mention anything in it that matters, e.g. an allergy, a condition or a past treatment on the same tooth).
Problem: ${problem.label}
Where: ${validTeeth.map(plainTooth).join("; ") || "not marked"}
In their own words: ${story || "(nothing extra)"}
Their answers:
${describeAnswers(problem, answers)}
${qa.length ? `\nThe interview:\n${interviewText(qa)}` : ""}
${feedback.length ? `\nCorrections they gave after an earlier report (these override earlier answers; acknowledge them in the summary):\n${feedback.map((f) => `- ${f}`).join("\n")}` : ""}

SAFETY RESULT (do not change): urgency "${base.urgency.title}"${base.redFlags.length ? `; warning signs: ${base.redFlags.join(", ")}` : ""}.
Possible causes, in order:
${base.causes.map((c, i) => `${i + 1}. ${c.name} (${c.term}, ${c.likelihood}): ${c.explain}`).join("\n")}${
        translate
          ? `

Also fill "translation": translate this fixed advice line for line, same order and count, without changing its meaning or urgency:
${JSON.stringify({
  urgencyTitle: base.urgency.title,
  urgencyAction: base.urgency.action,
  redFlags: base.redFlags,
  causes: base.causes.map((c) => ({ name: c.name, explain: c.explain })),
  immediate: base.immediate || [],
  selfCare: base.selfCare,
  getHelpIf: base.getHelpIf,
  askDentist: base.askDentist,
})}`
          : ""
      }`,
    });
    const tr = translate ? out.translation : null;
    const same = (a, b) => Array.isArray(a) && a.length === (b || []).length;
    const translated = tr
      ? {
          urgency: { ...result.urgency, title: tr.urgencyTitle, action: tr.urgencyAction },
          redFlags: same(tr.redFlags, result.redFlags) ? tr.redFlags : result.redFlags,
          immediate: result.immediate && same(tr.immediate, result.immediate) ? tr.immediate : result.immediate,
          selfCare: same(tr.selfCare, result.selfCare) ? tr.selfCare : result.selfCare,
          getHelpIf: same(tr.getHelpIf, result.getHelpIf) ? tr.getHelpIf : result.getHelpIf,
          askDentist: same(tr.askDentist, result.askDentist) ? tr.askDentist : result.askDentist,
        }
      : {};
    return {
      ...result,
      ...translated,
      summary: out.summary,
      reassurance: out.reassurance,
      causes: result.causes.map((c, i) => ({
        ...c,
        ...(tr && same(tr.causes, result.causes) ? { name: tr.causes[i].name, explain: tr.causes[i].explain } : {}),
        note: out.causeNotes[i] || "",
      })),
      words: out.words.slice(0, 5),
      language,
      ai: true,
    };
  } catch (err) {
    console.warn("[selfcheck] fell back:", err?.reason || err?.message);
    return result;
  }
};

const ASK_SYSTEM = `You are a kind dental nurse answering a member of the public's follow-up question after their self-check.
Answer in very plain words, 2-5 short sentences, in the requested language. Explain any dental word in brackets.
Never diagnose, never contradict or lower the urgency you are given, and never recommend prescription medicines or doses beyond "follow the packet".
If the question describes breathing or swallowing trouble, spreading swelling or heavy bleeding, tell them to get emergency help now.`;

export const selfCheckAnswer = async ({ question, context = {}, language = "English" }) => {
  const urgency = URGENCY[context.urgency] || null;
  const fallback = {
    answer: `Good question to ask your dentist. ${urgency ? urgency.action : "If you're worried, call your dentist for advice."}`,
    ai: false,
  };
  if (!aiEnabled()) return fallback;
  try {
    const out = await askJson({
      system: ASK_SYSTEM,
      effort: "low",
      schema: z.object({ answer: z.string() }),
      prompt: `${languageNote(language)}
Their self-check: ${context.problem || "unknown"}; urgency "${urgency?.title || "unknown"}"; possible causes: ${(context.causes || []).join(", ") || "unknown"}.
Their question: ${question}`,
    });
    return { answer: out.answer, ai: true };
  } catch (err) {
    console.warn("[selfcheck ask] fell back:", err?.reason || err?.message);
    return fallback;
  }
};
