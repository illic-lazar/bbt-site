// GET /api/reviews — live Google reviews for Big Bad Thai, cached by Vercel's CDN.
// Key is read from the GOOGLE_PLACES_KEY env var (set in Vercel). Place ID is public.
const PLACE_ID = "ChIJj-thjxVVtjMRdmsUeV7mG_E";

module.exports = async (req, res) => {
  // Cache at the edge: ~1 call/hour to Google regardless of traffic.
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  const key = process.env.GOOGLE_PLACES_KEY;
  if (!key) { res.status(200).json({ reviews: [], error: "no-key" }); return; }
  try {
    const data = (await fetchNew(key)) || (await fetchLegacy(key));
    res.status(200).json(data || { reviews: [], error: "fetch-failed" });
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

// Places API (New)
async function fetchNew(key) {
  const r = await fetch(`https://places.googleapis.com/v1/places/${PLACE_ID}?key=${key}`, {
    headers: { "X-Goog-FieldMask": "rating,userRatingCount,googleMapsUri,reviews" },
  });
  if (!r.ok) return null;
  const j = await r.json();
  if (!j || !j.reviews) return null;
  return shape(j.rating, j.userRatingCount, j.googleMapsUri, j.reviews.map(rv => ({
    author: (rv.authorAttribution && rv.authorAttribution.displayName) || "Google user",
    photo: (rv.authorAttribution && rv.authorAttribution.photoUri) || "",
    rating: rv.rating || 5,
    text: (rv.text && rv.text.text) || (rv.originalText && rv.originalText.text) || "",
    relativeTime: rv.relativePublishTimeDescription || "",
    url: (rv.authorAttribution && rv.authorAttribution.uri) || j.googleMapsUri || "",
  })));
}

// Legacy Place Details (fallback)
async function fetchLegacy(key) {
  const u = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=rating,user_ratings_total,url,reviews&reviews_sort=newest&key=${key}`;
  const r = await fetch(u);
  if (!r.ok) return null;
  const j = await r.json();
  if (!j || j.status !== "OK" || !j.result) return null;
  const p = j.result;
  return shape(p.rating, p.user_ratings_total, p.url, (p.reviews || []).map(rv => ({
    author: rv.author_name || "Google user",
    photo: rv.profile_photo_url || "",
    rating: rv.rating || 5,
    text: rv.text || "",
    relativeTime: rv.relative_time_description || "",
    url: rv.author_url || p.url || "",
  })));
}
