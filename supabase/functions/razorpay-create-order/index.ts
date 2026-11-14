/**
 * Supabase Edge Function: razorpay-create-order
 * Creates a Razorpay order for a ONE-TIME membership pass (pro/gold/platinum 30 or 365 days)
 * or a Portal Pass credit pack (post_1 / post_3 / post_30). Amounts come from _shared/pricing.json
 * and are DECIDED HERE, never by the browser. Nothing auto-renews.
 *
 * Optional body.wallet: apply the member's wallet (referral credits) up to the price.
 * Founding 25% off is applied server-side when the member is a First 131 member (or a seat remains
 * and this is a membership purchase). À-la-carte unlocks are no longer offered.
 *
 * Secrets:  supabase secrets set RAZORPAY_KEY_ID=rzp_live_xxx RAZORPAY_KEY_SECRET=xxx
 * Deploy:   supabase functions deploy razorpay-create-order
 */
import { admin, corsHeaders, FOUNDING_CAP, foundingPriceInr, json, LEGACY_PLAN_PASS, PASSES, POST_PASSES, requireUser, UNLOCKS_OFFERED, validPostPassItems } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await requireUser(req);
    if (!user) return json({ error: "Please sign in first." }, 401);
    const body = (await req.json()) as { sku?: string; plan?: string; items?: unknown; wallet?: boolean };
    const sku = body.sku ?? (body.plan ? LEGACY_PLAN_PASS[body.plan] : undefined);
    if (!sku) return json({ error: "Unknown item" }, 400);
    const pass = PASSES[sku];
    const postPass = POST_PASSES[sku];
    let amountInr: number, plan: string, items: unknown[] | null = null, days = 0;
    if (pass) {
      amountInr = pass.paise / 100; plan = pass.plan; days = pass.days;
    } else if (postPass) {
      const posts = validPostPassItems(sku, body.items ?? []);
      if (!posts) return json({ error: "Invalid Portal Pass" }, 400);
      amountInr = postPass.paise / 100; plan = "postpass"; items = posts; days = 0;
    } else if (!UNLOCKS_OFFERED) {
      return json({ error: "Single-item unlocks have been replaced by Portal Pass credits." }, 400);
    } else return json({ error: "Unknown item" }, 400);

    const db = admin();
    let founding = false;
    if (pass) {
      const { data: already } = await db.rpc("is_founding_member", { uid: user.id });
      if (already === true) {
        const { data: sub } = await db.from("subscriptions").select("status, current_period_end").eq("user_id", user.id).maybeSingle();
        const end = sub?.current_period_end ? new Date(sub.current_period_end).getTime() : 0;
        const graceMs = 10 * 3600_000; // widest grace window; exact hours are applied in the app
        const activeOrGrace = sub?.status === "active" && end + graceMs > Date.now();
        if (activeOrGrace || !sub?.current_period_end) { amountInr = foundingPriceInr(amountInr); founding = true; }
      } else {
        const { data: n } = await db.rpc("founding_claimed_count");
        if (typeof n === "number" && n < FOUNDING_CAP) { amountInr = foundingPriceInr(amountInr); founding = true; }
      }
    }

    // Return any wallet hold from an earlier unpaid order, then optionally apply the wallet.
    const { data: holds } = await db.from("payments").select("id, wallet_inr, razorpay_order_id").eq("user_id", user.id).eq("status", "created").gt("wallet_inr", 0);
    for (const h of holds ?? []) {
      if (h.wallet_inr > 0) await db.rpc("wallet_apply", { uid: user.id, amount_inr: h.wallet_inr, reason: "wallet_release", ref: h.razorpay_order_id });
      await db.from("payments").update({ wallet_inr: 0 }).eq("id", h.id);
    }

    let walletInr = 0;
    if (body.wallet) {
      const { data: bal } = await db.rpc("wallet_balance", { uid: user.id });
      const available = typeof bal === "number" ? bal : 0;
      walletInr = Math.min(available, Math.round(amountInr));
      if (walletInr > 0) {
        const r = await db.rpc("wallet_apply", { uid: user.id, amount_inr: -walletInr, reason: "checkout", ref: `hold:${sku}` });
        if (!(r.data as { ok?: boolean } | null)?.ok) walletInr = 0;
      }
    }

    const chargeInr = Math.max(0, Math.round(amountInr) - walletInr);
    const amount = chargeInr * 100;

    if (amount === 0) {
      const orderId = `wallet_${crypto.randomUUID()}`;
      const { error } = await db.from("payments").insert({
        user_id: user.id, plan, sku, days, items, amount_paise: 0, wallet_inr: walletInr,
        founding_discount: founding, razorpay_order_id: orderId, status: "created",
      });
      if (error) return json({ error: error.message }, 500);
      return json({ orderId, amount: 0, currency: "INR", keyId: "", paidWithWallet: true, founding });
    }

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
        notes: { user_id: user.id, sku, wallet_inr: String(walletInr), founding: founding ? "1" : "0" },
      }),
    });
    const order = await res.json();
    if (!res.ok) return json({ error: order?.error?.description ?? "Razorpay order failed" }, 502);

    const { error } = await db.from("payments").insert({
      user_id: user.id, plan, sku, days, items, amount_paise: amount, wallet_inr: walletInr,
      founding_discount: founding, razorpay_order_id: order.id, status: "created",
    });
    if (error) return json({ error: error.message }, 500);

    return json({ orderId: order.id, amount, currency: "INR", keyId, founding, walletInr });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
