// File: functions/users/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleGetUser, handleListUsers, handleGetCurrentUser } from "./get.ts";
import { handleUpdateUser } from "./update.ts";
import { handleBulkUpdateUsers } from "./bulk.ts";
import { handleUploadAvatar } from "./upload-avatar.ts";
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
  const path = url.pathname.split("/").pop();
  const method = req.method;
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? ""
      }
    }
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  try {
    if (method === "GET" && path === "current") {
      return withCors(await handleGetCurrentUser(req, supabase, user, authError));
    }
    if (method === "GET") {
      const hasId = url.searchParams.has("id") || url.searchParams.has("user_id");
      return withCors(hasId ? await handleGetUser(req, supabase, user, authError) : await handleListUsers(req, supabase, user, authError));
    }
    if (method === "PUT" && path === "bulk") {
      return withCors(await handleBulkUpdateUsers(req, supabase, user, authError));
    }
    if (method === "PUT" && path === "avatar") {
      return withCors(await handleUploadAvatar(req, supabase, user, authError));
    }
    if (method === "PUT") {
      return withCors(await handleUpdateUser(req, supabase, user, authError));
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
