// The ToothTwin demo: a patient's journey first, then the extras. Every caption and spoken line
// lives here. Steps use the screen's own labels, like a person would.

const BASE = process.env.BASE_URL || "http://localhost:5173";
const go = (page, path) => page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
const btn = (page, name, opts = {}) => page.getByRole("button", { name, exact: true, ...opts }).first();

// Picks a sensible patient answer for whatever the AI asks: calm, no danger signs.
const DANGER = /spread|eye|neck|breath|swallow|fever|unwell|not sure|don't know|pata nahi|knock|stuck|worst/i;
const PREFER = /minutes|longer|night|wake|chew|bit|cold|yes|lump|gum|small|throb/i;

async function answerInterview(page, d, maxTurns = 8) {
  for (let turn = 0; turn < maxTurns; turn += 1) {
    // Wait for a question, or for the report page.
    const outcome = await Promise.race([
      page.waitForURL(/\/history\//, { timeout: 90000 }).then(() => "done"),
      page.locator("main h2").filter({ hasNotText: /Tell us|Where|problem|Who is/ }).first().waitFor({ timeout: 90000 }).then(() => "question"),
    ]);
    if (outcome === "done" || /\/history\//.test(page.url())) return;
    await d.wait(500);
    if (/\/history\//.test(page.url())) return;

    const step = page.locator("main .animate-rise-in").last();
    const range = step.locator('input[type="range"]');
    const text = step.locator("textarea");
    const options = step.locator(".grid > button");

    if (await range.count()) {
      await d.point(range);
      await range.fill("7");
      await d.wait(700);
    } else if (await text.count()) {
      await d.type(text, "It throbs at night and hurts when I chew on that side.", { delay: 28 });
    } else if (await options.count()) {
      const labels = await options.allInnerTexts();
      const safe = labels.map((l, i) => [l, i]).filter(([l]) => !DANGER.test(l));
      const best = safe.find(([l]) => PREFER.test(l)) || safe[0] || [labels[0], 0];
      await d.click(options.nth(best[1]), { after: 500 });
      const multi = (await step.getByText(/Choose all that apply/i).count()) > 0;
      if (multi) {
        const second = safe.find(([l, i]) => i !== best[1] && PREFER.test(l));
        if (second) await d.click(options.nth(second[1]), { after: 400 });
      }
    }
    const next = page.getByRole("button", { name: /^(Next|Skip|See my results)$/ }).last();
    await d.click(next, { after: 300 });
  }
}

export default {
  brand: "ToothTwin · dental help in plain words",
  // Every line synthesised before the take, so the recording never waits for the voice.
  chapters: [
    {
      id: "00",
      slug: "intro",
      kicker: "ToothTwin",
      run: async ({ page, director: d }) => {
        await go(page, "/");
        await d.wait(1500);
        await d.card({
          index: "ToothTwin",
          title: "Tooth trouble?<br>Find out what to do.",
          text: "A living 3D mouth with an AI inside, made for patients who don't know the dental words.",
          voice:
            "Tooth trouble is scary, especially when you don't know the words dentists use. Tooth Twin is a living 3D mouth with an A.I. inside. It helps you understand what's wrong, how urgent it is, and what to do next, in plain words.",
        });
        await d.uncard();
        await d.spot(page.locator("main section").first().locator("h1"), "Made for patients first", "Check your symptoms in about two minutes, in English or Roman Urdu.", {
          voice: "It's made for patients first. You can check your symptoms in about two minutes, in English or in Roman Urdu.",
        });
        await page.getByRole("heading", { name: "Pick who you are to get started" }).scrollIntoViewIfNeeded();
        await d.wait(600);
        await d.spot(page.locator("main article").first(), "Patients, students and teachers", "One 3D mouth, three ways to use it.", {
          voice: "And the same 3D mouth also helps dental students practise, and teachers set cases. But let's start where most people start: a toothache.",
        });
      },
    },
    {
      id: "01",
      slug: "history",
      kicker: "Step 1 · My dental history",
      run: async ({ page, director: d }) => {
        await go(page, "/history");
        await page.getByRole("heading", { name: "Everything in one place" }).waitFor();
        await d.say("Your dental history, in one place", "Allergies, medicines, health conditions and past treatments.", {
          voice: "First, Ayesha adds her dental history. Her allergies, the medicines she takes, her health conditions and past treatments, all in one place.",
        });
        await d.click(btn(page, "+ Aspirin"), { after: 600 });
        await d.click(btn(page, "+ Asthma"), { after: 600 });
        await d.click(btn(page, "+ Inhaler"), { after: 600 });
        await d.click(btn(page, "+ Filling"), { after: 900 });
        await d.spot(page.getByText(/Saved|Saving/).first(), "Saved automatically", "Every check from now on uses it to keep advice safe.", {
          voice: "It saves by itself. From now on, every check uses it to keep the advice safe for her. For example, it will never suggest a medicine she's allergic to.",
        });
      },
    },
    {
      id: "02",
      slug: "self-check",
      kicker: "Step 2 · Check my teeth",
      run: async ({ page, director: d }) => {
        await go(page, "/check");
        await page.getByRole("heading", { name: "Who is this check for?" }).waitFor();
        await d.wait(2500);
        await d.spot(page.getByRole("radiogroup", { name: "Language" }), "English or Roman Urdu", "Pick your language first. Results come in your language too.", {
          voice: "Now the self-check. Ayesha can use English or Roman Urdu, and the results come back in the same language.",
        });
        await d.click(btn(page, "Me"));
        await d.click(btn(page, "Next"));
        await d.say("Show us where it hurts", "Tap the tooth on the 3D mouth, or pick an area.", {
          voice: "She shows where it hurts. She can tap the tooth on the 3D mouth, or just pick an area.",
          place: "top",
        });
        await d.click(btn(page, "Bottom left, back"), { after: 1200 });
        await d.aside("The bottom left back tooth lights up, and gets a name she understands.");
        await d.wait(2600);
        await d.click(btn(page, "Next"));
        await d.say("What's the problem?", "No dental words needed.", { voice: "Then she picks what kind of problem it is. No dental words needed." });
        await d.click(page.getByRole("button", { name: /^Toothache/ }).first(), { after: 600 });
        await d.click(btn(page, "Next"));
        await d.aside("And she describes it in her own words.");
        await d.type(page.locator("#story"), "My bottom left back tooth hurts with cold water for 3 days, and the pain stays for a while.", { delay: 32 });
        await d.wait(400);
        await d.click(btn(page, "Next"));
        await d.say("The AI asks precise questions", "Each one is written from her story and her answers.", {
          voice: "Now the A.I. interviews her. Each question is written from her story and her earlier answers, so it's precise to her problem, not a fixed form. Behind the scenes, it makes sure every safety question gets covered.",
        });
        await d.quiet();
        await answerInterview(page, d);
        await page.getByText("How urgent").first().waitFor({ timeout: 90000 });
        await d.wait(1500);
      },
    },
    {
      id: "03",
      slug: "result",
      kicker: "Step 3 · Know what to do",
      run: async ({ page, director: d }) => {
        await d.spot(page.getByText("How urgent").first().locator("xpath=ancestor::section[1]"), "How urgent it is", "Decided by fixed safety rules. The AI can never lower it.", {
          voice: "Here's her result. First, how urgent it is, and exactly what to do. Urgency comes from fixed safety rules, so the A.I. can never make something dangerous sound mild.",
        });
        await d.spot(page.getByRole("heading", { name: "What it could be" }).locator("xpath=ancestor::section[1]"), "What it could be", "Plain names first, and the word the dentist may use.", {
          voice: "Then, what it could be, in plain words first, and the word her dentist might use. With a link to watch how it's treated in 3D.",
        });
        await d.spot(page.getByRole("heading", { name: "What you can do now" }).locator("xpath=ancestor::section[1]"), "What to do now", "Safe steps, and when to get help straight away.", {
          voice: "What she can do right now, and the warning signs that mean get help straight away. Notice the painkiller advice: because of her asthma, it avoids ibuprofen.",
        });
        await d.spot(page.getByRole("heading", { name: "Questions to ask your dentist" }).locator("xpath=ancestor::section[1]"), "Questions for the dentist", "Ready to copy, so nothing is forgotten in the chair.", {
          voice: "And questions to ask her dentist, so nothing is forgotten in the chair.",
        });
      },
    },
    {
      id: "04",
      slug: "feedback",
      kicker: "Step 4 · Remake the report",
      run: async ({ page, director: d }) => {
        const box = page.locator("#feedback");
        await d.reveal(box);
        await d.say("Not quite right? Say so", "Correct anything, and the report is remade.", {
          voice: "What if something's missing? Ayesha remembers there's a small lump on her gum. She just says so, and the report is remade.",
        });
        await d.type(box, "I forgot to say: there is a small sore lump on my gum next to that tooth.", { delay: 28 });
        await d.click(btn(page, "Remake my report"));
        await d.aside("The A.I. reads her correction, and the safety rules run again.");
        await page.getByText(/updated 1 time/).waitFor({ timeout: 90000 });
        await d.wait(1200);
        await d.spot(page.getByText("How urgent").first().locator("xpath=ancestor::section[1]"), "Updated, and more urgent", "A gum lump can mean infection, so it now says: see a dentist today.", {
          voice: "A lump on the gum can mean an infection, so the advice is now more urgent: see a dentist today. The old version is kept too.",
        });
      },
    },
    {
      id: "05",
      slug: "care-chat",
      kicker: "Step 5 · What can I try at home?",
      run: async ({ page, director: d }) => {
        const panel = page.getByRole("region", { name: "What can I try at home?" });
        await d.reveal(panel);
        await panel.getByText("Try this").first().waitFor({ timeout: 90000 });
        await d.spot(panel, "A conversation, not a leaflet", "It suggests one safe thing at a time.", {
          voice: "While she waits for the dentist, the assistant suggests one safe thing to try at home, checked against her allergies and conditions.",
        });
        await d.aside("Already tried it? One tap, and it offers something else.");
        await d.click(btn(page, "I've already tried this"));
        await panel.locator(".animate-dot-bounce").first().waitFor({ state: "detached", timeout: 90000 }).catch(() => {});
        await d.wait(3500);
        await d.aside("She can also reply in her own words, like an allergy it didn't know about.");
        await d.type(panel.getByRole("textbox"), "I'm allergic to clove oil", { delay: 34 });
        await page.keyboard.press("Enter");
        await d.wait(1500);
        await panel.locator(".animate-dot-bounce").first().waitFor({ state: "detached", timeout: 90000 }).catch(() => {});
        await d.wait(4000);
        await d.say("It learns her allergies", "Clove is now saved in her dental history.", {
          voice: "It moves on to another option, and saves the new allergy into her history, so she's never offered it again.",
        });
      },
    },
    {
      id: "06",
      slug: "resolve",
      kicker: "Step 6 · Problem solved",
      run: async ({ page, director: d }) => {
        await d.say("When it's solved, one button", "The case and what worked are saved.", {
          voice: "A few days later, the dentist has treated it. Ayesha presses one button.",
        });
        await d.click(btn(page, "My problem is solved"));
        await d.click(page.getByRole("dialog").getByText("A dentist treated it"), { after: 400 });
        await d.type(page.getByRole("dialog").locator("textarea"), "Root canal started on the bottom left molar.", { delay: 28 });
        await d.click(btn(page, "Save and close the case", { exact: false }), { after: 1200 });
        await d.spot(page.getByText("Case resolved and saved").locator("xpath=ancestor::section[1]"), "Saved in her history", "What helped is recorded for next time.", {
          voice: "The case closes, and what helped is saved in her history for next time.",
        });
      },
    },
    {
      id: "07",
      slug: "report",
      kicker: "Step 7 · Share with the dentist",
      run: async ({ page, director: d, extras }) => {
        const download = page.waitForEvent("download", { timeout: 30000 });
        await d.spot(btn(page, "Download PDF report"), "A report she can share", "PDF, print, or a summary for WhatsApp.", {
          voice: "And she can take it all to her dentist: a clean P.D.F. report, a print-out, or a short summary for WhatsApp.",
        });
        await d.click(btn(page, "Download PDF report"), { after: 800 });
        const file = await download;
        const preview = await extras.previewPdf(file);
        await page.goto(preview);
        await d.wait(800);
        await d.say("Everything on one report", "Urgency, causes, what she tried, how it ended, and her history.", {
          voice: "Everything on one report. How urgent it was, what it could be, what she tried, how it was resolved, and her medical history.",
          place: "top",
        });
      },
    },
    {
      id: "08",
      slug: "explain",
      kicker: "Treatments explained",
      run: async ({ page, director: d }) => {
        await go(page, "/explain?t=root_canal");
        await page.getByRole("button", { name: "Mute narration" }).waitFor({ timeout: 20000 });
        await page.getByRole("button", { name: "Mute narration" }).click();
        await d.say("Root canal? See it first", "Every treatment, step by step, on the 3D mouth.", {
          voice: "Scared of a root canal? Tooth Twin shows it step by step on the 3D mouth, in plain words, and in seven languages, including Roman Urdu.",
        });
        await d.quiet();
        await d.wait(9000);
        await d.aside("The infected nerve is cleaned out of each canal, sealed, and protected with a crown.");
        await d.wait(9000);
      },
    },
    {
      id: "09",
      slug: "child",
      kicker: "My child's teeth",
      run: async ({ page, director: d }) => {
        await go(page, "/explore?age=2&layer=gums");
        await page.getByRole("button", { name: "Play the timeline" }).waitFor({ timeout: 20000 });
        await d.wait(1500);
        await d.say("Which teeth should my child have?", "Watch the mouth grow from birth to adult.", {
          voice: "Parents often ask: which teeth should my child have by now? Press play, and watch the mouth grow, from the first baby teeth to the adult set.",
        });
        await d.click(page.getByRole("button", { name: "Play the timeline" }), { after: 300 });
        await d.quiet();
        await d.wait(11000);
        await d.aside("Baby teeth fall out as the adult teeth rise from inside the jaw.");
        await d.wait(3000);
      },
    },
    {
      id: "10",
      slug: "students",
      kicker: "Also for dental students",
      run: async ({ page, director: d }) => {
        await go(page, "/assess");
        await page.getByRole("heading", { name: "Choose a patient" }).waitFor({ timeout: 20000 });
        await d.say("For students: practise on AI patients", "Interview, examine in 3D, diagnose, and get marked like an OSCE.", {
          voice: "The same 3D mouth trains dental students. They interview A.I. patients, examine them in 3D, make a diagnosis, and get marked on six clinical skills.",
        });
        await d.wait(600);
      },
    },
    {
      id: "11",
      slug: "outro",
      kicker: "ToothTwin",
      run: async ({ page, director: d }) => {
        await go(page, "/");
        await d.wait(800);
        await d.card({
          index: "ToothTwin",
          title: "Know what's wrong.<br>Know what to do.",
          text: "Self-check in two minutes · your dental history · a care assistant · a report for your dentist · English and Roman Urdu.",
          voice:
            "Tooth Twin. Know what's wrong, know what to do, and walk into the dentist prepared. In plain words, and in your language.",
        });
      },
    },
  ],
};
