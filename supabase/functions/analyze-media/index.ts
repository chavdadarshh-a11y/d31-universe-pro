/**
 * Supabase Edge Function: analyze-media
 * D31 Core Engine form analysis. GEMINI_API_KEY lives here (Deno.env) — never in the browser.
 *
 * POST { media: [{ mediaBase64, mimeType }] (1–5), userPrompt, exerciseId?, postContent? }
 *   (legacy single-file shape { mediaBase64, mimeType, userPrompt } still works)
 * Requires a signed-in user; enforces the monthly analysis quota of their plan.
 *
 * Deploy:
 *   supabase secrets set GEMINI_API_KEY=...            # required
 *   supabase secrets set GEMINI_MODEL=gemini-2.5-flash # optional
 *   supabase functions deploy analyze-media
 */
import { GoogleGenAI } from "npm:@google/genai@^1.0.0";
import { D31_CORE_ENGINE_PROMPT, INLINE_BASE64_MAX_BYTES } from "../_shared/d31CoreEngine.ts";
import { admin, corsHeaders, json, PLAN_ANALYSES, requireUser } from "../_shared/http.ts";

type Media = { mediaBase64: string; mimeType: string };
type PostContent = { summary?: string; technique?: string; biomechanics?: string; coaching?: string; post_id?: string; title?: string; layer?: string; core_skill?: string };

const MAX_FILES = 5;

function buildExtraKnowledge(post?: PostContent): string | undefined {
  if (!post) return undefined;
  return [
    post.post_id && `post_id: ${post.post_id}`, post.title && `title: ${post.title}`, post.layer && `layer: ${post.layer}`,
    post.core_skill && `core_skill: ${post.core_skill}`, post.summary && `summary: ${post.summary}`, post.technique && `technique: ${post.technique}`,
    post.biomechanics && `biomechanics: ${post.biomechanics}`, post.coaching && `coaching: ${post.coaching}`,
  ].filter(Boolean).join("\n");
}

/**
 * Darshan's analyzeMovementMedia — prompt text unchanged; now accepts several media parts.
 * Large payloads (> ~20 MB total) are sent through the Gemini Files API.
 */
export async function analyzeMovementMedia(media: Media[], userPrompt: string, extraKnowledge?: string): Promise<{ text: string; model: string }> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY secret not configured");
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  const ai = new GoogleGenAI({ apiKey });

  const totalBytes = media.reduce((n, m) => n + Math.ceil((m.mediaBase64.length * 3) / 4), 0);
  const parts: unknown[] = [];
  if (totalBytes > INLINE_BASE64_MAX_BYTES * 0.9) {
    for (const m of media) {
      const bin = Uint8Array.from(atob(m.mediaBase64), (c) => c.charCodeAt(0));
      const up = (await ai.files.upload({ file: new Blob([bin], { type: m.mimeType }), config: { mimeType: m.mimeType } })) as { uri?: string; name?: string };
      parts.push({ fileData: { fileUri: up.uri ?? up.name ?? "", mimeType: m.mimeType } });
    }
  } else {
    for (const m of media) parts.push({ inlineData: { data: m.mediaBase64, mimeType: m.mimeType } });
  }

  const promptText = D31_CORE_ENGINE_PROMPT + userPrompt +
    (extraKnowledge ? `\n\n── ADDITIONAL D31 POST CONTEXT (appended; does not alter Core Engine wording) ──\n${extraKnowledge}` : "") +
    "\n\nWrite in short, plain sentences an everyday gym-goer understands. Each section: 1–3 sentences or up to 3 bullet points.";

  // deno-lint-ignore no-explicit-any
  const response = await ai.models.generateContent({ model, contents: [...(parts as any[]), { text: promptText }] });
  return { text: response.text ?? "", model };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const user = await requireUser(req);
    if (!user) return json({ error: "Please sign in to run form analysis." }, 401);

    const body = (await req.json()) as { media?: Media[]; mediaBase64?: string; mimeType?: string; userPrompt?: string; exerciseId?: string | null; postContent?: PostContent };
    const media: Media[] = body.media?.length ? body.media : body.mediaBase64 && body.mimeType ? [{ mediaBase64: body.mediaBase64, mimeType: body.mimeType }] : [];
    if (!media.length) return json({ error: "Add at least one photo or video." }, 400);
    if (media.length > MAX_FILES) return json({ error: `Up to ${MAX_FILES} files per analysis.` }, 400);
    if (media.some((m) => !/^(image|video)\//.test(m.mimeType))) return json({ error: "Only images and videos are supported." }, 400);

    // quota
    const db = admin();
    const { data: planRow } = await db.rpc("current_plan", { uid: user.id });
    const plan = (planRow as string) ?? "free";
    const limit = PLAN_ANALYSES[plan] ?? 3;
    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
    const { count } = await db.from("form_analyses").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", monthStart);
    const used = count ?? 0;
    if (used >= limit) return json({ error: `Monthly limit reached (${limit} on ${plan}). Upgrade for more form checks.`, remaining: 0 }, 402);

    const prompt = (body.userPrompt ?? "form check").slice(0, 1000);
    const { text, model } = await analyzeMovementMedia(media, prompt, buildExtraKnowledge(body.postContent));
    if (!text.trim()) return json({ error: "The AI returned an empty answer. Try a clearer, well-lit side view." }, 502);

    await db.from("form_analyses").insert({ user_id: user.id, exercise_id: body.exerciseId ?? null, prompt, result: text, model });
    return json({ analysis: text, remaining: Math.max(0, limit - used - 1) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[analyze-media]", message);
    return json({ error: message }, 500);
  }
});
