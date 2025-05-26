// File: functions/products/update.ts
import { validateSKU, checkSKUExists } from './sku-utils.ts';

export async function handleUpdateProduct(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const body = await req.json();
  const { id, imageFile, ...updateData } = body;
  
  if (!id) throw new Error("Missing product ID");
  
  // Validate and check SKU if being updated
  if (updateData.sku) {
    const validation = validateSKU(updateData.sku);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }
    
    const skuExists = await checkSKUExists(supabase, updateData.sku, id);
    if (skuExists) {
      throw new Error(`Product with SKU '${updateData.sku}' already exists`);
    }
  }
  
  if (imageFile) {
    updateData.image = await uploadImage(supabase, imageFile);
  }
  updateData.updated_at = new Date().toISOString();
  updateData.updated_by = user.email;
  const { data, error } = await supabase.from("products").update(updateData).eq("id", id).select().single();
  if (error) throw error;
  return json(data);
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
