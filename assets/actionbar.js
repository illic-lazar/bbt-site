/* Big Bad Thai — mobile action bar + open-now badge + PWA bootstrap. Self-contained; include on every page. */
(function(){
  /* ---------------- styles ---------------- */
  var css = "#bbt-bar{display:none}"
  + "#bbt-bar.bbt-hidden{display:none!important}"
  /* skip link: off-screen until focused */
  + ".bbt-skip{position:fixed;top:8px;left:8px;z-index:2000;background:var(--clay,#BD5E26);color:var(--cream,#FFF5E8);font-family:'Space Mono',monospace;font-size:13px;letter-spacing:.04em;padding:12px 18px;border-radius:8px;text-decoration:none;transform:translateY(-170%);transition:transform .18s}"
  + ".bbt-skip:focus{transform:translateY(0)}"
  /* visible brand focus ring for every interactive element (keyboard only) */
  + "a:focus-visible,button:focus-visible,[tabindex]:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:3px solid var(--clay,#BD5E26);outline-offset:2px;border-radius:2px}"
  /* respect reduced-motion: neutralise transitions, animations and smooth scroll */
  + "@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}"
  /* a11y contrast: lift faint muted text (inline low-opacity bamboo) to AA on light backgrounds */
  + "[style*=\"rgba(84,88,61,.36)\"],[style*=\"rgba(84,88,61,.38)\"],[style*=\"rgba(84,88,61,.42)\"],[style*=\"rgba(84,88,61,.5)\"]{color:#54583d!important}"
  /* a11y contrast: lift faint cream text (footer links, copyright) on dark backgrounds */
  + "[style*=\"rgba(255,245,232,.14)\"],[style*=\"rgba(255,245,232,.16)\"],[style*=\"rgba(255,245,232,.26)\"],[style*=\"rgba(255,245,232,.28)\"]{color:rgba(255,245,232,.62)!important}"
  + "@media(max-width:760px){"
  + "#bbt-bar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:500;background:var(--night,#181818);"
  +   "border-top:1px solid rgba(255,245,232,.1);padding:8px 6px calc(8px + env(safe-area-inset-bottom));gap:6px;box-shadow:0 -8px 24px rgba(0,0,0,.25)}"
  + "#bbt-bar a{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;"
  +   "padding:8px 2px;border-radius:9px;text-decoration:none;font-family:'Space Mono',monospace;font-size:8.5px;"
  +   "letter-spacing:.03em;text-transform:uppercase;color:var(--cream,#FFF5E8);-webkit-tap-highlight-color:transparent}"
  + "#bbt-bar a svg{width:18px;height:18px}"
  + "#bbt-bar a.primary{background:var(--clay,#BD5E26)}"
  + "#bbt-bar a.ghost{background:rgba(255,245,232,.08)}"
  + "#bbt-bar a:focus-visible{outline:2px solid var(--cream,#FFF5E8);outline-offset:-2px}"
  + "#bbt-bar a:active{opacity:.8}"
  + "body{padding-bottom:calc(66px + env(safe-area-inset-bottom))!important}"
  + "}"
  + ".open-badge{display:inline-flex;align-items:center;gap:7px;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.05em;text-transform:uppercase}"
  + ".open-badge .od{width:8px;height:8px;border-radius:50%;display:inline-block}"
  /* Every badge sits on the cream card (#FFF5E8) — on the Find Us page and on the homepage.
     These score 5.93:1 and 5.05:1 there, clear of the 4.5:1 AA floor for 10px text.
     They are tuned for CREAM: on a dark panel they drop to 2.58:1 / 3.03:1 and fail.
     If a dark mode lands, this pair needs a light counterpart (#5cb97a / #e2825c). */
  + ".open-badge.is-open{color:#2e6b3d}.open-badge.is-open .od{background:#3c8a4e;box-shadow:0 0 0 3px rgba(60,138,78,.18)}"
  + ".open-badge.is-closed{color:#b04a2b}.open-badge.is-closed .od{background:#b04a2b}"
  + "#bbt-lang{position:fixed;left:16px;bottom:18px;z-index:490}"
  + "@media(max-width:760px){#bbt-lang{bottom:calc(80px + env(safe-area-inset-bottom));left:12px}}"
  + "#bbt-lang .lang-btn{width:42px;height:42px;border-radius:50%;background:var(--night,#181818);color:var(--cream,#FFF5E8);"
  +   "border:1px solid rgba(255,245,232,.2);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.28);padding:0}"
  + "#bbt-lang .lang-btn svg{width:20px;height:20px}"
  + "#bbt-lang .lang-menu{position:absolute;left:0;bottom:50px;background:var(--cream,#FFF5E8);border-radius:10px;"
  +   "box-shadow:0 16px 40px rgba(0,0,0,.24);padding:6px;display:none;min-width:150px;max-height:60vh;overflow:auto}"
  + "#bbt-lang.open .lang-menu{display:block}"
  + "#bbt-lang .lang-menu button{display:block;width:100%;text-align:left;padding:9px 13px;font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.03em;color:var(--night,#181818);background:none;border:none;border-radius:6px;cursor:pointer}"
  + "#bbt-lang .lang-menu button:hover{background:rgba(189,94,38,.1);color:var(--clay,#BD5E26)}"
  + ".goog-te-banner-frame,.goog-te-balloon-frame,#goog-gt-tt,.goog-tooltip{display:none!important}"
  + "#gt-host{position:absolute!important;left:-9999px!important;top:-9999px!important;width:1px;height:1px;overflow:hidden}"
  + "body{top:0!important}";
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

  /* ---------------- icons ---------------- */
  var pin='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  var phone='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.11 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  var wa='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.2 4.79 1.2h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.16c-.24.68-1.4 1.3-1.93 1.38-.49.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-2.99 0-1.42.74-2.12 1.01-2.41.27-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.66.5.24.59.82 2.04.89 2.19.07.15.12.32.02.51-.09.19-.14.31-.28.48-.14.17-.29.38-.42.5-.14.14-.28.29-.12.56.16.27.71 1.17 1.53 1.9 1.05.94 1.94 1.24 2.21 1.38.27.14.43.12.59-.07.16-.19.68-.79.86-1.06.18-.27.36-.22.61-.13.25.09 1.59.75 1.86.89.27.14.45.2.52.31.07.12.07.66-.17 1.34z"/></svg>';
  var chat='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  var book='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';

  /* ---------------- action bar ---------------- */
  var GMAPS='https://www.google.com/maps/dir/?api=1&destination=Big%20Bad%20Thai%20Restaurant%20El%20Nido%20Hama%20Street&destination_place_id=ChIJj-thjxVVtjMRdmsUeV7mG_E&travelmode=walking';
  var bar=document.createElement('nav');bar.id='bbt-bar';bar.setAttribute('aria-label','Quick actions');
  bar.innerHTML=
    '<a class="ghost" href="menu.html" data-cta="menu" aria-label="View the menu">'+book+'Menu</a>'
   +'<a class="primary" href="https://m.me/bigbadthai" target="_blank" rel="noopener" data-cta="reserve" aria-label="Reserve a table">'+chat+'Reserve</a>'
   +'<a class="ghost" id="bbt-dir" href="'+GMAPS+'" target="_blank" rel="noopener" data-cta="directions" aria-label="Get directions">'+pin+'Directions</a>';
  document.body.appendChild(bar);
  // iOS → Apple Maps walking directions (applies to every directions link on the page)
  var isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(isIOS){[].forEach.call(document.querySelectorAll('[data-cta="directions"]'),function(d){d.href='https://maps.apple.com/?daddr=Big+Bad+Thai+Restaurant+El+Nido,+Hama+Street&dirflg=w';});}
  // ---- mobile nav drawer: hide sticky bar when open + full keyboard/screen-reader a11y ----
  var drawer=document.getElementById('mMenu')||document.getElementById('navlinks');
  var hamb=document.querySelector('.nav-ham')||document.querySelector('.ham');
  if(drawer){
    if(hamb){hamb.setAttribute('aria-controls',drawer.id);hamb.setAttribute('aria-expanded','false');}
    var dFoc=function(){return [].slice.call(drawer.querySelectorAll('a[href],button,[tabindex]:not([tabindex="-1"])')).filter(function(e){return e.offsetParent!==null;});};
    var syncDrawer=function(){
      var open=drawer.classList.contains('open');
      bar.classList.toggle('bbt-hidden',open);
      if(hamb) hamb.setAttribute('aria-expanded',open?'true':'false');
      document.documentElement.style.overflow=open?'hidden':'';   // prevent background scroll
      if(open){var f=dFoc();if(f[0])f[0].focus();}                 // move focus into the menu
    };
    try{new MutationObserver(syncDrawer).observe(drawer,{attributes:true,attributeFilter:['class']});}catch(e){}
    document.addEventListener('keydown',function(e){
      if(!drawer.classList.contains('open'))return;
      if(e.key==='Escape'){e.preventDefault();drawer.classList.remove('open');if(hamb&&hamb.focus)hamb.focus();} // Escape + return focus
      else if(e.key==='Tab'){var f=dFoc();if(!f.length)return;var a=f[0],z=f[f.length-1];                        // trap focus
        if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}
        else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}}
    });
    syncDrawer();
  }

  // ---- skip to main content ----
  var skip=document.createElement('a');skip.href='#main';skip.className='bbt-skip';skip.textContent='Skip to main content';
  document.body.insertBefore(skip,document.body.firstChild);
  skip.addEventListener('click',function(e){
    e.preventDefault();
    var m=[].slice.call(document.querySelectorAll('main,[role="main"],h1')).filter(function(el){return el.offsetParent!==null;})[0];
    if(m){m.setAttribute('tabindex','-1');m.focus();try{m.scrollIntoView();}catch(_){}}
  });

  // ---- announce review stars as one label ("Rated 4.4 out of 5"), not five glyphs ----
  var labelStars=function(){
    var hdr=document.querySelector('[data-rev-rating]'); var overall=hdr?hdr.textContent.trim():null;
    [].forEach.call(document.querySelectorAll('.stars:not([data-al])'),function(s){
      s.setAttribute('data-al','1');
      var count=(s.textContent.match(/★/g)||[]).length||5;
      var near=s.parentElement&&/\b[0-5]\.\d\b/.test(s.parentElement.textContent);
      s.setAttribute('role','img');
      s.setAttribute('aria-label','Rated '+((near&&overall)?overall:count)+' out of 5');
    });
  };
  labelStars(); setTimeout(labelStars,1500); setTimeout(labelStars,3500);

  // ---- reduced motion: don't autoplay video (its poster remains as static content) ----
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){
    [].forEach.call(document.querySelectorAll('video'),function(v){try{v.removeAttribute('autoplay');v.pause();v.addEventListener('play',function(){v.pause();});}catch(e){}});
  }

  /* ---------------- language switcher (Google Translate widget, in-place) ---------------- */
  var LANGS=[['en','English'],['th','ไทย'],['sr','Srpski'],['ko','한국어'],['zh-CN','中文'],['ja','日本語'],['de','Deutsch'],['fr','Français'],['es','Español'],['it','Italiano'],['ru','Русский']];
  var GT_INCL='th,sr,ko,zh-CN,ja,de,fr,es,it,ru', gtInjected=false;
  function injectGT(){
    if(gtInjected) return; gtInjected=true;
    window.googleTranslateElementInit=function(){try{new google.translate.TranslateElement({pageLanguage:'en',includedLanguages:GT_INCL,autoDisplay:false},'gt-host');}catch(e){}};
    var h=document.createElement('div');h.id='gt-host';document.body.appendChild(h);
    var s=document.createElement('script');s.src='https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';document.body.appendChild(s);
  }
  function applyLang(code,n){
    var c=document.querySelector('.goog-te-combo');
    if(!c){ if((n||0)<40) setTimeout(function(){applyLang(code,(n||0)+1);},150); return; }
    c.value=code; c.dispatchEvent(new Event('change'));
  }
  function setLang(code){
    if(code==='en'){
      try{localStorage.removeItem('bbtLang');}catch(e){}
      document.cookie='googtrans=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
      document.cookie='googtrans=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.'+location.hostname;
      location.reload(); return;
    }
    try{localStorage.setItem('bbtLang',code);}catch(e){}
    injectGT(); applyLang(code);
  }
  try{var saved=localStorage.getItem('bbtLang'); if(saved&&saved!=='en'){injectGT();applyLang(saved);}}catch(e){}

  var globe='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
  var lang=document.createElement('div');lang.id='bbt-lang';lang.className='notranslate';
  lang.innerHTML='<div class="lang-menu">'+LANGS.map(function(l){return '<button type="button" data-l="'+l[0]+'">'+l[1]+'</button>';}).join('')+'</div>'
    +'<button class="lang-btn" type="button" aria-label="Language" aria-haspopup="true" aria-expanded="false">'+globe+'</button>';
  document.body.appendChild(lang);
  var langBtn=lang.querySelector('.lang-btn');
  var setLangOpen=function(o){lang.classList.toggle('open',o);langBtn.setAttribute('aria-expanded',o?'true':'false');if(o){var fi=lang.querySelector('.lang-menu button');if(fi)fi.focus();}};
  langBtn.addEventListener('click',function(e){e.stopPropagation();setLangOpen(!lang.classList.contains('open'));});
  [].forEach.call(lang.querySelectorAll('.lang-menu button'),function(b){b.addEventListener('click',function(){setLangOpen(false);setLang(b.getAttribute('data-l'));langBtn.focus();});});
  document.addEventListener('click',function(e){if(!lang.contains(e.target))setLangOpen(false);});
  lang.addEventListener('keydown',function(e){if(e.key==='Escape'&&lang.classList.contains('open')){setLangOpen(false);langBtn.focus();}});

  /* ---------------- open-now badge (Asia/Manila; hours come from the CMS) ----------------
     Re-runnable: content.js calls BBTOpenNow.render() whenever settings land, on both the
     fast path and the late path, so the badge never contradicts the hours label beside it. */
  var OPEN_FALLBACK='11:00', CLOSE_FALLBACK='23:00';
  function hhmm(v){var m=/^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(v||''));if(!m)return null;var h=+m[1],i=+m[2];return(h<24&&i<60)?h*60+i:null;}
  function ampm(v){var t=hhmm(v);if(t===null)return'';var h=Math.floor(t/60),i=t%60,ap=h>=12?'PM':'AM',h12=h%12||12;return h12+(i?':'+(i<10?'0':'')+i:'')+' '+ap;}
  function renderOpenNow(){
    var els=document.querySelectorAll('[data-open-status]'); if(!els.length) return;
    var hrs=(window.BBTSettings&&window.BBTSettings.hours)||{};
    var openStr=hhmm(hrs.open)!==null?hrs.open:OPEN_FALLBACK, closeStr=hhmm(hrs.close)!==null?hrs.close:CLOSE_FALLBACK;
    var o=hhmm(openStr), c=hhmm(closeStr);
    var parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
    var pv=function(t){var x=parts.find(function(o){return o.type===t;});return x?parseInt(x.value,10):0;};
    var mins=pv('hour')*60+pv('minute');
    /* close<=open means the service wraps past midnight, e.g. 17:00–02:00 */
    var isOpen=(c>o)?(mins>=o&&mins<c):(mins>=o||mins<c);
    [].forEach.call(els,function(el){
      el.className=(el.className.replace(/\b(?:open-badge|is-open|is-closed)\b/g,'')+' open-badge '+(isOpen?'is-open':'is-closed')).replace(/\s+/g,' ').trim();
      el.innerHTML='<span class="od"></span>'+(isOpen?'Open now · until '+ampm(closeStr):'Closed · opens '+ampm(openStr));
    });
  }
  window.BBTOpenNow={render:renderOpenNow};
  try{renderOpenNow();}catch(e){}

  /* ---------------- PWA: manifest + apple meta + service worker ---------------- */
  if(!document.querySelector('link[rel="manifest"]')){var lm=document.createElement('link');lm.rel='manifest';lm.href='/manifest.webmanifest';document.head.appendChild(lm);}
  var ati=document.createElement('link');ati.rel='apple-touch-icon';ati.href='/icon-192.png';document.head.appendChild(ati);
  [['apple-mobile-web-app-capable','yes'],['apple-mobile-web-app-status-bar-style','default'],['apple-mobile-web-app-title','Big Bad Thai'],['mobile-web-app-capable','yes']].forEach(function(m){var mt=document.createElement('meta');mt.name=m[0];mt.content=m[1];document.head.appendChild(mt);});
  if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}

  /* ---------------- page views ----------------
     Retired in Stage 9. This used to beacon /api/hit -> the page_hits table.
     Stage 7's tracker now records page_view into `events` with far more detail
     (device, language, campaign/UTM, source), and Stage 8 removed the last
     reader of page_hits (/api/reach) — so this was writing data nobody read.
     The tracker creates the shared `bbtSid` session id lazily, exactly as this
     did, so the chatbot<->analytics session join is unaffected.
     Historical page_hits data is kept as an archive; see ANALYTICS.md. */

  /* ---------------- click tracking hooks (menu / reserve / directions / whatsapp / messenger / phone / email) ---------------- */
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest?e.target.closest('a[href]'):null; if(!a) return;
    var c=a.getAttribute('data-cta');
    if(!c){
      var h=(a.getAttribute('href')||'').toLowerCase();
      if(h.indexOf('m.me/')>=0||h.indexOf('messenger.com')>=0) c='messenger';
      else if(h.indexOf('wa.me')>=0||h.indexOf('whatsapp')>=0) c='whatsapp';
      else if(h.indexOf('tel:')===0) c='phone';
      else if(h.indexOf('mailto:')===0) c='email';
      else if(h.indexOf('maps.apple')>=0||h.indexOf('/maps')>=0||h.indexOf('maps.google')>=0) c='directions';
      else if(/(^|\/)menu\.html($|[#?])/.test(h)) c='menu';
    }
    if(!c) return;
    try{
      // non-polluting tracking hooks: GTM/GA dataLayer + a DOM event any analytics can listen for
      (window.dataLayer=window.dataLayer||[]).push({event:'cta_click',cta:c,page:location.pathname});
      document.dispatchEvent(new CustomEvent('bbt:cta',{detail:{cta:c,page:location.pathname}}));
    }catch(_){}
  },true);

  /* ---------------- chat assistant ---------------- */
  var bbtChat=document.createElement('script');bbtChat.src='assets/chat.js?v=bbdbe392';bbtChat.defer=true;document.body.appendChild(bbtChat);
})();
