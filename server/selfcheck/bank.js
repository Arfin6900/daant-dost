// The patient self-check: plain-language questions by problem, the possible
// causes it can talk about, and the rules that set how urgent it is.
// Written for people who know no dental words. Every cause has a plain name
// first and the dentist's word second.

const NOT_SURE = "I'm not sure";

export const URGENCY = {
  emergency: {
    level: "emergency",
    title: "Get help now",
    action: "Go to A&E (the emergency department) or call emergency services now. Don't wait for a dental appointment.",
    rank: 4,
  },
  today: {
    level: "today",
    title: "See a dentist today",
    action: "Call your dentist as soon as they open and ask for an urgent appointment today. Out of hours, call your local urgent dental service.",
    rank: 3,
  },
  soon: {
    level: "soon",
    title: "See a dentist in the next few days",
    action: "Book an appointment within the next few days. It's unlikely to be dangerous, but it should be checked before it gets worse.",
    rank: 2,
  },
  routine: {
    level: "routine",
    title: "Mention it at your next check-up",
    action: "This usually isn't urgent. Book a normal appointment, or mention it at your next check-up. Come sooner if it gets worse.",
    rank: 1,
  },
};

// Possible causes, in plain words. The AI may only choose from these.
export const CAUSES = {
  sensitivity: { name: "Sensitive teeth", term: "Dentine hypersensitivity", explain: "The hard outer layer of the tooth has worn thin or the gum has pulled back, so cold or sweet things reach the sensitive layer underneath. Common and not dangerous.", treatment: null },
  early_decay: { name: "A small hole irritating the nerve", term: "Reversible pulpitis", explain: "Decay (a cavity) is close enough to the nerve to make it twinge, but the nerve is still healthy. A simple filling usually fixes it.", treatment: "filling" },
  inflamed_nerve: { name: "An inflamed nerve inside the tooth", term: "Irreversible pulpitis", explain: "The nerve inside the tooth is badly irritated, usually by deep decay or a crack. It won't settle on its own; a root canal treatment or removing the tooth stops the pain.", treatment: "root_canal" },
  abscess: { name: "An infection at the root of the tooth", term: "Dental abscess", explain: "Germs have got inside the tooth and caused a pocket of infection at the root tip. It needs a dentist to drain it and treat the tooth; antibiotics alone don't cure it.", treatment: "root_canal" },
  cracked_tooth: { name: "A crack in the tooth", term: "Cracked tooth", explain: "A fine crack, often too small to see, flexes when you bite. Covering the tooth with a crown usually stops the pain and stops the crack spreading.", treatment: "crown" },
  gum_inflammation: { name: "Inflamed gums", term: "Gingivitis", explain: "Plaque (a sticky layer of germs) along the gum line makes gums red, puffy and bleed when you brush. Very common, and it gets better with good cleaning.", treatment: null },
  gum_disease: { name: "Gum disease affecting the bone", term: "Periodontitis", explain: "Long-term gum inflammation has started to damage the bone holding the teeth, which can make teeth loose. A dentist or hygienist can stop it getting worse.", treatment: null },
  gum_abscess: { name: "An infection in the gum", term: "Periodontal abscess", explain: "A pocket of infection in the gum next to a tooth, often with a tender swelling. A dentist needs to clean and drain it.", treatment: null },
  wisdom_infection: { name: "An infected gum around a wisdom tooth", term: "Pericoronitis", explain: "Food and germs get trapped under the flap of gum over a wisdom tooth that hasn't fully come through, so the gum swells and hurts.", treatment: "extraction" },
  chipped_tooth: { name: "A chipped or broken tooth", term: "Tooth fracture", explain: "A piece of the tooth has broken off. Small chips can be smoothed or filled; bigger breaks may need a crown or, if the nerve is exposed, a root canal.", treatment: "crown" },
  knocked_out: { name: "A knocked-out tooth", term: "Avulsion", explain: "The whole tooth has come out of its socket. An adult tooth can often be saved if it's put back within about an hour.", treatment: null },
  mouth_ulcer: { name: "A mouth ulcer", term: "Aphthous ulcer", explain: "A painful round sore inside the mouth. Most heal by themselves within one to two weeks.", treatment: null },
  long_ulcer: { name: "A sore that isn't healing", term: "Non-healing ulcer", explain: "Most mouth sores heal within two to three weeks. One that lasts longer should always be checked by a dentist or doctor, just to be safe; usually it's nothing serious.", treatment: null },
  jaw_joint: { name: "A strained jaw joint or jaw muscles", term: "Temporomandibular disorder (TMD)", explain: "The joint in front of your ear or the chewing muscles are overworked, often from clenching or grinding. It usually improves with rest, soft food and a night guard.", treatment: null },
  dry_socket: { name: "A dry socket after a tooth was taken out", term: "Alveolar osteitis", explain: "The blood clot that protects the hole after an extraction has been lost, leaving the bone exposed. It's very painful but your dentist can dress it and it heals.", treatment: null },
};

const yesNo = (id, text, extra = {}) => ({ id, text, type: "single", options: ["Yes", "No", NOT_SURE], ...extra });

// One entry per kind of problem, in the order patients see them.
export const PROBLEMS = [
  {
    id: "toothache",
    label: "Toothache",
    hint: "A tooth hurts",
    icon: "zap",
    questions: [
      { id: "trigger", text: "What sets the pain off?", type: "multi", options: ["Cold drinks or food", "Hot drinks or food", "Sweet things", "Biting or chewing", "It comes on by itself", NOT_SURE] },
      { id: "lasts", text: "Once it starts, how long does the pain last?", type: "single", options: ["A few seconds, then it goes", "Minutes or longer", "It's there all the time", NOT_SURE] },
      yesNo("night", "Does it wake you up at night?"),
      { id: "swelling", text: "Is there any swelling?", type: "single", options: ["No swelling", "A small lump on the gum", "My face or cheek is swollen", "Swelling spreading towards my eye, neck or under my jaw"] },
      { id: "severity", text: "How bad is the pain right now?", type: "scale", min: 0, max: 10, labels: ["No pain", "Worst pain ever"] },
      yesNo("fever", "Do you have a fever or feel generally unwell?"),
    ],
  },
  {
    id: "swelling",
    label: "Swelling",
    hint: "Gum, face or jaw is swollen",
    icon: "alert",
    questions: [
      { id: "where", text: "Where is the swelling?", type: "single", options: ["On the gum by a tooth", "My cheek or face", "Under my jaw or in my neck", "Near my eye"] },
      yesNo("spreading", "Is it getting bigger or spreading?"),
      yesNo("breathing", "Is it hard to breathe or swallow?"),
      yesNo("fever", "Do you have a fever or feel generally unwell?"),
      yesNo("toothpain", "Does a tooth near the swelling hurt?"),
      yesNo("wisdom", "Is it right at the back, around a wisdom tooth?"),
    ],
  },
  {
    id: "gums",
    label: "Bleeding or sore gums",
    hint: "Gums bleed, look red or feel sore",
    icon: "droplet",
    questions: [
      { id: "when", text: "When do your gums bleed?", type: "single", options: ["Only when I brush or floss", "Sometimes on their own", "They don't bleed, they're sore", NOT_SURE] },
      { id: "howlong", text: "How long has this been going on?", type: "single", options: ["Less than 2 weeks", "A few weeks to months", "Longer than that"] },
      yesNo("loose", "Do any teeth feel loose or look like they're moving?"),
      yesNo("lump", "Is there a sore lump on the gum?"),
      { id: "factors", text: "Does any of these apply to you?", type: "multi", options: ["I smoke", "I have diabetes", "I'm pregnant", "I take blood thinners", "None of these"] },
    ],
  },
  {
    id: "broken",
    label: "Broken or chipped tooth",
    hint: "A piece came off, or it feels sharp",
    icon: "scissors",
    questions: [
      { id: "size", text: "How much has broken off?", type: "single", options: ["A tiny chip", "A noticeable piece", "Most of the tooth", NOT_SURE] },
      yesNo("pain", "Does it hurt?"),
      yesNo("pink", "Can you see a pink or red spot in the broken part?"),
      yesNo("injury", "Did it happen in a fall, accident or hit to the face?"),
      yesNo("bite", "Do your teeth still meet normally when you close?"),
    ],
  },
  {
    id: "knocked_out",
    label: "Tooth knocked out",
    hint: "A whole tooth came out",
    icon: "alert",
    questions: [
      { id: "whose", text: "Whose tooth is it?", type: "single", options: ["An adult tooth (age 7 and over)", "A child's baby tooth", NOT_SURE] },
      { id: "when", text: "How long ago did it come out?", type: "single", options: ["Less than 1 hour", "More than 1 hour"] },
      yesNo("havetooth", "Do you have the tooth?"),
      yesNo("headinjury", "Was there a hit to the head, a headache, sickness or confusion?"),
    ],
  },
  {
    id: "wisdom",
    label: "Wisdom tooth pain",
    hint: "Pain right at the back of the mouth",
    icon: "zap",
    questions: [
      yesNo("gumflap", "Is the gum over or behind your back tooth swollen?"),
      yesNo("taste", "Is there a bad taste or smell?"),
      yesNo("opening", "Is it hard to open your mouth wide?"),
      yesNo("breathing", "Is it hard to swallow or breathe?"),
      yesNo("fever", "Do you have a fever or feel generally unwell?"),
    ],
  },
  {
    id: "ulcer",
    label: "Mouth sore or ulcer",
    hint: "A sore spot, patch or lump inside the mouth",
    icon: "circle",
    questions: [
      { id: "howlong", text: "How long have you had it?", type: "single", options: ["Less than 1 week", "1 to 3 weeks", "More than 3 weeks"] },
      yesNo("painful", "Is it painful?"),
      yesNo("recurring", "Do you get sores like this again and again?"),
      yesNo("patch", "Is it a white or red patch, or a lump, rather than a sore?"),
      yesNo("cause", "Could something have caused it, like a sharp tooth, a brace or biting your cheek?"),
    ],
  },
  {
    id: "jaw",
    label: "Jaw pain or clicking",
    hint: "Jaw aches, clicks or gets stuck",
    icon: "move",
    questions: [
      { id: "symptoms", text: "What do you notice?", type: "multi", options: ["Clicking or popping", "Pain in front of the ear", "Pain when chewing", "Headaches", "Hard to open wide", NOT_SURE] },
      yesNo("locked", "Is your jaw stuck open or stuck closed right now?"),
      yesNo("grind", "Do you clench or grind your teeth, or wake up with a sore jaw?"),
      yesNo("injury", "Did it start after a hit to the face?"),
    ],
  },
  {
    id: "after_treatment",
    label: "Pain after a tooth was taken out",
    hint: "A problem after an extraction",
    icon: "plus",
    questions: [
      { id: "days", text: "How long ago was the tooth taken out?", type: "single", options: ["Today or yesterday", "2 to 4 days ago", "More than 4 days ago"] },
      { id: "pain", text: "How has the pain changed?", type: "single", options: ["Getting better each day", "It got worse after it was getting better", "Severe and constant from the start"] },
      yesNo("bleeding", "Is it still bleeding after pressing on a clean pad for 20 minutes?"),
      yesNo("swelling", "Is your face swelling more, or do you have a fever?"),
      yesNo("smoke", "Have you smoked or rinsed hard since?"),
    ],
  },
];

export const PROBLEM_BY_ID = Object.fromEntries(PROBLEMS.map((p) => [p.id, p]));
export const NOT_SURE_ANSWER = NOT_SURE;
