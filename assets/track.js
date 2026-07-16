/* assets/track.js — Big Bad Thai event + conversion tracking.
   Loaded (defer) on every PUBLIC page. Never on /admin.

   Privacy: no cookies, no personal data, no cross-site tracking.
   We send: event name, path, referrer HOST (not URL), coarse source,
   UTM tags, device class, 2-letter language, a per-tab random session id,
   and small non-PII props. Chatbot questions are recorded as a derived
   TOPIC + character count only — never the message text.

   Design notes:
   • actionbar.js already classifies CTA clicks and dispatches `bbt:cta`
     (previously consumed by nothing). We listen for it — that's the
     reservation/directions/phone/whatsapp/messenger conversion feed.
   • Everything else is captured by event delegation, so no other file
     needs to change.
   • Events are batched and flushed with sendBeacon. */

(function () {
  "use strict";
  if (/editor|studio|admin/i.test(location.pathname)) return;      // never track the admin
  if (navigator.webdriver) return;                                  // obvious automation (server also filters UA)

  var API = "/api/event";

  /* ---------- session (same key the pageview beacon + chatbot use -> joinable) ---------- */
  var SID = (function () {
    try {
      var k = "bbtSid", v = sessionStorage.getItem(k);
      if (!v) { v = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); sessionStorage.setItem(k, v); }
      return v;
    } catch (e) { return "na"; }
  })();

  /* ---------- visit dimensions ---------- */
  function deviceOf() {
    var ua = navigator.userAgent || "";
    if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
    if (/Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua)) return "mobile";
    return "desktop";
  }
  function refHost() {
    try {
      if (!document.referrer) return "";
      var h = new URL(document.referrer).hostname.replace(/^www\./, "");
      return h === location.hostname.replace(/^www\./, "") ? "" : h;   // internal nav isn't a referrer
    } catch (e) { return ""; }
  }
  // UTM: read from the URL, then persist for the rest of the visit (attribution survives navigation)
  function readUtm() {
    var u = { source: null, medium: null, campaign: null };
    try {
      var q = new URLSearchParams(location.search);
      u.source = q.get("utm_source"); u.medium = q.get("utm_medium"); u.campaign = q.get("utm_campaign");
      if (u.source || u.campaign || u.medium) { sessionStorage.setItem("bbtUtm", JSON.stringify(u)); return u; }
      var s = JSON.parse(sessionStorage.getItem("bbtUtm") || "null");
      if (s) return s;
    } catch (e) {}
    return u;
  }
  function resolveSource(utm, rh) {
    if (utm.source) return String(utm.source).toLowerCase().slice(0, 40);
    if (!rh) return "direct";
    var r = rh.toLowerCase();
    if (/instagram/.test(r)) return "instagram";
    if (/facebook|fb\./.test(r)) return "facebook";
    if (/google/.test(r)) return "google";
    if (/bing|duckduckgo|yahoo|ecosia/.test(r)) return "search";
    if (/tripadvisor/.test(r)) return "tripadvisor";
    if (/booking|agoda|airbnb|expedia/.test(r)) return "travel";
    return r.slice(0, 40);
  }
  var UTM = readUtm(), RH = refHost(), SRC = resolveSource(UTM, RH),
      DEV = deviceOf(), LANG = (navigator.language || "").slice(0, 2).toLowerCase();

  /* ---------- batching transport ---------- */
  var queue = [], timer = null;
  function flush() {
    if (!queue.length) return;
    var payload = JSON.stringify({ e: queue.splice(0, 25) });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon(API, new Blob([payload], { type: "application/json" }));
      else fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true }).catch(function () {});
    } catch (e) { /* analytics must never break the page */ }
  }
  function track(name, props) {
    try {
      queue.push({ n: name, s: SID, p: location.pathname, r: RH, src: SRC,
                   um: UTM.source, ud: UTM.medium, uc: UTM.campaign,
                   d: DEV, l: LANG, pr: props || null });
      if (queue.length >= 10) { clearTimeout(timer); flush(); return; }
      clearTimeout(timer); timer = setTimeout(flush, 800);
    } catch (e) {}
  }
  window.bbtTrack = track;   // available to other scripts if ever needed

  // rapid-click de-dup: same event+key inside 1.5s counts once (spec: don't inflate conversions)
  var seen = {};
  function trackOnce(name, props, key) {
    var k = name + "|" + (key || ""), now = Date.now();
    if (seen[k] && now - seen[k] < 1500) return;
    seen[k] = now; track(name, props);
  }

  /* ---------- time to first meaningful action ---------- */
  var T0 = Date.now(), firstDone = false;
  function markFirst(n) { if (firstDone) return; firstDone = true; track("first_action", { name: n, ms: Date.now() - T0 }); }

  /* ---------- page view ---------- */
  track("page_view", { title: (document.title || "").slice(0, 80) });
  if (/menu\.html/i.test(location.pathname)) track("menu_view", null);

  /* ---------- CONVERSIONS: consume actionbar.js's existing bbt:cta ---------- */
  var CTA_MAP = { reserve: "reservation_click", directions: "directions_click", phone: "phone_click",
                  whatsapp: "whatsapp_click", messenger: "messenger_click", email: "email_click" };
  document.addEventListener("bbt:cta", function (e) {
    var c = (e.detail && e.detail.cta) || "";
    var name = CTA_MAP[c];
    if (!name) return;                                   // 'menu' nav — page_view already covers it
    var channel = c === "reserve" ? "messenger" : c;     // reservations run through Messenger
    trackOnce(name, { channel: channel }, channel);
    if (name !== "email_click") markFirst(name);
  });

  /* ---------- everything else via delegation (no other file changes) ---------- */
  function txt(el) { return el ? (el.textContent || "").trim().slice(0, 80) : ""; }
  function dishName(el) {
    var c = el.cloneNode(true), b = c.querySelector(".m-new"); if (b) b.remove();
    return (c.textContent || "").trim().slice(0, 80);
  }

  document.addEventListener("click", function (e) {
    var t = e.target; if (!t || !t.closest) return;

    // social profiles (actionbar doesn't classify these)
    var a = t.closest("a[href]");
    if (a) {
      var h = (a.getAttribute("href") || "").toLowerCase();
      if (h.indexOf("instagram.com") >= 0) trackOnce("social_click", { network: "instagram" }, "instagram");
      else if (h.indexOf("facebook.com") >= 0 && h.indexOf("m.me") < 0) trackOnce("social_click", { network: "facebook" }, "facebook");
      // chatbot answer buttons ([[book]] / [[whatsapp]] etc.)
      if (a.className && String(a.className).indexOf("bc-act") >= 0) {
        var act = /book/i.test(a.textContent) ? "book" : /whatsapp/i.test(a.textContent) ? "whatsapp"
                : /messenger/i.test(a.textContent) ? "messenger" : /direction|map/i.test(a.textContent) ? "directions" : "other";
        trackOnce("chatbot_answer_action", { action: act }, act);
        markFirst("chatbot_answer_action");
      }
    }

    // menu category nav
    var cat = t.closest("#catbar a");
    if (cat) { var cn = txt(cat); trackOnce("menu_category_select", { category: cn }, cn); }

    // menu dish (opens the tap-a-dish modal)
    var mi = t.closest(".m-item.haspic");
    if (mi) {
      var nEl = mi.querySelector(".m-name");
      if (nEl) {
        var dish = dishName(nEl);
        var sec = mi.closest(".cat"), ct = sec ? txt(sec.querySelector(".cat-title")) : "";
        trackOnce("menu_item_view", { dish: dish, category: ct }, dish);
        markFirst("menu_item_view");
      }
    }

    // homepage featured dish cards
    var card = t.closest(".d-dish-featured,.d-dish-strip-card,.m-feat");
    if (!card) { var g = t.closest(".m-dishgrid > div"); if (g) card = g; }
    if (card) {
      var nm = txt(card.querySelector(".bf,.bs"));
      if (nm) { trackOnce("dish_view", { dish: nm }, nm); markFirst("dish_view"); }
    }

    // gallery
    var gi = t.closest("#grid img");
    if (gi) trackOnce("gallery_open", { alt: (gi.getAttribute("alt") || "").slice(0, 80) }, gi.getAttribute("alt") || "img");
    var gn = t.closest(".lb-next,.lb-prev");
    if (gn) trackOnce("gallery_navigate", { direction: gn.className.indexOf("next") >= 0 ? "next" : "prev" }, "nav");

    // currency switcher
    var cur = t.closest(".cur-switch button");
    if (cur) { var cc = (cur.getAttribute("data-cur") || "").toUpperCase(); trackOnce("currency_change", { currency: cc }, cc); }

    // chatbot opened (only count when it actually opens, not on close)
    if (t.closest("#bbt-chat-btn")) {
      setTimeout(function () {
        var p = document.getElementById("bbt-chat");
        if (p && p.classList.contains("open")) trackOnce("chatbot_open", null, "open");
      }, 60);
    }

    // chatbot suggested-question chips (these bypass the form)
    var chip = t.closest(".bc-chips button");
    if (chip) question(txt(chip));
  }, true);

  /* ---------- chatbot questions: TOPIC ONLY, never the text ---------- */
  function topicOf(q) {
    q = (q || "").toLowerCase();
    if (/book|reserv|table/.test(q)) return "booking";
    if (/hour|open|clos|time|late/.test(q)) return "hours";
    if (/where|location|address|find|direction|map|get there/.test(q)) return "location";
    if (/price|cost|how much|expensive|peso|₱/.test(q)) return "price";
    if (/vegan|vegetarian|gluten|allerg|nut|shellfish|spicy|halal|dairy/.test(q)) return "dietary";
    if (/deliver|takeaway|take away|pick ?up/.test(q)) return "delivery";
    if (/park|wifi|kid|child|pet|dog|aircon|seat|view|rooftop/.test(q)) return "facilities";
    if (/menu|dish|food|pad thai|curry|noodle|eat|drink|cocktail|seafood/.test(q)) return "menu";
    return "other";
  }
  function question(q) {
    if (!q || !q.trim()) return;
    track("chatbot_question", { topic: topicOf(q), chars: q.length });   // no message text stored
    markFirst("chatbot_question");
  }
  // capture phase: runs before chat.js clears the input
  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (!f || !f.classList || !f.classList.contains("bc-form")) return;
    var inp = f.querySelector("input");
    question(inp ? inp.value : "");
  }, true);

  /* ---------- scroll depth ---------- */
  var marks = [25, 50, 75, 100], hitMark = {}, sTimer = null;
  window.addEventListener("scroll", function () {
    if (sTimer) return;
    sTimer = setTimeout(function () {
      sTimer = null;
      var d = document.documentElement, sh = d.scrollHeight - window.innerHeight;
      if (sh <= 0) return;
      var pct = Math.min(100, Math.round(((window.pageYOffset || d.scrollTop) / sh) * 100));
      marks.forEach(function (m) { if (pct >= m && !hitMark[m]) { hitMark[m] = 1; track("scroll_depth", { depth: m }); } });
    }, 400);
  }, { passive: true });

  /* ---------- flush ---------- */
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flush(); });
})();
