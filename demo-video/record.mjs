// node record.mjs            records the full narrated video to output/ToothTwin-demo.mp4
// REHEARSE=1 node record.mjs  fast dry run, nothing recorded (also fills the voice cache)
// FROM=03 TO=05 node record.mjs  re-record only some chapters
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { concat } from "./lib/concat.mjs";
import { Director } from "./lib/director.mjs";
import { Recorder } from "./lib/recorder.mjs";
import { Narrator } from "./lib/narrator.mjs";
import story from "./story.mjs";

const run = promisify(execFile);
const root = path.dirname(fileURLToPath(import.meta.url));
const rehearse = Boolean(process.env.REHEARSE);
const from = process.env.FROM ?? "00";
const to = process.env.TO ?? "99";
const outDir = path.join(root, "output", "chapters");
fs.mkdirSync(outDir, { recursive: true });

const narrator = new Narrator({ voice: process.env.VOICE || "af_heart", speed: Number(process.env.VOICE_SPEED || 1), cacheDir: path.join(root, "audio-cache") });

const VIEWPORT = { width: 1600, height: 900 };
const SCALE = 1.2; // 1920×1080 video

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
});
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, colorScheme: "light", locale: "en-GB", acceptDownloads: true });
// A fresh patient for every take, with a name for the report.
const patient = { id: `demo-${Date.now()}`, name: "Ayesha" };
await context.addInitScript((p) => {
  try {
    if (!localStorage.getItem("tt-student")) localStorage.setItem("tt-student", JSON.stringify(p));
  } catch {}
}, patient);
await context.addInitScript({ path: path.join(root, "lib", "overlay.js") });
const page = await context.newPage();
page.setDefaultTimeout(20000);
page.setDefaultNavigationTimeout(60000);

let recorder = null;
if (!rehearse) {
  recorder = new Recorder(page, { width: VIEWPORT.width * SCALE, height: VIEWPORT.height * SCALE });
  recorder.withAudio = true;
  await recorder.init();
}
const director = new Director(page, recorder, { outDir, brand: story.brand, narrator });

// Shows the downloaded PDF's first page as a page of its own, so it can be filmed.
const extras = {
  previewPdf: async (download) => {
    const pdf = path.join(root, "output", "report.pdf");
    await download.saveAs(pdf);
    const png = path.join(root, "output", "report.png");
    const py = process.env.PDF_PYTHON || "python3";
    await run(py, ["-c", `import pypdfium2 as p; d=p.PdfDocument(${JSON.stringify(pdf)}); d[0].render(scale=2.2).to_pil().save(${JSON.stringify(png)})`]);
    const html = path.join(root, "output", "report.html");
    fs.writeFileSync(
      html,
      `<!doctype html><meta charset="utf-8"><body style="margin:0;height:100vh;display:grid;place-items:center;background:radial-gradient(900px 600px at 70% 30%,rgba(19,188,251,.25),transparent 60%),#0A1229;overflow:hidden">
<img src="report.png" style="height:92vh;border-radius:10px;box-shadow:0 30px 80px rgba(0,0,0,.5);animation:in 1s ease both"><style>@keyframes in{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:none}}</style>`,
    );
    return `file://${html}`;
  },
};

const started = Date.now();
try {
  for (const chapter of story.chapters) {
    if (chapter.id < from || chapter.id > to) continue;
    await director.chapter(`${chapter.id}-${chapter.slug}`, chapter.kicker);
    await chapter.run({ page, director, extras });
  }
  await director.end();
  if (!rehearse && from === "00" && to === "99") {
    const full = path.join(root, "output", "ToothTwin-demo.mp4");
    await concat(director.segments, full);
    console.log(`✔ ${full}`);
  }
} catch (error) {
  console.error("✖ Step failed:", error.message.split("\n").slice(0, 8).join("\n"));
  await page.screenshot({ path: path.join(root, "output", "failure.png") }).catch(() => {});
  await director.end().catch(() => {});
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(root, "output", "narration.txt"), narrator.script.map((l, i) => `${i + 1}. ${l}`).join("\n"));
  await recorder?.close().catch(() => {});
  await browser.close();
  console.log(`took ${Math.round((Date.now() - started) / 1000)} s`);
}
