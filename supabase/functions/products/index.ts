// File: functions/products/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hono } from 'jsr:@hono/hono';
import { cors } from 'jsr:@hono/hono/cors';
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleGetProduct, handleListProducts, handleFilterProducts } from "./get.ts";
import { handleCreateProduct } from "./create.ts";
import { handleUpdateProduct } from "./update.ts";
import { handleDeleteProduct } from "./delete.ts";
import { handleBulkCreateProducts, handleBulkDeleteProducts } from "./bulk.ts";
import { handleRelatedProducts } from "./related.ts";

const app = new Hono().basePath('/products');

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
app.get('/related', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  return await handleRelatedProducts(c.req.raw, supabase, user);
});

app.get('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const url = new URL(c.req.url);
  const slug = url.searchParams.get("slug");
  
  if (slug) {
    return await handleGetProduct(c.req.raw, supabase, user);
  }
  return await handleListProducts(c.req.raw, supabase, user);
});

app.post('/filter', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const url = new URL(c.req.url);
  return await handleFilterProducts(c.req.raw, supabase, user, url);
});

app.post('/bulk-create', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleBulkCreateProducts(c.req.raw, supabase, user, authError);
});

app.delete('/bulk-delete', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleBulkDeleteProducts(c.req.raw, supabase, user, authError);
});

app.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleCreateProduct(c.req.raw, supabase, user, authError);
});

app.put('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleUpdateProduct(c.req.raw, supabase, user, authError);
});

app.delete('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleDeleteProduct(c.req.raw, supabase, user, authError);
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
