// File: functions/cart/create.ts

/**
 * Handle adding new items to user's shopping cart.
 * Creates a cart item with product, quantity, and optional size/color variants.
 * 
 * @param {Request} req - HTTP request object containing cart item data
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with creation status
 * 
 * @throws {Error} Unauthorized access (401)
 * @throws {Error} Missing required fields (400)
 * @throws {Error} Product not found or database errors (400/500)
 * 
 * Request Body:
 * {
 *   "product_id": "uuid-123",           // Product UUID (required)
 *   "quantity": 2,                      // Item quantity (optional, defaults to 1)
 *   "size": "M",                        // Size variant (optional)
 *   "color": "Red",                     // Color variant (optional)
 *   "user_id": "uuid-456"               // Custom user ID (optional, admin only)
 * }
 * 
 * Response Format:
 * {
 *   "status": "added"
 * }
 * 
 * Usage Examples:
 * 
 * 1. Add basic product to cart:
 * curl -X POST "https://your-project.supabase.co/functions/v1/cart" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "product_id": "123e4567-e89b-12d3-a456-426614174000",
 *     "quantity": 1
 *   }'
 * 
 * 2. Add product with size and color variants:
 * curl -X POST "https://your-project.supabase.co/functions/v1/cart" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "product_id": "123e4567-e89b-12d3-a456-426614174000",
 *     "quantity": 2,
 *     "size": "L",
 *     "color": "Blue"
 *   }'
 * 
 * 3. Add multiple quantities:
 * curl -X POST "https://your-project.supabase.co/functions/v1/cart" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "product_id": "456e7890-e12b-34d5-a678-901234567890",
 *     "quantity": 5
 *   }'
 * 
 * 4. Admin adding to another user's cart:
 * curl -X POST "https://your-project.supabase.co/functions/v1/cart" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
 *   -d '{
 *     "product_id": "789e0123-e45b-67d8-a901-234567890123",
 *     "quantity": 1,
 *     "user_id": "012e3456-e78b-90d1-a234-567890123456"
 *   }'
 */
export async function handleCreateCartItem(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { product_id, size, color, user_id: customUserId } = body;
  const quantity = body.quantity ?? 1;
  if (!product_id || !quantity) return json({
    message: "Missing required fields"
  }, 400);
  const userId = customUserId ?? user.id;
  const now = new Date().toISOString();
  const insertData = {
    user_id: userId,
    product_id,
    quantity,
    created_at: now,
    updated_at: now,
    created_by: user.id,
    updated_by: user.id
  };
  if (size != null) insertData.size = size;
  if (color != null) insertData.color = color;
  const { error } = await supabase.from("cart").insert(insertData);
  if (error) throw error;
  return json({
    status: "added"
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
