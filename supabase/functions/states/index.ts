// File: functions/states/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleGetStates } from "./get.ts";
import { handleCreateState } from "./create.ts";
import { handleUpdateState } from "./update.ts";
import { handleDeleteState } from "./delete.ts";
import { handleBulkCreateStates, handleBulkDeleteStates } from "./bulk.ts";
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
    if (method === "POST" && path === "bulk") {
      return withCors(await handleBulkCreateStates(req, supabase, user, authError));
    }
    if (method === "DELETE" && path === "bulk") {
      return withCors(await handleBulkDeleteStates(req, supabase, user, authError));
    }
    if (method === "POST") {
      return withCors(await handleCreateState(req, supabase, user, authError));
    }
    if (method === "PUT") {
      return withCors(await handleUpdateState(req, supabase, user, authError));
    }
    if (method === "DELETE") {
      return withCors(await handleDeleteState(req, supabase, user, authError));
    }
    if (method === "GET") {
      return withCors(await handleGetStates(req, supabase));
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
