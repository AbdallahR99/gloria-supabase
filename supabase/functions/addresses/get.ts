// File: functions/addresses/get.ts
export async function handleGetAddresses(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const url = new URL(req.url);
  const userIdParam = url.searchParams.get("user_id");
  const addressId = url.searchParams.get("address_id");
  const finalUserId = userIdParam ?? user.id;
  let query = supabase.from("addresses").select("*, state:states(id, code, name_ar, name_en, delivery_fee)").eq("user_id", finalUserId).eq("is_deleted", false);
  if (addressId) {
    query = query.eq("id", addressId).maybeSingle();
    const { data, error } = await query;
    if (error || !data) throw error ?? new Error("Address not found");
    return json({
      ...data,
      state: data.state?.id ?? null,
      state_code: data.state?.code ?? null,
      state_nameAr: data.state?.name_ar ?? null,
      state_nameEn: data.state?.name_en ?? null,
      delivery_fee: data.state?.delivery_fee ?? 0
    });
  }
  const { data, error } = await query.order("is_default", {
    ascending: false
  }).order("created_at", {
    ascending: false
  });
  if (error) throw error;
  const result = data.map((address)=>({
      ...address,
      state: address.state?.id ?? null,
      state_code: address.state?.code ?? null,
      state_nameAr: address.state?.name_ar ?? null,
      state_nameEn: address.state?.name_en ?? null,
      delivery_fee: address.state?.delivery_fee ?? 0
    }));
  return json(result);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
