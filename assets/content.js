/* assets/content.js — runtime content hydration for Big Bad Thai.
   Loaded (defer) on every page. Reads PUBLISHED content from /api/content
   and applies it over the page's built-in (static) HTML. If Supabase isn't
   configured, the API returns {} and the page keeps its static content —
   so this never breaks the site.

   How pages opt in:
     • Links & contact are matched by selector (no markup changes needed).
     • Text/images are hooked with data-c attributes:
         data-c="home.hero_sub"            -> textContent
         data-c-html="home.hero_title_html"-> innerHTML
         data-c-href="settings.reserve_url"-> href
         data-c-src="home.featured.0.img"  -> img/picture src
         data-c-alt="home.featured.0.name" -> alt
     • The menu page & gallery page are re-rendered from data (see below).
     • Other scripts can wait for content:  BBTContent.ready(fn)
       or listen for the 'bbt:content' event.

   Preview: the admin hands off the in-editor draft via localStorage
   ('bbtPreview') and opens a page with #bbtpreview — we render that draft
   and show a PREVIEW banner. No secrets in the URL. */

window.BBTContent = (function () {
  "use strict";
  var API = "/api/content", CACHE = "bbtContent";
  var data = null, ready = false, cbs = [];

  var qsa = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  function getPath(obj, path) {
    if (!obj || !path) return undefined;
    var parts = path.split("."), cur = obj;
    for (var i = 0; i < parts.length; i++) { if (cur == null) return undefined; cur = cur[parts[i]]; }
    return cur;
  }
  function setImg(el, url) {
    if (!url) return;
    if (el.tagName === "IMG") {
      el.src = url;
      var pic = el.parentNode;
      if (pic && pic.tagName === "PICTURE") qsa("source", pic).forEach(function (s) { s.srcset = url; });
    } else { el.style.backgroundImage = "url('" + url + "')"; }
  }

  // ---------- generic data-c slots ----------
  function applySlots(c) {
    qsa("[data-c]").forEach(function (el) { var v = getPath(c, el.getAttribute("data-c")); if (typeof v === "string") el.textContent = v; });
    qsa("[data-c-html]").forEach(function (el) { var v = getPath(c, el.getAttribute("data-c-html")); if (typeof v === "string") el.innerHTML = v; });
    qsa("[data-c-href]").forEach(function (el) { var v = getPath(c, el.getAttribute("data-c-href")); if (typeof v === "string" && v) el.setAttribute("href", v); });
    qsa("[data-c-src]").forEach(function (el) { setImg(el, getPath(c, el.getAttribute("data-c-src"))); });
    qsa("[data-c-alt]").forEach(function (el) { var v = getPath(c, el.getAttribute("data-c-alt")); if (typeof v === "string") el.setAttribute("alt", v); });
    qsa("[data-c-bg]").forEach(function (el) { var v = getPath(c, el.getAttribute("data-c-bg")); if (v) el.style.backgroundImage = "url('" + v + "')"; });
  }

  // ---------- settings: links, contact, footer (selector-based) ----------
  function setHref(sel, url) { if (url) qsa(sel).forEach(function (a) { a.setAttribute("href", url); }); }
  function applySettings(s) {
    if (!s) return;
    setHref('a[data-cta="reserve"], a.nav-reserve, a.reserve', s.reserve_url);
    setHref('a[data-cta="directions"], a[href*="/maps/dir"]', s.directions_url);
    setHref('a[href*="/maps/place"]', s.maps_url);
    setHref('a[href*="instagram.com"]', s.instagram);
    setHref('a[href*="facebook.com"]', s.facebook);
    if (s.whatsapp) setHref('a[href*="wa.me"]', "https://wa.me/" + String(s.whatsapp).replace(/[^\d]/g, ""));
    if (s.phone_href) qsa('a[href^="tel:"]').forEach(function (a) { a.setAttribute("href", "tel:+" + String(s.phone_href).replace(/[^\d]/g, "")); });
    if (s.email) qsa('a[href^="mailto:"]').forEach(function (a) { a.setAttribute("href", "mailto:" + s.email); });
    if (s.footer_copy) qsa(".footer-copy").forEach(function (el) { el.textContent = s.footer_copy; });
    // expose for other scripts (e.g. open-now / action bar) that may want authoritative values
    window.BBTSettings = s;
  }

  // ---------- SEO: title / meta (runtime) ----------
  function metaEnsure(attr, key) {
    var el = document.head.querySelector("meta[" + attr + '="' + key + '"]');
    if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
    return el;
  }
  function applySEO(seo) {
    if (!seo || !seo.pages) return;
    var p = location.pathname.replace(/\/index\.html$/, "/");
    var s = seo.pages[p] || seo.pages[p.replace(/\/$/, "/index.html")] || (p === "/" ? seo.pages["/index.html"] : null);
    if (!s) return;
    if (s.title) { document.title = s.title; metaEnsure("property", "og:title").content = s.title; metaEnsure("name", "twitter:title").content = s.title; }
    if (s.desc) { metaEnsure("name", "description").content = s.desc; metaEnsure("property", "og:description").content = s.desc; metaEnsure("name", "twitter:description").content = s.desc; }
    if (s.og) { metaEnsure("property", "og:image").content = s.og; metaEnsure("name", "twitter:image").content = s.og; }
    if (s.robots === "noindex") metaEnsure("name", "robots").content = "noindex, nofollow";
  }

  // ---------- menu render (menu.html) ----------
  function esc(x) { return (x == null ? "" : String(x)).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function itemHtml(it) {
    if (it.deleted) return "";
    var head = '<div class="m-head"><span class="m-name">' + esc(it.name) + (it.is_new ? '<span class="m-new">New</span>' : "") + "</span>";
    if (it.price && (!it.variants || !it.variants.length)) head += '<span class="m-price">' + esc(it.price) + "</span>";
    head += "</div>";
    var desc = it.desc ? '<div class="m-desc">' + esc(it.desc) + "</div>" : "";
    var prices = (it.variants && it.variants.length)
      ? '<div class="m-prices">' + it.variants.map(function (v) { return esc(v.label) + " " + esc(v.price); }).join(" · ") + "</div>" : "";
    var metaBits = [];
    if (it.spice) metaBits.push('<span class="m-spice">' + esc(it.spice) + "</span>");
    var tail = [];
    if (it.allergens) tail.push(esc(it.allergens));
    (it.dietary || []).forEach(function (d) { tail.push(esc(d)); });
    var meta = (metaBits.length || tail.length)
      ? '<div class="m-meta">' + metaBits.join("") + (metaBits.length && tail.length ? " · " : "") + tail.join(", ") + "</div>" : "";
    var avail = it.available === false ? ' style="opacity:.45"' : "";
    var imgAttr = it.image ? ' data-img="' + esc(it.image) + '"' : "";
    return '<div class="m-item"' + imgAttr + avail + ">" + head + desc + prices + meta + "</div>";
  }
  function renderMenu(menu) {
    var cols = document.querySelector(".menu-cols"); if (!cols || !menu || !menu.categories) return;
    var cats = menu.categories.filter(function (c) { return c.active !== false; })
      .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    cols.innerHTML = cats.map(function (c) {
      var items = (c.items || []).filter(function (i) { return !i.deleted; })
        .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); }).map(itemHtml).join("");
      return '<section class="cat"><h2 class="cat-title" id="' + esc(c.id) + '">' + esc(c.title) + "</h2>" + items + "</section>";
    }).join("");
    var bar = document.getElementById("catbar");
    if (bar) bar.innerHTML = cats.map(function (c) { return '<a href="#' + esc(c.id) + '">' + esc(c.title) + "</a>"; }).join("");
    if (menu.note) { var n = document.querySelector(".menu-note"); if (n) n.textContent = menu.note; }
  }

  // ---------- gallery render (gallery.html) ----------
  function renderGallery(g) {
    var grid = document.getElementById("grid"); if (!grid || !g || !g.images) return;
    var imgs = g.images.filter(function (i) { return !i.deleted && i.full; })
      .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    if (!imgs.length) return;
    grid.innerHTML = imgs.map(function (im) {
      var thumb = im.thumb || im.full;
      return '<figure><img src="' + esc(thumb) + '" alt="' + esc(im.alt || "") +
        '" loading="lazy" decoding="async" data-full="' + esc(im.full) + '"></figure>';
    }).join("");
    if (window.BBTGallery && typeof window.BBTGallery.bind === "function") window.BBTGallery.bind();
  }

  // ---------- apply everything ----------
  function applyAll(c) {
    if (!c) return;
    try { applySettings(c.settings); } catch (e) {}
    try { applySEO(c.seo); } catch (e) {}
    try { applySlots(c); } catch (e) {}
    try { if (c.menu) renderMenu(c.menu); } catch (e) {}
    try { if (c.gallery) renderGallery(c.gallery); } catch (e) {}
  }

  function finish(c) {
    if (ready) return;
    data = c || {};
    ready = true;
    applyAll(data);
    // action bar / late-injected nodes: re-apply settings shortly after
    setTimeout(function () { try { applySettings(data.settings); } catch (e) {} }, 600);
    window.addEventListener("load", function () { try { applySettings(data.settings); } catch (e) {} });
    cbs.forEach(function (cb) { try { cb(data); } catch (e) {} }); cbs = [];
    try { document.dispatchEvent(new CustomEvent("bbt:content", { detail: data })); } catch (e) {}
  }

  /* Real content that arrives AFTER we've already settled.
     This matters: on the homepage the hero video saturates the connection, so
     /api/content can start at ~1.5s and take ~8s. The old code hit its timeout,
     applied {}, and then THREW AWAY the real response — so published settings
     (footer, hours, links) never appeared on the homepage while they worked fine
     on the lighter subpages.

     Text/link/SEO updates are idempotent DOM writes, so applying them late is
     safe. We deliberately do NOT re-render the menu/gallery late: menu.html and
     gallery.html bind their behaviours (modal, currency, lightbox) to the DOM
     once, and swapping it underneath them would break those bindings. Those
     pages are light and win the race in practice; if a published menu ever loses
     it, that visitor simply sees the built-in menu for that load. */
  function lateUpdate(c) {
    if (!c || !Object.keys(c).length) return;
    data = c;
    try { applySettings(c.settings); } catch (e) {}
    try { applySEO(c.seo); } catch (e) {}
    try { applySlots(c); } catch (e) {}
  }

  // ---------- boot ----------
  // preview: render the admin's in-editor draft
  if (/bbtpreview/.test(location.hash)) {
    var pv = null; try { pv = JSON.parse(localStorage.getItem("bbtPreview") || "null"); } catch (e) {}
    if (pv) {
      document.addEventListener("DOMContentLoaded", function () {
        var b = document.createElement("div");
        b.textContent = "PREVIEW — unpublished draft";
        b.style.cssText = "position:fixed;z-index:99999;left:0;right:0;bottom:0;background:#E2993B;color:#181818;font:700 12px/1 'Barlow Condensed',sans-serif;letter-spacing:.1em;text-transform:uppercase;text-align:center;padding:9px";
        document.body.appendChild(b);
      });
      finish(pv);
      return window.BBTContent;
    }
  }

  // instant hydrate from cache (settings/text only) for snappy paint; menu/gallery wait for authoritative resolve
  var cd = null; try { cd = JSON.parse(localStorage.getItem(CACHE) || "null"); } catch (e) {}
  if (cd && cd.d) { try { applySettings(cd.d.settings); applySEO(cd.d.seo); applySlots(cd.d); } catch (e) {} }

  // Settle after 2.5s so pages waiting on bbt:content (menu/gallery) aren't held
  // up by a slow API — but the real response is applied whenever it lands, even
  // if it's late (see lateUpdate).
  var to = setTimeout(function () { finish((cd && cd.d) || {}); }, 2500);
  fetch(API, { headers: { accept: "application/json" } })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      clearTimeout(to);
      try { localStorage.setItem(CACHE, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
      if (ready) lateUpdate(d);   // we already settled (slow page) — apply it anyway
      else finish(d);
    })
    .catch(function () { clearTimeout(to); finish((cd && cd.d) || {}); });

  return {
    ready: function (cb) { if (ready) cb(data); else cbs.push(cb); },
    get: function () { return data; }
  };
})();
