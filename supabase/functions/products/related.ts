// File: functions/products/related.ts
export async function handleRelatedProducts(req, supabase, user) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) throw new Error("Missing 'slug' parameter");
  const { data: currentProduct, error: productError } = await supabase.from("products").select("id, category_id").or(`slug.eq.${slug},slug_ar.eq.${slug}`).maybeSingle();
  if (productError || !currentProduct) throw productError ?? new Error("Product not found");
  const { data: related, error } = await supabase.from("products").select("*, category:categories(name_en, name_ar)").eq("is_deleted", false).eq("category_id", currentProduct.category_id).neq("id", currentProduct.id).order("created_at", {
    ascending: false
  }).limit(10);
  if (error) throw error;
  if (!user) return json(related);
  const ids = related.map((p)=>p.id);
  const [favorites, cartItems] = await Promise.all([
    supabase.from("favorites").select("product_id").eq("user_id", user.id).in("product_id", ids),
    supabase.from("cart_items").select("product_id").eq("user_id", user.id).in("product_id", ids)
  ]);
  const favSet = new Set(favorites.data?.map((f)=>f.product_id));
  const cartSet = new Set(cartItems.data?.map((c)=>c.product_id));
  return json(related.map((p)=>({
      ...p,
      in_favorites: favSet.has(p.id),
      in_cart: cartSet.has(p.id)
    })));
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
