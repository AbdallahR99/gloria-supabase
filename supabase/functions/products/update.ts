/**
 * Product Update Handler
 * File: functions/products/update.ts
 * 
 * This file handles updating existing products in the e-commerce system.
 * It includes validation for SKU uniqueness (excluding current product),
 * image upload functionality, and comprehensive error handling.
 * 
 * Features:
 * - SKU validation and uniqueness checking
 * - Image upload with base64 support
 * - Audit trail with updated_by and updated_at
 * - Comprehensive error handling
 */

import { validateSKU, checkSKUExists } from './sku-utils.ts';

/**
 * Handles updating an existing product
 * 
 * @param {Request} req - The HTTP request object containing product update data
 * @param {SupabaseClient} supabase - Supabase client instance for database operations
 * @param {User} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with updated product data or error
 */
export async function handleUpdateProduct(req, supabase, user, authError) {
  // Check if user is authenticated and authorized
  if (authError || !user) throw new Error("Unauthorized");
  
  // Parse the request body to get product update data
  const body = await req.json();
  const { id, imageFile, ...updateData } = body;
  
  // Validate that product ID is provided
  if (!id) throw new Error("Missing product ID");
  
  // Validate and check SKU uniqueness if being updated
  if (updateData.sku) {
    // Validate SKU format (alphanumeric, hyphens, underscores, dots only)
    const validation = validateSKU(updateData.sku);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }
    
    // Check if SKU already exists in database (excluding current product)
    const skuExists = await checkSKUExists(supabase, updateData.sku, id);
    if (skuExists) {
      throw new Error(`Product with SKU '${updateData.sku}' already exists`);
    }
  }
  
  // Handle image upload if imageFile is provided as base64
  if (imageFile) {
    updateData.image = await uploadImage(supabase, imageFile);
  }
  
  // Add audit trail information
  updateData.updated_at = new Date().toISOString();
  updateData.updated_by = user.email;
  // Update the product in the database
  const { data, error } = await supabase.from("products").update(updateData).eq("id", id).select().single();
  if (error) throw error;
  return json(data);
}

/**
 * Uploads an image file to Supabase storage
 * 
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {string} imageFile - Base64 encoded image data
 * @returns {string} Public URL of the uploaded image
 */
async function uploadImage(supabase, imageFile) {
  // Parse base64 image data
  const matches = imageFile.match(/^data:(image\/[^;]+);base64,(.+)$/);
  const mimeType = matches?.[1] ?? "image/png";
  const base64 = matches?.[2] ?? imageFile;
  const buffer = Uint8Array.from(atob(base64), (c)=>c.charCodeAt(0));
  const ext = mimeType.split("/")[1];
  const filename = `products/${crypto.randomUUID()}.${ext}`;
  
  // Upload to Supabase storage
  const { error } = await supabase.storage.from("images").upload(filename, buffer, {
    contentType: mimeType,
    upsert: true
  });
  if (error) throw error;
  
  // Return public URL
  return supabase.storage.from("images").getPublicUrl(filename).data.publicUrl;
}

/**
 * Creates a JSON response with proper headers
 * 
 * @param {any} data - Data to be serialized as JSON
 * @param {number} status - HTTP status code (default: 200)
 * @returns {Response} HTTP Response with JSON content
 */
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
 * Update Product with SKU:
 */

/*
curl -X PUT "{{supabase_url}}/functions/v1/products" \
  -H "Authorization: Bearer {{auth_token}}" \
  -H "Content-Type: application/json" \
  -H "apikey: {{supabase_anon_key}}" \
  -d '{
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name_en": "Updated Amber Musk Perfume",
    "name_ar": "عطر العنبر والمسك المحدث",
    "sku": "PERF-AMBER-001-V2",
    "price": 54.99,
    "old_price": 49.99,
    "quantity": 75,
    "description_en": "Updated luxurious fragrance with enhanced amber and musk notes",
    "meta_title_en": "Updated Amber Musk Perfume - Premium Fragrance"
  }'
*/

/*
curl -X PUT "{{supabase_url}}/functions/v1/products" \
  -H "Authorization: Bearer {{auth_token}}" \
  -H "Content-Type: application/json" \
  -H "apikey: {{supabase_anon_key}}" \
  -d '{
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "price": 39.99,
    "quantity": 120
  }'
*/
