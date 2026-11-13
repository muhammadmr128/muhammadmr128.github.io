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
    ['now', 'work', 'research', 'journey', 'about', 'contact'].forEach(function (id) { var el = document.getElementById(id); if (el) so.observe(el); });
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

// ================= Motion layer (by request) =================
(function () {
  var root = document.documentElement;
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // R² bars in the hero sheet (drawn even without motion)
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

  // Scroll progress bar
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
        var p = Math.max(0, Math.min(1, (mid - r.top) / r.height));
        tl.style.setProperty('--p', RM ? 1 : p.toFixed(3));
        items.forEach(function (it) { it.classList.toggle('lit', RM || it.getBoundingClientRect().top + 24 < mid); });
      }
    });
  }
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); onScroll();

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

  // Count-up for figures
  function countUp(el, delay) {
    var raw = el.textContent.trim(), m = raw.match(/^([^\d]*)([\d.]+)(.*)$/); if (!m) return;
    var pre = m[1], end = parseFloat(m[2]), post = m[3], dec = (m[2].split('.')[1] || '').length;
    el.textContent = pre + (0).toFixed(dec) + post;
    setTimeout(function () {
      var t0 = performance.now(), dur = 1300;
      (function step(now) { var k = Math.min(1, (now - t0) / dur); k = 1 - Math.pow(1 - k, 3); el.textContent = pre + (end * k).toFixed(dec) + post; if (k < 1) requestAnimationFrame(step); })(t0);
    }, delay || 0);
  }
  document.querySelectorAll('.sheet td.num').forEach(function (td, i) { countUp(td, 700 + i * 90); });

  // Scroll reveals, staggered within each group
  var groups = [
    ['.head', ''], ['.rows > li', ''], ['.project-title', ''], ['.facts > div', ''], ['.pipe', 'scale'], ['.tools', ''],
    ['.figs > .fig, .fig-stack > .fig', ''], ['.chart-note', ''], ['.band-text', ''], ['.figures > div', ''], ['.filters', ''],
    ['.pub', ''], ['.foot-note', ''], ['.tl > li', 'left'], ['.earlier-head', ''], ['.earlier article', ''],
    ['.portrait', 'scale'], ['.about-body > *', ''], ['.skills > div', ''], ['.courses', ''],
    ['.contact h2', ''], ['.contact .mail', ''], ['.contact .lead', ''], ['.socials .btn', ''], ['.now-grid > div:first-child', '']
  ];
  var revealEls = [];
  groups.forEach(function (g) {
    var els = document.querySelectorAll(g[0]);
    var byParent = new Map();
    els.forEach(function (el) {
      var n = byParent.get(el.parentNode) || 0; byParent.set(el.parentNode, n + 1);
      el.setAttribute('data-reveal', g[1]); el.style.setProperty('--i', Math.min(n, 6)); revealEls.push(el);
    });
  });
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in'); io.unobserve(e.target);
      if (e.target.matches('.figures > div')) countUp(e.target.querySelector('dd'), 150);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  revealEls.forEach(function (el) { io.observe(el); });

  // Transfer chart and the big 243 / 14
  var tr = document.getElementById('c-transfer');
  var pair = document.querySelectorAll('.big-pair b');
  var io2 = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return; io2.unobserve(e.target);
      if (e.target === tr) tr.classList.add('in');
      else e.target.querySelectorAll('b').forEach(function (b, i) { countUp(b, i * 200); });
    });
  }, { threshold: 0.35 });
  if (tr) { tr.classList.add('transfer'); io2.observe(tr); }
  var bp = document.querySelector('.big-pair'); if (bp) io2.observe(bp);
})();
