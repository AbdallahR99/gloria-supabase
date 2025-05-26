// File: functions/favorites/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleToggleFavorite } from "./toggle.ts";
import { handleGetFavorites } from "./get.ts";
import { handleManageFavorite } from "./manage.ts";
import { handleCreateFavorite } from "./create.ts";
import { handleUpdateFavorite } from "./update.ts";
import { handleDeleteFavorite } from "./delete.ts";
import { handleBulkCreateFavorites, handleBulkDeleteFavorites } from "./bulk.ts";
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
      return withCors(await handleGetFavorites(req, supabase, user, authError));
    }
    if (method === "POST" && path === "toggle") {
      return withCors(await handleToggleFavorite(req, supabase, user, authError));
    }
    if (method === "POST" && path === "manage") {
      return withCors(await handleManageFavorite(req, supabase, user, authError));
    }
    if (method === "POST" && path === "bulk") {
      return withCors(await handleBulkCreateFavorites(req, supabase, user, authError));
    }
    if (method === "POST") {
      return withCors(await handleCreateFavorite(req, supabase, user, authError));
    }
    if (method === "PUT") {
      return withCors(await handleUpdateFavorite(req, supabase, user, authError));
    }
    if (method === "DELETE" && path === "bulk") {
      return withCors(await handleBulkDeleteFavorites(req, supabase, user, authError));
    }
    if (method === "DELETE") {
      return withCors(await handleDeleteFavorite(req, supabase, user, authError));
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
