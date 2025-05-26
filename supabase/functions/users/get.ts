// File: functions/users/get.ts
export async function handleGetUser(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || url.searchParams.get("user_id") || user.id;
  const { data, error } = await supabase.from("user_profiles").select("user_id, email, first_name, last_name, avatar").eq("user_id", id).maybeSingle();
  if (error || !data) throw error ?? new Error("User not found");
  return json(data);
}
export async function handleGetCurrentUser(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const { data, error } = await supabase.from("user_profiles").select("user_id, email, first_name, last_name, avatar").eq("user_id", user.id).maybeSingle();
  if (error || !data) throw error ?? new Error("User not found");
  return json(data);
}
export async function handleListUsers(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const { data, error } = await supabase.from("user_profiles").select("user_id, email, first_name, last_name, avatar").order("created_at", {
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
