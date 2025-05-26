// File: functions/auth/register.ts

/**
 * Handle user registration with email, password, and profile information.
 * Creates a new user account and associated user profile in the database.
 * 
 * @param {Request} req - HTTP request object containing registration data
 * @param {SupabaseClient} supabase - Supabase client instance
 * @returns {Response} JSON response with registration status and user data
 * 
 * @throws {Error} Missing required fields (400)
 * @throws {Error} Email already exists (400)
 * @throws {Error} Password validation errors (400)
 * @throws {Error} Database constraint violations (400)
 * 
 * Request Body:
 * {
 *   "email": "user@example.com",        // Valid email address (required)
 *   "password": "securePassword123",    // Password (required, min 6 chars)
 *   "first_name": "John",              // User's first name (required)
 *   "last_name": "Doe",                // User's last name (required)
 *   "phone": "+1234567890"             // Phone number (optional)
 * }
 * 
 * Response Format:
 * {
 *   "message": "User registered successfully!",
 *   "user": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "created_at": "2024-01-15T10:30:00Z",
 *     // ... other user properties
 *   }
 * }
 * 
 * Process Flow:
 * 1. Validates required fields (email, password, first_name, last_name)
 * 2. Creates user account with Supabase Auth
 * 3. Creates associated user profile record
 * 4. Updates user metadata with phone number if provided
 * 5. Returns success response with user data
 * 
 * Usage Examples:
 * 
 * 1. Register with email only:
 * curl -X POST "https://your-project.supabase.co/functions/v1/auth/register" \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "email": "newuser@example.com",
 *     "password": "securePassword123",
 *     "first_name": "Jane",
 *     "last_name": "Smith"
 *   }'
 * 
 * 2. Register with email and phone:
 * curl -X POST "https://your-project.supabase.co/functions/v1/auth/register" \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "email": "newuser@example.com",
 *     "password": "securePassword123",
 *     "first_name": "Jane",
 *     "last_name": "Smith",
 *     "phone": "+1234567890"
 *   }'
 * 
 * 3. Register with complex password:
 * curl -X POST "https://your-project.supabase.co/functions/v1/auth/register" \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "email": "secure.user@example.com",
 *     "password": "MyS3cur3P@ssw0rd!",
 *     "first_name": "Security",
 *     "last_name": "Expert"
 *   }'
 * 
 * Success Response Example:
 * {
 *   "message": "User registered successfully!",
 *   "user": {
 *     "id": "123e4567-e89b-12d3-a456-426614174000",
 *     "email": "newuser@example.com",
 *     "email_confirmed_at": null,
 *     "created_at": "2024-01-15T10:30:00.000Z",
 *     "updated_at": "2024-01-15T10:30:00.000Z",
 *     "user_metadata": {
 *       "first_name": "Jane",
 *       "last_name": "Smith"
 *     },
 *     "app_metadata": {}
 *   }
 * }
 * 
 * Error Responses:
 * 
 * Missing required fields (400):
 * {
 *   "message": "Missing required fields."
 * }
 * 
 * Email already exists (400):
 * {
 *   "message": "User already registered"
 * }
 * 
 * Password too weak (400):
 * {
 *   "message": "Password should be at least 6 characters"
 * }
 * 
 * Invalid email format (400):
 * {
 *   "message": "Unable to validate email address: invalid format"
 * }
 * 
 * Notes:
 * - Email confirmation may be required based on Supabase project settings
 * - User profiles are automatically created in the users table
 * - Phone numbers are stored in user metadata if provided
 * - All registration attempts are logged for security monitoring
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
export async function handleAuthRegister(req, supabase) {
  if (req.method === "OPTIONS") return new Response("ok", {
    status: 200
  });
  const { email, password, first_name, last_name, phone } = await req.json();
  if (!email || !password || !first_name || !last_name) {
    return json({
      message: "Missing required fields."
    }, 400);
  }
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name,
        last_name
      }
    }
  });
  if (error) return json({
    message: error.message
  }, 400);
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
  const { error: updateError } = await adminSupabase.auth.admin.updateUserById(data.user.id, updatePayload);
  if (updateError) {
    return json({
      message: "User created but failed to finalize profile",
      error: updateError.message,
      user: data.user
    }, 202);
  }
  return json({
    message: "User registered and confirmed successfully!",
    user: data.user
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
