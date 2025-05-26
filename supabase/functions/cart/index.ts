// File: functions/cart/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleGetCart } from "./get.ts";
import { handleBulkCreateCartItems, handleBulkDeleteCartItems } from "./bulk.ts";
import { handleUpsertCartItem } from "./upsert.ts";
import { handleCreateCartItem } from "./create.ts";
import { handleUpdateCartItem } from "./update.ts";
import { handleDeleteCartItem } from "./delete.ts";
import { handleGetCartSummary } from "./summary.ts";
import { handleCartCount } from "./count.ts";
import { handleUpdateCartItemQuantity } from "./update-quantity.ts";
import { handleAddBundleToCart } from "./add-bundle.ts";
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
    if (method === "POST" && path === "upsert") {
      return withCors(await handleUpsertCartItem(req, supabase, user, authError));
    }
    if (method === "POST" && path === "bulk") {
      return withCors(await handleBulkCreateCartItems(req, supabase, user, authError));
    }
    if (method === "POST" && path === "bundle") {
      return withCors(await handleAddBundleToCart(req, supabase, user, authError));
    }
    if (method === "PUT" && path === "update-quantity") {
      return withCors(await handleUpdateCartItemQuantity(req, supabase, user, authError));
    }
    if (method === "POST") {
      return withCors(await handleCreateCartItem(req, supabase, user, authError));
    }
    if (method === "PUT") {
      return withCors(await handleUpdateCartItem(req, supabase, user, authError));
    }
    if (method === "DELETE" && path === "bulk") {
      return withCors(await handleBulkDeleteCartItems(req, supabase, user, authError));
    }
    if (method === "DELETE") {
      return withCors(await handleDeleteCartItem(req, supabase, user, authError));
    }
    // inside the serve block:
    if (method === "GET" && path === "count") {
      return withCors(await handleCartCount(req, supabase, user, authError));
    }
    if (method === "GET" && path === "summary") {
      return withCors(await handleGetCartSummary(req, supabase, user, authError));
    }
    if (method === "GET") {
      return withCors(await handleGetCart(req, supabase, user, authError));
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
