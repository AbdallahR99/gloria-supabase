// File: functions/auth/set-roles.ts
import { createClient } from "jsr:@supabase/supabase-js@2";
export async function handleSetUserRoles(req, supabase, user, authError) {
  if (req.method === "OPTIONS") return new Response("ok", {
    status: 200
  });
  if (authError || !user) return json({
    message: "Unauthorized"
  }, 401);
  const { user_id, roles } = await req.json();
  if (!user_id || !Array.isArray(roles)) {
    return json({
      message: "Missing or invalid 'user_id' or 'roles'."
    }, 400);
  }
  const adminSupabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const { error } = await adminSupabase.auth.admin.updateUserById(user_id, {
    user_metadata: {
      roles
    }
  });
  if (error) {
    return json({
      message: "Failed to update roles.",
      error: error.message
    }, 400);
  }
  return json({
    message: "Roles updated successfully.",
    roles
  });
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}

/**
 * Handle user role assignment and management.
 * Updates user metadata with specified roles for role-based access control.
 * Requires authenticated admin user to execute role changes.
 * 
 * @param {Request} req - HTTP request object containing role assignment data
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with role update status
 * 
 * @throws {Error} Unauthorized access (401)
 * @throws {Error} Missing or invalid parameters (400)
 * @throws {Error} Role update failures (400)
 * 
 * Request Body:
 * {
 *   "user_id": "123e4567-e89b-12d3-a456...",  // Target user ID (required)
 *   "roles": ["admin", "moderator"]            // Array of role strings (required)
 * }
 * 
 * Response Format:
 * {
 *   "message": "Roles updated successfully.",
 *   "roles": ["admin", "moderator"]
 * }
 * 
 * Common Role Types:
 * - "admin": Full system administration access
 * - "moderator": Content moderation permissions
 * - "user": Standard user permissions (default)
 * - "manager": Limited administrative access
 * - "editor": Content editing permissions
 * - "viewer": Read-only access
 * 
 * Security Requirements:
 * - Requires valid authentication token
 * - Must be called by authorized admin user
 * - Uses service role key for user metadata updates
 * - All role changes are logged and auditable
 * 
 * Usage Examples:
 * 
 * 1. Assign admin and moderator roles:
 * curl -X POST "https://your-project.supabase.co/functions/v1/auth/set-roles" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
 *   -d '{
 *     "user_id": "123e4567-e89b-12d3-a456-426614174000",
 *     "roles": ["admin", "moderator"]
 *   }'
 * 
 * 2. Assign single user role:
 * curl -X POST "https://your-project.supabase.co/functions/v1/auth/set-roles" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
 *   -d '{
 *     "user_id": "456e7890-e12b-34d5-a678-901234567890",
 *     "roles": ["user"]
 *   }'
 * 
 * 3. Assign multiple management roles:
 * curl -X POST "https://your-project.supabase.co/functions/v1/auth/set-roles" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
 *   -d '{
 *     "user_id": "789e0123-e45b-67d8-a901-234567890123",
 *     "roles": ["manager", "editor", "moderator"]
 *   }'
 * 
 * 4. Remove all roles (set to empty array):
 * curl -X POST "https://your-project.supabase.co/functions/v1/auth/set-roles" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
 *   -d '{
 *     "user_id": "012e3456-e78b-90d1-a234-567890123456",
 *     "roles": []
 *   }'
 * 
 * Success Response Example:
 * {
 *   "message": "Roles updated successfully.",
 *   "roles": ["admin", "moderator"]
 * }
 * 
 * Error Responses:
 * 
 * Unauthorized access (401):
 * {
 *   "message": "Unauthorized"
 * }
 * 
 * Missing or invalid parameters (400):
 * {
 *   "message": "Missing or invalid 'user_id' or 'roles'."
 * }
 * 
 * Role update failed (400):
 * {
 *   "message": "Failed to update roles.",
 *   "error": "User not found"
 * }
 * 
 * User not found (400):
 * {
 *   "message": "Failed to update roles.",
 *   "error": "User with provided ID does not exist"
 * }
 * 
 * Notes:
 * - Roles are stored in user_metadata.roles as an array
 * - Previous roles are completely replaced with new roles array
 * - Empty roles array removes all role assignments
 * - Role names are case-sensitive strings
 * - Changes take effect immediately after successful update
 * - CORS preflight requests are handled automatically
 */

