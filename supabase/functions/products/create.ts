/**
 * Product Creation Handler
 * File: functions/products/create.ts
 * 
 * This file handles the creation of new products in the e-commerce system.
 * It includes validation for SKU uniqueness, image upload functionality,
 * and comprehensive error handling.
 * 
 **/

import { validateSKU, checkSKUExists } from './sku-utils.ts';

/**
 * Handles the creation of a new product
 * 
 * @param {Request} req - The HTTP request object containing product data
 * @param {SupabaseClient} supabase - Supabase client instance for database operations
 * @param {User} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with created product data or error
 */
export async function handleCreateProduct(req, supabase, user, authError) {
  // Check if user is authenticated and authorized
  if (authError || !user) throw new Error("Unauthorized");
  
  // Parse the request body to get product data
  const body = await req.json();
  
  // Validate and check SKU uniqueness if provided
  if (body.sku) {
    // Validate SKU format (alphanumeric, hyphens, underscores, dots only)
    const validation = validateSKU(body.sku);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }
    
    // Check if SKU already exists in the database
    const skuExists = await checkSKUExists(supabase, body.sku);
    if (skuExists) {
      throw new Error(`Product with SKU '${body.sku}' already exists`);
    }
  }
  
  // Handle image upload if imageFile is provided as base64
  if (body.imageFile) {
    body.image = await uploadImage(supabase, body.imageFile);
  }
  const timestamp = new Date().toISOString();
  const data = {
    ...body,
    created_at: timestamp,
    updated_at: timestamp,
    created_by: user.email,
    updated_by: user.email,
    is_deleted: false,
    is_banned: false
  };
  const { data: inserted, error } = await supabase.from("products").insert([
    data
  ]).select().single();
  if (error) throw error;
  return json(inserted, 201);
}
async function uploadImage(supabase, imageFile) {
  const matches = imageFile.match(/^data:(image\/[^;]+);base64,(.+)$/);
  const mimeType = matches?.[1] ?? "image/png";
  const base64 = matches?.[2] ?? imageFile;
  const buffer = Uint8Array.from(atob(base64), (c)=>c.charCodeAt(0));
  const ext = mimeType.split("/")[1];
  const filename = `products/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("public").upload(filename, buffer, {
    contentType: mimeType,
    upsert: true
  });
  if (error) throw error;
  return supabase.storage.from("public").getPublicUrl(filename).data.publicUrl;
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}

/**
 * cURL Examples for Postman Import:
 * 
 * Basic Product Creation:
 */

/*
curl -X POST "{{supabase_url}}/functions/v1/products" \
  -H "Authorization: Bearer {{auth_token}}" \
  -H "Content-Type: application/json" \
  -H "apikey: {{supabase_anon_key}}" \
  -d '{
    "name_en": "Amber Musk Perfume",
    "name_ar": "عطر العنبر والمسك",
    "description_en": "A luxurious fragrance with amber and musk notes",
    "description_ar": "عطر فاخر بنفحات العنبر والمسك",
    "sku": "PERF-AMBER-001",
    "price": 49.99,
    "old_price": 59.99,
    "quantity": 100,
    "category_id": "123e4567-e89b-12d3-a456-426614174000",
    "slug": "amber-musk-perfume",
    "slug_ar": "عطر-العنبر-والمسك",
    "thumbnail": "https://example.com/image.jpg",
    "images": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
    "sizes": ["50ml", "100ml"],
    "colors": [{"name": "Gold", "value": "#FFD700"}],
    "meta_title_en": "Amber Musk Perfume - Premium Fragrance",
    "meta_title_ar": "عطر العنبر والمسك - عطر فاخر",
    "meta_description_en": "Premium amber and musk perfume for special occasions",
    "meta_description_ar": "عطر فاخر بالعنبر والمسك للمناسبات الخاصة",
    "keywords": "perfume, amber, musk, fragrance, luxury"
  }'
*/

/*
curl -X POST "{{supabase_url}}/functions/v1/products" \
  -H "Authorization: Bearer {{auth_token}}" \
  -H "Content-Type: application/json" \
  -H "apikey: {{supabase_anon_key}}" \
  -d '{
    "name_en": "Rose Garden Fragrance",
    "sku": "FRAG-ROSE-002",
    "price": 29.99,
    "quantity": 50,
    "category_id": "123e4567-e89b-12d3-a456-426614174000"
  }'
*/