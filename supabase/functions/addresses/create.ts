// File: functions/addresses/create.ts
export async function handleCreateAddress(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { user_id: customUserId, label, first_name, last_name, phone, city, state, area, street, building, apartment, notes, is_default } = body;
  if (!label || !first_name || !last_name || !phone || !city || !state) {
    return json({
      message: "Missing required fields"
    }, 400);
  }
  const userId = customUserId ?? user.id;
  const now = new Date().toISOString();
  // 🔍 Check if user already has addresses
  const { count, error: countError } = await supabase.from("addresses").select("*", {
    count: "exact",
    head: true
  }).eq("user_id", userId).eq("is_deleted", false);
  if (countError) throw countError;
  const shouldBeDefault = count === 0 ? true : is_default;
  if (shouldBeDefault) {
    await supabase.from("addresses").update({
      is_default: false
    }).eq("user_id", userId).eq("is_deleted", false);
  }
  const { data, error } = await supabase.from("addresses").insert({
    user_id: userId,
    label,
    first_name,
    last_name,
    phone,
    city,
    state,
    area,
    street,
    building,
    apartment,
    notes,
    is_default: shouldBeDefault,
    created_at: now,
    updated_at: now,
    created_by: user.email || user.phone || user.id,
    updated_by: user.email || user.phone || user.id,
    is_deleted: false
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
