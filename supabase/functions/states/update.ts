// File: functions/states/update.ts
export async function handleUpdateState(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { id, name_ar, name_en, code, delivery_fee } = body;
  if (!id) return json({
    message: "Missing state ID"
  }, 400);
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("states").update({
    name_ar,
    name_en,
    code,
    delivery_fee,
    updated_at: now,
    updated_by: user.email
  }).eq("id", id).select().single();
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
