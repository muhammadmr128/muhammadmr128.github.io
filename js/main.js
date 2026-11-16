(function () {
  var root = document.documentElement;
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Theme toggle (respects the system preference until clicked)
  var themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var current = root.getAttribute('data-theme');
    if (!current) current = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    root.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
  });

  // Year
  var yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();

  // Active nav link
  var links = {};
  document.querySelectorAll('.nav-links a[href^="#"]').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
  if ('IntersectionObserver' in window) {
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        for (var k in links) links[k].classList.remove('active');
        if (links[e.target.id]) links[e.target.id].classList.add('active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['now', 'civil', 'work', 'research', 'journey', 'about', 'contact'].forEach(function (id) { var el = document.getElementById(id); if (el) so.observe(el); });
  }

  // Transfer chart (Figure 5): one series, set large
  (function () {
    var fig = document.getElementById('c-transfer'); if (!fig) return;
    var box = fig.querySelector('.plot');
    var NS = 'http://www.w3.org/2000/svg';
    function el(t, a, p) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
    function txt(p, x, y, s, a) { var t = el('text', Object.assign({ x: x, y: y }, a || {}), p); t.textContent = s; return t; }
    var tip = document.createElement('div'); tip.className = 'tip'; fig.appendChild(tip);
    function showTip(evt, html) {
      if (!html) { tip.style.opacity = 0; return; }
      tip.innerHTML = html; var r = fig.getBoundingClientRect();
      var x = Math.min(evt.clientX - r.left + 12, r.width - tip.offsetWidth - 8);
      tip.style.left = Math.max(8, x) + 'px'; tip.style.top = (evt.clientY - r.top - 40) + 'px'; tip.style.opacity = 1;
    }
    var rows = [['Observed in the lab', 14, false], ['Alberta model, gaps imputed', 234, true], ['Alberta model, Labrador inputs only', 243, true]];
    var W = 1200, lw = 300, rh = 64, top = 8, H = rows.length * rh + top + 40, max = 260, plotW = W - lw - 90;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Bar chart of observed versus predicted turbidity on the Churchill River: 14 NTU observed, 234 and 243 NTU predicted' }, box);
    [0, 50, 100, 150, 200, 250].forEach(function (v) {
      var x = lw + plotW * v / max;
      el('line', { x1: x, x2: x, y1: top, y2: H - 32, class: 'axis' }, svg);
      txt(svg, x, H - 10, v + (v === 250 ? ' NTU' : ''), { 'text-anchor': 'middle', 'font-size': 15, class: 'tick' });
    });
    rows.forEach(function (r, i) {
      var y = top + i * rh, bw = Math.max(3, plotW * r[1] / max);
      txt(svg, lw - 16, y + rh / 2, r[0], { 'text-anchor': 'end', 'dominant-baseline': 'middle', 'font-size': 19, class: 'lbl' });
      el('rect', { x: lw, y: y + 14, width: bw, height: rh - 28, class: 'bar' + (r[2] ? ' hi' : '') }, svg);
      txt(svg, lw + bw + 12, y + rh / 2, r[1] + ' NTU', { 'dominant-baseline': 'middle', 'font-size': 18, class: 'val' });
      var h = el('rect', { x: 0, y: y, width: W, height: rh, class: 'hit' }, svg);
      h.addEventListener('mousemove', function (e) { showTip(e, '<b>' + r[0] + '</b>: ' + r[1] + ' NTU' + (r[2] ? ', about ' + Math.round(r[1] / 14) + '× observed' : '')); });
      h.addEventListener('mouseleave', function (e) { showTip(e, null); });
    });
  })();

  // ML pipeline stepper (tabs)
  (function () {
    var steps = [
      { t: 'Collect', big: '837', u: 'samples', h: 'Collect long-term monitoring data', p: "Pulled 26 years (2000 to 2026) of water-quality records from four stations in Alberta's Peace-Athabasca Basin, a boreal watershed hit by the 2016 Fort McMurray and 2023 fires." },
      { t: 'Clean', big: '22', u: 'predictors', h: 'Clean and engineer features', p: 'Dropped samples without turbidity (823 remain), filled missing chemistry with medians, one-hot encoded the station and added month, day-of-year and year: 15 chemistry, 3 time and 4 station inputs.' },
      { t: 'Train', big: '4', u: 'models', h: 'Train and compare four ensemble models', p: 'Random Forest, Extra Trees, Gradient Boosting and XGBoost on the same 80/20 train/test split, scored with R², RMSE and MAE so the comparison is fair.' },
      { t: 'Explain', big: '5×', u: 'nitrogen lead', h: 'Explain what drives turbidity', p: 'Extra Trees won (R² = 0.775). Feature importance shows total nitrogen dominating, about 5× the next input, followed by colour, manganese, aluminium and iron: the chemical signature of wildfire runoff.' },
      { t: 'Transfer', big: '17×', u: 'over-prediction', h: 'Test it in Labrador', p: "Applied to Labrador's Churchill River, the Alberta model predicted 234 to 243 NTU against 14 NTU observed. The method transfers, but the model must be retrained once the local hydrology and water-quality link is established." }
    ];
    var wrap = document.querySelector('.pipe-steps'), panel = document.getElementById('pipePanel'), play = document.getElementById('pipePlay');
    if (!wrap || !panel) return;
    var cur = 0, timer = null;
    var btns = steps.map(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'pstep'; b.id = 'pstep-' + i;
      b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', 'pipePanel');
      b.innerHTML = '<span class="n">' + (i + 1) + '</span><span>' + s.t + '</span>';
      b.addEventListener('click', function () { stop(); go(i); });
      wrap.appendChild(b); return b;
    });
    function go(i) {
      cur = i;
      btns.forEach(function (b, j) { b.setAttribute('aria-selected', j === i ? 'true' : 'false'); b.tabIndex = j === i ? 0 : -1; });
      panel.setAttribute('aria-labelledby', 'pstep-' + i);
      var s = steps[i];
      panel.innerHTML = '<div class="big in">' + s.big + '<small>' + s.u + '</small></div><div class="in"><h4>' + s.h + '</h4><p>' + s.p + '</p></div>';
    }
    var pipe = document.getElementById('pipe');
    function stop() { if (timer) { clearInterval(timer); timer = null; play.textContent = 'Play the steps'; pipe.classList.remove('playing'); } }
    if (play) play.addEventListener('click', function () {
      if (timer) return stop();
      play.textContent = 'Pause'; pipe.classList.add('playing'); go(0);
      timer = setInterval(function () { if (cur >= steps.length - 1) return stop(); go(cur + 1); pipe.classList.remove('playing'); void pipe.offsetWidth; pipe.classList.add('playing'); }, 3200);
    });
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); stop(); go(Math.min(steps.length - 1, cur + 1)); btns[cur].focus(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); stop(); go(Math.max(0, cur - 1)); btns[cur].focus(); }
    });
    go(0);
  })();

  // Figure lightbox
  (function () {
    var shots = [].slice.call(document.querySelectorAll('a.shot')); if (!shots.length) return;
    var lb = document.getElementById('lb'), img = document.getElementById('lbImg'), cap = document.getElementById('lbCap'), cnt = document.getElementById('lbCnt'), i = 0, last;
    function show(k) {
      i = (k + shots.length) % shots.length;
      var a = shots[i], fig = a.closest('figure');
      img.src = a.getAttribute('href'); img.alt = a.querySelector('img').alt;
      var title = fig.querySelector('.fig-title');
      var t = title ? title.lastChild.textContent : '';
      cap.innerHTML = '<b>' + t + '.</b> ' + fig.querySelector('.cap').textContent;
      cnt.textContent = (i + 1) + ' of ' + shots.length;
    }
    function open(k) { last = document.activeElement; show(k); lb.classList.add('open'); document.body.style.overflow = 'hidden'; document.getElementById('lbX').focus(); }
    function close() { lb.classList.remove('open'); document.body.style.overflow = ''; if (last) last.focus(); }
    shots.forEach(function (a, k) { a.addEventListener('click', function (e) { e.preventDefault(); open(k); }); });
    document.getElementById('lbX').onclick = close;
    document.getElementById('lbPv').onclick = function () { show(i - 1); };
    document.getElementById('lbNx').onclick = function () { show(i + 1); };
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') show(i + 1);
      if (e.key === 'ArrowLeft') show(i - 1);
    });
  })();

  // Publication filters
  (function () {
    var chips = document.querySelectorAll('.filters .chip'), pubs = document.querySelectorAll('.pub');
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        var f = c.dataset.f;
        chips.forEach(function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
        pubs.forEach(function (p) {
          var ok = f === 'all' || p.dataset.type === f || p.dataset.topic === f || (f === 'first' && p.dataset.first === 'true');
          p.classList.toggle('hide', !ok);
        });
      });
    });
  })();

  // Copy email
  (function () {
    var b = document.getElementById('copyEmail'), t = document.getElementById('toast'); if (!b || !t) return;
    function toast(m) { t.textContent = m; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove('show'); }, 2200); }
    b.addEventListener('click', function () {
      var e = 'muhammadmr@mun.ca';
      (navigator.clipboard ? navigator.clipboard.writeText(e) : Promise.reject()).then(function () { toast('Email copied: ' + e); }, function () { toast(e); });
    });
  })();
})();

// ================= The light: live water caustics (WebGL) =================
(function () {
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvases = [].slice.call(document.querySelectorAll('canvas[data-light]'));
  if (!canvases.length) return;

  // Resolve a CSS colour token (oklch) to linear-ish RGB 0..1 via a 1px 2D canvas
  var probe = document.createElement('canvas'); probe.width = probe.height = 1;
  var pctx = probe.getContext('2d', { willReadFrequently: true });
  function rgb(token) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#9fd3df';
    pctx.clearRect(0, 0, 1, 1); pctx.fillStyle = '#000'; pctx.fillStyle = v; pctx.fillRect(0, 0, 1, 1);
    var d = pctx.getImageData(0, 0, 1, 1).data; return [d[0] / 255, d[1] / 255, d[2] / 255];
  }

  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FS = [
    'precision mediump float;',
    'uniform vec2 r;uniform float t;uniform vec3 shade;uniform vec3 deep;uniform vec3 light;uniform vec2 m;uniform float ma;',
    'float caustic(vec2 uv,float tm){',
    '  vec2 p=mod(uv*6.28318,6.28318)-250.;vec2 i=p;float c=1.;float k=.005;',
    '  for(int n=0;n<5;n++){float s=tm*(1.-(3.5/float(n+1)));',
    '    i=p+vec2(cos(s-i.x)+sin(s+i.y),sin(s-i.y)+cos(s+i.x));',
    '    c+=1./length(vec2(p.x/(sin(i.x+s)/k),p.y/(cos(i.y+s)/k)));}',
    '  c/=5.;c=1.17-pow(c,1.4);return pow(abs(c),8.);}',
    'void main(){',
    '  vec2 uv=gl_FragCoord.xy/r.y*.8;',
    '  vec2 q=gl_FragCoord.xy/r;vec2 d=q-m;d.x*=r.x/r.y;float f=exp(-dot(d,d)*18.)*ma;',
    '  uv+=d*f*.06;',
    '  float tm=t*.33+17.;',
    '  float cr=caustic(uv+vec2(.0018,0.),tm);float cg=caustic(uv,tm);float cb=caustic(uv-vec2(.0018,.0006),tm);',
    '  vec3 c=vec3(cr,cg,cb);',
    '  vec3 col=mix(deep,shade,smoothstep(.02,.16,cg));',
    '  col=mix(col,light,smoothstep(vec3(.14),vec3(.5),c));',
    '  col=mix(col*.94,col,.55+.45*q.y);',
    '  col+=f*.06;',
    '  gl_FragColor=vec4(col,1.);}'
  ].join('\n');

  var pools = canvases.map(function (cv) {
    var gl = cv.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) return null;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var u = {}; ['r', 't', 'shade', 'deep', 'light', 'm', 'ma'].forEach(function (n) { u[n] = gl.getUniformLocation(pr, n); });
    var P = { cv: cv, gl: gl, u: u, visible: true, mouse: [0.5, 0.5], target: [0.5, 0.5], amt: 0, amtT: 0, t0: performance.now() - Math.random() * 8000 };
    var host = cv.parentElement;
    host.addEventListener('pointermove', function (e) { var b = cv.getBoundingClientRect(); P.target = [(e.clientX - b.left) / b.width, 1 - (e.clientY - b.top) / b.height]; P.amtT = 1; });
    host.addEventListener('pointerleave', function () { P.amtT = 0; });
    return P;
  }).filter(Boolean);
  if (!pools.length) return;

  function colours() {
    var s = rgb('--color-shade'), l = rgb('--color-light'), dp = rgb('--color-shade-2');
    pools.forEach(function (P) { var gl = P.gl; gl.uniform3fv(P.u.shade, s); gl.uniform3fv(P.u.light, l); gl.uniform3fv(P.u.deep, dp); });
  }
  function size() {
    pools.forEach(function (P) {
      var cw = P.cv.clientWidth, ch = P.cv.clientHeight;
      var dpr = Math.min(Math.min(window.devicePixelRatio || 1, 1.5) * 0.7, Math.sqrt(budget / Math.max(1, cw * ch)));
      var w = Math.max(1, Math.round(cw * dpr)), h = Math.max(1, Math.round(ch * dpr));
      if (P.cv.width !== w || P.cv.height !== h) { P.cv.width = w; P.cv.height = h; P.gl.viewport(0, 0, w, h); }
      P.gl.uniform2f(P.u.r, w, h);
    });
  }
  function draw(P, now) {
    P.mouse[0] += (P.target[0] - P.mouse[0]) * 0.06; P.mouse[1] += (P.target[1] - P.mouse[1]) * 0.06; P.amt += (P.amtT - P.amt) * 0.05;
    var gl = P.gl; gl.uniform1f(P.u.t, (now - P.t0) / 1000); gl.uniform2f(P.u.m, P.mouse[0], P.mouse[1]); gl.uniform1f(P.u.ma, RM ? 0 : P.amt);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  var budget = 420000;   // pixels per pool; lowered on slow devices
  colours(); size();
  addEventListener('resize', size);
  var tb = document.getElementById('themeBtn');
  if (tb) tb.addEventListener('click', function () { setTimeout(function () { colours(); if (RM) pools.forEach(function (P) { draw(P, P.t0 + 6000); }); }, 0); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { colours(); });

  if (RM) { pools.forEach(function (P) { draw(P, P.t0 + 6000); }); return; }   // one still frame
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { pools.forEach(function (P) { if (P.cv === e.target) P.visible = e.isIntersecting; }); }); });
    pools.forEach(function (P) { io.observe(P.cv); });
  }
  // Draw one frame now; start moving after the hero entrance so it stays smooth.
  pools.forEach(function (P) { draw(P, performance.now()); });
  var ema = 16, last = 0, frames = 0, throttle = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (document.hidden) { last = 0; return; }
    if (throttle && now - last < throttle) return;
    if (last) { ema = ema * 0.9 + (now - last) * 0.1; frames++; }
    last = now;
    pools.forEach(function (P) { if (P.visible) draw(P, now); });
    // Adapt: a slow device gets fewer pixels, then fewer frames.
    if (frames > 40 && !throttle && ema > 34) {
      frames = 0;
      if (budget > 90000) { budget = Math.round(budget * 0.5); size(); }
      else { throttle = 100; }
    }
  }
  setTimeout(function () { requestAnimationFrame(loop); }, 1400);
})();

// ================= Motion layer =================
(function () {
  var root = document.documentElement;
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // R² bars in the hero sheet (drawn with or without motion)
  var first = document.querySelector('.sheet .results tbody');
  if (first) first.querySelectorAll('tr').forEach(function (tr) {
    var v = parseFloat(tr.querySelector('td.num').textContent);
    var span = document.createElement('span'); span.className = 'rbar'; span.setAttribute('aria-hidden', 'true');
    span.style.setProperty('--v', Math.min(1, v / 0.8).toFixed(3));
    tr.querySelector('td').appendChild(span);
  });
  document.querySelectorAll('.sheet tbody').forEach(function (tb) {
    tb.querySelectorAll('tr').forEach(function (tr, i) { tr.style.setProperty('--i', i); tr.querySelectorAll('.rbar').forEach(function (b) { b.style.setProperty('--i', i); }); });
  });

  // Scroll progress + experience line (one passive, frame-throttled listener)
  var bar = document.getElementById('progress');
  var tl = document.getElementById('tl'), items = tl ? tl.querySelectorAll('li') : [];
  var ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var h = document.documentElement, max = h.scrollHeight - h.clientHeight || 1;
      if (bar) bar.style.transform = 'scaleX(' + (h.scrollTop / max) + ')';
      if (tl) {
        var r = tl.getBoundingClientRect(), mid = innerHeight * 0.6;
        tl.style.setProperty('--p', RM ? 1 : Math.max(0, Math.min(1, (mid - r.top) / r.height)).toFixed(3));
        items.forEach(function (it) { it.classList.toggle('lit', RM || it.getBoundingClientRect().top + 24 < mid); });
      }
    });
  }
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); onScroll();

  // Figure index follows the figure in view (works with or without motion)
  var figLinks = document.querySelectorAll('.fig-index a');
  if (figLinks.length && 'IntersectionObserver' in window) {
    var fio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        figLinks.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-40% 0px -50% 0px' });
    document.querySelectorAll('.pane-scroll .fig').forEach(function (f) { fio.observe(f); });
  }

  if (RM || !('IntersectionObserver' in window)) return;
  root.classList.add('motion');

  // Hero headline, word by word
  var h1 = document.querySelector('.hero h1');
  if (h1) {
    h1.setAttribute('aria-label', h1.textContent);
    h1.innerHTML = h1.textContent.split(' ').map(function (w, i) { return '<span class="w" aria-hidden="true" style="--i:' + i + '">' + w + '</span>'; }).join(' ');
  }
  var sheet = document.querySelector('.sheet');
  if (sheet) requestAnimationFrame(function () { requestAnimationFrame(function () { sheet.classList.add('go'); }); });

  function countUp(el, delay) {
    if (!el) return;
    var raw = el.textContent.trim(), m = raw.match(/^([^\d]*)([\d.]+)(.*)$/); if (!m) return;
    var pre = m[1], end = parseFloat(m[2]), post = m[3], dec = (m[2].split('.')[1] || '').length;
    el.textContent = pre + (0).toFixed(dec) + post;
    setTimeout(function () {
      var t0 = performance.now(), dur = 1400;
      (function step(now) { var k = Math.min(1, (now - t0) / dur); k = 1 - Math.pow(1 - k, 3); el.textContent = pre + (end * k).toFixed(dec) + post; if (k < 1) requestAnimationFrame(step); })(t0);
    }, delay || 0);
  }
  document.querySelectorAll('.sheet td.num').forEach(function (td, i) { countUp(td, 700 + i * 80); });

  var scrollTimeline = window.CSS && CSS.supports && CSS.supports('animation-timeline: view()') && matchMedia('(min-width: 60rem)').matches;
  var groups = [
    ['.head', ''], ['.now-grid > div:first-child', ''], ['.rows', 'scale'], ['.project-title', ''], ['.facts > div', ''], ['.pipe', 'scale'], ['.tools', ''],
    ['.pane-sticky > *', ''], ['.band-text > *', ''], ['.pool-frame', 'scale'], ['.transfer', ''],
    ['.figures > div', ''], ['.filters', ''], ['.pub', ''], ['.foot-note', ''], ['.tl > li', 'left'], ['.earlier-head', ''], ['.earlier article', ''],
    ['.proj', ''], ['.site-grid article', ''], ['[data-r]', ''], ['.portrait', 'scale'], ['.about-body > *', ''], ['.skills > div', ''], ['.courses', ''], ['.contact-card', 'scale']
  ];
  if (!scrollTimeline) groups.push(['.pane-scroll .fig', '']);
  var revealEls = [];
  groups.forEach(function (g) {
    var byParent = new Map();
    document.querySelectorAll(g[0]).forEach(function (el) {
      if (el.hasAttribute('data-reveal')) return;
      var n = byParent.get(el.parentNode) || 0; byParent.set(el.parentNode, n + 1);
      el.setAttribute('data-reveal', g[1]); el.style.setProperty('--i', Math.min(n, 6)); revealEls.push(el);
    });
  });
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var t = e.target; t.classList.add('in'); io.unobserve(t);
      if (t.matches('.figures > div')) countUp(t.querySelector('dd'), 200);
      if (t.matches('.pool-frame')) t.querySelectorAll('.big-pair b').forEach(function (b, i) { countUp(b, 300 + i * 200); });
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  revealEls.forEach(function (el) { io.observe(el); });
})();
