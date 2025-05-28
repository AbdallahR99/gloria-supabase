// File: functions/cart/update.ts

/**
 * Handle updating existing cart items with new quantity, size, or color.
 * Updates cart item properties while maintaining ownership validation.
 * 
 * @param {Request} req - HTTP request object containing update data
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with update status
 * 
 * @throws {Error} Unauthorized access (401)
 * @throws {Error} Missing required fields (400)
 * @throws {Error} Cart item not found or database errors (400/500)
 * 
 * Request Body:
 * {
 *   "id": "cart_item_uuid",             // Cart item ID (required)
 *   "quantity": 3,                      // New quantity (optional, defaults to 1)
 *   "size": "L",                        // New size variant (optional)
 *   "color": "Green"                    // New color variant (optional)
 * }
 * 
 * Response Format:
 * {
 *   "status": "updated"
 * }
 * 
 * Usage Examples:
 * 
 * 1. Update cart item quantity:
 * curl -X PUT "https://your-project.supabase.co/functions/v1/cart" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "id": "123e4567-e89b-12d3-a456-426614174000",
 *     "quantity": 5
 *   }'
 * 
 * 2. Update size and color:
 * curl -X PUT "https://your-project.supabase.co/functions/v1/cart" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "id": "123e4567-e89b-12d3-a456-426614174000",
 *     "size": "XL",
 *     "color": "Black"
 *   }'
 * 
 * 3. Update all properties:
 * curl -X PUT "https://your-project.supabase.co/functions/v1/cart" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "id": "456e7890-e12b-34d5-a678-901234567890",
 *     "quantity": 2,
 *     "size": "M",
 *     "color": "Red"
 *   }'
 */
export async function handleUpdateCartItem(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { id, size, color } = body;
  const quantity = body.quantity ?? 1;
  if (!id || !quantity) return json({
    message: "Missing cart item ID or quantity"
  }, 400);
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("cart").update({
    quantity,
    size,
    color,
    updated_at: now,
    updated_by: user.id
  }).eq("id", id).select().single();
  if (error) throw error;
  return json({
    status: "updated",
    data
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
