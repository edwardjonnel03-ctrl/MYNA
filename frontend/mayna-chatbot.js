/* MAYNA Assistant — free, no AI API; uses the existing public business search endpoint. */
(() => {
  'use strict';
  if (document.getElementById('mayna-chat-root')) return;
  const style = document.createElement('style');
  style.textContent = `
    #mayna-chat-root{font-family:Arial,sans-serif;position:fixed;right:20px;bottom:20px;z-index:9000;color:#1c2733}
    #mayna-chat-toggle{border:0;border-radius:50%;width:62px;height:62px;background:#ff7900;color:white;font-size:28px;cursor:pointer;box-shadow:0 5px 20px #0003;float:right}
    #mayna-chat-panel{clear:both;width:min(370px,calc(100vw - 32px));height:min(510px,calc(100dvh - 110px));background:white;border-radius:18px;box-shadow:0 12px 45px #0004;display:none;flex-direction:column;overflow:hidden;margin-bottom:12px;border:1px solid #e4e4e4}
    #mayna-chat-panel.open{display:flex}#mayna-chat-head{background:#142d46;color:white;padding:15px;display:flex;justify-content:space-between;align-items:center;font-weight:bold}
    #mayna-chat-close{background:transparent;border:0;color:white;font-size:25px;cursor:pointer}
    #mayna-chat-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;font-size:14px}
    .mayna-msg{max-width:90%;padding:10px 12px;border-radius:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
    .mayna-bot{align-self:flex-start;background:#f0f3f6}.mayna-user{align-self:flex-end;background:#ffeadb}
    .mayna-msg a{color:#0656a6;font-weight:bold;display:block;margin-top:5px}
    #mayna-chat-quick{padding:6px 12px;display:flex;flex-wrap:wrap;gap:6px}
    #mayna-chat-quick button{border:1px solid #ff7900;background:#fff8f1;border-radius:18px;padding:7px 10px;cursor:pointer;font-size:12px}
    #mayna-chat-form{display:flex;gap:6px;border-top:1px solid #ddd;padding:10px}
    #mayna-chat-input{flex:1;min-width:0;border:1px solid #ddd;border-radius:10px;padding:10px;font-size:14px}
    #mayna-chat-send{border:0;border-radius:10px;background:#ff7900;color:white;padding:10px 13px;cursor:pointer}
    @media(max-width:480px){#mayna-chat-root{right:12px;bottom:12px}}
  `;
  document.head.appendChild(style);
  const root = document.createElement('aside');
  root.id = 'mayna-chat-root';
  root.setAttribute('aria-label', 'MAYNA Assistant');
  root.innerHTML = `<section id="mayna-chat-panel" aria-label="Chat with MAYNA Assistant"><header id="mayna-chat-head"><span>🤖 MAYNA Assistant</span><button id="mayna-chat-close" aria-label="Close chat">×</button></header><div id="mayna-chat-log" role="log" aria-live="polite"></div><div id="mayna-chat-quick"></div><form id="mayna-chat-form"><input id="mayna-chat-input" maxlength="100" placeholder="Ask or search businesses..." aria-label="Your message" required><button id="mayna-chat-send" type="submit">Send</button></form></section><button id="mayna-chat-toggle" aria-label="Open MAYNA Assistant" aria-expanded="false">💬</button>`;
  document.body.appendChild(root);
  const panel = root.querySelector('#mayna-chat-panel');
  const toggle = root.querySelector('#mayna-chat-toggle');
  const log = root.querySelector('#mayna-chat-log');
  const input = root.querySelector('#mayna-chat-input');
  const quick = root.querySelector('#mayna-chat-quick');
  function addMessage(message, who = 'bot', links = []) {
    const div = document.createElement('div');
    div.className = `mayna-msg mayna-${who}`;
    div.append(document.createTextNode(message));
    links.forEach(({text, href}) => {
      const a = document.createElement('a');
      a.textContent = text;
      a.href = href;
      div.appendChild(a);
    });
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }
  const quickOptions = ['Find businesses', 'Register my business', 'Premium plans', 'Contact support'];
  quickOptions.forEach(label => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label;
    b.addEventListener('click', () => handle(label));
    quick.appendChild(b);
  });
  function replyFAQ(text) {
    const q = text.toLowerCase();
    if (/register|list my business|add my business|sign up/.test(q)) {
      addMessage('You can register your business on MAYNA using the registration page.', 'bot', [{text:'Register your business',href:'/register.html'}]); return true;
    }
    if (/premium|subscription|upgrade|pricing|price/.test(q)) {
      addMessage('Premium provides additional business listing features. Check the Premium page for current plans and payment instructions.', 'bot', [{text:'View Premium plans',href:'/premium.html'}]); return true;
    }
    if (/contact|support|help|complaint/.test(q)) {
      addMessage('You can contact the MAYNA team through the contact page.', 'bot', [{text:'Contact MAYNA',href:'/contact.html'}]); return true;
    }
    if (/what is mayna|about mayna|how does mayna work/.test(q)) {
      addMessage('MAYNA is a directory that helps people discover businesses and services. Businesses can register to be found by potential customers.'); return true;
    }
    return false;
  }
  async function searchBusinesses(term) {
    addMessage(`Searching MAYNA for “${term}”...`);
    try {
      const response = await fetch('/api/businesses?search=' + encodeURIComponent(term) + '&limit=5', {headers:{Accept:'application/json'}});
      if (!response.ok) throw new Error('Search unavailable');
      const data = await response.json();
      const businesses = Array.isArray(data.businesses) ? data.businesses : [];
      if (!businesses.length) {
        addMessage('I couldn’t find a matching listing. Try a business name, service, or town.', 'bot', [{text:'Browse all businesses',href:'/businesses.html'}]);
        return;
      }
      addMessage(`I found ${businesses.length} matching listing${businesses.length === 1 ? '' : 's'} (showing up to 5):`);
      businesses.forEach(b => {
        const id = Number(b.id);
        const link = Number.isSafeInteger(id) && id > 0 ? `/business.html?id=${id}` : '/businesses.html';
        addMessage([b.businessName || 'Business', b.town || b.location || '', b.category || ''].filter(Boolean).join(' · '), 'bot', [{text:'View listing',href:link}]);
      });
    } catch {
      addMessage('Business search is temporarily unavailable. Please use the directory.', 'bot', [{text:'Browse businesses',href:'/businesses.html'}]);
    }
  }
  async function handle(raw) {
    const text = String(raw || '').trim().slice(0,100);
    if (!text) return;
    addMessage(text, 'user');
    if (replyFAQ(text)) return;
    if (/^(hello|hi|hey|thanks|thank you)$/i.test(text)) {
      addMessage('Hello! I can help you find businesses, register a business, explore Premium or contact support.'); return;
    }
    if (/^(find businesses|search|find a business)$/i.test(text)) {
      addMessage('What business name, service or town are you looking for?'); return;
    }
    const term = text.replace(/^(find|search for|looking for|show me|businesses in|i need|i want)\s+/i,'').trim();
    if (term.length < 2) { addMessage('Please enter a business name, service or town.'); return; }
    await searchBusinesses(term);
  }
  root.querySelector('#mayna-chat-form').addEventListener('submit', e => {
    e.preventDefault(); const text = input.value; input.value = ''; handle(text);
  });
  function setOpen(open) { panel.classList.toggle('open',open);toggle.setAttribute('aria-expanded',String(open));if(open)input.focus(); }
  toggle.addEventListener('click',()=>setOpen(!panel.classList.contains('open')));
  root.querySelector('#mayna-chat-close').addEventListener('click',()=>setOpen(false));
  addMessage('Welcome to MAYNA! Search for a business or choose a quick question below.');
})();
