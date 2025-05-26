// File: functions/categories/bulk.ts
export async function handleBulkCreateCategories(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  if (!Array.isArray(body)) return json({
    message: "Expected array of category objects"
  }, 400);
  const now = new Date().toISOString();
  const payload = body.map((c)=>({
      ...c,
      created_at: now,
      updated_at: now,
      created_by: user.email,
      updated_by: user.email,
      is_deleted: false
    }));
  const { data, error } = await supabase.from("categories").insert(payload).select();
  if (error) throw error;
  return json({
    data
  }, 201);
}
export async function handleBulkDeleteCategories(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  if (!Array.isArray(body)) return json({
    message: "Expected array of category IDs"
  }, 400);
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("categories").update({
    is_deleted: true,
    deleted_at: now,
    deleted_by: user.email,
    updated_at: now,
    updated_by: user.email
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
