// File: functions/cart/create.ts
export async function handleCreateCartItem(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { product_id, size, color, user_id: customUserId } = body;
  const quantity = body.quantity ?? 1;
  if (!product_id || !quantity) return json({
    message: "Missing required fields"
  }, 400);
  const userId = customUserId ?? user.id;
  const now = new Date().toISOString();
  const insertData = {
    user_id: userId,
    product_id,
    quantity,
    created_at: now,
    updated_at: now,
    created_by: user.id,
    updated_by: user.id
  };
  if (size != null) insertData.size = size;
  if (color != null) insertData.color = color;
  const { error } = await supabase.from("cart").insert(insertData);
  if (error) throw error;
  return json({
    status: "added"
  }, 201);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
