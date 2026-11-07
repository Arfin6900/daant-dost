import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiCheckCircle, FiClock, FiPlus, FiSave, FiX } from "react-icons/fi";
import { HISTORY_FIELDS, loadCases, loadProfile, saveProfile } from "../../lib/patient";

const URGENCY_CHIP = {
  emergency: "bg-score-low text-white",
  today: "bg-[#FF7A2F] text-white",
  soon: "bg-[#FFF1D6] text-[#7A4A00]",
  routine: "bg-score-good-tint text-score-good",
};

const ChipField = ({ field, values, onChange }) => {
  const [text, setText] = useState("");
  const add = (v) => {
    const value = (v ?? text).trim();
    if (!value || values.some((x) => x.toLowerCase() === value.toLowerCase())) return setText("");
    onChange([...values, value]);
    setText("");
  };
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h3 className="font-display text-lg font-semibold">{field.label}</h3>
      <p className="text-sm text-ink-soft">{field.help}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {values.map((v) => (
          <li key={v} className="inline-flex items-center gap-1.5 rounded-full bg-ink py-1.5 pl-3.5 pr-1.5 font-bold text-white">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="rounded-full p-1 hover:bg-white/15">
              <FiX size={13} />
            </button>
          </li>
        ))}
        {!values.length && <li className="text-sm text-ink-faint">Nothing added yet.</li>}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="mt-3 flex gap-2"
      >
        <label htmlFor={`add-${field.id}`} className="sr-only">Add to {field.label}</label>
        <input id={`add-${field.id}`} value={text} onChange={(e) => setText(e.target.value)} placeholder={field.placeholder} maxLength={100} className="field py-2" />
        <button type="submit" className="btn-quiet px-3" aria-label="Add" disabled={!text.trim()}>
          <FiPlus />
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {field.ideas.filter((i) => !values.includes(i)).map((i) => (
          <button key={i} type="button" onClick={() => add(i)} className="rounded-lg bg-bone px-2.5 py-1 text-sm text-ink-soft hover:text-ink">
            + {i}
          </button>
        ))}
      </div>
    </section>
  );
};

const HistoryPage = () => {
  const [profile, setProfile] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cases, setCases] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadProfile().then(setProfile, (e) => setError(e.message));
    loadCases().then(setCases, () => setCases([]));
  }, []);

  const change = (key, value) => {
    setProfile((p) => ({ ...p, [key]: value }));
    setDirty(true);
    setSaved(false);
  };
  const save = async () => {
    try {
      setProfile(await saveProfile(profile));
      setDirty(false);
      setSaved(true);
    } catch (e) {
      setError(e.message);
    }
  };

  // Save automatically a moment after each change.
  useEffect(() => {
    if (!dirty) return undefined;
    const tm = setTimeout(save, 800);
    return () => clearTimeout(tm);
  }, [profile, dirty]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = cases?.filter((c) => c.status === "open") || [];
  const done = cases?.filter((c) => c.status === "resolved") || [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-brand">My dental history</p>
          <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">Everything in one place</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">Your allergies, medicines and past treatments make every check safer. Your checks and what solved them are saved here too.</p>
        </div>
        <Link to="/check" className="btn-primary">
          New check <FiArrowRight />
        </Link>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-score-low-tint px-4 py-3 font-bold text-score-low">{error}</p>}

      <h2 className="mt-10 font-display text-xl font-semibold">My checks</h2>
      {!cases && <div className="mt-4 h-24 animate-pulse rounded-2xl bg-bone-deep" />}
      {cases && !cases.length && (
        <p className="mt-3 rounded-2xl border border-dashed border-ink-faint p-5 text-ink-soft">
          No checks yet. <Link to="/check" className="font-bold text-brand underline">Start your first check</Link>; it takes about two minutes.
        </p>
      )}
      {[
        ["Open", open, FiClock],
        ["Resolved", done, FiCheckCircle],
      ].map(([label, list, Icon]) =>
        list.length ? (
          <div key={label} className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink-soft">
              <Icon /> {label} ({list.length})
            </p>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
              {list.map((c) => (
                <li key={c.id}>
                  <Link to={`/history/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-bone">
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">
                        {c.problem}
                        {c.teeth?.[0] ? <span className="font-normal text-ink-soft"> · {c.teeth[0].plain}</span> : null}
                      </span>
                      <span className="text-sm text-ink-soft">
                        {new Date(c.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                        {c.cause ? ` · could be: ${c.cause}` : ""}
                        {c.resolution ? ` · helped: ${c.resolution.whatHelped}` : ""}
                      </span>
                    </span>
                    {c.status === "resolved" ? (
                      <span className="rounded-full bg-score-good-tint px-3 py-1 text-xs font-bold text-score-good">Resolved</span>
                    ) : (
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${URGENCY_CHIP[c.urgency] || "bg-bone"}`}>{c.urgencyTitle}</span>
                    )}
                    <FiArrowRight className="text-ink-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}

      <div className="mt-12 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">My health details</h2>
        <span className="flex items-center gap-1.5 text-sm font-bold text-ink-soft" aria-live="polite">
          <FiSave /> {dirty ? "Saving…" : saved ? "Saved" : "Saved automatically"}
        </span>
      </div>
      {!profile ? (
        <div className="mt-4 h-64 animate-pulse rounded-2xl bg-bone-deep" />
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {HISTORY_FIELDS.map((f) => (
            <ChipField key={f.id} field={f} values={profile[f.id]} onChange={(v) => change(f.id, v)} />
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
