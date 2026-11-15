(function () {
  const root = document.documentElement;
  root.classList.add('js');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  const backdrop = document.querySelector('.drawer-backdrop');

  function setNav(open) {
    if (!links) return;
    links.classList.toggle('open', open);
    if (backdrop) backdrop.classList.toggle('open', open);
    if (toggle) toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  if (toggle) toggle.addEventListener('click', () => setNav(!links.classList.contains('open')));
  if (backdrop) backdrop.addEventListener('click', () => setNav(false));
  if (links) links.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setNav(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });

  // The HTML carries production origins so the static site works as-is on
  // askpico.app. In local dev (beta plan 8.1) the app runs on *.localhost
  // subdomains, so rewrite the app links instead of hardcoding hosts.
  const isLocal =
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname.endsWith('.localhost');
  if (isLocal) {
    const appHosts = {
      'auth.askpico.app': 'auth.localhost:5173',
      'chat.askpico.app': 'chat.localhost:5173',
    };
    document.querySelectorAll('a[href]').forEach((a) => {
      try {
        const url = new URL(a.href);
        const local = appHosts[url.hostname];
        if (local) a.href = `http://${local}${url.pathname}${url.search}${url.hash}`;
      } catch {
        // not an absolute URL — leave it alone
      }
    });
  }

  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  const tabs = document.querySelectorAll('.tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.target;
      tabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      document.querySelectorAll('.preview-body').forEach((panel) => {
        panel.classList.toggle('active', panel.id === target);
      });
    });
  });

  const copyBtn = document.querySelector('[data-copy]');
  const copyInput = document.querySelector('[data-copy-input]');
  const copyMsg = document.querySelector('.copied');
  if (copyBtn && copyInput) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(copyInput.value);
        if (copyMsg) copyMsg.textContent = 'Link copied.';
      } catch (err) {
        copyInput.select();
        if (copyMsg) copyMsg.textContent = 'Press Ctrl+C to copy.';
      }
    });
  }

  const fill = document.querySelector('.progress-fill');
  if (fill) {
    const target = (fill.dataset.width || '0') + '%';
    if (reduceMotion) {
      fill.style.width = target;
    } else {
      requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = target; }));
    }
  }


  const canvas = document.querySelector('canvas.sphere');
  const bars = Array.from(document.querySelectorAll('.visualizer span'));
  if (!canvas) return;

  const VERT = 'attribute vec2 a_pos; void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }';
  const FRAG = `
    precision mediump float;
    uniform vec2 u_res;
    uniform float u_time;
    uniform vec2 u_mouse;
    uniform float u_hover;
    uniform float u_amp;

    void main() {
      float s = min(u_res.x, u_res.y);
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / s;
      vec2 m = (u_mouse - 0.5 * u_res) / s;

      float d = length(uv - m);
      float ripple = u_hover * 0.06 * exp(-d * 5.0) * sin(d * 28.0 - u_time * 4.0);
      vec2 p = uv * (1.0 + ripple) + (uv - m) * u_hover * 0.03 * sin(u_time * 1.3);

      float rr = length(p);
      float ang = atan(p.y, p.x);

      float bands = 0.0;
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        bands += 0.5 + 0.5 * sin(ang * (5.0 + fi * 3.0) + u_time * (1.4 + fi * 0.6));
      }
      bands /= 3.0;

      float R = 0.3 * (1.0 + 0.03 * u_amp * bands + 0.01 * sin(u_time * 1.2));
      float edge = smoothstep(R + 0.006, R - 0.006, rr);
      float t = clamp(rr / R, 0.0, 1.0);

      vec3 cyan = vec3(0.0, 0.949, 0.996);
      vec3 blue = vec3(0.310, 0.675, 0.996);
      vec3 emerald = vec3(0.063, 0.725, 0.506);
      vec3 teal = vec3(0.051, 0.231, 0.400);

      float swirl = 0.5 + 0.5 * sin(ang * 2.0 + rr * 14.0 - u_time * 0.8);
      vec3 base = mix(cyan, blue, swirl);
      base = mix(base, emerald, 0.25 + 0.25 * sin(u_time * 0.5 + uv.x * 3.0));

      vec2 hl = p - vec2(-0.1, 0.12);
      float spec = smoothstep(0.13, 0.0, length(hl));
      float rim = pow(t, 3.0);
      vec3 sphereCol = base * (0.5 + 0.4 * rim) + vec3(spec) * 0.7 + teal * 0.35 * (1.0 - rim);

      float glowFalloff = max(rr - R, 0.0);
      float glow = exp(-glowFalloff * 8.0) * (0.45 + 0.25 * bands);
      vec3 glowCol = mix(cyan, emerald, 0.4) * glow;

      float a = max(edge, clamp(glow, 0.0, 1.0) * 0.85);
      vec3 col = mix(glowCol, sphereCol, edge);
      gl_FragColor = vec4(col * a, a);
    }
  `;

  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true });

  let rafId = 0;
  const mouse = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0 };
  let hover = 0;
  let hoverTarget = 0;
  const amp = 0.8;

  function dpr() {
    return Math.min(window.devicePixelRatio || 1, 2);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = dpr();
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function setPointer(e) {
    const rect = canvas.getBoundingClientRect();
    const ratio = dpr();
    mouse.x = (e.clientX - rect.left) * ratio;
    mouse.y = (rect.bottom - e.clientY) * ratio;
  }

  canvas.addEventListener('pointermove', (e) => { setPointer(e); hoverTarget = 1; });
  canvas.addEventListener('pointerdown', (e) => { setPointer(e); hoverTarget = 1; });
  canvas.addEventListener('pointerleave', () => { hoverTarget = 0; });
  canvas.addEventListener('pointerup', () => { hoverTarget = 0; });

  function compile(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  let program = null;
  let uniforms = null;
  if (gl) {
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (vs && fs) {
      program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        program = null;
      }
    }
    if (program) {
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const posLoc = gl.getAttribLocation(program, 'a_pos');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      uniforms = {
        res: gl.getUniformLocation(program, 'u_res'),
        time: gl.getUniformLocation(program, 'u_time'),
        mouse: gl.getUniformLocation(program, 'u_mouse'),
        hover: gl.getUniformLocation(program, 'u_hover'),
        amp: gl.getUniformLocation(program, 'u_amp'),
      };
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
  }

  const ctx2d = !program ? canvas.getContext('2d') : null;

  function drawGl(t) {
    smooth.x += (mouse.x - smooth.x) * 0.1;
    smooth.y += (mouse.y - smooth.y) * 0.1;
    hover += (hoverTarget - hover) * 0.08;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uniforms.res, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, t);
    gl.uniform2f(uniforms.mouse, smooth.x, smooth.y);
    gl.uniform1f(uniforms.hover, hover);
    gl.uniform1f(uniforms.amp, amp);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function drawFallback(t) {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * (0.3 + 0.01 * Math.sin(t * 1.2));
    ctx2d.clearRect(0, 0, w, h);
    const glow = ctx2d.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.6);
    glow.addColorStop(0, 'rgba(0, 242, 254, 0.35)');
    glow.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx2d.fillStyle = glow;
    ctx2d.fillRect(0, 0, w, h);
    const orb = ctx2d.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    orb.addColorStop(0, '#d5fbff');
    orb.addColorStop(0.35, '#00f2fe');
    orb.addColorStop(0.75, '#4facfe');
    orb.addColorStop(1, '#0d3b66');
    ctx2d.fillStyle = orb;
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, r, 0, Math.PI * 2);
    ctx2d.fill();
  }

  function updateBars(t) {
    bars.forEach((bar, i) => {
      const wave = 0.5 + 0.5 * Math.sin(t * (2 + i * 0.3) + i * 0.6);
      const level = 0.2 + 0.8 * wave * (0.7 + 0.3 * amp);
      bar.style.transform = 'scaleY(' + level.toFixed(3) + ')';
    });
  }

  function frame(now) {
    const t = now / 1000;
    resize();
    if (program) drawGl(t);
    else if (ctx2d) drawFallback(t);
    updateBars(t);
    if (!reduceMotion) rafId = requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => {
    if (reduceMotion) frame(0);
  });

  document.addEventListener('visibilitychange', () => {
    if (reduceMotion) return;
    if (document.hidden) {
      cancelAnimationFrame(rafId);
    } else {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(frame);
    }
  });

  if (reduceMotion) {
    frame(0);
  } else {
    rafId = requestAnimationFrame(frame);
  }
})();
