import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@^2.45.0";

// Set ALLOWED_ORIGIN to your site (e.g. https://d31universe.com) in production.
const ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

/** Service-role client (bypasses RLS) — only ever used inside edge functions. */
export function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}

/** Resolve the signed-in user from the request's Authorization header. */
export async function requireUser(req: Request): Promise<User | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

// Prices come from ./pricing.json — the SAME file the app reads (src/config/plans.ts).
import pricing from "./pricing.json" with { type: "json" };

export type Pass = { id: string; plan: string; days: number; paise: number };
export const PASSES: Record<string, Pass> = Object.fromEntries(
  pricing.passes.map((p: { id: string; plan: string; days: number; inr: number }) => [p.id, { id: p.id, plan: p.plan, days: p.days, paise: p.inr * 100 }]),
);
/** Legacy clients send { plan } → that plan's 30-day pass. */
export const LEGACY_PLAN_PASS: Record<string, string> = { pro: "pro_30", gold: "gold_30", platinum: "platinum_30", premium: "platinum_30" };
export const UNLOCK_PAISE: Record<string, number> = { video: pricing.unlocks.video.inr * 100, pdf: pricing.unlocks.pdf.inr * 100, pack: pricing.unlocks.pack.inr * 100 };
export const PACK_LIMITS = { videos: pricing.unlocks.pack.videos, pdfs: pricing.unlocks.pack.pdfs };
export const UNLOCK_KEY_RE = /^\d{1,6}:(video|pdf):\d{1,3}$/;
export const PLAN_ANALYSES: Record<string, number> = { ...pricing.analyses, premium: pricing.analyses.platinum, coaching: pricing.analyses.platinum };

/** Server-side check of what an unlock purchase may contain (never trust the browser). */
export function validUnlock(sku: string, items: unknown): string[] | null {
  if (!Array.isArray(items) || !items.length || items.length > PACK_LIMITS.videos + PACK_LIMITS.pdfs) return null;
  const keys = items.map(String);
  if (keys.some((k) => !UNLOCK_KEY_RE.test(k)) || new Set(keys).size !== keys.length) return null;
  const v = keys.filter((k) => k.split(":")[1] === "video").length, p = keys.length - v;
  if (sku === "video") return keys.length === 1 && v === 1 ? keys : null;
  if (sku === "pdf") return keys.length === 1 && p === 1 ? keys : null;
  if (sku === "pack") return v <= PACK_LIMITS.videos && p <= PACK_LIMITS.pdfs ? keys : null;
  return null;
}
