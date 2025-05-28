// File: functions/invoices/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hono } from 'jsr:@hono/hono';
import { cors } from 'jsr:@hono/hono/cors';
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleGetInvoice, handleListInvoices } from "./get.ts";
import { handleCreateInvoice, handleCreateInvoiceFromOrder } from "./create.ts";
import { handleUpdateInvoice } from "./update.ts";
import { handleDeleteInvoice } from "./delete.ts";
import { handleBulkCreateInvoices, handleBulkDeleteInvoices } from "./bulk.ts";

const app = new Hono().basePath('/invoices');

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
app.get('/code/:code', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  const code = c.req.param('code');
  
  // Create a modified request with code as query parameter for compatibility
  const url = new URL(c.req.url);
  url.searchParams.set('invoice_code', code);
  const modifiedRequest = new Request(url.toString(), {
    method: c.req.method,
    headers: c.req.raw.headers,
    body: c.req.raw.body
  });
  
  return await handleGetInvoice(modifiedRequest, supabase, user, authError);
});

app.get('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  const url = new URL(c.req.url);
  const invoiceId = url.searchParams.get("invoice_id");
  const invoiceCode = url.searchParams.get("invoice_code");
  
  if (invoiceId || invoiceCode) {
    return await handleGetInvoice(c.req.raw, supabase, user, authError);
  }
  return await handleListInvoices(c.req.raw, supabase, user, authError);
});

app.post('/filter', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleListInvoices(c.req.raw, supabase, user, authError);
});

app.post('/from-order', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleCreateInvoiceFromOrder(c.req.raw, supabase, user, authError);
});

app.post('/bulk', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleBulkCreateInvoices(c.req.raw, supabase, user, authError);
});

app.delete('/bulk', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleBulkDeleteInvoices(c.req.raw, supabase, user, authError);
});

app.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleCreateInvoice(c.req.raw, supabase, user, authError);
});

app.put('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleUpdateInvoice(c.req.raw, supabase, user, authError);
});

app.delete('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleDeleteInvoice(c.req.raw, supabase, user, authError);
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
