import { randomUUID } from "node:crypto";
import express from "express";
import { aiEnabled, MODEL } from "./ai.js";
import { coachReport, gradeText, patientReply } from "./assessor.js";
import { CASES, caseById } from "./cases.js";
import { TUTOR_SUGGESTIONS, tutorPlan } from "./tutor.js";
import { TREATMENTS, explainPlan } from "./explain.js";
import { LANGUAGES } from "./i18n.js";
import { generateCase } from "./caseAuthor.js";
import { rateLimit } from "./rateLimit.js";
import { publicBank, selfCheckAnswer, selfCheckResult } from "./selfcheck/selfCheck.js";
import { extractAnswers, nextQuestion } from "./selfcheck/interview.js";
import { patientRoutes } from "./patient/routes.js";
import {
  MAX_HISTORY_QUESTIONS,
  answerItem,
  askPatient,
  buildReport,
  endHistory,
  gradeChoice,
  publicCase,
  startAttempt,
  viewOf,
} from "./engine.js";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const cleanStudent = (s) => ({
  id: String(s?.id || "").slice(0, 64) || randomUUID(),
  name: String(s?.name || "Student").trim().slice(0, 60) || "Student",
});

export const createApp = ({ store, limits = {} }) => {
  const app = express();
  app.set("trust proxy", 1);
  const aiLimit = rateLimit({ max: 40, windowMs: 60_000, ...limits.ai });
  const authorLimit = rateLimit({ max: 5, windowMs: 10 * 60_000, ...limits.author });
  app.use(express.json({ limit: "100kb" }));
  const api = express.Router();

  // Built-in stations first, then ones the AI wrote.
  const getCard = async (id) => caseById(id) || (id ? await store.getCase(String(id)) : null);

  const load = async (id) => {
    const attempt = await store.get(id);
    if (!attempt) throw new HttpError(404, "That assessment could not be found.");
    const card = await getCard(attempt.caseId);
    if (!card) throw new HttpError(404, "That case is no longer available.");
    return { attempt, card };
  };

  api.get("/health", (req, res) => res.json({ ok: true, ai: aiEnabled(), model: aiEnabled() ? MODEL : null, db: store.kind }));

  api.get(
    "/cases",
    wrap(async (req, res) => {
      const generated = await store.listCases();
      res.json([...CASES.map(publicCase), ...generated.map((c) => ({ ...publicCase(c), generated: true }))]);
    }),
  );

  api.post(
    "/cases/generate",
    authorLimit,
    wrap(async (req, res) => {
      const brief = String(req.body?.brief || "").trim().slice(0, 400);
      if (brief.length < 8) throw new HttpError(400, "Describe the patient in a few words first.");
      const difficulty = [1, 2, 3].includes(req.body?.difficulty) ? req.body.difficulty : undefined;
      const card = await generateCase(brief, { difficulty, author: cleanStudent(req.body?.student).name });
      await store.saveCase(card);
      res.status(201).json({ ...publicCase(card), generated: true });
    }),
  );

  api.post(
    "/assessments",
    wrap(async (req, res) => {
      const card = await getCard(req.body?.caseId);
      if (!card) throw new HttpError(404, "That case could not be found.");
      const mode = req.body?.mode === "exam" ? "exam" : "practice";
      const attempt = startAttempt(card, { id: randomUUID(), student: cleanStudent(req.body?.student), mode });
      await store.save(attempt);
      res.status(201).json(viewOf(attempt, card));
    }),
  );

  api.get(
    "/assessments",
    wrap(async (req, res) => {
      const list = await store.list(String(req.query.studentId || ""));
      const cards = await Promise.all(list.map((a) => getCard(a.caseId)));
      res.json(
        list
          .map((a, i) => [a, cards[i]])
          .filter(([, card]) => card)
          .map(([a, card]) => ({
          id: a.id,
          case: publicCase(card),
          mode: a.mode,
          status: a.status,
          startedAt: a.startedAt,
          finishedAt: a.finishedAt,
          score: a.report?.score ?? null,
          grade: a.report?.grade ?? null,
        })),
      );
    }),
  );

  api.get(
    "/assessments/:id",
    wrap(async (req, res) => {
      const { attempt, card } = await load(req.params.id);
      res.json(viewOf(attempt, card));
    }),
  );

  api.post(
    "/assessments/:id/ask",
    aiLimit,
    wrap(async (req, res) => {
      const { attempt, card } = await load(req.params.id);
      const question = String(req.body?.question || "").trim().slice(0, 500);
      if (attempt.status !== "history") throw new HttpError(409, "The history part is over.");
      if (!question) throw new HttpError(400, "Type a question for the patient.");
      if (attempt.history.asked >= MAX_HISTORY_QUESTIONS) throw new HttpError(409, "That's the most questions for this station. Move on to the examination.");
      const reply = await patientReply(card, attempt, question);
      askPatient(attempt, question, reply);
      await store.save(attempt);
      res.json(viewOf(attempt, card));
    }),
  );

  api.post(
    "/assessments/:id/examine",
    wrap(async (req, res) => {
      const { attempt, card } = await load(req.params.id);
      endHistory(attempt, card);
      await store.save(attempt);
      res.json(viewOf(attempt, card));
    }),
  );

  api.post(
    "/assessments/:id/answer",
    aiLimit,
    wrap(async (req, res) => {
      const { attempt, card } = await load(req.params.id);
      if (attempt.status !== "items") throw new HttpError(409, "There is no question waiting for an answer.");
      const item = card.items[attempt.itemIndex];
      const answer = req.body?.answer;
      const empty = [].concat(answer ?? []).filter((a) => String(a).trim()).length === 0;
      if (empty) throw new HttpError(400, "Give an answer first.");
      const grade =
        item.type === "text"
          ? await gradeText(card, item, String(answer).slice(0, 2000))
          : { score: gradeChoice(item, answer) };
      answerItem(attempt, card, item.type === "text" ? String(answer).slice(0, 2000) : answer, grade);
      await store.save(attempt);
      res.json(viewOf(attempt, card));
    }),
  );

  api.post(
    "/assessments/:id/finish",
    aiLimit,
    wrap(async (req, res) => {
      const { attempt, card } = await load(req.params.id);
      if (!attempt.report) {
        if (attempt.status === "history") endHistory(attempt, card);
        attempt.status = "done";
        attempt.finishedAt = new Date().toISOString();
        attempt.report = await coachReport(card, attempt, buildReport(attempt, card));
        await store.save(attempt);
      }
      res.json(viewOf(attempt, card));
    }),
  );

  api.get("/tutor/suggestions", (req, res) => res.json(TUTOR_SUGGESTIONS));

  api.post(
    "/tutor",
    aiLimit,
    wrap(async (req, res) => {
      const question = String(req.body?.question || "").trim().slice(0, 500);
      if (!question) throw new HttpError(400, "Ask the tutor a question.");
      const context = req.body?.context || {};
      res.json(
        await tutorPlan(question, {
          teeth: [].concat(context.teeth || []).map(String).slice(0, 8),
          layer: String(context.layer || ""),
        }),
      );
    }),
  );

  // Interview turns from the browser: [{ question, answer, type, bankId? }].
  const cleanQa = (list) =>
    [].concat(list || []).slice(0, 12).map((x) => ({
      question: String(x?.question || "").slice(0, 300),
      answer: Array.isArray(x?.answer) ? x.answer.map((a) => String(a).slice(0, 200)).slice(0, 10) : typeof x?.answer === "number" ? x.answer : String(x?.answer ?? "").slice(0, 800),
      type: ["single", "multi", "scale", "text"].includes(x?.type) ? x.type : "text",
      ...(x?.bankId ? { bankId: String(x.bankId).slice(0, 40) } : {}),
    }));

  // A report regenerated from the patient's feedback; older versions are kept.
  const regenerate = async (c, feedback) => {
    const profile = await patients.getProfile(c.patientId);
    c.input.feedback = [...(c.input.feedback || []), feedback].slice(-10);
    const answers = await extractAnswers({ ...c.input, profile });
    const result = await selfCheckResult({ ...c.input, answers, profile });
    c.versions = [...(c.versions || []), { at: c.updatedAt || c.createdAt, result: c.result }].slice(-10);
    c.result = { ...result, caseId: c.id };
    c.updatedAt = new Date().toISOString();
    return c;
  };

  const patients = patientRoutes(api, { store, wrap, HttpError, aiLimit, regenerate });

  api.post(
    "/selfcheck/question",
    aiLimit,
    wrap(async (req, res) => {
      const b = req.body || {};
      const language = LANGUAGES.includes(b.language) ? b.language : "English";
      const patientId = String(b.patientId || "").slice(0, 64);
      const out = await nextQuestion({
        problem: String(b.problem || ""),
        qa: cleanQa(b.qa),
        story: String(b.story || "").slice(0, 1500),
        teeth: [].concat(b.teeth || []).map(String).slice(0, 4),
        who: b.who === "child" ? "child" : "me",
        age: Number.isFinite(Number(b.age)) ? Number(b.age) : undefined,
        language,
        profile: patientId ? await patients.getProfile(patientId) : null,
        display: language === "English" ? null : await publicBank(language),
      });
      if (!out) throw new HttpError(400, "Choose what kind of problem it is first.");
      res.json(out);
    }),
  );

  // The patient self-check: questions, then a plain-language result.
  api.get(
    "/selfcheck",
    wrap(async (req, res) => {
      const language = LANGUAGES.includes(req.query.lang) ? req.query.lang : "English";
      res.json({ problems: await publicBank(language), languages: LANGUAGES, language });
    }),
  );

  api.post(
    "/selfcheck/result",
    aiLimit,
    wrap(async (req, res) => {
      const b = req.body || {};
      const patientId = String(b.patientId || "").slice(0, 64);
      const profile = patientId ? await patients.getProfile(patientId) : null;
      const qa = cleanQa(b.qa);
      const input = {
        problem: String(b.problem || ""),
        qa,
        feedback: [],
        story: String(b.story || "").slice(0, 1500),
        teeth: [].concat(b.teeth || []),
        who: b.who === "child" ? "child" : "me",
        age: Number.isFinite(Number(b.age)) ? Number(b.age) : undefined,
        language: LANGUAGES.includes(b.language) ? b.language : "English",
      };
      const answers = b.answers && typeof b.answers === "object" ? b.answers : await extractAnswers({ ...input, profile });
      const result = await selfCheckResult({ ...input, answers, profile });
      if (!result) throw new HttpError(400, "Choose what kind of problem it is first.");
      const opened = patientId ? await patients.openCase({ patientId, input, result }) : null;
      res.json({ ...result, caseId: opened?.id || null });
    }),
  );

  api.post(
    "/selfcheck/ask",
    aiLimit,
    wrap(async (req, res) => {
      const question = String(req.body?.question || "").trim().slice(0, 500);
      if (!question) throw new HttpError(400, "Type your question first.");
      const language = LANGUAGES.includes(req.body?.language) ? req.body.language : "English";
      res.json(await selfCheckAnswer({ question, context: req.body?.context || {}, language }));
    }),
  );

  api.get("/explain", (req, res) =>
    res.json({
      languages: LANGUAGES,
      treatments: Object.entries(TREATMENTS).map(([id, t]) => ({ id, title: t.title, steps: t.steps.length })),
    }),
  );

  api.post(
    "/explain",
    aiLimit,
    wrap(async (req, res) => {
      const plan = await explainPlan(String(req.body?.treatment || ""), String(req.body?.language || "English"));
      if (!plan) throw new HttpError(404, "That treatment isn't available yet.");
      res.json(plan);
    }),
  );

  app.use("/api", api);
  app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "That request wasn't valid JSON." });
    // Errors that set their own status carry a message written for people.
    const status = err.status || 500;
    if (!err.status) console.error(err);
    res.status(status).json({ error: err.status ? err.message : "Something went wrong. Please try again." });
  });
  return app;
};
