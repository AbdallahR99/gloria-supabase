// File: functions/reviews/rating-distribution.ts

export async function handleGetRatingDistribution(req, supabase) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  if (!slug) {
    return json({ message: "slug query parameter is required" }, 400);
  }

  try {
    const { data, error } = await supabase.rpc('get_rating_distribution_by_slug', {
      product_slug_input: slug
    });
    if (error) throw error;

    const totalReviews = data.reduce((sum, item) => sum + Number(item.count), 0);
    const distribution = {
      1: { count: 0, percentage: 0 },
      2: { count: 0, percentage: 0 },
      3: { count: 0, percentage: 0 },
      4: { count: 0, percentage: 0 },
      5: { count: 0, percentage: 0 }
    };

    data.forEach(({ star, count }) => {
      distribution[star].count = count;
    });

    if (totalReviews > 0) {
      for (let i = 1; i <= 5; i++) {
        distribution[i].percentage = Math.round((distribution[i].count / totalReviews) * 100);
      }
    }

    const averageRating = totalReviews > 0
      ? Math.round(data.reduce((sum, { star, count }) => sum + star * count, 0) / totalReviews * 10) / 10
      : 0;

    return json({
        slug,
        total_reviews: totalReviews,
        average_rating: averageRating,
        distribution,
        breakdown: [5, 4, 3, 2, 1].map(star => ({
          stars: star,
          count: distribution[star].count,
          percentage: distribution[star].percentage
        }))
    });
  } catch (error) {
    console.error("Rating distribution error:", error);
    return json({ message: "Internal error" }, 500);
  }
}

export async function handleGetMultipleRatingDistributions(req, supabase) {
  const body = await req.json();
  if (!Array.isArray(body) || body.length === 0) {
    return json({ message: "Expected array of product slugs" }, 400);
  }

  try {
    const results = await Promise.all(
      body.map(async (slug) => {
        const { data, error } = await supabase.rpc('get_rating_distribution_by_slug', {
          product_slug_input: slug
        });
        if (error || !data) {
          return null; // Skip failed slugs
        }

        const totalReviews = data.reduce((sum, item) => sum + Number(item.count), 0);
        const distribution = {
          1: { count: 0, percentage: 0 },
          2: { count: 0, percentage: 0 },
          3: { count: 0, percentage: 0 },
          4: { count: 0, percentage: 0 },
          5: { count: 0, percentage: 0 }
        };

        data.forEach(({ star, count }) => {
          distribution[star].count = count;
        });

        if (totalReviews > 0) {
          for (let i = 1; i <= 5; i++) {
            distribution[i].percentage = Math.round((distribution[i].count / totalReviews) * 100);
          }
        }

        const avgRating = totalReviews > 0
          ? Math.round(data.reduce((sum, { star, count }) => sum + star * count, 0) / totalReviews * 10) / 10
          : 0;

        return {
          slug,
          total_reviews: totalReviews,
          average_rating: avgRating,
          distribution,
          breakdown: [5, 4, 3, 2, 1].map((star) => ({
            stars: star,
            count: distribution[star].count,
            percentage: distribution[star].percentage
          }))
        };
      })
    );

    const filteredResults = results.filter((r) => r !== null);
    if (filteredResults.length === 0) {
      return json({ message: "No valid distributions found" }, 404);
    }

    return json({ data: filteredResults });
  } catch (error) {
    console.error("Multiple rating distribution error:", error);
    return json({ message: "Internal error" }, 500);
  }
}


function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    status
  });
}
