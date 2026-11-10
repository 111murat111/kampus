// Çalışma araçları: yeniden kullanılabilir zihin haritası + bilgi kartı bileşenleri (window.Study)
// ve iki rota: /review (aralıklı tekrar merkezi), /mindmaps (zihin haritaları galerisi + detay).
(function () {
  const esc = (s) => App.esc(s);
  const SVGNS = 'http://www.w3.org/2000/svg';
  const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
  const PALETTE = ['#1e5b43', '#c8922c', '#b4472f', '#2c4a6b', '#5b6b1e'];
  const ON_PAL = ['#fffdf8', '#16150f', '#fffdf8', '#fffdf8', '#fffdf8'];
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const kbd = (k) => `<kbd class="st-kbd">${k}</kbd>`;
  const typing = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

  let _ctx = null;
  function textW(s, size, weight) {
    if (!_ctx) _ctx = document.createElement('canvas').getContext('2d');
    _ctx.font = `${weight} ${size}px ${FONT}`;
    return _ctx.measureText(s).width;
  }

  // ================= ZİHİN HARİTASI: model + yerleşim =================
  function buildTree(tree) {
    const nodes = [];
    const walk = (n, depth, parent, branch, id) => {
      const node = { id, label: String((n && n.label) ?? ''), depth, parent, branch, kids: [], open: true, x: 0, y: 0 };
      nodes.push(node);
      ((n && n.children) || []).forEach((c, i) => node.kids.push(walk(c, depth + 1, node, depth === 0 ? i : branch, id + '-' + i)));
      return node;
    };
    const root = walk(tree || { label: '' }, 0, null, -1, 'n');
    nodes.forEach(n => {
      n.fs = n.depth === 0 ? 17 : n.depth === 1 ? 14.5 : 13.5;
      n.fw = n.depth <= 1 ? 600 : 500;
      n.h = n.depth === 0 ? 48 : n.depth === 1 ? 38 : 32;
      n.w = Math.max(n.depth === 0 ? 120 : 56, Math.ceil(textW(n.label, n.fs, n.fw)) + (n.depth === 0 ? 46 : 30));
    });
    return { root, nodes };
  }
  const GX = 46, GY = 12;
  function subH(n) {
    const ks = n.open ? n.kids : [];
    if (!ks.length) return n.h;
    return Math.max(n.h, ks.reduce((a, k) => a + subH(k), 0) + GY * (ks.length - 1));
  }
  // İki yönlü (sağ/sol) yatay ağaç; kök merkezde.
  function layoutTree(root) {
    const vis = [root]; root.x = 0; root.y = 0; root.side = 1;
    const place = (n, side, edge, top) => {
      n.side = side; n.x = edge + side * n.w / 2; n.y = top + subH(n) / 2; vis.push(n);
      const ks = n.open ? n.kids : [];
      if (!ks.length) return;
      const s = ks.reduce((a, k) => a + subH(k), 0) + GY * (ks.length - 1);
      let y = n.y - s / 2; const outer = edge + side * (n.w + GX);
      ks.forEach(k => { place(k, side, outer, y); y += subH(k) + GY; });
    };
    const kids = root.open ? root.kids : [];
    const half = Math.ceil(kids.length / 2);
    [[kids.slice(0, half), 1], [kids.slice(half), -1]].forEach(([list, side]) => {
      const gap = GY * 2.4;
      const total = list.reduce((a, k) => a + subH(k), 0) + gap * Math.max(0, list.length - 1);
      let y = -total / 2;
      list.forEach(k => { place(k, side, side * (root.w / 2 + GX * 1.5), y); y += subH(k) + gap; });
    });
    return vis;
  }
  function linkPath(p, c) {
    const s = c.side;
    const x1 = p.x + s * (p.depth === 0 ? p.w / 2 - 12 : p.w / 2), y1 = p.y;
    const x2 = c.x - s * c.w / 2, y2 = c.y;
    const mx = (x1 + x2) / 2;
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} C${mx.toFixed(1)} ${y1.toFixed(1)}, ${mx.toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  const colorOf = (n) => n.depth === 0 ? 'var(--text)' : PALETTE[n.branch % PALETTE.length];
  function bbox(vis) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    vis.forEach(n => { x0 = Math.min(x0, n.x - n.w / 2 - 14); x1 = Math.max(x1, n.x + n.w / 2 + 14); y0 = Math.min(y0, n.y - n.h / 2); y1 = Math.max(y1, n.y + n.h / 2); });
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }

  // Galeri için küçük, statik önizleme (metinsiz haplar).
  function mindmapThumb(tree, w = 320, h = 180) {
    const { root } = buildTree(tree);
    const vis = layoutTree(root); const b = bbox(vis);
    const k = Math.min((w - 24) / b.w, (h - 24) / b.h);
    const tx = w / 2 - (b.x0 + b.w / 2) * k, ty = h / 2 - (b.y0 + b.h / 2) * k;
    const links = vis.filter(n => n.parent).map(n => `<path d="${linkPath(n.parent, n)}" stroke="${colorOf(n)}" stroke-width="${n.depth === 1 ? 3.2 : 2}" fill="none" opacity=".5"/>`).join('');
    const pills = vis.map(n => {
      const c = colorOf(n);
      const fill = n.depth === 0 ? 'var(--text)' : n.depth === 1 ? c : 'var(--surface-solid)';
      return `<rect x="${(n.x - n.w / 2).toFixed(1)}" y="${(n.y - n.h / 2).toFixed(1)}" width="${n.w}" height="${n.h}" rx="${n.h / 2}" style="fill:${fill}" ${n.depth >= 2 ? `stroke="${c}" stroke-width="2.4"` : ''}/>` +
        (n.depth === 0 ? `<text x="${n.x}" y="${n.y + 6}" text-anchor="middle" font-size="17" font-weight="600" style="fill:var(--bg);font-family:${FONT.replace(/"/g, "'")}">${esc(n.label)}</text>` : '');
    }).join('');
    return `<svg class="st-thumb" viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${k.toFixed(4)})">${links}${pills}</g></svg>`;
  }

  // ================= ZİHİN HARİTASI: etkileşimli bileşen =================
  function mindmap(container, tree, opts = {}) {
    const interactive = opts.interactive !== false;
    const height = opts.height || (interactive ? 520 : 300);
    const { root, nodes } = buildTree(tree);
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    const maxDepth = nodes.reduce((m, n) => Math.max(m, n.depth), 0);
    const quizDepth = maxDepth >= 2 ? 2 : 1;
    const quizable = nodes.filter(n => n.depth >= quizDepth);

    const wrap = document.createElement('div');
    wrap.className = 'st-mm' + (interactive ? ' is-interactive' : ' is-static') + (reduced() ? ' no-motion' : '');
    wrap.style.height = typeof height === 'number' ? height + 'px' : height;
    if (interactive) { wrap.tabIndex = 0; wrap.setAttribute('role', 'application'); wrap.setAttribute('aria-label', 'Zihin haritası: ' + root.label); }
    wrap.innerHTML = `
      <svg class="st-mm-svg" xmlns="${SVGNS}"><g class="st-mm-view"><g class="st-mm-links"></g><g class="st-mm-nodes"></g></g></svg>
      ${interactive ? `
      <div class="st-mm-tools" role="toolbar" aria-label="Harita araçları">
        <button type="button" class="st-mm-btn" data-act="quiz" title="Kendini sına (S)">🎯 <span>Kendini sına</span></button>
        <button type="button" class="st-mm-btn" data-act="all" title="Tümünü aç/kapat (A)">↕ <span>Tümünü kapat</span></button>
        <button type="button" class="st-mm-btn" data-act="fit" title="Sığdır (F)">⤢ <span>Sığdır</span></button>
        <span class="st-mm-zoom"><button type="button" class="st-mm-btn icon" data-act="out" title="Uzaklaş (−)" aria-label="Uzaklaş">−</button><button type="button" class="st-mm-btn icon" data-act="in" title="Yakınlaş (+)" aria-label="Yakınlaş">+</button></span>
        <button type="button" class="st-mm-btn icon" data-act="full" title="Tam ekran" aria-label="Tam ekran">⛶</button>
      </div>
      <div class="st-mm-quiz" hidden>
        <div class="st-mm-quiz-t"><b>Kendini sına</b> <span class="st-mm-quiz-n"></span></div>
        <div class="st-mm-quiz-bar"><span></span></div>
        <div class="st-mm-quiz-sub">Gizli kavramları hatırlamaya çalış, sonra tıklayıp kontrol et.</div>
      </div>
      <div class="st-mm-hint">${kbd('Sürükle')} kaydır · ${kbd('Tekerlek')} yakınlaş · ${kbd('Tıkla')} dalı aç/kapat · ${kbd('F')} sığdır · ${kbd('A')} tümü · ${kbd('S')} sına</div>` : ''}`;
    container.appendChild(wrap);
    const svg = wrap.querySelector('svg'), viewG = wrap.querySelector('.st-mm-view'), linksG = wrap.querySelector('.st-mm-links'), nodesG = wrap.querySelector('.st-mm-nodes');
    const nodeEls = new Map(), linkEls = new Map();
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
    let view = { x: 0, y: 0, k: 1 }, autoFit = true, vis = [], destroyed = false;
    let quiz = false, lastQuiz = false, revealed = new Set(), quizDone = false;

    const tr = (x, y) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    function applyView(animate) {
      if (animate && !reduced()) { viewG.classList.add('st-anim'); later(() => viewG.classList.remove('st-anim'), 420); }
      viewG.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.k})`;
    }
    function size() { return { W: wrap.clientWidth || container.clientWidth || 800, H: wrap.clientHeight || height }; }
    function fit(animate = true) {
      if (!vis.length) return;
      const b = bbox(vis); const { W, H } = size();
      const padX = 28, padTop = interactive ? 64 : 18, padBot = interactive ? 44 : 18;
      const k = clamp(Math.min((W - padX * 2) / b.w, (H - padTop - padBot) / b.h), 0.25, interactive ? 1.25 : 1);
      view = { k, x: W / 2 - (b.x0 + b.w / 2) * k, y: padTop + (H - padTop - padBot) / 2 - (b.y0 + b.h / 2) * k };
      applyView(animate);
    }
    function zoomAt(px, py, k) {
      k = clamp(k, 0.25, 3);
      view.x = px - (px - view.x) * k / view.k; view.y = py - (py - view.y) * k / view.k; view.k = k;
      applyView(false);
    }

    const isHidden = (n) => quiz && n.depth >= quizDepth && !revealed.has(n.id);
    function makeNode(n) {
      const g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', `st-mm-node d${Math.min(n.depth, 2)}`);
      g.dataset.id = n.id;
      const c = colorOf(n);
      const rectStyle = n.depth === 0 ? 'fill:var(--text)' : n.depth === 1 ? `fill:${c}` : `fill:var(--surface-solid);stroke:${c}`;
      const txtStyle = n.depth === 0 ? 'fill:var(--bg)' : n.depth === 1 ? `fill:${ON_PAL[n.branch % ON_PAL.length]}` : 'fill:var(--text)';
      g.innerHTML = `<g class="st-mm-pop"><rect class="st-mm-pill" x="${-n.w / 2}" y="${-n.h / 2}" width="${n.w}" height="${n.h}" rx="${n.h / 2}" style="${rectStyle}"/>
        <text class="st-mm-label" y="${n.fs * 0.36}" text-anchor="middle" font-size="${n.fs}" font-weight="${n.fw}" style="${txtStyle}">${esc(n.label)}</text>
        ${n.kids.length && n.depth > 0 ? `<g class="st-mm-badge" transform="translate(${n.side * (n.w / 2 + 2)} 0)"><circle r="9" style="stroke:${c}"/><text y="3.6" text-anchor="middle" font-size="10.5" font-weight="700" style="fill:${c}"></text></g>` : ''}</g>`;
      if (interactive) { g.setAttribute('role', 'button'); g.setAttribute('aria-label', n.label); }
      return g;
    }
    function refreshNode(g, n) {
      const hidden = isHidden(n);
      g.classList.toggle('is-hidden', hidden);
      g.classList.toggle('has-kids', n.kids.length > 0);
      g.classList.toggle('is-closed', !n.open);
      const t = g.querySelector('.st-mm-label'); t.textContent = hidden ? '?' : n.label;
      const badge = g.querySelector('.st-mm-badge');
      if (badge) { badge.setAttribute('transform', `translate(${n.side * (n.w / 2 + 2)} 0)`); badge.querySelector('text').textContent = n.open ? '−' : '+' + n.kids.length; }
    }

    function update(first) {
      const prev = {}; nodes.forEach(n => prev[n.id] = { x: n.x, y: n.y });
      vis = layoutTree(root);
      const visIds = new Set(vis.map(n => n.id));
      const stagger = first && !reduced();
      const sibIdx = (n) => n.parent ? n.parent.kids.indexOf(n) : 0;
      const delayOf = (n) => n.depth === 0 ? 0 : Math.min(900, 120 + (n.depth - 1) * 230 + (n.depth === 1 ? sibIdx(n) * 70 : (n.parent.branch * 40 + sibIdx(n) * 45)));
      const pending = [];
      vis.forEach(n => {
        let g = nodeEls.get(n.id);
        if (!g) {
          g = makeNode(n); nodesG.appendChild(g); nodeEls.set(n.id, g);
          const from = first || !n.parent ? { x: n.x, y: n.y } : prev[n.parent.id];
          g.style.transform = tr(from.x, from.y); g.style.opacity = '0';
          if (stagger) { g.style.transitionDelay = delayOf(n) + 'ms'; g.classList.add('is-enter'); }
          pending.push([g, n]);
        } else pending.push([g, n]);
        refreshNode(g, n);
        if (n.parent) {
          let p = linkEls.get(n.id); const d = linkPath(n.parent, n);
          if (!p) {
            p = document.createElementNS(SVGNS, 'path');
            p.setAttribute('class', 'st-mm-link d' + Math.min(n.depth, 3));
            p.setAttribute('pathLength', '1'); p.style.stroke = colorOf(n);
            p.setAttribute('d', d); p.style.d = `path("${d}")`;
            p.style.strokeDasharray = '1 1'; p.style.strokeDashoffset = '1';
            if (stagger) p.style.transitionDelay = Math.max(0, delayOf(n) - 80) + 'ms';
            linksG.appendChild(p); linkEls.set(n.id, p);
            pending.push([p, null]);
          } else { p.setAttribute('d', d); p.style.d = `path("${d}")`; }
        }
      });
      nodeEls.forEach((g, id) => {
        if (visIds.has(id)) return;
        let a = byId[id].parent; while (a && !visIds.has(a.id)) a = a.parent;
        g.style.transitionDelay = ''; g.style.pointerEvents = 'none';
        if (a) g.style.transform = tr(a.x, a.y);
        g.style.opacity = '0'; nodeEls.delete(id); later(() => g.remove(), 400);
      });
      linkEls.forEach((p, id) => {
        if (visIds.has(id)) return;
        p.style.transitionDelay = ''; p.style.strokeDashoffset = '1'; p.style.opacity = '0'; linkEls.delete(id); later(() => p.remove(), 400);
      });
      svg.getBoundingClientRect(); // reflow → geçişler tetiklensin
      pending.forEach(([el, n]) => {
        if (n) { el.style.transform = tr(n.x, n.y); el.style.opacity = '1'; } else el.style.strokeDashoffset = '0';
      });
      if (stagger) later(() => { nodeEls.forEach(g => { g.style.transitionDelay = ''; g.classList.remove('is-enter'); }); linkEls.forEach(p => p.style.transitionDelay = ''); }, 1500);
      syncTools();
    }

    const allOpen = () => nodes.every(n => !n.kids.length || n.open);
    function toggleAll(force) {
      const open = force !== undefined ? force : !allOpen();
      nodes.forEach(n => { if (n.kids.length) n.open = open || n.depth === 0; });
      update(); if (autoFit || true) { autoFit = true; later(() => fit(true), 20); }
    }
    function setQuiz(on) {
      quiz = !!on; revealed = new Set(); quizDone = false;
      if (quiz) nodes.forEach(n => { if (n.kids.length) n.open = true; });
      wrap.classList.toggle('is-quiz', quiz);
      update(); autoFit = true; later(() => fit(true), 20);
      syncQuiz();
    }
    function syncQuiz() {
      const box = wrap.querySelector('.st-mm-quiz'); if (!box) return;
      box.hidden = !quiz;
      const n = quizable.filter(x => revealed.has(x.id)).length, t = quizable.length;
      box.querySelector('.st-mm-quiz-n').textContent = `${n} / ${t}`;
      box.querySelector('.st-mm-quiz-bar span').style.width = (t ? n / t * 100 : 0) + '%';
      box.classList.toggle('is-done', quizDone);
      box.querySelector('.st-mm-quiz-sub').textContent = quizDone ? 'Tamamlandı! Tüm kavramları açtın. 🎉' : 'Gizli kavramı hatırlamaya çalış, sonra tıklayıp kontrol et.';
    }
    function syncTools() {
      if (!interactive) return;
      const allB = wrap.querySelector('[data-act="all"] span'); if (allB) allB.textContent = allOpen() ? 'Tümünü kapat' : 'Tümünü aç';
      const qB = wrap.querySelector('[data-act="quiz"]'); if (qB) { qB.classList.toggle('on', quiz); qB.querySelector('span').textContent = quiz ? 'Sınamayı bitir' : 'Kendini sına'; }
      if (opts.onQuizChange && quiz !== lastQuiz) { lastQuiz = quiz; try { opts.onQuizChange(quiz); } catch (e) { console.error(e); } }
    }
    function nodeClick(id) {
      const n = byId[id]; if (!n) return;
      if (isHidden(n)) {
        revealed.add(n.id);
        const g = nodeEls.get(n.id);
        if (g) { refreshNode(g, n); g.classList.remove('just-revealed'); g.getBoundingClientRect(); g.classList.add('just-revealed'); }
        syncQuiz();
        if (!quizDone && quizable.every(x => revealed.has(x.id))) {
          quizDone = true; syncQuiz();
          if (opts.topicId) App.markMode(opts.topicId, 'mindmap');
          if (opts.onComplete) try { opts.onComplete(); } catch (e) { console.error(e); }
        }
        return;
      }
      if (n.depth === 0) { toggleAll(); return; }
      if (!n.kids.length) return;
      n.open = !n.open; update();
    }

    // ---- etkileşim ----
    const offs = [];
    const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };
    if (interactive) {
      const pts = new Map(); let drag = null, pinch = null, downId = null, moved = false;
      const local = (p) => { const r = svg.getBoundingClientRect(); return { x: p.x - r.left, y: p.y - r.top }; };
      on(svg, 'pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        try { wrap.focus({ preventScroll: true }); } catch (_) {}
        try { svg.setPointerCapture(e.pointerId); } catch (_) {}
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 1) {
          const g = e.target.closest && e.target.closest('.st-mm-node');
          downId = g ? g.dataset.id : null; moved = false;
          drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
        } else if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: view.k, m: local({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }), vx: view.x, vy: view.y };
          moved = true; downId = null;
        }
      });
      on(svg, 'pointermove', (e) => {
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch && pts.size >= 2) {
          const [a, b] = [...pts.values()];
          const k = clamp(pinch.k * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, 0.25, 3);
          const m = local({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
          view.x = m.x - (pinch.m.x - pinch.vx) * k / pinch.k; view.y = m.y - (pinch.m.y - pinch.vy) * k / pinch.k; view.k = k;
          autoFit = false; applyView(false); return;
        }
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!moved && Math.hypot(dx, dy) > 5) { moved = true; autoFit = false; wrap.classList.add('is-panning'); }
        if (moved) { view.x = drag.vx + dx; view.y = drag.vy + dy; applyView(false); }
      });
      const up = (e) => {
        if (!pts.has(e.pointerId)) return;
        pts.delete(e.pointerId);
        if (pts.size < 2) pinch = null;
        if (pts.size === 1) { const p = [...pts.values()][0]; drag = { x: p.x, y: p.y, vx: view.x, vy: view.y }; return; }
        if (pts.size === 0) {
          if (!moved && downId && e.type === 'pointerup') nodeClick(downId);
          drag = null; downId = null; wrap.classList.remove('is-panning');
        }
      };
      on(svg, 'pointerup', up); on(svg, 'pointercancel', up);
      on(svg, 'wheel', (e) => {
        e.preventDefault(); autoFit = false;
        const p = local({ x: e.clientX, y: e.clientY });
        const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        zoomAt(p.x, p.y, view.k * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)));
      }, { passive: false });
      const zoomBy = (f) => { autoFit = false; const { W, H } = size(); viewG.classList.add('st-anim'); later(() => viewG.classList.remove('st-anim'), 420); zoomAt(W / 2, H / 2, view.k * f); };
      const toggleFull = () => {
        if (document.fullscreenElement === wrap) { document.exitFullscreen && document.exitFullscreen(); return; }
        if (wrap.classList.contains('is-max')) { wrap.classList.remove('is-max'); later(() => fit(true), 30); return; }
        if (wrap.requestFullscreen) wrap.requestFullscreen().catch(() => { wrap.classList.add('is-max'); later(() => fit(true), 30); });
        else { wrap.classList.add('is-max'); later(() => fit(true), 30); }
      };
      on(wrap, 'click', (e) => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const a = b.dataset.act;
        if (a === 'fit') { autoFit = true; fit(true); }
        else if (a === 'all') toggleAll();
        else if (a === 'quiz') setQuiz(!quiz);
        else if (a === 'in') zoomBy(1.25);
        else if (a === 'out') zoomBy(0.8);
        else if (a === 'full') toggleFull();
      });
      on(wrap, 'keydown', (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
        const k = e.key.toLowerCase();
        if (k === 'f') { autoFit = true; fit(true); }
        else if (k === 'a') toggleAll();
        else if (k === 's') setQuiz(!quiz);
        else if (k === '+' || k === '=') zoomBy(1.25);
        else if (k === '-' || k === '_') zoomBy(0.8);
        else if (k === 'escape' && wrap.classList.contains('is-max')) { wrap.classList.remove('is-max'); later(() => fit(true), 30); }
        else if (e.key.startsWith('Arrow')) { const d = 40; autoFit = false; if (k === 'arrowleft') view.x += d; if (k === 'arrowright') view.x -= d; if (k === 'arrowup') view.y += d; if (k === 'arrowdown') view.y -= d; applyView(true); }
        else return;
        e.preventDefault();
      });
      on(document, 'fullscreenchange', () => { wrap.classList.toggle('is-full', document.fullscreenElement === wrap); later(() => { autoFit = true; fit(true); }, 60); });
    }
    let ro = null, lastW = 0, lastH = 0;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => { const { W, H } = size(); if (W === lastW && H === lastH) return; lastW = W; lastH = H; if (autoFit) fit(false); });
      ro.observe(wrap);
    }

    update(true); fit(false);
    return {
      destroy() {
        if (destroyed) return; destroyed = true;
        offs.forEach(f => f()); timers.forEach(t => clearTimeout(t)); timers.clear(); ro && ro.disconnect();
        if (document.fullscreenElement === wrap && document.exitFullscreen) document.exitFullscreen().catch(() => {});
        wrap.remove();
      },
      fit: () => { autoFit = true; fit(true); },
      expandAll: (v = true) => toggleAll(!!v),
      setQuiz: (v = true) => setQuiz(v),
      get quiz() { return quiz; },
      el: wrap
    };
  }

  // ================= BİLGİ KARTLARI =================
  const GRADES = [
    { g: 'again', label: 'Tekrar', key: '1' }, { g: 'hard', label: 'Zor', key: '2' },
    { g: 'good', label: 'İyi', key: '3' }, { g: 'easy', label: 'Kolay', key: '4' }
  ];
  function nextBox(box, g) { return g === 'again' ? 1 : g === 'hard' ? Math.max(1, box) : g === 'good' ? Math.min(5, box + 1) : Math.min(5, box + 2); }
  function intervalLabel(key, g) { const s = App.cardState(key); const b = nextBox(s ? s.box : 0, g); return App.BOX_DAYS[b] + 'g'; }

  function flashcards(container, cards, opts = {}) {
    const srs = opts.srs !== false;
    const deck = (cards || []).filter(c => c && c.key);
    const root = document.createElement('div');
    root.className = 'st-fc' + (reduced() ? ' no-motion' : '');
    container.appendChild(root);
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
    let queue, pos, flipped, busy, done, firstGrade, counts, t0, xp0, finished, dragOff = null;

    function reset() {
      queue = deck.slice(); pos = 0; flipped = false; busy = false; done = new Set(); firstGrade = {};
      counts = { again: 0, hard: 0, good: 0, easy: 0 }; t0 = Date.now(); xp0 = App.me() ? App.me().xp : 0; finished = false;
    }
    function topicTitle(c) { const t = c.topicId && App.topic(c.topicId); return t ? t.title : ''; }
    // Kaynak gösterimi (CC BY-SA): kartın türetildiği Vikipedi maddesi.
    function cardSource(c) {
      const t = c.topicId && App.topic(c.topicId); const src = t && t.source; if (!src || !src.url) return '';
      const link = (href, label) => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
      return `<p class="src-note st-fc-src">Bu kart ${link(src.url, '«' + (src.title || t.title) + '»')} ${esc(src.name || 'Vikipedi')} maddesinden otomatik türetilmiştir · ${src.licenseUrl ? link(src.licenseUrl, src.license || 'CC BY-SA 4.0') : esc(src.license || 'CC BY-SA 4.0')}</p>`;
    }

    function renderCard() {
      if (dragOff) { dragOff(); dragOff = null; }
      if (!deck.length) { root.innerHTML = App.emptyState('🃏', 'Bu destede kart yok', 'Çalışılacak kart bulunamadı.'); return; }
      if (pos >= queue.length) return summary();
      const c = queue[pos]; flipped = false; busy = false;
      const pct = Math.round(done.size / deck.length * 100);
      const again = pos > 0 && queue.indexOf(c) < pos;
      const tt = topicTitle(c);
      root.innerHTML = `
        <div class="st-fc-top">
          <span class="st-fc-count"><b>${Math.min(done.size + 1, deck.length)}</b> / ${deck.length}</span>
          <div class="st-fc-prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
          <span class="st-fc-left">${queue.length - pos - 1 > 0 ? `${queue.length - pos - 1} kart kaldı` : 'Son kart'}</span>
        </div>
        <div class="st-fc-stage">
          <div class="st-fc-card" tabindex="-1">
            <div class="st-fc-swipe l">↺ ${srs ? 'Tekrar' : 'Bilemedim'}</div><div class="st-fc-swipe r">${srs ? 'İyi' : 'Bildim'} ✓</div>
            <div class="st-fc-inner">
              <div class="st-fc-face st-fc-front">
                <div class="st-fc-meta">${tt ? `<span class="tag">${esc(tt)}</span>` : ''}${again ? '<span class="tag accent">Yeniden</span>' : ''}${srs && !App.cardState(c.key) ? '<span class="tag primary">Yeni kart</span>' : ''}</div>
                <div class="st-fc-q">${esc(c.q)}</div>
                <div class="st-fc-tap">Çevirmek için dokun ya da ${kbd('Boşluk')}</div>
              </div>
              <div class="st-fc-face st-fc-back">
                <div class="st-fc-meta"><span class="st-fc-qsmall">${esc(c.q)}</span></div>
                <div class="st-fc-a">${esc(c.a)}</div>
                <div class="st-fc-tap">Ne kadar iyi hatırladın?</div>
              </div>
            </div>
          </div>
        </div>
        <div class="st-fc-actions">
          <button type="button" class="btn primary st-fc-flipbtn" data-flip>Kartı çevir ${kbd('Boşluk')}</button>
          <div class="st-fc-grades" hidden>
            ${srs ? GRADES.map(x => `<button type="button" class="st-fc-g g-${x.g}" data-g="${x.g}"><b>${x.label}</b><small>${intervalLabel(c.key, x.g)}</small>${kbd(x.key)}</button>`).join('')
              : `<button type="button" class="st-fc-g g-again" data-g="again"><b>Bilemedim</b><small>tekrar gelecek</small>${kbd('1')}</button><button type="button" class="st-fc-g g-good" data-g="good"><b>Bildim</b><small>sonraki kart</small>${kbd('2')}</button>`}
          </div>
        </div>
        <div class="st-fc-keys">${kbd('Boşluk')} çevir · ${srs ? `${kbd('1')}–${kbd('4')} değerlendir` : `${kbd('1')} bilemedim · ${kbd('2')} bildim`} · ${kbd('←')} ${kbd('→')} ya da kaydır</div>
        ${cardSource(c)}`;
      bindSwipe();
    }
    function setFlip(v) {
      if (finished || busy) return;
      flipped = v;
      const card = root.querySelector('.st-fc-card'); if (!card) return;
      card.classList.toggle('is-flipped', flipped);
      root.querySelector('[data-flip]').hidden = flipped;
      root.querySelector('.st-fc-grades').hidden = !flipped;
    }
    function grade(g) {
      if (finished || busy || !flipped) return;
      const c = queue[pos]; busy = true;
      let st = null;
      const wasNew = srs && !App.cardState(c.key);
      if (srs) st = App.reviewCard(c.key, g);
      if (!(c.key in firstGrade)) firstGrade[c.key] = g;
      counts[g] = (counts[g] || 0) + 1;
      if (g === 'again') queue.push(c); else done.add(c.key);
      if (opts.onGrade) try { opts.onGrade(c, g, st, wasNew); } catch (e) { console.error(e); }
      const card = root.querySelector('.st-fc-card');
      const btn = root.querySelector(`[data-g="${g}"]`); btn && btn.classList.add('is-picked');
      if (card) { card.style.transform = ''; card.classList.add(g === 'again' || g === 'hard' ? 'out-l' : 'out-r'); }
      later(() => { pos++; renderCard(); }, reduced() ? 0 : 240);
    }
    function summary() {
      finished = true;
      const total = deck.length;
      const correct = deck.filter(c => firstGrade[c.key] && firstGrade[c.key] !== 'again').length;
      const acc = total ? Math.round(correct / total * 100) : 0;
      const xp = Math.max(0, (App.me() ? App.me().xp : 0) - xp0);
      const minutes = Math.max(0, Math.round((Date.now() - t0) / 60000));
      const boxes = [0, 0, 0, 0, 0];
      if (srs) deck.forEach(c => { const s = App.cardState(c.key); if (s && s.box >= 1) boxes[Math.min(5, s.box) - 1]++; });
      const stats = { total, reviewed: pos, correct, accuracy: acc, xp, minutes, again: counts.again, hard: counts.hard, good: counts.good, easy: counts.easy, boxes };
      if (minutes >= 1) App.logStudy(minutes);
      const maxB = Math.max(1, ...boxes);
      const msg = acc >= 90 ? 'Muhteşem! Bu kartlar artık senin.' : acc >= 70 ? 'Çok iyi gidiyorsun, birkaç kart daha oturacak.' : acc >= 40 ? 'Güzel bir başlangıç — tekrar ettikçe kalıcı olacak.' : 'Zorlandığın kartlar sık sık karşına çıkacak, merak etme.';
      root.innerHTML = `
        <div class="st-fc-sum">
          <div class="st-fc-sum-ring">${App.ring(acc, 112, 9, 'var(--primary)')}<div><b>%${acc}</b><small>ilk seferde</small></div></div>
          <h2 class="serif">Deste bitti!</h2>
          <p class="muted">${msg}</p>
          <div class="st-fc-sum-stats">
            <div><b>${total}</b><span>kart</span></div>
            <div><b>${correct}</b><span>ilk seferde bildin</span></div>
            ${srs ? `<div class="xp"><b>+${xp}</b><span>XP kazandın</span></div>` : ''}
            <div><b>${minutes < 1 ? '<1' : minutes}</b><span>dakika</span></div>
          </div>
          ${srs ? `<div class="st-fc-sum-boxes"><div class="st-fc-sum-h">Kartların şimdi hangi kutuda?</div>
            <div class="st-boxbars">${boxes.map((n, i) => `<div class="st-boxbar"><div class="st-boxbar-col"><span style="height:${Math.round(n / maxB * 100)}%"></span></div><b>${n}</b><small>${i + 1}. kutu · ${App.BOX_DAYS[i + 1]}g</small></div>`).join('')}</div></div>` : ''}
          <div class="st-fc-sum-grades">${srs ? GRADES.map(x => `<span class="st-chip g-${x.g}">${x.label} <b>${counts[x.g]}</b></span>`).join('') : `<span class="st-chip g-good">Bildim <b>${counts.good}</b></span><span class="st-chip g-again">Bilemedim <b>${counts.again}</b></span>`}</div>
          <div class="st-fc-sum-actions">
            ${!srs || opts.restart ? '<button type="button" class="btn" data-restart>↻ Desteyi yeniden çalış</button>' : ''}
            ${opts.onExit ? `<button type="button" class="btn primary" data-exit>${esc(opts.exitLabel || 'Bitir')}</button>` : ''}
          </div>
        </div>`;
      if (opts.onDone) try { opts.onDone(stats); } catch (e) { console.error(e); }
    }

    function bindSwipe() {
      const card = root.querySelector('.st-fc-card'); if (!card) return;
      let sx = 0, sy = 0, dx = 0, id = null, dragging = false;
      const L = card.querySelector('.st-fc-swipe.l'), R = card.querySelector('.st-fc-swipe.r');
      const down = (e) => { if (busy || (e.pointerType === 'mouse' && e.button !== 0)) return; id = e.pointerId; sx = e.clientX; sy = e.clientY; dx = 0; dragging = false; try { card.setPointerCapture(id); } catch (_) {} };
      const move = (e) => {
        if (e.pointerId !== id) return;
        dx = e.clientX - sx; const dy = e.clientY - sy;
        if (!dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { dragging = true; card.classList.add('is-drag'); }
        if (!dragging) return;
        card.style.transform = `translateX(${dx}px) rotate(${dx / 24}deg)`;
        const f = clamp(Math.abs(dx) / 110, 0, 1);
        L.style.opacity = dx < 0 && flipped ? f : 0; R.style.opacity = dx > 0 && flipped ? f : 0;
      };
      const up = (e) => {
        if (e.pointerId !== id) return; id = null;
        card.classList.remove('is-drag'); L.style.opacity = 0; R.style.opacity = 0;
        if (!dragging) { setFlip(!flipped); return; }
        dragging = false;
        if (Math.abs(dx) > 100 && flipped) { grade(dx > 0 ? 'good' : 'again'); return; }
        card.style.transform = '';
        if (Math.abs(dx) > 100 && !flipped) setFlip(true);
      };
      card.addEventListener('pointerdown', down); card.addEventListener('pointermove', move);
      card.addEventListener('pointerup', up); card.addEventListener('pointercancel', up);
      dragOff = () => { card.removeEventListener('pointerdown', down); card.removeEventListener('pointermove', move); card.removeEventListener('pointerup', up); card.removeEventListener('pointercancel', up); };
    }

    const onClick = (e) => {
      if (e.target.closest('[data-flip]')) setFlip(true);
      const g = e.target.closest('[data-g]'); if (g) grade(g.dataset.g);
      if (e.target.closest('[data-restart]')) { reset(); renderCard(); }
      if (e.target.closest('[data-exit]') && opts.onExit) opts.onExit();
    };
    const onKey = (e) => {
      if (!root.isConnected) { document.removeEventListener('keydown', onKey); return; }
      if (finished || e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || document.querySelector('#modal-root .modal')) return;
      const k = e.key;
      if (k === ' ' || k === 'Spacebar') { e.preventDefault(); setFlip(!flipped); return; }
      if (k === 'Enter' && !flipped) { e.preventDefault(); setFlip(true); return; }
      if (!flipped) { if (/^[1-4]$/.test(k) || k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); setFlip(true); } return; }
      let g = null;
      if (srs) g = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' }[k] || null;
      else g = { 1: 'again', 2: 'good' }[k] || null;
      if (k === 'ArrowLeft') g = 'again'; if (k === 'ArrowRight') g = 'good';
      if (g) { e.preventDefault(); grade(g); }
    };
    root.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    reset(); renderCard();
    return {
      destroy() {
        document.removeEventListener('keydown', onKey); root.removeEventListener('click', onClick);
        if (dragOff) dragOff(); timers.forEach(t => clearTimeout(t)); timers.clear(); root.remove();
      },
      el: root
    };
  }

  window.Study = { mindmap, flashcards, mindmapThumb };

  // ================= ROTA: /review =================
  const NEW_LIMIT = 10;
  const BOX_INFO = [
    { name: 'Yeni öğrenilen', tip: 'Her gün' }, { name: 'Tanıdık', tip: '2 günde bir' }, { name: 'Oturuyor', tip: '4 günde bir' },
    { name: 'Sağlam', tip: 'Haftada bir' }, { name: 'Kalıcı hafıza', tip: '15 günde bir' }
  ];
  function newToday() { const me = App.me(); const r = me.stNew; return r && r.day === App.today() ? r.n : 0; }
  function bumpNew() { const me = App.me(); const d = App.today(); if (!me.stNew || me.stNew.day !== d) me.stNew = { day: d, n: 0 }; me.stNew.n++; App.save(); }
  function addDays(n) { const d = new Date(App.now()); d.setDate(d.getDate() + n); return d; }

  function reviewData(cid) {
    const me = App.me(); const today = App.today();
    const ids = cid ? [cid] : me.enrolled;
    const all = App.allCards(ids);
    const due = all.filter(c => { const s = me.cards[c.key]; return s && s.due <= today; })
      .sort((a, b) => (me.cards[a.key].box - me.cards[b.key].box) || me.cards[a.key].due.localeCompare(me.cards[b.key].due));
    const fresh = all.filter(c => !me.cards[c.key]);
    const left = Math.max(0, NEW_LIMIT - newToday());
    const boxes = [0, 0, 0, 0, 0];
    all.forEach(c => { const s = me.cards[c.key]; if (s && s.box >= 1) boxes[Math.min(5, s.box) - 1]++; });
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(i), key = App.ymd(d);
      const n = all.filter(c => { const s = me.cards[c.key]; return s && (i === 0 ? s.due <= key : s.due === key); }).length;
      days.push({ d, key, n });
    }
    const last = App.ymd(addDays(6));
    const later = all.filter(c => { const s = me.cards[c.key]; return s && s.due > last; }).length;
    return { all, due, fresh, freshToday: fresh.slice(0, left), left, boxes, days, later };
  }

  function reviewPage() {
    const me = App.me(); const q = App.query();
    const courses = App.myCourses();
    const cid = courses.some(c => c.id === q.c) ? q.c : '';
    const D = reviewData(cid);
    const chips = [`<a class="st-fchip ${!cid ? 'on' : ''}" href="#/review">Tümü <b>${App.dueCards().length}</b></a>`]
      .concat(courses.map(c => { const n = reviewData(c.id).due.length; return `<a class="st-fchip ${cid === c.id ? 'on' : ''}" href="#/review?c=${esc(c.id)}"><span class="dot" style="background:${esc(c.color)}"></span>${esc(c.title.split(':')[0])} <b>${n}</b></a>`; })).join('');
    const total = D.due.length + D.freshToday.length;
    const maxDay = Math.max(1, ...D.days.map(d => d.n));
    const nextDay = D.days.find((d, i) => i > 0 && d.n > 0);
    const totalBoxes = D.boxes.reduce((a, b) => a + b, 0);

    let hero;
    if (!courses.length || !D.all.length) {
      hero = `<div class="card st-rv-hero is-empty">${App.emptyState('🌱', 'Henüz tekrar edecek kartın yok', 'Bir kursa kaydol; her konudaki bilgi kartları burada, tam unutmak üzereyken karşına çıksın.', '<a class="btn primary" href="#/discover">Kurs keşfet</a>')}</div>`;
    } else if (!total) {
      hero = `<div class="card st-rv-hero is-empty">
        <div class="st-rv-done">
          <div class="st-rv-done-ic">✓</div>
          <div><h2 class="serif">Bugünlük hepsi bu — harika iş!</h2>
          <p class="muted">Beynin bilgileri yerleştirirken dinlenmeyi hak ettin. ${nextDay ? `Sıradaki tekrar <b>${nextDay.d.toLocaleDateString('tr-TR', { weekday: 'long' })}</b>: ${nextDay.n} kart.` : ''}${D.left === 0 && D.fresh.length ? ' Günlük yeni kart limitine ulaştın; yarın ' + Math.min(NEW_LIMIT, D.fresh.length) + ' yeni kart seni bekliyor.' : ''}</p>
          <div class="row" style="flex-wrap:wrap"><a class="btn primary" href="#/mindmaps">🗺️ Zihin haritalarına göz at</a><a class="btn" href="#/practice">📝 Soru çöz</a></div></div>
        </div></div>`;
    } else {
      const mins = Math.max(1, Math.round(total * 12 / 60));
      hero = `<div class="card st-rv-hero">
        <div class="st-rv-hero-main">
          <div class="st-rv-eyebrow">Bugünün destesi</div>
          <div class="st-rv-big"><span class="serif">${total}</span> kart <small class="muted">· yaklaşık ${mins} dk</small></div>
          <div class="st-rv-split">
            <span><i class="st-dot due"></i><b>${D.due.length}</b> tekrar zamanı gelen</span>
            <span><i class="st-dot new"></i><b>${D.freshToday.length}</b> yeni kart <small class="muted">(günlük ${NEW_LIMIT}, bugün ${newToday()} öğrenildi)</small></span>
          </div>
          <div class="st-rv-cta">
            <button class="btn primary st-rv-start" data-start="all">Tekrara başla ${kbd('Enter')}</button>
            ${D.due.length && D.freshToday.length ? `<button class="btn" data-start="due">Yalnız tekrarlar (${D.due.length})</button><button class="btn ghost" data-start="new">Yalnız yeni (${D.freshToday.length})</button>` : ''}
          </div>
        </div>
        <div class="st-rv-stack" aria-hidden="true"><span></span><span></span><span><em>${esc((D.due[0] || D.freshToday[0]).q)}</em></span></div>
      </div>`;
    }

    return `
      <div class="st-rv" id="st-rv">
        <div class="page-head"><div><h1>Tekrar</h1><p class="muted">Aralıklı tekrar: her kart, tam unutmak üzereyken karşına çıkar. Günde 10 dakika yeter.</p></div></div>
        <div class="st-fchips">${chips}</div>
        <div id="st-rv-overview">
          ${hero}
          ${D.all.length ? `
          <div class="st-rv-grid">
            <div class="card st-rv-boxes">
              <div class="card-head"><h3>Leitner kutuların</h3><span class="muted small">${totalBoxes} kart kutularda · ${D.fresh.length} henüz görülmedi</span></div>
              <div class="st-leitner">
                ${D.boxes.map((n, i) => `<div class="st-lbox b${i + 1}">
                  <div class="st-lbox-stack">${Array.from({ length: Math.min(6, n) }, (_, j) => `<i style="bottom:${j * 5}px"></i>`).join('')}</div>
                  <div class="st-lbox-face"><b>${n}</b><span>${i + 1}. kutu</span></div>
                  <div class="st-lbox-days">${App.BOX_DAYS[i + 1]}g</div>
                  <div class="st-lbox-name">${BOX_INFO[i].name}<small>${BOX_INFO[i].tip}</small></div>
                </div>${i < 4 ? '<div class="st-lbox-arrow" aria-hidden="true">→</div>' : ''}`).join('')}
              </div>
              <p class="muted small st-rv-rule">Bildiğin kart bir sonraki kutuya geçer ve daha seyrek gelir; unuttuğun kart <b>1. kutuya</b> döner. 5. kutuya ulaşan bilgi uzun süreli hafızana yerleşmiştir.</p>
            </div>
            <div class="card st-rv-cal">
              <div class="card-head"><h3>Önümüzdeki 7 gün</h3><span class="muted small">${D.later ? `+${D.later} kart daha sonra` : ''}</span></div>
              <div class="st-cal">
                ${D.days.map((d, i) => `<div class="st-cal-day ${i === 0 ? 'today' : ''}" title="${d.n} kart">
                  <span class="st-cal-n">${d.n || ''}</span>
                  <div class="st-cal-col"><span style="height:${d.n ? Math.max(6, Math.round(d.n / maxDay * 100)) : 0}%"></span></div>
                  <span class="st-cal-l">${i === 0 ? 'Bugün' : i === 1 ? 'Yarın' : d.d.toLocaleDateString('tr-TR', { weekday: 'short' })}</span>
                  <small>${d.d.getDate()}</small>
                </div>`).join('')}
              </div>
              <p class="muted small">Bugün sütunu gecikmiş kartları da içerir. Düzenli tekrar yığılmayı önler.</p>
            </div>
          </div>` : ''}
        </div>
        <div id="st-rv-stage" class="st-rv-stage" hidden></div>
        ${D.all.length ? '<p class="src-note">Kartlar Türkçe Vikipedi maddelerinden otomatik türetilmiştir (CC BY-SA 4.0). Her kartın altında kaynak maddesi gösterilir · <a href="#/sources">Kaynaklar ve lisanslar</a></p>' : ''}
      </div>`;
  }

  function reviewAfter() {
    const host = document.getElementById('st-rv'); if (!host) return;
    const q = App.query(); const cid = App.myCourses().some(c => c.id === q.c) ? q.c : '';
    let inst = null;
    const start = (which) => {
      const D = reviewData(cid);
      const list = which === 'due' ? D.due : which === 'new' ? D.freshToday : D.due.concat(D.freshToday);
      if (!list.length) return;
      document.getElementById('st-rv-overview').hidden = true;
      host.querySelector('.st-fchips').hidden = true;
      const stage = document.getElementById('st-rv-stage'); stage.hidden = false;
      stage.innerHTML = `<div class="st-rv-stagehead"><button class="btn ghost sm" data-quit>← Tekrar merkezine dön</button><span class="muted small">${list.length} kart · ${cid ? esc(App.course(cid).title.split(':')[0]) : 'Tüm kurslar'}</span></div><div class="st-rv-fc"></div>`;
      inst = Study.flashcards(stage.querySelector('.st-rv-fc'), list, {
        srs: true,
        onGrade: (c, g, st, wasNew) => { if (wasNew) bumpNew(); const pill = document.querySelector('.nav-item[href="#/review"] .pill'); if (pill) { const n = App.dueCards().length; if (n) pill.textContent = n; else pill.remove(); } },
        onDone: (s) => { if (s.accuracy === 100 && s.total >= 5) App.toast('🎯 Kusursuz deste!'); },
        onExit: () => App.render(), exitLabel: 'Tekrar merkezine dön'
      });
      stage.querySelector('[data-quit]').onclick = () => App.render();
      window.scrollTo(0, 0);
    };
    host.addEventListener('click', (e) => { const b = e.target.closest('[data-start]'); if (b) start(b.dataset.start); });
    const onKey = (e) => { if (inst || typing(e.target) || e.metaKey || e.ctrlKey) return; if (e.key === 'Enter' && host.querySelector('[data-start="all"]')) { e.preventDefault(); start('all'); } };
    document.addEventListener('keydown', onKey);
    App.onLeave(() => { document.removeEventListener('keydown', onKey); if (inst) inst.destroy(); });
  }
  App.route('/review', reviewPage, { title: 'Tekrar', after: reviewAfter });

  // ================= ROTA: /mindmaps =================
  const countNodes = (t) => 1 + (t.children || []).reduce((a, c) => a + countNodes(c), 0);
  const flatLabels = (t) => [t.label].concat((t.children || []).flatMap(flatLabels));
  const norm = (s) => String(s || '').toLocaleLowerCase('tr-TR');

  function mindmapsPage() {
    const me = App.me(); const q = App.query();
    const courses = App.myCourses();
    if (!courses.length) return `<div class="page-head"><div><h1>Zihin Haritaları</h1></div></div>${App.emptyState('🗺️', 'Henüz haritan yok', 'Bir kursa kaydolduğunda konuların zihin haritaları burada toplanır.', '<a class="btn primary" href="#/discover">Kurs keşfet</a>')}`;
    const cid = courses.some(c => c.id === q.c) ? q.c : '';
    const items = courses.flatMap(c => App.courseTopics(c.id).filter(t => t.mindmap).map(t => ({ t, c })));
    const viewed = me.mindmapsViewed || [];
    const nViewed = items.filter(x => viewed.includes(x.t.id)).length;
    const hasBadge = me.badges.includes('harita');
    const goal = Math.min(5, viewed.length);
    const cards = items.map(({ t, c }) => {
      const seen = viewed.includes(t.id), tested = (me.modes[t.id] || []).includes('mindmap');
      return `<a class="st-mmc" href="#/mindmaps/${esc(t.id)}" data-c="${esc(c.id)}" data-s="${esc(norm([t.title, c.title].concat(flatLabels(t.mindmap)).join(' ')))}" ${cid && cid !== c.id ? 'hidden' : ''}>
        <div class="st-mmc-prev">${mindmapThumb(t.mindmap)}</div>
        <div class="st-mmc-body">
          <div class="st-mmc-course"><span class="dot" style="background:${esc(c.color)}"></span>${esc(c.title.split(':')[0])}</div>
          <h3 class="serif">${esc(t.title)}</h3>
          <div class="st-mmc-meta"><span>${countNodes(t.mindmap)} kavram · ${(t.mindmap.children || []).length} dal</span>
            ${tested ? '<span class="tag ok">Sınandı ✓</span>' : seen ? '<span class="tag">İncelendi</span>' : '<span class="tag accent">Yeni</span>'}</div>
        </div></a>`;
    }).join('');
    const chips = [`<button class="st-fchip ${!cid ? 'on' : ''}" data-cf="">Tümü <b>${items.length}</b></button>`]
      .concat(courses.map(c => `<button class="st-fchip ${cid === c.id ? 'on' : ''}" data-cf="${esc(c.id)}"><span class="dot" style="background:${esc(c.color)}"></span>${esc(c.title.split(':')[0])} <b>${items.filter(x => x.c.id === c.id).length}</b></button>`)).join('');
    return `
      <div class="st-mmg" id="st-mmg">
        <div class="page-head">
          <div><h1>Zihin Haritaları</h1><p class="muted">Bir konunun bütününü tek bakışta gör. Haritayı incele, sonra “Kendini sına” ile kavramları hatırlamaya çalış.</p></div>
          <div class="st-mmg-badge ${hasBadge ? 'got' : ''}">
            <span class="st-mmg-badge-ic">🗺️</span>
            <div><b>${hasBadge ? 'Haritacı rozeti senin!' : `Haritacı rozeti: ${goal}/5`}</b><small class="muted">${hasBadge ? `${viewed.length} harita incelendin` : `${5 - goal} harita daha incele`}</small>${hasBadge ? '' : `<div class="progress"><span style="width:${goal * 20}%;background:var(--accent)"></span></div>`}</div>
          </div>
        </div>
        <div class="st-mmg-bar">
          <div class="st-fchips">${chips}</div>
          <label class="st-mmg-search"><span aria-hidden="true">⌕</span><input id="st-mmg-q" type="search" placeholder="Harita ya da kavram ara…" autocomplete="off" aria-label="Harita ara"> ${kbd('/')}</label>
        </div>
        <p class="muted small st-mmg-count" id="st-mmg-count">${nViewed} / ${items.length} harita incelendi</p>
        <div class="st-mmg-grid" id="st-mmg-grid">${cards}</div>
        <p class="src-note">Haritalar Türkçe Vikipedi maddelerinin bölüm başlıklarından otomatik türetilmiştir (CC BY-SA 4.0) · <a href="#/sources">Kaynaklar ve lisanslar</a></p>
        <div id="st-mmg-empty" hidden>${App.emptyState('🔎', 'Eşleşen harita yok', 'Farklı bir kelime dene ya da filtreyi temizle.')}</div>
      </div>`;
  }
  function mindmapsAfter() {
    const host = document.getElementById('st-mmg'); if (!host) return;
    const input = document.getElementById('st-mmg-q');
    let cid = host.querySelector('.st-fchip.on') ? host.querySelector('.st-fchip.on').dataset.cf : '';
    const apply = () => {
      const v = norm(input.value.trim()); let n = 0;
      host.querySelectorAll('.st-mmc').forEach(a => { const ok = (!cid || a.dataset.c === cid) && (!v || a.dataset.s.includes(v)); a.hidden = !ok; if (ok) n++; });
      document.getElementById('st-mmg-empty').hidden = n > 0;
    };
    host.querySelectorAll('[data-cf]').forEach(b => b.onclick = () => {
      cid = b.dataset.cf; host.querySelectorAll('[data-cf]').forEach(x => x.classList.toggle('on', x === b));
      history.replaceState(null, '', '#/mindmaps' + (cid ? '?c=' + encodeURIComponent(cid) : '')); apply();
    });
    input.addEventListener('input', apply);
    const onKey = (e) => { if (e.key === '/' && !typing(e.target)) { e.preventDefault(); input.focus(); } else if (e.key === 'Escape' && e.target === input) { input.value = ''; apply(); input.blur(); } };
    document.addEventListener('keydown', onKey);
    App.onLeave(() => document.removeEventListener('keydown', onKey));
    apply();
  }
  App.route('/mindmaps', mindmapsPage, { title: 'Zihin Haritaları', after: mindmapsAfter });

  function mindmapDetail({ topicId }) {
    const t = App.topic(topicId);
    if (!t || !t.mindmap) return App.emptyState('🗺️', 'Harita bulunamadı', 'Bu konu için bir zihin haritası yok.', '<a class="btn" href="#/mindmaps">Tüm haritalar</a>');
    const c = App.course(t.courseId) || { id: t.courseId, title: '', color: '#1e5b43' };
    const me = App.me();
    const tested = (me.modes[t.id] || []).includes('mindmap');
    const sib = App.courseTopics(c.id).filter(x => x.mindmap);
    const i = sib.findIndex(x => x.id === t.id);
    const prev = sib[i - 1], next = sib[i + 1];
    return `
      <div class="st-mmd">
        ${App.breadcrumbs([['Zihin Haritaları', '/mindmaps'], [c.title.split(':')[0], '/mindmaps?c=' + c.id], [t.title, '']])}
        <div class="page-head">
          <div><h1>${esc(t.title)}</h1><p class="muted"><span class="dot st-inline-dot" style="background:${esc(c.color)}"></span>${esc(c.title)} · ${countNodes(t.mindmap)} kavram</p></div>
          <div class="row" style="flex-wrap:wrap">
            <button class="btn" id="st-mmd-quiz">🎯 Kendini sına</button>
            <a class="btn primary" href="#/learn/${esc(c.id)}/${esc(t.id)}">Konuya git →</a>
          </div>
        </div>
        <div class="st-mmd-layout">
          <div class="st-mmd-main"><div class="st-mmd-map" id="st-mmd-map"></div>${window.KUI && KUI.sourceNote ? KUI.sourceNote(t, 'harita') : ''}</div>
          <aside class="st-mmd-side">
            <div class="card st-mmd-quizcard ${tested ? 'done' : ''}" id="st-mmd-quizcard">
              <div class="st-mmd-qc-ic">${tested ? '✓' : '🎯'}</div>
              <div><h3>${tested ? 'Bu haritayı sınadın' : 'Kendini sına'}</h3>
              <p class="muted small">${tested ? 'Kavramlar yerinde. İstersen tekrar dene — tekrar etmek kalıcılığı artırır.' : 'Alt kavramlar gizlenir. Her birini hatırlamaya çalış, sonra tıklayıp kontrol et. Hepsini açınca öğrenme adımı tamamlanır (+10 XP).'}</p>
              <button class="btn sm ${tested ? '' : 'accent'}" data-quiz>${tested ? 'Yeniden sına' : 'Başla'} ${kbd('S')}</button></div>
            </div>
            ${(t.keyPoints || []).length ? `<div class="card"><div class="card-head"><h3>Anahtar noktalar</h3></div><ol class="st-kp">${t.keyPoints.map(k => `<li>${esc(k)}</li>`).join('')}</ol></div>` : ''}
            <div class="card st-mmd-nav">
              <div class="card-head"><h3>Aynı kurstan</h3></div>
              ${sib.map(x => `<a class="${x.id === t.id ? 'on' : ''}" href="#/mindmaps/${esc(x.id)}"><span>${esc(x.title)}</span>${(me.mindmapsViewed || []).includes(x.id) ? '<small class="muted">✓</small>' : ''}</a>`).join('')}
              <div class="st-mmd-pn">${prev ? `<a class="btn sm" href="#/mindmaps/${esc(prev.id)}">← Önceki</a>` : '<span></span>'}${next ? `<a class="btn sm" href="#/mindmaps/${esc(next.id)}">Sonraki →</a>` : ''}</div>
            </div>
          </aside>
        </div>
      </div>`;
  }
  function mindmapDetailAfter({ topicId }) {
    const t = App.topic(topicId); const el = document.getElementById('st-mmd-map');
    if (!t || !el) return;
    const me = App.me();
    me.mindmapsViewed = me.mindmapsViewed || [];
    if (!me.mindmapsViewed.includes(t.id)) {
      me.mindmapsViewed.push(t.id); App.save();
      if (me.mindmapsViewed.length >= 5) App.award('harita');
    }
    const h = window.innerWidth < 760 ? 420 : Math.max(440, Math.min(680, window.innerHeight - 230));
    const inst = Study.mindmap(el, t.mindmap, {
      topicId: t.id, height: h,
      onQuizChange: (q) => { const b = document.getElementById('st-mmd-quiz'); if (b) { b.textContent = q ? '✕ Sınamayı bitir' : '🎯 Kendini sına'; b.classList.toggle('accent', q); } },
      onComplete: () => {
        App.toast('🎯 Tüm kavramları hatırladın!');
        const qc = document.getElementById('st-mmd-quizcard');
        if (qc) { qc.classList.add('done'); qc.querySelector('.st-mmd-qc-ic').textContent = '✓'; qc.querySelector('h3').textContent = 'Bu haritayı sınadın'; }
      }
    });
    const startQuiz = () => { inst.setQuiz(!inst.quiz); try { inst.el.focus({ preventScroll: true }); } catch (_) {} };
    document.getElementById('st-mmd-quiz').onclick = startQuiz;
    document.querySelector('#st-mmd-quizcard [data-quiz]').onclick = startQuiz;
    const onKey = (e) => { if ((e.key === 's' || e.key === 'S') && !typing(e.target) && !inst.el.contains(e.target) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); startQuiz(); } };
    document.addEventListener('keydown', onKey);
    App.onLeave(() => { document.removeEventListener('keydown', onKey); inst.destroy(); });
  }
  App.route('/mindmaps/:topicId', mindmapDetail, { title: 'Zihin Haritası', after: mindmapDetailAfter, wide: true });
})();
