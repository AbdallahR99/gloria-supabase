// File: functions/cart/delete.ts
export async function handleDeleteCartItem(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { product_id, size, color, user_id: customUserId } = body;
  if (!product_id) {
    return json({
      message: "Missing required field: product_id"
    }, 400);
  }
  const userId = customUserId ?? user.id;
  const now = new Date().toISOString();
  let query = supabase.from("cart").select("id").eq("user_id", userId).eq("product_id", product_id).eq("is_deleted", false);
  if (size != null) query = query.eq("size", size);
  if (color != null) query = query.eq("color", color);
  const { data: existing, error: fetchError } = await query.maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing) return json({
    message: "Cart item not found or already deleted"
  }, 404);
  const { data, error: updateError } = await supabase.from("cart").update({
    is_deleted: true,
    deleted_at: now,
    deleted_by: user.id,
    updated_at: now,
    updated_by: user.id
  }).eq("id", existing.id).select().single();
  if (updateError) throw updateError;
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
