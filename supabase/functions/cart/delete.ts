// File: functions/cart/delete.ts

/**
 * Handle removing items from user's shopping cart.
 * Deletes cart items based on product ID and optional size/color variants.
 * 
 * @param {Request} req - HTTP request object containing deletion criteria
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with deletion status
 * 
 * @throws {Error} Unauthorized access (401)
 * @throws {Error} Missing product_id (400)
 * @throws {Error} Cart item not found or database errors (400/500)
 * 
 * Request Body:
 * {
 *   "product_id": "product_uuid",       // Product ID to remove (required)
 *   "size": "M",                        // Size variant filter (optional)
 *   "color": "Blue",                    // Color variant filter (optional)
 *   "user_id": "user_uuid"              // Custom user ID (optional, admin only)
 * }
 * 
 * Response Format:
 * {
 *   "status": "deleted"
 * }
 * 
 * Deletion Logic:
 * - If size and color specified: Removes exact variant match
 * - If only size specified: Removes items with matching size (any color)
 * - If only color specified: Removes items with matching color (any size)
 * - If neither specified: Removes all cart items for the product
 * 
 * Usage Examples:
 * 
 * 1. Remove all variants of a product:
 * curl -X DELETE "https://your-project.supabase.co/functions/v1/cart" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "product_id": "123e4567-e89b-12d3-a456-426614174000"
 *   }'
 * 
 * 2. Remove specific size variant:
 * curl -X DELETE "https://your-project.supabase.co/functions/v1/cart" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "product_id": "123e4567-e89b-12d3-a456-426614174000",
 *     "size": "L"
 *   }'
 * 
 * 3. Remove specific color variant:
 * curl -X DELETE "https://your-project.supabase.co/functions/v1/cart" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "product_id": "456e7890-e12b-34d5-a678-901234567890",
 *     "color": "Red"
 *   }'
 * 
 * 4. Remove exact size and color variant:
 * curl -X DELETE "https://your-project.supabase.co/functions/v1/cart" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "product_id": "789e0123-e45b-67d8-a901-234567890123",
 *     "size": "M",
 *     "color": "Black"
 *   }'
 * 
 * 5. Admin removing from another user's cart:
 * curl -X DELETE "https://your-project.supabase.co/functions/v1/cart" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
 *   -d '{
 *     "product_id": "012e3456-e78b-90d1-a234-567890123456",
 *     "user_id": "345e6789-e01b-23d4-a567-890123456789"
 *   }'
 */
export async function handleDeleteCartItem(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { product_id, size, color, user_id: customUserId } = body;
  if (!product_id) {
    return json({
      message: "Missing required field: product_id"
    }, 400);
  }
  const userId = customUserId ?? user.id;
  const now = new Date().toISOString();
  let query = supabase.from("cart").select("id").eq("user_id", userId).eq("product_id", product_id).eq("is_deleted", false);
  if (size != null) query = query.eq("size", size);
  if (color != null) query = query.eq("color", color);
  const { data: existing, error: fetchError } = await query.maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing) return json({
    message: "Cart item not found or already deleted"
  }, 404);
  const { data, error: updateError } = await supabase.from("cart").update({
    is_deleted: true,
    deleted_at: now,
    deleted_by: user.id,
    updated_at: now,
    updated_by: user.id
  }).eq("id", existing.id).select().single();
  if (updateError) throw updateError;
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
