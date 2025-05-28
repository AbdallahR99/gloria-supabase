// File: functions/reviews/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hono } from 'jsr:@hono/hono';
import { cors } from 'jsr:@hono/hono/cors';
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleCreateReview } from "./create.ts";
import { handleUpdateReview } from "./update.ts";
import { handleDeleteReview } from "./delete.ts";
import { handleGetReviews } from "./get.ts";
import { handleBulkCreateReviews, handleBulkDeleteReviews } from "./bulk.ts";
import { handleGetRatingDistribution, handleGetMultipleRatingDistributions } from "./rating-distribution.ts";

const app = new Hono().basePath('/reviews');

// Add CORS middleware
app.use('*', cors({
  origin: '*',
  allowHeaders: ['*'],
  allowMethods: ['*'],
}));

app.options('*', (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', '*');
  c.header('Access-Control-Allow-Headers', '*');
  return c.text('ok', 204);
});

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
app.post('/bulk', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleBulkCreateReviews(c.req.raw, supabase, user, authError);
});

app.delete('/bulk', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleBulkDeleteReviews(c.req.raw, supabase, user, authError);
});

app.get('/rating-distribution', async (c) => {
  const supabase = c.get('supabase');
  return await handleGetRatingDistribution(c.req.raw, supabase);
});

app.post('/rating-distribution', async (c) => {
  const supabase = c.get('supabase');
  return await handleGetMultipleRatingDistributions(c.req.raw, supabase);
});

app.post('/filter', async (c) => {
  const supabase = c.get('supabase');
  return await handleGetReviews(c.req.raw, supabase, true);
});

app.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleCreateReview(c.req.raw, supabase, user, authError);
});

app.put('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleUpdateReview(c.req.raw, supabase, user, authError);
});

app.delete('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const authError = c.get('authError');
  return await handleDeleteReview(c.req.raw, supabase, user, authError);
});

app.get('/', async (c) => {
  const supabase = c.get('supabase');
  return await handleGetReviews(c.req.raw, supabase);
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
