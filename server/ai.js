import { z } from "zod/v4";

// One door to the AI: Qwen on Alibaba DashScope, through its OpenAI-compatible
// endpoint. Every caller has a non-AI fallback, so the app keeps working
// without a key or when the API is slow, busy or out of quota.

const BASE_URL = (process.env.QWEN_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1").replace(/\/+$/, "");

// Tried in order. The account is on the free tier, where each model has its own
// quota: when one is spent or rate-limited the next one answers.
const FALLBACK_MODELS = ["qwen3.7-plus", "qwen-max", "qwen3.5-plus-2026-02-15", "qwen-flash"];
export const MODEL = process.env.AI_MODEL || FALLBACK_MODELS[0];
const MODELS = [MODEL, ...FALLBACK_MODELS.filter((m) => m !== MODEL)];

const apiKey = () => process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY || "";
export const aiEnabled = () => Boolean(apiKey()) && process.env.AI_DISABLED !== "1";

export class AiUnavailable extends Error {
  constructor(reason, cause) {
    super(`AI unavailable: ${reason}`);
    this.reason = reason;
    this.cause = cause;
  }
}

// Worth trying the next model: this one's quota is spent or it is rate-limited.
// Never for a bad key or a bad request.
export const tryNextModel = (status, body) =>
  status === 429 ||
  (/FreeTierOnly|AllocationQuota|Arrearage|quota|limit_requests|exhausted|model_not_found|does not exist/i.test(String(body)) &&
    !/InvalidApiKey/i.test(String(body)));

// The first {...} block in the reply, parsed. Models sometimes wrap JSON in prose or fences.
export const extractJson = (text) => {
  const raw = String(text || "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end <= start) return undefined;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
};

const EFFORT_TEMPERATURE = { low: 0.4, medium: 0.3, high: 0.2 };
const TIMEOUT_MS = 45_000;

const chat = async (model, messages, { maxTokens, temperature }) => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      enable_thinking: false,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
};

// Walks the model list until one answers. Returns the reply text.
const complete = async (messages, opts) => {
  let last;
  for (const model of MODELS) {
    let r;
    try {
      r = await chat(model, messages, opts);
    } catch (err) {
      throw new AiUnavailable("upstream", err);
    }
    if (r.ok) {
      const data = JSON.parse(r.body);
      const choice = data?.choices?.[0];
      if (choice?.finish_reason === "content_filter") throw new AiUnavailable("refusal");
      return { text: choice?.message?.content || "", model, usage: data?.usage };
    }
    last = r;
    console.warn(`[ai] ${model} ${r.status} ${r.body.slice(0, 160)}`);
    if (!tryNextModel(r.status, r.body)) break;
  }
  throw new AiUnavailable("upstream", new Error(`${last?.status} ${last?.body?.slice(0, 300)}`));
};

// Asks for an object matching `schema` (a zod/v4 schema). Throws AiUnavailable.
// Qwen's JSON mode guarantees JSON, not the shape, so the schema goes in the
// prompt and the answer is checked; one retry shows the model what was wrong.
export const askJson = async ({ system, prompt, schema, effort = "low", maxTokens = 4000 }) => {
  if (!aiEnabled()) throw new AiUnavailable("disabled");
  const started = Date.now();
  const jsonSchema = JSON.stringify(z.toJSONSchema(schema));
  const messages = [
    {
      role: "system",
      content: `${system}\n\nReply with ONE JSON object only (no markdown, no prose) that matches this JSON Schema:\n${jsonSchema}`,
    },
    { role: "user", content: prompt },
  ];
  const opts = { maxTokens: Math.min(maxTokens, 8000), temperature: EFFORT_TEMPERATURE[effort] ?? 0.3 };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { text, model, usage } = await complete(messages, opts);
    const parsed = schema.safeParse(extractJson(text));
    if (parsed.success) {
      console.log(`[ai] ${model} ${effort} ${Date.now() - started}ms in=${usage?.prompt_tokens} out=${usage?.completion_tokens}`);
      return parsed.data;
    }
    messages.push(
      { role: "assistant", content: text.slice(0, 6000) },
      {
        role: "user",
        content: `That did not match the schema: ${parsed.error.issues
          .slice(0, 6)
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("; ")}. Reply again with the corrected JSON object only.`,
      },
    );
  }
  throw new AiUnavailable("unparseable");
};
