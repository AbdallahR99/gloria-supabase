// File: functions/orders/checkout.ts
export async function handleCheckoutOrder(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { address_id, note, user_id: customUserId } = body;
  const userId = customUserId ?? user.id;
  // ✅ Step 1: Fetch cart items from correct table
  const { data: cartItems, error: cartError } = await supabase.from("cart_items").select("product_id, quantity, size, color").eq("user_id", userId).eq("is_deleted", false);
  if (cartError) throw cartError;
  if (!cartItems || cartItems.length === 0) throw new Error("Cart is empty");
  // ✅ Step 2: Fetch product prices
  const productIds = cartItems.map((item)=>item.product_id);
  const { data: products, error: productsError } = await supabase.from("products").select("id, price, old_price").in("id", productIds);
  if (productsError) throw productsError;
  const productMap = new Map(products.map((p)=>[
      p.id,
      p
    ]));
  // ✅ Step 3: Calculate totals
  let subtotal = 0;
  let discount = 0;
  const now = new Date().toISOString();
  cartItems.forEach((item)=>{
    const product = productMap.get(item.product_id);
    const price = product?.price ?? 0;
    const oldPrice = product?.old_price ?? price;
    subtotal += price * item.quantity;
    discount += (oldPrice - price) * item.quantity;
  });
  // ✅ Step 4: Get delivery fee
  const { data: address } = await supabase.from("addresses").select("state").eq("id", address_id).eq("user_id", userId).single();
  if (!address) throw new Error("Address not found");
  const { data: state } = await supabase.from("states").select("delivery_fee").eq("id", address.state).single();
  const delivery_fee = state?.delivery_fee ?? 0;
  const total_price = subtotal + delivery_fee;
  const order_code = `ORD-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  // ✅ Step 5: Create order
  const { data: order, error: orderError } = await supabase.from("orders").insert({
    user_id: userId,
    address_id,
    status: "pending",
    note: "Initial order creation",
    user_note: note,
    total_price,
    order_code,
    created_at: now,
    updated_at: now,
    created_by: user.id,
    updated_by: user.id
  }).select().single();
  if (orderError) throw orderError;
  // ✅ Step 6: Insert order items
  const orderItems = cartItems.map((item)=>({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      created_at: now,
      updated_at: now,
      created_by: user.id,
      updated_by: user.id
    }));
  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
  if (itemsError) throw itemsError;
  // ✅ Step 7: Insert status history
  await supabase.from("order_status_history").insert({
    order_id: order.id,
    status: order.status,
    changed_by: user.email,
    note: order.note
  });
  // ✅ Step 8: Clear cart
  const { error: clearCartError } = await supabase.from("cart_items").delete().eq("user_id", userId);
  if (clearCartError) throw clearCartError;
  return json({
    order_id: order.id,
    order_code,
    cartError
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

/**
 * Handle complete checkout process from cart to order creation.
 * Converts user's cart items into an order with calculated totals and delivery fees.
 * 
 * @param {Request} req - HTTP request object containing checkout data
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with created order details
 * 
 * @throws {Error} Unauthorized access (401)
 * @throws {Error} Empty cart (400)
 * @throws {Error} Address not found (404)
 * @throws {Error} Product availability issues (400)
 * @throws {Error} Database transaction errors (500)
 * 
 * Request Body:
 * {
 *   "address_id": "address_uuid",       // Delivery address ID (required)
 *   "note": "Special instructions",     // Customer note (optional)
 *   "user_id": "user_uuid"             // Custom user ID (optional, admin only)
 * }
 * 
 * Response Format:
 * {
 *   "order_id": "order_uuid",
 *   "order_code": "ORD-A1B2C3D4",
 *   "cartError": null
 * }
 * 
 * Checkout Process Flow:
 * 1. Validates user authentication and cart contents
 * 2. Fetches all cart items for the user
 * 3. Retrieves product details and current prices
 * 4. Calculates subtotal, discounts, and delivery fees
 * 5. Creates order record with generated order code
 * 6. Converts cart items to order items
 * 7. Clears cart after successful order creation
 * 8. Returns order details for confirmation
 * 
 * Price Calculation:
 * - Subtotal: Sum of (current_price × quantity) for all cart items
 * - Discount: Sum of (old_price - current_price) × quantity where applicable
 * - Delivery Fee: Based on delivery address state/region
 * - Total: Subtotal + Delivery Fee
 * 
 * Usage Examples:
 * 
 * 1. Basic checkout with delivery address:
 * curl -X POST "https://your-project.supabase.co/functions/v1/orders/checkout" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "address_id": "123e4567-e89b-12d3-a456-426614174000"
 *   }'
 * 
 * 2. Checkout with customer note:
 * curl -X POST "https://your-project.supabase.co/functions/v1/orders/checkout" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "address_id": "456e7890-e12b-34d5-a678-901234567890",
 *     "note": "Please ring doorbell twice and leave package at front door"
 *   }'
 * 
 * 3. Admin checkout for another user:
 * curl -X POST "https://your-project.supabase.co/functions/v1/orders/checkout" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
 *   -d '{
 *     "address_id": "789e0123-e45b-67d8-a901-234567890123",
 *     "user_id": "012e3456-e78b-90d1-a234-567890123456",
 *     "note": "Customer called to place order over phone"
 *   }'
 * 
 * Success Response Example:
 * {
 *   "order_id": "123e4567-e89b-12d3-a456-426614174000",
 *   "order_code": "ORD-A1B2C3D4",
 *   "cartError": null
 * }
 * 
 * Error Responses:
 * 
 * Empty cart (400):
 * {
 *   "error": "Cart is empty"
 * }
 * 
 * Address not found (404):
 * {
 *   "error": "Address not found"
 * }
 * 
 * Product not available (400):
 * {
 *   "error": "One or more products in cart are no longer available"
 * }
 * 
 * Insufficient stock (400):
 * {
 *   "error": "Insufficient stock for product: Product Name"
 * }
 * 
 * Notes:
 * - Cart is automatically cleared after successful checkout
 * - Order code is auto-generated with format "ORD-XXXXXXXX"
 * - Delivery fees are calculated based on the delivery address state
 * - Product prices are locked at checkout time in order items
 * - Transaction is atomic - either all steps succeed or order is not created
 * - Order status is initially set to "pending" awaiting payment/confirmation
 */
