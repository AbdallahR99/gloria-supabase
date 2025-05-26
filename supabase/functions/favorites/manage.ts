// File: functions/favorites/manage.ts
export async function handleManageFavorite(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { product_id, user_id, action } = body;
  if (!product_id || !user_id || !action) return json({
    message: "Missing required fields"
  }, 400);
  if (action === "add") {
    const now = new Date().toISOString();
    const { error } = await supabase.from("favorites").insert({
      product_id,
      user_id,
      created_at: now,
      created_by: user.email
    });
    if (error) throw error;
    return json({
      status: "added"
    }, 201);
  }
  if (action === "remove") {
    const { error } = await supabase.from("favorites").delete().eq("product_id", product_id).eq("user_id", user_id);
    if (error) throw error;
    return json({
      status: "removed"
    });
  }
  throw new Error("Invalid action. Use 'add' or 'remove'.");
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
