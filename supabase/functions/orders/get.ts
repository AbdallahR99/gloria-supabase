// File: functions/orders/get.ts
export async function handleGetOrder(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const url = new URL(req.url);
  const orderId = url.searchParams.get("order_id");
  const orderCode = url.searchParams.get("order_code");
  const userIdParam = url.searchParams.get("user_id");
  const userId = userIdParam ?? user.id;
  let query = supabase.from("orders").select(`
    id,
    order_code,
    status,
    note,
    user_note,
    total_price,
    created_at,
    address:addresses(label, city, state, area, street, building, apartment, phone),
    items:order_items(
      product_id,
      quantity,
      size,
      color,
      product:products(name_en, name_ar, price, thumbnail)
    )
  `).eq("user_id", userId);
  if (orderId) query = query.eq("id", orderId).maybeSingle();
  else if (orderCode) query = query.eq("order_code", orderCode).maybeSingle();
  const { data, error } = await query;
  if (error || !data && (orderId || orderCode)) throw error ?? new Error("Order not found");
  return json(data);
}
export async function handleListOrders(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { page = 1, page_size = 10, status, user_id: customUserId } = body;
  const userId = customUserId ?? user.id;
  const from = (page - 1) * page_size;
  const to = from + page_size - 1;
  let query = supabase.from("orders").select(`
    id,
    order_code,
    status,
    note,
    user_note,
    total_price,
    created_at,
    address:addresses(label, city),
    items:order_items(
      product_id,
      quantity,
      product:products(name_en, thumbnail)
    )
  `, {
    count: "exact"
  }).eq("user_id", userId);
  if (status) query = query.eq("status", status);
  query = query.order("created_at", {
    ascending: false
  }).range(from, to);
  const { data, count, error } = await query;
  if (error) throw error;
  return json({
    page,
    page_size,
    total: count,
    total_pages: Math.ceil((count ?? 0) / page_size),
    items: data
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
