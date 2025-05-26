// File: functions/favorites/update.ts
export async function handleUpdateFavorite(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return json({
    message: "Missing favorite ID"
  }, 400);
  const now = new Date().toISOString();
  const payload = {
    ...rest,
    updated_at: now,
    updated_by: user.email
  };
  const { data, error } = await supabase.from("favorites").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return json(data);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
