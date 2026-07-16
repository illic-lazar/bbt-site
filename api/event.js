/* POST /api/event — public, privacy-friendly event ingest.
   Accepts a BATCH: { e:[ {n,p,r,s,src,um,ud,uc,d,l,pr}, ... ] }
   (short keys keep the sendBeacon payload small).

   Adds server-side: coarse country (Vercel edge header) + bot detection.
   Stores NO ip, NO cookies, NO personal data, referrer HOST only.
   Dormant-safe: 204 when Supabase isn't configured. Never throws to the client. */

const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|preview|monitor|lighthouse|pagespeed|gtmetrix|pingdom|uptime|headless|phantom|puppeteer|playwright|curl|wget|python-requests|axios|scrapy|semrush|ahrefs|mj12|dotbot|petalbot|yandex|baidu|applebot|duckduck/i;

// events we accept — anything else is ignored (keeps the table clean)
const ALLOWED = new Set([
  "page_view", "menu_view", "menu_category_select", "menu_item_view", "dish_view",
  "reservation_click", "directions_click", "phone_click", "whatsapp_click",
  "messenger_click", "email_click", "social_click",
  "gallery_open", "gallery_navigate", "currency_change",
  "chatbot_open", "chatbot_question", "chatbot_answer_action",
  "scroll_depth", "first_action"
]);

const s = (v, n) => (v == null ? null : String(v).slice(0, n));

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
    const batch = Array.isArray(body.e) ? body.e.slice(0, 25) : [];
    if (!batch.length) { res.status(204).end(); return; }

    const h = req.headers || {};
    const ua = String(h["user-agent"] || "");
    const country = s(h["x-vercel-ip-country"] || h["X-Vercel-IP-Country"] || "", 4) || null;
    const isBot = BOT_RE.test(ua) || !ua;

    const rows = [];
    for (const ev of batch) {
      const name = s(ev.n, 40);
      if (!name || !ALLOWED.has(name)) continue;                 // drop unknown events
      let props = null;
      if (ev.pr && typeof ev.pr === "object") {
        props = {};
        // cap props: max 10 keys, short values — no free text / no PII
        Object.keys(ev.pr).slice(0, 10).forEach((k) => {
          const v = ev.pr[k];
          props[String(k).slice(0, 30)] = typeof v === "number" || typeof v === "boolean" ? v : s(v, 120);
        });
      }
      rows.push({
        name,
        session_id: s(ev.s, 40),
        path: s(ev.p, 200),
        ref_host: s(ev.r, 120),
        source: s(ev.src, 40),
        utm_source: s(ev.um, 60),
        utm_medium: s(ev.ud, 60),
        utm_campaign: s(ev.uc, 80),
        country,
        device: s(ev.d, 10),
        lang: s(ev.l, 5),
        props,
        is_bot: isBot
      });
    }
    if (!rows.length) { res.status(204).end(); return; }

    await fetch(url.replace(/\/+$/, "") + "/rest/v1/events", {
      method: "POST",
      headers: { apikey: sk, authorization: "Bearer " + sk, "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(rows)
    });
  } catch (e) { /* analytics must never break the site */ }

  res.status(204).end();
};
