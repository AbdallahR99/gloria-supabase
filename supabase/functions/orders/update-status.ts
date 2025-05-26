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
