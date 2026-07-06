/* Big Bad Thai — website chat assistant. Self-contained; loaded by actionbar.js on every page. */
(function(){
  if(/editor|studio/i.test(location.pathname)) return;

  var WA='639452994225';
  var BOOKMSG='Hi Big Bad Thai! I would like to reserve a table.\n\nName:\nDate:\nTime:\nNumber of guests:\n\n(Sent from your website)';
  var BOOK_URL='https://wa.me/'+WA+'?text='+encodeURIComponent(BOOKMSG);
  var DIR_URL=/iPad|iPhone|iPod/.test(navigator.userAgent||'')
    ? 'https://maps.apple.com/?daddr='+encodeURIComponent('Big Bad Thai Restaurant El Nido, Hama Street')+'&dirflg=w'
    : 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent('Big Bad Thai Restaurant, Hama Street, El Nido, Palawan')+'&destination_place_id=ChIJj-thjxVVtjMRdmsUeV7mG_E&travelmode=walking';
  var ACT={
    book:{label:'📅 Book a table on WhatsApp',href:BOOK_URL,cls:'wa'},
    whatsapp:{label:'💬 Chat with us on WhatsApp',href:'https://wa.me/'+WA,cls:'wa'},
    messenger:{label:'💬 Message us on Messenger',href:'https://m.me/bigbadthai',cls:'wa'},
    directions:{label:'📍 Get directions',href:DIR_URL,cls:'map'}
  };

  var css = ""
  + "#bbt-chat-btn{position:fixed;right:18px;bottom:18px;z-index:520;width:56px;height:56px;border-radius:50%;background:var(--clay,#BD5E26);color:var(--cream,#FFF5E8);border:none;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center}"
  + "#bbt-chat-btn svg{width:26px;height:26px}"
  + "#bbt-chat-btn:active{opacity:.9}"
  + "@media(max-width:760px){#bbt-chat-btn{bottom:80px;right:14px;width:52px;height:52px}}"
  + "#bbt-chat{position:fixed;right:18px;bottom:84px;z-index:521;width:390px;max-width:calc(100vw - 28px);height:566px;max-height:calc(100vh - 116px);background:var(--cream,#FFF5E8);border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.32);display:none;flex-direction:column;overflow:hidden}"
  + "#bbt-chat.open{display:flex}"
  + "@media(max-width:760px){#bbt-chat{right:8px;left:8px;width:auto;bottom:142px;height:min(72vh,566px)}}"
  + ".bc-head{background:var(--night,#181818);color:var(--cream,#FFF5E8);padding:12px 14px;display:flex;align-items:center;gap:8px}"
  + ".bc-head .t{font-family:'Barlow Condensed',sans-serif;font-weight:800;text-transform:uppercase;font-size:15px;letter-spacing:.03em}"
  + ".bc-head .sub{font-family:'Space Mono',monospace;font-size:8px;letter-spacing:.05em;text-transform:uppercase;opacity:.55;margin-top:2px}"
  + ".bc-head .ic{background:none;border:none;color:var(--cream,#FFF5E8);cursor:pointer;opacity:.75;font-size:15px;line-height:1;padding:4px}"
  + ".bc-head .ic:hover{opacity:1}"
  + ".bc-head .rs{margin-left:auto;font-size:16px}"
  + ".bc-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:9px}"
  + ".bc-msg{max-width:88%;padding:10px 13px;border-radius:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.55;word-wrap:break-word;overflow-wrap:anywhere}"
  + ".bc-msg.bot{background:#fff;color:#232323;align-self:flex-start;border:1px solid rgba(24,24,24,.08)}"
  + ".bc-msg.me{background:var(--clay,#BD5E26);color:var(--cream,#FFF5E8);align-self:flex-end;white-space:pre-wrap}"
  + ".bc-msg.bot p{margin:0 0 8px}"
  + ".bc-msg.bot p:last-child{margin-bottom:0}"
  + ".bc-msg.bot ul,.bc-msg.bot ol{margin:6px 0 8px;padding-left:19px}"
  + ".bc-msg.bot li{margin:3px 0}"
  + ".bc-msg.bot strong{font-weight:700;color:#181818}"
  + ".bc-msg.bot a{color:var(--clay,#BD5E26);text-decoration:underline;font-weight:600}"
  + ".bc-actions{align-self:flex-start;display:flex;flex-wrap:wrap;gap:6px;margin:1px 0 2px}"
  + ".bc-act{display:inline-flex;align-items:center;gap:6px;background:#25D366;color:#fff;text-decoration:none;font-family:-apple-system,system-ui,sans-serif;font-size:13px;font-weight:700;padding:9px 14px;border-radius:20px;line-height:1.2}"
  + ".bc-act:hover{filter:brightness(.96)}"
  + ".bc-act.map{background:var(--clay,#BD5E26)}"
  + ".bc-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px}"
  + ".bc-chips button,.bc-chips a{font-family:'Space Mono',monospace;font-size:9.5px;letter-spacing:.03em;text-transform:uppercase;background:transparent;border:1px solid rgba(189,94,38,.4);color:var(--clay,#BD5E26);border-radius:16px;padding:6px 11px;cursor:pointer;text-decoration:none}"
  + ".bc-chips button:hover,.bc-chips a:hover{background:rgba(189,94,38,.08)}"
  + ".bc-chips a.primary{background:var(--clay,#BD5E26);color:#fff;border-color:var(--clay,#BD5E26)}"
  + ".bc-form{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(24,24,24,.08);background:#fff}"
  + ".bc-form input{flex:1;border:1px solid rgba(24,24,24,.16);border-radius:20px;padding:10px 14px;font-family:-apple-system,system-ui,sans-serif;font-size:14.5px;outline:none}"
  + ".bc-form input:focus{border-color:var(--clay,#BD5E26)}"
  + ".bc-form button{background:var(--clay,#BD5E26);color:#fff;border:none;border-radius:50%;width:38px;height:38px;cursor:pointer;flex:0 0 auto;font-size:15px;line-height:1}"
  + ".bc-form button:disabled{opacity:.5;cursor:default}"
  + ".bc-typing{align-self:flex-start;display:flex;gap:4px;padding:10px 8px}"
  + ".bc-typing i{width:7px;height:7px;border-radius:50%;background:rgba(84,88,61,.45);display:inline-block;animation:bcbounce 1s infinite ease-in-out}"
  + ".bc-typing i:nth-child(2){animation-delay:.15s}"
  + ".bc-typing i:nth-child(3){animation-delay:.3s}"
  + "@keyframes bcbounce{0%,70%,100%{transform:translateY(0);opacity:.4}35%{transform:translateY(-5px);opacity:1}}";
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

  var icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  var btn=document.createElement('button');btn.id='bbt-chat-btn';btn.setAttribute('aria-label','Chat with us');btn.innerHTML=icon;

  var panel=document.createElement('div');panel.id='bbt-chat';
  panel.innerHTML=
     '<div class="bc-head"><div><div class="t">Ask Big Bad Thai</div><div class="sub">Menu · hours · book a table</div></div>'
   + '<button class="ic rs" title="New chat" aria-label="New chat">&#8635;</button>'
   + '<button class="ic x" title="Close" aria-label="Close">&#10005;</button></div>'
   + '<div class="bc-msgs"></div>'
   + '<div class="bc-chips"></div>'
   + '<form class="bc-form"><input type="text" placeholder="Ask about the menu, hours…" autocomplete="off" maxlength="500"><button type="submit" aria-label="Send">&#10148;</button></form>';
  document.body.appendChild(btn);document.body.appendChild(panel);

  var msgsEl=panel.querySelector('.bc-msgs'), chipsEl=panel.querySelector('.bc-chips'),
      form=panel.querySelector('.bc-form'), input=panel.querySelector('input'), sendBtn=form.querySelector('button');
  var history=[], greeted=false, busy=false, STORE='bbtChat';
  var SID=(function(){try{var k='bbtSid',v=sessionStorage.getItem(k);if(!v){v=Date.now().toString(36)+Math.random().toString(36).slice(2,8);sessionStorage.setItem(k,v);}return v;}catch(e){return 'na';}})();

  function esc(s){return (s||'').replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}

  // --- tiny, safe markdown → HTML (input is escaped first) ---
  function linkify(t){
    var RE=/((?:https?:\/\/|www\.)[^\s<]+)|((?:wa\.me|m\.me)\/[^\s<]+)|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|(\+63[\d ]{9,14}\d)/g;
    return t.replace(RE,function(m,url,waurl,email,phone){
      function split(u){var tr='',mm=u.match(/[.,!?:;)*\]]+$/);if(mm){tr=mm[0];u=u.slice(0,-tr.length);}return [u,tr];}
      if(url){var a=split(url),h=a[0].indexOf('http')===0?a[0]:'https://'+a[0];return '<a href="'+h+'" target="_blank" rel="noopener">'+a[0]+'</a>'+a[1];}
      if(waurl){var b=split(waurl);return '<a href="https://'+b[0]+'" target="_blank" rel="noopener">'+b[0]+'</a>'+b[1];}
      if(email){return '<a href="mailto:'+email+'">'+email+'</a>';}
      if(phone){return '<a href="https://wa.me/'+phone.replace(/\D/g,'')+'" target="_blank" rel="noopener">'+phone.trim()+'</a>';}
      return m;
    });
  }
  function inline(s){
    s=linkify(esc(s));
    s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    s=s.replace(/(^|[\s(])_([^_]+)_(?=[\s.,!?)]|$)/g,'$1<em>$2</em>');
    return s;
  }
  function md(text){
    var lines=(text||'').replace(/\r/g,'').split('\n'), out='', para=[], i=0;
    function flushP(){ if(para.length){ out+='<p>'+inline(para.join(' '))+'</p>'; para=[]; } }
    while(i<lines.length){
      var ln=lines[i];
      if(/^\s*$/.test(ln)){ flushP(); i++; continue; }
      var mm, items;
      if(lines[i].match(/^\s*[-*•]\s+/)){ flushP(); items=[]; while(i<lines.length && (mm=lines[i].match(/^\s*[-*•]\s+(.*)/))){ items.push('<li>'+inline(mm[1])+'</li>'); i++; } out+='<ul>'+items.join('')+'</ul>'; continue; }
      if(lines[i].match(/^\s*\d+[.)]\s+/)){ flushP(); items=[]; while(i<lines.length && (mm=lines[i].match(/^\s*\d+[.)]\s+(.*)/))){ items.push('<li>'+inline(mm[1])+'</li>'); i++; } out+='<ol>'+items.join('')+'</ol>'; continue; }
      para.push(ln.replace(/^\s*#{1,6}\s+/,'').trim()); i++;
    }
    flushP();
    return out||('<p>'+inline(text)+'</p>');
  }

  function userMsg(text){
    var d=document.createElement('div');d.className='bc-msg me';d.innerHTML=esc(text);
    msgsEl.appendChild(d); msgsEl.scrollTop=msgsEl.scrollHeight;
  }
  function botMsg(text){
    var acts=[], seen={};
    var clean=(text||'').replace(/\[\[\s*(book|whatsapp|messenger|directions)\s*\]\]/gi,function(m,k){k=k.toLowerCase();if(!seen[k]&&ACT[k]){seen[k]=1;acts.push(k);}return '';});
    clean=clean.replace(/\n{3,}/g,'\n\n').trim();
    var d=document.createElement('div');d.className='bc-msg bot';d.innerHTML=md(clean);msgsEl.appendChild(d);
    if(acts.length){
      var wrap=document.createElement('div');wrap.className='bc-actions';
      acts.forEach(function(k){var a=document.createElement('a');a.className='bc-act '+(ACT[k].cls||'');a.href=ACT[k].href;a.target='_blank';a.rel='noopener';a.textContent=ACT[k].label;wrap.appendChild(a);});
      msgsEl.appendChild(wrap);
    }
    msgsEl.scrollTop=msgsEl.scrollHeight;
  }
  function save(){ try{ sessionStorage.setItem(STORE,JSON.stringify(history.slice(-24))); }catch(e){} }

  var CHIPS=[
    {label:'📅 Book a table',href:BOOK_URL,primary:true},
    {label:'Open now?',q:'Are you open right now?'},
    {label:'Vegetarian options',q:'What vegetarian dishes do you have?'},
    {label:'How to find you',q:'Where are you and how do I get there?'}
  ];
  function showChips(){
    chipsEl.innerHTML='';
    CHIPS.forEach(function(c){
      if(c.href){ var a=document.createElement('a');a.href=c.href;a.target='_blank';a.rel='noopener';a.textContent=c.label;if(c.primary)a.className='primary';chipsEl.appendChild(a); }
      else { var b=document.createElement('button');b.type='button';b.textContent=c.label;b.onclick=function(){send(c.q);};chipsEl.appendChild(b); }
    });
  }
  function greet(){
    if(greeted)return; greeted=true;
    var saved=[]; try{ saved=JSON.parse(sessionStorage.getItem(STORE)||'[]'); }catch(e){}
    if(saved && saved.length){ history=saved; saved.forEach(function(m){ m.role==='user'?userMsg(m.content):botMsg(m.content); }); }
    else { botMsg('Hi! 👋 I’m the Big Bad Thai assistant. Ask me about our menu, hours, how to find us, or book a table.'); showChips(); }
  }
  function open(){panel.classList.add('open');greet();setTimeout(function(){input.focus();},60);}
  function close(){panel.classList.remove('open');}
  function reset(){ history=[]; try{sessionStorage.removeItem(STORE);}catch(e){} msgsEl.innerHTML=''; greeted=false; greet(); input.focus(); }
  btn.onclick=function(){panel.classList.contains('open')?close():open();};
  panel.querySelector('.x').onclick=close;
  panel.querySelector('.rs').onclick=reset;
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&panel.classList.contains('open'))close();});

  function send(text){
    if(busy||!text||!text.trim())return;
    text=text.trim().slice(0,500);
    chipsEl.innerHTML='';
    userMsg(text); history.push({role:'user',content:text}); save();
    busy=true; sendBtn.disabled=true;
    var typing=document.createElement('div');typing.className='bc-typing';typing.innerHTML='<i></i><i></i><i></i>';msgsEl.appendChild(typing);msgsEl.scrollTop=msgsEl.scrollHeight;
    fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:history.slice(-12),sid:SID})})
      .then(function(r){return r.json();})
      .then(function(d){
        typing.remove();
        var reply=(d&&d.reply)||'Sorry — please message us on WhatsApp.';
        botMsg(reply); history.push({role:'assistant',content:reply}); save(); busy=false; sendBtn.disabled=false; input.focus();
      })
      .catch(function(){ typing.remove(); botMsg('Sorry, I couldn’t connect. Please message us on WhatsApp or Messenger. [[whatsapp]]'); busy=false; sendBtn.disabled=false; });
  }
  form.addEventListener('submit',function(e){e.preventDefault();var t=input.value;input.value='';send(t);});
})();
