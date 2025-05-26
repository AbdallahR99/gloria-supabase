// File: functions/cart/count.ts
export async function handleCartCount(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const { count, error } = await supabase.from("cart_items") // Fixed: was "cart", should be "cart_items"
  .select("id", {
    count: "exact",
    head: true
  }).eq("user_id", user.id).eq("is_deleted", false);
  if (error) throw error;
  return json({
    count: count ?? 0 // Added fallback to 0 if count is null
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
