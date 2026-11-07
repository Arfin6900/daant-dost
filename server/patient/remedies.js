// Things a person can safely try at home while they wait to see a dentist,
// per problem. Each says when to avoid it, so the conversation never offers
// a remedy that clashes with the patient's allergies, conditions or age.
// These relieve symptoms; they never replace dental treatment.

const R = (id, title, steps, avoid = {}) => ({ id, title, steps, avoid });

const IBUPROFEN = R(
  "ibuprofen",
  "Ibuprofen for pain and swelling",
  ["Take ibuprofen from a pharmacy exactly as the packet says, with food.", "Don't take more than the packet allows in 24 hours."],
  {
    allergies: ["ibuprofen", "nsaid", "aspirin", "brufen", "naproxen", "diclofenac"],
    conditions: ["asthma", "stomach ulcer", "ulcer", "kidney", "heart", "pregnan", "blood thinner", "warfarin"],
    medicines: ["warfarin", "apixaban", "rivaroxaban", "clopidogrel", "aspirin", "blood thinner"],
    minAge: 12,
  },
);
const PARACETAMOL = R(
  "paracetamol",
  "Paracetamol for pain",
  ["Take paracetamol (Panadol) exactly as the packet says.", "Don't take other medicines that also contain paracetamol."],
  { allergies: ["paracetamol", "acetaminophen", "panadol"], conditions: ["liver"] },
);
const SALT = R("salt_rinse", "Warm salt-water rinse", ["Mix half a teaspoon of salt in a glass of warm (not hot) water.", "Swish gently around the sore area for 30 seconds, then spit. Repeat 3–4 times a day, after meals."], { minAge: 6 });
const COLD_PACK = R("cold_pack", "Cold pack on the outside of the cheek", ["Wrap ice or a cold pack in a thin cloth.", "Hold it on the outside of your cheek for 15 minutes, then take it off for 15 minutes."]);
const CLOVE = R("clove_oil", "Clove oil on the sore tooth", ["Put 1–2 drops of clove oil on a cotton bud.", "Dab it on the sore tooth (not the gum) for a few minutes."], { allergies: ["clove"], minAge: 12 });
const AVOID_TRIGGERS = R("avoid_triggers", "Avoid what sets it off", ["Avoid very cold, very hot and sugary food and drinks for now.", "Drink through a straw past the sore side (unless a tooth was just taken out)."]);
const SENSITIVE_PASTE = R("sensitive_paste", "Toothpaste for sensitive teeth", ["Brush twice a day with a sensitive-teeth toothpaste (for example Sensodyne).", "At night, rub a pea-sized bit onto the sore spot and don't rinse it off."], { allergies: ["sensodyne", "toothpaste"] });
const SOFT_FOOD = R("soft_food", "Soft food on the other side", ["Eat soft food like rice, yoghurt, soup or eggs.", "Chew on the other side of your mouth."]);
const NUMB_GEL = R("numbing_gel", "Numbing gel from the pharmacy", ["Ask the pharmacist for a mouth gel (benzocaine or lidocaine).", "Dab a little on the sore spot as the packet says."], { allergies: ["benzocaine", "lidocaine", "anaesthetic", "anesthetic", "local anesthetic"], minAge: 12 });
const CHX = R("chlorhexidine", "Antiseptic mouthwash", ["Use a chlorhexidine mouthwash (for example Corsodyl) twice a day for up to a week.", "Wait 30 minutes after brushing before using it."], { allergies: ["chlorhexidine", "corsodyl"], minAge: 12 });
const GENTLE_BRUSH = R("gentle_brushing", "Gentle brushing along the gums", ["Brush twice a day with a soft brush, angled at the gum line.", "Keep brushing even if the gums bleed; bleeding usually settles in 1–2 weeks."]);
const INTERDENTAL = R("between_teeth", "Clean between your teeth", ["Once a day, use floss or small interdental brushes between each tooth.", "Be gentle at first; slight bleeding is normal for the first days."]);
const WAX = R("dental_wax", "Cover a sharp edge", ["Press a small piece of dental wax (pharmacy) or sugar-free chewing gum over the sharp edge.", "Replace it after eating."]);
const MILK = R("milk_storage", "Keep the tooth in milk", ["Put the tooth in a small cup of milk (or the person's own saliva).", "Bring it with you to the dentist straight away."]);
const JAW_REST = R("jaw_rest", "Rest your jaw", ["Eat soft food and avoid chewing gum.", "Avoid opening very wide (support your chin when you yawn)."]);
const WARM_CLOTH = R("warm_cloth", "Warm cloth on the jaw muscles", ["Hold a warm, damp cloth on the sore side of your face for 10–15 minutes, 2–3 times a day.", "Gently massage the muscle in circles."]);
const GAUZE = R("gauze_pressure", "Firm pressure on the socket", ["Fold a clean gauze or cloth, dampen it and place it over the socket.", "Bite firmly for 20 minutes without checking."]);
const NO_SMOKE = R("no_smoking", "Avoid smoking and straws", ["Don't smoke, vape or drink through a straw for at least 3 days.", "Don't rinse hard; let the socket heal."]);
const ULCER_DIET = R("ulcer_diet", "Avoid spicy, salty and sour food", ["Avoid spicy, salty and acidic food and drinks until it heals.", "Use a soft toothbrush near the sore."]);

export const REMEDIES = {
  toothache: [PARACETAMOL, IBUPROFEN, AVOID_TRIGGERS, SALT, CLOVE, SOFT_FOOD, SENSITIVE_PASTE],
  swelling: [PARACETAMOL, IBUPROFEN, COLD_PACK, SALT, SOFT_FOOD],
  gums: [GENTLE_BRUSH, INTERDENTAL, SALT, CHX],
  broken: [WAX, PARACETAMOL, IBUPROFEN, SOFT_FOOD, AVOID_TRIGGERS],
  knocked_out: [MILK, GAUZE, PARACETAMOL],
  wisdom: [SALT, PARACETAMOL, IBUPROFEN, CHX, SOFT_FOOD],
  ulcer: [NUMB_GEL, SALT, ULCER_DIET, CHX],
  jaw: [JAW_REST, WARM_CLOTH, PARACETAMOL, IBUPROFEN],
  after_treatment: [GAUZE, NO_SMOKE, PARACETAMOL, IBUPROFEN, SALT],
};

const lower = (list) => [].concat(list || []).map((x) => String(x).toLowerCase());
const mentions = (list, words) => lower(list).some((item) => words.some((w) => item.includes(w)));

// Why a remedy isn't safe for this person, or null if it is.
export const unsafeBecause = (remedy, profile = {}, age) => {
  const a = remedy.avoid || {};
  if (a.allergies && mentions(profile.allergies, a.allergies)) return "allergy";
  if (a.conditions && mentions(profile.conditions, a.conditions)) return "condition";
  if (a.medicines && mentions(profile.medicines, a.medicines)) return "medicine";
  if (a.minAge && age !== undefined && age < a.minAge) return "age";
  return null;
};

export const safeRemedies = (problem, profile, age) => (REMEDIES[problem] || []).filter((r) => !unsafeBecause(r, profile, age));

// The next remedy to offer: safe, and not tried, refused or already shown.
export const nextRemedy = (problem, profile, { tried = [], rejected = [], offered = [] } = {}, age) =>
  safeRemedies(problem, profile, age).find((r) => ![...tried, ...rejected, ...offered].includes(r.id)) ||
  safeRemedies(problem, profile, age).find((r) => ![...tried, ...rejected].includes(r.id)) ||
  null;

export const remedyById = (id) => Object.values(REMEDIES).flat().find((r) => r.id === id) || null;
