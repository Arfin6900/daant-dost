import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const run = promisify(execFile);

/** Joins chapter MP4s (same codec and size) into one file without re-encoding. */
export async function concat(files, out) {
  const list = path.join(path.dirname(out), `.${path.basename(out)}.txt`);
  fs.writeFileSync(list, files.map((file) => `file '${path.resolve(file)}'`).join("\n"));
  await run(ffmpegPath, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", out]);
  fs.rmSync(list);
  return out;
}
