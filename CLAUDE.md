# DaantDost: guide for Claude and the team

DaantDost is a hackathon prototype for **dental education**: AI virtual patients and an AI
examiner (OSCE-style assessment), an AI tutor that drives a 3D mouth, quizzes, and
narrated treatment walkthroughs. Every patient is fictional. There is **no clinical/dentist
module**; never add patient intake, triage or diagnosis of real people.

Who does what: [docs/TEAM_TASKS.md](docs/TEAM_TASKS.md). Owners by domain: **Student**
(assessment, tutor, Learn) is M-Haris346; **Patient and Teacher** (Explain, age timeline,
`/patient`, `/teach`) is uroojfatim. Respect the file ownership table there; shared
contract files need both to approve. Status tracker:
[docs/HACKATHON_PLAN.md](docs/HACKATHON_PLAN.md) section 0.

## Commands

    npm install
    npm run dev        # Vite on :5173 + Express API on :3001 (Vite proxies /api)
    npm test           # vitest: web (jsdom) + server (node) tests, must stay green
    npm run build      # production web build
    npm start          # one server: API + dist/ (run build first)

`.env` (copy `.env.example`): `DASHSCOPE_API_KEY` turns on Qwen; without it every AI
feature uses its scripted fallback. `MONGO_URI` is optional (default: `server/data/*.json`).

## Map

| Area | Files |
|---|---|
| Express app and routes | `server/app.js` (all routes), `server/index.js` (boot, static dist) |
| Claude access | `server/ai.js`: `askJson({ system, prompt, schema, effort })`, zod schemas from `zod/v4` |
| Assessment engine (deterministic) | `server/engine.js`: stages, marking, report, `viewOf()` |
| Assessment AI layer | `server/assessor.js`: patient voice, written-answer marking, coaching |
| Patient stations | `server/cases/*.json` (built-in), `server/caseAuthor.js` (AI-written) |
| Tutor / Explain | `server/tutor.js`, `server/explain.js` |
| Storage | `server/store.js`: memory+JSON or MongoDB, same interface |
| Scene commands (contract) | `src/shared/sceneCommands.js` (validator), `src/scene/sceneStore.js` (zustand store, `playCommands`) |
| 3D mouth | `src/components/dental/three/` (`DentalViewer`, `DentalScene`, `ToothSection`) |
| Pages | `src/features/{home,explore,assess,learn,explain}/`, routes in `src/app/router.jsx` |
| Data | `src/data/teeth.js` (52 teeth, FDI), `src/data/dental.js` (regions, conditions, study notes) |

## Rules that keep it working

1. **Moving the 3D mouth always goes through SceneCommands.** Add a new command in
   `src/shared/sceneCommands.js` (validator rule) **and** `applyCommand` in
   `src/scene/sceneStore.js`, with tests. AI output is validated on the server and again
   on the client; invalid commands are dropped, never executed.
2. **Hidden case data never reaches the browser before submit.** Only `publicCase`,
   `publicItem` and `viewOf` shape responses. Tests in `server/app.test.js` check this; keep
   them passing and extend them for new routes.
3. **Every AI feature has a fallback.** Wrap AI calls in try/catch and return the
   deterministic version (see `assessor.js`). The demo must work with no API key.
4. **Shared files are imported by plain Node**: imports inside `src/data` and `src/shared`
   use explicit `.js` extensions. `server/boot.test.js` fails if you forget.
5. **AI (Qwen on DashScope):** model from `AI_MODEL` (default `qwen3.7-plus`, with fallbacks);
   always go through `askJson` in `server/ai.js` (JSON validated against a zod schema). AI
   routes are rate-limited in `server/app.js`; new AI routes must use `aiLimit`.
6. **Case cards total 100 points** (history 15 + six items). `server/engine.test.js`
   checks every file in `server/cases/`. Clinical content must be accurate; flag anything
   you are unsure of for review by a dental student or teacher.
7. **UI style:** Tailwind with the tokens in `tailwind.config.js` (`ink`, `bone`, `line`,
   `brand`, `sky`, `stage`, `score.*`); ClashDisplay headings (`font-display`); dark
   "stage" for 3D, light content surfaces; sentence case; every async state has a loading
   and an error state; respect `prefers-reduced-motion`.
8. **Tests first for logic** (engine, quiz, chronology, commands); a screenshot check for UI.
   Headless screenshot: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
   --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1440,1000
   --virtual-time-budget=8000 --screenshot=out.png http://localhost:5173/<page>`.

## Git

- Work on `feat/<topic>` branches from `develop`; open a PR into `develop`; the other
  teammate reviews. `main` gets `develop` only when the demo is green.
- Conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`).
- After merging a task, tick it in `docs/HACKATHON_PLAN.md` section 0 and in
  `docs/TEAM_TASKS.md`, and update the percentages.
