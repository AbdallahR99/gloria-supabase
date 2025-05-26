// File: functions/users/bulk.ts
import { createClient as createSupabaseClient } from "jsr:@supabase/supabase-js@2";
export async function handleBulkUpdateUsers(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const payload = await req.json();
  if (!Array.isArray(payload)) return json({
    message: "Expected an array of user updates"
  }, 400);
  const adminSupabase = createSupabaseClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const results = [];
  for (const update of payload){
    const { user_id, first_name, last_name, avatar } = update;
    if (!user_id) continue;
    const metadata = {
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
    const { error } = await adminSupabase.auth.admin.updateUserById(user_id, {
      user_metadata: metadata
    });
    if (error) {
      results.push({
        user_id,
        error: error.message
      });
    } else {
      results.push({
        user_id,
        status: "updated"
      });
    }
  }
  return json(results);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
