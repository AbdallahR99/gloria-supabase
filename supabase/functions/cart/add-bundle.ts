export async function handleAddBundleToCart(req, supabase, user, authError) {
  if (authError || !user) {
    return json({ message: "Unauthorized" }, 401);
  }

  const body = await req.json();
  const { bundle_id, user_id: customUserId } = body;

  if (!bundle_id) {
    return json({ message: "Missing bundle_id" }, 400);
  }

  const userId = customUserId ?? user.id;
  const now = new Date().toISOString();

  // Fetch product items in the bundle
  const { data: bundleItems, error: fetchError } = await supabase
    .from("product_bundles")
    .select("product_id")
    .eq("bundle_id", bundle_id);

  if (fetchError) {
    console.error("Error fetching bundle items:", fetchError);
    return json({ message: "Error fetching bundle items" }, 500);
  }

  if (!bundleItems || bundleItems.length === 0) {
    return json({ message: "No products in bundle." }, 400);
  }

  // Optional: Add default size/color (or update to handle real values)
  const defaultSize = null;
  const defaultColor = null;

  // Process each bundle item individually
  for (const { product_id } of bundleItems) {
    const { data: existingItems, error: findError } = await supabase
      .from("cart_items")
      .select("id, is_deleted")
      .eq("user_id", userId)
      .eq("product_id", product_id)
      .eq("size", defaultSize)
      .eq("color", defaultColor)
      .limit(1);

    if (findError) {
      console.error("Error checking existing item:", findError);
      return json({ message: "Error checking cart items" }, 500);
    }

    const existingItem = existingItems?.[0];

    if (existingItem) {
      if (existingItem.is_deleted) {
        // Reactivate soft-deleted item
        const { error: updateError } = await supabase
          .from("cart_items")
          .update({
            is_deleted: false,
            updated_at: now,
            updated_by: user.id
          })
          .eq("id", existingItem.id);

        if (updateError) {
          console.error("Error reactivating cart item:", updateError);
          return json({ message: "Error reactivating cart item" }, 500);
        }
      }
      // If already active, skip
    } else {
      // Insert new cart item
      const { error: insertError } = await supabase.from("cart_items").insert({
        user_id: userId,
        product_id,
        quantity: 1,
        size: defaultSize,
        color: defaultColor,
        is_deleted: false,
        created_at: now,
        updated_at: now,
        created_by: user.id,
        updated_by: user.id
      });

      if (insertError) {
        console.error("Error inserting cart item:", insertError);
        return json({ message: "Error inserting cart item" }, 500);
      }
    }
  }

  return json({ status: "bundle_added_to_cart" }, 201);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    status
  });
}
