// File: functions/products/bulk.ts
import { validateSKU, checkSKUExists } from './sku-utils.ts';

export async function handleBulkCreateProducts(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const body = await req.json();
  if (!Array.isArray(body)) throw new Error("Expected array of product objects");
  
  // Validate all SKUs if provided
  const productsWithSKU = body.filter(p => p.sku);
  if (productsWithSKU.length > 0) {
    // Validate SKU format
    for (const product of productsWithSKU) {
      const validation = validateSKU(product.sku);
      if (!validation.isValid) {
        throw new Error(`Invalid SKU '${product.sku}': ${validation.error}`);
      }
    }
    
    // Check for duplicate SKUs within the batch
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
  
  const timestamp = new Date().toISOString();
  const data = body.map((p)=>({
      ...p,
      created_at: timestamp,
      updated_at: timestamp,
      created_by: user.email,
      updated_by: user.email,
      is_deleted: false,
      is_banned: false
    }));
  const { data: inserted, error } = await supabase.from("products").insert(data).select();
  if (error) throw error;
  return json(inserted, 201);
}
export async function handleBulkDeleteProducts(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  if (!Array.isArray(body)) throw new Error("Expected array of product IDs");
  const { data, error } = await supabase.from("products").update({
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by: user.id
  }).in("id", body).select();
  if (error) throw error;
  return json(data);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
