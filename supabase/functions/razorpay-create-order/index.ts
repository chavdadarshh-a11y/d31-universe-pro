/**
 * Supabase Edge Function: razorpay-create-order
 * Creates a Razorpay order for a ONE-TIME pass (pro_30, gold_30, platinum_30/90/365) or an à-la-carte unlock
 * (video ₹19, pdf ₹9, pack ₹49 = up to 3 videos + 3 PDFs) or a Knowledge post pass
 * (1 post ₹21 / 24h, 3 posts ₹31 / 24h, 30 posts ₹331 / 7 days). Amounts come from _shared/pricing.json and are
 * DECIDED HERE, never by the browser. Nothing auto-renews.
 *
 * Secrets:  supabase secrets set RAZORPAY_KEY_ID=rzp_live_xxx RAZORPAY_KEY_SECRET=xxx
 * Deploy:   supabase functions deploy razorpay-create-order
 */
import { admin, corsHeaders, json, LEGACY_PLAN_PASS, PASSES, POST_PASSES, requireUser, UNLOCK_PAISE, validPostPassItems, validUnlock } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await requireUser(req);
    if (!user) return json({ error: "Please sign in first." }, 401);
    const body = (await req.json()) as { sku?: string; plan?: string; items?: unknown };
    const sku = body.sku ?? (body.plan ? LEGACY_PLAN_PASS[body.plan] : undefined);
    if (!sku) return json({ error: "Unknown item" }, 400);
    const pass = PASSES[sku];
    const postPass = POST_PASSES[sku];
    let amount: number, plan: string, items: unknown[] | null = null, days = 0;
    if (pass) {
      amount = pass.paise; plan = pass.plan; days = pass.days;
    } else if (postPass) {
      const posts = validPostPassItems(sku, body.items);
      if (!posts) return json({ error: "Pick a valid Knowledge post" }, 400);
      amount = postPass.paise; plan = "postpass"; items = posts; days = Math.max(1, Math.round(postPass.hours / 24));
    } else if (UNLOCK_PAISE[sku]) {
      items = validUnlock(sku, body.items);
      if (!items) return json({ error: "Pick valid items to unlock" }, 400);
      amount = UNLOCK_PAISE[sku]; plan = `unlock_${sku}`;
    } else return json({ error: "Unknown item" }, 400);

    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) return json({ error: "Payments are not configured yet (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)." }, 503);

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Basic " + btoa(`${keyId}:${keySecret}`) },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt: `d31_${sku}_${Date.now()}`.slice(0, 40),
        notes: { user_id: user.id, sku },
      }),
    });
    const order = await res.json();
    if (!res.ok) return json({ error: order?.error?.description ?? "Razorpay order failed" }, 502);

    const { error } = await admin().from("payments").insert({ user_id: user.id, plan, sku, days, items, amount_paise: amount, razorpay_order_id: order.id, status: "created" });
    if (error) return json({ error: error.message }, 500);

    return json({ orderId: order.id, amount, currency: "INR", keyId });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
