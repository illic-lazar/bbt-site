/* Big Bad Thai — mobile action bar + open-now badge + PWA bootstrap. Self-contained; include on every page. */
(function(){
  /* ---------------- styles ---------------- */
  var css = "#bbt-bar{display:none}"
  + "@media(max-width:760px){"
  + "#bbt-bar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:500;background:var(--night,#181818);"
  +   "border-top:1px solid rgba(255,245,232,.1);padding:8px 6px;gap:6px;box-shadow:0 -8px 24px rgba(0,0,0,.25)}"
  + "#bbt-bar a{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;"
  +   "padding:8px 2px;border-radius:9px;text-decoration:none;font-family:'Space Mono',monospace;font-size:8.5px;"
  +   "letter-spacing:.03em;text-transform:uppercase;color:var(--cream,#FFF5E8);-webkit-tap-highlight-color:transparent}"
  + "#bbt-bar a svg{width:18px;height:18px}"
  + "#bbt-bar a.primary{background:var(--clay,#BD5E26)}"
  + "#bbt-bar a.ghost{background:rgba(255,245,232,.08)}"
  + "#bbt-bar a.wa svg{color:#25D366}"
  + "#bbt-bar a:active{opacity:.8}"
  + "body{padding-bottom:66px!important}"
  + "}"
  + ".open-badge{display:inline-flex;align-items:center;gap:7px;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.05em;text-transform:uppercase}"
  + ".open-badge .od{width:8px;height:8px;border-radius:50%;display:inline-block}"
  + ".open-badge.is-open{color:#3c8a4e}.open-badge.is-open .od{background:#3c8a4e;box-shadow:0 0 0 3px rgba(60,138,78,.18)}"
  + ".open-badge.is-closed{color:#b04a2b}.open-badge.is-closed .od{background:#b04a2b}"
  + "#bbt-lang{position:fixed;left:16px;bottom:18px;z-index:490}"
  + "@media(max-width:760px){#bbt-lang{bottom:80px;left:12px}}"
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

  /* ---------------- action bar ---------------- */
  var GMAPS='https://www.google.com/maps/dir/?api=1&destination=Big%20Bad%20Thai%20Restaurant%20El%20Nido%20Hama%20Street&destination_place_id=ChIJj-thjxVVtjMRdmsUeV7mG_E&travelmode=walking';
  var bar=document.createElement('div');bar.id='bbt-bar';
  bar.innerHTML=
    '<a class="ghost" id="bbt-dir" href="'+GMAPS+'" target="_blank" rel="noopener">'+pin+'Directions</a>'
   +'<a class="ghost" href="tel:+639452994225">'+phone+'Call</a>'
   +'<a class="ghost wa" href="https://wa.me/639452994225" target="_blank" rel="noopener">'+wa+'WhatsApp</a>'
   +'<a class="primary" href="https://m.me/bigbadthai" target="_blank" rel="noopener">'+chat+'Reserve</a>';
  document.body.appendChild(bar);
  // iOS → Apple Maps walking directions
  var isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(isIOS){var d=document.getElementById('bbt-dir');if(d)d.href='https://maps.apple.com/?daddr=Big+Bad+Thai+Restaurant+El+Nido,+Hama+Street&dirflg=w';}

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
    +'<button class="lang-btn" type="button" aria-label="Language" aria-haspopup="true">'+globe+'</button>';
  document.body.appendChild(lang);
  lang.querySelector('.lang-btn').addEventListener('click',function(e){e.stopPropagation();lang.classList.toggle('open');});
  [].forEach.call(lang.querySelectorAll('.lang-menu button'),function(b){b.addEventListener('click',function(){lang.classList.remove('open');setLang(b.getAttribute('data-l'));});});
  document.addEventListener('click',function(e){if(!lang.contains(e.target))lang.classList.remove('open');});

  /* ---------------- open-now badge (Asia/Manila, 11:00–23:00 daily) ---------------- */
  try{
    var parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
    var pv=function(t){var x=parts.find(function(o){return o.type===t;});return x?parseInt(x.value,10):0;};
    var mins=pv('hour')*60+pv('minute'), isOpen=mins>=660&&mins<1380;
    document.querySelectorAll('[data-open-status]').forEach(function(el){
      el.className=(el.className+' open-badge '+(isOpen?'is-open':'is-closed')).trim();
      el.innerHTML='<span class="od"></span>'+(isOpen?'Open now · until 11 PM':'Closed · opens 11 AM');
    });
  }catch(e){}

  /* ---------------- PWA: manifest + apple meta + service worker ---------------- */
  if(!document.querySelector('link[rel="manifest"]')){var lm=document.createElement('link');lm.rel='manifest';lm.href='/manifest.webmanifest';document.head.appendChild(lm);}
  var ati=document.createElement('link');ati.rel='apple-touch-icon';ati.href='/icon-192.png';document.head.appendChild(ati);
  [['apple-mobile-web-app-capable','yes'],['apple-mobile-web-app-status-bar-style','default'],['apple-mobile-web-app-title','Big Bad Thai'],['mobile-web-app-capable','yes']].forEach(function(m){var mt=document.createElement('meta');mt.name=m[0];mt.content=m[1];document.head.appendChild(mt);});
  if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}

  /* ---------------- page-view beacon (privacy-friendly, no cookies) ---------------- */
  if(!/editor|studio|admin/i.test(location.pathname)){
    try{
      var _sk='bbtSid', _sid=sessionStorage.getItem(_sk);
      if(!_sid){ _sid=Date.now().toString(36)+Math.random().toString(36).slice(2,8); sessionStorage.setItem(_sk,_sid); }
      var _hit=JSON.stringify({p:location.pathname,r:document.referrer||'',s:_sid});
      if(navigator.sendBeacon){ navigator.sendBeacon('/api/hit', new Blob([_hit],{type:'application/json'})); }
      else{ fetch('/api/hit',{method:'POST',headers:{'content-type':'application/json'},body:_hit,keepalive:true}).catch(function(){}); }
    }catch(e){}
  }

  /* ---------------- chat assistant ---------------- */
  var bbtChat=document.createElement('script');bbtChat.src='assets/chat.js';bbtChat.defer=true;document.body.appendChild(bbtChat);
})();
