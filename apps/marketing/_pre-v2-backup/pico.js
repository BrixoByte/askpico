/* ==========================================================================
   PICO landing page (index.html): dark + lime
   Interactions: language chip, voice console, mobile menu, reveal,
   count-ups and meters, bento canvas, routing flow, referral steppers,
   pricing slider, sticky companion progress, persona tabs, principles
   accordion, FAQ accordion, toast.
   ========================================================================== */
(() => {
  'use strict';

  /* ----- Helpers ----- */
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDesktop = window.matchMedia('(min-width: 901px)');
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pace = (ms) => (reduceMotion ? 0 : ms);

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

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

  /* ----- Toast ----- */
  const toast = $('#toast');
  let toastTimer = null;
  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
  };

  /* ----- Reveal on scroll (70ms stagger per group) ----- */
  const revealTargets = $$('.section-head, .tile, .calc, .timeline__item, .voice-slider, .plan, .persona, .faq__intro, .acc__panel');
  const staggerCounts = new Map();
  revealTargets.forEach((node) => {
    const parent = node.parentElement;
    const index = staggerCounts.get(parent) || 0;
    node.style.setProperty('--d', String(index));
    staggerCounts.set(parent, index + 1);
    node.classList.add('reveal');
  });

  /* ----- Stats: count-up and meter fill ----- */
  const stats = $$('.stat');
  const onStatVisible = (stat) => {
    stat.classList.add('is-visible');
    const num = $('[data-count]', stat);
    if (num) {
      const target = Number(num.dataset.count);
      tween(0, target, 1400, (v) => {
        num.textContent = String(Math.round(v));
      });
    }
  };

  /* ----- Language chip: UI language and voice console prompts ----- */
  const LANGS = ['en', 'ur', 'hi'];
  const LANG_LABEL = { en: 'EN', ur: 'اردو', hi: 'हिन्दी' };
  const langButtons = $$('[data-lang-cycle]');
  let langIdx = 0;

  const paintLangButtons = () => {
    langButtons.forEach((btn) => {
      const label = $('.lang-chip__label', btn);
      label.textContent = LANG_LABEL[LANGS[langIdx]];
      label.lang = LANGS[langIdx];
      btn.setAttribute('aria-label', `Demo language: ${LANG_LABEL[LANGS[langIdx]]}. Change`);
    });
  };

  /* ----- Mobile menu ----- */
  const menuBtn = $('[data-menu-toggle]');
  const menu = $('#menu');

  const setMenu = (open) => {
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      $('a', menu).focus();
    } else {
      menuBtn.focus();
    }
  };

  menuBtn.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      menu.hidden = true;
      menuBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) setMenu(false);
  });
  isDesktop.addEventListener('change', (e) => {
    if (e.matches && !menu.hidden) setMenu(false);
  });

  /* ----- Voice console (hero) ----- */
  const consoleEl = $('.console');
  const orb = $('#orb');
  const consoleState = $('#console-state');
  const transcript = $('#transcript');
  const resultChip = $('#result-chip');
  const ring = $('#console-ring');

  const PROMPTS = [
    { lang: 'en', text: 'PICO, mere liye ek chhoti si portfolio website bana do.', result: 'Live preview' },
    { lang: 'ur', text: 'آج کے لیے ایک ہفتہ وار بجٹ کا کینوس بناؤ۔', result: 'Canvas' },
    { lang: 'hi', text: 'मेरे बिल का सारांश दो और जवाब लिखो।', result: 'Answer' },
  ];

  let promptIdx = 0;
  let consoleRun = 0;

  const showPrompt = async (idx) => {
    consoleRun += 1;
    const run = consoleRun;
    const isCurrent = () => run === consoleRun;
    const prompt = PROMPTS[idx];
    promptIdx = idx;

    transcript.lang = prompt.lang;
    transcript.dir = prompt.lang === 'ur' ? 'rtl' : 'ltr';
    resultChip.textContent = prompt.result;
    transcript.textContent = '';

    if (reduceMotion) {
      transcript.textContent = prompt.text;
      return;
    }

    for (let i = 1; i <= prompt.text.length; i += 1) {
      if (!isCurrent()) return;
      transcript.textContent = prompt.text.slice(0, i);
      await sleep(32);
    }

    await sleep(2600);
    if (!isCurrent()) return;
    showPrompt((idx + 1) % PROMPTS.length);
  };

  const setListening = (on) => {
    consoleEl.classList.toggle('is-live', on);
    orb.setAttribute('aria-pressed', String(on));
    orb.setAttribute('aria-label', on ? 'Stop listening' : 'Start listening');
    consoleState.textContent = on ? 'Listening…' : 'Idle';
  };

  orb.addEventListener('click', () => {
    const next = orb.getAttribute('aria-pressed') !== 'true';
    setListening(next);
    if (next) showPrompt((promptIdx + 1) % PROMPTS.length);
  });

  langButtons.forEach((btn) => btn.addEventListener('click', () => {
    langIdx = (langIdx + 1) % LANGS.length;
    paintLangButtons();
    const match = PROMPTS.findIndex((p) => p.lang === LANGS[langIdx]);
    showPrompt(match === -1 ? 0 : match);
  }));

  /* Ring of bars around the orb */
  const RING_BARS = 36;
  for (let i = 0; i < RING_BARS; i += 1) {
    const bar = el('span');
    bar.style.setProperty('--a', `${(360 / RING_BARS) * i}deg`);
    bar.style.setProperty('--d', `${((i * 83) % 97) / 100 - 1}s`);
    ring.append(bar);
  }

  /* ----- Bento canvas: draggable blocks ----- */
  const canvas = $('#canvas');
  $$('[data-block]', canvas).forEach((block) => {
    let drag = null;

    const stop = () => {
      drag = null;
      block.classList.remove('is-dragging');
    };

    block.addEventListener('pointerdown', (e) => {
      const c = canvas.getBoundingClientRect();
      const b = block.getBoundingClientRect();
      drag = { dx: e.clientX - b.left, dy: e.clientY - b.top, cl: c.left, ct: c.top, cw: c.width, ch: c.height };
      block.setPointerCapture(e.pointerId);
      block.classList.add('is-dragging');
    });

    block.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const x = Math.max(0, Math.min(drag.cw - block.offsetWidth, e.clientX - drag.cl - drag.dx));
      const y = Math.max(0, Math.min(drag.ch - block.offsetHeight, e.clientY - drag.ct - drag.dy));
      block.style.left = `${x}px`;
      block.style.top = `${y}px`;
    });

    block.addEventListener('pointerup', stop);
    block.addEventListener('pointercancel', stop);
  });

  /* ----- Routing flow: hover highlight, tooltip, auto pulse ----- */
  const flow = $('#flow');
  const flowTip = $('#flow-tip');
  const agentNodes = $$('.flow__agent', flow);
  const AGENT_NAMES = agentNodes.map((node) => node.dataset.agent);
  let flowPaused = false;
  let pulseIdx = 0;

  const setAgentHot = (name, on) => {
    $$(`[data-agent="${name}"]`, flow).forEach((node) => node.classList.toggle('is-hot', on));
  };

  const showFlowTip = (node) => {
    const f = flow.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    flowTip.textContent = node.dataset.tip;
    flowTip.hidden = false;
    flowTip.style.left = `${Math.max(0, Math.min(r.left - f.left, f.width - 270))}px`;
    flowTip.style.top = `${r.bottom - f.top + 10}px`;
  };

  agentNodes.forEach((node) => {
    const name = node.dataset.agent;
    const enter = () => {
      flowPaused = true;
      setAgentHot(name, true);
      showFlowTip(node);
    };
    const leave = () => {
      flowPaused = false;
      setAgentHot(name, false);
      flowTip.hidden = true;
    };
    node.addEventListener('mouseenter', enter);
    node.addEventListener('mouseleave', leave);
    node.addEventListener('focus', enter);
    node.addEventListener('blur', leave);
  });

  const pulseFlow = () => {
    const name = AGENT_NAMES[pulseIdx % AGENT_NAMES.length];
    pulseIdx += 1;
    setAgentHot(name, true);
    setTimeout(() => {
      if (!flowPaused) setAgentHot(name, false);
    }, 1400);
  };

  if (!reduceMotion) {
    setInterval(() => {
      if (!flowPaused && isDesktop.matches) pulseFlow();
    }, 4000);
  }

  /* ----- Referral calculator ----- */
  const LIMITS = { joins: [0, 20], days: [0, 30], upgrades: [0, 10] };
  const values = { joins: 3, days: 10, upgrades: 1 };
  const calcTotal = $('#calc-total');
  let shownTotal = 160;

  const renderCalc = () => {
    const total = values.joins * 45 + values.days * 1 + values.upgrades * 15;
    Object.keys(values).forEach((key) => {
      $(`#val-${key}`).textContent = String(values[key]);
    });
    const from = shownTotal;
    shownTotal = total;
    tween(from, total, 400, (v) => {
      calcTotal.textContent = String(Math.round(v));
    });
    calcTotal.classList.remove('is-bump');
    void calcTotal.offsetWidth;
    calcTotal.classList.add('is-bump');
  };

  $$('.stepper__btn').forEach((btn) => btn.addEventListener('click', () => {
    const key = btn.dataset.step;
    const [min, max] = LIMITS[key];
    values[key] = Math.max(min, Math.min(max, values[key] + Number(btn.dataset.delta)));
    renderCalc();
  }));

  $('[data-copy-invite]').addEventListener('click', async () => {
    const link = 'https://askpico.app/invite/placeholder-link';
    try {
      await navigator.clipboard.writeText(link);
      showToast('Placeholder invite link copied');
    } catch (err) {
      showToast(`Copy blocked. Placeholder link: ${link}`);
    }
  });

  $('[data-copy-email]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('hello@askpico.app');
      showToast('Email copied: hello@askpico.app');
    } catch (err) {
      showToast('Email: hello@askpico.app');
    }
  });

  /* ----- Pricing slider: recommends Starter (≤30 min) or Pro ----- */
  const talk = $('#talk');
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
    const minutes = Number(talk.value);
    const pro = minutes > 30;
    talkOut.textContent = formatMinutes(minutes);
    planStarter.classList.toggle('is-recommended', !pro);
    planPro.classList.toggle('is-recommended', pro);
    $('.plan__tag', planStarter).hidden = pro;
    $('.plan__tag', planPro).hidden = !pro;
    talkNote.textContent = pro
      ? 'More than 30 minutes fits PICO Pro. Billed in PKR.'
      : 'Up to 30 minutes fits Starter. Billed in PKR.';
  };

  talk.addEventListener('input', updatePricing);
  updatePricing();

  /* ----- Companion: sticky stack progress and character moods ----- */
  const cardStacks = $$('.card-stack');
  const progressItems = $$('.progress__item');

  const setProgress = (idx) => {
    progressItems.forEach((item, i) => item.classList.toggle('is-active', i === idx));
  };

  if ('IntersectionObserver' in window) {
    const stackObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setProgress(Number(entry.target.dataset.index));
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    cardStacks.forEach((card) => stackObserver.observe(card));
  }

  const face = $('#char-face');
  const charLine = $('#char-line');
  const MOODS = [
    { cls: 'is-happy', text: 'Ji, batayein. Kya banana hai?' },
    { cls: 'is-thinking', text: 'Hmm, ek second. Layout soch rahi hoon.' },
    { cls: 'is-wink', text: 'Done! Preview dekh lijiye.' },
  ];
  let moodIdx = 0;

  const setMood = (idx) => {
    MOODS.forEach((m) => face.classList.remove(m.cls));
    face.classList.add(MOODS[idx].cls);
    charLine.textContent = MOODS[idx].text;
  };

  if (!reduceMotion) {
    setInterval(() => {
      moodIdx = (moodIdx + 1) % MOODS.length;
      setMood(moodIdx);
    }, 3200);
  }

  /* ----- Solutions: persona tabs and prompt demos ----- */
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

  const personaTabs = $$('.tabs__tab');
  const personaPanel = $('#persona-panel');
  const personaTitle = $('#persona-title');
  const personaBullets = $('#persona-bullets');
  const promptsBox = $('#prompts');
  const replyChip = $('#reply-chip');
  const replyText = $('#reply-text');
  let replyRun = 0;

  const typeReply = async (text, run) => {
    for (let i = 1; i <= text.length; i += 1) {
      if (run !== replyRun) return;
      replyText.textContent = text.slice(0, i);
      await sleep(pace(14));
    }
  };

  const playReply = (key, idx, btn) => {
    const prompt = PERSONAS[key].prompts[idx];
    $$('.prompt', promptsBox).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    replyRun += 1;
    const run = replyRun;
    replyChip.textContent = prompt.kind;
    replyChip.hidden = false;
    replyText.textContent = '';
    typeReply(prompt.reply, run);
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
    promptsBox.replaceChildren(...data.prompts.map((prompt, idx) => {
      const btn = el('button', 'prompt', prompt.label);
      btn.type = 'button';
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => playReply(key, idx, btn));
      return btn;
    }));
    replyChip.hidden = true;
    replyText.textContent = 'Pick a prompt to see PICO answer it.';
  };

  personaTabs.forEach((tab) => {
    tab.addEventListener('click', () => renderPersona(tab.id.replace('tab-', ''), tab));
    tab.addEventListener('keydown', (e) => {
      const i = personaTabs.indexOf(tab);
      let next = null;
      if (e.key === 'ArrowRight') next = (i + 1) % personaTabs.length;
      else if (e.key === 'ArrowLeft') next = (i - 1 + personaTabs.length) % personaTabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = personaTabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      personaTabs[next].focus();
      renderPersona(personaTabs[next].id.replace('tab-', ''), personaTabs[next]);
    });
  });

  /* ----- Principles: expanding panels (click, focus, or hover on desktop) ----- */
  const accPanels = $$('.acc__panel');

  const openAcc = (panel) => {
    accPanels.forEach((p) => {
      const on = p === panel;
      p.classList.toggle('is-open', on);
      const btn = $('.acc__btn', p);
      const body = $('.acc__body', p);
      btn.setAttribute('aria-expanded', String(on));
      body.hidden = !on;
    });
  };

  accPanels.forEach((panel) => {
    const btn = $('.acc__btn', panel);
    btn.addEventListener('click', () => openAcc(panel));
    btn.addEventListener('focus', () => openAcc(panel));
    panel.addEventListener('mouseenter', () => {
      if (isDesktop.matches) openAcc(panel);
    });
  });

  /* ----- FAQ: single-open accordion ----- */
  const faqButtons = $$('.faq__btn');

  const closeFaq = (btn) => {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    btn.setAttribute('aria-expanded', 'false');
    panel.classList.remove('is-open');
    setTimeout(() => {
      if (btn.getAttribute('aria-expanded') !== 'true') panel.hidden = true;
    }, pace(500));
  };

  const openFaq = (btn) => {
    faqButtons.forEach((other) => {
      if (other !== btn && other.getAttribute('aria-expanded') === 'true') closeFaq(other);
    });
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    btn.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('is-open'));
  };

  faqButtons.forEach((btn) => btn.addEventListener('click', () => {
    if (btn.getAttribute('aria-expanded') === 'true') {
      closeFaq(btn);
    } else {
      openFaq(btn);
    }
  }));

  $$('[data-open-faq="pay"]').forEach((link) => link.addEventListener('click', () => {
    openFaq($('#faq-q5'));
  }));

  /* ----- Reveal, stats and startup ----- */
  if (reduceMotion) {
    revealTargets.forEach((node) => node.classList.add('is-visible'));
    stats.forEach((stat) => onStatVisible(stat));
  } else {
    observeOnce(revealTargets, (node) => node.classList.add('is-visible'), { threshold: 0.12 });
    observeOnce(stats, onStatVisible, { threshold: 0.4 });
  }

  $$('.acc__panel').forEach((panel) => {
    if (!panel.classList.contains('is-open')) $('.acc__body', panel).hidden = true;
  });

  paintLangButtons();
  setListening(false);
  showPrompt(0);
  renderPersona('everyday', personaTabs[0]);
  renderCalc();
  $$('[data-year]').forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
  $('[data-back-to-top]').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });
})();
