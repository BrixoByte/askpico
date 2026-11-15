/* Pico Viewer — popover menus: theme picker, export menu, template menu.
   Exports: window.PicoViewer.Menus = { init(elements, hooks), closeAll(), buildThemes(currentId), buildTemplates(list) }.
   hooks: onTheme(id), onExport(kind), onTemplate(id).
   Depends on: icons.js (svgFor), data/templates.js (passed in via buildTemplates). Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  const THEME_LIST = [
    ['auto', 'Auto (system)', 'monitor'], ['dark', 'Dark', 'moon'], ['light', 'Light', 'sun'],
    ['midnight', 'Midnight', 'bolt'], ['forest', 'Forest', 'leaf'], ['neutral', 'Neutral', 'square']
  ];
  let els = null;
  let hooks = {};

  function closeAll() {
    let any = false;
    document.querySelectorAll('.popover').forEach((p) => {
      if (!p.hidden) { any = true; p.hidden = true; }
    });
    document.querySelectorAll('[aria-haspopup][aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    return any;
  }

  function toggle(btn, pop) {
    const willOpen = pop.hidden;
    closeAll();
    if (willOpen) {
      pop.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
    }
  }

  function buildThemes(currentId) {
    const svgFor = window.PicoViewer.Icons.svgFor;
    els.themeMenu.innerHTML = '<div class="menu-label">Theme</div>' + THEME_LIST.map(([id, label, icon]) =>
      '<button class="menu-item' + (currentId === id ? ' current' : '') + '" role="menuitemradio" data-theme-id="' + id + '">' +
      svgFor(icon) + label + '</button>').join('');
  }

  function buildTemplates(list) {
    const svgFor = window.PicoViewer.Icons.svgFor;
    els.templateMenu.innerHTML = '<div class="menu-label">Start from a template</div>' + list.map((t) =>
      '<button class="menu-item" role="menuitem" data-template="' + t.id + '">' + svgFor('layers') +
      '<span>' + t.name + '</span><small>' + t.hint + '</small></button>').join('');
  }

  function init(elements, extraHooks) {
    els = elements;
    hooks = extraHooks || {};
    els.themeBtn.addEventListener('click', () => toggle(els.themeBtn, els.themeMenu));
    els.exportBtn.addEventListener('click', () => toggle(els.exportBtn, els.exportMenu));
    els.templateBtn.addEventListener('click', () => toggle(els.templateBtn, els.templateMenu));
    els.themeMenu.addEventListener('click', (e) => {
      const b = e.target.closest('[data-theme-id]');
      if (!b) return;
      closeAll();
      hooks.onTheme(b.dataset.themeId);
    });
    els.exportMenu.addEventListener('click', (e) => {
      const b = e.target.closest('[data-export]');
      if (!b) return;
      closeAll();
      hooks.onExport(b.dataset.export);
    });
    els.templateMenu.addEventListener('click', (e) => {
      const b = e.target.closest('[data-template]');
      if (b) hooks.onTemplate(b.dataset.template);
    });
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest || !e.target.closest('.menu-anchor')) closeAll();
    });
  }

  window.PicoViewer.Menus = { init, closeAll, buildThemes, buildTemplates, THEME_LIST };
})();
