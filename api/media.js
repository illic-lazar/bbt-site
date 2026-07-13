/* /api/media — token-gated image library on Supabase Storage (bucket "media").
   Images are optimized + thumbnailed IN THE BROWSER (canvas) before upload,
   so this needs no image library and no npm dependencies.

   GET                         -> { configured, ready, items:[ {name, full, thumb, updated_at} ] }
   POST { action:"upload",     -> stores <id>.webp + <id>-thumb.webp,
          name, full, thumb }      returns { full, thumb, id }   (full/thumb = data URLs)
   POST { action:"delete", path } -> soft delete: moves the file to trash/ (recoverable)

   Auth: header x-admin-token (or ?token=) must equal env ADMIN_TOKEN. */

function decodeDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || "");
  if (!m) return null;
  return { type: m[1], buf: Buffer.from(m[2], "base64") };
}
const slug = (s) => String(s || "img").toLowerCase().replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "img";

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

  const root = url.replace(/\/+$/, "");
  const store = root + "/storage/v1";
  const pub = (path) => store + "/object/public/media/" + path;
  const H = { apikey: sk, authorization: "Bearer " + sk };

  try {
    if (req.method === "GET") {
      const r = await fetch(store + "/object/list/media", {
        method: "POST", headers: Object.assign({ "content-type": "application/json" }, H),
        body: JSON.stringify({ prefix: "", limit: 200, sortBy: { column: "updated_at", order: "desc" } })
      });
      if (r.status === 404 || r.status === 400) { res.status(200).json({ configured: true, ready: false }); return; }
      const rows = await r.json().catch(() => []);
      const items = (Array.isArray(rows) ? rows : [])
        .filter((o) => o && o.name && /-thumb\.webp$/.test(o.name) === false && /\.(webp|jpg|jpeg|png|avif)$/i.test(o.name))
        .map((o) => {
          const thumbName = o.name.replace(/\.webp$/i, "-thumb.webp");
          return { name: o.name, full: pub(o.name), thumb: pub(thumbName), updated_at: o.updated_at };
        });
      res.status(200).json({ configured: true, ready: true, items });
      return;
    }

    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body || "{}");
    if (!body || typeof body !== "object") body = {};

    if (body.action === "upload") {
      const full = decodeDataUrl(body.full);
      const thumb = decodeDataUrl(body.thumb);
      if (!full) { res.status(400).json({ error: "no image data" }); return; }
      if (!/^image\/(webp|jpeg|png)$/.test(full.type)) { res.status(400).json({ error: "unsupported image format" }); return; }
      if (full.buf.length > 5 * 1024 * 1024) { res.status(400).json({ error: "image too large (optimize failed)" }); return; }

      const id = slug(body.name) + "-" + Date.now().toString(36);
      const fullPath = id + ".webp";
      const thumbPath = id + "-thumb.webp";

      const up = async (path, obj) => fetch(store + "/object/media/" + path, {
        method: "POST",
        headers: Object.assign({ "content-type": obj.type, "x-upsert": "true", "cache-control": "31536000" }, H),
        body: obj.buf
      });
      const r1 = await up(fullPath, full);
      if (!r1.ok) { res.status(200).json({ error: "upload failed: " + (await r1.text().catch(() => "")) }); return; }
      if (thumb) await up(thumbPath, thumb);

      res.status(200).json({ ok: true, id, full: pub(fullPath), thumb: pub(thumb ? thumbPath : fullPath) });
      return;
    }

    if (body.action === "delete") { // soft delete: move out of the way, keep the bytes
      const name = String(body.path || "").replace(/^.*\/media\//, "").replace(/^\/+/, "");
      if (!name) { res.status(400).json({ error: "no path" }); return; }
      const mv = (src) => fetch(store + "/object/move", {
        method: "POST", headers: Object.assign({ "content-type": "application/json" }, H),
        body: JSON.stringify({ bucketId: "media", sourceKey: src, destinationKey: "trash/" + src })
      });
      await mv(name);
      const thumbName = name.replace(/\.webp$/i, "-thumb.webp");
      if (thumbName !== name) await mv(thumbName).catch(() => {});
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: "bad action" });
  } catch (e) {
    res.status(200).json({ error: String((e && e.message) || e) });
  }
};
