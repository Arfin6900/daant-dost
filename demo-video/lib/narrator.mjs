import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { KokoroTTS } from "kokoro-js";

const run = promisify(execFile);

/**
 * The voice-over, spoken by Kokoro (82M, runs locally, free). Each line is cached by its text and
 * voice, so a retake plays straight from the cache.
 */
export class Narrator {
  constructor({ voice = "af_heart", speed = 1, cacheDir }) {
    this.voice = voice;
    this.speed = speed;
    this.cacheDir = cacheDir;
    this.script = [];
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  static speakable(text) {
    return String(text)
      .replace(/ToothTwin/g, "Tooth Twin")
      .replace(/\s*→\s*/g, " to ")
      .replace(/\s*·\s*/g, ", ")
      .replace(/\bAI\b/g, "A.I.")
      .replace(/\s+/g, " ")
      .trim();
  }

  async #tts() {
    this.tts ??= await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
    return this.tts;
  }

  async line(raw) {
    const text = Narrator.speakable(raw);
    if (!text) return null;
    this.script.push(text);
    const key = crypto.createHash("sha1").update(JSON.stringify([this.voice, this.speed, text])).digest("hex");
    const file = path.join(this.cacheDir, `${key}.wav`);
    if (!fs.existsSync(file)) {
      const tts = await this.#tts();
      const audio = await tts.generate(text, { voice: this.voice, speed: this.speed });
      await audio.save(file);
    }
    return { file, ms: await durationMs(file), text };
  }

  /** Synthesises every line ahead of the take, so the recording never waits on the voice. */
  async prepare(lines) {
    for (const l of lines) await this.line(l);
    this.script = [];
  }
}

export async function durationMs(file) {
  const { stderr } = await run(ffmpegPath, ["-hide_banner", "-i", file, "-f", "null", "-"]).catch((e) => e);
  const m = /time=(\d+):(\d+):([\d.]+)/g;
  let last;
  for (let x; (x = m.exec(stderr)); ) last = x;
  if (!last) return 0;
  return Math.round(((+last[1] * 60 + +last[2]) * 60 + +last[3]) * 1000);
}
