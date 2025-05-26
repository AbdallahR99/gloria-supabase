// File: functions/addresses/delete.ts
export async function handleDeleteAddress(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { address_id, user_id: customUserId } = body;
  if (!address_id) return json({
    message: "Missing address_id"
  }, 400);
  const userId = customUserId ?? user.id;
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("addresses").update({
    is_deleted: true,
    deleted_at: now,
    deleted_by: user.email
  }).eq("id", address_id).eq("user_id", userId).select().single();
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
