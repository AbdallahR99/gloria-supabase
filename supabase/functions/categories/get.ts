// File: functions/categories/get.ts
export async function handleGetCategory(req, supabase) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("page_size") || "999", 10);
  if (!slug) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: categories, error } = await supabase.from("categories").select(`
        id,
        name_en,
        name_ar,
        slug,
        slug_ar,
        image,
        meta_title_en,
        meta_title_ar,
        meta_description_en,
        meta_description_ar
      `).range(from, to).order("created_at", {
      ascending: false
    });
    if (error) throw error;
    return json(categories);
  }
  const { data: category, error } = await supabase.from("categories").select(`
      id,
      name_en,
      name_ar,
      slug,
      slug_ar,
      image,
      meta_title_en,
      meta_title_ar,
      meta_description_en,
      meta_description_ar
    `).or(`slug.eq.${slug},slug_ar.eq.${slug}`).maybeSingle();
  if (error || !category) throw error ?? new Error("Category not found");
  return json(category);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
