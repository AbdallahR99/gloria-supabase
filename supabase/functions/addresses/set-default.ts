// File: functions/addresses/set-default.ts
export async function handleSetDefaultAddress(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { address_id, user_id: customUserId } = body;
  if (!address_id) return json({
    message: "Missing address_id"
  }, 400);
  const userId = customUserId ?? user.id;
  await supabase.from("addresses").update({
    is_default: false
  }).eq("user_id", userId);
  const { data, error } = await supabase.from("addresses").update({
    is_default: true
  }).eq("id", address_id).eq("user_id", userId).select().single();
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
