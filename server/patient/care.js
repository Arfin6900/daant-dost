import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { aiEnabled, askJson } from "../ai.js";
import { languageNote } from "../i18n.js";
import { redFlagsInText } from "../selfcheck/triage.js";
import { URGENCY } from "../selfcheck/bank.js";
import { nextRemedy, remedyById, safeRemedies, unsafeBecause } from "./remedies.js";

// A patient's dental history and their cases: a self-check result, the care
// conversation that follows it, and how it was resolved.

const FIELDS = ["treatments", "medicines", "allergies", "conditions"];
const now = () => new Date().toISOString();

export const cleanProfile = (p = {}) => ({
  ...Object.fromEntries(
    FIELDS.map((f) => [
      f,
      [...new Set([].concat(p[f] || []).map((x) => String(x).trim().slice(0, 100)).filter(Boolean))].slice(0, 40),
    ]),
  ),
  notes: String(p.notes || "").slice(0, 1000),
});

export const emptyProfile = (id) => ({ id, ...cleanProfile(), updatedAt: null });

export const describeProfile = (p) =>
  FIELDS.map((f) => `${f}: ${p?.[f]?.length ? p[f].join(", ") : "none given"}`).join("; ") + (p?.notes ? `; notes: ${p.notes}` : "");

export const newCase = ({ patientId, input, result }) => ({
  id: randomUUID(),
  patientId,
  createdAt: now(),
  updatedAt: now(),
  status: "open",
  problem: input.problem,
  language: input.language || "English",
  age: input.who === "child" ? input.age : undefined,
  input,
  result,
  care: { tried: [], rejected: [], offered: [], current: null },
  messages: [],
  resolution: null,
});

// What the patient meant, without the AI.
const INTENTS = [
  ["allergic", /allerg|react(ion)? to|rash|can'?t take|cannot take|not allowed|mujhe .*allergy|allergy hai/i],
  ["tried", /already|tried|did that|done that|kar chuka|kar chuki|kar liya|try kiya|pehle hi/i],
  ["helped", /helped|better|works|worked|gone|fine now|theek|behtar|aram|araam|fark para/i],
  ["worse", /worse|more pain|spreading|zyada dard|barh gaya|bigger|swelling more/i],
];
export const guessIntent = (text) => (INTENTS.find(([, re]) => re.test(text)) || ["question"])[0];

const offerText = (remedy) =>
  remedy
    ? `You could try: ${remedy.title}.\n${remedy.steps.map((s) => `• ${s}`).join("\n")}\n\nTell me if you're allergic to it, have already tried it, or if it helps.`
    : "I've run out of safe home options for this. The best next step is to see a dentist, who can treat the cause.";

const SYSTEM = `You are a caring dental nurse in a follow-up chat with a member of the public about their dental problem. They know no dental words.
Rules:
- Only suggest the home remedy you are given (REMEDY TO OFFER); never invent medicines, doses or treatments. If none is given, say kindly that the next step is to see a dentist.
- Respect their history: never suggest anything they're allergic to or have tried.
- Never lower the urgency. Always remind them, briefly, that home care eases symptoms but a dentist must treat the cause.
- If they describe breathing or swallowing trouble, spreading swelling, or heavy bleeding, tell them to get emergency help now.
- Plain, warm, short (3-6 sentences), steps as a short list.
Also report what the patient's last message meant (intent): "allergic" (they're allergic to or can't take the last remedy), "tried" (already tried it, didn't help), "helped" (it helped), "worse" (getting worse), "question" (anything else), "start" (first message).
If they named a new allergy, put it in newAllergy (the substance only), else empty string.`;

const Reply = z.object({
  intent: z.enum(["allergic", "tried", "helped", "worse", "question", "start"]),
  newAllergy: z.string(),
  reply: z.string(),
});

const say = (c, role, text, extra = {}) => c.messages.push({ role, text, at: now(), ...extra });

// One turn of the care conversation. `message` null starts it.
export const careTurn = async (c, profile, message) => {
  const age = c.age;
  const last = c.care.current && remedyById(c.care.current);
  if (message) say(c, "patient", message);

  // Work out what they meant (the AI may refine it below).
  let intent = message ? guessIntent(message) : "start";
  let newAllergy = "";
  let ai = false;

  const flags = message ? redFlagsInText(message) : [];
  const apply = () => {
    if (last && intent === "allergic") {
      c.care.rejected = [...new Set([...c.care.rejected, last.id])];
      if (newAllergy) profile.allergies = [...new Set([...profile.allergies, newAllergy])];
    }
    if (last && intent === "tried") c.care.tried = [...new Set([...c.care.tried, last.id])];
  };

  if (aiEnabled() && message) {
    // A quick read of the intent first, so the right next remedy is offered.
    try {
      const read = await askJson({
        system: 'Classify the patient\'s message about the remedy they were offered. intent: "allergic" (allergic to it or cannot take it), "tried" (already tried it / it did not help), "helped", "worse", or "question". newAllergy: the substance they said they are allergic to, or "".',
        prompt: `Remedy offered: ${last?.title || "none"}\nPatient: ${message}`,
        schema: Reply.pick({ intent: true, newAllergy: true }),
        effort: "low",
        maxTokens: 200,
      });
      intent = read.intent;
      newAllergy = read.newAllergy.trim().toLowerCase().slice(0, 60);
    } catch {
      // Keep the keyword guess.
    }
  }
  apply();

  const helped = intent === "helped";
  // A plain question keeps the current remedy; anything else moves on.
  const keep = (intent === "question" || intent === "worse") && last && !c.care.rejected.includes(last.id);
  const remedy = helped ? null : keep ? last : nextRemedy(c.problem, profile, c.care, age);
  if (remedy) c.care.offered = [...new Set([...c.care.offered, remedy.id])];
  c.care.current = helped ? c.care.current : remedy?.id || null;
  const urgency = URGENCY[c.result?.urgency?.level] || URGENCY.soon;

  let reply;
  if (aiEnabled()) {
    try {
      const out = await askJson({
        system: SYSTEM,
        effort: "low",
        schema: Reply,
        maxTokens: 1200,
        prompt: `${languageNote(c.language)}
Their problem: ${c.result?.problem}. Urgency (do not change): ${urgency.title}. Possible causes: ${(c.result?.causes || []).map((x) => x.name).join(", ")}.
Their history: ${describeProfile(profile)}.
Already tried: ${c.care.tried.map((id) => remedyById(id)?.title).join(", ") || "nothing"}. Can't use: ${c.care.rejected.map((id) => remedyById(id)?.title).join(", ") || "nothing"}.
Recent chat:
${c.messages.slice(-6).map((m) => `${m.role === "patient" ? "Patient" : "You"}: ${m.text}`).join("\n") || "(none yet)"}
${flags.length ? `WARNING SIGNS in their message: ${flags.join(", ")}. Tell them to get emergency help now.` : ""}
${intent === "question" ? "They asked a question: answer it first, plainly. Then briefly remind them of the current remedy below. " : ""}${helped ? "They say it helped: be glad, tell them to still see the dentist to treat the cause, and suggest pressing 'My problem is solved' when it's fully better." : `REMEDY TO OFFER: ${remedy ? `${remedy.title}: ${remedy.steps.join(" ")}` : "none left"}`}`,
      });
      reply = out.reply;
      ai = true;
    } catch (err) {
      console.warn("[care] fell back:", err?.reason || err?.message);
    }
  }
  if (!reply) {
    reply = flags.length
      ? `${URGENCY.emergency.action}\n\n${offerText(remedy)}`
      : helped
        ? "I'm glad that helped. Please still see a dentist to treat the cause. When you feel fully better, press “My problem is solved” to save what worked."
        : intent === "question"
          ? `That's a good question for your dentist. Meanwhile, keep going with: ${remedy ? remedy.title : "seeing a dentist soon"}.`
          : `${intent === "allergic" ? "Thanks for telling me, I won't suggest that again. " : intent === "tried" ? "Thanks, let's try something else. " : ""}${offerText(remedy)}`;
  }

  say(c, "assistant", reply, { remedy: remedy ? { id: remedy.id, title: remedy.title, steps: remedy.steps } : null, intent, urgent: flags.length > 0, ai });
  c.updatedAt = now();
  return { case: c, profile, intent };
};

export const resolveCase = (c, { whatHelped, note }) => {
  const remedy = remedyById(whatHelped);
  c.status = "resolved";
  c.resolution = {
    at: now(),
    whatHelped: remedy ? remedy.title : String(whatHelped || "").slice(0, 200) || "Not recorded",
    remedyId: remedy?.id || null,
    note: String(note || "").slice(0, 1000),
  };
  c.updatedAt = now();
  return c;
};

// For the history list: one line per case.
export const caseSummary = (c) => ({
  id: c.id,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
  status: c.status,
  problem: c.result?.problem || c.problem,
  urgency: c.result?.urgency?.level,
  urgencyTitle: c.result?.urgency?.title,
  teeth: c.result?.teeth || [],
  cause: c.result?.causes?.[0]?.name,
  resolution: c.resolution,
});

export { safeRemedies, unsafeBecause };
