// File: functions/users/upload-avatar.ts
import { createClient } from "jsr:@supabase/supabase-js@2";
export async function handleUploadAvatar(req, supabase, user, authError) {
  if (authError || !user) {
    return json({
      message: "Unauthorized"
    }, 401);
  }
  const url = new URL(req.url);
  const targetUserId = url.searchParams.get("user_id") ?? user.id;
  if (!isValidUUID(targetUserId)) {
    return json({
      message: "Invalid or missing user_id (must be UUID)."
    }, 400);
  }
  const { avatar_base64 } = await req.json();
  const adminSupabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  // If base64 is empty/null, remove the avatar
  if (!avatar_base64 || avatar_base64.trim() === "") {
    const { error: updateError } = await adminSupabase.auth.admin.updateUserById(targetUserId, {
      user_metadata: {
        avatar: null // Remove avatar
      }
    });
    if (updateError) {
      return json({
        message: "Failed to remove avatar.",
        error: updateError.message
      }, 400);
    }
    return json({
      message: "Avatar removed successfully.",
      avatar: null
    });
  }
  // Handle avatar upload
  try {
    const buffer = Uint8Array.from(atob(avatar_base64.split(",").pop()), (c)=>c.charCodeAt(0));
    const filename = `avatar_${targetUserId}_${Date.now()}.png`;
    const { error: uploadError } = await adminSupabase.storage.from("images").upload(filename, buffer, {
      contentType: "image/png",
      upsert: true
    });
    if (uploadError) {
      return json({
        message: "Failed to upload avatar.",
        error: uploadError.message
      }, 400);
    }
    const { error: updateError } = await adminSupabase.auth.admin.updateUserById(targetUserId, {
      user_metadata: {
        avatar: filename
      }
    });
    if (updateError) {
      return json({
        message: "Uploaded but failed to update user profile.",
        error: updateError.message
      }, 400);
    }
    return json({
      message: "Avatar uploaded and updated successfully.",
      avatar: filename
    });
  } catch (decodeError) {
    return json({
      message: "Invalid base64 image data.",
      error: decodeError.message
    }, 400);
  }
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
function isValidUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
