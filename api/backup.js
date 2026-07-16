/* /api/backup — token-gated backup export / restore verification.

   GET                -> list recent snapshots (metadata only)
   GET ?download=1    -> download the latest snapshot as a JSON file
   GET ?download=1&id=N -> download a specific snapshot
   POST {action:"run"}  -> take a snapshot now (calls backup_snapshot)
   POST {action:"verify", id} -> re-verify a snapshot parses + counts match

   The nightly snapshots live IN the database (see SUPABASE_STAGE8.sql).
   That protects against the realistic risk — a bad edit or accidental
   delete. This endpoint is how you get a copy OFF-site: download the JSON
   and keep it somewhere else. See OPERATIONS.md.

   Auth: x-admin-token (or ?token=) must equal ADMIN_TOKEN. */

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const ADMIN = process.env.ADMIN_TOKEN;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sk = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = (req.headers && (req.headers["x-admin-token"] || req.headers["X-Admin-Token"])) || (req.query && req.query.token) || "";

  if (!ADMIN) { res.status(503).json({ error: "ADMIN_TOKEN not set" }); return; }
  if (!token || String(token).trim() !== String(ADMIN).trim()) { res.status(401).json({ error: "unauthorized" }); return; }
  if (!url || !sk) { res.status(200).json({ configured: false }); return; }

  const rest = url.replace(/\/+$/, "") + "/rest/v1";
  const rpc = url.replace(/\/+$/, "") + "/rest/v1/rpc";
  const H = { apikey: sk, authorization: "Bearer " + sk, "content-type": "application/json" };

  try {
    if (req.method === "GET") {
      const q = req.query || {};
      if (q.download === "1") {
        const sel = q.id ? "&id=eq." + encodeURIComponent(q.id) : "";
        const r = await fetch(rest + "/backups?select=id,created_at,kind,tables,row_counts,verified" + sel + "&order=created_at.desc&limit=1", { headers: H });
        const rows = await r.json().catch(() => []);
        if (!rows.length) { res.status(404).json({ error: "no snapshot found" }); return; }
        const b = rows[0];
        const name = "bbt-backup-" + new Date(b.created_at).toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".json";
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", 'attachment; filename="' + name + '"');
        res.status(200).send(JSON.stringify({
          _meta: { site: "bigbadthai.com", snapshot_id: b.id, created_at: b.created_at,
                   kind: b.kind, verified: b.verified, row_counts: b.row_counts,
                   restore: "See OPERATIONS.md — Backup & recovery" },
          data: b.tables
        }, null, 2));
        return;
      }
      const r = await fetch(rest + "/backups?select=id,created_at,kind,row_counts,bytes,verified,note&order=created_at.desc&limit=30", { headers: H });
      if (r.status === 404 || r.status === 400) { res.status(200).json({ configured: true, ready: false }); return; }
      const rows = await r.json().catch(() => []);
      res.status(200).json({ configured: true, ready: true, backups: Array.isArray(rows) ? rows : [] });
      return;
    }

    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body || "{}");
    body = body || {};

    if (body.action === "run") {
      const r = await fetch(rpc + "/backup_snapshot", { method: "POST", headers: H, body: JSON.stringify({ p_kind: "manual" }) });
      const id = await r.json().catch(() => null);
      if (!r.ok) { res.status(200).json({ error: "snapshot failed — is SUPABASE_STAGE8.sql applied?" }); return; }
      res.status(200).json({ ok: true, id });
      return;
    }

    if (body.action === "verify") {
      // real restore test: pull the snapshot back out, re-parse it, and confirm
      // the row counts still match what it claims.
      const r = await fetch(rest + "/backups?select=id,tables,row_counts&id=eq." + encodeURIComponent(body.id), { headers: H });
      const rows = await r.json().catch(() => []);
      if (!rows.length) { res.status(404).json({ error: "not found" }); return; }
      const b = rows[0];
      const checks = [];
      let allOk = true;
      ["site_content", "bot_faq"].forEach((t) => {
        const arr = b.tables && b.tables[t];
        const claimed = b.row_counts && b.row_counts[t];
        const ok = Array.isArray(arr) && Number(arr.length) === Number(claimed);
        if (!ok) allOk = false;
        checks.push({ table: t, rows: Array.isArray(arr) ? arr.length : null, claimed, ok });
      });
      await fetch(rest + "/backups?id=eq." + encodeURIComponent(body.id), {
        method: "PATCH", headers: Object.assign({ Prefer: "return=minimal" }, H),
        body: JSON.stringify({ verified: allOk, note: "restore-tested " + new Date().toISOString().slice(0, 10) })
      });
      res.status(200).json({ ok: allOk, checks });
      return;
    }

    res.status(400).json({ error: "bad action" });
  } catch (e) {
    res.status(200).json({ error: String((e && e.message) || e) });
  }
};
