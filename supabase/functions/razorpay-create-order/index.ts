/**
 * Supabase Edge Function: razorpay-create-order
 * Creates a Razorpay order for a 1-month pass. The AMOUNT IS DECIDED HERE, never by the browser.
 *
 * Secrets:  supabase secrets set RAZORPAY_KEY_ID=rzp_live_xxx RAZORPAY_KEY_SECRET=xxx
 * Deploy:   supabase functions deploy razorpay-create-order
 */
import { admin, corsHeaders, json, PLAN_PRICES_PAISE, requireUser } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await requireUser(req);
    if (!user) return json({ error: "Please sign in first." }, 401);
    const { plan } = (await req.json()) as { plan?: string };
    const amount = plan ? PLAN_PRICES_PAISE[plan] : undefined;
    if (!plan || !amount) return json({ error: "Unknown plan" }, 400);

    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) return json({ error: "Payments are not configured yet (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)." }, 503);

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Basic " + btoa(`${keyId}:${keySecret}`) },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt: `d31_${plan}_${Date.now()}`.slice(0, 40),
        notes: { user_id: user.id, plan },
      }),
    });
    const order = await res.json();
    if (!res.ok) return json({ error: order?.error?.description ?? "Razorpay order failed" }, 502);

    const { error } = await admin().from("payments").insert({ user_id: user.id, plan, amount_paise: amount, razorpay_order_id: order.id, status: "created" });
    if (error) return json({ error: error.message }, 500);

    return json({ orderId: order.id, amount, currency: "INR", keyId });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
