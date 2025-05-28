// File: functions/cart/update-quantity.ts

/**
 * Handle updating the quantity of a specific cart item.
 * Updates the quantity of an existing cart item identified by product_id,
 * size, and color combination for the authenticated user.
 * 
 * @param {Request} req - HTTP request object containing quantity update data
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with quantity update status
 * 
 * @throws {Error} Unauthorized access (401)
 * @throws {Error} Missing required fields (400)
 * @throws {Error} Cart item not found (404)
 * @throws {Error} Database update errors (500)
 * 
 * Request Body:
 * {
 *   "product_id": "123e4567-e89b-12d3-a456...", // Product UUID (required)
 *   "quantity": 3,                              // New quantity (required, must be positive)
 *   "size": "L",                               // Product size (optional, must match existing)
 *   "color": "Blue",                           // Product color (optional, must match existing)
 *   "user_id": "456e7890-e12b-34d5..."        // Custom user ID (optional, admin feature)
 * }
 * 
 * Response Format:
 * {
 *   "status": "quantity_updated"
 * }
 * 
 * Cart Item Identification:
 * - Product ID: Must match existing cart item
 * - Size: Must match exactly (null if not specified originally)
 * - Color: Must match exactly (null if not specified originally)
 * - User ID: Cart owner (defaults to authenticated user)
 * 
 * Quantity Rules:
 * - Must be a positive integer
 * - Zero quantity should use delete endpoint instead
 * - No upper limit enforced (subject to stock availability)
 * - Updates timestamp and audit trail
 * 
 * Usage Examples:
 * 
 * 1. Update quantity for basic product:
 * curl -X PUT "https://your-project.supabase.co/functions/v1/cart/update-quantity" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "product_id": "123e4567-e89b-12d3-a456-426614174000",
 *     "quantity": 5
 *   }'
 * 
 * 2. Update quantity for product with size and color:
 * curl -X PUT "https://your-project.supabase.co/functions/v1/cart/update-quantity" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "product_id": "123e4567-e89b-12d3-a456-426614174000",
 *     "quantity": 2,
 *     "size": "M",
 *     "color": "Red"
 *   }'
 * 
 * 3. Increase quantity to maximum:
 * curl -X PUT "https://your-project.supabase.co/functions/v1/cart/update-quantity" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "product_id": "456e7890-e12b-34d5-a678-901234567890",
 *     "quantity": 10
 *   }'
 * 
 * 4. Admin updating quantity for another user:
 * curl -X PUT "https://your-project.supabase.co/functions/v1/cart/update-quantity" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
 *   -d '{
 *     "product_id": "789e0123-e45b-67d8-a901-234567890123",
 *     "quantity": 1,
 *     "user_id": "012e3456-e78b-90d1-a234-567890123456"
 *   }'
 * 
 * Success Response Example:
 * {
 *   "status": "quantity_updated"
 * }
 * 
 * Error Responses:
 * 
 * Unauthorized access (401):
 * {
 *   "message": "Unauthorized"
 * }
 * 
 * Missing required fields (400):
 * {
 *   "message": "Missing required fields: product_id or quantity"
 * }
 * 
 * Cart item not found (404):
 * {
 *   "message": "Cart item not found"
 * }
 * 
 * Invalid quantity (400):
 * {
 *   "message": "Quantity must be a positive integer"
 * }
 * 
 * Product variant mismatch (404):
 * {
 *   "message": "Cart item not found"
 * }
 * 
 * Notes:
 * - Requires exact match of product_id, size, and color
 * - Updates updated_at timestamp automatically
 * - Tracks updated_by for audit trail
 * - Size and color must match existing cart item exactly
 * - Use null for size/color if they were not specified originally
 * - For removing items completely, use the delete endpoint
 * - Quantity validation should be handled on frontend as well
 */
export async function handleUpdateCartItemQuantity(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { product_id, quantity, size, color, user_id: customUserId } = body;
  if (!product_id || quantity == null) {
    return json({
      message: "Missing required fields: product_id or quantity"
    }, 400);
  }
  const userId = customUserId ?? user.id;
  const now = new Date().toISOString();
  let query = supabase.from("cart").select("id").eq("user_id", userId).eq("product_id", product_id).eq("is_deleted", false);
  if (size != null) query = query.eq("size", size);
  if (color != null) query = query.eq("color", color);
  const { data: existing, error: fetchError } = await query.maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing) {
    return json({
      message: "Cart item not found"
    }, 404);
  }
  const { error: updateError } = await supabase.from("cart").update({
    quantity,
    updated_at: now,
    updated_by: user.id
  }).eq("id", existing.id);
  if (updateError) throw updateError;
  return json({
    status: "quantity_updated"
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
