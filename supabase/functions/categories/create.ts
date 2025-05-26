// File: functions/categories/create.ts

/**
 * Handle creating new product categories with bilingual support.
 * Creates a category with English and Arabic names, descriptions, and metadata.
 * 
 * @param {Request} req - HTTP request object containing category data
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with created category data
 * 
 * @throws {Error} Unauthorized access (401)
 * @throws {Error} Missing required fields (400)
 * @throws {Error} Duplicate category names (409)
 * @throws {Error} Database constraint violations (400/500)
 * 
 * Request Body:
 * {
 *   "name_en": "Electronics",                    // English name (required)
 *   "name_ar": "إلكترونيات",                    // Arabic name (required)
 *   "description_en": "Electronic products",    // English description (optional)
 *   "description_ar": "المنتجات الإلكترونية",   // Arabic description (optional)
 *   "image_url": "https://example.com/image.jpg", // Category image (optional)
 *   "is_featured": true,                         // Featured status (optional)
 *   "sort_order": 1                              // Display order (optional)
 * }
 * 
 * Response Format:
 * {
 *   "id": "category_uuid",
 *   "name_en": "Electronics",
 *   "name_ar": "إلكترونيات",
 *   "description_en": "Electronic products",
 *   "description_ar": "المنتجات الإلكترونية",
 *   "image_url": "https://example.com/image.jpg",
 *   "is_featured": true,
 *   "sort_order": 1,
 *   "is_deleted": false,
 *   "created_at": "2024-01-15T10:30:00Z",
 *   "updated_at": "2024-01-15T10:30:00Z",
 *   "created_by": "admin@example.com",
 *   "updated_by": "admin@example.com"
 * }
 * 
 * Usage Examples:
 * 
 * 1. Create basic category:
 * curl -X POST "https://your-project.supabase.co/functions/v1/categories" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "name_en": "Perfumes",
 *     "name_ar": "عطور"
 *   }'
 * 
 * 2. Create featured category with descriptions:
 * curl -X POST "https://your-project.supabase.co/functions/v1/categories" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "name_en": "Premium Fragrances",
 *     "name_ar": "العطور الفاخرة",
 *     "description_en": "Luxury perfumes and colognes",
 *     "description_ar": "العطور والكولونيا الفاخرة",
 *     "is_featured": true,
 *     "sort_order": 1
 *   }'
 * 
 * 3. Create category with image:
 * curl -X POST "https://your-project.supabase.co/functions/v1/categories" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "name_en": "Skincare",
 *     "name_ar": "العناية بالبشرة",
 *     "description_en": "Beauty and skincare products",
 *     "description_ar": "منتجات الجمال والعناية بالبشرة",
 *     "image_url": "https://example.com/skincare-category.jpg",
 *     "sort_order": 2
 *   }'
 */
export async function handleCreateCategory(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const now = new Date().toISOString();
  const payload = {
    ...body,
    created_at: now,
    updated_at: now,
    created_by: user.email,
    updated_by: user.email,
    is_deleted: false
  };
  const { data, error } = await supabase.from("categories").insert(payload).select().single();
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
