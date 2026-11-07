import { z } from "zod/v4";
import { aiEnabled, askJson } from "../ai.js";
import { languageNote } from "../i18n.js";
import { describeProfile } from "../patient/care.js";
import { plainTooth } from "../../src/shared/plainTooth.js";
import { NOT_SURE_ANSWER, PROBLEM_BY_ID } from "./bank.js";

// The adaptive interview: the AI asks the next question that fits this
// person's story and answers, while the bank's questions act as a checklist
// of what must be covered. Afterwards the conversation is turned back into
// the bank's answers, so the fixed safety rules still decide the urgency.

export const MAX_QUESTIONS = 7;

const Next = z.object({
  done: z.boolean(),
  question: z.object({
    text: z.string(),
    type: z.enum(["single", "multi", "scale", "text"]),
    options: z.array(z.string()),
    why: z.string(),
  }),
});

const SYSTEM = `You are a kind dental nurse doing a short self-check interview with a member of the public who knows no dental words.
Ask ONE next question that is precise to what they have already told you (refer to their words, their tooth and their answers). Never ask something they already answered or said in their story.
The CHECKLIST lists what the safety rules need to know; make sure each item is covered (in your own precise wording), most important first, especially danger signs (spreading swelling, breathing or swallowing trouble, fever, knocked-out tooth timing). Skip items their story already answers.
Prefer simple tap answers: "single" with 2-5 short options, or "multi" for "choose all that apply" (always add an "I'm not sure" option, in the person's language, to single and multi), "scale" for pain 0-10 (options empty), "text" only if you really need words (options empty).
"why": a few words on why you ask (shown small).
Set done=true when the checklist is covered or you've asked ${MAX_QUESTIONS} questions; then question can be empty strings.`;

const checklist = (problem) => problem.questions.map((q) => `- ${q.text}${q.options ? ` (${q.options.filter((o) => o !== NOT_SURE_ANSWER).join(" / ")})` : ""}`).join("\n");

const context = ({ problem, who, age, story, teeth, profile }) =>
  `Problem they chose: ${problem.label}
Who: ${who === "child" ? `their child${age !== undefined ? `, aged ${age}` : ""}` : "themselves"}
Where: ${(teeth || []).map(plainTooth).join("; ") || "not marked"}
Their story: ${story || "(none)"}
Their history: ${profile ? describeProfile(profile) : "not given"}`;

const transcript = (qa) => (qa || []).map((x, i) => `Q${i + 1}: ${x.question}\nA${i + 1}: ${[].concat(x.answer).join(", ")}`).join("\n") || "(no questions yet)";

// Without the AI: the bank's next question, translated if we have it.
const bankQuestion = (problem, qa, display) => {
  const asked = new Set((qa || []).map((x) => x.bankId).filter(Boolean));
  const q = problem.questions.find((x) => !asked.has(x.id));
  if (!q) return { done: true, question: null };
  const shown = display?.find((d) => d.id === q.id)?.display;
  return {
    done: false,
    question: {
      bankId: q.id,
      text: shown?.text || q.text,
      type: q.type,
      options: q.options || [],
      shownOptions: shown?.options,
      labels: shown?.labels || q.labels,
      min: q.min,
      max: q.max,
    },
    ai: false,
  };
};

export const nextQuestion = async ({ problem: problemId, qa = [], language = "English", display, ...rest }) => {
  const problem = PROBLEM_BY_ID[problemId];
  if (!problem) return null;
  if (qa.length >= MAX_QUESTIONS) return { done: true, question: null };
  if (aiEnabled()) {
    try {
      const out = await askJson({
        system: SYSTEM,
        effort: "low",
        schema: Next,
        maxTokens: 700,
        prompt: `${languageNote(language)}
${context({ problem, ...rest })}

CHECKLIST:
${checklist(problem)}

Asked so far (${qa.length}/${MAX_QUESTIONS}):
${transcript(qa)}`,
      });
      if (out.done || !out.question.text.trim()) return { done: true, question: null, ai: true };
      const q = out.question;
      const options = q.type === "single" || q.type === "multi" ? q.options.filter(Boolean).slice(0, 7) : [];
      if ((q.type === "single" || q.type === "multi") && options.length < 2) throw new Error("question without options");
      return {
        done: false,
        question: { text: q.text, type: q.type, options, why: q.why, min: 0, max: 10, labels: ["No pain", "Worst pain ever"] },
        ai: true,
      };
    } catch (err) {
      console.warn("[interview] fell back:", err?.reason || err?.message);
    }
  }
  return bankQuestion(problem, qa, display);
};

// Turns the conversation (and any feedback) back into the bank's answers.
export const extractAnswers = async ({ problem: problemId, qa = [], story = "", feedback = [], ...rest }) => {
  const problem = PROBLEM_BY_ID[problemId];
  const direct = Object.fromEntries((qa || []).filter((x) => x.bankId).map((x) => [x.bankId, x.answer]));
  if (!aiEnabled() || (!feedback.length && qa.every((x) => x.bankId))) return direct;
  const shape = z.object({
    answers: z.array(z.object({ id: z.string(), choice: z.array(z.string()), number: z.number() })),
  });
  try {
    const out = await askJson({
      system: `From a dental self-check interview, fill in a fixed form. For each form question, pick the option(s) exactly as written that the person's story, answers and later corrections support. If they didn't say, choose "${NOT_SURE_ANSWER}" if it's an option, otherwise leave choice empty. Later corrections override earlier answers. For scale questions put the number in "number" (or -1 if unknown) and leave choice empty. Never guess danger signs they didn't mention.`,
      effort: "medium",
      schema: shape,
      maxTokens: 1500,
      prompt: `${context({ problem, story, ...rest })}

Interview:
${transcript(qa)}
${feedback.length ? `\nCorrections and feedback they gave after the report:\n${feedback.map((f) => `- ${f}`).join("\n")}` : ""}

FORM (id: question [options]):
${problem.questions.map((q) => `${q.id}: ${q.text} ${q.type === "scale" ? "[number 0-10]" : `[${q.options.join(" | ")}]`}${q.type === "multi" ? " (several allowed)" : ""}`).join("\n")}`,
    });
    const answers = { ...direct };
    out.answers.forEach(({ id, choice, number }) => {
      const q = problem.questions.find((x) => x.id === id);
      if (!q) return;
      if (q.type === "scale") {
        if (number >= 0 && number <= 10) answers[id] = Math.round(number);
        return;
      }
      const valid = choice.filter((c) => q.options.includes(c));
      if (!valid.length) return;
      answers[id] = q.type === "multi" ? valid : valid[0];
    });
    return answers;
  } catch (err) {
    console.warn("[interview extract] fell back:", err?.reason || err?.message);
    return direct;
  }
};

// Only the person's own words, for the red-flag scan. Question text is left
// out ("Is it hard to breathe?" is not a red flag); tapped answers are read
// through the form instead.
export const ownWords = ({ story = "", qa = [], feedback = [] }) =>
  [story, ...qa.filter((x) => x.type === "text").map((x) => String(x.answer || "")), ...feedback].join("\n");

export const interviewText = transcript;
