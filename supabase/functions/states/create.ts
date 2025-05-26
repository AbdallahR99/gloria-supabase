// File: functions/states/create.ts
export async function handleCreateState(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { country_id, name_ar, name_en, code, delivery_fee } = body;
  if (!country_id || !name_ar || !name_en || !code) {
    return json({
      message: "Missing required fields"
    }, 400);
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("states").insert({
    country_id,
    name_ar,
    name_en,
    code,
    delivery_fee: delivery_fee ?? 0,
    is_deleted: false,
    created_at: now,
    updated_at: now,
    created_by: user.email,
    updated_by: user.email
  }).select().single();
  if (error) throw error;
  return json(data, 201);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
