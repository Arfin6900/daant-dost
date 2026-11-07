# ToothTwin demo video

A scripted, narrated 1080p walkthrough recorded from the real app, voiced by **Kokoro**
(runs locally, free). Captions, cursor, spotlights and title cards are drawn in the page.

    cd demo-video && npm install
    npm run dev            # in the repo root: the app on :5173 (with DASHSCOPE_API_KEY for the AI)
    REHEARSE=1 node record.mjs   # dry run; also generates and caches every voice line
    node record.mjs              # the take → output/ToothTwin-demo.mp4 (~6 min)

- The story is in `story.mjs` (chapters, captions and spoken lines).
- `VOICE=af_heart` (default) picks the Kokoro voice; `VOICE_SPEED=0.95` slows it.
- `PDF_PYTHON` points at a Python with `pypdfium2`, used to show the exported PDF on screen.
- Don't edit `server/` during a take: the API restarts and the case disappears mid-video.
