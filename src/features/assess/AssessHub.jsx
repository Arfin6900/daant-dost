import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiArrowRight, FiAward, FiBookOpen, FiClock, FiMessageCircle, FiPlus, FiTarget, FiZap } from "react-icons/fi";
import { api } from "../../lib/api";
import { getStudent, useStudent } from "../../lib/student";
import Avatar from "../../ui/Avatar";
import NameDialog from "../../app/NameDialog";
import CreateCaseDialog from "./CreateCaseDialog";
import { GRADE_STYLE, SITE_LABEL } from "./labels";

const MODES = [
  { id: "practice", label: "Practice", hint: "Feedback after every answer, plus hints" },
  { id: "exam", label: "Exam", hint: "No hints or feedback until the end" },
];

const STEPS = [
  { icon: FiMessageCircle, label: "Interview", body: "Ask the AI patient anything." },
  { icon: FiTarget, label: "Examine", body: "Find the tooth on the 3D mouth and pick your tests." },
  { icon: FiBookOpen, label: "Decide", body: "Diagnose, justify and plan treatment." },
  { icon: FiAward, label: "Get marked", body: "Scores for six skills and a study plan." },
];

const Dots = ({ n }) => (
  <span className="inline-flex gap-1" aria-label={`Difficulty ${n} of 3`}>
    {[1, 2, 3].map((i) => (
      <span key={i} className={`h-1.5 w-4 rounded-full ${i <= n ? "bg-brand" : "bg-line"}`} />
    ))}
  </span>
);

const AssessHub = () => {
  const navigate = useNavigate();
  const student = useStudent();
  const [cases, setCases] = useState(null);
  const [past, setPast] = useState([]);
  const [mode, setMode] = useState("practice");
  const [starting, setStarting] = useState(null);
  const [asking, setAsking] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [aiOn, setAiOn] = useState(false);

  useEffect(() => {
    api("/cases").then(setCases, (e) => setError(e.message));
    api("/health").then((h) => setAiOn(h.ai), () => {});
    if (window.location.hash === "#create") setCreating(true);
    api(`/assessments?studentId=${encodeURIComponent(getStudent().id)}`).then(setPast, () => {});
  }, []);

  const start = async (caseId) => {
    if (!getStudent().name) {
      setAsking(caseId);
      return;
    }
    setStarting(caseId);
    setError("");
    try {
      const view = await api("/assessments", { method: "POST", body: { caseId, mode, student: getStudent() } });
      navigate(`/assess/${view.id}`);
    } catch (e) {
      setError(e.message);
      setStarting(null);
    }
  };

  return (
    <div>
      <section className="bg-[radial-gradient(ellipse_at_80%_0%,#27304F_0%,#141B38_50%,#0A1229_100%)] text-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
          <p className="text-sm font-bold uppercase tracking-wider text-sky">AI assessment</p>
          <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold sm:text-5xl">
            {student.name ? `Ready, ${student.name.split(" ")[0]}?` : "Examine a patient. Get marked by AI."}
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-white/70">
            Each station is a fictional patient. Take the history, examine on the 3D mouth, investigate, diagnose and manage, then get scored like an OSCE.
          </p>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, label, body }, i) => (
              <li key={label} className="flex gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky/15 text-sky">
                  <Icon />
                </span>
                <span>
                  <span className="block font-bold">
                    {i + 1}. {label}
                  </span>
                  <span className="text-sm text-white/60">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">Choose a patient</h2>
            <p className="mt-1 text-ink-soft">{MODES.find((m) => m.id === mode).hint}.</p>
          </div>
          <div role="radiogroup" aria-label="Mode" className="inline-flex rounded-xl border border-line bg-white p-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={mode === m.id}
                onClick={() => setMode(m.id)}
                className={`rounded-lg px-4 py-2 font-bold transition-colors ${mode === m.id ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-score-low-tint px-4 py-3 font-bold text-score-low">
            {error}
          </p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {!cases &&
            !error &&
            Array.from({ length: 6 }, (_, i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-bone-deep" />)}
          {cases?.map((c, i) => (
            <motion.article
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group flex flex-col rounded-2xl border border-line bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-xl hover:shadow-brand/5"
            >
              <div className="flex items-center gap-3">
                <Avatar name={c.patient.name} role="patient" size="h-11 w-11" />
                <div className="min-w-0">
                  <p className="font-bold">
                    {c.patient.name}, {c.patient.age}
                  </p>
                  <p className="text-sm text-ink-soft">{SITE_LABEL[c.site]}</p>
                </div>
              </div>
              <h3 className="mt-4 flex items-start justify-between gap-2 font-display text-lg font-semibold">
                {c.title}
                {c.generated && (
                  <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-tint px-2 py-0.5 font-sans text-xs font-bold text-brand-dark">
                    <FiZap /> AI-made
                  </span>
                )}
              </h3>
              <p className="mt-1 flex-1 text-ink-soft">“{c.patient.complaint}”</p>
              <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
                <Dots n={c.difficulty} />
                <span className="inline-flex items-center gap-1">
                  <FiClock /> ~{c.minutes} min
                </span>
              </div>
              <button type="button" className="btn-primary mt-4 w-full" onClick={() => start(c.id)} disabled={Boolean(starting)}>
                {starting === c.id ? "Preparing the patient…" : "Start station"} <FiArrowRight />
              </button>
            </motion.article>
          ))}
          {cases && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="group flex min-h-[220px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-white/50 p-5 text-center transition-colors hover:border-brand hover:bg-brand-tint/40"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white transition-transform group-hover:scale-110">
                <FiPlus size={22} />
              </span>
              <span className="mt-3 font-display text-lg font-semibold">Write a new patient with AI</span>
              <span className="mt-1 max-w-xs text-sm text-ink-soft">Describe a scenario in one line and get a full, marked station.</span>
            </button>
          )}
        </div>

        {past.length > 0 && (
          <div className="mt-12">
            <h2 className="font-display text-xl font-semibold">Your attempts</h2>
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
              {past.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <Link to={`/assess/${a.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-bone">
                    <Avatar name={a.case.patient.name} role="patient" size="h-9 w-9 text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{a.case.title}</span>
                      <span className="text-sm text-ink-soft">
                        {new Date(a.startedAt).toLocaleString()} · {a.mode}
                      </span>
                    </span>
                    {a.score !== null ? (
                      <span className="flex items-center gap-2">
                        <span className="font-display text-lg font-semibold tabular-nums">{a.score}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${GRADE_STYLE[a.grade]}`}>{a.grade}</span>
                      </span>
                    ) : (
                      <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-bold text-brand-dark">Continue</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <CreateCaseDialog
        open={creating}
        aiOn={aiOn}
        onClose={() => setCreating(false)}
        onCreated={(card) => {
          setCreating(false);
          setCases((list) => [...(list || []), card]);
        }}
      />
      <NameDialog
        open={Boolean(asking)}
        title="Before you start: your name?"
        onClose={(saved) => {
          const id = asking;
          setAsking(null);
          if (saved) setTimeout(() => start(id), 0);
        }}
      />
    </div>
  );
};

export default AssessHub;
