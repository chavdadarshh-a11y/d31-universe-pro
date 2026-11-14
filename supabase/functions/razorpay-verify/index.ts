/**
 * Supabase Edge Function: razorpay-verify
 * Verifies the Razorpay signature (HMAC-SHA256 of "order_id|payment_id" with the key secret),
 * marks the payment paid, then either extends the membership by the pass length (30/90/365 days, one-time)
 * or writes the bought items to user_unlocks (forever, every language),
 * or writes a user_post_passes row (time-limited Knowledge post access, view/stream only).
 */
import { admin, corsHeaders, json, POST_PASSES, requireUser } from "../_shared/http.ts";

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const RANK: Record<string, number> = { free: 0, pro: 1, gold: 2, platinum: 3, premium: 3, coaching: 3 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await requireUser(req);
    if (!user) return json({ error: "Please sign in first." }, 401);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = (await req.json()) as Record<string, string>;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return json({ error: "Missing payment fields" }, 400);

    const secret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!secret) return json({ error: "Payments are not configured" }, 503);
    const expected = await hmacHex(secret, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (!safeEqual(expected, razorpay_signature)) return json({ error: "Signature verification failed" }, 400);

    const db = admin();
    const { data: pay } = await db.from("payments").select("*").eq("razorpay_order_id", razorpay_order_id).eq("user_id", user.id).maybeSingle();
    if (!pay) return json({ error: "Order not found for this user" }, 404);
    if (pay.status === "paid") return json({ ok: true, plan: pay.plan, alreadyProcessed: true });

    await db.from("payments").update({ status: "paid", razorpay_payment_id, paid_at: new Date().toISOString() }).eq("id", pay.id);

    // Knowledge post pass → time-limited row in user_post_passes (view/stream only)
    if (pay.plan === "postpass" || (pay.sku && POST_PASSES[pay.sku])) {
      const cfg = POST_PASSES[pay.sku];
      if (!cfg) return json({ error: "Unknown post pass" }, 400);
      const postIds = ((pay.items ?? []) as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 999999);
      const expires = new Date(Date.now() + cfg.hours * 3600_000).toISOString();
      const { error: pe } = await db.from("user_post_passes").insert({
        user_id: user.id,
        pass_type: pay.sku,
        post_ids: postIds,
        expires_at: expires,
        order_id: razorpay_order_id,
      });
      if (pe) return json({ error: pe.message }, 500);
      return json({ ok: true, pass: pay.sku, expires_at: expires, post_ids: postIds });
    }

    // à-la-carte unlock → permanent rows in user_unlocks
    if (typeof pay.plan === "string" && pay.plan.startsWith("unlock_")) {
      const rows = ((pay.items ?? []) as string[]).map((k) => ({ user_id: user.id, item_key: k, kind: k.split(":")[1], order_id: razorpay_order_id }));
      const { error: ue } = await db.from("user_unlocks").upsert(rows, { onConflict: "user_id,item_key" });
      if (ue) return json({ error: ue.message }, 500);
      return json({ ok: true, unlocked: rows.map((r) => r.item_key) });
    }

    // extend if renewing the same plan while still active; otherwise start fresh from now
    const { data: sub } = await db.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
    const now = Date.now();
    const activeEnd = sub && sub.status === "active" && sub.current_period_end ? new Date(sub.current_period_end).getTime() : 0;
    const base = sub && sub.plan === pay.plan && activeEnd > now ? activeEnd : now;
    const plan = sub && activeEnd > now && RANK[sub.plan] > RANK[pay.plan] && sub.source === "razorpay" ? sub.plan : pay.plan;
    const days = Number(pay.days) > 0 ? Number(pay.days) : 30;
    const until = new Date(base + days * 86400000).toISOString();
    const { error } = await db.from("subscriptions").upsert({ user_id: user.id, plan, status: "active", source: "razorpay", current_period_end: until, updated_at: new Date().toISOString() });
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, plan, until });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
