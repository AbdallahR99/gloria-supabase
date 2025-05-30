// File: functions/vouchers/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hono } from 'jsr:@hono/hono';
import { cors } from 'jsr:@hono/hono/cors';
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleGetVoucher, handleListVouchers } from "./get.ts";
import { handleCreateVoucher } from "./create.ts";
import { handleUpdateVoucher } from "./update.ts";
import { handleDeleteVoucher } from "./delete.ts";
import { handleBulkCreateVouchers, handleBulkDeleteVouchers } from "./bulk.ts";

const app = new Hono().basePath('/vouchers');

// Add CORS middleware
app.use('*', cors({
  origin: '*',
  allowHeaders: ['*'],
  allowMethods: ['*'],
}));

// Middleware to create Supabase client and get user (no authentication required)
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
  
  // Get user but don't require authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  c.set('supabase', supabase);
  c.set('user', user);
  c.set('authError', authError);
  
  await next();
});

// Routes
app.get('/code/:code', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  const code = c.req.param('code');
  
  // Create a modified request with code as query parameter for compatibility
  const url = new URL(c.req.url);
  url.searchParams.set('voucher_code', code);
  const modifiedRequest = new Request(url.toString(), {
    method: c.req.method,
    headers: c.req.raw.headers,
    body: c.req.raw.body
  });
  
  return await handleGetVoucher(modifiedRequest, supabase, user, authError);
});

app.get('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  const url = new URL(c.req.url);
  const voucherId = url.searchParams.get("voucher_id");
  const voucherCode = url.searchParams.get("voucher_code");
  
  if (voucherId || voucherCode) {
    return await handleGetVoucher(c.req.raw, supabase, user, authError);
  }
  return await handleListVouchers(c.req.raw, supabase, user, authError);
});

app.post('/filter', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleListVouchers(c.req.raw, supabase, user, authError);
});

app.post('/bulk', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleBulkCreateVouchers(c.req.raw, supabase, user, authError);
});

app.delete('/bulk', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleBulkDeleteVouchers(c.req.raw, supabase, user, authError);
});

app.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleCreateVoucher(c.req.raw, supabase, user, authError);
});

app.put('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleUpdateVoucher(c.req.raw, supabase, user, authError);
});

app.delete('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleDeleteVoucher(c.req.raw, supabase, user, authError);
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
