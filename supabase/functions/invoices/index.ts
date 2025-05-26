// File: functions/invoices/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hono } from 'jsr:@hono/hono';
import { cors } from 'jsr:@hono/hono/cors';
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleGetInvoice, handleListInvoices, handleFilterInvoices } from "./get.ts";
import { handleCreateInvoice, handleCreateInvoiceFromOrder } from "./create.ts";
import { handleUpdateInvoice } from "./update.ts";
import { handleDeleteInvoice } from "./delete.ts";
import { handleBulkCreateInvoices, handleBulkDeleteInvoices } from "./bulk.ts";
import { handleUpdateInvoiceStatus, handleMarkInvoicePaid } from "./update-status.ts";
import { handleAddInvoiceItem, handleUpdateInvoiceItem, handleDeleteInvoiceItem } from "./items.ts";
import { handleGenerateInvoicePDF } from "./generate-pdf.ts";

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

// Get invoice by invoice number or ID
app.get('/:identifier', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const identifier = c.req.param('identifier');
  
  // Create a modified request with identifier as query parameter
  const url = new URL(c.req.url);
  url.searchParams.set('identifier', identifier);
  const modifiedRequest = new Request(url.toString(), {
    method: c.req.method,
    headers: c.req.raw.headers,
    body: c.req.raw.body
  });
  
  return await handleGetInvoice(modifiedRequest, supabase, user);
});

// Invoice items management
app.post('/items', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleAddInvoiceItem(c.req.raw, supabase, user, authError);
});

app.put('/items', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleUpdateInvoiceItem(c.req.raw, supabase, user, authError);
});

app.delete('/items', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleDeleteInvoiceItem(c.req.raw, supabase, user, authError);
});

// Status management
app.patch('/status', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleUpdateInvoiceStatus(c.req.raw, supabase, user, authError);
});

app.patch('/mark-paid', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleMarkInvoicePaid(c.req.raw, supabase, user, authError);
});

// PDF generation
app.post('/generate-pdf', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleGenerateInvoicePDF(c.req.raw, supabase, user, authError);
});

// Main routes
app.get('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const url = new URL(c.req.url);
  const identifier = url.searchParams.get("identifier") || url.searchParams.get("invoice_number");
  
  if (identifier) {
    return await handleGetInvoice(c.req.raw, supabase, user);
  }
  return await handleListInvoices(c.req.raw, supabase, user);
});

app.post('/filter', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  return await handleFilterInvoices(c.req.raw, supabase, user);
});

app.post('/from-order', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleCreateInvoiceFromOrder(c.req.raw, supabase, user, authError);
});

app.post('/bulk-create', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleBulkCreateInvoices(c.req.raw, supabase, user, authError);
});

app.delete('/bulk-delete', async (c) => {
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
