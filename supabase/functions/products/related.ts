// File: functions/products/related.ts

/**
 * Handle related products retrieval based on product slug.
 * Returns products from the same category, excluding the current product.
 * If user is authenticated, includes favorite and cart status for each product.
 * 
 * @param {Request} req - HTTP request object
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object or null for guests
 * @returns {Response} JSON response with related products array
 * 
 * @throws {Error} Missing 'slug' parameter
 * @throws {Error} Product not found
 * @throws {Error} Database query errors
 * 
 * Query Parameters:
 * - slug (required): Product slug (English or Arabic) to find related products for
 * 
 * Response Format:
 * - Array of product objects with category information
 * - For authenticated users: includes in_favorites and in_cart boolean flags
 * - Limited to 10 products, ordered by creation date (newest first)
 * 
 * Usage Examples:
 * 
 * 1. Get related products (guest user):
 * curl -X GET "https://your-project.supabase.co/functions/v1/products/related?slug=smartphone-pro" \
 *   -H "Content-Type: application/json"
 * 
 * 2. Get related products (authenticated user):
 * curl -X GET "https://your-project.supabase.co/functions/v1/products/related?slug=smartphone-pro" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN"
 * 
 * 3. Get related products using Arabic slug:
 * curl -X GET "https://your-project.supabase.co/functions/v1/products/related?slug=هاتف-ذكي-برو" \
 *   -H "Content-Type: application/json"
 * 
 * Response Examples:
 * 
 * Guest User Response:
 * [
 *   {
 *     "id": "uuid-123",
 *     "name_en": "Smartphone Basic",
 *     "name_ar": "هاتف ذكي أساسي",
 *     "slug": "smartphone-basic",
 *     "slug_ar": "هاتف-ذكي-أساسي",
 *     "sku": "SMT-BASIC-001",
 *     "price": 299.99,
 *     "description_en": "Basic smartphone features",
 *     "description_ar": "ميزات الهاتف الذكي الأساسية",
 *     "category_id": "cat-123",
 *     "image_url": "https://example.com/image.jpg",
 *     "is_featured": false,
 *     "stock_quantity": 50,
 *     "is_deleted": false,
 *     "created_at": "2024-01-15T10:30:00Z",
 *     "updated_at": "2024-01-15T10:30:00Z",
 *     "category": {
 *       "name_en": "Electronics",
 *       "name_ar": "إلكترونيات"
 *     }
 *   }
 * ]
 * 
 * Authenticated User Response (includes additional fields):
 * [
 *   {
 *     "id": "uuid-123",
 *     "name_en": "Smartphone Basic",
 *     "name_ar": "هاتف ذكي أساسي",
 *     "slug": "smartphone-basic",
 *     "slug_ar": "هاتف-ذكي-أساسي",
 *     "sku": "SMT-BASIC-001",
 *     "price": 299.99,
 *     "description_en": "Basic smartphone features",
 *     "description_ar": "ميزات الهاتف الذكي الأساسية",
 *     "category_id": "cat-123",
 *     "image_url": "https://example.com/image.jpg",
 *     "is_featured": false,
 *     "stock_quantity": 50,
 *     "is_deleted": false,
 *     "created_at": "2024-01-15T10:30:00Z",
 *     "updated_at": "2024-01-15T10:30:00Z",
 *     "category": {
 *       "name_en": "Electronics",
 *       "name_ar": "إلكترونيات"
 *     },
 *     "in_favorites": true,
 *     "in_cart": false
 *   }
 * ]
 * 
 * Error Responses:
 * 
 * Missing slug parameter (400):
 * {
 *   "error": "Missing 'slug' parameter"
 * }
 * 
 * Product not found (404):
 * {
 *   "error": "Product not found"
 * }
 * 
 * Database error (500):
 * {
 *   "error": "Database query failed"
 * }
 */
export async function handleRelatedProducts(req, supabase, user) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) throw new Error("Missing 'slug' parameter");
  const { data: currentProduct, error: productError } = await supabase.from("products").select("id, category_id").or(`slug.eq.${slug},slug_ar.eq.${slug}`).maybeSingle();
  if (productError || !currentProduct) throw productError ?? new Error("Product not found");
  const { data: related, error } = await supabase.from("products").select("*, category:categories(name_en, name_ar)").eq("is_deleted", false).eq("category_id", currentProduct.category_id).neq("id", currentProduct.id).order("created_at", {
    ascending: false
  }).limit(10);
  if (error) throw error;
  if (!user) return json(related);
  const ids = related.map((p)=>p.id);
  const [favorites, cartItems] = await Promise.all([
    supabase.from("favorites").select("product_id").eq("user_id", user.id).in("product_id", ids),
    supabase.from("cart_items").select("product_id").eq("user_id", user.id).in("product_id", ids)
  ]);
  const favSet = new Set(favorites.data?.map((f)=>f.product_id));
  const cartSet = new Set(cartItems.data?.map((c)=>c.product_id));
  return json(related.map((p)=>({
      ...p,
      in_favorites: favSet.has(p.id),
      in_cart: cartSet.has(p.id)
    })));
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
