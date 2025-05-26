// File: functions/products/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleGetProduct, handleListProducts, handleFilterProducts } from "./get.ts";
import { handleCreateProduct } from "./create.ts";
import { handleUpdateProduct } from "./update.ts";
import { handleDeleteProduct } from "./delete.ts";
import { handleBulkCreateProducts, handleBulkDeleteProducts } from "./bulk.ts";
import { handleRelatedProducts } from "./related.ts";
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
  if (req.method === 'OPTIONS') {
    return withCors(new Response('ok'));
  }
  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method;
  const path = pathname.split("/").pop();
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? ""
      }
    }
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  try {
    if (method === "GET" && path === "related") {
      return withCors(await handleRelatedProducts(req, supabase, user));
    }
    if (method === "GET") {
      const slug = url.searchParams.get("slug");
      if (slug) return withCors(await handleGetProduct(req, supabase, user));
      return withCors(await handleListProducts(req, supabase, user));
    }
    if (method === "POST" && path === "filter") {
      return withCors(await handleFilterProducts(req, supabase, user, url));
    }
    if (method === "POST" && path === "bulk-create") {
      return withCors(await handleBulkCreateProducts(req, supabase, user, authError));
    }
    if (method === "DELETE" && path === "bulk-delete") {
      return withCors(await handleBulkDeleteProducts(req, supabase, user, authError));
    }
    if (method === "POST") {
      return withCors(await handleCreateProduct(req, supabase, user, authError));
    }
    if (method === "PUT") {
      return withCors(await handleUpdateProduct(req, supabase, user, authError));
    }
    if (method === "DELETE") {
      return withCors(await handleDeleteProduct(req, supabase, user, authError));
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
