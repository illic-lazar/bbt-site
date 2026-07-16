/* /api/insights — token-gated analytics aggregator for the admin dashboard.
   Reads the `events` table (bots excluded) and `chat_logs` (for unanswered).

   GET /api/insights?range=7d|today|30d|custom&from=&to=&compare=1
        &country=&device=&path=&source=&channel=&topic=

   Filters are pushed down to Postgres; aggregation happens here (same
   approach as the existing reach.js, per "don't replace the analytics
   system"). Known limitation: a single window is capped at ROW_CAP rows —
   see ANALYTICS.md.

   Auth: x-admin-token (or ?token=) must equal env ADMIN_TOKEN. */

const ROW_CAP = 20000;

// A conversion = a guest taking a real contact/booking action.
const CONV = { reservation_click: "reservation", directions_click: "directions", phone_click: "phone",
               whatsapp_click: "messaging", messenger_click: "messaging" };
const CONTACT = { phone_click: "phone", whatsapp_click: "whatsapp", messenger_click: "messenger",
                  email_click: "email", reservation_click: "messenger (reserve)" };

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
const top = (m, n) => Object.keys(m).map((k) => ({ k, c: m[k] })).sort((a, b) => b.c - a.c).slice(0, n || 10);
const inc = (m, k) => { if (k == null || k === "") return; m[k] = (m[k] || 0) + 1; };

function rangeOf(q) {
  const now = new Date();
  let to = new Date(now), from = new Date(now);
  const r = q.range || "7d";
  if (r === "today") from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  else if (r === "30d") from.setDate(now.getDate() - 30);
  else if (r === "custom" && q.from) { from = new Date(q.from); if (q.to) { to = new Date(q.to); to.setHours(23, 59, 59, 999); } }
  else from.setDate(now.getDate() - 7);
  return { from, to };
}

function aggregate(rows) {
  const sessions = new Set(), convSessions = new Set(), chatSessions = new Set();
  const byDay = {}, countries = {}, devices = {}, sources = {}, pages = {},
        categories = {}, dishes = {}, contacts = {}, convTypes = {},
        chatTopics = {}, chatPages = {}, scroll = {}, chatAnswerActions = {};
  const perPage = {}, perCountry = {}, perDevice = {};
  let views = 0, chatOpens = 0, chatQuestions = 0, galleryOpens = 0, currencyChanges = 0;
  const ttfa = [];

  const bucket = (m, k, field) => { if (k == null || k === "") return; m[k] = m[k] || { views: 0, convS: new Set(), sess: new Set() }; if (field) m[k][field]++; };

  for (const r of rows) {
    const d = dayKey(r.created_at);
    byDay[d] = byDay[d] || { date: d, views: 0, conversions: 0 };
    if (r.session_id) sessions.add(r.session_id);

    if (r.name === "page_view") {
      views++; byDay[d].views++;
      inc(countries, r.country); inc(devices, r.device); inc(sources, r.source); inc(pages, r.path);
      bucket(perPage, r.path, "views"); bucket(perCountry, r.country, "views"); bucket(perDevice, r.device, "views");
      if (r.session_id) {
        [[perPage, r.path], [perCountry, r.country], [perDevice, r.device]].forEach(([m, k]) => { if (k) { m[k] = m[k] || { views: 0, convS: new Set(), sess: new Set() }; m[k].sess.add(r.session_id); } });
      }
    }

    const conv = CONV[r.name];
    if (conv) {
      byDay[d].conversions++; inc(convTypes, conv);
      if (r.session_id) {
        convSessions.add(r.session_id);
        [[perPage, r.path], [perCountry, r.country], [perDevice, r.device]].forEach(([m, k]) => { if (k) { m[k] = m[k] || { views: 0, convS: new Set(), sess: new Set() }; m[k].convS.add(r.session_id); } });
      }
    }
    if (CONTACT[r.name]) inc(contacts, CONTACT[r.name]);

    const p = r.props || {};
    if (r.name === "menu_category_select") inc(categories, p.category);
    if (r.name === "menu_item_view" || r.name === "dish_view") inc(dishes, p.dish);
    if (r.name === "gallery_open") galleryOpens++;
    if (r.name === "currency_change") currencyChanges++;
    if (r.name === "scroll_depth") inc(scroll, String(p.depth));
    if (r.name === "chatbot_open") { chatOpens++; inc(chatPages, r.path); }
    if (r.name === "chatbot_question") { chatQuestions++; inc(chatTopics, p.topic); if (r.session_id) chatSessions.add(r.session_id); }
    if (r.name === "chatbot_answer_action") inc(chatAnswerActions, p.action);
    if (r.name === "first_action" && typeof p.ms === "number") ttfa.push(p.ms);
  }

  const rate = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);
  const dimOut = (m) => Object.keys(m).map((k) => ({ k, views: m[k].views, sessions: m[k].sess.size,
      conversions: m[k].convS.size, rate: rate(m[k].convS.size, m[k].sess.size) }))
      .filter((x) => x.sessions > 0).sort((a, b) => b.sessions - a.sessions).slice(0, 12);

  // chatbot -> conversion correlation (shared bbtSid session id)
  let chatThenConv = 0; chatSessions.forEach((s) => { if (convSessions.has(s)) chatThenConv++; });
  ttfa.sort((a, b) => a - b);

  return {
    totals: { views, sessions: sessions.size, conversions: convSessions.size,
              conversionRate: rate(convSessions.size, sessions.size) },
    byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
    countries: top(countries, 12), devices: top(devices, 5), sources: top(sources, 10), pages: top(pages, 10),
    categories: top(categories, 10), dishes: top(dishes, 12), contacts: top(contacts, 6),
    conversions: convTypes,
    convByPage: dimOut(perPage), convByCountry: dimOut(perCountry), convByDevice: dimOut(perDevice),
    chat: { opens: chatOpens, questions: chatQuestions, topics: top(chatTopics, 10),
            triggerPages: top(chatPages, 8), answerActions: top(chatAnswerActions, 5),
            sessionsWithChat: chatSessions.size, chatThenConverted: chatThenConv,
            chatConversionRate: rate(chatThenConv, chatSessions.size) },
    engagement: { scroll: top(scroll, 4), galleryOpens, currencyChanges,
                  medianTimeToFirstAction: ttfa.length ? ttfa[Math.floor(ttfa.length / 2)] : null }
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const ADMIN = process.env.ADMIN_TOKEN;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sk = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = (req.headers && (req.headers["x-admin-token"] || req.headers["X-Admin-Token"])) || (req.query && req.query.token) || "";

  if (!ADMIN) { res.status(503).json({ error: "ADMIN_TOKEN not set" }); return; }
  if (!token || String(token).trim() !== String(ADMIN).trim()) { res.status(401).json({ error: "unauthorized" }); return; }
  if (!url || !sk) { res.status(200).json({ configured: false }); return; }

  const q = req.query || {};
  const base = url.replace(/\/+$/, "") + "/rest/v1";
  const H = { apikey: sk, authorization: "Bearer " + sk };

  const filters = [];
  if (q.country) filters.push("country=eq." + encodeURIComponent(q.country));
  if (q.device) filters.push("device=eq." + encodeURIComponent(q.device));
  if (q.path) filters.push("path=eq." + encodeURIComponent(q.path));
  if (q.source) filters.push("source=eq." + encodeURIComponent(q.source));

  async function fetchRange(from, to) {
    const url2 = base + "/events?select=created_at,name,session_id,path,source,country,device,props"
      + "&is_bot=eq.false"
      + "&created_at=gte." + encodeURIComponent(from.toISOString())
      + "&created_at=lte." + encodeURIComponent(to.toISOString())
      + (filters.length ? "&" + filters.join("&") : "")
      + "&order=created_at.desc&limit=" + ROW_CAP;
    const r = await fetch(url2, { headers: H });
    if (r.status === 404 || r.status === 400) return null;      // table not created yet
    const rows = await r.json().catch(() => null);
    return Array.isArray(rows) ? rows : null;
  }

  try {
    const { from, to } = rangeOf(q);
    const rows = await fetchRange(from, to);
    if (rows === null) { res.status(200).json({ configured: true, ready: false }); return; }

    const out = { configured: true, ready: true, range: { from: from.toISOString(), to: to.toISOString() },
                  capped: rows.length >= ROW_CAP, current: aggregate(rows) };

    // previous-period comparison
    if (q.compare === "1") {
      const span = to.getTime() - from.getTime();
      const pTo = new Date(from.getTime() - 1), pFrom = new Date(from.getTime() - 1 - span);
      const prev = await fetchRange(pFrom, pTo);
      if (prev) out.previous = aggregate(prev).totals;
    }

    // unanswered chatbot questions (from chat_logs — the bot's own handoff marker)
    const cl = await fetch(base + "/chat_logs?select=created_at,question,reply&created_at=gte."
      + encodeURIComponent(from.toISOString()) + "&order=created_at.desc&limit=400", { headers: H });
    const logs = await cl.json().catch(() => []);
    out.unanswered = (Array.isArray(logs) ? logs : [])
      .filter((l) => l.reply && /\[\[\s*whatsapp\s*\]\]/i.test(l.reply))
      .slice(0, 25).map((l) => ({ at: l.created_at, q: l.question }));

    // health signals
    const names = {}; (rows || []).forEach((r) => { names[r.name] = (names[r.name] || 0) + 1; });
    out.health = { eventTypesSeen: Object.keys(names).length, byName: names,
                   lastEventAt: rows.length ? rows[0].created_at : null };

    res.status(200).json(out);
  } catch (e) {
    res.status(200).json({ error: String((e && e.message) || e) });
  }
};
