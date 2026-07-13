/* /api/manage — token-gated website-content editor backend.
   Reuses ADMIN_TOKEN + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

   GET                      -> { configured, ready, rows:{key:{draft,published,updated_at}} }
   GET ?history=<key>       -> { history:[ {id,note,created_at} ] }
   GET ?history=<key>&id=N  -> { snapshot }

   POST { action, key, ... }:
     save    {key, doc}          -> draft = doc                 (light validation, saved even with warnings)
     publish {key, note?}        -> published = draft + history  (HARD-blocks on validation errors)
     revert  {key}               -> draft = published            (discard unpublished edits)
     restore {key, id}           -> published = draft = history snapshot (+ new history row)

   Auth: header x-admin-token (or ?token=) must equal env ADMIN_TOKEN. */

const KEYS = ["settings", "home", "about", "menu", "gallery", "seo"];

// ---------- validation ----------------------------------------------
const isUrl = (s) => typeof s === "string" && /^https?:\/\/.+/i.test(s.trim());
const isTime = (s) => typeof s === "string" && /^([01]?\d|2[0-3]):[0-5]\d$/.test(s.trim());
// price: digits with optional thousands commas / decimals, e.g. "420", "2,290", "12.50"
const isPrice = (s) => typeof s === "string" && /^\d{1,3}(,?\d{3})*(\.\d{1,2})?$/.test(String(s).trim());
const nonEmpty = (s) => typeof s === "string" && s.trim().length > 0;

function validate(key, doc) {
  const e = [];
  if (doc == null || typeof doc !== "object") return ["Nothing to publish yet."];

  if (key === "settings") {
    if (!nonEmpty(doc.phone)) e.push("Phone number is required.");
    if (!nonEmpty(doc.email) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(doc.email || "")) e.push("A valid email is required.");
    [["reserve_url", "Reservation link"], ["maps_url", "Google Maps link"], ["directions_url", "Directions link"],
     ["instagram", "Instagram link"], ["facebook", "Facebook link"]].forEach(([k, label]) => {
      if (doc[k] && !isUrl(doc[k])) e.push(label + " must be a full http(s) link.");
    });
    if (!doc.reserve_url) e.push("Reservation link is required.");
    if (doc.hours) {
      if (doc.hours.open && !isTime(doc.hours.open)) e.push("Opening time must be HH:MM (24h).");
      if (doc.hours.close && !isTime(doc.hours.close)) e.push("Closing time must be HH:MM (24h).");
      if (!nonEmpty(doc.hours.label)) e.push("Hours label is required (e.g. “Open daily · 11:00 AM – 11:00 PM”).");
    }
  }

  if (key === "home") {
    if (!nonEmpty(doc.hero_title_html)) e.push("Homepage headline is required.");
    (doc.featured || []).forEach((f, i) => {
      if (!nonEmpty(f.name)) e.push("Featured dish #" + (i + 1) + " needs a name.");
      if (f.price && !isPrice(f.price)) e.push("Featured dish “" + (f.name || i + 1) + "” has an invalid price.");
    });
  }

  if (key === "about") {
    if (!nonEmpty(doc.hero_title)) e.push("About hero title is required.");
    (doc.scenes || []).forEach((s, i) => {
      if (!nonEmpty(s.title)) e.push("About scene #" + (i + 1) + " needs a title.");
    });
  }

  if (key === "menu") {
    const cats = doc.categories || [];
    if (!cats.length) e.push("The menu needs at least one category.");
    cats.forEach((c) => {
      if (!nonEmpty(c.title)) e.push("A menu category is missing its title.");
      (c.items || []).filter((it) => !it.deleted).forEach((it) => {
        if (!nonEmpty(it.name)) e.push("A dish in “" + (c.title || "?") + "” is missing its name.");
        if (it.price && !isPrice(it.price)) e.push("“" + (it.name || "?") + "” has an invalid price (numbers only).");
        (it.variants || []).forEach((v) => {
          if (v.price && !isPrice(v.price)) e.push("“" + (it.name || "?") + "” variant “" + (v.label || "?") + "” has an invalid price.");
        });
      });
    });
  }

  if (key === "gallery") {
    (doc.images || []).filter((im) => !im.deleted).forEach((im, i) => {
      if (!nonEmpty(im.full)) e.push("Gallery image #" + (i + 1) + " has no file.");
      if (!nonEmpty(im.alt)) e.push("Gallery image #" + (i + 1) + " needs alt text (for accessibility & SEO).");
    });
  }

  if (key === "seo") {
    const pages = doc.pages || {};
    Object.keys(pages).forEach((p) => {
      const s = pages[p] || {};
      if (s.og && !isUrl(s.og)) e.push(p + ": Open Graph image must be a full http(s) link.");
      if (s.robots && !["index", "noindex"].includes(s.robots)) e.push(p + ": Index setting must be index or noindex.");
      if (s.desc && s.desc.length > 320) e.push(p + ": Meta description is too long (max 320 chars).");
    });
  }
  return e;
}

// ---------- handler --------------------------------------------------
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const ADMIN = process.env.ADMIN_TOKEN;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sk = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = (req.headers && (req.headers["x-admin-token"] || req.headers["X-Admin-Token"])) ||
                (req.query && req.query.token) || "";

  if (!ADMIN) { res.status(503).json({ error: "ADMIN_TOKEN not set" }); return; }
  if (!token || String(token).trim() !== String(ADMIN).trim()) { res.status(401).json({ error: "unauthorized" }); return; }
  if (!url || !sk) { res.status(200).json({ configured: false }); return; }

  const base = url.replace(/\/+$/, "") + "/rest/v1/site_content";
  const hist = url.replace(/\/+$/, "") + "/rest/v1/content_history";
  const H = { apikey: sk, authorization: "Bearer " + sk, "content-type": "application/json" };
  const Hmin = Object.assign({ Prefer: "return=minimal" }, H);

  try {
    // ---- GET ----
    if (req.method === "GET") {
      const q = req.query || {};
      if (q.history) {
        const key = encodeURIComponent(q.history);
        if (q.id) {
          const r = await fetch(hist + "?select=snapshot&id=eq." + encodeURIComponent(q.id), { headers: H });
          const rows = await r.json().catch(() => []);
          res.status(200).json({ snapshot: (rows[0] && rows[0].snapshot) || null });
          return;
        }
        const r = await fetch(hist + "?select=id,note,created_at&key=eq." + key + "&order=created_at.desc&limit=50", { headers: H });
        const rows = await r.json().catch(() => []);
        res.status(200).json({ history: Array.isArray(rows) ? rows : [] });
        return;
      }
      const r = await fetch(base + "?select=key,draft,published,updated_at", { headers: H });
      if (r.status === 404 || r.status === 400) { res.status(200).json({ configured: true, ready: false }); return; }
      const rows = await r.json().catch(() => null);
      if (!Array.isArray(rows)) { res.status(200).json({ configured: true, ready: false }); return; }
      const out = {};
      rows.forEach((row) => { out[row.key] = { draft: row.draft, published: row.published, updated_at: row.updated_at }; });
      res.status(200).json({ configured: true, ready: true, rows: out });
      return;
    }

    // ---- POST ----
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body || "{}");
    if (!body || typeof body !== "object") body = {};
    const action = body.action;
    const key = body.key;
    if (!KEYS.includes(key) && action !== "restore") { res.status(400).json({ error: "bad key" }); return; }

    if (action === "save") {
      const warnings = validate(key, body.doc);
      await fetch(base + "?key=eq." + encodeURIComponent(key), {
        method: "PATCH", headers: Hmin,
        body: JSON.stringify({ draft: body.doc, updated_at: new Date().toISOString(), updated_by: "admin" })
      });
      res.status(200).json({ ok: true, warnings });
      return;
    }

    if (action === "publish") {
      // read the current draft
      const r = await fetch(base + "?select=draft&key=eq." + encodeURIComponent(key), { headers: H });
      const rows = await r.json().catch(() => []);
      const draft = rows[0] && rows[0].draft;
      if (draft == null) { res.status(400).json({ error: "Nothing to publish — make an edit first." }); return; }
      const errors = validate(key, draft);
      if (errors.length) { res.status(400).json({ error: "validation", errors }); return; }
      await fetch(base + "?key=eq." + encodeURIComponent(key), {
        method: "PATCH", headers: Hmin,
        body: JSON.stringify({ published: draft, updated_at: new Date().toISOString(), updated_by: "admin" })
      });
      await fetch(hist, {
        method: "POST", headers: Hmin,
        body: JSON.stringify({ key: key, snapshot: draft, note: (body.note || "").slice(0, 200) })
      });
      res.status(200).json({ ok: true });
      return;
    }

    if (action === "revert") { // discard unpublished draft edits
      const r = await fetch(base + "?select=published&key=eq." + encodeURIComponent(key), { headers: H });
      const rows = await r.json().catch(() => []);
      const pub = rows[0] && rows[0].published;
      await fetch(base + "?key=eq." + encodeURIComponent(key), {
        method: "PATCH", headers: Hmin, body: JSON.stringify({ draft: pub, updated_at: new Date().toISOString() })
      });
      res.status(200).json({ ok: true });
      return;
    }

    if (action === "restore") { // roll back to a history snapshot
      const id = encodeURIComponent(body.id);
      const rk = encodeURIComponent(body.key);
      const r = await fetch(hist + "?select=snapshot&id=eq." + id, { headers: H });
      const rows = await r.json().catch(() => []);
      const snap = rows[0] && rows[0].snapshot;
      if (snap == null) { res.status(400).json({ error: "snapshot not found" }); return; }
      await fetch(base + "?key=eq." + rk, {
        method: "PATCH", headers: Hmin,
        body: JSON.stringify({ published: snap, draft: snap, updated_at: new Date().toISOString(), updated_by: "admin" })
      });
      await fetch(hist, { method: "POST", headers: Hmin, body: JSON.stringify({ key: body.key, snapshot: snap, note: "Restored earlier version" }) });
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: "bad action" });
  } catch (e) {
    res.status(200).json({ error: String((e && e.message) || e) });
  }
};
