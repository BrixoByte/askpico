(() => {
  'use strict';

  const BRAND = 'PICO';
  document.querySelectorAll('[data-brand]').forEach((el) => {
    el.textContent = BRAND;
  });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Theme toggle (light / dark) */
  const root = document.documentElement;
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    if (themeToggle) {
      themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  };

  let storedTheme = null;
  try {
    storedTheme = localStorage.getItem('pico_theme');
  } catch (e) {
    storedTheme = null;
  }
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : systemDark ? 'dark' : 'light');

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem('pico_theme', next);
      } catch (e) {
        /* storage unavailable; theme still applies for this visit */
      }
    });
  }

  /* Mobile menu */
  const toggle = document.querySelector('.navbar__toggle');
  const mobileMenu = document.getElementById('mobile-menu');

  if (toggle && mobileMenu) {
    const setMenu = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      mobileMenu.classList.toggle('is-open', open);
    };

    toggle.addEventListener('click', () => {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });

    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setMenu(false));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setMenu(false);
    });
  }

  /* Smooth anchor scrolling with navbar offset (same-page links only) */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 110;
      window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
      history.replaceState(null, '', id);
    });
  });

  /* Scroll reveal */
  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealItems.forEach((el) => observer.observe(el));
  } else {
    revealItems.forEach((el) => el.classList.add('is-visible'));
  }

  /* Why PICO tabs (homepage only) */
  const whyCopy = document.getElementById('why-copy');
  const whyTabs = document.querySelectorAll('.why__tabs button');
  const whyContent = {
    'chat-interface': 'Ask questions, get answers from the right agent, and keep every thread in one place.',
    'studio-canvas': 'An infinite, mood-board style canvas for images and media, with blocks you can arrange freely.',
    'artifact-engine': 'A 30/70 split-screen preview for React code, PDFs, spreadsheets, and compiled outputs, live as the answer streams.',
  };

  if (whyCopy) {
    whyTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        whyTabs.forEach((t) => {
          const active = t === tab;
          t.setAttribute('aria-selected', String(active));
          t.classList.toggle('is-active', active);
        });
        whyCopy.textContent = whyContent[tab.dataset.tab] ?? '';
      });
    });
  }

  /* Efficiency slider: drag to scroll (homepage only) */
  const slider = document.getElementById('efficiency-slider');
  if (slider) {
    let isDown = false;
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    slider.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      isDown = true;
      moved = false;
      startX = e.clientX;
      startScroll = slider.scrollLeft;
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) {
        moved = true;
        slider.classList.add('is-dragging');
      }
      slider.scrollLeft = startScroll - dx;
    });

    const endDrag = () => {
      if (!isDown) return;
      isDown = false;
      if (!slider.classList.contains('is-dragging')) return;
      slider.classList.remove('is-dragging');
      const card = slider.querySelector('.eff-card');
      const step = card.offsetWidth + 16;
      slider.scrollTo({ left: Math.round(slider.scrollLeft / step) * step, behavior: reduceMotion ? 'auto' : 'smooth' });
    };

    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    slider.addEventListener('click', (e) => {
      if (moved) e.preventDefault();
    });
  }

  /* Count-up numbers (homepage only) */
  const countEls = document.querySelectorAll('[data-count]');
  const animateCount = (el) => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix ?? '';
    const duration = 1400;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = `${Math.round(target * eased)}${suffix}`;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  if (countEls.length && 'IntersectionObserver' in window && !reduceMotion) {
    const countObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            countObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    countEls.forEach((el) => countObserver.observe(el));
  }

  /* Principles carousel (homepage only) */
  const track = document.getElementById('testimonials-track');
  if (track) {
    const slides = Array.from(track.children);
    const prevBtn = document.getElementById('testi-prev');
    const nextBtn = document.getElementById('testi-next');
    const counter = document.getElementById('testi-current');
    const total = document.getElementById('testi-total');
    const fill = document.getElementById('testi-progress');
    let index = 0;

    total.textContent = String(slides.length).padStart(2, '0');

    const renderSlide = () => {
      const step = slides[0].offsetWidth + 12;
      track.style.transform = `translateX(${-index * step}px)`;
      counter.textContent = String(index + 1).padStart(2, '0');
      fill.style.setProperty('--p', `${((index + 1) / slides.length) * 100}%`);
      prevBtn.disabled = index === 0;
      nextBtn.disabled = index === slides.length - 1;
    };

    const go = (next) => {
      index = Math.min(Math.max(next, 0), slides.length - 1);
      renderSlide();
    };

    prevBtn.addEventListener('click', () => go(index - 1));
    nextBtn.addEventListener('click', () => go(index + 1));
    window.addEventListener('resize', renderSlide);

    let touchStartX = null;
    track.parentElement.addEventListener(
      'touchstart',
      (e) => {
        touchStartX = e.touches[0].clientX;
      },
      { passive: true }
    );
    track.parentElement.addEventListener(
      'touchend',
      (e) => {
        if (touchStartX === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        touchStartX = null;
      },
      { passive: true }
    );

    renderSlide();
  }

  /* FAQ accordion (single open) */
  const faqItems = document.querySelectorAll('.faq__item');
  faqItems.forEach((item) => {
    const question = item.querySelector('.faq__q');
    question.addEventListener('click', () => {
      const willOpen = item.dataset.open !== 'true';
      faqItems.forEach((other) => {
        other.dataset.open = 'false';
        other.querySelector('.faq__q').setAttribute('aria-expanded', 'false');
      });
      if (willOpen) {
        item.dataset.open = 'true';
        question.setAttribute('aria-expanded', 'true');
      }
    });
  });
})();
