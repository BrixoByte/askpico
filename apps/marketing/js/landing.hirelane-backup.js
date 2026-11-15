(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----- Header state ----- */
  const header = document.getElementById('site-header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ----- Nav indicator (slides between links) ----- */
  const navList = document.getElementById('site-nav-list');
  const navWrap = navList.parentElement;
  const indicator = navWrap.querySelector('.site-nav__indicator');

  const moveIndicator = (link) => {
    if (!link) {
      indicator.style.opacity = '0';
      return;
    }
    const wrapLeft = navWrap.getBoundingClientRect().left;
    const rect = link.getBoundingClientRect();
    indicator.style.opacity = '1';
    indicator.style.width = `${rect.width}px`;
    indicator.style.transform = `translateX(${rect.left - wrapLeft}px)`;
  };

  navList.querySelectorAll('.site-nav__link').forEach((link) => {
    link.addEventListener('mouseenter', () => moveIndicator(link));
    link.addEventListener('focus', () => moveIndicator(link));
    link.addEventListener('blur', () => moveIndicator(null));
  });
  navList.addEventListener('mouseleave', () => moveIndicator(null));

  /* ----- Mobile overlay menu (focus trap, Esc closes) ----- */
  const menuBtn = document.querySelector('.menu-toggle');
  const menu = document.getElementById('mobile-menu');
  let lastFocus = null;

  const menuItems = () => Array.from(menu.querySelectorAll('a, button'));

  const setMenu = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      lastFocus = document.activeElement;
      menu.hidden = false;
      menuItems()[0].focus();
    } else {
      menu.hidden = true;
      if (lastFocus) lastFocus.focus();
    }
  };

  menuBtn.addEventListener('click', () => {
    setMenu(menuBtn.getAttribute('aria-expanded') !== 'true');
  });

  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) setMenu(false);
  });

  document.addEventListener('keydown', (e) => {
    if (menu.hidden) return;
    if (e.key === 'Escape') {
      setMenu(false);
      return;
    }
    if (e.key !== 'Tab') return;
    const items = menuItems();
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900 && !menu.hidden) setMenu(false);
  });

  /* ----- Stagger delays for reveal groups ----- */
  const groupCounts = new Map();
  document.querySelectorAll('.reveal').forEach((el) => {
    const parent = el.parentElement;
    const i = groupCounts.get(parent) ?? 0;
    el.style.setProperty('--i', String(i));
    groupCounts.set(parent, i + 1);
  });

  /* ----- Count-up numbers ----- */
  const countUp = (el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = Number(el.dataset.decimals || 0);
    const duration = 1600;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = (target * eased).toFixed(decimals);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  /* ----- Self-ticking checklist ----- */
  const tickList = (list) => {
    list.querySelectorAll('li').forEach((li, i) => {
      setTimeout(() => li.classList.add('is-ticked'), 400 + i * 500);
    });
  };

  /* ----- Reveal, draw, count, and tick on scroll ----- */
  const revealTargets = document.querySelectorAll('.reveal, .steps, .checklist, [data-count]');

  if (reduceMotion) {
    document.querySelectorAll('.reveal, .steps').forEach((el) => el.classList.add('is-visible'));
    document.querySelectorAll('.checklist li').forEach((li) => li.classList.add('is-ticked'));
  } else {
    const io = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          if (el.hasAttribute('data-count')) {
            countUp(el);
          } else {
            el.classList.add('is-visible');
            if (el.classList.contains('checklist')) tickList(el);
          }
          observer.unobserve(el);
        });
      },
      { threshold: 0.15 }
    );
    revealTargets.forEach((el) => io.observe(el));
  }

  /* ----- Hero candidate list ----- */
  const rows = Array.from(document.querySelectorAll('.match-row'));
  const ring = document.querySelector('.score-ring');
  const ringNum = document.getElementById('score-num');
  const panelName = document.getElementById('panel-name');
  const panelSkills = document.getElementById('panel-skills');

  const selectRow = (row) => {
    rows.forEach((r) => {
      const active = r === row;
      r.classList.toggle('is-active', active);
      r.setAttribute('aria-selected', String(active));
      r.tabIndex = active ? 0 : -1;
    });

    const fill = row.querySelector('.match-row__fill');
    fill.style.width = '0';
    void fill.offsetWidth;
    fill.style.width = '';

    const score = Number(row.dataset.score);
    ring.style.setProperty('--score', String(score));
    ringNum.textContent = String(score);
    panelName.textContent = row.dataset.name;

    panelSkills.innerHTML = '';
    row.dataset.skills.split(', ').forEach((skill) => {
      const li = document.createElement('li');
      li.className = 'chip';
      li.textContent = skill;
      panelSkills.appendChild(li);
    });
  };

  rows.forEach((row) => row.addEventListener('click', () => selectRow(row)));

  document.getElementById('match-list').addEventListener('keydown', (e) => {
    const current = rows.findIndex((r) => r.classList.contains('is-active'));
    let next = null;
    if (e.key === 'ArrowDown') next = (current + 1) % rows.length;
    if (e.key === 'ArrowUp') next = (current - 1 + rows.length) % rows.length;
    if (next === null) return;
    e.preventDefault();
    selectRow(rows[next]);
    rows[next].focus();
  });

  /* ----- Sticky stepper scroll-spy ----- */
  const processItems = document.querySelectorAll('.process__item');
  const stagePanels = document.querySelectorAll('.stage-panel');

  const setStep = (index) => {
    processItems.forEach((el, i) => el.classList.toggle('is-active', i === index));
    stagePanels.forEach((el, i) => el.classList.toggle('is-active', i === index));
  };

  const stepObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setStep(Number(entry.target.dataset.step));
      });
    },
    { rootMargin: '-45% 0px -45% 0px' }
  );
  processItems.forEach((el) => stepObserver.observe(el));

  /* ----- Solutions tabs (arrow keys, Home/End) ----- */
  const tablist = document.getElementById('solution-tabs');
  const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
  const solPanel = document.getElementById('panel-solutions');
  const solTitle = document.getElementById('solution-title');
  const solList = document.getElementById('solution-list');
  const solArt = document.getElementById('solution-art');

  const solutionData = {
    startups: {
      title: 'Hire your first ten people without a recruiter.',
      items: ['Post to boards in one click', 'Shortlist without reading every CV', 'Share a scorecard with your co-founder'],
    },
    agencies: {
      title: 'Run every client search from one workspace.',
      items: ['Separate workspaces per client', 'White-label shortlists in minutes', 'Track placements and fees in one view'],
    },
    enterprise: {
      title: 'Standardize hiring across every region.',
      items: ['SSO and audit logs for security teams', 'Approval steps that match your org chart', 'Retention rules set per country'],
    },
    talent: {
      title: 'Fill the bench before the next wave starts.',
      items: ['Build talent pools from past applicants', 'Re-engage candidates with one message', 'See pipeline health by team and role'],
    },
  };

  const checkIcon =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const selectTab = (tab, moveFocus) => {
    const key = tab.id.replace('tab-', '');
    tabs.forEach((t) => {
      const active = t === tab;
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
    });
    const data = solutionData[key];
    solPanel.setAttribute('aria-labelledby', tab.id);
    solTitle.textContent = data.title;
    solList.innerHTML = data.items.map((item) => `<li>${checkIcon}${item}</li>`).join('');
    solArt.dataset.variant = key;
    if (moveFocus) tab.focus();
  };

  tabs.forEach((tab) => tab.addEventListener('click', () => selectTab(tab, false)));

  tablist.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let next = null;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    selectTab(tabs[next], true);
  });

  /* ----- Pricing billing toggle ----- */
  const billingBtns = document.querySelectorAll('[data-billing]');
  const priceEls = document.querySelectorAll('[data-price-monthly]');

  const setBilling = (mode) => {
    billingBtns.forEach((btn) => {
      const active = btn.dataset.billing === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    priceEls.forEach((el) => {
      const value = mode === 'yearly' ? el.dataset.priceYearly : el.dataset.priceMonthly;
      el.textContent = value === 'custom' ? 'Custom' : `$${value}`;
    });
  };

  billingBtns.forEach((btn) => btn.addEventListener('click', () => setBilling(btn.dataset.billing)));

  /* ----- Testimonials: featured quote, switcher, autoplay ----- */
  const quoteCards = Array.from(document.querySelectorAll('.quote-card'));
  const quoteWrap = document.getElementById('quote-featured');
  const quoteText = document.getElementById('quote-text');
  const quoteHighlight = document.getElementById('quote-highlight');
  const quoteTail = document.getElementById('quote-tail');
  const quoteName = document.getElementById('quote-name');
  const quoteRole = document.getElementById('quote-role');
  const quoteAvatar = document.getElementById('quote-avatar');
  const quoteBar = document.querySelector('.quote-progress span');
  const storiesGrid = document.querySelector('.stories__grid');
  const QUOTE_DELAY = 7000;

  let quoteIndex = 0;
  let quoteTimer = null;
  let quoteHovered = false;
  let fadeTimer = null;

  const restartBar = () => {
    quoteBar.classList.remove('is-running');
    void quoteBar.offsetWidth;
    if (!reduceMotion && !quoteHovered) quoteBar.classList.add('is-running');
  };

  const scheduleNext = () => {
    clearTimeout(quoteTimer);
    if (reduceMotion || quoteHovered) return;
    quoteTimer = setTimeout(() => showQuote((quoteIndex + 1) % quoteCards.length), QUOTE_DELAY);
  };

  const renderQuote = (card) => {
    const text = card.dataset.text;
    const highlight = card.dataset.highlight;
    const at = text.indexOf(highlight);
    quoteText.textContent = `"${text.slice(0, at)}`;
    quoteHighlight.textContent = highlight;
    quoteTail.textContent = `${text.slice(at + highlight.length)}"`;
    quoteName.textContent = card.dataset.name;
    quoteRole.textContent = card.dataset.role;
    quoteAvatar.textContent = card.dataset.initials;
    quoteAvatar.style.setProperty('--h', card.dataset.hue);
  };

  const showQuote = (index) => {
    quoteIndex = index;
    quoteCards.forEach((c, i) => {
      const active = i === index;
      c.classList.toggle('is-active', active);
      c.setAttribute('aria-current', String(active));
    });
    clearTimeout(fadeTimer);
    quoteWrap.classList.add('is-fading');
    fadeTimer = setTimeout(() => {
      renderQuote(quoteCards[index]);
      quoteWrap.classList.remove('is-fading');
    }, reduceMotion ? 0 : 280);
    restartBar();
    scheduleNext();
  };

  quoteCards.forEach((card, i) => {
    card.addEventListener('click', () => showQuote(i));
  });

  storiesGrid.addEventListener('mouseenter', () => {
    quoteHovered = true;
    clearTimeout(quoteTimer);
    quoteBar.classList.remove('is-running');
  });

  storiesGrid.addEventListener('mouseleave', () => {
    quoteHovered = false;
    restartBar();
    scheduleNext();
  });

  if (!reduceMotion) {
    restartBar();
    scheduleNext();
  }

  /* ----- FAQ accordion (single open) ----- */
  const accItems = Array.from(document.querySelectorAll('.accordion__item'));
  accItems.forEach((item) => {
    const trigger = item.querySelector('.accordion__trigger');
    const panel = item.querySelector('.accordion__panel');
    panel.hidden = false;
    trigger.addEventListener('click', () => {
      const willOpen = !item.classList.contains('is-open');
      accItems.forEach((other) => {
        other.classList.remove('is-open');
        other.querySelector('.accordion__trigger').setAttribute('aria-expanded', 'false');
      });
      if (willOpen) {
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ----- Newsletter validation (no backend) ----- */
  const form = document.getElementById('newsletter');
  const emailInput = document.getElementById('newsletter-email');
  const formMsg = document.getElementById('newsletter-msg');
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = emailInput.value.trim();
    if (!emailPattern.test(value)) {
      formMsg.textContent = 'Enter a valid work email, like name@company.com.';
      formMsg.className = 'newsletter__msg is-error';
      emailInput.setAttribute('aria-invalid', 'true');
      emailInput.focus();
      return;
    }
    emailInput.removeAttribute('aria-invalid');
    form.reset();
    formMsg.textContent = 'You are subscribed. Look for the first note next month.';
    formMsg.className = 'newsletter__msg is-success';
  });

  /* ----- Back to top ----- */
  document.querySelector('[data-back-to-top]').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* ----- Footer year ----- */
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
})();
