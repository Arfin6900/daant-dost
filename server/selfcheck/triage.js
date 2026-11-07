import { CAUSES, PROBLEM_BY_ID, URGENCY } from "./bank.js";

// Deterministic triage: urgency, possible causes, what to do. It is the
// safety floor: the AI may explain and personalise but never lower the
// urgency set here.

const has = (answer, value) => [].concat(answer ?? []).includes(value);
const yes = (answer) => has(answer, "Yes");

const RED_FLAG_WORDS = [
  [/can'?t breathe|cannot breathe|hard to breathe|difficulty breathing|short of breath/i, "Trouble breathing"],
  [/can'?t swallow|cannot swallow|hard to swallow|difficulty swallowing/i, "Trouble swallowing"],
  [/swell\w* (?:near|to|round|around|up to|into) (?:my |the )?(?:eye|neck)|eye (?:is )?swell|neck (?:is )?swell/i, "Swelling near the eye or in the neck"],
  [/bleed\w* (?:won'?t|will not|doesn'?t|does not) stop|can'?t stop (?:the )?bleed/i, "Bleeding that won't stop"],
  [/knock\w* out|fell out after|came out after (?:a )?(?:fall|hit|accident)/i, "A tooth knocked out"],
  [/broke\w* (?:my )?jaw|jaw (?:is )?broken|can'?t close my (?:mouth|teeth)/i, "Possible jaw injury"],
];

// Red flags in the patient's own words.
export const redFlagsInText = (text = "") => RED_FLAG_WORDS.filter(([re]) => re.test(text)).map(([, label]) => label);

const SELF_CARE = {
  pain: "Painkillers you can buy at a pharmacy, like paracetamol or ibuprofen, can help; follow the dose on the packet and ask the pharmacist if you're unsure they're right for you.",
  cold: "Avoid very hot, cold or sugary food and drinks on that side for now.",
  salt: "Rinse gently with warm salt water (half a teaspoon of salt in a glass of warm water) a few times a day.",
  brush: "Keep brushing twice a day with fluoride toothpaste, gently, including along the gum line. Don't stop because of bleeding.",
  floss: "Clean between your teeth once a day with floss or small brushes.",
  sensitive: "Use a toothpaste for sensitive teeth, and rub a little onto the sore area before bed.",
  soft: "Eat soft food and chew on the other side.",
  noHeat: "Don't put heat on a swollen face; a cold pack wrapped in a cloth on the outside can ease it.",
  cover: "If an edge is sharp, cover it with sugar-free chewing gum or dental wax from a pharmacy.",
  keepPiece: "If you have the broken piece, keep it in milk and bring it with you.",
  noSmoke: "Don't smoke, rinse hard or drink through a straw for a few days.",
  jawRest: "Rest your jaw: soft food, no gum chewing, avoid opening very wide, and try a warm cloth on the sore muscles.",
  ulcer: "Avoid spicy, salty or acidic food; a numbing gel or mouthwash from the pharmacy can help.",
  pressure: "Bite firmly on a clean, rolled-up damp gauze or cloth over the area for 20 minutes without checking.",
};

const GET_HELP = [
  "Swelling spreads towards your eye, down your neck or under your jaw",
  "You find it hard to breathe, swallow or open your mouth",
  "You have a high temperature or feel very unwell",
  "Bleeding doesn't stop after 20 minutes of firm pressure",
];

const raise = (current, level) => (URGENCY[level].rank > URGENCY[current].rank ? level : current);

// answers: { [questionId]: string | string[] | number }
export const triage = (problemId, answers = {}, story = "") => {
  const problem = PROBLEM_BY_ID[problemId];
  if (!problem) throw new Error(`Unknown problem ${problemId}`);
  const a = answers;
  let level = "routine";
  const flags = [];
  const causes = [];
  const care = new Set();
  const ask = [];
  let immediate = null;
  const add = (id, likelihood) => causes.push({ id, likelihood });
  const flag = (label, lvl = "emergency") => {
    flags.push(label);
    level = raise(level, lvl);
  };

  switch (problemId) {
    case "toothache": {
      const lingers = has(a.lasts, "Minutes or longer") || has(a.lasts, "It's there all the time");
      const spontaneous = has(a.trigger, "It comes on by itself") || yes(a.night);
      const biting = has(a.trigger, "Biting or chewing");
      const swell = a.swelling && !has(a.swelling, "No swelling");
      if (has(a.swelling, "Swelling spreading towards my eye, neck or under my jaw")) flag("Swelling spreading towards the eye, neck or under the jaw");
      if (swell || (biting && spontaneous) || yes(a.fever)) {
        add("abscess", "most likely");
        level = raise(level, "today");
        if (has(a.swelling, "My face or cheek is swollen")) flags.push("Facial swelling");
      }
      if (lingers || spontaneous) {
        add("inflamed_nerve", causes.length ? "possible" : "most likely");
        level = raise(level, "soon");
      }
      if (biting && !spontaneous && !swell) add("cracked_tooth", causes.length ? "possible" : "most likely");
      if (!lingers && !spontaneous && !swell && (has(a.trigger, "Cold drinks or food") || has(a.trigger, "Sweet things"))) {
        add("early_decay", "most likely");
        add("sensitivity", "possible");
        level = raise(level, "soon");
      }
      if (!causes.length) add("early_decay", "possible");
      if (Number(a.severity) >= 8) level = raise(level, "today");
      if (yes(a.fever) && swell) flag("Fever with swelling", "today");
      ["pain", "cold", "soft"].forEach((k) => care.add(k));
      if (swell) care.add("noHeat");
      ask.push("Which tooth is causing it, and can it be saved?", "Do I need a filling, a root canal or something else?", "What can I take for the pain until it's treated?");
      break;
    }
    case "swelling": {
      if (yes(a.breathing)) flag("Trouble breathing or swallowing");
      if (has(a.where, "Near my eye") || has(a.where, "Under my jaw or in my neck")) flag("Swelling near the eye or in the neck");
      if (yes(a.spreading)) flag("Swelling that is spreading");
      level = raise(level, "today");
      if (yes(a.fever)) flags.push("Fever");
      if (yes(a.wisdom)) add("wisdom_infection", "most likely");
      if (yes(a.toothpain) || has(a.where, "My cheek or face")) add("abscess", causes.length ? "possible" : "most likely");
      if (has(a.where, "On the gum by a tooth")) add("gum_abscess", causes.length ? "possible" : "most likely");
      if (!causes.length) add("abscess", "possible");
      ["pain", "noHeat", "salt"].forEach((k) => care.add(k));
      ask.push("Where is the infection coming from?", "Do I need antibiotics as well as treatment?", "What should I do if the swelling gets worse tonight?");
      break;
    }
    case "gums": {
      const long = has(a.howlong, "Longer than that") || has(a.howlong, "A few weeks to months");
      if (yes(a.lump)) {
        add("gum_abscess", "most likely");
        level = raise(level, "today");
      }
      if (yes(a.loose) || (long && has(a.factors, "I smoke")) || (long && has(a.factors, "I have diabetes"))) {
        add("gum_disease", causes.length ? "possible" : "most likely");
        level = raise(level, "soon");
      }
      add("gum_inflammation", causes.length ? "possible" : "most likely");
      if (has(a.when, "Sometimes on their own") && has(a.factors, "I take blood thinners")) {
        flags.push("Bleeding on its own while on blood thinners");
        level = raise(level, "soon");
      }
      ["brush", "floss", "salt"].forEach((k) => care.add(k));
      ask.push("Is this gum inflammation or gum disease?", "Should I see a hygienist for a deep clean?", "Am I brushing and cleaning between my teeth the right way?");
      break;
    }
    case "broken": {
      if (yes(a.injury) && has(a.bite, "No")) flag("Teeth don't meet after an injury: possible jaw injury", "today");
      add("chipped_tooth", "most likely");
      if (yes(a.pink) || (yes(a.pain) && has(a.size, "Most of the tooth"))) {
        add("inflamed_nerve", "possible");
        level = raise(level, "today");
      } else if (yes(a.pain) || has(a.size, "A noticeable piece") || has(a.size, "Most of the tooth")) level = raise(level, "soon");
      ["cover", "keepPiece", "pain", "soft"].forEach((k) => care.add(k));
      ask.push("Can it be repaired with a filling, or does it need a crown?", "Is the nerve affected?", "How can I protect it until it's fixed?");
      break;
    }
    case "knocked_out": {
      add("knocked_out", "most likely");
      if (yes(a.headinjury)) flag("Possible head injury");
      const baby = has(a.whose, "A child's baby tooth");
      level = raise(level, baby ? "today" : "emergency");
      immediate = baby
        ? ["Don't put a baby tooth back in: it can damage the adult tooth growing underneath.", "Press a clean, damp cloth on the gap to stop bleeding.", "See a dentist today to check for other damage."]
        : [
            "Pick the tooth up by the white crown, never by the root.",
            "If it's dirty, rinse it for a few seconds in milk or salt water. Don't scrub it.",
            "Try to push it gently back into its socket and bite on a cloth to hold it.",
            "If you can't, keep it in milk or in your cheek (not for young children). Don't let it dry out.",
            "Get to a dentist or A&E immediately: the best chance is within 1 hour.",
          ];
      ask.push("Can the tooth be saved?", "Do I need a splint?", "Do I need a tetanus injection?");
      break;
    }
    case "wisdom": {
      if (yes(a.breathing)) flag("Trouble swallowing or breathing");
      add("wisdom_infection", "most likely");
      if (yes(a.gumflap) || yes(a.taste)) level = raise(level, "soon");
      if (yes(a.opening) || yes(a.fever)) level = raise(level, "today");
      ["salt", "pain", "soft", "brush"].forEach((k) => care.add(k));
      ask.push("Is my wisdom tooth stuck (impacted)?", "Should it be taken out once this settles?", "How do I keep the area clean?");
      break;
    }
    case "ulcer": {
      if (has(a.howlong, "More than 3 weeks") || yes(a.patch)) {
        add("long_ulcer", "most likely");
        level = raise(level, "soon");
      } else {
        add("mouth_ulcer", "most likely");
      }
      ["ulcer", "salt"].forEach((k) => care.add(k));
      ask.push("What's causing it?", "Does it need any tests?", "What can I use to help it heal?");
      break;
    }
    case "jaw": {
      if (yes(a.locked)) flag("Jaw stuck open or closed", "today");
      if (yes(a.injury)) flag("Jaw pain after an injury", "today");
      add("jaw_joint", "most likely");
      if (has(a.symptoms, "Hard to open wide")) level = raise(level, "soon");
      ["jawRest", "pain"].forEach((k) => care.add(k));
      ask.push("Is this my jaw joint or the muscles?", "Would a night guard help?", "What exercises can I do?");
      break;
    }
    case "after_treatment": {
      if (yes(a.bleeding)) flag("Bleeding that won't stop", "today");
      if (yes(a.swelling)) flag("More swelling or a fever after an extraction", "today");
      if (has(a.days, "2 to 4 days ago") && has(a.pain, "It got worse after it was getting better")) {
        add("dry_socket", "most likely");
        level = raise(level, "soon");
      } else if (has(a.pain, "Severe and constant from the start")) {
        add("dry_socket", "possible");
        level = raise(level, "soon");
      }
      if (!causes.length) causes.push({ id: "dry_socket", likelihood: "less likely" });
      ["pressure", "noSmoke", "salt", "pain"].forEach((k) => care.add(k));
      ask.push("Is this normal healing or a dry socket?", "Do I need a dressing in the socket?", "When should the pain settle?");
      break;
    }
    default:
      break;
  }

  redFlagsInText(story).forEach((f) => {
    if (!flags.includes(f)) flag(f);
  });

  const seen = new Set();
  return {
    problem: problem.label,
    urgency: URGENCY[level],
    redFlags: flags,
    causes: causes
      .filter((c) => !seen.has(c.id) && seen.add(c.id))
      .slice(0, 3)
      .map((c) => ({ id: c.id, likelihood: c.likelihood, ...CAUSES[c.id] })),
    immediate,
    selfCare: [...care].map((k) => SELF_CARE[k]),
    getHelpIf: GET_HELP,
    askDentist: ask,
  };
};
