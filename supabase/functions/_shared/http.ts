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

export const PLAN_PRICES_PAISE: Record<string, number> = { pro: 14900, premium: 49900, coaching: 149900 };
export const PLAN_ANALYSES: Record<string, number> = { free: 3, pro: 30, premium: 100, coaching: 300 };
