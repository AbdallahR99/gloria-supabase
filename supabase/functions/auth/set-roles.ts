// File: functions/auth/set-roles.ts
import { createClient } from "jsr:@supabase/supabase-js@2";
export async function handleSetUserRoles(req, supabase, user, authError) {
  if (req.method === "OPTIONS") return new Response("ok", {
    status: 200
  });
  if (authError || !user) return json({
    message: "Unauthorized"
  }, 401);
  const { user_id, roles } = await req.json();
  if (!user_id || !Array.isArray(roles)) {
    return json({
      message: "Missing or invalid 'user_id' or 'roles'."
    }, 400);
  }
  const adminSupabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const { error } = await adminSupabase.auth.admin.updateUserById(user_id, {
    user_metadata: {
      roles
    }
  });
  if (error) {
    return json({
      message: "Failed to update roles.",
      error: error.message
    }, 400);
  }
  return json({
    message: "Roles updated successfully.",
    roles
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
