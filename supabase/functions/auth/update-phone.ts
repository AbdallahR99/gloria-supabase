// File: functions/auth/update-phone.ts
import { createClient } from "jsr:@supabase/supabase-js@2";
export async function handleUpdatePhone(req) {
  if (req.method === "OPTIONS") return new Response("ok", {
    status: 200
  });
  const { phone, user_id } = await req.json();
  const timestamp = new Date().toISOString();
  const adminSupabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const updatePayload = {
    email_confirmed_at: timestamp,
    confirmed_at: timestamp,
    phone_confirm: true
  };
  if (phone) {
    let normalizedPhone = phone;
    if (normalizedPhone.startsWith("00")) {
      normalizedPhone = "+" + normalizedPhone.slice(2);
    } else if (!normalizedPhone.startsWith("+")) {
      normalizedPhone = "+" + normalizedPhone;
    }
    updatePayload.phone = normalizedPhone;
    updatePayload.phone_confirmed_at = timestamp;
  }
  const { error: updateError } = await adminSupabase.auth.admin.updateUserById(user_id, updatePayload);
  if (updateError) {
    return json({
      message: "User created but failed to finalize profile",
      error: updateError.message
    }, 202);
  }
  return json({
    message: "User registered and confirmed successfully!"
  }, 201);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
