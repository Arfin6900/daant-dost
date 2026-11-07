import { useEffect, useState } from "react";
import { FiAlertTriangle, FiArrowLeft, FiArrowRight, FiCheck, FiCircle, FiDroplet, FiMove, FiPlus, FiScissors, FiX, FiZap } from "react-icons/fi";
import { CHILD_AREAS, MOUTH_AREAS, plainTooth } from "../../shared/plainTooth";
import { toothById } from "../../data/teeth";
import { HAND_WRITTEN, stringsFor } from "./strings";

const ICONS = { zap: FiZap, alert: FiAlertTriangle, droplet: FiDroplet, scissors: FiScissors, circle: FiCircle, move: FiMove, plus: FiPlus };

const Step = ({ eyebrow, title, help, children }) => (
  <div className="animate-rise-in">
    {eyebrow && <p className="text-xs font-bold uppercase tracking-wider text-brand">{eyebrow}</p>}
    <h2 className="mt-1 font-display text-2xl font-semibold leading-snug sm:text-3xl">{title}</h2>
    {help && <p className="mt-2 text-ink-soft">{help}</p>}
    <div className="mt-6">{children}</div>
  </div>
);

const Big = ({ on, onClick, children, className = "" }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    className={`flex w-full items-center gap-3 rounded-2xl border-2 px-5 py-4 text-left text-lg font-bold transition-all ${
      on ? "border-brand bg-brand-tint" : "border-line bg-white hover:bg-bone"
    } ${className}`}
  >
    {children}
  </button>
);

const Nav = ({ onBack, onNext, nextLabel, disabled, t }) => (
  <div className="mt-8 flex items-center justify-between gap-3">
    {onBack ? (
      <button type="button" onClick={onBack} className="btn-quiet">
        <FiArrowLeft /> {t.back}
      </button>
    ) : (
      <span />
    )}
    {onNext && (
      <button type="button" onClick={onNext} disabled={disabled} className="btn-primary px-6">
        {nextLabel || t.next} <FiArrowRight />
      </button>
    )}
  </div>
);

const Question = ({ q, value, onChange, t }) => {
  const shown = (i) => q.shownOptions?.[i] || q.display?.options?.[i] || q.options[i];
  if (q.type === "text") {
    return (
      <textarea
        rows={3}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        maxLength={800}
        autoFocus
        className="field resize-y text-lg"
        aria-label={q.text}
      />
    );
  }
  if (q.type === "scale") {
    const v = value ?? 5;
    q = { min: 0, max: 10, labels: ["No pain", "Worst pain ever"], ...q };
    return (
      <div>
        <div className="flex items-end justify-between">
          <span className="font-display text-6xl font-semibold tabular-nums" style={{ color: v >= 8 ? "#C21E3A" : v >= 5 ? "#9A5B00" : "#12805C" }}>
            {v}
          </span>
          <span className="text-ink-soft">{t.outOf(q.max)}</span>
        </div>
        <input
          type="range"
          min={q.min}
          max={q.max}
          value={v}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={q.text}
          className="mt-4 w-full cursor-pointer accent-brand"
        />
        <div className="mt-1 flex justify-between text-sm text-ink-soft">
          <span>{q.display?.labels?.[0] || q.labels[0]}</span>
          <span>{q.display?.labels?.[1] || q.labels[1]}</span>
        </div>
      </div>
    );
  }
  if (q.type === "multi") {
    const list = [].concat(value ?? []);
    return (
      <div className="grid gap-2">
        {q.options.map((o, i) => {
          const on = list.includes(o);
          return (
            <Big key={o} on={on} onClick={() => onChange(on ? list.filter((x) => x !== o) : [...list, o])}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-brand bg-brand text-white" : "border-ink-faint"}`}>
                {on && <FiCheck size={15} strokeWidth={3} />}
              </span>
              <span className="text-base sm:text-lg">{shown(i)}</span>
            </Big>
          );
        })}
        <p className="text-sm text-ink-faint">{t.chooseAll}</p>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      {q.options.map((o, i) => (
        <Big key={o} on={value === o} onClick={() => onChange(o)}>
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${value === o ? "border-brand" : "border-ink-faint"}`}>
            {value === o && <span className="h-3 w-3 rounded-full bg-brand" />}
          </span>
          <span className="text-base sm:text-lg">{shown(i)}</span>
        </Big>
      ))}
    </div>
  );
};

// The self-check, one simple step at a time. `teeth` and `onTeeth` are shared
// with the 3D mouth so tapping a tooth there marks where it hurts.
const CheckWizard = ({ bank, languages, state, setState, teeth, onTeeth, onWho, translating, interview, onStartInterview, onAnswer, onBackQuestion }) => {
  const t = stringsFor(state.language);
  const step = state.step || "who";
  const setStep = (s) => setState((x) => ({ ...x, step: s }));
  const [value, setValue] = useState(undefined);
  const qi = interview.qa.length;
  useEffect(() => setValue(interview.question?.type === "scale" ? 5 : undefined), [interview.question]);
  const problem = bank.find((p) => p.id === state.problem);
  const areas = state.who === "child" && Number(state.age) < 12 ? CHILD_AREAS : MOUTH_AREAS;

  useEffect(() => onWho?.(state.who, state.age), [state.who, state.age]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch) => setState((s) => ({ ...s, ...patch }));
  const answer = (id, v) => setState((s) => ({ ...s, answers: { ...s.answers, [id]: v } }));
  const total = 4 + Math.max(6, qi + 1);
  const done = { who: 0, where: 1, what: 2, story: 3, q: 4 + qi }[step];
  // Wisdom-tooth pain only makes sense when no teeth, or a wisdom tooth, are marked.
  const isWisdom = (id) => toothById(id)?.dentition === "permanent" && toothById(id)?.position === 8;
  const shownProblems = bank.filter((p) => p.id !== "wisdom" || !teeth.length || teeth.some(isWisdom));

  return (
    <div>
      <div className="mb-6">
        <div className="flex justify-between text-xs font-bold text-ink-faint">
          <span>{t.yourCheck}</span>
          <span>{Math.round((done / total) * 100)}%</span>
        </div>
        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-line">
          <span className="block h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${(done / total) * 100}%` }} />
        </span>
      </div>

      {step === "who" && (
        <Step eyebrow={t.step(1)} title={t.whoTitle} help={t.whoHelp}>
          <div className="mb-6 flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t.language}>
            <span className="mr-1 font-bold">{t.language}</span>
            {HAND_WRITTEN.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={state.language === l}
                onClick={() => set({ language: l })}
                className={`rounded-full border-2 px-4 py-1.5 font-bold transition-colors ${state.language === l ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand/50"}`}
              >
                {l}
              </button>
            ))}
            <select
              value={HAND_WRITTEN.includes(state.language) ? "" : state.language}
              onChange={(e) => e.target.value && set({ language: e.target.value })}
              aria-label="Other languages"
              className="field w-auto py-1.5"
            >
              <option value="">Other…</option>
              {languages.filter((l) => !HAND_WRITTEN.includes(l)).map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Big on={state.who === "me"} onClick={() => set({ who: "me" })}>
              {t.me}
            </Big>
            <Big on={state.who === "child"} onClick={() => set({ who: "child" })}>
              {t.child}
            </Big>
          </div>
          {state.who === "child" && (
            <label className="mt-4 flex items-center gap-3 font-bold">
              {t.childAge}
              <input
                type="number"
                min={0}
                max={17}
                value={state.age ?? ""}
                onChange={(e) => set({ age: e.target.value === "" ? undefined : Math.max(0, Math.min(17, Number(e.target.value))) })}
                className="field w-24 py-2"
                placeholder={t.years}
              />
            </label>
          )}
          {translating && <p className="mt-4 text-sm font-bold text-brand">{t.translating}</p>}
          <Nav t={t} onNext={() => setStep("where")} disabled={!state.who || (state.who === "child" && state.age === undefined)} />
        </Step>
      )}

      {step === "what" && (
        <Step eyebrow={t.step(3)} title={t.whatTitle} help={t.whatHelp}>
          <div className="grid gap-2 sm:grid-cols-2">
            {shownProblems.map((p) => {
              const Icon = ICONS[p.icon] || FiZap;
              const on = state.problem === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    set({ problem: p.id, answers: {} });
                  }}
                  className={`relative flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors ${
                    on ? "border-brand bg-brand-tint" : "border-line bg-white hover:bg-bone"
                  }`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${on ? "bg-brand text-white" : "bg-bone text-brand"}`}>
                    <Icon />
                  </span>
                  <span>
                    <span className="block font-bold">{p.display?.label || p.label}</span>
                    <span className="text-sm text-ink-soft">{p.display?.hint || p.hint}</span>
                  </span>
                  {on && (
                    <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white">
                      <FiCheck size={14} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <Nav t={t} onBack={() => setStep("where")} onNext={() => setStep("story")} disabled={!state.problem || !shownProblems.some((p) => p.id === state.problem)} />
        </Step>
      )}

      {step === "where" && (
        <Step eyebrow={t.step(2)} title={t.whereTitle} help={t.whereHelp}>
          {teeth.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {teeth.map((id) => (
                <span key={id} className="inline-flex items-center gap-2 rounded-full bg-ink py-1.5 pl-3.5 pr-1.5 font-bold text-white">
                  {plainTooth(id)}
                  <button type="button" onClick={() => onTeeth(teeth.filter((t) => t !== id))} className="rounded-full p-1 hover:bg-white/15" aria-label="Remove">
                    <FiX size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {areas.map((a) => {
              const on = a.teeth.every((t) => teeth.includes(t));
              return (
                <Big key={a.id} on={on} onClick={() => onTeeth(on ? teeth.filter((t) => !a.teeth.includes(t)) : [...new Set([...teeth, ...a.teeth])].slice(-4))}>
                  <span className="text-base">{t.areas[a.id] || a.label}</span>
                </Big>
              );
            })}
            <Big on={false} onClick={() => { onTeeth([]); setStep("what"); }}>
              <span className="text-base text-ink-soft">{t.notSure}</span>
            </Big>
          </div>
          <Nav t={t} onBack={() => setStep("who")} onNext={() => setStep("what")} nextLabel={teeth.length ? t.next : t.skip} />
        </Step>
      )}

      {step === "story" && (
        <Step eyebrow={t.step(4)} title={t.storyTitle} help={t.storyHelp}>
          <label htmlFor="story" className="sr-only">Describe the problem</label>
          <textarea
            id="story"
            rows={4}
            maxLength={1500}
            value={state.story}
            onChange={(e) => set({ story: e.target.value })}
            placeholder={t.storyPlaceholder}
            className="field resize-y text-lg"
          />
          <Nav
            t={t}
            onBack={() => setStep("what")}
            onNext={() => {
              setStep("q");
              onStartInterview();
            }}
            nextLabel={state.story.trim() ? t.next : t.skip}
          />
        </Step>
      )}

      {step === "q" && problem && (
        <div>
          {interview.loading && (
            <div className="flex animate-rise-in items-center gap-3 py-10 text-ink-soft" aria-live="polite">
              <span className="h-6 w-6 animate-orbit rounded-full border-2 border-line border-t-brand" />
              <span className="font-bold">{qi ? t.nextQuestion : t.firstQuestion}</span>
            </div>
          )}
          {interview.error && <p role="alert" className="rounded-xl bg-score-low-tint px-4 py-3 font-bold text-score-low">{interview.error}</p>}
          {!interview.loading && interview.question && (
            <Step key={`${qi}-${interview.question.text}`} eyebrow={t.question(qi + 1, Math.max(qi + 1, 6))} title={interview.question.text} help={interview.question.why}>
              <Question t={t} q={interview.question} value={value} onChange={setValue} />
              <Nav
                t={t}
                onBack={() => (qi === 0 ? setStep("story") : onBackQuestion())}
                onNext={() => onAnswer(value === undefined || value === "" ? (interview.question.type === "multi" ? [] : t.dontKnow) : value)}
                nextLabel={value === undefined || value === "" || (Array.isArray(value) && !value.length) ? t.skip : t.next}
              />
            </Step>
          )}
        </div>
      )}
    </div>
  );
};

export default CheckWizard;
