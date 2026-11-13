/**
 * Supabase Edge Function: delete-account
 * Deletes the signed-in user's progress photos from storage and then the auth user.
 * All app tables reference auth.users(id) ON DELETE CASCADE, so their rows go with it.
 * (Play Store requires an in-app way to delete the account.)
 */
import { admin, corsHeaders, json, requireUser } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await requireUser(req);
    if (!user) return json({ error: "Not signed in" }, 401);
    const db = admin();
    const { data: files } = await db.storage.from("progress-photos").list(user.id, { limit: 1000 });
    if (files?.length) await db.storage.from("progress-photos").remove(files.map((f) => `${user.id}/${f.name}`));
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
