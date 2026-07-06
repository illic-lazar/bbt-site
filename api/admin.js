/* /api/admin — manage the bot's owner-added knowledge (bot_faq table).
   GET  -> list facts. POST {action:add|toggle|delete,...} -> mutate.
   Auth: header x-admin-token (or ?token=) must equal env ADMIN_TOKEN. */

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const ADMIN = process.env.ADMIN_TOKEN;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sk = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = (req.headers && (req.headers["x-admin-token"] || req.headers["X-Admin-Token"])) || (req.query && req.query.token) || "";

  if (!ADMIN) { res.status(503).json({ error: "ADMIN_TOKEN not set" }); return; }
  if (!token || token !== ADMIN) { res.status(401).json({ error: "unauthorized" }); return; }
  if (!url || !sk) { res.status(200).json({ configured: false }); return; }

  const base = url.replace(/\/+$/, "") + "/rest/v1/bot_faq";
  const H = { apikey: sk, authorization: "Bearer " + sk, "content-type": "application/json" };

  try {
    if (req.method === "GET") {
      const r = await fetch(base + "?select=id,content,active,created_at&order=created_at.desc", { headers: H });
      const rows = await r.json().catch(() => null);
      res.status(200).json({ configured: true, faq: Array.isArray(rows) ? rows : null });
      return;
    }

    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body || "{}");
    if (!body || typeof body !== "object") body = {};
    const action = body.action;

    if (action === "add") {
      const content = String(body.content || "").trim().slice(0, 1000);
      if (!content) { res.status(400).json({ error: "empty" }); return; }
      await fetch(base, { method: "POST", headers: Object.assign({ Prefer: "return=minimal" }, H), body: JSON.stringify({ content: content }) });
      res.status(200).json({ ok: true }); return;
    }
    if (action === "toggle") {
      const id = encodeURIComponent(body.id);
      await fetch(base + "?id=eq." + id, { method: "PATCH", headers: Object.assign({ Prefer: "return=minimal" }, H), body: JSON.stringify({ active: !!body.active }) });
      res.status(200).json({ ok: true }); return;
    }
    if (action === "delete") {
      const id = encodeURIComponent(body.id);
      await fetch(base + "?id=eq." + id, { method: "DELETE", headers: Object.assign({ Prefer: "return=minimal" }, H) });
      res.status(200).json({ ok: true }); return;
    }
    res.status(400).json({ error: "bad action" });
  } catch (e) {
    res.status(200).json({ error: String((e && e.message) || e) });
  }
};
