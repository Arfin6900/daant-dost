import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Where attempts live: MongoDB when MONGO_URI is set, otherwise memory saved
// to server/data/attempts.json. Both have the same three functions.

// A Map kept in a JSON file (or only in memory when `file` is null).
const persistedMap = (file) => {
  const map = new Map();
  if (file) {
    try {
      JSON.parse(readFileSync(file, "utf8")).forEach((a) => map.set(a.id, a));
    } catch {
      // No file yet.
    }
  }
  let timer;
  map.flush = () => {
    if (!file) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify([...map.values()]));
    }, 200);
  };
  return map;
};

// A named set of documents with get, save and list(filter).
const memoryCollection = (map) => ({
  get: async (id) => structuredClone(map.get(id) ?? null),
  save: async (doc) => {
    map.set(doc.id, structuredClone(doc));
    map.flush();
    return doc;
  },
  list: async (filter = () => true) => [...map.values()].filter(filter).map((d) => structuredClone(d)),
});

const memoryStore = ({ file }) => {
  const map = persistedMap(file);
  const sibling = (name) => file && file.replace(/attempts\.json$/, `${name}.json`);
  const collections = {};
  const collection = (name) => {
    collections[name] ??= memoryCollection(persistedMap(sibling(name)));
    return collections[name];
  };
  const cases = persistedMap(file && file.replace(/attempts\.json$/, "cases.json"));
  const flush = map.flush;
  return {
    kind: "memory",
    collection,
    saveCase: async (card) => {
      cases.set(card.id, structuredClone(card));
      cases.flush();
      return card;
    },
    getCase: async (id) => structuredClone(cases.get(id) ?? null),
    listCases: async () => [...cases.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    get: async (id) => structuredClone(map.get(id) ?? null),
    save: async (attempt) => {
      map.set(attempt.id, structuredClone(attempt));
      flush();
      return attempt;
    },
    list: async (studentId) =>
      [...map.values()]
        .filter((a) => a.student?.id === studentId)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .map((a) => structuredClone(a)),
  };
};

const mongoStore = async (uri) => {
  const mongoose = (await import("mongoose")).default;
  await mongoose.connect(uri);
  const Attempt =
    mongoose.models.Attempt ||
    mongoose.model(
      "Attempt",
      new mongoose.Schema(
        { _id: String, studentId: { type: String, index: true }, startedAt: String, data: Object },
        { minimize: false },
      ),
    );
  const Case =
    mongoose.models.GeneratedCase ||
    mongoose.model("GeneratedCase", new mongoose.Schema({ _id: String, createdAt: String, data: Object }, { minimize: false }));
  const models = {};
  const collection = (name) => {
    models[name] ??=
      mongoose.models[`Doc_${name}`] ||
      mongoose.model(`Doc_${name}`, new mongoose.Schema({ _id: String, owner: { type: String, index: true }, data: Object }, { minimize: false, collection: name }));
    const M = models[name];
    return {
      get: async (id) => (await M.findById(id).lean())?.data ?? null,
      save: async (doc) => {
        await M.updateOne({ _id: doc.id }, { _id: doc.id, owner: doc.patientId || doc.id, data: doc }, { upsert: true });
        return doc;
      },
      list: async (filter = () => true) => (await M.find().limit(500).lean()).map((d) => d.data).filter(filter),
    };
  };
  return {
    kind: "mongo",
    collection,
    saveCase: async (card) => {
      await Case.updateOne({ _id: card.id }, { _id: card.id, createdAt: card.createdAt, data: card }, { upsert: true });
      return card;
    },
    getCase: async (id) => (await Case.findById(id).lean())?.data ?? null,
    listCases: async () => (await Case.find().sort({ createdAt: -1 }).limit(100).lean()).map((d) => d.data),
    get: async (id) => (await Attempt.findById(id).lean())?.data ?? null,
    save: async (a) => {
      await Attempt.updateOne(
        { _id: a.id },
        { _id: a.id, studentId: a.student?.id, startedAt: a.startedAt, data: a },
        { upsert: true },
      );
      return a;
    },
    list: async (studentId) =>
      (await Attempt.find({ studentId }).sort({ startedAt: -1 }).lean()).map((d) => d.data),
  };
};

export const createStore = async ({ mongoUri = process.env.MONGO_URI, file } = {}) => {
  if (mongoUri) {
    try {
      return await mongoStore(mongoUri);
    } catch (err) {
      console.warn("[store] MongoDB unreachable, using memory:", err.message);
    }
  }
  return memoryStore({
    file: file === undefined ? join(dirname(fileURLToPath(import.meta.url)), "data", "attempts.json") : file,
  });
};
