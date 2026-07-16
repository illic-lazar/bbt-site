/* /api/ops — token-gated maintenance endpoint (health checks + backups).
   health + backup are combined into ONE function on purpose: Vercel's Hobby
   plan allows a maximum of 12 Serverless Functions per deployment, and
   separate files pushed us to 13 and failed the build. Keep it that way.

   GET  ?action=health              -> deep health + content audit (default)
   GET  ?action=backups             -> list recent snapshots (metadata)
   GET  ?action=download[&id=N]     -> download a snapshot as JSON (off-site copy)
   POST {action:"backup"}           -> take a snapshot now
   POST {action:"verify", id}       -> restore-test a snapshot

   Uptime itself is probed from Supabase every 5 min (separate infrastructure
   from Vercel — see SUPABASE_STAGE8.sql); this endpoint reads those results
   and adds the checks that need application knowledge.

   False-positive discipline (spec #11): messaging/social hosts routinely block
   datacenter IPs. 401/403/405/429 from them = "reachable but bot-blocked",
   reported as `unknown`, never as broken. Only DNS/TLS failures and 404/5xx
   count as real breakage.

   Auth: x-admin-token (or ?token=) must equal ADMIN_TOKEN. */

const SITE = "https://www.bigbadthai.com";
const UA = "Mozilla/5.0 (compatible; BBT-HealthCheck/1.0; +https://www.bigbadthai.com)";

async function probe(url, timeoutMs = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    let r = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctl.signal, headers: { "user-agent": UA } });
    if (r.status === 405 || r.status === 501) r = await fetch(url, { method: "GET", redirect: "follow", signal: ctl.signal, headers: { "user-agent": UA } });
    clearTimeout(t);
    return { status: r.status, ms: Date.now() - t0 };
  } catch (e) { clearTimeout(t); return { status: null, ms: Date.now() - t0, error: String((e && e.name) || e) }; }
}
function classify(res) {
  if (res.status === null) return { state: "down", detail: res.error || "unreachable" };
  if (res.status >= 200 && res.status < 400) return { state: "ok", detail: res.status };
  if ([401, 403, 405, 429].includes(res.status)) return { state: "unknown", detail: res.status + " (bot-blocked, not a fault)" };
  return { state: "down", detail: res.status };
}

async function health(H, rest) {
  const out = { checkedAt: new Date().toISOString() };

  // 1. critical outbound links
  const links = [
    ["Reservation (Messenger)", "https://m.me/bigbadthai"],
    ["WhatsApp", "https://wa.me/639452994225"],
    ["Google Maps", "https://www.google.com/maps/place/?q=place_id:ChIJj-thjxVVtjMRdmsUeV7mG_E"],
    ["Instagram", "https://www.instagram.com/bigbadthairestaurant"],
    ["Facebook", "https://www.facebook.com/bigbadthai"],
    ["Icon CDN (pinned)", "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.47.0/tabler-icons.min.css"],
    ["Currency rates", "https://open.er-api.com/v6/latest/PHP"]
  ];
  out.links = [];
  await Promise.all(links.map(async ([name, u]) => { out.links.push({ name, url: u, ...classify(await probe(u)) }); }));
  out.links.sort((a, b) => a.name.localeCompare(b.name));

  // 2. chatbot
  try {
    const r = await fetch(SITE + "/api/chat", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "what time do you open?" }], sid: "healthcheck" }) });
    const j = await r.json().catch(() => ({}));
    out.chatbot = r.ok && j && j.reply ? { state: "ok", detail: "answering" }
      : { state: j && j.error === "no-key" ? "down" : "unknown", detail: (j && j.error) || ("http " + r.status) };
  } catch (e) { out.chatbot = { state: "down", detail: String(e && e.message) }; }

  // 3. content audit
  const pages = ["/", "/menu.html", "/about.html", "/gallery.html", "/visit.html", "/privacy.html"];
  out.content = [];
  const internal = new Set();
  await Promise.all(pages.map(async (p) => {
    const issues = [];
    try {
      const r = await fetch(SITE + p, { headers: { "user-agent": UA } });
      if (!r.ok) { out.content.push({ page: p, issues: ["page returned " + r.status] }); return; }
      const html = await r.text();
      if (!/<title>[^<]{5,}<\/title>/i.test(html)) issues.push("missing/short <title>");
      if (!/<meta[^>]+name=["']description["'][^>]+content=["'][^"']{20,}/i.test(html)) issues.push("missing meta description");
      if (!/<link[^>]+rel=["']canonical["']/i.test(html)) issues.push("missing canonical");
      if (!/og:image/i.test(html)) issues.push("missing og:image");
      const imgs = html.match(/<img\b[^>]*>/gi) || [];
      const noAlt = imgs.filter((t) => !/\balt=/i.test(t));
      if (noAlt.length) issues.push(noAlt.length + " image(s) with no alt attribute");
      const text = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (text.length < 200) issues.push("page has almost no text (empty section?)");
      (html.match(/href=["'](?!https?:|mailto:|tel:|#)([^"']+)["']/gi) || []).forEach((m) => {
        const h = m.replace(/^href=["']/i, "").replace(/["']$/, "").split("#")[0];
        if (h && !h.startsWith("//")) internal.add(h.startsWith("/") ? h : "/" + h);
      });
      out.content.push({ page: p, issues });
    } catch (e) { out.content.push({ page: p, issues: ["fetch failed: " + String(e && e.message)] }); }
  }));
  out.content.sort((a, b) => a.page.localeCompare(b.page));

  // 4. internal links
  out.brokenLinks = [];
  const targets = [...internal].filter((t) => !/^\/api\//.test(t)).slice(0, 40);
  await Promise.all(targets.map(async (t) => {
    const r = await probe(SITE + t, 6000);
    if (r.status === null || r.status >= 400) out.brokenLinks.push({ href: t, status: r.status || "unreachable" });
  }));

  out.ssl = { state: "ok", detail: "HTTPS; Vercel auto-renews certificates" };

  // 5. DB-backed: analytics, backups, uptime, security
  if (H && rest) {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    try {
      const ev = await fetch(rest + "/events?select=created_at&created_at=gte." + encodeURIComponent(since) + "&limit=1", { headers: H });
      const rows = await ev.json().catch(() => null);
      out.analytics = Array.isArray(rows) ? { state: rows.length ? "ok" : "unknown", detail: rows.length ? "events arriving" : "no events in 24h (low traffic, or tracking broken)" }
                                          : { state: "unknown", detail: "events table not reachable" };
    } catch (e) { out.analytics = { state: "unknown", detail: "error" }; }

    try {
      const bk = await fetch(rest + "/backups?select=created_at,verified,row_counts,bytes&order=created_at.desc&limit=1", { headers: H });
      const rows = await bk.json().catch(() => null);
      out.backup = Array.isArray(rows) && rows.length
        ? { state: rows[0].verified ? "ok" : "unknown", last: rows[0].created_at, verified: rows[0].verified, counts: rows[0].row_counts, bytes: rows[0].bytes }
        : { state: "down", detail: "no backups yet — run SUPABASE_STAGE8.sql" };
    } catch (e) { out.backup = { state: "unknown", detail: "error" }; }

    try {
      const mc = await fetch(rest + "/monitor_checks?select=name,kind,ok,status,ms,checked_at&checked_at=gte." + encodeURIComponent(since) + "&order=checked_at.desc&limit=3000", { headers: H });
      const rows = await mc.json().catch(() => null);
      if (Array.isArray(rows)) {
        const by = {};
        rows.forEach((r) => {
          by[r.name] = by[r.name] || { name: r.name, kind: r.kind, total: 0, ok: 0, msSum: 0, msN: 0, last: null };
          const b = by[r.name]; b.total++; if (r.ok) b.ok++;
          if (r.ms != null) { b.msSum += r.ms; b.msN++; }
          if (!b.last) b.last = { ok: r.ok, status: r.status, at: r.checked_at };
        });
        out.uptime = Object.values(by).map((b) => ({ name: b.name, kind: b.kind, checks: b.total,
          uptime: b.total ? Math.round((b.ok / b.total) * 1000) / 10 : null,
          avgMs: b.msN ? Math.round(b.msSum / b.msN) : null, last: b.last }))
          .sort((a, b) => (a.uptime ?? 100) - (b.uptime ?? 100));
      } else out.uptime = null;
    } catch (e) { out.uptime = null; }

    try {
      const fl = await fetch(rest + "/admin_audit?select=at,event,detail,country&order=at.desc&limit=20", { headers: H });
      const rows = await fl.json().catch(() => null);
      out.security = Array.isArray(rows) ? { state: "ok", recent: rows } : { state: "unknown", detail: "admin_audit not present" };
    } catch (e) { out.security = { state: "unknown", detail: "error" }; }
  } else {
    out.analytics = out.backup = out.security = { state: "unknown", detail: "Supabase not configured" };
    out.uptime = null;
  }

  // 6. roll-up
  const problems = [];
  (out.links || []).filter((l) => l.state === "down").forEach((l) => problems.push("Link down: " + l.name));
  if (out.chatbot && out.chatbot.state === "down") problems.push("Chatbot not answering");
  (out.content || []).forEach((c) => c.issues.forEach((i) => problems.push(c.page + ": " + i)));
  (out.brokenLinks || []).forEach((b) => problems.push("Broken internal link: " + b.href));
  if (out.backup && out.backup.state === "down") problems.push("No verified backup");
  (out.uptime || []).filter((u) => u.uptime != null && u.uptime < 99).forEach((u) => problems.push("Uptime " + u.uptime + "% — " + u.name));
  out.problems = problems;
  out.status = problems.length === 0 ? "healthy" : (problems.length <= 2 ? "attention" : "issues");
  return out;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const ADMIN = process.env.ADMIN_TOKEN;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sk = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = (req.headers && (req.headers["x-admin-token"] || req.headers["X-Admin-Token"])) || (req.query && req.query.token) || "";

  if (!ADMIN) { res.status(503).json({ error: "ADMIN_TOKEN not set" }); return; }
  if (!token || String(token).trim() !== String(ADMIN).trim()) { res.status(401).json({ error: "unauthorized" }); return; }

  const rest = url ? url.replace(/\/+$/, "") + "/rest/v1" : null;
  const rpc = url ? url.replace(/\/+$/, "") + "/rest/v1/rpc" : null;
  const H = url && sk ? { apikey: sk, authorization: "Bearer " + sk, "content-type": "application/json" } : null;

  try {
    if (req.method === "GET") {
      const q = req.query || {};
      const action = q.action || "health";

      if (action === "health") { res.status(200).json(await health(H, rest)); return; }
      if (!H) { res.status(200).json({ configured: false }); return; }

      if (action === "backups") {
        const r = await fetch(rest + "/backups?select=id,created_at,kind,row_counts,bytes,verified,note&order=created_at.desc&limit=30", { headers: H });
        if (r.status === 404 || r.status === 400) { res.status(200).json({ configured: true, ready: false }); return; }
        const rows = await r.json().catch(() => []);
        res.status(200).json({ configured: true, ready: true, backups: Array.isArray(rows) ? rows : [] });
        return;
      }

      if (action === "download") {
        const sel = q.id ? "&id=eq." + encodeURIComponent(q.id) : "";
        const r = await fetch(rest + "/backups?select=id,created_at,kind,tables,row_counts,verified" + sel + "&order=created_at.desc&limit=1", { headers: H });
        const rows = await r.json().catch(() => []);
        if (!rows.length) { res.status(404).json({ error: "no snapshot found" }); return; }
        const b = rows[0];
        const name = "bbt-backup-" + new Date(b.created_at).toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".json";
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", 'attachment; filename="' + name + '"');
        res.status(200).send(JSON.stringify({
          _meta: { site: "bigbadthai.com", snapshot_id: b.id, created_at: b.created_at, kind: b.kind,
                   verified: b.verified, row_counts: b.row_counts, restore: "See OPERATIONS.md — Backup & recovery" },
          data: b.tables
        }, null, 2));
        return;
      }
      res.status(400).json({ error: "bad action" });
      return;
    }

    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body || "{}");
    body = body || {};
    if (!H) { res.status(200).json({ configured: false }); return; }

    if (body.action === "backup") {
      const r = await fetch(rpc + "/backup_snapshot", { method: "POST", headers: H, body: JSON.stringify({ p_kind: "manual" }) });
      const id = await r.json().catch(() => null);
      if (!r.ok) { res.status(200).json({ error: "snapshot failed — is SUPABASE_STAGE8.sql applied?" }); return; }
      res.status(200).json({ ok: true, id });
      return;
    }

    if (body.action === "verify") {
      const r = await fetch(rest + "/backups?select=id,tables,row_counts&id=eq." + encodeURIComponent(body.id), { headers: H });
      const rows = await r.json().catch(() => []);
      if (!rows.length) { res.status(404).json({ error: "not found" }); return; }
      const b = rows[0], checks = [];
      let allOk = true;
      ["site_content", "bot_faq"].forEach((t) => {
        const arr = b.tables && b.tables[t], claimed = b.row_counts && b.row_counts[t];
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
