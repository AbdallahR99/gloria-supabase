// File: functions/states/bulk.ts
export async function handleBulkCreateStates(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  if (!Array.isArray(body)) return json({
    message: "Expected array of states"
  }, 400);
  const now = new Date().toISOString();
  const entries = body.map((s)=>({
      ...s,
      delivery_fee: s.delivery_fee ?? 0,
      is_deleted: false,
      created_at: now,
      updated_at: now,
      created_by: user.email,
      updated_by: user.email
    }));
  const { data, error } = await supabase.from("states").insert(entries).select();
  if (error) throw error;
  return json({
    data
  }, 201);
}
export async function handleBulkDeleteStates(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  if (!Array.isArray(body)) return json({
    message: "Expected array of state IDs"
  }, 400);
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("states").update({
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
