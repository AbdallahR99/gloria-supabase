// File: functions/bundles/update.ts
export async function handleUpdateBundle(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { id, product_id, bundle_name, items, price, old_price, is_active } = body;
  if (!id) throw new Error("Missing bundle ID");
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase.from("bundles").update({
    product_id,
    bundle_name,
    price,
    old_price,
    is_active,
    updated_at: now,
    updated_by: user.email
  }).eq("id", id).select().single();
  if (updateError) throw updateError;
  if (Array.isArray(items)) {
    const { error: deleteOld } = await supabase.from("product_bundles").delete().eq("bundle_id", id);
    if (deleteOld) throw deleteOld;
    const { error: insertNew } = await supabase.from("product_bundles").insert(items.map((product_id)=>({
        product_id,
        bundle_id: id
      })));
    if (insertNew) throw insertNew;
  }
  return json(updated);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
