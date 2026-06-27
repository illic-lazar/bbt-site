/* GET /api/stats — chat analytics for the private /admin dashboard.
   Auth: header x-admin-token (or ?token=) must equal env ADMIN_TOKEN.
   Reads Supabase server-side (service key never reaches the browser). */

const STOP = new Set(("a an and are as at be but by can could do does for from get had has have how i id im is it its just me my no not of on or our so that the their them then there these they this to up us was we what when where which who why will with would you your could would should about any are can do have me my".split(" ")));

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const ADMIN = process.env.ADMIN_TOKEN;
  const url = process.env.SUPABASE_URL, sk = process.env.SUPABASE_SERVICE_KEY;
  const token = (req.headers && (req.headers["x-admin-token"] || req.headers["X-Admin-Token"])) || (req.query && req.query.token) || "";

  if (!ADMIN) { res.status(503).json({ error: "ADMIN_TOKEN not set" }); return; }
  if (!token || token !== ADMIN) { res.status(401).json({ error: "unauthorized" }); return; }
  if (!url || !sk) { res.status(200).json({ configured: false }); return; }

  const base = url.replace(/\/+$/, "");
  const H = { apikey: sk, authorization: "Bearer " + sk };

  try {
    // exact total
    let total = null;
    try {
      const cres = await fetch(base + "/rest/v1/chat_logs?select=id", { headers: Object.assign({ Prefer: "count=exact", Range: "0-0" }, H) });
      const cr = cres.headers.get("content-range"); if (cr) { const m = cr.match(/\/(\d+)\s*$/); if (m) total = +m[1]; }
    } catch (e) {}

    // recent window for aggregation
    const data = await (await fetch(base + "/rest/v1/chat_logs?select=created_at,question,reply,session_id&order=created_at.desc&limit=1000", { headers: H })).json().catch(() => []);
    const list = Array.isArray(data) ? data : [];
    if (total == null) total = list.length;

    const now = new Date();
    const dayKey = d => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
    const todayKey = dayKey(now);

    const sessions = new Set(), qCount = {}, kCount = {}, byDayMap = {};
    let today = 0;
    list.forEach(r => {
      if (r.session_id) sessions.add(r.session_id);
      const dk = dayKey(r.created_at); byDayMap[dk] = (byDayMap[dk] || 0) + 1;
      if (dk === todayKey) today++;
      const q = (r.question || "").trim();
      if (q) {
        const norm = q.toLowerCase().replace(/\s+/g, " ");
        if (!qCount[norm]) qCount[norm] = { count: 0, sample: q };
        qCount[norm].count++;
        norm.replace(/[^a-z0-9À-ɏ฀-๿\s]/g, " ").split(/\s+/).forEach(w => {
          if (w.length >= 3 && !STOP.has(w)) kCount[w] = (kCount[w] || 0) + 1;
        });
      }
    });

    const topQuestions = Object.values(qCount).sort((a, b) => b.count - a.count).slice(0, 15);
    const topKeywords = Object.keys(kCount).map(w => ({ word: w, count: kCount[w] })).sort((a, b) => b.count - a.count).slice(0, 24);

    const byDay = [];
    for (let i = 13; i >= 0; i--) { const d = new Date(now); d.setDate(now.getDate() - i); const k = dayKey(d); byDay.push({ date: k, count: byDayMap[k] || 0 }); }

    const recent = list.slice(0, 40).map(r => ({ at: r.created_at, q: r.question, a: r.reply }));

    res.status(200).json({
      configured: true,
      total,
      sessions: sessions.size,
      today,
      windowSize: list.length,
      topQuestions, topKeywords, byDay, recent,
    });
  } catch (e) {
    res.status(200).json({ error: String((e && e.message) || e) });
  }
};
