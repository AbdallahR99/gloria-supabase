// File: functions/auth/login.ts

/**
 * Handle user authentication login using email or phone number.
 * Supports both email and phone number authentication with automatic format detection.
 * 
 * @param {Request} req - HTTP request object containing login credentials
 * @param {SupabaseClient} supabase - Supabase client instance
 * @returns {Response} JSON response with authentication token and user data
 * 
 * @throws {Error} Missing identifier or password (400)
 * @throws {Error} Invalid credentials (401)
 * @throws {Error} Authentication service errors (401)
 * 
 * Request Body:
 * {
 *   "identifier": "user@example.com" | "+1234567890", // Email or phone number
 *   "password": "userPassword123"                     // User password
 * }
 * 
 * Response Format:
 * {
 *   "token": "jwt_access_token_string",
 *   "user": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "phone": "+1234567890",
 *     "created_at": "2024-01-15T10:30:00Z",
 *     // ... other user properties
 *   }
 * }
 * 
 * Phone Number Format Support:
 * - International format: +1234567890
 * - Zero-zero prefix: 001234567890 (converted to +1234567890)
 * - Local format: 1234567890 (converted to +1234567890)
 * 
 * Usage Examples:
 * 
 * 1. Login with email:
 * curl -X POST "https://your-project.supabase.co/functions/v1/auth/login" \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "identifier": "user@example.com",
 *     "password": "securePassword123"
 *   }'
 * 
 * 2. Login with phone number (international format):
 * curl -X POST "https://your-project.supabase.co/functions/v1/auth/login" \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "identifier": "+1234567890",
 *     "password": "securePassword123"
 *   }'
 * 
 * 3. Login with phone number (zero-zero prefix):
 * curl -X POST "https://your-project.supabase.co/functions/v1/auth/login" \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "identifier": "001234567890",
 *     "password": "securePassword123"
 *   }'
 * 
 * 4. Login with phone number (local format):
 * curl -X POST "https://your-project.supabase.co/functions/v1/auth/login" \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "identifier": "1234567890",
 *     "password": "securePassword123"
 *   }'
 * 
 * Success Response Example:
 * {
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "user": {
 *     "id": "123e4567-e89b-12d3-a456-426614174000",
 *     "email": "user@example.com",
 *     "phone": "+1234567890",
 *     "email_confirmed_at": "2024-01-15T10:30:00.000Z",
 *     "phone_confirmed_at": "2024-01-15T10:30:00.000Z",
 *     "created_at": "2024-01-15T10:30:00.000Z",
 *     "updated_at": "2024-01-15T10:30:00.000Z",
 *     "user_metadata": {},
 *     "app_metadata": {}
 *   }
 * }
 * 
 * Error Responses:
 * 
 * Missing credentials (400):
 * {
 *   "message": "Email/Phone and password are required."
 * }
 * 
 * Invalid credentials (401):
 * {
 *   "message": "Invalid login credentials"
 * }
 * 
 * Account not confirmed (401):
 * {
 *   "message": "Email not confirmed"
 * }
 */
export async function handleAuthLogin(req, supabase) {
  const { identifier, password } = await req.json();
  if (!identifier || !password) {
    return json({
      message: "Email/Phone and password are required."
    }, 400);
  }
  let loginPayload;
  const isPhone = /^[+0-9]{7,15}$/.test(identifier);
  if (isPhone) {
    let phone = identifier;
    if (phone.startsWith("00")) {
      phone = "+" + phone.slice(2);
    } else if (!phone.startsWith("+")) {
      phone = "+" + phone;
    }
    loginPayload = {
      phone,
      password
    };
  } else {
    loginPayload = {
      email: identifier,
      password
    };
  }
  const { data, error } = await supabase.auth.signInWithPassword(loginPayload);
  if (error) {
    return json({
      message: error.message
    }, 401);
  }
  return json({
    token: data.session.access_token,
    user: data.user
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
