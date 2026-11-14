/**
 * Supabase Edge Function: razorpay-verify
 * Verifies the Razorpay signature (or a wallet-only order), marks the payment paid,
 * then extends the membership, writes a Portal credit lot, claims a First 131 seat when
 * the order was discounted, and pays referral rewards on the friend's first purchase.
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

async function fulfill(db: ReturnType<typeof admin>, userId: string, pay: Record<string, unknown>) {
  const sku = String(pay.sku ?? "");
  const orderId = String(pay.razorpay_order_id ?? "");

  if (pay.plan === "postpass" || POST_PASSES[sku]) {
    const cfg = POST_PASSES[sku];
    if (!cfg) return { error: "Unknown Portal Pass" };
    const { error: pe } = await db.from("portal_credit_lots").insert({
      user_id: userId,
      pass_type: sku,
      hours: cfg.hours,
      credits: cfg.posts,
      remaining: cfg.posts,
      order_id: orderId,
    });
    if (pe) return { error: pe.message };
    await db.rpc("reward_referral_if_first", { uid: userId, oid: orderId });
    return { ok: true, pass: sku, credits: cfg.posts, hours: cfg.hours };
  }

  const { data: sub } = await db.from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
  const now = Date.now();
  const activeEnd = sub && sub.status === "active" && sub.current_period_end ? new Date(sub.current_period_end).getTime() : 0;
  const base = sub && sub.plan === pay.plan && activeEnd > now ? activeEnd : now;
  const plan = sub && activeEnd > now && RANK[sub.plan] > RANK[pay.plan as string] && sub.source === "razorpay" ? sub.plan : pay.plan;
  const days = Number(pay.days) > 0 ? Number(pay.days) : 30;
  const until = new Date(base + days * 86400000).toISOString();
  const { error } = await db.from("subscriptions").upsert({
    user_id: userId, plan, status: "active", source: "razorpay", current_period_end: until, updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  if (pay.founding_discount) await db.rpc("try_claim_founding", { uid: userId, oid: orderId });
  await db.rpc("reward_referral_if_first", { uid: userId, oid: orderId });
  return { ok: true, plan, until };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await requireUser(req);
    if (!user) return json({ error: "Please sign in first." }, 401);
    const body = (await req.json()) as Record<string, string>;
    const orderId = body.razorpay_order_id || body.orderId;
    if (!orderId) return json({ error: "Missing payment fields" }, 400);

    const db = admin();
    const { data: pay } = await db.from("payments").select("*").eq("razorpay_order_id", orderId).eq("user_id", user.id).maybeSingle();
    if (!pay) return json({ error: "Order not found for this user" }, 404);
    if (pay.status === "paid") return json({ ok: true, plan: pay.plan, alreadyProcessed: true });

    const walletOnly = Number(pay.amount_paise) === 0 && String(orderId).startsWith("wallet_");
    if (!walletOnly) {
      const { razorpay_payment_id, razorpay_signature } = body;
      if (!razorpay_payment_id || !razorpay_signature) return json({ error: "Missing payment fields" }, 400);
      const secret = Deno.env.get("RAZORPAY_KEY_SECRET");
      if (!secret) return json({ error: "Payments are not configured" }, 503);
      const expected = await hmacHex(secret, `${orderId}|${razorpay_payment_id}`);
      if (!safeEqual(expected, razorpay_signature)) return json({ error: "Signature verification failed" }, 400);
      await db.from("payments").update({ status: "paid", razorpay_payment_id, paid_at: new Date().toISOString() }).eq("id", pay.id);
    } else {
      await db.from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", pay.id);
    }

    const result = await fulfill(db, user.id, pay as Record<string, unknown>);
    if ("error" in result && result.error) return json({ error: result.error }, 500);
    return json(result);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
