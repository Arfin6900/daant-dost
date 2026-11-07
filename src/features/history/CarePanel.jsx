import { useEffect, useRef, useState } from "react";
import { FiAlertTriangle, FiCheckCircle, FiCopy, FiCornerDownLeft, FiDownload, FiHeart, FiPrinter, FiZap } from "react-icons/fi";
import { loadProfile, resolve, sendCare } from "../../lib/patient";
import { useStudent } from "../../lib/student";
import Reveal from "../assess/Reveal";
import { stringsFor } from "../check/strings";
import { canExportPdf, caseAsText, exportCasePdf } from "./exportPdf";

const ResolveDialog = ({ c, t, onClose, onDone }) => {
  const offered = [...new Map((c.messages || []).filter((m) => m.remedy).map((m) => [m.remedy.id, m.remedy.title])).entries()];
  const [pick, setPick] = useState(offered.at(-1)?.[0] || "dentist");
  const [other, setOther] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const choices = [...offered, ["dentist", t.dentistFixed], ["itself", t.wentAway], ["other", t.otherHelp]];
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const label = pick === "other" ? other : pick === "dentist" ? t.dentistFixed : pick === "itself" ? t.wentAway : pick;
    try {
      onDone(await resolve(c.id, label, note));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 backdrop-blur-sm sm:items-center" onMouseDown={onClose}>
      <form role="dialog" aria-modal="true" aria-labelledby="solved-title" onSubmit={save} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-md animate-rise-in rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="solved-title" className="flex items-center gap-2 font-display text-xl font-semibold">
          <FiHeart className="text-score-good" /> {t.solvedTitle}
        </h2>
        <p className="mt-1 text-ink-soft">{t.solvedHelp}</p>
        <div className="mt-4 grid gap-2">
          {choices.map(([id, label]) => (
            <label key={id} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 font-bold ${pick === id ? "border-brand bg-brand-tint" : "border-line"}`}>
              <input type="radio" name="helped" checked={pick === id} onChange={() => setPick(id)} className="accent-brand" />
              {label}
            </label>
          ))}
          {pick === "other" && <input value={other} onChange={(e) => setOther(e.target.value)} className="field" placeholder={t.otherHelp} maxLength={200} />}
        </div>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder={t.notePlaceholder} className="field mt-3 resize-none" />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-quiet" onClick={onClose}>{t.cancel}</button>
          <button type="submit" className="btn-primary" disabled={busy || (pick === "other" && !other.trim())}>
            <FiCheckCircle /> {t.saveCase}
          </button>
        </div>
      </form>
    </div>
  );
};

// The care conversation for a case, plus resolving and exporting it.
const CarePanel = ({ initialCase, caseId, language = "English", onChange }) => {
  const t = stringsFor(language);
  const student = useStudent();
  const [c, setC] = useState(initialCase || null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [solving, setSolving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fresh, setFresh] = useState(-1);
  const bottom = useRef(null);
  const id = caseId || initialCase?.id;

  const update = (next) => {
    setC(next);
    onChange?.(next);
  };

  useEffect(() => {
    if (!id || (initialCase && initialCase.messages?.length) || initialCase?.status === "resolved") return;
    setBusy(true);
    sendCare(id, null)
      .then((next) => {
        setFresh(next.messages.length - 1);
        update(next);
      }, (e) => setError(e.message))
      .finally(() => setBusy(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [c?.messages?.length, busy]);

  const send = async (message) => {
    const m = (message ?? text).trim();
    if (!m || busy) return;
    setText("");
    setBusy(true);
    setError("");
    try {
      const next = await sendCare(id, m);
      setFresh(next.messages.length - 1);
      update(next);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const pdf = async () => {
    let profile = null;
    try {
      profile = await loadProfile();
    } catch {
      // Export without the history.
    }
    if (canExportPdf(c)) exportCasePdf(c, profile, { patientName: student.name });
    else window.print();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(caseAsText(c));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked.
    }
  };

  if (!c) return busy ? <div className="h-40 animate-pulse rounded-2xl bg-bone-deep" /> : error ? <p className="text-score-low">{error}</p> : null;
  const resolved = c.status === "resolved";

  return (
    <div className="grid gap-4">
      {!resolved && (
        <section className="overflow-hidden rounded-2xl border border-line bg-white" aria-label={t.careTitle}>
          <div className="bg-gradient-to-r from-[#FF7A2F] to-[#FFB020] px-5 py-4 text-white">
            <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
              <FiHeart /> {t.careTitle}
            </h3>
            <p className="mt-0.5 text-sm text-white/90">{t.careHelp}</p>
          </div>
          <div className="grid gap-3 p-5">
            {c.messages.map((m, i) =>
              m.role === "patient" ? (
                <p key={i} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-white">
                  {m.text}
                </p>
              ) : (
                <div key={i} className={`max-w-[95%] rounded-2xl rounded-tl-md px-4 py-3 ${m.urgent ? "bg-score-low-tint ring-1 ring-score-low/30" : "bg-bone"}`}>
                  {m.urgent && (
                    <p className="mb-1.5 flex items-center gap-1.5 font-bold text-score-low">
                      <FiAlertTriangle /> Get help now
                    </p>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">
                    <Reveal text={m.text} active={i === fresh} />
                  </p>
                  {m.remedy && (
                    <div className="mt-3 rounded-xl border border-[#FFB020]/40 bg-white px-4 py-3">
                      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#9A5B00]">
                        <FiZap /> {t.tryThis}
                      </p>
                      <p className="mt-1 font-bold">{m.remedy.title}</p>
                    </div>
                  )}
                </div>
              ),
            )}
            {busy && (
              <span className="flex w-fit gap-1 rounded-2xl bg-bone px-4 py-3" aria-label="Typing">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 animate-dot-bounce rounded-full bg-ink-faint" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </span>
            )}
            <div ref={bottom} />
            {error && <p role="alert" className="rounded-xl bg-score-low-tint px-3 py-2 text-sm font-bold text-score-low">{error}</p>}
            <div className="flex flex-wrap gap-1.5">
              {[t.qAllergic, t.qTried, t.qHelped, t.qWorse].map((q) => (
                <button key={q} type="button" disabled={busy} onClick={() => send(q)} className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-bold text-ink-soft hover:border-brand hover:text-ink disabled:opacity-50">
                  {q}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2 rounded-xl border border-line p-1.5 focus-within:border-brand"
            >
              <label htmlFor="care-msg" className="sr-only">{t.carePlaceholder}</label>
              <input id="care-msg" value={text} onChange={(e) => setText(e.target.value)} placeholder={t.carePlaceholder} className="min-w-0 flex-1 bg-transparent px-2.5 py-2 focus:outline-none" />
              <button type="submit" disabled={!text.trim() || busy} className="btn-primary px-3 py-2" aria-label="Send">
                <FiCornerDownLeft />
              </button>
            </form>
          </div>
        </section>
      )}

      {resolved ? (
        <section className="flex animate-rise-in items-start gap-3 rounded-2xl bg-score-good-tint p-5 text-score-good ring-1 ring-score-good/30">
          <FiCheckCircle className="mt-1 shrink-0" size={22} />
          <div>
            <p className="font-display text-lg font-semibold">{t.resolvedTitle}</p>
            <p className="mt-0.5 text-ink-soft">{t.resolvedHelp(c.resolution.whatHelped)}</p>
            {c.resolution.note && <p className="mt-1 text-ink-soft">“{c.resolution.note}”</p>}
          </div>
        </section>
      ) : (
        <button type="button" onClick={() => setSolving(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-score-good px-6 py-4 text-lg font-bold text-white shadow-lg shadow-score-good/20 transition-transform hover:-translate-y-0.5">
          <FiCheckCircle /> {t.solved}
        </button>
      )}

      <div className="flex flex-wrap gap-2 print:hidden">
        <button type="button" className="btn-primary" onClick={pdf}>
          <FiDownload /> {t.downloadPdf}
        </button>
        <button type="button" className="btn-quiet" onClick={() => window.print()}>
          <FiPrinter /> {t.printReport}
        </button>
        <button type="button" className="btn-quiet" onClick={copy}>
          <FiCopy /> {copied ? t.summaryCopied : t.copySummary}
        </button>
      </div>

      {solving && <ResolveDialog c={c} t={t} onClose={() => setSolving(false)} onDone={(next) => { setSolving(false); update(next); }} />}
    </div>
  );
};

export default CarePanel;
