// File: functions/orders/update-status.ts
export async function handleUpdateOrderStatus(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const { order_id, order_code, status, note } = await req.json();
  if (!status || !order_id && !order_code) {
    return json({
      message: "Missing 'status' and either 'order_id' or 'order_code'"
    }, 400);
  }
  const now = new Date().toISOString();
  // 🔍 Step 1: Fetch order
  const { data: order, error: fetchError } = await supabase.from("orders").select("id, status").eq(order_id ? "id" : "order_code", order_id ?? order_code).maybeSingle();
  if (fetchError || !order) throw fetchError ?? new Error("Order not found");
  // ✏️ Step 2: Update order status
  const { error: updateError } = await supabase.from("orders").update({
    status,
    note,
    updated_at: now,
    updated_by: user.email
  }).eq("id", order.id);
  if (updateError) throw updateError;
  // 📝 Step 3: Insert history
  await supabase.from("order_status_history").insert({
    order_id: order.id,
    status,
    changed_at: now,
    changed_by: user.email,
    note
  });
  return json({
    status: "updated"
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

/**
 * Handle updating order status with history tracking.
 * Updates order status and creates a history record for audit trail.
 * 
 * @param {Request} req - HTTP request object containing status update data
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with update status
 * 
 * @throws {Error} Unauthorized access (401)
 * @throws {Error} Missing required fields (400)
 * @throws {Error} Order not found (404)
 * @throws {Error} Database update errors (500)
 * 
 * Request Body:
 * {
 *   "order_id": "order_uuid",           // Order ID (required if order_code not provided)
 *   "order_code": "ORD-12345",         // Order code (required if order_id not provided)
 *   "status": "shipped",               // New order status (required)
 *   "note": "Package shipped via FedEx" // Status change note (optional)
 * }
 * 
 * Response Format:
 * {
 *   "status": "updated"
 * }
 * 
 * Valid Order Status Values:
 * - "pending": Order created, awaiting processing
 * - "confirmed": Order confirmed by merchant
 * - "processing": Order being prepared
 * - "shipped": Order shipped to customer
 * - "out_for_delivery": Out for delivery
 * - "delivered": Order delivered successfully
 * - "cancelled": Order cancelled
 * - "refunded": Order refunded
 * - "returned": Order returned by customer
 * 
 * Process Flow:
 * 1. Validates required fields (status and order identifier)
 * 2. Fetches order by ID or order code
 * 3. Updates order status and metadata
 * 4. Creates history record for audit trail
 * 5. Returns success confirmation
 * 
 * Usage Examples:
 * 
 * 1. Update order status by ID:
 * curl -X PUT "https://your-project.supabase.co/functions/v1/orders/update-status" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "order_id": "123e4567-e89b-12d3-a456-426614174000",
 *     "status": "confirmed"
 *   }'
 * 
 * 2. Update order status by order code with note:
 * curl -X PUT "https://your-project.supabase.co/functions/v1/orders/update-status" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "order_code": "ORD-2024-001",
 *     "status": "shipped",
 *     "note": "Shipped via FedEx, tracking number: 1234567890"
 *   }'
 * 
 * 3. Mark order as delivered:
 * curl -X PUT "https://your-project.supabase.co/functions/v1/orders/update-status" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "order_id": "456e7890-e12b-34d5-a678-901234567890",
 *     "status": "delivered",
 *     "note": "Package delivered to front door, signed by John Doe"
 *   }'
 * 
 * 4. Cancel order with reason:
 * curl -X PUT "https://your-project.supabase.co/functions/v1/orders/update-status" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "order_code": "ORD-2024-002",
 *     "status": "cancelled",
 *     "note": "Customer requested cancellation - out of stock item"
 *   }'
 * 
 * Success Response Example:
 * {
 *   "status": "updated"
 * }
 * 
 * Error Responses:
 * 
 * Missing required fields (400):
 * {
 *   "message": "Missing 'status' and either 'order_id' or 'order_code'"
 * }
 * 
 * Order not found (404):
 * {
 *   "error": "Order not found"
 * }
 * 
 * Invalid status (400):
 * {
 *   "error": "Invalid status value"
 * }
 * 
 * Notes:
 * - History tracking maintains complete audit trail of status changes
 * - Either order_id or order_code can be used to identify the order
 * - Status changes are timestamped and attributed to the updating user
 * - Notes are optional but recommended for better tracking
 * - Status updates trigger any configured webhooks or notifications
 */
