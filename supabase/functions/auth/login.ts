// File: functions/auth/login.ts
export async function handleAuthLogin(req, supabase) {
  const { identifier, password } = await req.json();
  if (!identifier || !password) {
    return json({
      message: "Email/Phone and password are required."
    }, 400);
  }
  let loginPayload;
  const isPhone = /^[+0-9]{7,15}$/.test(identifier);
  if (isPhone) {
    let phone = identifier;
    if (phone.startsWith("00")) {
      phone = "+" + phone.slice(2);
    } else if (!phone.startsWith("+")) {
      phone = "+" + phone;
    }
    loginPayload = {
      phone,
      password
    };
  } else {
    loginPayload = {
      email: identifier,
      password
    };
  }
  const { data, error } = await supabase.auth.signInWithPassword(loginPayload);
  if (error) {
    return json({
      message: error.message
    }, 401);
  }
  return json({
    token: data.session.access_token,
    user: data.user
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
