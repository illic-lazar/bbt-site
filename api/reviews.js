// GET /api/reviews — live Google reviews for Big Bad Thai, cached by Vercel's CDN.
// Key is read from the GOOGLE_PLACES_KEY env var (set in Vercel). Place ID is public.
const PLACE_ID = "ChIJj-thjxVVtjMRdmsUeV7mG_E";

module.exports = async (req, res) => {
  // Cache at the edge: ~1 call/hour to Google regardless of traffic.
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
  const key = process.env.GOOGLE_PLACES_KEY;
  if (!key) { res.status(200).json({ reviews: [], error: "no-key" }); return; }
  try {
    const neu = await fetchNew(key);
    if (neu.data) { res.status(200).json(neu.data); return; }
    const leg = await fetchLegacy(key);
    if (leg.data) { res.status(200).json(leg.data); return; }
    // Both Google endpoints failed — surface the clearest reason so the cause is
    // diagnosable from the response instead of a generic "fetch-failed".
    res.status(200).json({ reviews: [], error: "fetch-failed", detail: leg.detail || neu.detail || null });
  } catch (e) {
    res.status(200).json({ reviews: [], error: String((e && e.message) || e) });
  }
};

function shape(rating, total, url, reviews) {
  return {
    rating: rating || null,
    total: total || null,
    url: url || null,
    reviews: (reviews || []).filter(r => r.text && r.rating >= 4).slice(0, 6),
  };
}

// Places API (New). Returns { data } on success, or { detail } describing the failure.
async function fetchNew(key) {
  try {
    const r = await fetch(`https://places.googleapis.com/v1/places/${PLACE_ID}?key=${key}`, {
      headers: { "X-Goog-FieldMask": "rating,userRatingCount,googleMapsUri,reviews" },
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const g = j && j.error ? ((j.error.status || "") + " — " + (j.error.message || "")) : "";
      return { detail: ("new API: HTTP " + r.status + " " + g).trim().slice(0, 240) };
    }
    if (!j || !j.reviews) return { detail: "new API: ok but no reviews field returned" };
    return { data: shape(j.rating, j.userRatingCount, j.googleMapsUri, j.reviews.map(rv => ({
      author: (rv.authorAttribution && rv.authorAttribution.displayName) || "Google user",
      photo: (rv.authorAttribution && rv.authorAttribution.photoUri) || "",
      rating: rv.rating || 5,
      text: (rv.text && rv.text.text) || (rv.originalText && rv.originalText.text) || "",
      relativeTime: rv.relativePublishTimeDescription || "",
      url: (rv.authorAttribution && rv.authorAttribution.uri) || j.googleMapsUri || "",
    }))) };
  } catch (e) { return { detail: "new API: " + String((e && e.message) || e) }; }
}

// Legacy Place Details (fallback). Returns { data } on success, or { detail } on failure.
async function fetchLegacy(key) {
  try {
    const u = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=rating,user_ratings_total,url,reviews&reviews_sort=newest&key=${key}`;
    const r = await fetch(u);
    const j = await r.json().catch(() => null);
    if (!r.ok) return { detail: "legacy API: HTTP " + r.status };
    if (!j) return { detail: "legacy API: empty response" };
    if (j.status !== "OK") return { detail: ("legacy API: " + j.status + (j.error_message ? " — " + j.error_message : "")).slice(0, 240) };
    const p = j.result;
    return { data: shape(p.rating, p.user_ratings_total, p.url, (p.reviews || []).map(rv => ({
      author: rv.author_name || "Google user",
      photo: rv.profile_photo_url || "",
      rating: rv.rating || 5,
      text: rv.text || "",
      relativeTime: rv.relative_time_description || "",
      url: rv.author_url || p.url || "",
    }))) };
  } catch (e) { return { detail: "legacy API: " + String((e && e.message) || e) }; }
}
