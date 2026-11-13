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
    function stop() { if (timer) { clearInterval(timer); timer = null; play.textContent = 'Play the steps'; } }
    if (play) play.addEventListener('click', function () {
      if (timer) return stop();
      play.textContent = 'Pause'; go(0);
      timer = setInterval(function () { if (cur >= steps.length - 1) return stop(); go(cur + 1); }, 3200);
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
