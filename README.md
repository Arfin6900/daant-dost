# DaantDost

Learn dentistry on a living 3D mouth. Students interview **AI virtual patients**, examine
them on the 3D model, get **marked by an AI examiner**, ask an **AI tutor** that moves the
model while it explains, drill tooth numbering, and watch narrated treatment walkthroughs.

Every patient is fictional. DaantDost is for education and never diagnoses anyone.

## Run it

    npm install
    cp .env.example .env      # optional: add DASHSCOPE_API_KEY (Qwen) for the AI
    npm run dev               # web on http://localhost:5173, API on :3001
    npm test

Production (one server for the API and the built app):

    npm run build && npm start   # http://localhost:3001

**No API key?** Everything still works: the patient answers from its script, written answers
are marked by key points, and the tutor and explainer use built-in answers. Add
`DASHSCOPE_API_KEY` to switch on Qwen (`AI_MODEL`, default `qwen3.7-plus`).

**MongoDB is optional.** Attempts are saved to `server/data/attempts.json`; set `MONGO_URI`
to use MongoDB instead.

## What's inside

| Area | Where | What it does |
|---|---|---|
| AI assessment | `server/engine.js`, `server/assessor.js`, `server/cases/*.json`, `src/features/assess/` | OSCE-style stations: history (AI patient), examination (pick the tooth in 3D), investigations, diagnosis, management and communication; scored per skill with AI coaching |
| AI tutor | `server/tutor.js`, `src/features/explore/TutorPanel.jsx` | Answers a question as narrated steps that drive the 3D mouth |
| Learn drills | `src/features/learn/` | Find the tooth in 3D, FDI, Palmer and Universal, tooth types; XP, streak, weak spots |
| Explain | `server/explain.js`, `src/features/explain/` | Five treatments narrated step by step in seven languages |
| Scene commands | `src/shared/sceneCommands.js`, `src/scene/sceneStore.js` | The one way anything (UI, AI) moves the 3D mouth; validated on server and client |
| 3D mouth | `src/components/dental/three/`, `scripts/dental-model/` | Generated from signed distance fields (no licensed model): layers, jaw, X-ray, tooth sections |

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | `{ ok, ai, model, db }` |
| GET | `/api/cases` | Patient stations (no answers) |
| POST | `/api/assessments` | Start: `{ caseId, mode: "practice" \| "exam", student: { id, name } }` |
| POST | `/api/assessments/:id/ask` | Ask the patient `{ question }` |
| POST | `/api/assessments/:id/examine` | End the history |
| POST | `/api/assessments/:id/answer` | Answer the current question `{ answer }` |
| POST | `/api/assessments/:id/finish` | Score and feedback |
| GET | `/api/assessments?studentId=` | A student's attempts |
| POST | `/api/tutor` | `{ question, context: { teeth, layer } }` → `{ answer, steps }` |
| GET/POST | `/api/explain` | Treatments and languages / `{ treatment, language }` → steps |

Plan and status: [docs/HACKATHON_PLAN.md](docs/HACKATHON_PLAN.md).
