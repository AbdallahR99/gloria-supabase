// File: functions/products/delete.ts
export async function handleDeleteProduct(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { id } = body;
  if (!id) throw new Error("Missing product ID");
  const { data, error } = await supabase.from("products").update({
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by: user.id
  }).eq("id", id).select().single();
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
