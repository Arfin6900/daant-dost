import { careTurn, caseSummary, cleanProfile, emptyProfile, newCase, resolveCase } from "./care.js";

// /api/patient/*: dental history, cases, the care chat and resolving a case.
// The prototype has no accounts: the browser keeps a random patient id.

const pidOf = (v) => String(v || "").slice(0, 64);

export const patientRoutes = (api, { store, wrap, HttpError, aiLimit, regenerate }) => {
  const profiles = store.collection("profiles");
  const cases = store.collection("patient-cases");

  const getProfile = async (pid) => (await profiles.get(pid)) || emptyProfile(pid);
  const ownCase = async (id, pid) => {
    const c = await cases.get(id);
    if (!c || (pid && c.patientId !== pid)) throw new HttpError(404, "That case could not be found.");
    return c;
  };

  api.get(
    "/patient/profile",
    wrap(async (req, res) => {
      const pid = pidOf(req.query.pid);
      if (!pid) throw new HttpError(400, "Missing patient id.");
      res.json(await getProfile(pid));
    }),
  );

  api.put(
    "/patient/profile",
    wrap(async (req, res) => {
      const pid = pidOf(req.body?.pid);
      if (!pid) throw new HttpError(400, "Missing patient id.");
      const profile = { id: pid, ...cleanProfile(req.body?.profile), updatedAt: new Date().toISOString() };
      await profiles.save(profile);
      res.json(profile);
    }),
  );

  api.get(
    "/patient/cases",
    wrap(async (req, res) => {
      const pid = pidOf(req.query.pid);
      const list = await cases.list((c) => c.patientId === pid);
      res.json(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(caseSummary));
    }),
  );

  api.get(
    "/patient/cases/:id",
    wrap(async (req, res) => {
      res.json(await ownCase(req.params.id, pidOf(req.query.pid)));
    }),
  );

  api.post(
    "/patient/cases/:id/chat",
    aiLimit,
    wrap(async (req, res) => {
      const c = await ownCase(req.params.id, pidOf(req.body?.pid));
      if (c.status === "resolved") throw new HttpError(409, "This case is closed. Start a new check if the problem comes back.");
      const message = req.body?.message == null ? null : String(req.body.message).trim().slice(0, 800);
      if (message === "") throw new HttpError(400, "Type a message first.");
      if (!message && c.messages.length) return res.json(c);
      const profile = await getProfile(c.patientId);
      const before = profile.allergies.length;
      await careTurn(c, profile, message);
      await cases.save(c);
      if (profile.allergies.length !== before) await profiles.save({ ...profile, updatedAt: new Date().toISOString() });
      res.json(c);
    }),
  );

  api.post(
    "/patient/cases/:id/regenerate",
    aiLimit,
    wrap(async (req, res) => {
      const c = await ownCase(req.params.id, pidOf(req.body?.pid));
      const feedback = String(req.body?.feedback || "").trim().slice(0, 800);
      if (!feedback) throw new HttpError(400, "Tell us what to change first.");
      await regenerate(c, feedback);
      await cases.save(c);
      res.json(c);
    }),
  );

  api.post(
    "/patient/cases/:id/resolve",
    wrap(async (req, res) => {
      const c = await ownCase(req.params.id, pidOf(req.body?.pid));
      resolveCase(c, { whatHelped: req.body?.whatHelped, note: req.body?.note });
      await cases.save(c);
      res.json(c);
    }),
  );

  // Used by the self-check result route to file a new case.
  return {
    getProfile,
    openCase: async ({ patientId, input, result }) => {
      const c = newCase({ patientId, input, result });
      await cases.save(c);
      return c;
    },
  };
};
