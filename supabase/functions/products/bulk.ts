// File: functions/products/bulk.ts
export async function handleBulkCreateProducts(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  if (!Array.isArray(body)) throw new Error("Expected array of product objects");
  const timestamp = new Date().toISOString();
  const data = body.map((p)=>({
      ...p,
      created_at: timestamp,
      updated_at: timestamp,
      created_by: user.email,
      updated_by: user.email,
      is_deleted: false,
      is_banned: false
    }));
  const { data: inserted, error } = await supabase.from("products").insert(data).select();
  if (error) throw error;
  return json(inserted, 201);
}
export async function handleBulkDeleteProducts(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  if (!Array.isArray(body)) throw new Error("Expected array of product IDs");
  const { data, error } = await supabase.from("products").update({
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by: user.id
  }).in("id", body).select();
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
