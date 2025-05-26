// File: functions/bundles/create.ts
export async function handleCreateBundle(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { product_id, bundle_name, items, price, old_price, is_active } = body;
  if (!product_id || !Array.isArray(items) || items.length === 0) {
    return json({
      message: "Missing required fields or bundle items."
    }, 400);
  }
  const now = new Date().toISOString();
  const { data: bundle, error: insertError } = await supabase.from("bundles").insert({
    product_id,
    bundle_name,
    price,
    old_price,
    is_active,
    created_at: now,
    updated_at: now,
    created_by: user.email,
    updated_by: user.email,
    is_deleted: false
  }).select().single();
  if (insertError) throw insertError;
  const { error: relError } = await supabase.from("product_bundles").insert(items.map((pid)=>({
      product_id: pid,
      bundle_id: bundle.id
    })));
  if (relError) throw relError;
  return json(bundle, 201);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
