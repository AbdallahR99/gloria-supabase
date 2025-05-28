// File: functions/reviews/create.ts
import { createClient } from "jsr:@supabase/supabase-js@2";

export async function handleCreateReview(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { product_id, rating, comment, images, user_id } = body;
  if (!product_id || !rating) return json({
    message: "Missing product_id or rating"
  }, 400);
  const now = new Date().toISOString();
  const uploadedImages = [];
  if (Array.isArray(images)) {
      const adminSupabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    for (const imageFile of images){
      if (!imageFile) continue;
      const matches = imageFile.match(/^data:(image\/[^;]+);base64,(.+)$/);
      const mimeType = matches?.[1] ?? "image/png";
      const base64 = matches?.[2] ?? imageFile;
      const ext = mimeType.split("/")[1];
      const buffer = Uint8Array.from(atob(base64), (c)=>c.charCodeAt(0));
      const filename = `reviews/review_${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await adminSupabase.storage.from("images").upload(filename, buffer, {
        contentType: mimeType,
        upsert: true
      });
      if (uploadError) throw uploadError;
      uploadedImages.push(filename);
    }
  }
  const { data, error } = await supabase.from("reviews").insert({
    product_id,
    rating,
    comment,
    images: uploadedImages,
    user_id: user_id ?? user.id,
    created_at: now,
    updated_at: now,
    created_by: user.email,
    updated_by: user.email,
    is_deleted: false
  }).select().single();
  if (error) throw error;
  return json(data, 201);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
