// File: functions/reviews/delete.ts
export async function handleDeleteReview(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { id } = body;
  if (!id) return json({
    message: "Missing review ID"
  }, 400);
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("reviews").update({
    is_deleted: true,
    deleted_at: now,
    deleted_by: user.email,
    updated_at: now,
    updated_by: user.email
  }).eq("id", id).select().single();
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
