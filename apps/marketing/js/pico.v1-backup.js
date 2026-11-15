/* ==========================================================================
   PICO landing page (index.html)
   All interactions: theme, language, command palette, sheet, reveal,
   count-ups, voice gauge, referral calculator, pricing slider, hero demo,
   workspace, router, persona switcher, principles switches, chat FAQ.
   ========================================================================== */
(() => {
  'use strict';

  /* ----- Helpers ----- */
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  root.classList.add('js');

  /* Animate a number from one value to another */
  const tween = (from, to, duration, onUpdate) => {
    if (reduceMotion) {
      onUpdate(to);
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      onUpdate(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /* ----- Toast ----- */
  const toast = $('#toast');
  let toastTimer = null;
  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
  };

  /* ----- Theme (localStorage, falls back to system preference) ----- */
  const THEME_KEY = 'pico-theme';
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const readTheme = () => {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (err) {
      return null;
    }
  };
  const applyTheme = (mode) => {
    root.dataset.theme = mode;
    const next = mode === 'dark' ? 'light' : 'dark';
    $$('[data-theme-toggle]').forEach((btn) => btn.setAttribute('aria-label', `Switch to ${next} mode`));
  };
  applyTheme(readTheme() || (systemDark.matches ? 'dark' : 'light'));

  $$('[data-theme-toggle]').forEach((btn) => btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (err) {
      /* Storage unavailable: the toggle still works for this visit. */
    }
    applyTheme(next);
  }));

  systemDark.addEventListener('change', (e) => {
    if (!readTheme()) applyTheme(e.matches ? 'dark' : 'light');
  });

  /* ----- Language (UI strings and hero demo) ----- */
  const I18N = {
    en: {
      searchPlaceholder: 'Ask PICO anything…',
      heroTitleA: 'Say it your way.',
      heroTitleB: 'PICO gets it done.',
      heroLede: 'PICO is a voice-first AI workspace. Talk or type in Urdu, Hindi, Roman Urdu or English, and get a finished answer, a canvas, or a live preview.',
      getStarted: 'Get started free',
      signIn: 'Sign in',
      download: 'Download',
      tapToTalk: 'Tap to talk',
    },
    ur: {
      searchPlaceholder: 'PICO سے کچھ بھی پوچھیں…',
      heroTitleA: 'اپنے انداز میں بولیں۔',
      heroTitleB: 'PICO کام کر دیتا ہے۔',
      heroLede: 'PICO ایک آواز سے چلنے والا AI ورک اسپیس ہے۔ اردو، ہندی، رومن اردو یا انگریزی میں بولیں یا لکھیں، اور مکمل جواب، کینوس یا لائیو پریویو پائیں۔',
      getStarted: 'مفت شروع کریں',
      signIn: 'سائن ان',
      download: 'ڈاؤن لوڈ',
      tapToTalk: 'بولنے کے لیے ٹیپ کریں',
    },
    hi: {
      searchPlaceholder: 'PICO से कुछ भी पूछें…',
      heroTitleA: 'अपने अंदाज़ में बोलें।',
      heroTitleB: 'PICO काम कर देता है।',
      heroLede: 'PICO एक आवाज़-पहला AI वर्कस्पेस है। उर्दू, हिंदी, रोमन उर्दू या अंग्रेज़ी में बोलें या लिखें, और पूरा जवाब, कैनवस या लाइव प्रिव्यू पाएं।',
      getStarted: 'मुफ़्त में शुरू करें',
      signIn: 'साइन इन',
      download: 'डाउनलोड',
      tapToTalk: 'बोलने के लिए टैप करें',
    },
  };

  const DEMO = {
    en: {
      transcript: 'PICO, mere liye ek chhoti si portfolio website bana do.',
      routing: 'Routing to Builder agent…',
      listening: 'Listening…',
    },
    ur: {
      transcript: 'PICO، میرے لیے ایک چھوٹی سی پورٹ فولیو ویب سائٹ بنا دو۔',
      routing: 'بلڈر ایجنٹ کی طرف بھیجا جا رہا ہے…',
      listening: 'سن رہا ہوں…',
    },
    hi: {
      transcript: 'PICO, मेरे लिए एक छोटी सी पोर्टफोलियो वेबसाइट बना दो।',
      routing: 'बिल्डर एजेंट को भेजा जा रहा है…',
      listening: 'सुन रहा हूँ…',
    },
  };

  const LANG_ORDER = ['en', 'ur', 'hi'];
  const heroCopy = $('.hero__copy');
  const voiceOrb = $('#voice-orb');
  const voiceLabel = $('#voice-label');
  const waveform = $('.waveform');
  let lang = 'en';
  let listening = false;

  const setVoiceLabel = () => {
    voiceLabel.textContent = listening ? DEMO[lang].listening : I18N[lang].tapToTalk;
  };

  const applyLang = () => {
    const dict = I18N[lang];
    $$('[data-i18n]').forEach((el) => {
      el.textContent = dict[el.dataset.i18n];
    });
    $$('[data-lang]').forEach((btn) => {
      const on = btn.dataset.lang === lang;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    heroCopy.lang = lang;
    heroCopy.dir = lang === 'ur' ? 'rtl' : 'ltr';
    setVoiceLabel();
  };

  const setLang = (next) => {
    lang = next;
    applyLang();
    runDemo();
  };

  $$('[data-lang]').forEach((btn) => btn.addEventListener('click', () => setLang(btn.dataset.lang)));

  /* ----- Mobile bottom sheet ----- */
  const sheet = $('#sheet');
  const sheetBtn = $('[data-sheet-toggle]');

  const openSheet = () => {
    sheet.hidden = false;
    sheetBtn.setAttribute('aria-expanded', 'true');
    sheetBtn.setAttribute('aria-label', 'Close menu');
    document.body.style.overflow = 'hidden';
    $('a', sheet).focus();
  };

  const closeSheet = (restoreFocus = true) => {
    if (sheet.hidden) return;
    sheet.hidden = true;
    sheetBtn.setAttribute('aria-expanded', 'false');
    sheetBtn.setAttribute('aria-label', 'Open menu');
    document.body.style.overflow = '';
    if (restoreFocus) sheetBtn.focus();
  };

  sheetBtn.addEventListener('click', () => {
    if (sheet.hidden) {
      openSheet();
    } else {
      closeSheet();
    }
  });

  sheet.addEventListener('click', (e) => {
    if (e.target === sheet || e.target.closest('a')) closeSheet(false);
  });

  sheet.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusables = $$('a, button', sheet);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  window.matchMedia('(min-width: 901px)').addEventListener('change', (e) => {
    if (e.matches) closeSheet(false);
  });

  /* ----- Command palette (Ctrl/⌘+K, filter, arrows, Enter, Esc, focus trap) ----- */
  const palette = $('#palette');
  const paletteInput = $('#palette-input');
  const paletteItems = $$('.palette__item');
  const paletteEmpty = $('#palette-empty');
  let paletteOpener = null;
  let activeIdx = 0;

  const visibleItems = () => paletteItems.filter((li) => !li.hidden);

  const setActive = (idx) => {
    const items = visibleItems();
    if (!items.length) {
      paletteInput.removeAttribute('aria-activedescendant');
      return;
    }
    activeIdx = (idx + items.length) % items.length;
    items.forEach((li, i) => li.setAttribute('aria-selected', String(i === activeIdx)));
    paletteInput.setAttribute('aria-activedescendant', items[activeIdx].id);
    items[activeIdx].scrollIntoView({ block: 'nearest' });
  };

  const filterPalette = (query) => {
    const q = query.trim().toLowerCase();
    paletteItems.forEach((li) => {
      li.hidden = !li.textContent.toLowerCase().includes(q);
    });
    paletteEmpty.hidden = visibleItems().length > 0;
    setActive(0);
  };

  const openPalette = () => {
    paletteOpener = document.activeElement;
    palette.hidden = false;
    paletteInput.value = '';
    filterPalette('');
    paletteInput.focus();
  };

  const closePalette = () => {
    if (palette.hidden) return;
    palette.hidden = true;
    if (paletteOpener) paletteOpener.focus();
  };

  const goTo = (href) => {
    palette.hidden = true;
    closeSheet(false);
    location.hash = href;
  };

  paletteInput.addEventListener('input', () => filterPalette(paletteInput.value));

  paletteInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(activeIdx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(activeIdx - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = visibleItems()[activeIdx];
      if (item) goTo(item.dataset.href);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    } else if (e.key === 'Tab') {
      e.preventDefault();
    }
  });

  paletteItems.forEach((li) => li.addEventListener('click', () => goTo(li.dataset.href)));
  palette.addEventListener('click', (e) => {
    if (e.target === palette) closePalette();
  });

  $$('[data-open-palette]').forEach((btn) => btn.addEventListener('click', () => {
    closeSheet(false);
    openPalette();
  }));

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (palette.hidden) {
        openPalette();
      } else {
        closePalette();
      }
    } else if (e.key === 'Escape' && !sheet.hidden) {
      closeSheet();
    }
  });

  /* ----- Reveal on scroll (IntersectionObserver, 70ms stagger) ----- */
  const observeOnce = (targets, onEnter, options) => {
    if (!('IntersectionObserver' in window)) {
      targets.forEach(onEnter);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        onEnter(entry.target);
        io.unobserve(entry.target);
      });
    }, options);
    targets.forEach((target) => io.observe(target));
  };

  const revealTargets = $$('.section-head, .settings, .qa, .ws, .slider-card, .cta__inner > *, .about__copy');
  const staggerCounts = new Map();
  revealTargets.forEach((el) => {
    const parent = el.parentElement;
    const index = staggerCounts.get(parent) || 0;
    el.style.setProperty('--d', String(index));
    staggerCounts.set(parent, index + 1);
    el.classList.add('reveal');
  });

  /* ----- Count-up numbers (ring gauges) ----- */
  const countUp = (el) => {
    const target = Number(el.dataset.count);
    tween(0, target, 1400, (v) => {
      el.textContent = String(Math.round(v));
    });
  };

  const ringItems = $$('.ring-item');
  const onRingVisible = (item) => {
    item.classList.add('is-visible');
    const num = $('[data-count]', item);
    if (num) countUp(num);
  };

  /* ----- Voice-time gauge (free / pro) ----- */
  const gaugeValue = $('#gauge-value');
  const gaugeNum = $('#gauge-num');
  const gaugeCaption = $('#gauge-caption');
  let gaugeShown = 0;

  const setGauge = (plan) => {
    const pro = plan === 'pro';
    const minutes = pro ? 120 : 30;
    gaugeValue.style.strokeDashoffset = String(100 - (pro ? 100 : 25));
    gaugeCaption.textContent = pro ? 'Pro: 2 hours of voice a day.' : 'Free: 30 minutes of voice a day.';
    const from = gaugeShown;
    gaugeShown = minutes;
    tween(from, minutes, 900, (v) => {
      gaugeNum.textContent = String(Math.round(v));
    });
    $$('.gauge-card [data-plan]').forEach((btn) => {
      const on = btn.dataset.plan === plan;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
  };

  $$('.gauge-card [data-plan]').forEach((btn) => btn.addEventListener('click', () => setGauge(btn.dataset.plan)));

  /* ----- Referral calculator ----- */
  const refInputs = {
    joins: $('#ref-joins'),
    days: $('#ref-days'),
    upgrades: $('#ref-upgrades'),
  };
  const refOutputs = {
    joins: $('#out-joins'),
    days: $('#out-days'),
    upgrades: $('#out-upgrades'),
  };
  const refTotal = $('#ref-total');
  let refShown = 160;
  const INVITE_LINK = 'https://askpico.app/invite/placeholder-link';

  const updateReferral = () => {
    const joins = Number(refInputs.joins.value);
    const days = Number(refInputs.days.value);
    const upgrades = Number(refInputs.upgrades.value);
    refOutputs.joins.textContent = String(joins);
    refOutputs.days.textContent = String(days);
    refOutputs.upgrades.textContent = String(upgrades);

    const total = joins * 45 + days * 1 + upgrades * 15;
    const from = refShown;
    refShown = total;
    tween(from, total, 400, (v) => {
      refTotal.textContent = String(Math.round(v));
    });
    refTotal.classList.remove('is-bump');
    void refTotal.offsetWidth;
    refTotal.classList.add('is-bump');
  };

  Object.values(refInputs).forEach((input) => input.addEventListener('input', updateReferral));

  $('[data-copy-invite]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(INVITE_LINK);
      showToast('Placeholder invite link copied');
    } catch (err) {
      showToast(`Copy blocked. Placeholder link: ${INVITE_LINK}`);
    }
  });

  /* ----- Pricing slider: recommends Starter (≤30 min) or Pro (>30 min) ----- */
  const talkRange = $('#talk-range');
  const talkOut = $('#talk-out');
  const talkNote = $('#talk-note');
  const planStarter = $('#plan-starter');
  const planPro = $('#plan-pro');

  const formatMinutes = (m) => {
    if (m < 60) return `${m} min a day`;
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return `${h} hr${h > 1 ? 's' : ''}${rest ? ` ${rest} min` : ''} a day`;
  };

  const updatePricing = () => {
    const minutes = Number(talkRange.value);
    const pro = minutes > 30;
    talkOut.textContent = formatMinutes(minutes);
    planStarter.classList.toggle('is-recommended', !pro);
    planPro.classList.toggle('is-recommended', pro);
    $('.tag', planStarter).hidden = pro;
    $('.tag', planPro).hidden = !pro;
    talkNote.textContent = pro
      ? 'More than 30 minutes a day fits PICO Pro. Billed in PKR.'
      : 'Up to 30 minutes a day fits Starter. Billed in PKR.';
  };

  talkRange.addEventListener('input', updatePricing);
  updatePricing();

  /* ----- Init: reveal, rings, gauge ----- */
  if (reduceMotion) {
    revealTargets.forEach((el) => el.classList.add('is-visible'));
    ringItems.forEach((item) => item.classList.add('is-visible'));
  } else {
    observeOnce(revealTargets, (el) => el.classList.add('is-visible'), { threshold: 0.15 });
    observeOnce(ringItems, onRingVisible, { threshold: 0.3 });
  }

  setGauge('free');

  /* ----- Shared: element builder, typing, keyboard tablists ----- */
  const pace = (ms) => (reduceMotion ? 0 : ms);

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const typeText = async (node, text, speed, isCurrent) => {
    for (let i = 1; i <= text.length; i += 1) {
      if (!isCurrent()) return false;
      node.textContent = text.slice(0, i);
      await sleep(pace(speed));
    }
    return isCurrent();
  };

  const bindTablist = (tabs, select) => {
    tabs.forEach((tab, i) => tab.addEventListener('keydown', (e) => {
      let next = null;
      if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      tabs[next].focus();
      select(tabs[next]);
    }));
  };

  /* ----- Hero demo: scripted voice + chat loop ----- */
  const chatLog = $('#chat-log');
  const ANSWER_TEXT = 'Done. A one-page portfolio with your intro, three projects and a contact form. Want a dark version too?';
  let demoRun = 0;

  const addRow = (cls = '') => {
    const row = el('div', `msg-row${cls ? ` ${cls}` : ''}`);
    chatLog.append(row);
    return row;
  };

  const buildVoiceBubble = (l) => {
    const bubble = el('div', 'voice-bubble');
    const wave = el('span', 'mini-wave');
    wave.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 5; i += 1) wave.append(el('span'));
    const text = el('p', 'voice-bubble__text');
    text.lang = l;
    text.dir = l === 'ur' ? 'rtl' : 'ltr';
    bubble.append(wave, text);
    return { bubble, text };
  };

  const buildPreviewCard = () => {
    const card = el('div', 'preview-card');
    card.append(el('span', 'preview-card__label mono', 'Live preview · portfolio'));
    const page = el('div', 'browser__page is-building');
    const hero = el('div', 'mini-hero');
    hero.append(el('span', 'mini-hero__title', 'Ayesha Khan'), el('span', 'mini-hero__btn', 'Contact'));
    const cards = el('div', 'mini-cards');
    cards.append(el('span'), el('span'), el('span'));
    page.append(hero, cards);
    card.append(page);
    return card;
  };

  const runDemo = async () => {
    demoRun += 1;
    const run = demoRun;
    const isCurrent = () => run === demoRun;
    const dict = DEMO[lang];

    do {
      chatLog.replaceChildren();

      const userRow = addRow('msg-row--user');
      const { bubble, text } = buildVoiceBubble(lang);
      userRow.append(bubble);
      await sleep(pace(400));
      if (!(await typeText(text, dict.transcript, 38, isCurrent))) return;
      await sleep(pace(450));
      if (!isCurrent()) return;

      const chip = el('span', 'router-chip');
      chip.lang = lang;
      chip.append(el('span', 'dot'), dict.routing);
      const chipRow = addRow();
      chipRow.append(chip);
      await sleep(pace(1400));
      if (!isCurrent()) return;
      chipRow.remove();

      const answerRow = addRow();
      const answer = el('div', 'bubble bubble--pico');
      const answerText = el('p');
      answer.append(answerText);
      answerRow.append(answer);
      if (!(await typeText(answerText, ANSWER_TEXT, 16, isCurrent))) return;
      await sleep(pace(350));
      if (!isCurrent()) return;

      addRow().append(buildPreviewCard());
      await sleep(pace(6500));
    } while (!reduceMotion && isCurrent());
  };

  /* ----- Voice orb: toggles listening, cycles demo language ----- */
  voiceOrb.addEventListener('click', () => {
    listening = !listening;
    voiceOrb.setAttribute('aria-pressed', String(listening));
    voiceOrb.setAttribute('aria-label', listening ? 'Stop listening' : 'Start talking to PICO');
    waveform.classList.toggle('is-live', listening);
    if (listening) {
      lang = LANG_ORDER[(LANG_ORDER.indexOf(lang) + 1) % LANG_ORDER.length];
      applyLang();
      runDemo();
    } else {
      setVoiceLabel();
    }
  });

  /* ----- Workspace simulator: tabs, draggable divider, draggable notes, artifact toggle ----- */
  const wsTabs = $$('.ws__tab');

  const showWsPanel = (name) => {
    wsTabs.forEach((tab) => {
      const on = tab.id === `tab-${name}`;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    $$('.ws__panel').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== name;
    });
  };

  wsTabs.forEach((tab) => tab.addEventListener('click', () => showWsPanel(tab.id.replace('tab-', ''))));
  bindTablist(wsTabs, (tab) => showWsPanel(tab.id.replace('tab-', '')));

  const divider = $('#ws-divider');
  const panes = $('#ws-panes');

  const setSplit = (pct) => {
    const value = Math.max(25, Math.min(60, Math.round(pct)));
    panes.style.setProperty('--split', `${value}%`);
    divider.setAttribute('aria-valuenow', String(value));
  };

  divider.addEventListener('pointerdown', (e) => {
    divider.setPointerCapture(e.pointerId);
  });

  divider.addEventListener('pointermove', (e) => {
    if (!divider.hasPointerCapture(e.pointerId)) return;
    const rect = panes.getBoundingClientRect();
    setSplit(((e.clientX - rect.left) / rect.width) * 100);
  });

  divider.addEventListener('keydown', (e) => {
    const current = Number(divider.getAttribute('aria-valuenow'));
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSplit(current - 2);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSplit(current + 2);
    }
  });

  const board = $('#canvas-board');
  $$('.note', board).forEach((note) => {
    let drag = null;

    const stop = () => {
      drag = null;
      note.classList.remove('is-dragging');
    };

    note.addEventListener('pointerdown', (e) => {
      const b = board.getBoundingClientRect();
      const n = note.getBoundingClientRect();
      drag = { offsetX: e.clientX - n.left, offsetY: e.clientY - n.top, width: b.width, height: b.height, left: b.left, top: b.top };
      note.setPointerCapture(e.pointerId);
      note.classList.add('is-dragging');
    });

    note.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const x = Math.max(0, Math.min(drag.width - note.offsetWidth, e.clientX - drag.left - drag.offsetX));
      const y = Math.max(0, Math.min(drag.height - note.offsetHeight, e.clientY - drag.top - drag.offsetY));
      note.style.setProperty('--x', `${(x / drag.width) * 100}%`);
      note.style.setProperty('--y', `${(y / drag.height) * 100}%`);
    });

    note.addEventListener('pointerup', stop);
    note.addEventListener('pointercancel', stop);
  });

  const artifactBtns = $$('[data-artifact-view]');
  artifactBtns.forEach((btn) => btn.addEventListener('click', () => {
    const view = btn.dataset.artifactView;
    artifactBtns.forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    $$('.artifact__view').forEach((node) => {
      node.hidden = node.dataset.view !== view;
    });
  }));

  /* ----- Agent router: hover highlight, tooltip, auto pulse ----- */
  const diagram = $('#router-diagram');
  const tip = $('#router-tip');
  const agents = $$('.agent', diagram);
  const AGENT_NAMES = agents.map((agent) => agent.dataset.agent);
  let routerPaused = false;
  let pulseIdx = 0;

  const setAgentHot = (name, on) => {
    $$(`[data-agent="${name}"]`, diagram).forEach((node) => node.classList.toggle('is-hot', on));
  };

  const showTip = (agent) => {
    const d = diagram.getBoundingClientRect();
    const r = agent.getBoundingClientRect();
    tip.textContent = agent.dataset.tip;
    tip.hidden = false;
    tip.style.left = `${Math.max(0, Math.min(r.left - d.left, d.width - 250))}px`;
    tip.style.top = `${r.bottom - d.top + 10}px`;
  };

  agents.forEach((agent) => {
    const name = agent.dataset.agent;
    const enter = () => {
      routerPaused = true;
      setAgentHot(name, true);
      showTip(agent);
    };
    const leave = () => {
      routerPaused = false;
      setAgentHot(name, false);
      tip.hidden = true;
    };
    agent.addEventListener('mouseenter', enter);
    agent.addEventListener('mouseleave', leave);
    agent.addEventListener('focus', enter);
    agent.addEventListener('blur', leave);
  });

  const pulseRouter = () => {
    const name = AGENT_NAMES[pulseIdx % AGENT_NAMES.length];
    pulseIdx += 1;
    const paths = $$(`.route[data-agent="${name}"]`, diagram);
    paths.forEach((p) => p.classList.add('is-pulse'));
    setTimeout(() => paths.forEach((p) => p.classList.remove('is-pulse')), 1100);
  };

  if (!reduceMotion) {
    setInterval(() => {
      if (!routerPaused) pulseRouter();
    }, 4000);
  }

  /* ----- Companion character: expressions cycle ----- */
  const avatar = $('#character-avatar');
  const characterLine = $('#character-line');
  const MOODS = [
    { cls: 'is-happy', text: 'Ji, batayein. Kya banana hai?' },
    { cls: 'is-thinking', text: 'Hmm, ek second. Layout soch rahi hoon.' },
    { cls: 'is-wink', text: 'Done! Preview dekh lijiye.' },
  ];
  let moodIdx = 0;

  const setMood = (idx) => {
    MOODS.forEach((m) => avatar.classList.remove(m.cls));
    avatar.classList.add(MOODS[idx].cls);
    characterLine.textContent = MOODS[idx].text;
  };

  if (!reduceMotion) {
    setInterval(() => {
      moodIdx = (moodIdx + 1) % MOODS.length;
      setMood(moodIdx);
    }, 3200);
  }

  /* ----- Persona switcher: tabs and prompt demos ----- */
  const PERSONAS = {
    everyday: {
      title: 'Everyday users',
      bullets: ['Ask in Urdu, Hindi or Roman Urdu', 'Get answers you can use right away', 'Keep daily tasks in one place'],
      prompts: [
        { label: 'Bijli ka bill samjhao', kind: 'Answer', reply: 'Your bill has three parts: units used, fixed charges and taxes. Multiply units by the slab rate, add the fixed charge, then check the tax line. Send me the bill and I will walk through each number.' },
        { label: 'Doctor ke liye Urdu mein message likho', kind: 'Answer', reply: 'Here is a short note: "Assalamu alaikum Doctor sahab, mujhe teen din se bukhar aur kamzori hai. Kya main kal aa sakta hoon? Shukriya."' },
        { label: 'Aaj ka weekly budget banao', kind: 'Canvas', reply: 'Canvas ready: three columns for fixed bills, daily spending and savings. Drag the cards to move money between them.' },
      ],
    },
    creators: {
      title: 'Creators',
      bullets: ['Scripts that match your voice', 'Plan posts on a visual canvas', 'Turn a link into a shareable page'],
      prompts: [
        { label: 'Reel ka 30-second script likho', kind: 'Answer', reply: 'Hook: Kya aap bhi roz ek hi galti karte hain? Then show the mistake in 5 seconds, explain the fix in 15, and end with a question that invites comments.' },
        { label: 'Carousel ke 5 slides plan karo', kind: 'Canvas', reply: 'Canvas ready: five cards, one idea each, with a headline and a visual note on every slide.' },
        { label: 'Mera link-in-bio page banao', kind: 'Preview', reply: 'Preview built: a profile header, three link buttons and a contact button. Switch to Code to edit it by hand.' },
      ],
    },
    builders: {
      title: 'Builders',
      bullets: ['Code and previews side by side', 'Errors explained in plain language', 'Boards and flows on one canvas'],
      prompts: [
        { label: 'Login page ka code do', kind: 'Preview', reply: 'Preview built: email, password and a sign-in button with validation messages. Switch to Code to copy the markup.' },
        { label: 'API error ka fix batao', kind: 'Answer', reply: 'A 401 means the request has no valid token. Check the Authorization header, confirm the token has not expired, and refresh it before retrying.' },
        { label: 'Kanban board ka canvas banao', kind: 'Canvas', reply: 'Canvas ready: To do, Doing and Done columns with draggable task notes.' },
      ],
    },
  };

  const personaTabs = $$('.segmented--wide [role="tab"]');
  const personaPanel = $('#persona-panel');
  const personaTitle = $('#persona-title');
  const personaBullets = $('#persona-bullets');
  const promptList = $('#prompt-list');
  const replyChip = $('#reply-chip');
  const replyText = $('#reply-text');
  let replyRun = 0;

  const playReply = async (key, idx, btn) => {
    const prompt = PERSONAS[key].prompts[idx];
    $$('.prompt-btn', promptList).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    replyRun += 1;
    const run = replyRun;
    replyChip.textContent = prompt.kind;
    replyChip.hidden = false;
    replyText.textContent = '';
    await typeText(replyText, prompt.reply, 14, () => run === replyRun);
  };

  const renderPersona = (key, tab) => {
    personaTabs.forEach((t) => {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    personaPanel.setAttribute('aria-labelledby', tab.id);

    const data = PERSONAS[key];
    personaTitle.textContent = data.title;
    personaBullets.replaceChildren(...data.bullets.map((text) => el('li', '', text)));
    promptList.replaceChildren(...data.prompts.map((prompt, idx) => {
      const btn = el('button', 'prompt-btn', prompt.label);
      btn.type = 'button';
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => playReply(key, idx, btn));
      return btn;
    }));
    replyChip.hidden = true;
    replyText.textContent = 'Tap a prompt to see PICO answer it.';
  };

  personaTabs.forEach((tab) => tab.addEventListener('click', () => renderPersona(tab.id.replace('tab-', ''), tab)));
  bindTablist(personaTabs, (tab) => renderPersona(tab.id.replace('tab-', ''), tab));

  /* ----- Principles: illustrative privacy-settings switches ----- */
  const PRIVACY_COPY = {
    on: 'On: sessions are saved only while you keep them, and you can delete them any time.',
    off: 'Off: sessions stay on this device and clear when you close the tab.',
  };
  const privacyExplain = $('#privacy-explain');

  $$('[data-switch]').forEach((sw) => sw.addEventListener('click', () => {
    const next = sw.getAttribute('aria-checked') !== 'true';
    sw.setAttribute('aria-checked', String(next));
    if (sw.dataset.switch === 'privacy') {
      privacyExplain.textContent = next ? PRIVACY_COPY.on : PRIVACY_COPY.off;
    }
  }));

  /* ----- Chat FAQ: single-open bubbles with typing indicator ----- */
  const ANSWERS = [
    'PICO is a voice-first AI workspace. Chat, canvas and live artifacts share one context, so the thread never gets lost. It understands Urdu, Hindi, Roman Urdu and English.',
    'Yes. Starter is free to start during beta, with 30 minutes of voice a day. Sign up when you want your conversations to sync across devices.',
    'Free includes 30 minutes of voice a day. Pro includes 2 hours a day. Use the voice meter above to compare the two.',
    'Each friend who joins adds 45 voice minutes. Each active day adds 1 minute. Each friend who upgrades to Pro adds 15 minutes. The calculator above shows your total.',
    'Plans are priced in PKR. Starter is PKR 0 forever. PICO Pro is PKR 1,499 a month. Choose a plan in the Pricing section and continue from there.',
    'PICO understands Urdu, Hindi, Roman Urdu and English, and can switch between them within one conversation.',
  ];
  const PAY_INDEX = 4;
  const qaButtons = $$('.qa > .bubble--user');
  let qaRun = 0;
  let openIdx = -1;

  const closeQA = () => {
    qaRun += 1;
    openIdx = -1;
    qaButtons.forEach((btn) => {
      btn.setAttribute('aria-expanded', 'false');
      const answer = document.getElementById(btn.getAttribute('aria-controls'));
      answer.hidden = true;
      answer.replaceChildren();
    });
  };

  const openQA = async (idx) => {
    closeQA();
    const run = qaRun;
    openIdx = idx;
    const btn = qaButtons[idx];
    const answer = document.getElementById(btn.getAttribute('aria-controls'));
    btn.setAttribute('aria-expanded', 'true');
    answer.hidden = false;

    const typing = el('div', 'typing-wrap');
    const dots = el('span', 'typing-dots');
    for (let i = 0; i < 3; i += 1) dots.append(el('span'));
    typing.append(dots);
    answer.append(typing);

    await sleep(pace(600));
    if (run !== qaRun) return;
    typing.remove();

    const bubble = el('div', 'bubble bubble--pico');
    const p = el('p');
    bubble.append(p);
    answer.append(bubble);
    await typeText(p, ANSWERS[idx], 16, () => run === qaRun);
  };

  qaButtons.forEach((btn, idx) => btn.addEventListener('click', () => {
    if (openIdx === idx) {
      closeQA();
    } else {
      openQA(idx);
    }
  }));

  $$('[data-open-faq="pay"]').forEach((link) => link.addEventListener('click', () => openQA(PAY_INDEX)));

  const askForm = $('#ask-form');
  const askReply = $('#ask-reply');

  askForm.addEventListener('submit', (e) => {
    e.preventDefault();
    askReply.replaceChildren();
    const bubble = el('div', 'bubble bubble--pico');
    const p = el('p', '', 'Email us at ');
    const mail = el('a', '', 'hello@askpico.app');
    mail.href = 'mailto:hello@askpico.app';
    p.append(mail, ' and a real person will reply.');
    bubble.append(p);
    askReply.append(bubble);
    askForm.reset();
  });

  /* ----- Footer ----- */
  $('[data-back-to-top]').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  $$('[data-year]').forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  /* ----- Start ----- */
  applyLang();
  runDemo();
  renderPersona('everyday', personaTabs[0]);
})();
