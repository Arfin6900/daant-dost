import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiChevronLeft, FiChevronRight, FiPause, FiPlay, FiVolume2, FiVolumeX } from "react-icons/fi";
import DentalViewer from "../../components/dental/three/DentalViewer";
import { SceneProvider, playCommands, useSceneStore } from "../../scene/sceneStore";
import { api } from "../../lib/api";

const VOICE_LANG = { English: "en-GB", "Roman Urdu": "en-IN", Urdu: "ur-PK", Hindi: "hi-IN", Arabic: "ar-SA", Spanish: "es-ES", French: "fr-FR", Chinese: "zh-CN" };
const RTL = new Set(["Urdu", "Arabic"]);
const BLURB = {
  filling: "Decay removed, tooth sealed.",
  root_canal: "Saving a tooth with an infected nerve.",
  crown: "A cap that protects a weak tooth.",
  extraction: "Removing a stuck wisdom tooth.",
  implant: "Replacing a missing tooth.",
};

const speak = (text, language, signal) =>
  new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth) return resolve(false);
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = VOICE_LANG[language] || "en-GB";
    u.rate = 0.98;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    signal.addEventListener("abort", () => {
      synth.cancel();
      resolve(false);
    });
    synth.speak(u);
  });

const wait = (ms, signal) =>
  new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });

const Player = ({ plan, onBack }) => {
  const store = useSceneStore();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [voice, setVoice] = useState(typeof window !== "undefined" && "speechSynthesis" in window);
  const ctl = useRef(null);

  // Show one step: replay every command up to it so jumping around works.
  useEffect(() => {
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    (async () => {
      const before = plan.steps.slice(0, step).flatMap((s) => s.commands).filter((x) => x.type !== "wait");
      store.getState().applyAll(before);
      await playCommands(store, plan.steps[step].commands, { signal: c.signal });
      if (!playing) return;
      const said = voice ? await speak(plan.steps[step].say, plan.language, c.signal) : false;
      if (!said) await wait(Math.max(3000, plan.steps[step].say.split(" ").length * 320), c.signal);
      else await wait(500, c.signal);
      if (!c.signal.aborted && step < plan.steps.length - 1) setStep((s) => s + 1);
      else if (!c.signal.aborted) setPlaying(false);
    })();
    return () => c.abort();
  }, [step, playing, voice, plan, store]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  const s = plan.steps[step];

  return (
    <div className="grid gap-4">
      <DentalViewer mode="focus" controls={false} className="h-[min(68vh,640px)] min-h-[380px]">
        <div dir={RTL.has(plan.language) ? "rtl" : "ltr"} className="pointer-events-none mx-auto mb-2 w-full max-w-2xl">
          <p key={step} className="animate-rise-in rounded-2xl bg-stage/85 px-5 py-4 text-center text-lg font-bold leading-relaxed text-white shadow-2xl ring-1 ring-white/10 backdrop-blur">
            {s.say}
          </p>
        </div>
      </DentalViewer>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-3">
        <button type="button" className="btn-quiet px-3 py-2" onClick={onBack}>
          <FiChevronLeft /> Treatments
        </button>
        <div className="flex items-center gap-1">
          <button type="button" className="rounded-lg p-2.5 hover:bg-bone disabled:opacity-40" aria-label="Previous step" disabled={step === 0} onClick={() => setStep((x) => x - 1)}>
            <FiChevronLeft />
          </button>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white hover:bg-brand-dark"
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => {
              if (!playing && step === plan.steps.length - 1) setStep(0);
              setPlaying((p) => !p);
            }}
          >
            {playing ? <FiPause /> : <FiPlay />}
          </button>
          <button type="button" className="rounded-lg p-2.5 hover:bg-bone disabled:opacity-40" aria-label="Next step" disabled={step === plan.steps.length - 1} onClick={() => setStep((x) => x + 1)}>
            <FiChevronRight />
          </button>
        </div>
        <ol className="flex min-w-[160px] flex-1 gap-1" aria-label="Steps">
          {plan.steps.map((_, i) => (
            <li key={i} className="flex-1">
              <button type="button" onClick={() => setStep(i)} aria-label={`Step ${i + 1}`} className="block w-full py-2">
                <span className={`block h-1.5 rounded-full transition-colors ${i < step ? "bg-brand" : i === step ? "bg-sky" : "bg-line"}`} />
              </button>
            </li>
          ))}
        </ol>
        <span className="text-sm font-bold tabular-nums text-ink-soft">
          {step + 1}/{plan.steps.length}
        </span>
        {"speechSynthesis" in window && (
          <button type="button" className="rounded-lg p-2.5 hover:bg-bone" aria-label={voice ? "Mute narration" : "Turn narration on"} onClick={() => setVoice((v) => !v)}>
            {voice ? <FiVolume2 /> : <FiVolumeX />}
          </button>
        )}
      </div>
      {plan.note && <p className="text-sm text-ink-soft">{plan.note}</p>}
    </div>
  );
};

const ExplainPage = () => {
  const [params] = useSearchParams();
  const [catalogue, setCatalogue] = useState(null);
  const [language, setLanguage] = useState(params.get("lang") || "English");
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/explain").then(setCatalogue, (e) => setError(e.message));
    if (params.get("t")) open(params.get("t"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (treatment) => {
    setLoading(treatment);
    setError("");
    try {
      setPlan(await api("/explain", { method: "POST", body: { treatment, language } }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <SceneProvider>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {plan ? (
          <>
            <h1 className="mb-4 font-display text-2xl font-semibold">{plan.title}</h1>
            <Player key={plan.title + plan.language} plan={plan} onBack={() => setPlan(null)} />
          </>
        ) : (
          <>
            <p className="text-sm font-bold uppercase tracking-wider text-brand">Explain</p>
            <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Treatments, explained in 3D</h1>
            <p className="mt-2 max-w-2xl text-lg text-ink-soft">A narrated walkthrough on the 3D mouth, in plain words and your language. Great for patients, and for practising how you explain.</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <label htmlFor="lang" className="font-bold">Language</label>
              <select id="lang" value={language} onChange={(e) => setLanguage(e.target.value)} className="field w-auto py-2">
                {(catalogue?.languages || ["English"]).map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
            {error && <p role="alert" className="mt-4 rounded-xl bg-score-low-tint px-4 py-3 font-bold text-score-low">{error}</p>}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {catalogue?.treatments.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => open(t.id)}
                  disabled={Boolean(loading)}
                  className="group flex flex-col items-start rounded-2xl border border-line bg-white p-6 text-left transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-xl hover:shadow-brand/5"
                >
                  <span className="font-display text-xl font-semibold">{t.title}</span>
                  <span className="mt-1 text-ink-soft">{BLURB[t.id]}</span>
                  <span className="mt-4 inline-flex items-center gap-2 font-bold text-brand">
                    <FiPlay /> {loading === t.id ? "Preparing…" : `Play · ${t.steps} steps`}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </SceneProvider>
  );
};

export default ExplainPage;
