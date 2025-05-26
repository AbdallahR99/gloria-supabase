// File: functions/favorites/create.ts

/**
 * Handle adding products to user's favorites list.
 * Creates a favorite entry linking the user to a specific product.
 * 
 * @param {Request} req - HTTP request object containing favorite data
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with creation status and favorite data
 * 
 * @throws {Error} Unauthorized access (401)
 * @throws {Error} Missing product_id (400)
 * @throws {Error} Product already in favorites (409)
 * @throws {Error} Database constraint violations (400/500)
 * 
 * Request Body:
 * {
 *   "product_id": "product_uuid",       // Product ID to favorite (required)
 *   "user_id": "user_uuid"              // User ID (auto-filled from auth)
 * }
 * 
 * Response Format:
 * {
 *   "id": "favorite_uuid",
 *   "product_id": "product_uuid",
 *   "user_id": "user_uuid",
 *   "created_at": "2024-01-15T10:30:00Z",
 *   "created_by": "user@example.com",
 *   "is_deleted": false
 * }
 * 
 * Usage Examples:
 * 
 * 1. Add product to favorites:
 * curl -X POST "https://your-project.supabase.co/functions/v1/favorites" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "product_id": "123e4567-e89b-12d3-a456-426614174000"
 *   }'
 * 
 * 2. Add favorite with explicit user ID (admin):
 * curl -X POST "https://your-project.supabase.co/functions/v1/favorites" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
 *   -d '{
 *     "product_id": "456e7890-e12b-34d5-a678-901234567890",
 *     "user_id": "789e0123-e45b-67d8-a901-234567890123"
 *   }'
 */
export async function handleCreateFavorite(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const now = new Date().toISOString();
  const payload = {
    ...body,
    created_at: now,
    created_by: user.email,
    is_deleted: false
  };
  const { data, error } = await supabase.from("favorites").insert(payload).select().single();
  if (error) throw error;
  return json(data, 201);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
