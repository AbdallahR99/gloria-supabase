// File: functions/cart/update.ts
export async function handleUpdateCartItem(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { id, size, color } = body;
  const quantity = body.quantity ?? 1;
  if (!id || !quantity) return json({
    message: "Missing cart item ID or quantity"
  }, 400);
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("cart").update({
    quantity,
    size,
    color,
    updated_at: now,
    updated_by: user.id
  }).eq("id", id).select().single();
  if (error) throw error;
  return json({
    status: "updated",
    data
  });
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
