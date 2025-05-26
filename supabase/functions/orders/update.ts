// File: functions/orders/update.ts
export async function handleUpdateOrder(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { id, ...updateData } = body;
  if (!id) return json({
    message: "Missing order ID"
  }, 400);
  updateData.updated_at = new Date().toISOString();
  updateData.updated_by = user.email;
  const { data, error } = await supabase.from("orders").update(updateData).eq("id", id).select().single();
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
