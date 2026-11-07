// Languages the patient features speak, and how to ask the AI for each.
export const LANGUAGES = ["English", "Roman Urdu", "Urdu", "Hindi", "Arabic", "Spanish", "French", "Chinese"];

export const languageNote = (language) =>
  language === "Roman Urdu"
    ? `Write in Roman Urdu: everyday Urdu written in English (Latin) letters, the way people text in Pakistan (for example: "Aap ke daant mein dard hai, is liye aaj hi dentist se milein."). Do not use Urdu script. Keep common English words people use in Urdu speech (dentist, filling, root canal, infection) in English letters.`
    : language === "Urdu"
      ? "Write in Urdu script."
      : `Write in ${language}.`;
