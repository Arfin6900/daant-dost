import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiArrowRight, FiBookOpen, FiCheck, FiCompass, FiHeart, FiUsers } from "react-icons/fi";
import DentalViewer from "../../components/dental/three/DentalViewer";
import { SceneProvider, createSceneStore } from "../../scene/sceneStore";

const heroStore = () => createSceneStore({ autoRotate: true, open: 0.35 });

// Who DaantDost is for, and what each of them does here.
const AUDIENCES = [
  {
    icon: FiHeart,
    who: "Patients and parents",
    tagline: "Know what's wrong and what to do, without the jargon.",
    does: [
      "Check your symptoms and find out how urgent it is",
      "Watch a filling, root canal or implant explained in 3D, in your language",
      "See which teeth your child should have at their age",
    ],
    cta: "Check my teeth",
    to: "/check",
    more: [["Treatments explained", "/explain"], ["My child's teeth", "/explore?age=7"]],
    tone: "from-[#FF7A2F] to-[#FFB020]",
  },
  {
    icon: FiBookOpen,
    who: "Dental students",
    tagline: "Practise on patients before you meet real ones.",
    does: [
      "Examine an AI patient and get marked like an OSCE",
      "Ask the AI tutor; it shows you on the 3D mouth",
      "Drill tooth numbers and anatomy in 3D",
    ],
    cta: "Start a practice case",
    to: "/assess",
    more: [["Drills", "/learn"], ["3D explorer", "/explore"]],
    tone: "from-brand to-sky",
  },
  {
    icon: FiUsers,
    who: "Teachers",
    tagline: "Set cases in seconds and see how the class is doing.",
    does: [
      "Describe a patient in one line; AI writes a full marked case",
      "Students play it with the same marking scheme",
      "Teach live with the 3D mouth on the screen",
    ],
    cta: "Write a case with AI",
    to: "/assess#create",
    more: [["3D explorer", "/explore"]],
    tone: "from-[#7C5CFF] to-[#B49CFF]",
  },
];

const rise = (i = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay: 0.08 * i, ease: [0.2, 0.7, 0.2, 1] },
});

const HomePage = () => (
  <>
    <section className="relative overflow-hidden bg-[radial-gradient(ellipse_at_70%_40%,#27304F_0%,#141B38_45%,#0A1229_100%)] text-white">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-8 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[1fr_1.25fr] lg:pb-20 lg:pt-16">
        <div className="relative z-10">
          <motion.p {...rise(0)} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-sky ring-1 ring-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-sky" /> For patients and parents
          </motion.p>
          <motion.h1 {...rise(1)} className="mt-5 font-display text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">
            Tooth trouble? <span className="bg-gradient-to-r from-sky to-[#7CD8FF] bg-clip-text text-transparent">Find out what to do.</span>
          </motion.h1>
          <motion.p {...rise(2)} className="mt-5 max-w-lg text-lg leading-relaxed text-white/70">
            Show us where it hurts on a 3D mouth and answer a few simple questions. In about two minutes
            you&apos;ll know what to do next in plain words and your own language, while students and
            teachers can still practise and run AI patient cases.
          </motion.p>
          <motion.div {...rise(3)} className="mt-8 flex flex-wrap gap-3">
            <Link to="/check" className="btn-primary px-6 py-3.5 text-base shadow-lg shadow-brand/30">
              Check my teeth now <FiArrowRight />
            </Link>
            <Link to="/explain" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-6 py-3.5 font-bold text-white ring-1 ring-white/15 transition-colors hover:bg-white/15">
              <FiCompass /> See a treatment explained
            </Link>
          </motion.div>
          <motion.dl {...rise(4)} className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-white/10 pt-6">
            {[
              ["2 min", "to check"],
              ["9", "common problems"],
              ["7", "languages"],
            ].map(([n, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="font-display text-3xl font-semibold">{n}</dd>
                <dd className="text-sm text-white/55">{label}</dd>
              </div>
            ))}
          </motion.dl>
          <motion.p {...rise(5)} className="mt-6 text-sm text-white/55">
            Dental student or teacher?{" "}
            <Link to="/assess" className="font-bold text-sky hover:underline">Practise AI patient cases</Link>
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
          className="relative h-[360px] sm:h-[460px] lg:h-[540px]"
        >
          <div className="absolute inset-[12%] rounded-full bg-sky/20 blur-3xl" aria-hidden />
          <SceneProvider store={heroStore()}>
            <DentalViewer
              mode="focus"
              controls={false}
              className="!absolute inset-0 !bg-none !ring-0"
              fallback={<div className="flex h-full items-center justify-center text-white/60">3D needs WebGL on this device.</div>}
            />
          </SceneProvider>
        </motion.div>
      </div>
    </section>

    <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6" aria-labelledby="who">
      <p className="text-sm font-bold uppercase tracking-wider text-brand">Who it's for</p>
      <h2 id="who" className="mt-2 font-display text-2xl font-semibold sm:text-3xl">Pick who you are to get started</h2>
      <p className="mt-2 max-w-2xl text-ink-soft">One 3D mouth, three ways to use it. Every patient in DaantDost is fictional, and nothing here is a diagnosis.</p>
      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {AUDIENCES.map(({ icon: Icon, who, tagline, does, cta, to, more, tone }, i) => (
          <article
            key={who}
            style={{ animationDelay: `${i * 80}ms` }}
            className="flex animate-rise-in flex-col overflow-hidden rounded-2xl border border-line bg-white"
          >
            <div className={`bg-gradient-to-r ${tone} px-6 py-5 text-white`}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
                <Icon size={20} />
              </span>
              <h3 className="mt-3 font-display text-xl font-semibold">{who}</h3>
              <p className="mt-1 text-white/85">{tagline}</p>
            </div>
            <div className="flex flex-1 flex-col p-6">
              <ul className="grid flex-1 gap-2.5">
                {does.map((d) => (
                  <li key={d} className="flex gap-2.5">
                    <FiCheck className="mt-1 shrink-0 text-brand" /> {d}
                  </li>
                ))}
              </ul>
              <Link to={to} className="btn-primary mt-6">
                {cta} <FiArrowRight />
              </Link>
              <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
                {more.map(([label, href]) => (
                  <Link key={href} to={href} className="font-bold text-brand hover:underline">
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>

    <section className="border-t border-line bg-white">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-3">
        {[
          ["1", "Show us where", "Tap the tooth that hurts on the 3D mouth, or pick an area."],
          ["2", "Answer simple questions", "No dental words. Pick the answers that fit, or skip what you don't know."],
          ["3", "Know what to do", "How urgent it is, what it could be, what to do now and what to ask your dentist."],
        ].map(([n, title, body]) => (
          <div key={n} className="flex gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stage font-display text-lg font-semibold text-white">{n}</span>
            <div>
              <h3 className="font-display text-lg font-semibold">{title}</h3>
              <p className="mt-1 text-ink-soft">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  </>
);

export default HomePage;
