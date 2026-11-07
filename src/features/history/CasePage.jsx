import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiEdit3, FiRefreshCw } from "react-icons/fi";
import DentalViewer from "../../components/dental/three/DentalViewer";
import { SceneProvider, playCommands, useSceneStore } from "../../scene/sceneStore";
import { api } from "../../lib/api";
import { loadCase, patientId } from "../../lib/patient";
import CheckResult from "../check/CheckResult";
import { stringsFor } from "../check/strings";
import CarePanel from "./CarePanel";

const Feedback = ({ c, t, onCase }) => {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const remake = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      onCase(await api(`/patient/cases/${c.id}/regenerate`, { method: "POST", body: { pid: patientId(), feedback: text } }));
      setText("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={remake} className="rounded-2xl border-2 border-dashed border-brand/30 bg-brand-tint/40 p-5 print:hidden">
      <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
        <FiEdit3 className="text-brand" /> {t.feedbackTitle}
      </h3>
      <p className="mt-1 text-sm text-ink-soft">{t.feedbackHelp}</p>
      {c.input?.feedback?.length > 0 && (
        <ul className="mt-3 grid gap-1 text-sm">
          {c.input.feedback.map((f, i) => (
            <li key={i} className="rounded-lg bg-white px-3 py-1.5 text-ink-soft">“{f}”</li>
          ))}
        </ul>
      )}
      <label htmlFor="feedback" className="sr-only">{t.feedbackPlaceholder}</label>
      <textarea id="feedback" rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={800} placeholder={t.feedbackPlaceholder} className="field mt-3 resize-none bg-white" />
      {error && <p role="alert" className="mt-2 text-sm font-bold text-score-low">{error}</p>}
      <button type="submit" className="btn-primary mt-3" disabled={busy || !text.trim()}>
        <FiRefreshCw className={busy ? "animate-spin" : ""} /> {busy ? t.remaking : t.remake}
      </button>
      {c.versions?.length > 0 && <p className="mt-2 text-xs text-ink-faint">{t.versions(c.versions.length)}</p>}
    </form>
  );
};

const Case = ({ id }) => {
  const store = useSceneStore();
  const navigate = useNavigate();
  const [c, setC] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadCase(id).then(setC, (e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!c) return;
    store.getState().apply({ type: "setAge", years: c.input?.who === "child" && c.input?.age !== undefined ? Math.max(1, c.input.age) : null });
    playCommands(store, c.result.commands || []);
  }, [c?.result, store]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="font-display text-xl font-semibold">{error}</p>
        <Link to="/history" className="btn-primary mt-6">My dental history</Link>
      </div>
    );
  }
  if (!c) return <div className="mx-auto mt-10 h-96 max-w-6xl animate-pulse rounded-2xl bg-bone-deep" />;
  const t = stringsFor(c.language);

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-8">
      <div className="lg:sticky lg:top-20 lg:self-start print:hidden">
        <Link to="/history" className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand hover:underline">
          <FiArrowLeft /> {t.history}
        </Link>
        <DentalViewer mode="focus" caption={t.dragTurn} className="h-[34vh] min-h-[260px] lg:h-[calc(100vh-10rem)]" fallback={null} />
      </div>
      <div className="grid content-start gap-4">
        <p className="text-sm text-ink-soft">
          {new Date(c.createdAt).toLocaleString()} · {c.status === "resolved" ? "Resolved" : "Open"}
        </p>
        <CheckResult result={{ ...c.result, caseId: null }} language={c.language} onRestart={() => navigate("/check")} />
        {c.status !== "resolved" && <Feedback c={c} t={t} onCase={setC} />}
        <CarePanel key={c.result.summary} initialCase={c} language={c.language} onChange={setC} />
      </div>
    </div>
  );
};

const CasePage = () => {
  const { id } = useParams();
  return (
    <SceneProvider key={id}>
      <Case id={id} />
    </SceneProvider>
  );
};

export default CasePage;
