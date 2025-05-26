// File: functions/cart/get.ts

/**
 * Handle retrieving user's shopping cart with detailed product information.
 * Fetches all cart items for the authenticated user including product details,
 * prices, and availability status.
 * 
 * @param {Request} req - HTTP request object
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with cart items and product details
 * 
 * @throws {Error} Unauthorized access (401)
 * @throws {Error} Database query errors (500)
 * 
 * Query Parameters:
 * - user_id (optional): Get cart for specific user (admin feature)
 * 
 * Response Format:
 * [
 *   {
 *     "id": "cart_item_uuid",
 *     "product_id": "product_uuid",
 *     "quantity": 2,
 *     "size": "M",
 *     "color": "Blue",
 *     "product": {
 *       "id": "product_uuid",
 *       "name_en": "Product Name",
 *       "name_ar": "اسم المنتج",
 *       "description_en": "Product description",
 *       "description_ar": "وصف المنتج",
 *       "price": 99.99,
 *       "old_price": 119.99,
 *       "stars": 4.5,
 *       "reviews": 23,
 *       "thumbnail": "https://example.com/image.jpg",
 *       "slug": "product-name",
 *       "slug_ar": "اسم-المنتج"
 *     }
 *   }
 * ]
 * 
 * Cart Item Properties:
 * - ID: Unique cart item identifier
 * - Product ID: Referenced product UUID
 * - Quantity: Number of items
 * - Size: Product size variant (if applicable)
 * - Color: Product color variant (if applicable)
 * - Product: Full product details object
 * 
 * Product Details Include:
 * - Multilingual names and descriptions
 * - Current and old prices for discount calculation
 * - Star ratings and review counts
 * - Thumbnail image URL
 * - SEO-friendly slugs in both languages
 * 
 * Usage Examples:
 * 
 * 1. Get current user's cart:
 * curl -X GET "https://your-project.supabase.co/functions/v1/cart" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN"
 * 
 * 2. Admin getting another user's cart:
 * curl -X GET "https://your-project.supabase.co/functions/v1/cart?user_id=123e4567-e89b-12d3-a456-426614174000" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
 * 
 * Success Response Example:
 * [
 *   {
 *     "id": "cart123-item456-uuid789",
 *     "product_id": "prod123-uuid456-789abc",
 *     "quantity": 2,
 *     "size": "L",
 *     "color": "Red",
 *     "product": {
 *       "id": "prod123-uuid456-789abc",
 *       "name_en": "Premium T-Shirt",
 *       "name_ar": "تيشيرت فاخر",
 *       "description_en": "High quality cotton t-shirt",
 *       "description_ar": "تيشيرت قطني عالي الجودة",
 *       "price": 29.99,
 *       "old_price": 39.99,
 *       "stars": 4.7,
 *       "reviews": 156,
 *       "thumbnail": "https://example.com/tshirt.jpg",
 *       "slug": "premium-t-shirt",
 *       "slug_ar": "تيشيرت-فاخر"
 *     }
 *   },
 *   {
 *     "id": "cart456-item789-uuid012",
 *     "product_id": "prod456-uuid789-012def",
 *     "quantity": 1,
 *     "size": null,
 *     "color": null,
 *     "product": {
 *       "id": "prod456-uuid789-012def",
 *       "name_en": "Wireless Headphones",
 *       "name_ar": "سماعات لاسلكية",
 *       "description_en": "High-fidelity wireless headphones",
 *       "description_ar": "سماعات لاسلكية عالية الدقة",
 *       "price": 149.99,
 *       "old_price": null,
 *       "stars": 4.3,
 *       "reviews": 89,
 *       "thumbnail": "https://example.com/headphones.jpg",
 *       "slug": "wireless-headphones",
 *       "slug_ar": "سماعات-لاسلكية"
 *     }
 *   }
 * ]
 * 
 * Empty Cart Response:
 * []
 * 
 * Error Responses:
 * 
 * Unauthorized access (401):
 * {
 *   "message": "Unauthorized"
 * }
 * 
 * User not found (404):
 * {
 *   "message": "User not found"
 * }
 * 
 * Database error (500):
 * {
 *   "message": "Failed to retrieve cart items"
 * }
 * 
 * Notes:
 * - Only returns non-deleted cart items (is_deleted = false)
 * - Cart items are ordered by creation date (newest first)
 * - Product details are joined for complete cart information
 * - Supports admin access to view other users' carts
 * - Returns empty array for users with no cart items
 * - All prices include currency formatting capabilities
 */
export async function handleGetCart(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const url = new URL(req.url);
  const userIdParam = url.searchParams.get("user_id");
  const userId = userIdParam ?? user.id;
  // Step 1: Fetch cart items from cart_items
  const { data: cartItems, error: cartError } = await supabase.from("cart_items").select("id, product_id, quantity, size, color").eq("user_id", userId).eq("is_deleted", false).order("created_at", {
    ascending: false
  });
  if (cartError) throw cartError;
  // Step 2: Fetch related product details
  const productIds = cartItems.map((item)=>item.product_id);
  const { data: products, error: productError } = await supabase.from("products").select(`
      id,
      name_en,
      name_ar,
      description_en,
      description_ar,
      price,
      old_price,
      stars,
      reviews,
      thumbnail,
      slug,
      slug_ar
    `).in("id", productIds);
  if (productError) throw productError;
  const productMap = Object.fromEntries(products.map((p)=>[
      p.id,
      p
    ]));
  const result = cartItems.map((item)=>{
    const product = productMap[item.product_id];
    return {
      ...item,
      product_id: product?.id,
      name_en: product?.name_en,
      name_ar: product?.name_ar,
      description_en: product?.description_en,
      description_ar: product?.description_ar,
      price: product?.price,
      old_price: product?.old_price,
      stars: product?.stars,
      reviews: product?.reviews,
      thumbnail: product?.thumbnail,
      slug: product?.slug,
      slug_ar: product?.slug_ar
    };
  });
  return json(result);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
