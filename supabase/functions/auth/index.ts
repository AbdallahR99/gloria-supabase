// File: functions/auth/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleAuthLogin } from "./login.ts";
import { handleAuthRegister } from "./register.ts";
import { handleUpdatePhone } from "./update-phone.ts";
import { handleSetUserRoles } from "./set-roles.ts";
function withCors(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "*");
  headers.set("Access-Control-Allow-Methods", "*");
  return new Response(response.body, {
    status: response.status,
    headers
  });
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return withCors(new Response("ok"));
  }
  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method;
  const path = pathname.split("/").pop();
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? ""
      }
    }
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  try {
    if (method === "POST" && path === "login") {
      return withCors(await handleAuthLogin(req, supabase));
    }
    if (method === "POST" && path === "register") {
      return withCors(await handleAuthRegister(req, supabase));
    }
    if (method === "POST" && path === "update-phone") {
      return withCors(await handleUpdatePhone(req, supabase, user, authError));
    }
    if (method === "POST" && path === "set-roles") {
      return withCors(await handleSetUserRoles(req, supabase, user, authError));
    }
    return withCors(new Response("Not Found", {
      status: 404
    }));
  } catch (err) {
    return withCors(new Response(JSON.stringify({
      message: err?.message ?? String(err)
    }), {
      headers: {
        "Content-Type": "application/json"
      },
      status: 500
    }));
  }
});
