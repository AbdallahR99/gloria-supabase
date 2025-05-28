// File: functions/products/sku-utils.ts
export function validateSKU(sku: string): { isValid: boolean; error?: string } {
  if (!sku || typeof sku !== 'string') {
    return { isValid: false, error: 'SKU must be a non-empty string' };
  }

  // Remove whitespace
  const trimmedSKU = sku.trim();
  
  if (trimmedSKU.length === 0) {
    return { isValid: false, error: 'SKU cannot be empty or whitespace only' };
  }

  if (trimmedSKU.length > 100) {
    return { isValid: false, error: 'SKU must be 100 characters or less' };
  }

  // Allow alphanumeric characters, hyphens, underscores, and dots
  const skuRegex = /^[a-zA-Z0-9._-]+$/;
  if (!skuRegex.test(trimmedSKU)) {
    return { isValid: false, error: 'SKU can only contain letters, numbers, hyphens, underscores, and dots' };
  }

  return { isValid: true };
}

export async function checkSKUExists(supabase: any, sku: string, excludeId?: string): Promise<boolean> {
  let query = supabase
    .from("products")
    .select("id")
    .eq("sku", sku)
    .eq("is_deleted", false);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.maybeSingle();
  
  if (error) throw error;
  return !!data;
}

export function generateSKU(productName: string, categoryName?: string): string {
  // Generate a basic SKU from product name and category
  const cleanName = productName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 10);
  
  const cleanCategory = categoryName 
    ? categoryName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 5)
    : '';
  
  const timestamp = Date.now().toString().slice(-6);
  
  return `${cleanCategory ? cleanCategory + '-' : ''}${cleanName}-${timestamp}`.toUpperCase();
}
