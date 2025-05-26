// File: functions/products/create.ts
export async function handleCreateProduct(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
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
