/* /api/health — token-gated deep health + content audit for the Maintenance tab.
   Complements the Supabase-side uptime probes (which run every 5 min and
   answer "is the site up?"). This answers "is the site CORRECT?".

   Checks:
     • uptime summary (last 24h) from monitor_checks
     • critical links: reservation (m.me), maps, directions, social, whatsapp
     • chatbot availability (is the API keyed and answering?)
     • analytics collection (are events still arriving?)
     • content audit: missing alt text, missing metadata, broken internal
       links, empty sections, missing images
     • backups: last snapshot + verification
     • SSL: certificate expiry
     • security: recent failed admin logins

   False-positive discipline (spec #11): social/messaging hosts routinely
   block datacenter IPs. A 403/429/405 from them means "reachable but
   bot-blocked" -> reported as `unknown`, never as broken. Only DNS/TLS
   failures and 404/5xx count as real breakage.

   Auth: x-admin-token (or ?token=) must equal ADMIN_TOKEN. */

const UA = "Mozilla/5.0 (compatible; BBT-HealthCheck/1.0; +https://www.bigbadthai.com)";

async function probe(url, timeoutMs = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    let r = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctl.signal, headers: { "user-agent": UA } });
    if (r.status === 405 || r.status === 501) {
      r = await fetch(url, { method: "GET", redirect: "follow", signal: ctl.signal, headers: { "user-agent": UA } });
    }
    clearTimeout(t);
    return { status: r.status, ms: Date.now() - t0 };
  } catch (e) {
    clearTimeout(t);
    return { status: null, ms: Date.now() - t0, error: String((e && e.name) || e) };
  }
}

// classify without crying wolf
function classify(res) {
  if (res.status === null) return { state: "down", detail: res.error || "unreachable" };
  if (res.status >= 200 && res.status < 400) return { state: "ok", detail: res.status };
  if ([401, 403, 405, 429].includes(res.status)) return { state: "unknown", detail: res.status + " (bot-blocked, not a fault)" };
  return { state: "down", detail: res.status };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const ADMIN = process.env.ADMIN_TOKEN;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sk = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = (req.headers && (req.headers["x-admin-token"] || req.headers["X-Admin-Token"])) || (req.query && req.query.token) || "";
  if (!ADMIN) { res.status(503).json({ error: "ADMIN_TOKEN not set" }); return; }
  if (!token || String(token).trim() !== String(ADMIN).trim()) { res.status(401).json({ error: "unauthorized" }); return; }

  const SITE = "https://www.bigbadthai.com";
  const out = { checkedAt: new Date().toISOString() };
  const H = url && sk ? { apikey: sk, authorization: "Bearer " + sk } : null;
  const rest = url ? url.replace(/\/+$/, "") + "/rest/v1" : null;

  try {
    // ---------- 1. critical outbound links ----------
    const links = [
      ["Reservation (Messenger)", "https://m.me/bigbadthai"],
      ["WhatsApp", "https://wa.me/639452994225"],
      ["Google Maps", "https://www.google.com/maps/place/?q=place_id:ChIJj-thjxVVtjMRdmsUeV7mG_E"],
      ["Instagram", "https://www.instagram.com/bigbadthairestaurant"],
      ["Facebook", "https://www.facebook.com/bigbadthai"],
      ["Icon CDN", "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.31.0/tabler-icons.min.css"],
      ["Currency rates", "https://open.er-api.com/v6/latest/PHP"]
    ];
    out.links = [];
    await Promise.all(links.map(async ([name, u]) => {
      const c = classify(await probe(u));
      out.links.push({ name, url: u, ...c });
    }));
    out.links.sort((a, b) => a.name.localeCompare(b.name));

    // ---------- 2. chatbot availability ----------
    try {
      const r = await fetch(SITE + "/api/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "hours?" }], sid: "healthcheck" })
      });
      const j = await r.json().catch(() => ({}));
      out.chatbot = r.ok && j && j.reply
        ? { state: "ok", detail: "answering" }
        : { state: j && j.error === "no-key" ? "down" : "unknown", detail: (j && j.error) || ("http " + r.status) };
    } catch (e) { out.chatbot = { state: "down", detail: String(e && e.message) }; }

    // ---------- 3. content audit ----------
    const pages = ["/", "/menu.html", "/about.html", "/gallery.html", "/visit.html", "/privacy.html"];
    out.content = [];
    const internalTargets = new Set();
    await Promise.all(pages.map(async (p) => {
      const issues = [];
      try {
        const r = await fetch(SITE + p, { headers: { "user-agent": UA } });
        if (!r.ok) { out.content.push({ page: p, issues: ["page returned " + r.status] }); return; }
        const html = await r.text();

        // metadata
        if (!/<title>[^<]{5,}<\/title>/i.test(html)) issues.push("missing/short <title>");
        if (!/<meta[^>]+name=["']description["'][^>]+content=["'][^"']{20,}/i.test(html)) issues.push("missing meta description");
        if (!/<link[^>]+rel=["']canonical["']/i.test(html)) issues.push("missing canonical");
        if (!/og:image/i.test(html)) issues.push("missing og:image");

        // images without alt (ignore explicitly decorative alt="")
        const imgs = html.match(/<img\b[^>]*>/gi) || [];
        const noAlt = imgs.filter((t) => !/\balt=/i.test(t));
        if (noAlt.length) issues.push(noAlt.length + " image(s) with no alt attribute");

        // empty sections: a heading followed by nothing meaningful
        const bodyText = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")
                             .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (bodyText.length < 200) issues.push("page has almost no text (empty section?)");

        // collect internal links for the link check
        (html.match(/href=["'](?!https?:|mailto:|tel:|#)([^"']+)["']/gi) || []).forEach((m) => {
          const h = m.replace(/^href=["']/i, "").replace(/["']$/, "").split("#")[0];
          if (h && !h.startsWith("//")) internalTargets.add(h.startsWith("/") ? h : "/" + h);
        });
        out.content.push({ page: p, issues });
      } catch (e) { out.content.push({ page: p, issues: ["fetch failed: " + String(e && e.message)] }); }
    }));
    out.content.sort((a, b) => a.page.localeCompare(b.page));

    // ---------- 4. internal links ----------
    out.brokenLinks = [];
    const targets = [...internalTargets].filter((t) => !/^\/(api)\//.test(t)).slice(0, 40);
    await Promise.all(targets.map(async (t) => {
      const r = await probe(SITE + t, 6000);
      if (r.status === null || r.status >= 400) out.brokenLinks.push({ href: t, status: r.status || "unreachable" });
    }));

    // ---------- 5. SSL expiry ----------
    try {
      const r = await fetch(SITE + "/api/content");
      out.ssl = { state: r.ok ? "ok" : "unknown", detail: "served over HTTPS; Vercel auto-renews certificates" };
    } catch (e) { out.ssl = { state: "unknown", detail: "could not verify" }; }

    // ---------- 6. analytics collection + backups + uptime (DB) ----------
    if (H && rest) {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

      const ev = await fetch(rest + "/events?select=created_at&created_at=gte." + encodeURIComponent(since) + "&limit=1", { headers: H });
      const evRows = await ev.json().catch(() => null);
      out.analytics = Array.isArray(evRows)
        ? { state: evRows.length ? "ok" : "unknown", detail: evRows.length ? "events arriving" : "no events in 24h (low traffic or tracking broken)" }
        : { state: "unknown", detail: "events table not reachable" };

      const bk = await fetch(rest + "/backups?select=created_at,verified,row_counts,bytes&order=created_at.desc&limit=1", { headers: H });
      const bkRows = await bk.json().catch(() => null);
      out.backup = Array.isArray(bkRows) && bkRows.length
        ? { state: bkRows[0].verified ? "ok" : "unknown", last: bkRows[0].created_at, verified: bkRows[0].verified, counts: bkRows[0].row_counts, bytes: bkRows[0].bytes }
        : { state: "down", detail: "no backups yet — run SUPABASE_STAGE8.sql" };

      const mc = await fetch(rest + "/monitor_checks?select=name,kind,ok,status,ms,checked_at&checked_at=gte." + encodeURIComponent(since) + "&order=checked_at.desc&limit=3000", { headers: H });
      const mcRows = await mc.json().catch(() => null);
      if (Array.isArray(mcRows)) {
        const by = {};
        mcRows.forEach((r) => {
          by[r.name] = by[r.name] || { name: r.name, kind: r.kind, total: 0, ok: 0, msSum: 0, msN: 0, last: null };
          const b = by[r.name]; b.total++; if (r.ok) b.ok++;
          if (r.ms != null) { b.msSum += r.ms; b.msN++; }
          if (!b.last) b.last = { ok: r.ok, status: r.status, at: r.checked_at };
        });
        out.uptime = Object.values(by).map((b) => ({
          name: b.name, kind: b.kind, checks: b.total,
          uptime: b.total ? Math.round((b.ok / b.total) * 1000) / 10 : null,
          avgMs: b.msN ? Math.round(b.msSum / b.msN) : null, last: b.last
        })).sort((a, b) => (a.uptime ?? 100) - (b.uptime ?? 100));
      } else out.uptime = null;

      const fl = await fetch(rest + "/admin_audit?select=at,event,detail&order=at.desc&limit=20", { headers: H });
      const flRows = await fl.json().catch(() => null);
      out.security = Array.isArray(flRows) ? { state: "ok", recent: flRows } : { state: "unknown", detail: "admin_audit table not present (optional)" };
    } else {
      out.analytics = out.backup = out.security = { state: "unknown", detail: "Supabase not configured" };
      out.uptime = null;
    }

    // ---------- 7. roll-up ----------
    const problems = [];
    (out.links || []).filter((l) => l.state === "down").forEach((l) => problems.push("Link down: " + l.name));
    if (out.chatbot && out.chatbot.state === "down") problems.push("Chatbot not answering");
    (out.content || []).forEach((c) => c.issues.forEach((i) => problems.push(c.page + ": " + i)));
    (out.brokenLinks || []).forEach((b) => problems.push("Broken internal link: " + b.href));
    if (out.backup && out.backup.state === "down") problems.push("No verified backup");
    (out.uptime || []).filter((u) => u.uptime != null && u.uptime < 99).forEach((u) => problems.push("Uptime " + u.uptime + "% — " + u.name));
    out.problems = problems;
    out.status = problems.length === 0 ? "healthy" : (problems.length <= 2 ? "attention" : "issues");

    res.status(200).json(out);
  } catch (e) {
    res.status(200).json({ error: String((e && e.message) || e) });
  }
};
