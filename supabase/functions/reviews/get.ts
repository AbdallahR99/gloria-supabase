// File: functions/reviews/get.ts
export async function handleGetReviews(req, supabase, isFilter = false) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "10");
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase.from("product_reviews_with_user").select("*", {
    count: "exact"
  }).order("created_at", {
    ascending: false
  });
  if (slug) {
    query = query.or(`slug.eq.${slug},slug_ar.eq.${slug}`);
  }
  if (isFilter) {
    query = query.range(from, to);
  }
  const { data: reviews, count, error } = await query;
  if (error) throw error;
  if (isFilter) {
    return json({
      data: reviews,
      pagination: {
        page,
        pageSize,
        total: count ?? 0
      }
    });
  }
  return json(reviews);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
