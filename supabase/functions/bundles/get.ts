// File: functions/bundles/get.ts
export async function handleGetBundleBySlug(req, supabase) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return json({ message: "Missing 'slug' query parameter" }, 400);
  }

  // Fetch product by slug or slug_ar
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .or(`slug.eq.${slug},slug_ar.eq.${slug}`)
    .single();

  if (productError || !product) {
    throw productError ?? new Error("Product not found");
  }

  // Fetch bundle and related child products
  const { data: bundles, error: bundleError } = await supabase
    .from("bundles")
    .select(`
      id,
      product_id,
      is_active,
      product_bundles!product_bundles_bundle_id_fkey(
        product:products(
          id,
          name_en,
          name_ar,
          price,
          old_price,
          thumbnail,
          slug,
          slug_ar
        )
      )
    `)
    .eq("product_id", product.id)
    .eq("is_active", true)
    .maybeSingle();

  if (bundleError || !bundles) {
    throw bundleError ?? new Error("Bundle not found");
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  let childProducts = bundles.product_bundles.map((b) => b.product);

  if (!authError && user) {
    const productIds = childProducts.map((p) => p.id);

    // ✅ Use correct table: cart_items
    const { data: cartItems, error: cartError } = await supabase
      .from("cart_items")
      .select("product_id")
      .eq("user_id", user.id)
      .eq("is_deleted", false)
      .in("product_id", productIds);

    if (cartError) {
      console.error("Cart query failed:", cartError);
    }

    const inCartSet = new Set((cartItems ?? []).map((i) => i.product_id));
    bundles.in_cart = childProducts.every((p) => inCartSet.has(p.id));

    childProducts = childProducts.map((p) => ({
      ...p,
      in_cart: inCartSet.has(p.id)
    }));
  }

  bundles.bundles = childProducts;
  bundles.price = childProducts.reduce((sum, p) => sum + (p.price ?? 0), 0);
  bundles.old_price = childProducts.reduce(
    (sum, p) => sum + (p.old_price ?? p.price ?? 0),
    0
  );

  delete bundles.product_bundles;

  return json(bundles);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
