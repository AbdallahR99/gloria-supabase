// File: functions/users/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hono } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleGetUser, handleListUsers, handleGetCurrentUser } from "./get.ts";
import { handleUpdateUser } from "./update.ts";
import { handleBulkUpdateUsers } from "./bulk.ts";
import { handleUploadAvatar } from "./upload-avatar.ts";

const app = new Hono().basePath("/users");

app.use("*", cors());

// Middleware to create Supabase client and get user
app.use("*", async (c, next) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: {
          Authorization: c.req.header("Authorization") ?? "",
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  c.set("supabase", supabase);
  c.set("user", user);
  c.set("authError", authError);

  await next();
});

// Routes
app.get("/current", async (c) => {
  const supabase = c.get("supabase");
  const user = c.get("user");
  const authError = c.get("authError");
  return await handleGetCurrentUser(c.req.raw, supabase, user, authError);
});

app.get("/", async (c) => {
  const supabase = c.get("supabase");
  const user = c.get("user");
  const authError = c.get("authError");
  const url = new URL(c.req.url);
  const hasId = url.searchParams.has("id") || url.searchParams.has("user_id");
  return hasId 
    ? await handleGetUser(c.req.raw, supabase, user, authError)
    : await handleListUsers(c.req.raw, supabase, user, authError);
});

app.put("/bulk", async (c) => {
  const supabase = c.get("supabase");
  const user = c.get("user");
  const authError = c.get("authError");
  return await handleBulkUpdateUsers(c.req.raw, supabase, user, authError);
});

app.put("/avatar", async (c) => {
  const supabase = c.get("supabase");
  const user = c.get("user");
  const authError = c.get("authError");
  return await handleUploadAvatar(c.req.raw, supabase, user, authError);
});

app.put("/", async (c) => {
  const supabase = c.get("supabase");
  const user = c.get("user");
  const authError = c.get("authError");
  return await handleUpdateUser(c.req.raw, supabase, user, authError);
});

app.notFound((c) => {
  return c.text("Not Found", 404);
});

app.onError((err, c) => {
  return c.json({
    message: err?.message ?? String(err),
  }, 500);
});

Deno.serve(app.fetch);
