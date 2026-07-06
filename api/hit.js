/* POST /api/hit — privacy-friendly page-view beacon. No cookies, no PII.
   Records path + referrer host + coarse country (Vercel geo header) + session id. */

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).end(); return; }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sk = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !sk) { res.status(204).end(); return; }

  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body || "{}");
    if (!body || typeof body !== "object") body = {};

    const path = String(body.p || "").slice(0, 200);
    const ref = String(body.r || "").slice(0, 300);
    const session = String(body.s || "").slice(0, 40);
    const country = String((req.headers && (req.headers["x-vercel-ip-country"] || req.headers["X-Vercel-IP-Country"])) || "").slice(0, 4);

    await fetch(url.replace(/\/+$/, "") + "/rest/v1/page_hits", {
      method: "POST",
      headers: { apikey: sk, authorization: "Bearer " + sk, "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ path: path, ref: ref, country: country, session_id: session }),
    });
  } catch (e) { /* swallow */ }

  res.status(204).end();
};
