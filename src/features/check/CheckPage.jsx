import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiShield } from "react-icons/fi";
import DentalViewer from "../../components/dental/three/DentalViewer";
import { SceneProvider, useSceneStore } from "../../scene/sceneStore";
import { api } from "../../lib/api";
import { loadProfile, patientId } from "../../lib/patient";
import CheckWizard from "./CheckWizard";
import { stringsFor } from "./strings";

const DRAFT = "tt-check-draft";
const fresh = (language = "English") => ({ step: "who", who: "me", age: undefined, language, problem: null, story: "", answers: {} });
const readDraft = () => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT) || "null");
  } catch {
    return null;
  }
};

const Check = () => {
  const store = useSceneStore();
  const navigate = useNavigate();
  const draft = useRef(readDraft()).current;
  const [bank, setBank] = useState(null);
  const [languages, setLanguages] = useState(["English"]);
  const [state, setState] = useState(() => ({ ...fresh(), ...(draft?.state || {}) }));
  const [teeth, setTeeth] = useState(draft?.teeth || []);
  const [interview, setInterview] = useState({ qa: draft?.qa || [], question: null, loading: false, error: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [translating, setTranslating] = useState(false);
  const [historyCount, setHistoryCount] = useState(null);
  const t = stringsFor(state.language);

  // Keep an unfinished check if the page is closed or refreshed.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT, JSON.stringify({ state, teeth, qa: interview.qa }));
    } catch {
      // Storage blocked: the check just won't survive a refresh.
    }
  }, [state, teeth, interview.qa]);

  useEffect(() => {
    loadProfile().then(
      (p) => setHistoryCount(["allergies", "medicines", "conditions", "treatments"].reduce((n, k) => n + p[k].length, 0)),
      () => {},
    );
  }, []);

  useEffect(() => {
    let live = true;
    setTranslating(state.language !== "English");
    api(`/selfcheck?lang=${encodeURIComponent(state.language)}`).then(
      (b) => {
        if (!live) return;
        setBank(b.problems);
        setLanguages(b.languages);
        setTranslating(false);
      },
      (e) => live && (setError(e.message), setTranslating(false)),
    );
    return () => {
      live = false;
    };
  }, [state.language]);

  const onWho = (who, age) => {
    store.getState().apply({ type: "setAge", years: who === "child" && age !== undefined ? Math.max(1, age) : null });
  };

  const submit = async (qa) => {
    setBusy(true);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const r = await api("/selfcheck/result", { method: "POST", body: { ...state, answers: undefined, teeth, qa, patientId: patientId() } });
      try {
        localStorage.removeItem(DRAFT);
      } catch {
        // Nothing to clear.
      }
      navigate(`/history/${r.caseId}`, { state: { fresh: true } });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  // Ask the AI for the next question; when it's done, build the report.
  const ask = async (qa) => {
    setInterview({ qa, question: null, loading: true, error: "" });
    try {
      const out = await api("/selfcheck/question", {
        method: "POST",
        body: { problem: state.problem, story: state.story, teeth, who: state.who, age: state.age, language: state.language, qa, patientId: patientId() },
      });
      if (out.done) {
        setInterview({ qa, question: null, loading: false, error: "" });
        submit(qa);
      } else setInterview({ qa, question: out.question, loading: false, error: "" });
    } catch (e) {
      setInterview({ qa, question: null, loading: false, error: e.message });
    }
  };

  // Back from a refresh in the middle of the interview: ask again.
  useEffect(() => {
    if (bank && state.step === "q" && !interview.question && !interview.loading && !busy) ask(interview.qa);
  }, [bank]); // eslint-disable-line react-hooks/exhaustive-deps

  // A different problem starts a new interview.
  const lastProblem = useRef(state.problem);
  useEffect(() => {
    if (lastProblem.current !== state.problem) setInterview({ qa: [], question: null, loading: false, error: "" });
    lastProblem.current = state.problem;
  }, [state.problem]);

  const answer = (value) => {
    const q = interview.question;
    ask([...interview.qa, { question: q.text, answer: value, type: q.type, ...(q.bankId ? { bankId: q.bankId } : {}) }]);
  };

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-8">
      <div className="lg:sticky lg:top-20 lg:self-start">
        <DentalViewer
          mode="select"
          teeth={teeth}
          onPickTooth={(id) => setTeeth((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id].slice(-4)))}
          caption={t.tapTooth}
          className="h-[38vh] min-h-[280px] lg:h-[calc(100vh-8rem)]"
          fallback={null}
        />
        <p className="mt-3 flex items-start gap-2 text-sm text-ink-soft">
          <FiShield className="mt-0.5 shrink-0 text-brand" />
          {t.disclaimer}
        </p>
      </div>
      <div>
        {error && <p role="alert" className="mb-4 rounded-xl bg-score-low-tint px-4 py-3 font-bold text-score-low">{error}</p>}
        {busy && (
          <div className="flex flex-col items-center gap-4 py-24 text-center" aria-live="polite">
            <span className="h-12 w-12 animate-orbit rounded-full border-4 border-line border-t-brand" />
            <p className="font-display text-xl font-semibold">{t.reading}</p>
            <p className="text-ink-soft">{t.readingHelp}</p>
          </div>
        )}
        {!busy && bank && historyCount !== null && state.step === "who" && (
          <p className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-brand-tint px-4 py-3 text-sm text-brand-dark">
            {t.historyNudge(historyCount)}
            <Link to="/history" className="font-bold underline">
              {historyCount ? t.editHistory : t.addHistory}
            </Link>
          </p>
        )}
        {!busy && bank && (
          <CheckWizard
            bank={bank}
            languages={languages}
            state={state}
            setState={setState}
            teeth={teeth}
            onTeeth={setTeeth}
            onWho={onWho}
            translating={translating}
            interview={interview}
            onStartInterview={() => (interview.question ? null : ask(interview.qa))}
            onAnswer={answer}
            onBackQuestion={() => ask(interview.qa.slice(0, -1))}
          />
        )}
        {!bank && !error && <div className="h-96 animate-pulse rounded-2xl bg-bone-deep" />}
      </div>
    </div>
  );
};

const CheckPage = () => (
  <SceneProvider>
    <Check />
  </SceneProvider>
);

export default CheckPage;
