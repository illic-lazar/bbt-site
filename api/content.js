/* /api/content — PUBLIC read of published website content.
   Returns { settings, home, about, menu, gallery, seo } using each row's
   `published` document. Keys with no published doc are omitted, so the
   website falls back to its built-in (static) content.

   Dormant-safe: if Supabase isn't configured it returns {} (200), so
   pages render exactly their static HTML.

   Preview: /api/content?preview=1 with a valid admin token (header
   x-admin-token or ?token=) returns each row's `draft` instead — used by
   the admin "Preview" button. Preview responses are never cached. */

module.exports = async (req, res) => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sk = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  const preview = req.query && (req.query.preview === "1" || req.query.preview === "true");
  const token = (req.headers && (req.headers["x-admin-token"] || req.headers["X-Admin-Token"])) ||
                (req.query && req.query.token) || "";
  const ADMIN = process.env.ADMIN_TOKEN;
  const isPreview = preview && ADMIN && String(token).trim() === String(ADMIN).trim();

  if (isPreview) res.setHeader("Cache-Control", "no-store");
  // published content: short shared cache so publishes appear within ~a minute,
  // but the CDN can serve instantly and revalidate in the background.
  else res.setHeader("Cache-Control", "public, max-age=0, s-maxage=30, stale-while-revalidate=300");

  if (!url || !sk) { res.status(200).json({}); return; }

  const col = isPreview ? "draft" : "published";
  const base = url.replace(/\/+$/, "") + "/rest/v1/site_content";
  const H = { apikey: sk, authorization: "Bearer " + sk };

  try {
    const r = await fetch(base + "?select=key," + col, { headers: H });
    if (!r.ok) { res.status(200).json({}); return; }
    const rows = await r.json().catch(() => null);
    const out = {};
    if (Array.isArray(rows)) {
      for (const row of rows) {
        const doc = row && row[col];
        if (doc != null) out[row.key] = doc;
      }
    }
    res.status(200).json(out);
  } catch (e) {
    // never break the site on a read error — fall back to static content
    res.status(200).json({});
  }
};
