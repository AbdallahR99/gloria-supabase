// File: functions/categories/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleGetCategory } from "./get.ts";
import { handleCreateCategory } from "./create.ts";
import { handleUpdateCategory } from "./update.ts";
import { handleDeleteCategory } from "./delete.ts";
import { handleBulkCreateCategories, handleBulkDeleteCategories } from "./bulk.ts";
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
    if (method === "GET") {
      return withCors(await handleGetCategory(req, supabase));
    }
    if (method === "POST" && path === "bulk") {
      return withCors(await handleBulkCreateCategories(req, supabase, user, authError));
    }
    if (method === "POST") {
      return withCors(await handleCreateCategory(req, supabase, user, authError));
    }
    if (method === "PUT") {
      return withCors(await handleUpdateCategory(req, supabase, user, authError));
    }
    if (method === "DELETE" && path === "bulk") {
      return withCors(await handleBulkDeleteCategories(req, supabase, user, authError));
    }
    if (method === "DELETE") {
      return withCors(await handleDeleteCategory(req, supabase, user, authError));
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
