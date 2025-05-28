/**
 * Product Retrieval Handlers
 * File: functions/products/get.ts
 * 
 * This file contains all product retrieval operations including:
 * - Single product retrieval by slug
 * - Product listing with pagination and filtering
 * - Product filtering with advanced search
 * - SKU-based product lookup
 * 
 * Features:
 * - Multi-language support (EN/AR)
 * - User-specific data (favorites, cart status)
 * - Advanced filtering and search
 * - Pagination support
 * - SKU search integration
 */

/**
 * Retrieves a single product by slug (English or Arabic)
 * 
 * @param {Request} req - HTTP request object with slug parameter
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {User|null} user - Authenticated user (optional)
 * @returns {Response} JSON response with product data
 */
export async function handleGetProduct(req, supabase, user) {
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    const size = url.searchParams.get("size");
    const color = url.searchParams.get("color");

    if (!slug) {
      return json({ error: "Slug parameter is required" }, 400);
    }

    // Step 1: Get product by slug or slug_ar
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("*, category:categories(name_en, name_ar)")
      .or(`slug.eq.${slug},slug_ar.eq.${slug}`)
      .eq("is_deleted", false)
      .single();

    if (productError || !product) {
      return json({ error: "Product not found" }, 404);
    }

    // Step 2: If user not authenticated, return basic product
    if (!user) return json(product);

    // Step 3: Fetch in_cart and in_favorites status
    const [favoritesResult, cartItemsResult] = await Promise.all([
      supabase
        .from("favorites")
        .select("product_id")
        .eq("user_id", user.id)
        .eq("product_id", product.id),
      buildCartQuery(supabase, user.id, [product.id], size, color)
    ]);

    const inFavorites = favoritesResult?.data?.some((f) => f.product_id === product.id);
    const cartItem = cartItemsResult?.data?.find((c) => c.product_id === product.id);

    return json({
      ...product,
      in_favorites: !!inFavorites,
      in_cart: !!cartItem,
      ...(cartItem ? { cart_quantity: cartItem.quantity } : {})
    });
  } catch (error) {
    console.error("Error in handleGetProduct:", error);
    return json({ error: error.message }, 500);
  }
}

/**
 * Retrieves a paginated list of products with optional filtering
 * 
 * @param {Request} req - HTTP request object with query parameters
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {User|null} user - Authenticated user (optional)
 * @returns {Response} JSON response with products array
 */
export async function handleListProducts(req, supabase, user) {
  try {
    const url = new URL(req.url);
    
    // Parse pagination parameters
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("page_size") ?? "99");
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    // Parse filter parameters
    const size = url.searchParams.get("size");
    const color = url.searchParams.get("color");
    const name = url.searchParams.get("name");
    const categoryId = url.searchParams.get("category_id");
    const minPrice = url.searchParams.get("min_price");
    const maxPrice = url.searchParams.get("max_price");
    const sortBy = url.searchParams.get("sort_by") ?? "created_at";
    const sortOrder = url.searchParams.get("sort_order") === "asc";
    let query = supabase.from("products").select("*, category:categories(name_en, name_ar)").eq("is_deleted", false);
    if (name) {
      query = query.or(`name_en.ilike.%${name}%,name_ar.ilike.%${name}%,keywords.ilike.%${name}%,sku.ilike.%${name}%`);
    }
    if (categoryId) query = query.eq("category_id", categoryId);
    if (minPrice) query = query.gte("price", Number(minPrice));
    if (maxPrice) query = query.lte("price", Number(maxPrice));
    const { data: products, error } = await query.range(from, to).order(sortBy, {
      ascending: sortOrder
    });
    if (error) throw error;
    if (!user) return json(products || []);
    // If no products, return early
    if (!products || products.length === 0) {
      return json([]);
    }
    const ids = products.map((p)=>p.id);
    const [favorites, cartItems] = await Promise.all([
      supabase.from("favorites").select("product_id").eq("user_id", user.id).in("product_id", ids),
      buildCartQuery(supabase, user.id, ids, size, color)
    ]);
    const favSet = new Set(favorites.data?.map((f)=>f.product_id) || []);
    const cartMap = new Map(cartItems.data?.map((c)=>[
        c.product_id,
        c.quantity
      ]) || []);
    return json(products.map((p)=>{
      const inCart = cartMap.has(p.id);
      return {
        ...p,
        in_favorites: favSet.has(p.id),
        in_cart: inCart,
        ...inCart ? {
          cart_quantity: cartMap.get(p.id)
        } : {}
      };
    }));
  } catch (error) {
    console.error('Error in handleListProducts:', error);
    return json({
      error: error.message
    }, 500);
  }
}
export async function handleFilterProducts(req, supabase, user) {
  try {
    const body = await req.json();
    const page = Number(body.page ?? 1);
    const pageSize = Number(body.page_size ?? 99);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const sortBy = body.sort_by ?? "created_at";
    const sortOrder = body.sort_order === "asc";
    const size = body.size;
    const color = body.color;
    let query = supabase.from("products").select("*, category:categories(name_en, name_ar)", {
      count: "exact"
    }).eq("is_deleted", false);
    if (body.name) {
      query = query.or(`name_en.ilike.%${body.name}%,name_ar.ilike.%${body.name}%,keywords.ilike.%${body.name}%,sku.ilike.%${body.name}%`);
    }
    if (body.category_id) query = query.eq("category_id", body.category_id);
    if (body.category_slug) {
      const { data: category, error: categoryError } = await supabase.from("categories").select("id").or(`slug.eq.${body.category_slug},slug_ar.eq.${body.category_slug}`).maybeSingle();
      if (categoryError) throw categoryError;
      if (category?.id) query = query.eq("category_id", category.id);
    }
    if (body.min_price) query = query.gte("price", Number(body.min_price));
    if (body.max_price) query = query.lte("price", Number(body.max_price));
    const { data: products, count, error } = await query.range(from, to).order(sortBy, {
      ascending: sortOrder
    });
    if (error) throw error;
    const result = {
      data: products || [],
      pagination: {
        page,
        pageSize,
        total: count ?? 0
      }
    };
    if (!user) return json(result);
    // If no products, return early
    if (!products || products.length === 0) {
      return json(result);
    }
    const ids = products.map((p)=>p.id);
    const [favorites, cartItems] = await Promise.all([
      supabase.from("favorites").select("product_id").eq("user_id", user.id).in("product_id", ids),
      buildCartQuery(supabase, user.id, ids, size, color)
    ]);
    const favSet = new Set(favorites.data?.map((f)=>f.product_id) || []);
    const cartMap = new Map(cartItems.data?.map((c)=>[
        c.product_id,
        c.quantity
      ]) || []);
    result.data = products.map((p)=>{
      const inCart = cartMap.has(p.id);
      return {
        ...p,
        in_favorites: favSet.has(p.id),
        in_cart: inCart,
        ...inCart ? {
          cart_quantity: cartMap.get(p.id)
        } : {}
      };
    });
    return json(result);
  } catch (error) {
    console.error('Error in handleFilterProducts:', error);
    return json({
      error: error.message
    }, 500);
  }
}
export async function handleGetProductBySKU(req, supabase, user) {
  try {
    const url = new URL(req.url);
    const sku = url.searchParams.get("sku");
    
    if (!sku) {
      return json({
        error: "SKU parameter is required"
      }, 400);
    }

    const { data: product, error } = await supabase
      .from("products")
      .select("*, category:categories(name_en, name_ar)")
      .eq("sku", sku)
      .eq("is_deleted", false)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return json({
          error: "Product not found"
        }, 404);
      }
      throw error;
    }

    if (!user) return json(product);

    const size = url.searchParams.get("size");
    const color = url.searchParams.get("color");

    const [favorites, cartItems] = await Promise.all([
      supabase.from("favorites").select("product_id").eq("user_id", user.id).eq("product_id", product.id),
      buildCartQuery(supabase, user.id, [product.id], size, color)
    ]);

    const cartItem = cartItems.data?.find((c) => c.product_id === product.id);

    return json({
      ...product,
      in_favorites: favorites.data?.length > 0,
      in_cart: !!cartItem,
      ...(cartItem ? { cart_quantity: cartItem.quantity } : {})
    });
  } catch (error) {
    console.error('Error in handleGetProductBySKU:', error);
    return json({
      error: error.message
    }, 500);
  }
}
// FIXED: When size/color are not provided, don't filter by them at all
async function buildCartQuery(supabase, userId, productIds, size, color) {
  let query = supabase.from("cart_items").select("product_id, quantity").eq("user_id", userId).in("product_id", productIds).eq("is_deleted", false);
  // Only add size filter if size is explicitly provided
  if (size !== undefined && size !== null) {
    query = query.eq("size", size);
  }
  // Only add color filter if color is explicitly provided
  if (color !== undefined && color !== null) {
    query = query.eq("color", color);
  }
  // Execute the query and return the result
  return await query;
}

/**
 * Creates a JSON response with proper headers
 * 
 * @param {any} data - Data to be serialized as JSON
 * @param {number} status - HTTP status code (default: 200)
 * @returns {Response} HTTP Response with JSON content
 */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}

/**
 * cURL Examples for Postman Import:
 * 
 * Get Product by Slug:
 */

/*
curl -X GET "{{supabase_url}}/functions/v1/products?slug=amber-musk-perfume" \
  -H "Authorization: Bearer {{auth_token}}" \
  -H "apikey: {{supabase_anon_key}}"
*/

/*
curl -X GET "{{supabase_url}}/functions/v1/products?slug=عطر-العنبر-والمسك" \
  -H "Authorization: Bearer {{auth_token}}" \
  -H "apikey: {{supabase_anon_key}}"
*/

/**
 * Get Product by SKU:
 */

/*
curl -X GET "{{supabase_url}}/functions/v1/products?sku=PERF-AMBER-001" \
  -H "Authorization: Bearer {{auth_token}}" \
  -H "apikey: {{supabase_anon_key}}"
*/

/*
curl -X GET "{{supabase_url}}/functions/v1/products/sku/PERF-AMBER-001" \
  -H "Authorization: Bearer {{auth_token}}" \
  -H "apikey: {{supabase_anon_key}}"
*/

/**
 * List Products with Pagination:
 */

/*
curl -X GET "{{supabase_url}}/functions/v1/products?page=1&page_size=10" \
  -H "Authorization: Bearer {{auth_token}}" \
  -H "apikey: {{supabase_anon_key}}"
*/

/**
 * Search Products by Name (includes SKU search):
 */

/*
curl -X GET "{{supabase_url}}/functions/v1/products?name=amber&page=1&page_size=20" \
  -H "Authorization: Bearer {{auth_token}}" \
  -H "apikey: {{supabase_anon_key}}"
*/

/**
 * Filter Products by Category and Price:
 */

/*
curl -X GET "{{supabase_url}}/functions/v1/products?category_id=123e4567-e89b-12d3-a456-426614174000&min_price=20&max_price=100&page=1&page_size=15" \
  -H "Authorization: Bearer {{auth_token}}" \
  -H "apikey: {{supabase_anon_key}}"
*/

/**
 * Advanced Product Filter (POST):
 */

/*
curl -X POST "{{supabase_url}}/functions/v1/products/filter" \
  -H "Authorization: Bearer {{auth_token}}" \
  -H "Content-Type: application/json" \
  -H "apikey: {{supabase_anon_key}}" \
  -d '{
    "name": "perfume",
    "category_id": "123e4567-e89b-12d3-a456-426614174000",
    "min_price": 25,
    "max_price": 75,
    "page": 1,
    "page_size": 20,
    "sort_by": "price",
    "sort_order": "asc"
  }'
*/

/*
curl -X POST "{{supabase_url}}/functions/v1/products/filter" \
  -H "Authorization: Bearer {{auth_token}}" \
  -H "Content-Type: application/json" \
  -H "apikey: {{supabase_anon_key}}" \
  -d '{
    "category_slug": "perfumes",
    "name": "amber",
    "page": 1,
    "page_size": 10,
    "sort_by": "created_at",
    "sort_order": "desc"
  }'
*/
