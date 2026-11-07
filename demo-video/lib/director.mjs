// REHEARSE=1 runs the story at speed with no recording, to shake out a broken step quickly.
const pace = process.env.REHEARSE ? 0.12 : 1;
let speed = 1; // below 1 inside fastForward()
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms * pace * speed));

/** How long a caption stays up: long enough to read at a relaxed pace. */
const readingTime = (...texts) => {
  const words = texts.join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(2600, 1300 + words * 270);
};

/**
 * What a chapter script calls: every action moves the drawn cursor first, so a viewer can follow
 * it, and every explanation is a caption placed clear of what it talks about.
 */
export class Director {
  constructor(page, recorder, { outDir, brand = "", narrator = null }) {
    this.narrator = narrator;
    this.voiceUntil = 0; // when the clip playing now ends; the next one waits for it
    this.muted = false; // inside fastForward: repeated steps are not narrated again
    this.brand = brand;
    this.page = page;
    this.recorder = recorder;
    this.outDir = outDir;
    this.kicker = "";
    this.inflight = 0;
    this.segments = [];
    this.badge = null;
    // The overlay keeps its badge in sessionStorage, which is per origin: a badge hidden on one
    // dashboard would come back on another. Each page load takes the director's word for it.
    page.on("load", () => {
      const sync = this.badge ? this.demo("badge", this.badge) : this.demo("hideBadge");
      sync.catch(() => {});
    });
    page.on("request", () => (this.inflight += 1));
    const done = () => (this.inflight = Math.max(0, this.inflight - 1));
    page.on("requestfinished", done);
    page.on("requestfailed", done);
  }

  wait(ms) {
    return sleep(ms);
  }

  /** Waits until no request has been in flight for a moment. */
  async idle(quiet = 350, max = 8000) {
    const until = Date.now() + max;
    let calmSince = Date.now();
    while (Date.now() < until) {
      if (this.inflight > 0) calmSince = Date.now();
      else if (Date.now() - calmSince >= quiet) return;
      await sleep(60);
    }
  }

  // ── Recording ──────────────────────────────────────────────────────────────

  async chapter(file, kicker) {
    console.log(`▶ ${file}`);
    if (!this.recorder) return void (this.kicker = kicker);
    await this.recorder.stop();
    this.kicker = kicker;
    const path = `${this.outDir}/${file}.mp4`;
    this.recorder.start(path);
    this.segments.push(path);
    await sleep(300);
  }

  async end() {
    await this.recorder?.stop();
  }

  // ── Overlay ───────────────────────────────────────────────────────────────

  /** Calls the overlay; a navigation mid-call replaces the page, so wait for it and try again. */
  async demo(method, ...args) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.page.evaluate(
          ([name, params]) => window.__demo?.[name](...params),
          [method, args],
        );
      } catch (error) {
        if (attempt >= 3 || !/context was destroyed|navigat/i.test(error.message)) throw error;
        await this.page.waitForLoadState("domcontentloaded").catch(() => {});
        await sleep(150);
      }
    }
  }

  /**
   * The voice-over for what is about to appear: synthesised (or read from the cache) BEFORE the
   * caption shows, then started together with it. Returns how long it runs; 0 with no narrator.
   * `voice: false` keeps a caption silent; a string replaces the default spoken line.
   */
  async #speak(voice, fallback) {
    if (!this.narrator || voice === false || this.muted) return 0;
    const clip = await this.narrator.line(voice ?? fallback);
    if (!clip) return 0;
    await this.#start(clip);
    return clip.ms;
  }

  /** Starts a clip once the one before it has finished: two voices never talk over each other. */
  async #start(clip) {
    if (this.recorder) {
      const left = this.voiceUntil - Date.now();
      if (left > 0) await new Promise((resolve) => setTimeout(resolve, left + 150));
      this.recorder.cue(clip.file);
    }
    this.voiceUntil = Date.now() + clip.ms;
  }

  /**
   * A line spoken over what happens next, with no caption and no pause: for stretches of
   * clicking and typing that would otherwise play in silence.
   */
  async aside(text) {
    if (!this.narrator || this.muted) return;
    const clip = await this.narrator.line(text);
    if (clip) await this.#start(clip);
  }

  /** A full-screen title card. */
  async card(content, hold) {
    await this.demo("hideCaption");
    const spoken = [content.title, content.text].filter(Boolean).join(". ");
    const clip = this.narrator && content.voice !== false && !this.muted ? await this.narrator.line(content.voice ?? spoken) : null;
    if (clip) await this.#start(clip);
    await this.demo("card", { brand: this.brand, ...content, voice: undefined });
    const read = hold ?? readingTime(content.title, content.text, ...(content.points ?? [])) + 600;
    await sleep(Math.max(read, clip ? clip.ms + 900 : 0));
  }

  async uncard() {
    await this.demo("hideCard");
    await sleep(700);
  }

  /** Shows a caption and holds it long enough to read; it stays until the next one. */
  async say(title, text = "", { avoid, place, hold, kicker, voice } = {}) {
    await this.demo("hideCaption");
    await sleep(260);
    const box = avoid ? await this.box(avoid) : undefined;
    const spoken = text ? `${title}. ${text}` : title;
    const ms = await this.#speak(voice, spoken);
    await this.demo("caption", { kicker: kicker ?? this.kicker, title, text, avoid: box, place });
    // With a voice, the caption stays until the sentence is finished, plus a breath.
    await sleep(Math.max(hold ?? readingTime(title, text), ms ? ms + 450 : 0));
  }

  async quiet() {
    await this.demo("hideCaption");
    await sleep(300);
  }

  /** Rings one thing and dims the rest, with a caption beside it. */
  async spot(locator, title, text = "", opts = {}) {
    await this.reveal(locator);
    const box = await this.box(locator);
    await this.demo("spotlight", box, opts.pad ?? 10);
    await this.pointAt(box);
    if (title) await this.say(title, text, { avoid: this.padded(box, 14), ...opts });
    else await sleep(opts.hold ?? 1600);
    await this.demo("hideSpotlight");
    await sleep(250);
  }

  async zoom(locator, scale = 1.5, hold = 0) {
    const box = await this.box(locator);
    await this.demo("zoom", box, scale);
    await sleep(950 + hold);
  }

  async unzoom() {
    await this.demo("unzoom");
    await sleep(950);
  }

  /**
   * Runs a stretch of steps the viewer has already seen once, at `rate` times the pace, under a
   * corner badge, so repeated work stays in the video without dragging.
   */
  async fastForward(label, steps, rate = 3, { voice } = {}) {
    await this.quiet();
    this.badge = `⏩  ${label} · ×${rate}`;
    await this.demo("badge", this.badge);
    // One line introduces the stretch; the steps inside, already seen once, are not narrated.
    await this.aside(voice ?? `${label}, as before.`);
    speed = 1 / rate;
    this.muted = true;
    try {
      await steps();
    } finally {
      this.muted = false;
      speed = 1;
      this.badge = null;
      await this.demo("hideBadge");
    }
  }

  // ── Pointer and keyboard ──────────────────────────────────────────────────

  async box(locator) {
    if (!locator.boundingBox) return locator;
    const box = await locator.boundingBox();
    if (!box) throw new Error(`Not visible: ${locator}`);
    return box;
  }

  padded(box, pad) {
    return { x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2 };
  }

  /** Scrolls smoothly to the element when it is not comfortably in view. */
  async reveal(locator) {
    await locator.waitFor({ state: "visible", timeout: 15000 });
    const box = await locator.boundingBox();
    const viewport = this.page.viewportSize();
    const inView = box && box.y > 70 && box.y + box.height < viewport.height - 70;
    if (inView) return;
    await locator.evaluate((node) => node.scrollIntoView({ behavior: "smooth", block: "center" }));
    await sleep(750);
  }

  async pointAt(box, { dx = 0.5, dy = 0.5 } = {}) {
    const x = box.x + box.width * dx;
    const y = box.y + box.height * dy;
    const [fromX, fromY] = await this.demo("cursorAt");
    const distance = Math.hypot(x - fromX, y - fromY);
    const ms = Math.round(Math.min(950, Math.max(320, distance * 0.75)));
    await this.demo("move", x, y, ms);
    await sleep(ms + 90);
    return { x, y };
  }

  async point(locator, opts) {
    await this.reveal(locator);
    return this.pointAt(await this.box(locator), opts);
  }

  async click(locator, { after = 500, point } = {}) {
    const { x, y } = await this.point(locator, point);
    await this.demo("press", x, y);
    await sleep(140);
    await locator.click();
    await sleep(after);
    await this.idle();
  }

  async type(locator, text, { delay = 45, clear = true } = {}) {
    await this.click(locator, { after: 150 });
    if (clear) await locator.fill("");
    await locator.pressSequentially(String(text), { delay: delay * pace * speed });
    await sleep(250);
  }

  /** Date pickers and the like: point, click, then set the value in one go. */
  async fill(locator, value) {
    await this.click(locator, { after: 250 });
    await locator.fill(value);
    await sleep(400);
  }

  async select(locator, label) {
    await this.click(locator, { after: 250 });
    await locator.selectOption({ label });
    await sleep(450);
  }

  async check(locator) {
    await this.click(locator, { after: 350 });
    if (!(await locator.isChecked())) await locator.check();
  }

  /** Clicks a sidebar entry. */
  async nav(name) {
    await this.quiet();
    const link = this.page.getByRole("navigation").getByRole("link", { name, exact: true }).first();
    await this.click(link, { after: 700 });
  }
}
