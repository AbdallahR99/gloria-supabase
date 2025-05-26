// File: functions/orders/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleCheckoutOrder } from "./checkout.ts";
import { handleGetOrder, handleListOrders } from "./get.ts";
import { handleUpdateOrderStatus } from "./update-status.ts";
import { handleCreateOrder } from "./create.ts";
import { handleUpdateOrder } from "./update.ts";
import { handleDeleteOrder } from "./delete.ts";
import { handleBulkCreateOrders, handleBulkDeleteOrders } from "./bulk.ts";
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
    if (method === "POST" && path === "checkout") {
      return withCors(await handleCheckoutOrder(req, supabase, user, authError));
    }
    if (method === "POST" && path === "bulk") {
      return withCors(await handleBulkCreateOrders(req, supabase, user, authError));
    }
    if (method === "POST" && path === "filter") {
      return withCors(await handleListOrders(req, supabase, user, authError));
    }
    if (method === "POST") {
      return withCors(await handleCreateOrder(req, supabase, user, authError));
    }
    if (method === "PUT" && path === "status") {
      return withCors(await handleUpdateOrderStatus(req, supabase, user, authError));
    }
    if (method === "PUT") {
      return withCors(await handleUpdateOrder(req, supabase, user, authError));
    }
    if (method === "DELETE" && path === "bulk") {
      return withCors(await handleBulkDeleteOrders(req, supabase, user, authError));
    }
    if (method === "DELETE") {
      return withCors(await handleDeleteOrder(req, supabase, user, authError));
    }
    if (method === "GET") {
      return withCors(await handleGetOrder(req, supabase, user, authError));
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
