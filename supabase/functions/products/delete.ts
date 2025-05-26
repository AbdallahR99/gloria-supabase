/**
 * Product Deletion Handler
 * File: functions/products/delete.ts
 * 
 * This file handles the soft deletion of products in the e-commerce system.
 * Products are not permanently deleted but marked as deleted for data integrity
 * and audit trail purposes.
 * 
 * Features:
 * - Soft delete (preserves data for audit)
 * - Audit trail with deletion timestamp and user
 * - Authorization validation
 */

/**
 * Handles soft deletion of a single product
 * 
 * @param {Request} req - HTTP request object containing product ID
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {User} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with deleted product data or error
 */
export async function handleDeleteProduct(req, supabase, user, authError) {
  // Check if user is authenticated and authorized
  if (authError || !user) throw new Error("Unauthorized");
  
  // Parse request body to get product ID
  const body = await req.json();
  const { id } = body;
  
  // Validate that product ID is provided
  if (!id) throw new Error("Missing product ID");
  
  // Perform soft delete by updating the is_deleted flag and audit fields
  const { data, error } = await supabase.from("products").update({
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by: user.id
  }).eq("id", id).select().single();
  
  if (error) throw error;
  return json(data);
}

/**
 * Creates a JSON response with proper headers
 * 
 * @param {any} data - Data to be serialized as JSON
 * @param {number} status - HTTP status code (default: 200)
 * @returns {Response} HTTP Response with JSON content
 */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}

/**
 * cURL Examples for Postman Import:
 * 
 * Delete Product (Soft Delete):
 */

/*
curl -X DELETE "{{supabase_url}}/functions/v1/products" \
  -H "Authorization: Bearer {{auth_token}}" \
  -H "Content-Type: application/json" \
  -H "apikey: {{supabase_anon_key}}" \
  -d '{
    "id": "123e4567-e89b-12d3-a456-426614174000"
  }'
*/
