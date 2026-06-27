/* Big Bad Thai — website chat assistant. Self-contained; loaded by actionbar.js on every page. */
(function(){
  if(/editor|studio/i.test(location.pathname)) return;

  var css = ""
  + "#bbt-chat-btn{position:fixed;right:18px;bottom:18px;z-index:520;width:56px;height:56px;border-radius:50%;background:var(--clay,#BD5E26);color:var(--cream,#FFF5E8);border:none;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center}"
  + "#bbt-chat-btn svg{width:26px;height:26px}"
  + "#bbt-chat-btn:active{opacity:.9}"
  + "@media(max-width:760px){#bbt-chat-btn{bottom:80px;right:14px;width:52px;height:52px}}"
  + "#bbt-chat{position:fixed;right:18px;bottom:84px;z-index:521;width:370px;max-width:calc(100vw - 28px);height:520px;max-height:calc(100vh - 120px);background:var(--cream,#FFF5E8);border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.32);display:none;flex-direction:column;overflow:hidden}"
  + "#bbt-chat.open{display:flex}"
  + "@media(max-width:760px){#bbt-chat{right:8px;left:8px;width:auto;bottom:142px;height:min(68vh,520px)}}"
  + ".bc-head{background:var(--night,#181818);color:var(--cream,#FFF5E8);padding:13px 15px;display:flex;align-items:center;gap:10px}"
  + ".bc-head .t{font-family:'Barlow Condensed',sans-serif;font-weight:800;text-transform:uppercase;font-size:15px;letter-spacing:.03em}"
  + ".bc-head .sub{font-family:'Space Mono',monospace;font-size:8px;letter-spacing:.05em;text-transform:uppercase;opacity:.55;margin-top:2px}"
  + ".bc-head .x{margin-left:auto;background:none;border:none;color:var(--cream,#FFF5E8);font-size:17px;cursor:pointer;opacity:.8}"
  + ".bc-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}"
  + ".bc-msg{max-width:85%;padding:9px 12px;border-radius:13px;font-family:'Roboto Condensed',sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}"
  + ".bc-msg.bot{background:#fff;color:var(--night,#181818);align-self:flex-start;border:1px solid rgba(24,24,24,.08)}"
  + ".bc-msg.me{background:var(--clay,#BD5E26);color:var(--cream,#FFF5E8);align-self:flex-end}"
  + ".bc-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px}"
  + ".bc-chips button{font-family:'Space Mono',monospace;font-size:9.5px;letter-spacing:.03em;text-transform:uppercase;background:transparent;border:1px solid rgba(189,94,38,.4);color:var(--clay,#BD5E26);border-radius:16px;padding:6px 11px;cursor:pointer}"
  + ".bc-chips button:hover{background:rgba(189,94,38,.08)}"
  + ".bc-form{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(24,24,24,.08);background:#fff}"
  + ".bc-form input{flex:1;border:1px solid rgba(24,24,24,.16);border-radius:20px;padding:9px 14px;font-family:'Roboto Condensed',sans-serif;font-size:14px;outline:none}"
  + ".bc-form input:focus{border-color:var(--clay,#BD5E26)}"
  + ".bc-form button{background:var(--clay,#BD5E26);color:#fff;border:none;border-radius:50%;width:38px;height:38px;cursor:pointer;flex:0 0 auto;font-size:15px;line-height:1}"
  + ".bc-typing{align-self:flex-start;color:rgba(84,88,61,.6);font-family:'Space Mono',monospace;font-size:11px;padding:2px 6px}";
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

  var icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  var btn=document.createElement('button');btn.id='bbt-chat-btn';btn.setAttribute('aria-label','Chat with us');btn.innerHTML=icon;

  var panel=document.createElement('div');panel.id='bbt-chat';
  panel.innerHTML=
     '<div class="bc-head"><div><div class="t">Ask Big Bad Thai</div><div class="sub">Menu · hours · how to find us</div></div><button class="x" aria-label="Close">✕</button></div>'
   + '<div class="bc-msgs"></div>'
   + '<div class="bc-chips"></div>'
   + '<form class="bc-form"><input type="text" placeholder="Ask about the menu, hours…" autocomplete="off" maxlength="500"><button type="submit" aria-label="Send">➤</button></form>';
  document.body.appendChild(btn);document.body.appendChild(panel);

  var msgsEl=panel.querySelector('.bc-msgs'), chipsEl=panel.querySelector('.bc-chips'),
      form=panel.querySelector('.bc-form'), input=panel.querySelector('input');
  var history=[], greeted=false, busy=false;

  function esc(s){return (s||'').replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
  function add(role,text){var d=document.createElement('div');d.className='bc-msg '+(role==='user'?'me':'bot');d.innerHTML=esc(text);msgsEl.appendChild(d);msgsEl.scrollTop=msgsEl.scrollHeight;}
  var CHIPS=[['Open now?','Are you open right now?'],['Vegetarian options','What vegetarian dishes do you have?'],['How to find you','Where are you and how do I get there?'],['Reserve a table','How can I reserve a table?']];
  function showChips(){chipsEl.innerHTML='';CHIPS.forEach(function(c){var b=document.createElement('button');b.type='button';b.textContent=c[0];b.onclick=function(){send(c[1]);};chipsEl.appendChild(b);});}
  function greet(){if(greeted)return;greeted=true;add('bot','Hi! 👋 I’m the Big Bad Thai assistant. Ask me about our menu, hours, how to find us — or anything else.');showChips();}
  function open(){panel.classList.add('open');greet();setTimeout(function(){input.focus();},60);}
  function close(){panel.classList.remove('open');}
  btn.onclick=function(){panel.classList.contains('open')?close():open();};
  panel.querySelector('.x').onclick=close;
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});

  function send(text){
    if(busy||!text||!text.trim())return;
    text=text.trim().slice(0,500);
    chipsEl.innerHTML='';
    add('user',text); history.push({role:'user',content:text});
    busy=true;
    var typing=document.createElement('div');typing.className='bc-typing';typing.textContent='Typing…';msgsEl.appendChild(typing);msgsEl.scrollTop=msgsEl.scrollHeight;
    fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:history.slice(-12)})})
      .then(function(r){return r.json();})
      .then(function(d){
        typing.remove();
        var reply=(d&&d.reply)||'Sorry — please message us on WhatsApp.';
        add('bot',reply); history.push({role:'assistant',content:reply}); busy=false;
      })
      .catch(function(){ typing.remove(); add('bot','Sorry, I couldn’t connect. Please message us on WhatsApp or Messenger.'); busy=false; });
  }
  form.addEventListener('submit',function(e){e.preventDefault();var t=input.value;input.value='';send(t);});
})();
