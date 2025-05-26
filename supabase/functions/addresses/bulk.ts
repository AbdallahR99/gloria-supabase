// File: functions/addresses/bulk.ts
export async function handleBulkCreateAddresses(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  if (!Array.isArray(body)) return json({
    message: "Expected array of addresses"
  }, 400);
  const now = new Date().toISOString();
  const items = body.map((addr)=>({
      ...addr,
      user_id: addr.user_id ?? user.id,
      created_at: now,
      updated_at: now,
      created_by: user.email,
      updated_by: user.email,
      is_deleted: false
    }));
  const { data, error } = await supabase.from("addresses").insert(items).select();
  if (error) throw error;
  return json({
    data
  }, 201);
}
export async function handleBulkDeleteAddresses(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  if (!Array.isArray(body)) return json({
    message: "Expected array of address IDs"
  }, 400);
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("addresses").update({
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
