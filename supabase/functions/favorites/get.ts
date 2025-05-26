// File: functions/favorites/get.ts
export async function handleGetFavorites(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const url = new URL(req.url);
  const userIdParam = url.searchParams.get("user_id");
  const userId = userIdParam ?? user.id;
  const { data, error } = await supabase.from("favorites").select("id, product_id, created_at, product:products(*)").eq("user_id", userId).order("created_at", {
    ascending: false
  });
  if (error) throw error;
  return json(data);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
