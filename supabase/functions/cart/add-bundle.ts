// File: functions/cart/add-bundle.ts
export async function handleAddBundleToCart(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { bundle_id, user_id: customUserId } = body;
  if (!bundle_id) return json({
    message: "Missing bundle_id"
  }, 400);
  const userId = customUserId ?? user.id;
  const now = new Date().toISOString();
  const { data: bundleItems, error: fetchError } = await supabase.from("product_bundles").select("product_id").eq("bundle_id", bundle_id);
  if (fetchError) throw fetchError;
  if (!bundleItems?.length) return json({
    message: "No products in bundle."
  }, 400);
  const entries = bundleItems.map(({ product_id })=>({
      user_id: userId,
      product_id,
      quantity: 1,
      created_at: now,
      updated_at: now,
      created_by: user.id,
      updated_by: user.id,
      is_deleted: false
    }));
  const { error: insertError } = await supabase.from("cart").upsert(entries, {
    onConflict: [
      "user_id",
      "product_id"
    ]
  });
  if (insertError) throw insertError;
  return json({
    status: "bundle_added_to_cart"
  }, 201);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
