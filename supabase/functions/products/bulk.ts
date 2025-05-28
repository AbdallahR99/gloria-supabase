/**
 * Bulk Product Operations Handler
 * File: functions/products/bulk.ts
 * 
 * This file handles bulk operations for products including:
 * - Bulk product creation with comprehensive validation
 * - Bulk product deletion (soft delete)
 * 
 * Features:
 * - SKU validation and uniqueness checking across batches
 * - Duplicate detection within single batch
 * - Comprehensive error handling with detailed messages
 * - Audit trail for all operations
 */

import { validateSKU, checkSKUExists } from './sku-utils.ts';

/**
 * Handles bulk creation of multiple products
 * 
 * @param {Request} req - HTTP request object containing array of product data
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {User} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with created products array or error
 */
export async function handleBulkCreateProducts(req, supabase, user, authError) {
  // Check if user is authenticated and authorized
  if (authError || !user) throw new Error("Unauthorized");
  
  // Parse request body and validate it's an array
  const body = await req.json();
  if (!Array.isArray(body)) throw new Error("Expected array of product objects");
  
  // Validate all SKUs if provided
  const productsWithSKU = body.filter(p => p.sku);
  if (productsWithSKU.length > 0) {
    // Validate SKU format for each product
    for (const product of productsWithSKU) {
      const validation = validateSKU(product.sku);
      if (!validation.isValid) {
        throw new Error(`Invalid SKU '${product.sku}': ${validation.error}`);
      }
    }
    
    // Check for duplicate SKUs within the current batch
    const skuSet = new Set();
    const batchDuplicates = [];
    for (const product of productsWithSKU) {
      if (skuSet.has(product.sku)) {
        batchDuplicates.push(product.sku);
      } else {
        skuSet.add(product.sku);
      }
    }
    if (batchDuplicates.length > 0) {
      throw new Error(`Duplicate SKUs in batch: ${batchDuplicates.join(', ')}`);
    }
    
    // Check for existing SKUs in database
    const skusToCheck = productsWithSKU.map(p => p.sku);
    const { data: existingProducts, error: skuCheckError } = await supabase
      .from("products")
      .select("sku")
      .in("sku", skusToCheck)
      .eq("is_deleted", false);
    
    if (skuCheckError) throw skuCheckError;
    if (existingProducts && existingProducts.length > 0) {
      const duplicateSKUs = existingProducts.map(p => p.sku);
      throw new Error(`Products with SKUs already exist: ${duplicateSKUs.join(', ')}`);
    }
  }
  
  // Prepare data with audit trail information
  const timestamp = new Date().toISOString();
  const data = body.map((p) => ({
          ...p,
    created_at: timestamp,
    updated_at: timestamp,
    created_by: user.email,
    updated_by: user.email,
    is_deleted: false,
    is_banned: false
  }));
  
  // Insert all products in a single transaction
  const { data: inserted, error } = await supabase.from("products").insert(data).select();
  if (error) throw error;
  
  return json(inserted, 201);
}

/**
 * Handles bulk deletion (soft delete) of multiple products
 * 
 * @param {Request} req - HTTP request object containing array of product IDs
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {User} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with deleted products array or error
 */
export async function handleBulkDeleteProducts(req, supabase, user, authError) {
  // Check if user is authenticated and authorized
  if (authError || !user) throw new Error("Unauthorized");
  
  // Parse request body and validate it's an array of IDs
  const body = await req.json();
  if (!Array.isArray(body)) throw new Error("Expected array of product IDs");
  
  // Perform soft delete by updating is_deleted flag
  const { data, error } = await supabase.from("products").update({
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by: user.id
  }).in("id", body).select();
  
  if (error) throw error;
  return json(data);
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
 * Bulk Create Products:
 */

/*
curl -X POST "{{supabase_url}}/functions/v1/products/bulk-create" \
  -H "Authorization: Bearer {{auth_token}}" \
  -H "Content-Type: application/json" \
  -H "apikey: {{supabase_anon_key}}" \
  -d '[
    {
      "name_en": "Rose Garden Perfume",
      "name_ar": "عطر حديقة الورد",
      "sku": "PERF-ROSE-001",
      "price": 35.99,
      "quantity": 50,
      "category_id": "123e4567-e89b-12d3-a456-426614174000",
      "description_en": "Fresh rose fragrance"
    },
    {
      "name_en": "Lavender Dreams",
      "name_ar": "أحلام اللافندر",
      "sku": "PERF-LAV-002",
      "price": 29.99,
      "quantity": 75,
      "category_id": "123e4567-e89b-12d3-a456-426614174000",
      "description_en": "Calming lavender scent"
    },
    {
      "name_en": "Ocean Breeze",
      "sku": "PERF-OCEAN-003",
      "price": 42.99,
      "quantity": 30,
      "category_id": "123e4567-e89b-12d3-a456-426614174000"
    }
  ]'
*/

/**
 * Bulk Delete Products:
 */

/*
curl -X DELETE "{{supabase_url}}/functions/v1/products/bulk-delete" \
  -H "Authorization: Bearer {{auth_token}}" \
  -H "Content-Type: application/json" \
  -H "apikey: {{supabase_anon_key}}" \
  -d '[
    "123e4567-e89b-12d3-a456-426614174001",
    "123e4567-e89b-12d3-a456-426614174002",
    "123e4567-e89b-12d3-a456-426614174003"
  ]'
*/
