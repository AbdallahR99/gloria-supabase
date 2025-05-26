// File: functions/states/get.ts
export async function handleGetStates(req, supabase) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("country_code");
  if (code) {
    const { data: country, error: countryError } = await supabase.from("countries").select("id").eq("code", code).maybeSingle();
    if (countryError) throw countryError;
    if (!country) return json({
      message: "Country not found"
    }, 404);
    const { data, error } = await supabase.from("states").select("id, name_ar, name_en, code, delivery_fee").eq("country_id", country.id).order("name_en", {
      ascending: true
    });
    if (error) throw error;
    return json(data);
  }
  // Return all states
  const { data, error } = await supabase.from("states").select("id, name_ar, name_en, code, delivery_fee").order("name_en", {
    ascending: true
  });
  if (error) throw error;
  return json(data);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
