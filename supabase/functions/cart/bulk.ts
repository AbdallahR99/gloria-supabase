// File: functions/cart/bulk.ts
export async function handleBulkCreateCartItems(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  if (!Array.isArray(body)) return json({
    message: "Expected array of cart items"
  }, 400);
  const now = new Date().toISOString();
  const entries = body.map((item)=>({
      ...item,
      user_id: item.user_id ?? user.id,
      created_at: now,
      updated_at: now,
      created_by: user.id,
      updated_by: user.id,
      is_deleted: false
    }));
  const { data, error } = await supabase.from("cart").insert(entries).select();
  if (error) throw error;
  return json({
    data
  }, 201);
}
export async function handleBulkDeleteCartItems(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  if (!Array.isArray(body)) return json({
    message: "Expected array of cart IDs"
  }, 400);
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("cart").update({
    is_deleted: true,
    deleted_at: now,
    deleted_by: user.id,
    updated_at: now,
    updated_by: user.id
  }).in("id", body).select();
  if (error) throw error;
  return json({
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
