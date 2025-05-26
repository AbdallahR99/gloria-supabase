// File: functions/auth/register.ts
import { createClient } from "jsr:@supabase/supabase-js@2";
export async function handleAuthRegister(req, supabase) {
  if (req.method === "OPTIONS") return new Response("ok", {
    status: 200
  });
  const { email, password, first_name, last_name, phone } = await req.json();
  if (!email || !password || !first_name || !last_name) {
    return json({
      message: "Missing required fields."
    }, 400);
  }
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name,
        last_name
      }
    }
  });
  if (error) return json({
    message: error.message
  }, 400);
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
  const { error: updateError } = await adminSupabase.auth.admin.updateUserById(data.user.id, updatePayload);
  if (updateError) {
    return json({
      message: "User created but failed to finalize profile",
      error: updateError.message,
      user: data.user
    }, 202);
  }
  return json({
    message: "User registered and confirmed successfully!",
    user: data.user
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
