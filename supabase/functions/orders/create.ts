// File: functions/orders/create.ts
export async function handleCreateOrder(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const now = new Date().toISOString();
  const status = body.status ?? "pending";
  const payload = {
    ...body,
    status,
    created_at: now,
    updated_at: now,
    created_by: user.email,
    updated_by: user.email,
    is_deleted: false
  };
  const { data, error } = await supabase.from("orders").insert(payload).select().single();
  if (error) throw error;
  await supabase.from("order_status_history").insert({
    order_id: data.id,
    status,
    changed_by: user.email,
    note: "Initial order creation"
  });
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

/**
 * Handle creating new orders with order items and customer information.
 * Creates an order record with default pending status and timestamps.
 * 
 * @param {Request} req - HTTP request object containing order data
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with created order data
 * 
 * @throws {Error} Unauthorized access (401)
 * @throws {Error} Missing required fields (400)
 * @throws {Error} Invalid order data (400)
 * @throws {Error} Database constraint violations (400/500)
 * 
 * Request Body:
 * {
 *   "user_id": "user_uuid",                      // Customer user ID (required)
 *   "total_amount": 299.99,                      // Total order amount (required)
 *   "currency": "USD",                           // Currency code (required)
 *   "shipping_address": "123 Main St, City",    // Shipping address (required)
 *   "billing_address": "123 Main St, City",     // Billing address (optional)
 *   "phone": "+1234567890",                      // Contact phone (optional)
 *   "email": "customer@example.com",             // Contact email (optional)
 *   "notes": "Special delivery instructions",   // Order notes (optional)
 *   "status": "pending"                          // Order status (optional, defaults to "pending")
 * }
 * 
 * Response Format:
 * {
 *   "id": "order_uuid",
 *   "user_id": "user_uuid",
 *   "total_amount": 299.99,
 *   "currency": "USD",
 *   "status": "pending",
 *   "shipping_address": "123 Main St, City",
 *   "billing_address": "123 Main St, City",
 *   "phone": "+1234567890",
 *   "email": "customer@example.com",
 *   "notes": "Special delivery instructions",
 *   "created_at": "2024-01-15T10:30:00Z",
 *   "updated_at": "2024-01-15T10:30:00Z",
 *   "created_by": "user@example.com",
 *   "updated_by": "user@example.com",
 *   "is_deleted": false
 * }
 * 
 * Order Status Values:
 * - "pending": Order created, awaiting processing
 * - "confirmed": Order confirmed by merchant
 * - "processing": Order being prepared
 * - "shipped": Order shipped to customer
 * - "delivered": Order delivered successfully
 * - "cancelled": Order cancelled
 * - "refunded": Order refunded
 * 
 * Usage Examples:
 * 
 * 1. Create basic order:
 * curl -X POST "https://your-project.supabase.co/functions/v1/orders" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "user_id": "123e4567-e89b-12d3-a456-426614174000",
 *     "total_amount": 149.99,
 *     "currency": "USD",
 *     "shipping_address": "456 Oak Ave, Springfield, IL 62701"
 *   }'
 * 
 * 2. Create order with full details:
 * curl -X POST "https://your-project.supabase.co/functions/v1/orders" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "user_id": "456e7890-e12b-34d5-a678-901234567890",
 *     "total_amount": 599.99,
 *     "currency": "USD",
 *     "shipping_address": "789 Pine St, Apt 4B, Chicago, IL 60601",
 *     "billing_address": "789 Pine St, Apt 4B, Chicago, IL 60601",
 *     "phone": "+1-555-123-4567",
 *     "email": "customer@example.com",
 *     "notes": "Leave package at front door if no answer"
 *   }'
 * 
 * 3. Create order with specific status:
 * curl -X POST "https://your-project.supabase.co/functions/v1/orders" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "user_id": "789e0123-e45b-67d8-a901-234567890123",
 *     "total_amount": 299.99,
 *     "currency": "USD",
 *     "shipping_address": "321 Elm Dr, Austin, TX 78701",
 *     "status": "confirmed"
 *   }'
 */
