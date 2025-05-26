// File: functions/categories/create.ts
export async function handleCreateCategory(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const now = new Date().toISOString();
  const payload = {
    ...body,
    created_at: now,
    updated_at: now,
    created_by: user.email,
    updated_by: user.email,
    is_deleted: false
  };
  const { data, error } = await supabase.from("categories").insert(payload).select().single();
  if (error) throw error;
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
