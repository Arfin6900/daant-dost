import { useState } from "react";
import { Link } from "react-router-dom";
import { FiAlertOctagon, FiAlertTriangle, FiCalendar, FiCheckCircle, FiClock, FiCopy, FiCornerDownLeft, FiHelpCircle, FiPlayCircle, FiPrinter, FiRefreshCw, FiStar } from "react-icons/fi";
import { api } from "../../lib/api";
import Reveal from "../assess/Reveal";
import { stringsFor } from "./strings";
import CarePanel from "../history/CarePanel";

const LEVEL = {
  emergency: { icon: FiAlertOctagon, box: "bg-[#C21E3A] text-white", sub: "text-white/90" },
  today: { icon: FiAlertTriangle, box: "bg-[#FF7A2F] text-white", sub: "text-white/90" },
  soon: { icon: FiClock, box: "bg-[#FFF1D6] text-[#7A4A00] ring-1 ring-[#FFB020]/50", sub: "text-[#7A4A00]/85" },
  routine: { icon: FiCalendar, box: "bg-score-good-tint text-score-good ring-1 ring-score-good/30", sub: "text-score-good/85" },
};

const LIKELY = { "most likely": "bg-brand text-white", possible: "bg-brand-tint text-brand-dark", "less likely": "bg-bone text-ink-soft" };

const Card = ({ title, icon: Icon, children, className = "" }) => (
  <section className={`rounded-2xl border border-line bg-white p-5 sm:p-6 ${className}`}>
    <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
      {Icon && <Icon className="text-brand" />} {title}
    </h3>
    {children}
  </section>
);

const FollowUp = ({ result, language }) => {
  const t = stringsFor(language);
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const ask = async (text) => {
    const question = (text ?? q).trim();
    if (!question || busy) return;
    setBusy(true);
    setQ("");
    try {
      const out = await api("/selfcheck/ask", {
        method: "POST",
        body: { question, language, context: { problem: result.problem, urgency: result.urgency.level, causes: result.causes.map((c) => c.name) } },
      });
      setItems((list) => [...list, { question, answer: out.answer }]);
    } catch (e) {
      setItems((list) => [...list, { question, answer: e.message }]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title={t.askAnything} icon={FiHelpCircle}>
      {items.map((it, i) => (
        <div key={i} className="mb-3">
          <p className="font-bold">{it.question}</p>
          <p className="mt-1 leading-relaxed text-ink-soft">
            <Reveal text={it.answer} active={i === items.length - 1} />
          </p>
        </div>
      ))}
      {!items.length && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {t.suggestions.map((s) => (
            <button key={s} type="button" onClick={() => ask(s)} className="rounded-lg bg-bone px-2.5 py-1.5 text-sm text-ink-soft hover:text-ink">
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
        className="flex items-center gap-2 rounded-xl border border-line p-1.5 focus-within:border-brand"
      >
        <label htmlFor="followup" className="sr-only">Your question</label>
        <input id="followup" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.askPlaceholder} className="min-w-0 flex-1 bg-transparent px-2.5 py-2 focus:outline-none" />
        <button type="submit" disabled={!q.trim() || busy} className="btn-primary px-3 py-2" aria-label="Ask">
          {busy ? <span className="h-4 w-4 animate-orbit rounded-full border-2 border-white/40 border-t-white" /> : <FiCornerDownLeft />}
        </button>
      </form>
    </Card>
  );
};

const CheckResult = ({ result, language, onRestart, followUp = false }) => {
  const t = stringsFor(language);
  const L = LEVEL[result.urgency.level];
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.askDentist.map((q) => `• ${q}`).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked; nothing else to do.
    }
  };

  return (
    <div className="grid gap-4">
      <section className={`animate-rise-in rounded-2xl p-6 ${L.box}`} role={result.urgency.level === "emergency" ? "alert" : undefined}>
        <div className="flex items-start gap-4">
          <L.icon className="mt-1 shrink-0" size={30} />
          <div>
            <p className="text-sm font-bold uppercase tracking-wider opacity-80">{t.howUrgent}</p>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">{result.urgency.title}</h2>
            <p className={`mt-2 text-lg ${L.sub}`}>{result.urgency.action}</p>
            {result.redFlags.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {result.redFlags.map((f) => (
                  <li key={f} className="rounded-full bg-black/15 px-3 py-1 text-sm font-bold">
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {result.immediate && (
        <Card title={t.doNow} icon={FiAlertTriangle} className="border-2 border-[#FF7A2F]">
          <ol className="grid gap-2">
            {result.immediate.map((s, i) => (
              <li key={s} className="flex gap-3 text-lg">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FF7A2F] font-bold text-white">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card>
        <p className="text-lg leading-relaxed">
          <Reveal text={result.summary} active />
        </p>
        <p className="mt-3 text-ink-soft">{result.reassurance}</p>
        {result.teeth.length > 0 && (
          <p className="mt-3 text-sm text-ink-soft">
            {t.shownOn} <span className="font-bold text-ink">{result.teeth.map((t) => t.plain).join("; ")}</span>
          </p>
        )}
      </Card>

      <Card title={t.couldBe} icon={FiHelpCircle}>
        <ul className="grid gap-3">
          {result.causes.map((c) => (
            <li key={c.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-lg font-semibold">{c.name}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${LIKELY[c.likelihood] || LIKELY.possible}`}>{t.likely[c.likelihood] || c.likelihood}</span>
              </div>
              {c.note && <p className="mt-2 font-bold text-ink">{c.note}</p>}
              <p className="mt-1.5 leading-relaxed text-ink-soft">{c.explain}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-ink-faint">
                  {t.dentistCalls} <span className="font-bold text-ink-soft">{c.term}</span>
                </span>
                {c.treatment && (
                  <Link to={`/explain?t=${c.treatment}&lang=${encodeURIComponent(language)}`} className="inline-flex items-center gap-1 font-bold text-brand hover:underline">
                    <FiPlayCircle /> {t.seeTreated}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-ink-faint">{t.notDiagnosis}</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={t.canDo} icon={FiCheckCircle}>
          <ul className="grid gap-2">
            {result.selfCare.map((s) => (
              <li key={s} className="flex gap-2.5">
                <FiCheckCircle className="mt-1 shrink-0 text-score-good" /> {s}
              </li>
            ))}
          </ul>
        </Card>
        <Card title={t.getHelp} icon={FiAlertOctagon}>
          <ul className="grid gap-2">
            {result.getHelpIf.map((s) => (
              <li key={s} className="flex gap-2.5">
                <FiAlertTriangle className="mt-1 shrink-0 text-score-low" /> {s}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title={t.askDentist} icon={FiHelpCircle}>
        <ul className="grid gap-2">
          {result.askDentist.map((q) => (
            <li key={q} className="rounded-xl bg-bone px-4 py-2.5">
              {q}
            </li>
          ))}
        </ul>
        <button type="button" onClick={copy} className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand hover:underline">
          <FiCopy /> {copied ? t.copied : t.copy}
        </button>
      </Card>

      {result.words.length > 0 && (
        <Card title={t.words} icon={FiStar}>
          <dl className="grid gap-2 sm:grid-cols-2">
            {result.words.map((w) => (
              <div key={w.word} className="rounded-xl border border-line px-4 py-3">
                <dt className="font-bold">{w.word}</dt>
                <dd className="text-ink-soft">{w.meaning}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {result.caseId ? <CarePanel caseId={result.caseId} language={language} /> : followUp ? <FollowUp result={result} language={language} /> : null}

      <div className="flex flex-wrap gap-3 print:hidden">
        <button type="button" className="btn-quiet" onClick={onRestart}>
          <FiRefreshCw /> {t.restart}
        </button>

      </div>
      {result.ai && <p className="text-xs text-ink-faint">{t.aiNote}</p>}
    </div>
  );
};

export default CheckResult;
