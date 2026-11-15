(function () {
  var KEY = 'pico_theme';
  var COOKIE = 'theme';
  var root = document.documentElement;

  function readCookie() {
    var m = document.cookie.match(/(?:^|;\s*)theme=(light|dark|system)/);
    return m ? m[1] : null;
  }

  function readStored() {
    try {
      var v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' || v === 'system' ? v : null;
    } catch (e) {
      return null;
    }
  }

  function getPreference() {
    return readCookie() || readStored() || 'dark';
  }

  function resolve(pref) {
    if (pref !== 'system') return pref;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function apply(pref) {
    var resolved = resolve(pref);
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
    return resolved;
  }

  function persist(pref) {
    try {
      localStorage.setItem(KEY, pref);
    } catch (e) {}
    var host = location.hostname;
    var domain = host === 'askpico.app' || host.endsWith('.askpico.app') ? '; Domain=.askpico.app' : '';
    document.cookie = COOKIE + '=' + pref + domain + '; Path=/; Max-Age=31536000; SameSite=Lax';
  }

  apply(getPreference());

  window.PicoTheme = {
    get: getPreference,
    set: function (pref) {
      persist(pref);
      return apply(pref);
    },
    toggle: function () {
      var next = resolve(getPreference()) === 'dark' ? 'light' : 'dark';
      return window.PicoTheme.set(next);
    },
  };

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    if (getPreference() === 'system') apply('system');
  });

  window.addEventListener('storage', function (e) {
    if (e.key === KEY && e.newValue) apply(e.newValue);
  });

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var url;
    try {
      url = new URL(a.href, location.href);
    } catch (err) {
      return;
    }
    var isApp = /^(auth|chat)\./.test(url.hostname) || /^(auth|chat)\.localhost$/.test(url.hostname);
    if (!isApp) return;
    url.searchParams.set('theme', resolve(getPreference()));
    a.href = url.toString();
  }, true);

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      var sync = function () {
        var dark = resolve(getPreference()) === 'dark';
        btn.setAttribute('aria-pressed', String(dark));
        btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      };
      sync();
      btn.addEventListener('click', function () {
        window.PicoTheme.toggle();
        sync();
      });
    });
  });
})();
