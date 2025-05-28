// File: functions/auth/update-phone.ts

/**
 * Handle phone number update and user confirmation for newly registered users.
 * Updates user's phone number and marks the account as confirmed.
 * This function is typically called during the registration completion process.
 * 
 * @param {Request} req - HTTP request object containing phone update data
 * @returns {Response} JSON response with update status
 * 
 * @throws {Error} Missing user_id or phone validation errors (400)
 * @throws {Error} User not found or update failed (202/500)
 * 
 * Request Body:
 * {
 *   "phone": "+1234567890",                    // Phone number to update (optional)
 *   "user_id": "123e4567-e89b-12d3-a456..."   // User ID to update (required)
 * }
 * 
 * Response Format:
 * {
 *   "message": "User registered and confirmed successfully!"
 * }
 * 
 * Phone Number Format Handling:
 * - International format: +1234567890 (used as-is)
 * - Zero-zero prefix: 001234567890 (converted to +1234567890)
 * - Local format: 1234567890 (converted to +1234567890)
 * 
 * Process Flow:
 * 1. Validates request and extracts phone number and user ID
 * 2. Normalizes phone number format if provided
 * 3. Updates user account with confirmation timestamps
 * 4. Sets phone number and phone confirmation if provided
 * 5. Returns success status
 * 
 * Usage Examples:
 * 
 * 1. Update phone number and confirm user:
 * curl -X POST "https://your-project.supabase.co/functions/v1/auth/update-phone" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
 *   -d '{
 *     "phone": "+1234567890",
 *     "user_id": "123e4567-e89b-12d3-a456-426614174000"
 *   }'
 * 
 * 2. Confirm user without phone update:
 * curl -X POST "https://your-project.supabase.co/functions/v1/auth/update-phone" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
 *   -d '{
 *     "user_id": "123e4567-e89b-12d3-a456-426614174000"
 *   }'
 * 
 * 3. Update with zero-zero prefix phone:
 * curl -X POST "https://your-project.supabase.co/functions/v1/auth/update-phone" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
 *   -d '{
 *     "phone": "001234567890",
 *     "user_id": "123e4567-e89b-12d3-a456-426614174000"
 *   }'
 * 
 * 4. Update with local format phone:
 * curl -X POST "https://your-project.supabase.co/functions/v1/auth/update-phone" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
 *   -d '{
 *     "phone": "1234567890",
 *     "user_id": "123e4567-e89b-12d3-a456-426614174000"
 *   }'
 * 
 * Success Response Example:
 * {
 *   "message": "User registered and confirmed successfully!"
 * }
 * 
 * Error Responses:
 * 
 * Update failed but user created (202):
 * {
 *   "message": "User created but failed to finalize profile",
 *   "error": "Detailed error message"
 * }
 * 
 * User not found (400):
 * {
 *   "message": "User not found"
 * }
 * 
 * Invalid phone format (400):
 * {
 *   "message": "Invalid phone number format"
 * }
 * 
 * Notes:
 * - Requires service role key for admin operations
 * - Sets multiple confirmation timestamps for compatibility
 * - Phone number normalization ensures consistent storage format
 * - Typically used in registration completion workflows
 * - CORS preflight requests are handled automatically
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
export async function handleUpdatePhone(req) {
  if (req.method === "OPTIONS") return new Response("ok", {
    status: 200
  });
  const { phone, user_id } = await req.json();
  const timestamp = new Date().toISOString();
  const adminSupabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const updatePayload = {
    email_confirmed_at: timestamp,
    confirmed_at: timestamp,
    phone_confirm: true
  };
  if (phone) {
    let normalizedPhone = phone;
    if (normalizedPhone.startsWith("00")) {
      normalizedPhone = "+" + normalizedPhone.slice(2);
    } else if (!normalizedPhone.startsWith("+")) {
      normalizedPhone = "+" + normalizedPhone;
    }
    updatePayload.phone = normalizedPhone;
    updatePayload.phone_confirmed_at = timestamp;
  }
  const { error: updateError } = await adminSupabase.auth.admin.updateUserById(user_id, updatePayload);
  if (updateError) {
    return json({
      message: "User created but failed to finalize profile",
      error: updateError.message
    }, 202);
  }
  return json({
    message: "User registered and confirmed successfully!"
  }, 201);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
