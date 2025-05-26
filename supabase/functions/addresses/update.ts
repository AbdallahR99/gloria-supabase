// File: functions/addresses/update.ts
export async function handleUpdateAddress(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { id, user_id: customUserId, title, city, area, street, building, apartment, floor, instructions, latitude, longitude, is_default } = body;
  if (!id) return json({
    message: "Missing address ID"
  }, 400);
  const userId = customUserId ?? user.id;
  const now = new Date().toISOString();
  if (is_default) {
    await supabase.from("addresses").update({
      is_default: false
    }).eq("user_id", userId);
  }
  const { data, error } = await supabase.from("addresses").update({
    title,
    city,
    area,
    street,
    building,
    apartment,
    floor,
    instructions,
    latitude,
    longitude,
    is_default,
    updated_at: now,
    updated_by: user.email
  }).eq("id", id).eq("user_id", userId).select().single();
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
