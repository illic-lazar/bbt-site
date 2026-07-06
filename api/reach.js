/* GET /api/reach — self-hosted site-traffic stats for the /admin dashboard.
   Auth: header x-admin-token (or ?token=) must equal env ADMIN_TOKEN. Reads page_hits. */

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const ADMIN = process.env.ADMIN_TOKEN;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sk = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = (req.headers && (req.headers["x-admin-token"] || req.headers["X-Admin-Token"])) || (req.query && req.query.token) || "";

  if (!ADMIN) { res.status(503).json({ error: "ADMIN_TOKEN not set" }); return; }
  if (!token || token !== ADMIN) { res.status(401).json({ error: "unauthorized" }); return; }
  if (!url || !sk) { res.status(200).json({ configured: false }); return; }

  const base = url.replace(/\/+$/, "");
  const H = { apikey: sk, authorization: "Bearer " + sk };

  try {
    let total = null;
    try {
      const cres = await fetch(base + "/rest/v1/page_hits?select=id", { headers: Object.assign({ Prefer: "count=exact", Range: "0-0" }, H) });
      const cr = cres.headers.get("content-range"); if (cr) { const m = cr.match(/\/(\d+)\s*$/); if (m) total = +m[1]; }
    } catch (e) {}

    const data = await (await fetch(base + "/rest/v1/page_hits?select=created_at,path,ref,country,session_id&order=created_at.desc&limit=4000", { headers: H })).json().catch(() => null);
    const list = Array.isArray(data) ? data : null;
    if (list === null) { res.status(200).json({ configured: true, needsTable: true }); return; }
    if (total == null) total = list.length;

    const now = new Date();
    const dayKey = d => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
    const todayKey = dayKey(now);
    const tidyRef = r => { if (!r) return "Direct / app"; try { const h = new URL(r).hostname.replace(/^www\./, ""); return h || "Direct / app"; } catch (e) { return "Direct / app"; } };

    const sessions = new Set(), byDayMap = {}, pages = {}, refs = {}, countries = {};
    let today = 0;
    list.forEach(r => {
      if (r.session_id) sessions.add(r.session_id);
      const dk = dayKey(r.created_at); byDayMap[dk] = (byDayMap[dk] || 0) + 1; if (dk === todayKey) today++;
      const p = r.path || "/"; pages[p] = (pages[p] || 0) + 1;
      const rf = tidyRef(r.ref); refs[rf] = (refs[rf] || 0) + 1;
      const c = (r.country || "").toUpperCase(); if (c && c !== "XX") countries[c] = (countries[c] || 0) + 1;
    });
    const top = (o, n) => Object.keys(o).map(k => ({ k: k, c: o[k] })).sort((a, b) => b.c - a.c).slice(0, n);

    const byDay = [];
    for (let i = 13; i >= 0; i--) { const d = new Date(now); d.setDate(now.getDate() - i); const k = dayKey(d); byDay.push({ date: k, count: byDayMap[k] || 0 }); }

    res.status(200).json({
      configured: true,
      total, visits: sessions.size, today, windowSize: list.length,
      byDay, topPages: top(pages, 10), topReferrers: top(refs, 8), topCountries: top(countries, 12),
    });
  } catch (e) {
    res.status(200).json({ error: String((e && e.message) || e) });
  }
};
