// File: functions/reviews/rating-distribution.ts
export async function handleGetRatingDistribution(req, supabase) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  if (!slug) {
    return json({
      message: "slug query parameter is required"
    }, 400);
  }
  try {
    // First get the product_id from the slug (check both slug and slug_ar columns)
    const { data: productData, error: productError } = await supabase.from('products').select('id, slug, slug_ar').or(`slug.eq.${slug},slug_ar.eq.${slug}`).eq('is_deleted', false).single();
    if (productError || !productData) {
      return json({
        message: "Product not found"
      }, 404);
    }
    const productId = productData.id;
    // Get rating distribution with counts
    const { data: distributionData, error: distributionError } = await supabase.from('reviews').select('rating').eq('product_id', productId).eq('is_deleted', false).eq('is_approved', true).not('rating', 'is', null);
    if (distributionError) throw distributionError;
    // Get total count for percentage calculation
    const totalReviews = distributionData.length;
    // Initialize distribution object with all ratings (1-5)
    const distribution = {
      1: {
        count: 0,
        percentage: 0
      },
      2: {
        count: 0,
        percentage: 0
      },
      3: {
        count: 0,
        percentage: 0
      },
      4: {
        count: 0,
        percentage: 0
      },
      5: {
        count: 0,
        percentage: 0
      }
    };
    // Count each rating
    distributionData.forEach((review)=>{
      const rating = Math.round(review.rating); // Round to nearest integer
      if (rating >= 1 && rating <= 5) {
        distribution[rating].count++;
      }
    });
    // Calculate percentages
    if (totalReviews > 0) {
      Object.keys(distribution).forEach((rating)=>{
        distribution[rating].percentage = Math.round(distribution[rating].count / totalReviews * 100);
      });
    }
    // Calculate average rating
    const avgRating = totalReviews > 0 ? distributionData.reduce((sum, review)=>sum + review.rating, 0) / totalReviews : 0;
    return json({
      data: {
        product_id: productId,
        slug: productData.slug,
        slug_ar: productData.slug_ar,
        total_reviews: totalReviews,
        average_rating: Math.round(avgRating * 10) / 10,
        distribution,
        breakdown: [
          {
            stars: 5,
            count: distribution[5].count,
            percentage: distribution[5].percentage
          },
          {
            stars: 4,
            count: distribution[4].count,
            percentage: distribution[4].percentage
          },
          {
            stars: 3,
            count: distribution[3].count,
            percentage: distribution[3].percentage
          },
          {
            stars: 2,
            count: distribution[2].count,
            percentage: distribution[2].percentage
          },
          {
            stars: 1,
            count: distribution[1].count,
            percentage: distribution[1].percentage
          }
        ]
      }
    });
  } catch (error) {
    throw error;
  }
}
export async function handleGetMultipleRatingDistributions(req, supabase) {
  const body = await req.json();
  if (!Array.isArray(body) || body.length === 0) {
    return json({
      message: "Expected array of product slugs"
    }, 400);
  }
  try {
    // First get product IDs from slugs
    const { data: productsData, error: productsError } = await supabase.from('products').select('id, slug, slug_ar').or(`slug.in.(${body.join(',')}),slug_ar.in.(${body.join(',')})`).eq('is_deleted', false);
    if (productsError) throw productsError;
    if (!productsData || productsData.length === 0) {
      return json({
        message: "No products found for the provided slugs"
      }, 404);
    }
    const productIds = productsData.map((p)=>p.id);
    const slugToProduct = {};
    productsData.forEach((product)=>{
      if (product.slug && body.includes(product.slug)) {
        slugToProduct[product.slug] = product;
      }
      if (product.slug_ar && body.includes(product.slug_ar)) {
        slugToProduct[product.slug_ar] = product;
      }
    });
    // Get rating distribution for multiple products
    const { data: distributionData, error: distributionError } = await supabase.from('reviews').select('product_id, rating').in('product_id', productIds).eq('is_deleted', false).eq('is_approved', true).not('rating', 'is', null);
    if (distributionError) throw distributionError;
    // Group by product_id
    const productDistributions = {};
    // Initialize all products
    body.forEach((slug)=>{
      const product = slugToProduct[slug];
      if (product) {
        productDistributions[slug] = {
          product_id: product.id,
          slug: product.slug,
          slug_ar: product.slug_ar,
          total_reviews: 0,
          average_rating: 0,
          distribution: {
            1: {
              count: 0,
              percentage: 0
            },
            2: {
              count: 0,
              percentage: 0
            },
            3: {
              count: 0,
              percentage: 0
            },
            4: {
              count: 0,
              percentage: 0
            },
            5: {
              count: 0,
              percentage: 0
            }
          },
          breakdown: []
        };
      }
    }); // Group reviews by product using slug mapping
    const reviewsByProduct = {};
    distributionData.forEach((review)=>{
      // Find which slug this product_id belongs to
      const matchingSlug = Object.keys(productDistributions).find((slug)=>productDistributions[slug].product_id === review.product_id);
      if (matchingSlug) {
        if (!reviewsByProduct[matchingSlug]) {
          reviewsByProduct[matchingSlug] = [];
        }
        reviewsByProduct[matchingSlug].push(review);
      }
    });
    // Calculate distribution for each product
    Object.keys(productDistributions).forEach((slug)=>{
      const reviews = reviewsByProduct[slug] || [];
      const totalReviews = reviews.length;
      // Count ratings
      reviews.forEach((review)=>{
        const rating = Math.round(review.rating);
        if (rating >= 1 && rating <= 5) {
          productDistributions[slug].distribution[rating].count++;
        }
      });
      // Calculate percentages and average
      if (totalReviews > 0) {
        Object.keys(productDistributions[slug].distribution).forEach((rating)=>{
          productDistributions[slug].distribution[rating].percentage = Math.round(productDistributions[slug].distribution[rating].count / totalReviews * 100);
        });
        const avgRating = reviews.reduce((sum, review)=>sum + review.rating, 0) / totalReviews;
        productDistributions[slug].average_rating = Math.round(avgRating * 10) / 10;
      }
      productDistributions[slug].total_reviews = totalReviews;
      productDistributions[slug].breakdown = [
        {
          stars: 5,
          count: productDistributions[slug].distribution[5].count,
          percentage: productDistributions[slug].distribution[5].percentage
        },
        {
          stars: 4,
          count: productDistributions[slug].distribution[4].count,
          percentage: productDistributions[slug].distribution[4].percentage
        },
        {
          stars: 3,
          count: productDistributions[slug].distribution[3].count,
          percentage: productDistributions[slug].distribution[3].percentage
        },
        {
          stars: 2,
          count: productDistributions[slug].distribution[2].count,
          percentage: productDistributions[slug].distribution[2].percentage
        },
        {
          stars: 1,
          count: productDistributions[slug].distribution[1].count,
          percentage: productDistributions[slug].distribution[1].percentage
        }
      ];
    });
    return json({
      data: Object.values(productDistributions)
    });
  } catch (error) {
    throw error;
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
