/* Sticky mobile action bar — Directions · Call · Reserve. Self-contained; include on every page. */
(function(){
  var css = "#bbt-bar{display:none}"
  + "@media(max-width:760px){"
  + "#bbt-bar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:500;background:var(--night,#181818);"
  +   "border-top:1px solid rgba(255,245,232,.1);padding:8px;gap:8px;box-shadow:0 -8px 24px rgba(0,0,0,.25)}"
  + "#bbt-bar a{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;"
  +   "padding:9px 4px;border-radius:9px;text-decoration:none;font-family:'Space Mono',monospace;font-size:9px;"
  +   "letter-spacing:.05em;text-transform:uppercase;color:var(--cream,#FFF5E8);-webkit-tap-highlight-color:transparent}"
  + "#bbt-bar a svg{width:19px;height:19px}"
  + "#bbt-bar a.primary{background:var(--clay,#BD5E26)}"
  + "#bbt-bar a.ghost{background:rgba(255,245,232,.08)}"
  + "#bbt-bar a:active{opacity:.8}"
  + "body{padding-bottom:64px!important}"
  + "}";
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

  var pin='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  var phone='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.11 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  var chat='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

  var bar=document.createElement('div');bar.id='bbt-bar';
  bar.innerHTML=
    '<a class="ghost" href="https://www.google.com/maps/dir/?api=1&destination=Big%20Bad%20Thai%20Restaurant%20El%20Nido%20Hama%20Street" target="_blank" rel="noopener">'+pin+'Directions</a>'
   +'<a class="ghost" href="tel:+639452994225">'+phone+'Call</a>'
   +'<a class="primary" href="https://m.me/bigbadthai" target="_blank" rel="noopener">'+chat+'Reserve</a>';
  document.body.appendChild(bar);
})();
