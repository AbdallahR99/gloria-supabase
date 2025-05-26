// File: functions/reviews/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleCreateReview } from "./create.ts";
import { handleUpdateReview } from "./update.ts";
import { handleDeleteReview } from "./delete.ts";
import { handleGetReviews } from "./get.ts";
import { handleBulkCreateReviews, handleBulkDeleteReviews } from "./bulk.ts";
import { handleGetRatingDistribution, handleGetMultipleRatingDistributions } from "./rating-distribution.ts";
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
      return withCors(await handleBulkCreateReviews(req, supabase, user, authError));
    }
    if (method === "DELETE" && path === "bulk") {
      return withCors(await handleBulkDeleteReviews(req, supabase, user, authError));
    }
    if (method === "GET" && path === "rating-distribution") {
      return withCors(await handleGetRatingDistribution(req, supabase));
    }
    if (method === "POST" && path === "rating-distribution") {
      return withCors(await handleGetMultipleRatingDistributions(req, supabase));
    }
    if (method === "POST" && path === "filter") {
      return withCors(await handleGetReviews(req, supabase, true));
    }
    if (method === "POST") {
      return withCors(await handleCreateReview(req, supabase, user, authError));
    }
    if (method === "PUT") {
      return withCors(await handleUpdateReview(req, supabase, user, authError));
    }
    if (method === "DELETE") {
      return withCors(await handleDeleteReview(req, supabase, user, authError));
    }
    if (method === "GET") {
      return withCors(await handleGetReviews(req, supabase));
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
