// File: functions/categories/update.ts
export async function handleUpdateCategory(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return json({
    message: "Missing category ID"
  }, 400);
  const now = new Date().toISOString();
  const updateData = {
    ...rest,
    updated_at: now,
    updated_by: user.email
  };
  const { data, error } = await supabase.from("categories").update(updateData).eq("id", id).select().single();
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
