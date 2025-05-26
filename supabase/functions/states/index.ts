// File: functions/states/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hono } from 'jsr:@hono/hono';
import { cors } from 'jsr:@hono/hono/cors';
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleGetStates } from "./get.ts";
import { handleCreateState } from "./create.ts";
import { handleUpdateState } from "./update.ts";
import { handleDeleteState } from "./delete.ts";
import { handleBulkCreateStates, handleBulkDeleteStates } from "./bulk.ts";

const app = new Hono().basePath('/states');

// Add CORS middleware
app.use('*', cors({
  origin: '*',
  allowHeaders: ['*'],
  allowMethods: ['*'],
}));

// Middleware to create Supabase client and get user
app.use('*', async (c, next) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "", 
    Deno.env.get("SUPABASE_ANON_KEY") ?? "", 
    {
      global: {
        headers: {
          Authorization: c.req.header("Authorization") ?? ""
        }
      }
    }
  );
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  c.set('supabase', supabase);
  c.set('user', user);
  c.set('authError', authError);
  
  await next();
});

// Routes
app.post('/states/bulk', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleBulkCreateStates(c.req.raw, supabase, user, authError);
});

app.delete('/states/bulk', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleBulkDeleteStates(c.req.raw, supabase, user, authError);
});

app.post('/states', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleCreateState(c.req.raw, supabase, user, authError);
});

app.put('/states', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleUpdateState(c.req.raw, supabase, user, authError);
});

app.delete('/states', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleDeleteState(c.req.raw, supabase, user, authError);
});

app.get('/states', async (c) => {
  const supabase = c.get('supabase');
  return await handleGetStates(c.req.raw, supabase);
});

// Error handling
app.onError((err, c) => {
  return c.json({
    message: err?.message ?? String(err)
  }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({ message: 'Not Found' }, 404);
});

Deno.serve(app.fetch);
