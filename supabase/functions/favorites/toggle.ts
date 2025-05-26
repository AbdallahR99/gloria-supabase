// File: functions/favorites/toggle.ts
export async function handleToggleFavorite(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { product_id, user_id: customUserId } = body;
  if (!product_id) return json({
    message: "Missing product_id"
  }, 400);
  const finalUserId = customUserId ?? user.id;
  const { data: existing } = await supabase.from("favorites").select("id").eq("product_id", product_id).eq("user_id", finalUserId).maybeSingle();
  if (existing) {
    await supabase.from("favorites").delete().eq("id", existing.id);
    return json({
      status: "removed"
    });
  } else {
    const now = new Date().toISOString();
    const { error } = await supabase.from("favorites").insert({
      product_id,
      user_id: finalUserId,
      created_at: now,
      created_by: user.email
    });
    if (error) throw error;
    return json({
      status: "added"
    }, 201);
  }
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
