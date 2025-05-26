// File: functions/cart/get.ts
export async function handleGetCart(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const url = new URL(req.url);
  const userIdParam = url.searchParams.get("user_id");
  const userId = userIdParam ?? user.id;
  // Step 1: Fetch cart items from cart_items
  const { data: cartItems, error: cartError } = await supabase.from("cart_items").select("id, product_id, quantity, size, color").eq("user_id", userId).eq("is_deleted", false).order("created_at", {
    ascending: false
  });
  if (cartError) throw cartError;
  // Step 2: Fetch related product details
  const productIds = cartItems.map((item)=>item.product_id);
  const { data: products, error: productError } = await supabase.from("products").select(`
      id,
      name_en,
      name_ar,
      description_en,
      description_ar,
      price,
      old_price,
      stars,
      reviews,
      thumbnail,
      slug,
      slug_ar
    `).in("id", productIds);
  if (productError) throw productError;
  const productMap = Object.fromEntries(products.map((p)=>[
      p.id,
      p
    ]));
  const result = cartItems.map((item)=>{
    const product = productMap[item.product_id];
    return {
      ...item,
      product_id: product?.id,
      name_en: product?.name_en,
      name_ar: product?.name_ar,
      description_en: product?.description_en,
      description_ar: product?.description_ar,
      price: product?.price,
      old_price: product?.old_price,
      stars: product?.stars,
      reviews: product?.reviews,
      thumbnail: product?.thumbnail,
      slug: product?.slug,
      slug_ar: product?.slug_ar
    };
  });
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
