// File: functions/invoices/index.js
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hono } from 'jsr:@hono/hono';
import { cors } from 'jsr:@hono/hono/cors';
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleGetInvoice, handleGetInvoiceByCode, handleListInvoices } from "./get.js";
import { handleCreateManualInvoice, handleCreateInvoiceFromOrder } from "./create.js";
import { handleUpdateInvoice } from "./update.js";
import { handleDeleteInvoice } from "./delete.js";
import { handleBulkCreateInvoices, handleBulkDeleteInvoices } from "./bulk.js";
import { handleGetInvoicePDF } from "./pdf.js";
import { handleUpdatePaymentStatus } from "./update-payment-status.js";

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
app.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleCreateManualInvoice(c.req.raw, supabase, user, authError);
});

app.post('/from-order', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleCreateInvoiceFromOrder(c.req.raw, supabase, user, authError);
});

app.get('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleListInvoices(c.req.raw, supabase, user, authError);
});

app.get('/code/:code', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleGetInvoiceByCode(c.req.raw, supabase, user, authError);
});

app.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleGetInvoice(c.req.raw, supabase, user, authError);
});

app.put('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleUpdateInvoice(c.req.raw, supabase, user, authError);
});

app.delete('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleDeleteInvoice(c.req.raw, supabase, user, authError);
});

app.get('/:id/pdf', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleGetInvoicePDF(c.req.raw, supabase, user, authError);
});

// Bulk operations
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

// Payment status updates
app.put('/:id/payment-status', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleUpdatePaymentStatus(c.req.raw, supabase, user, authError);
});

// Export for deployment
Deno.serve(app.fetch);
