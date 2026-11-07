import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

const FPS = 30;

/**
 * Records one page to H.264 MP4 segments through Chrome's screencast (sharper than Playwright's
 * built-in VP8 video). Chrome only sends a frame when something repaints, so each frame is
 * repeated until the next one arrives, which turns it into a constant 30 fps stream.
 */
/**
 * Lays the cued clips over a silent bed the length of the video, evens the loudness, and writes
 * the result back over the segment. Every segment gets an audio track, cues or not, so the
 * chapters still join without re-encoding.
 */
async function mixAudio(file, cues, seconds) {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  const withSound = file.replace(/\.mp4$/, ".audio.mp4");
  const inputs = ["-i", file, "-f", "lavfi", "-t", seconds.toFixed(3), "-i", "anullsrc=r=44100:cl=stereo"];
  cues.forEach((cue) => inputs.push("-i", cue.file));
  const delayed = cues.map((cue, i) => `[${i + 2}:a]aresample=44100,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,adelay=${cue.at}|${cue.at}[c${i}]`);
  const mixIn = ["[1:a]", ...cues.map((_, i) => `[c${i}]`)].join("");
  const filter = [...delayed, `${mixIn}amix=inputs=${cues.length + 1}:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a]`].join(";");
  await run(ffmpegPath, ["-y", "-loglevel", "error", ...inputs, "-filter_complex", filter, "-map", "0:v", "-map", "[a]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-shortest", "-movflags", "+faststart", withSound]);
  const fs = await import("node:fs");
  fs.renameSync(withSound, file);
}

export class Recorder {
  constructor(page, { width, height }) {
    this.page = page;
    this.size = { width, height };
    this.segment = null;
  }

  async init() {
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on("Page.screencastFrame", (frame) => this.#onFrame(frame));
    await this.cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 92,
      maxWidth: this.size.width,
      maxHeight: this.size.height,
      everyNthFrame: 1,
    });
  }

  /** Starts writing a new MP4; frames before this call are dropped. */
  start(file) {
    const ffmpeg = spawn(
      ffmpegPath,
      [
        "-y", "-loglevel", "error",
        "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS), "-i", "-",
        "-vf", `scale=${this.size.width}:${this.size.height}:flags=lanczos,format=yuv420p`,
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-movflags", "+faststart", file,
      ],
      { stdio: ["pipe", "inherit", "inherit"] },
    );
    const done = new Promise((resolve, reject) => {
      ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
    });
    this.segment = { ffmpeg, done, file, startedAt: Date.now(), written: 0, last: this.lastFrame, cues: [] };
  }

  /** Marks an audio clip to start now in the current segment; mixed in when the segment stops. */
  cue(file) {
    if (this.segment) this.segment.cues.push({ file, at: Date.now() - this.segment.startedAt });
  }

  /** Pads the last frame up to now, then closes the MP4. */
  async stop() {
    const segment = this.segment;
    if (!segment) return;
    this.#fillUntil(Date.now());
    this.segment = null;
    segment.ffmpeg.stdin.end();
    await segment.done;
    if (this.withAudio) await mixAudio(segment.file, segment.cues, segment.written / FPS);
    return segment.file;
  }

  async close() {
    await this.stop();
    await this.cdp.send("Page.stopScreencast").catch(() => {});
  }

  #onFrame({ data, sessionId }) {
    this.cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    const now = Date.now();
    this.#fillUntil(now);
    this.lastFrame = Buffer.from(data, "base64");
    if (this.segment) this.segment.last = this.lastFrame;
  }

  /** Writes the current frame as many times as 30 fps needs to reach `time`. */
  #fillUntil(time) {
    const segment = this.segment;
    if (!segment?.last) return;
    const due = Math.floor(((time - segment.startedAt) / 1000) * FPS);
    for (; segment.written < due; segment.written += 1) {
      segment.ffmpeg.stdin.write(segment.last);
    }
  }
}
