/* PICO landing v2: vanilla JS. Every feature degrades to static HTML without JS. */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onScreen = new Map(); // element -> boolean, used to pause work off-screen

  const watchVisibility = (el) => {
    const io = new IntersectionObserver(([entry]) => onScreen.set(el, entry.isIntersecting), { rootMargin: '120px' });
    io.observe(el);
    onScreen.set(el, true);
  };
  const visible = (el) => onScreen.get(el) !== false && !document.hidden;

  /* ---------- Toast ---------- */
  const toastEl = $('#toast');
  let toastTimer;
  const toast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2200);
  };

  /* ---------- Header: scroll state, scroll-spy, mobile menu ---------- */
  const hdr = $('.hdr');
  const onScroll = () => hdr && hdr.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const navLinks = $$('.nav a[href^="#"]');
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${e.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  navLinks.forEach((a) => { const t = document.getElementById(a.getAttribute('href').slice(1)); if (t) spy.observe(t); });

  const mmenu = $('#mmenu');
  const menuBtn = $('#menuBtn');
  let lastFocus = null;
  const openMenu = () => {
    lastFocus = document.activeElement;
    mmenu.classList.add('is-open');
    mmenu.setAttribute('aria-hidden', 'false');
    menuBtn.setAttribute('aria-expanded', 'true');
    $('#mmenuClose').focus();
  };
  const closeMenu = () => {
    mmenu.classList.remove('is-open');
    mmenu.setAttribute('aria-hidden', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
    if (lastFocus) lastFocus.focus();
  };
  if (mmenu) {
    menuBtn.addEventListener('click', openMenu);
    $('#mmenuClose').addEventListener('click', closeMenu);
    mmenu.addEventListener('click', (e) => { if (e.target.matches('.mmenu__link')) closeMenu(); });
    document.addEventListener('keydown', (e) => {
      if (!mmenu.classList.contains('is-open')) return;
      if (e.key === 'Escape') return closeMenu();
      if (e.key !== 'Tab') return;
      const f = $$('a, button', mmenu);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* Language picker (UI label; copy is English-first for now) */
  const langBtn = $('#langBtn');
  const langMenu = $('#langMenu');
  if (langBtn && langMenu) {
    langBtn.addEventListener('click', () => {
      const open = langMenu.hidden;
      langMenu.hidden = !open;
      langBtn.setAttribute('aria-expanded', String(open));
    });
    $$('button', langMenu).forEach((b) => b.addEventListener('click', () => {
      $$('button', langMenu).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      $('#langLabel').textContent = b.dataset.label;
      langMenu.hidden = true;
      langBtn.setAttribute('aria-expanded', 'false');
    }));
    document.addEventListener('click', (e) => { if (!langMenu.contains(e.target) && e.target !== langBtn) langMenu.hidden = true; });
  }

  /* ---------- Hero: typing transcript (RTL and Devanagari aware) ---------- */
  const transcript = $('#transcript');
  const PROMPTS = [
    { text: 'PICO, mere liye ek chhoti si portfolio website bana do.', dir: 'ltr', lang: 'en' },
    { text: 'پیکو، میرے لیے ایک چھوٹی سی ویب سائٹ بنا دو۔', dir: 'rtl', lang: 'ur' },
    { text: 'पीको, मेरे लिए एक छोटी सी वेबसाइट बना दो।', dir: 'ltr', lang: 'hi' }
  ];
  let promptIdx = 0;
  const typeTo = (el, text, done) => {
    let i = 0;
    const caret = document.createElement('span');
    caret.className = 'transcript__caret';
    caret.setAttribute('aria-hidden', 'true');
    const step = () => {
      if (!visible(transcript)) return setTimeout(step, 400);
      el.textContent = text.slice(0, i);
      el.appendChild(caret);
      if (i++ < text.length) return setTimeout(step, 38);
      setTimeout(done, 2400);
    };
    step();
  };
  const rotatePrompts = () => {
    const p = PROMPTS[promptIdx % PROMPTS.length];
    promptIdx++;
    transcript.dir = p.dir;
    transcript.lang = p.lang;
    transcript.style.textAlign = p.dir === 'rtl' ? 'right' : 'left';
    typeTo(transcript, p.text, rotatePrompts);
  };
  if (transcript) {
    if (reduceMotion) transcript.textContent = PROMPTS[0].text;
    else rotatePrompts();
  }

  /* ---------- Hero: orb toggle, waveform ring, result tabs, parallax ---------- */
  const orb = $('#orb');
  const orbStatus = $('#orbStatus');
  let listening = true;
  const setListening = (on) => {
    listening = on;
    orb.classList.toggle('is-listening', on);
    orb.setAttribute('aria-pressed', String(on));
    orbStatus.textContent = on ? 'Listening' : 'Paused';
  };
  if (orb) {
    orb.addEventListener('click', () => setListening(!listening));
    setListening(true);
  }

  const canvas = $('#waveCanvas');
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext('2d');
    const BARS = 72;
    let t = 0, last = 0, amp = 1;
    watchVisibility(canvas);
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = (now) => {
      requestAnimationFrame(draw);
      if (now - last < 16) return; // cap at ~60fps
      last = now;
      if (!visible(canvas)) return;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      t += 0.03;
      amp += ((listening ? 1 : 0.15) - amp) * 0.06;
      const cx = w / 2, cy = h / 2, R = 140;
      for (let i = 0; i < BARS; i++) {
        const a = (i / BARS) * Math.PI * 2;
        const n = (Math.sin(i * 0.55 + t * 2.2) + Math.sin(i * 0.23 - t * 1.4) + 2) / 4;
        const len = (8 + n * 34) * amp;
        const x1 = cx + Math.cos(a) * R, y1 = cy + Math.sin(a) * R;
        const x2 = cx + Math.cos(a) * (R + len), y2 = cy + Math.sin(a) * (R + len);
        ctx.strokeStyle = `rgba(198,255,61,${0.25 + n * 0.6})`;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    };
    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(draw);
  }

  const RESULTS = {
    answer: '<p><strong>Portfolio plan ready.</strong></p><p>Hero, projects grid, and contact form. Ye sections ke saath 3 pages.</p><p>Next: colors aur photos add karein.</p>',
    canvas: '<div class="result__blocks"><span>Hero block</span><span>Projects grid</span><span>About card</span><span>Contact form</span></div>',
    preview: '<div class="result__frame"><div class="result__frame-bar"><i></i><i></i><i></i></div><div class="result__frame-page"><b></b><em></em><em></em><s></s></div></div>'
  };
  const resultBody = $('#resultBody');
  $$('[data-result]').forEach((btn) => btn.addEventListener('click', () => {
    $$('[data-result]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    resultBody.innerHTML = RESULTS[btn.dataset.result];
  }));

  const floats = $$('.float-card');
  const consoleEl = $('#console');
  if (consoleEl && !reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    consoleEl.addEventListener('pointermove', (e) => {
      const r = consoleEl.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      floats.forEach((f, i) => { const k = i ? -1 : 1; f.style.translate = `${x * 10 * k}px ${y * 10 * k}px`; });
    });
    consoleEl.addEventListener('pointerleave', () => floats.forEach((f) => { f.style.translate = ''; }));
  }

  /* ---------- Bento: artifact build loop + draggable canvas blocks ---------- */
  const buildFrame = $('#buildFrame');
  if (buildFrame && !reduceMotion) {
    const cycle = () => {
      if (visible(buildFrame)) {
        buildFrame.classList.add('is-built');
        setTimeout(() => buildFrame.classList.remove('is-built'), 4200);
      }
    };
    setInterval(cycle, 5200);
  } else if (buildFrame) {
    buildFrame.classList.add('is-built');
  }

  $$('.sticky').forEach((note) => {
    let sx, sy, ox, oy;
    note.addEventListener('pointerdown', (e) => {
      note.setPointerCapture(e.pointerId);
      note.classList.add('is-drag');
      sx = e.clientX; sy = e.clientY;
      ox = note.offsetLeft; oy = note.offsetTop;
    });
    note.addEventListener('pointermove', (e) => {
      if (!note.classList.contains('is-drag')) return;
      const board = note.parentElement;
      const maxX = board.clientWidth - note.offsetWidth;
      const maxY = board.clientHeight - note.offsetHeight;
      note.style.left = `${Math.min(maxX, Math.max(0, ox + e.clientX - sx))}px`;
      note.style.top = `${Math.min(maxY, Math.max(0, oy + e.clientY - sy))}px`;
    });
    const end = () => note.classList.remove('is-drag');
    note.addEventListener('pointerup', end);
    note.addEventListener('pointercancel', end);
  });

  /* ---------- Routing diagram: hover highlight + auto pulse ---------- */
  const routeNodes = $$('.route-node');
  const routePaths = $$('.route-path');
  const routeTip = $('#routeTip');
  const highlight = (agent) => {
    routePaths.forEach((p) => p.classList.toggle('is-hot', p.dataset.agent === agent));
    routeNodes.forEach((n) => n.classList.toggle('is-hot', n.dataset.agent === agent));
    const node = routeNodes.find((n) => n.dataset.agent === agent);
    if (routeTip && node) {
      routeTip.innerHTML = `<strong>${node.dataset.name}</strong>${node.dataset.tip}`;
      routeTip.classList.add('is-on');
    }
  };
  const clearHighlight = () => {
    routePaths.forEach((p) => p.classList.remove('is-hot'));
    routeNodes.forEach((n) => n.classList.remove('is-hot'));
    if (routeTip) routeTip.classList.remove('is-on');
  };
  routeNodes.forEach((n) => {
    n.addEventListener('pointerenter', () => { pausePulse = true; highlight(n.dataset.agent); });
    n.addEventListener('focus', () => { pausePulse = true; highlight(n.dataset.agent); });
    n.addEventListener('pointerleave', () => { pausePulse = false; clearHighlight(); });
    n.addEventListener('blur', () => { pausePulse = false; clearHighlight(); });
  });
  let pausePulse = false, pulseIdx = 0;
  if (routeNodes.length && !reduceMotion) {
    setInterval(() => {
      if (pausePulse || !visible(routeNodes[0])) return;
      highlight(routeNodes[pulseIdx % routeNodes.length].dataset.agent);
      pulseIdx++;
      setTimeout(() => { if (!pausePulse) clearHighlight(); }, 1800);
    }, 4000);
  }

  /* ---------- Reveal on scroll ---------- */
  const revealEls = $$('.reveal');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const ro = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); ro.unobserve(e.target); }
    }), { threshold: 0.12 });
    revealEls.forEach((el) => ro.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Count-up + ring gauges (run once when visible) ---------- */
  const countUp = (el) => {
    const target = Number(el.dataset.count);
    if (reduceMotion) { el.textContent = target; return; }
    const start = performance.now(), dur = 1400;
    const frame = (now) => {
      const p = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  const statsIO = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    statsIO.unobserve(e.target);
    const card = e.target;
    const fill = $('.fill', card);
    if (fill) {
      const C = Number(fill.getAttribute('stroke-dasharray'));
      fill.style.strokeDashoffset = String(C * (1 - Number(fill.dataset.ratio)));
    }
    const num = $('[data-count]', card);
    if (num) countUp(num);
  }), { threshold: 0.3 });
  $$('.stat').forEach((s) => {
    const fill = $('.fill', s);
    if (fill) {
      fill.style.strokeDashoffset = fill.getAttribute('stroke-dasharray');
    }
    statsIO.observe(s);
  });

  /* ---------- Referral calculator ---------- */
  const ref = { joined: 2, days: 20, upgraded: 3 };
  const REF_MAX = { joined: 20, days: 30, upgraded: 10 };
  const refTotal = $('#refTotal');
  const renderRef = () => {
    $$('[data-ref-out]').forEach((o) => { o.textContent = ref[o.dataset.refOut]; });
    const total = ref.joined * 45 + ref.days * 1 + ref.upgraded * 15;
    refTotal.textContent = `+${total}`;
    $('#refBar').style.width = `${Math.min(100, (total / 60) * 100)}%`;
    $('#refHour').textContent = total >= 60 ? 'You reached 1 free hour.' : `${60 - total} minutes to 1 free hour.`;
  };
  $$('[data-ref]').forEach((btn) => btn.addEventListener('click', () => {
    const key = btn.dataset.ref;
    const next = ref[key] + Number(btn.dataset.delta);
    ref[key] = Math.min(REF_MAX[key], Math.max(0, next));
    renderRef();
  }));
  if (refTotal) renderRef();
  const copyBtn = $('#refCopy');
  if (copyBtn) copyBtn.addEventListener('click', () => {
    const link = 'https://askpico.app/?ref=YOURCODE';
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => toast('Invite link copied'), () => toast('Copy failed, copy it manually'));
    else toast('Copy failed, copy it manually');
  });

  /* ---------- Pricing: voice slider recommendation ---------- */
  const slider = $('#voiceSlider');
  const voiceOut = $('#voiceOut');
  const voiceRec = $('#voiceRec');
  const plans = $$('.plan');
  const paintSlider = () => {
    const v = Number(slider.value);
    const pct = ((v - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty('--p', `${pct}%`);
    voiceOut.textContent = `${v} min / day`;
    const pro = v > 30;
    voiceRec.textContent = pro ? 'PICO Pro fits you: 2 hrs of voice per day.' : 'Starter fits you: 30 min of voice per day, free.';
    plans.forEach((p) => p.classList.toggle('is-best', p.dataset.plan === (pro ? 'pro' : 'starter')));
  };
  if (slider) { slider.addEventListener('input', paintSlider); paintSlider(); }

  /* ---------- Layers: scroll-spy split ---------- */
  const steps = $$('.layer-step');
  const views = $$('.layer-view');
  const rail = $('#railFill');
  const setLayer = (i) => {
    steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    views.forEach((v, k) => v.classList.toggle('is-on', k === i));
    if (rail) rail.style.setProperty('--fill', `${((i + 1) / steps.length) * 100}%`);
  };
  if (steps.length) {
    const lio = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) setLayer(steps.indexOf(e.target));
    }), { rootMargin: '-40% 0px -40% 0px' });
    steps.forEach((s) => lio.observe(s));
    setLayer(0);
  }

  const moods = $$('#charMoods button');
  const char = $('#char');
  const MOOD_TEXT = {
    neutral: 'Okay, bataiye. Main sun raha hoon.',
    happy: 'Wah! Ye to zabardast khabar hai.',
    thinking: 'Hmm, ruko, is par sochta hoon.',
    concerned: 'Lagta hai aap thak gaye hain. Chalo, aasan karte hain.'
  };
  moods.forEach((b) => b.addEventListener('click', () => {
    moods.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    char.dataset.mood = b.dataset.mood;
    $('#charText').textContent = MOOD_TEXT[b.dataset.mood];
  }));

  /* ---------- Solutions: persona tabs + prompt demos ---------- */
  const personaTabs = $$('[data-persona]');
  const panels = $$('[data-panel]');
  const showPersona = (key) => {
    const panel = panels.find((p) => p.dataset.panel === key);
    if (!panel) return;
    personaTabs.forEach((t) => { t.setAttribute('aria-selected', String(t.dataset.persona === key)); t.tabIndex = t.dataset.persona === key ? 0 : -1; });
    panels.forEach((p) => { p.hidden = p !== panel; });
    const first = $$('.chat-mock__chips button', panel)[0];
    if (first) selectPrompt(panel, first);
  };
  const selectPrompt = (panel, btn) => {
    $$('.chat-mock__chips button', panel).forEach((b) => { b.classList.toggle('is-on', b === btn); b.setAttribute('aria-pressed', String(b === btn)); });
    const reply = $('.chat-mock__reply', panel);
    reply.classList.add('fade-swap', 'is-out');
    setTimeout(() => {
      reply.textContent = btn.dataset.reply;
      reply.dir = btn.dataset.dir || 'ltr';
      reply.lang = btn.dataset.lang || 'en';
      reply.classList.remove('is-out');
    }, 220);
  };
  personaTabs.forEach((t) => t.addEventListener('click', () => showPersona(t.dataset.persona)));
  const tablist = $('[role="tablist"]');
  if (tablist) tablist.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    const i = personaTabs.indexOf(document.activeElement);
    const next = personaTabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + personaTabs.length) % personaTabs.length];
    next.focus();
    showPersona(next.dataset.persona);
  });
  $$('.chat-mock__chips').forEach((group) => group.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn) selectPrompt(btn.closest('[data-panel]'), btn);
  }));

  /* ---------- FAQ accordion (single open) ---------- */
  const accItems = $$('.acc__item');
  accItems.forEach((item) => {
    const btn = $('.acc__btn', item);
    btn.addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      accItems.forEach((other) => {
        other.classList.remove('is-open');
        $('.acc__btn', other).setAttribute('aria-expanded', 'false');
      });
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  const copyEmail = $('#copyEmail');
  if (copyEmail) copyEmail.addEventListener('click', () => {
    const mail = copyEmail.dataset.copy;
    if (navigator.clipboard) navigator.clipboard.writeText(mail).then(() => toast('Email copied'), () => toast(mail));
    else toast(mail);
  });

  /* ---------- Smooth anchor scrolling with header offset ---------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href') === '#') return;
    const target = document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - (hdr ? hdr.offsetHeight : 0) + 1;
    window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
  });
})();
