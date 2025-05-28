// File: functions/reviews/update.ts
import { createClient } from "jsr:@supabase/supabase-js@2";

export async function handleUpdateReview(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { id, rating, comment, imageFile } = body;
  if (!id) return json({
    message: "Missing review ID"
  }, 400);
  let uploadedImage;
  if (imageFile) {
     const adminSupabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
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
    uploadedImage = filename;
  }
  const updateData = {
    rating,
    comment,
    updated_at: new Date().toISOString(),
    updated_by: user.email
  };
  if (uploadedImage) updateData.image = uploadedImage;
  const { data, error } = await supabase.from("reviews").update(updateData).eq("id", id).select().single();
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
