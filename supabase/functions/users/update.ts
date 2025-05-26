// File: functions/users/update.ts
import { createClient } from "jsr:@supabase/supabase-js@2";
export async function handleUpdateUser(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const { user_id, first_name, last_name, avatar } = await req.json();
  const targetUserId = user_id ?? user.id;
  const updates = {
    ...first_name !== undefined && {
      first_name
    },
    ...last_name !== undefined && {
      last_name
    },
    ...avatar !== undefined && {
      avatar
    }
  };
  if (user_id && user_id !== user.id) {
    const adminSupabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    const { error } = await adminSupabase.auth.admin.updateUserById(targetUserId, {
      user_metadata: updates
    });
    if (error) throw error;
  } else {
    const { error } = await supabase.auth.updateUser({
      data: updates
    });
    if (error) throw error;
  }
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
