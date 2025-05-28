// File: functions/cart/count.ts

/**
 * Handle retrieving the total count of items in user's shopping cart.
 * Returns the number of cart items (not quantities) for the authenticated user.
 * 
 * @param {Request} req - HTTP request object
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with cart item count
 * 
 * @throws {Error} Unauthorized access (401)
 * @throws {Error} Database query errors (500)
 * 
 * Response Format:
 * {
 *   "count": 5
 * }
 * 
 * Notes:
 * - Returns count of cart items, not total quantity
 * - Only counts non-deleted items
 * - Each unique product/size/color combination counts as one item
 * 
 * Usage Examples:
 * 
 * 1. Get cart item count:
 * curl -X GET "https://your-project.supabase.co/functions/v1/cart/count" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN"
 * 
 * 2. Get cart count for badge display:
 * curl -X GET "https://your-project.supabase.co/functions/v1/cart/count" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN"
 */
export async function handleCartCount(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const { count, error } = await supabase.from("cart_items") // Fixed: was "cart", should be "cart_items"
  .select("id", {
    count: "exact",
    head: true
  }).eq("user_id", user.id).eq("is_deleted", false);
  if (error) throw error;
  return json({
    count: count ?? 0 // Added fallback to 0 if count is null
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
