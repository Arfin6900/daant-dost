import { jsPDF } from "jspdf";

// A clean, shareable PDF of a case: what the patient reported, how urgent
// it is, what it could be, what they tried, how it ended, and their history.
// jsPDF's built-in fonts only cover Latin letters, so cases written in Urdu,
// Arabic, Hindi or Chinese script are printed by the browser instead.

const BRAND = [10, 116, 218];
const INK = [15, 27, 61];
const SOFT = [74, 86, 117];
const LINE = [220, 227, 238];
const URGENCY_RGB = { emergency: [194, 30, 58], today: [255, 122, 47], soon: [255, 176, 32], routine: [18, 128, 92] };

export const canExportPdf = (c) => !/[^\u0000-ɏ -⁯€™•–—’‘“”…]/.test(JSON.stringify([c.result?.summary, c.messages?.map((m) => m.text)]));

const ascii = (s) =>
  String(s ?? "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/•/g, "-");

export const exportCasePdf = (c, profile, { patientName } = {}) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 16;
  const width = W - 2 * M;
  let y = 0;
  const r = c.result;

  const page = () => {
    doc.addPage();
    y = 20;
  };
  const room = (h) => {
    if (y + h > 280) page();
  };
  const text = (str, { size = 10.5, color = INK, bold = false, indent = 0, gap = 1.6 } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(ascii(str), width - indent);
    lines.forEach((line) => {
      room(size * 0.45);
      doc.text(line, M + indent, y);
      y += size * 0.42 + gap * 0.3;
    });
    y += gap;
  };
  const heading = (str) => {
    room(16);
    y += 3;
    doc.setDrawColor(...LINE);
    doc.line(M, y - 4, W - M, y - 4);
    text(str, { size: 13, bold: true, color: BRAND, gap: 1 });
  };
  const bullets = (list, mark = "-") => (list || []).forEach((item) => text(`${mark}  ${item}`, { indent: 2, gap: 0.8 }));

  // Header band.
  doc.setFillColor(10, 18, 41);
  doc.rect(0, 0, W, 34, "F");
  doc.setFillColor(...BRAND);
  doc.roundedRect(M, 9, 14, 14, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TT", M + 3.6, 17.8);
  doc.setFontSize(17);
  doc.text("ToothTwin", M + 18, 15.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("Dental self-check report", M + 18, 21.5);
  doc.setFontSize(8.5);
  const date = new Date(c.createdAt).toLocaleString();
  doc.text(ascii(`${patientName ? `${patientName}  |  ` : ""}${date}`), W - M, 15.5, { align: "right" });
  doc.text(`Case ${c.id.slice(0, 8).toUpperCase()}  |  ${c.status === "resolved" ? "Resolved" : "Open"}`, W - M, 21.5, { align: "right" });
  y = 44;

  // Urgency.
  const rgb = URGENCY_RGB[r.urgency.level] || BRAND;
  doc.setFillColor(...rgb);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const actionLines = doc.splitTextToSize(ascii(r.urgency.action), width - 12);
  const boxH = 17 + actionLines.length * 4.6 + (r.redFlags?.length ? 6 : 0);
  doc.roundedRect(M, y - 6, width, boxH, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("HOW URGENT", M + 6, y);
  doc.setFontSize(14);
  doc.text(ascii(r.urgency.title), M + 6, y + 6.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(actionLines, M + 6, y + 12.5);
  if (r.redFlags?.length) {
    doc.setFont("helvetica", "bold");
    doc.text(ascii(`Warning signs: ${r.redFlags.join(", ")}`), M + 6, y + 12.5 + actionLines.length * 4.6);
  }
  y += boxH + 4;

  heading("What you told us");
  text(`Problem: ${r.problem}`, { bold: true, gap: 0.6 });
  if (r.teeth?.length) text(`Where: ${r.teeth.map((t) => `${t.plain} (tooth ${t.id})`).join("; ")}`, { gap: 0.6 });
  if (c.input?.story) text(`In your words: "${c.input.story}"`, { color: SOFT, gap: 0.6 });
  text(r.summary, { gap: 1 });

  if (r.immediate?.length) {
    heading("Do this right now");
    r.immediate.forEach((s, i) => text(`${i + 1}.  ${s}`, { indent: 2, gap: 0.8 }));
  }

  heading("What it could be");
  r.causes.forEach((cause) => {
    text(`${cause.name}  (${cause.likelihood})`, { bold: true, gap: 0.4 });
    if (cause.note) text(cause.note, { gap: 0.4 });
    text(cause.explain, { color: SOFT, gap: 0.4 });
    text(`A dentist may call it: ${cause.term}`, { size: 9, color: SOFT, gap: 2 });
  });

  heading("What you can do now");
  bullets(r.selfCare);
  heading("Get help straight away if");
  bullets(r.getHelpIf);

  const remedies = (c.messages || []).filter((m) => m.remedy).map((m) => m.remedy);
  if (remedies.length || c.care?.tried?.length) {
    heading("Home care we talked about");
    const title = (id) => remedies.find((x) => x.id === id)?.title || id;
    if (c.care.tried.length) text(`Tried without enough relief: ${c.care.tried.map(title).join(", ")}`, { gap: 0.6 });
    if (c.care.rejected.length) text(`Couldn't use (allergy or other reason): ${c.care.rejected.map(title).join(", ")}`, { gap: 0.6 });
    const last = remedies.at(-1);
    if (last && c.status !== "resolved") text(`Current suggestion: ${last.title}. ${last.steps.join(" ")}`, { gap: 0.6 });
  }

  if (c.resolution) {
    heading("How it was resolved");
    text(`Resolved on ${new Date(c.resolution.at).toLocaleDateString()}`, { bold: true, gap: 0.6 });
    text(`What helped: ${c.resolution.whatHelped}`, { gap: 0.6 });
    if (c.resolution.note) text(`Notes: ${c.resolution.note}`, { color: SOFT });
  }

  heading("Questions to ask your dentist");
  bullets(r.askDentist, "[ ]");

  if (profile && ["allergies", "medicines", "conditions", "treatments"].some((k) => profile[k]?.length)) {
    heading("Your dental and medical history");
    [
      ["Allergies", profile.allergies],
      ["Medicines", profile.medicines],
      ["Health conditions", profile.conditions],
      ["Past dental treatments", profile.treatments],
    ].forEach(([label, list]) => list?.length && text(`${label}: ${list.join(", ")}`, { gap: 0.8 }));
  }

  if (r.words?.length) {
    heading("Words you might hear");
    r.words.forEach((w) => text(`${w.word}: ${w.meaning}`, { indent: 2, gap: 0.6 }));
  }

  // Footer on every page.
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.line(M, 286, W - M, 286);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SOFT);
    doc.text("General information from a self-check, not a diagnosis. Urgency is set by fixed safety rules. Always follow your dentist's advice.", M, 290.5);
    doc.text(`${i} / ${pages}`, W - M, 290.5, { align: "right" });
  }
  doc.save(`ToothTwin-report-${new Date(c.createdAt).toISOString().slice(0, 10)}-${c.id.slice(0, 6)}.pdf`);
};

// Plain text for messaging apps or email.
export const caseAsText = (c) => {
  const r = c.result;
  return [
    `ToothTwin self-check (${new Date(c.createdAt).toLocaleDateString()})`,
    `Problem: ${r.problem}${r.teeth?.length ? ` - ${r.teeth.map((t) => t.plain).join("; ")}` : ""}`,
    `How urgent: ${r.urgency.title}`,
    `Could be: ${r.causes.map((x) => `${x.name} (${x.term})`).join("; ")}`,
    c.resolution ? `Resolved: ${c.resolution.whatHelped}` : null,
    "",
    "Questions for the dentist:",
    ...r.askDentist.map((q) => `- ${q}`),
  ]
    .filter((l) => l !== null)
    .join("\n");
};
