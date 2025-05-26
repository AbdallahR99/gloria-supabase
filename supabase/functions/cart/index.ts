// File: functions/cart/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hono } from 'jsr:@hono/hono';
import { cors } from 'jsr:@hono/hono/cors';
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleGetCart } from "./get.ts";
import { handleBulkCreateCartItems, handleBulkDeleteCartItems } from "./bulk.ts";
import { handleUpsertCartItem } from "./upsert.ts";
import { handleCreateCartItem } from "./create.ts";
import { handleUpdateCartItem } from "./update.ts";
import { handleDeleteCartItem } from "./delete.ts";
import { handleGetCartSummary } from "./summary.ts";
import { handleCartCount } from "./count.ts";
import { handleUpdateCartItemQuantity } from "./update-quantity.ts";
import { handleAddBundleToCart } from "./add-bundle.ts";

const app = new Hono().basePath('/cart');

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
app.post('/upsert', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleUpsertCartItem(c.req.raw, supabase, user, authError);
});

app.post('/bulk', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleBulkCreateCartItems(c.req.raw, supabase, user, authError);
});

app.post('/bundle', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleAddBundleToCart(c.req.raw, supabase, user, authError);
});

app.put('/update-quantity', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleUpdateCartItemQuantity(c.req.raw, supabase, user, authError);
});

app.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleCreateCartItem(c.req.raw, supabase, user, authError);
});

app.put('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleUpdateCartItem(c.req.raw, supabase, user, authError);
});

app.delete('/bulk', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleBulkDeleteCartItems(c.req.raw, supabase, user, authError);
});

app.delete('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleDeleteCartItem(c.req.raw, supabase, user, authError);
});

app.get('/count', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleCartCount(c.req.raw, supabase, user, authError);
});

app.get('/summary', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleGetCartSummary(c.req.raw, supabase, user, authError);
});

app.get('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleGetCart(c.req.raw, supabase, user, authError);
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
