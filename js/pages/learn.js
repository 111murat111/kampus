// Ders ekranı: /learn/:courseId/:topicId?mode=video|text|mindmap|cards|quiz|notes
// Udemy oynatıcısı + Doping konu ekranı. Sol: müfredat, üst: 6 öğrenme yolu, orta: moda göre içerik.
(function () {
  const esc = (s) => App.esc(s);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const LS_SIDE = 'kampus-ln-side-collapsed';
  const LETTERS = 'ABCDEFGH';
  const DIFF = { 1: 'Kolay', 2: 'Orta', 3: 'Zor' };
  const K = () => window.KUI || {};
  const srcNote = (t, what) => (K().sourceNote ? K().sourceNote(t, what) : '');
  const ORD = { 0: '0’ı', 1: '1’i', 2: '2’si', 3: '3’ü' };

  let S = null; // aktif sayfa durumu

  const modeIds = () => App.MODES.map(m => m.id);
  const modeOf = (id) => App.MODES.find(m => m.id === id);
  const validMode = (m) => (modeIds().includes(m) ? m : 'video');
  const doneModes = (tid) => (App.me().modes[tid] || []);
  const coreCount = (tid) => doneModes(tid).filter(m => m !== 'notes').length;
  function parseDur(d) { const p = String(d || '0:00').split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : (p[0] || 0) * 60 + (p[1] || 0); }
  function fmt(sec) { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  function isDesktop() { return window.innerWidth > 1100; }
  function sideCollapsed() { try { return localStorage.getItem(LS_SIDE) === '1'; } catch (e) { return false; } }

  // Sıradaki önerilen mod: mevcut moddan sonra gelen, henüz tamamlanmamış ilk mod
  function nextMode(tid, cur) {
    const ids = modeIds(), done = doneModes(tid), start = ids.indexOf(cur);
    for (let k = 1; k < ids.length; k++) { const m = ids[(start + k) % ids.length]; if (!done.includes(m)) return m; }
    return null;
  }

  // ---------- Parçalar ----------
  function sideHTML(course, tid) {
    const me = App.me(); const ts = App.courseTopics(course.id);
    const doneN = ts.filter(t => me.done[t.id]).length; const pct = App.courseProgress(course.id);
    let n = 0;
    const units = course.units.map((u, ui) => {
      const items = u.topics.map(App.topic).filter(Boolean).map(t => {
        n++;
        const md = me.modes[t.id] || [];
        const dots = App.MODES.map(m => `<i class="${md.includes(m.id) ? 'on' : ''}" title="${esc(m.label)}${md.includes(m.id) ? ' · tamamlandı' : ''}"></i>`).join('');
        const active = t.id === tid;
        return `<a class="ln-topic${active ? ' active' : ''}${me.done[t.id] ? ' done' : ''}" href="#/learn/${course.id}/${t.id}"${active ? ' aria-current="page"' : ''}>
          <span class="ln-topic-st" aria-hidden="true">${me.done[t.id] ? '✓' : n}</span>
          <span class="ln-topic-b"><span class="ln-topic-t">${esc(t.title)}</span>
            <span class="ln-topic-m"><span class="ln-dots" aria-label="6 yoldan ${md.length} tanesi tamam">${dots}</span><small>${esc(t.duration)}</small></span></span></a>`;
      }).join('');
      return `<div class="ln-unit"><div class="ln-unit-h"><small>Ünite ${ui + 1}</small><span>${esc(u.title)}</span></div>${items}</div>`;
    }).join('');
    return `<div class="ln-side-head">
        <div class="ln-side-top"><span class="ln-emoji" style="background:${esc(course.color)}">${course.emoji}</span>
          <a class="ln-side-title" href="#/course/${course.id}">${esc(course.title)}</a>
          <button class="icon-btn ln-side-x" data-side-close aria-label="Müfredatı kapat">✕</button></div>
        <div class="ln-side-prog"><div class="ln-side-row"><span><b>%${pct}</b> tamamlandı</span><span>${doneN}/${ts.length} konu</span></div>${App.progressBar(pct)}</div>
      </div>
      <div class="ln-units">${units}</div>`;
  }

  function statusHTML(tid) {
    const me = App.me(); const c = Math.min(3, coreCount(tid)); const done = !!me.done[tid];
    const tried = doneModes(tid).length;
    return `<div class="ln-ring">${App.ring(done ? 100 : c / 3 * 100, 48, 5, done ? 'var(--primary)' : 'var(--accent)')}<span>${done ? '✓' : c + '/3'}</span></div>
      <div class="ln-status-t">${done
        ? `<b>Konu tamamlandı</b><small>6 yoldan ${tried} tanesini kullandın</small>`
        : `<b>3 yoldan ${ORD[c]} tamam</b><small>Herhangi 3 yolla konuyu bitir</small>`}</div>`;
  }

  function tabsHTML(tid, mode) {
    const md = doneModes(tid);
    return App.MODES.map((m, i) => `<button class="ln-mode${m.id === mode ? ' active' : ''}${md.includes(m.id) ? ' done' : ''}" role="tab" aria-selected="${m.id === mode}" data-mode="${m.id}" title="${esc(m.label)} (${i + 1})">
      <span class="ln-mode-ic" aria-hidden="true">${m.icon}</span><span class="ln-mode-l">${esc(m.label)}</span>${md.includes(m.id) ? '<span class="ln-mode-ck" aria-label="tamamlandı">✓</span>' : ''}</button>`).join('');
  }

  function nextHTML() {
    if (!S || !doneModes(S.tid).includes(S.mode)) return '';
    const nm = nextMode(S.tid, S.mode); const cur = modeOf(S.mode);
    let action;
    if (nm) { const m = modeOf(nm); action = `<button class="ln-chip" data-go-mode="${nm}">Sonraki önerilen: <b>${m.icon} ${esc(m.label)}</b> →</button>`; }
    else if (S.next) action = `<a class="ln-chip" href="#/learn/${S.cid}/${S.next.id}">Tüm yollar tamam · Sonraki konu: <b>${esc(S.next.title)}</b> →</a>`;
    else action = `<a class="ln-chip" href="#/course/${S.cid}">Tüm yollar tamam · Kurs sayfasına dön →</a>`;
    return `<div class="ln-next"><span class="ln-next-ok">✓ ${esc(cur.label)} tamamlandı</span>${action}</div>`;
  }

  // ---------- Sayfa ----------
  App.route('/learn/:courseId/:topicId', (p) => {
    const course = App.course(p.courseId), topic = App.topic(p.topicId);
    if (!course || !topic || topic.courseId !== course.id) return App.emptyState('🧭', 'Konu bulunamadı', 'Bu ders bağlantısı geçersiz görünüyor.', '<a class="btn primary" href="#/my">Kurslarıma dön</a>');
    if (!App.isEnrolled(course.id)) { App.enroll(course.id); setTimeout(() => App.toast('📚 Kursa kaydoldun, iyi çalışmalar!'), 50); }
    const mode = validMode(App.query().mode);
    const ts = App.courseTopics(course.id); const idx = ts.findIndex(t => t.id === topic.id);
    const prev = ts[idx - 1], next = ts[idx + 1];
    const ui = course.units.findIndex(u => u.topics.includes(topic.id)); const unit = course.units[ui];
    return `<div class="ln${sideCollapsed() ? ' ln-collapsed' : ''}" id="ln">
      <aside class="ln-side" id="ln-side" aria-label="Kurs müfredatı">${sideHTML(course, topic.id)}</aside>
      <div class="ln-scrim" data-side-close></div>
      <section class="ln-main">
        <header class="ln-head">
          ${App.breadcrumbs([['Kurslarım', '/my'], [course.title.split(':')[0], '/course/' + course.id], [topic.title]])}
          <div class="ln-title-row">
            <button class="ln-side-btn" id="ln-side-btn" aria-controls="ln-side" aria-label="Müfredatı göster ya da gizle"><span aria-hidden="true">☰</span><span class="ln-side-btn-l">Müfredat</span></button>
            <div class="ln-title">
              <div class="ln-eyebrow">${unit ? `Ünite ${ui + 1} · ${esc(unit.title)} · ` : ''}Konu ${idx + 1}/${ts.length} · ⏱ ${esc(topic.duration)}</div>
              <h1>${esc(topic.title)}</h1>
            </div>
            <div class="ln-status" id="ln-status" aria-live="polite">${statusHTML(topic.id)}</div>
          </div>
          <div class="ln-modes-wrap">
            <div class="ln-modes-label"><span>Konuyu öğrenmenin 6 yolu</span><small class="hide-mobile">← → ile yollar arasında geç</small></div>
            <div class="ln-modes" role="tablist" id="ln-modes" aria-label="Öğrenme yolları">${tabsHTML(topic.id, mode)}</div>
          </div>
        </header>
        <div class="ln-stage" id="ln-stage" role="tabpanel"></div>
        <div id="ln-nextbox"></div>
        <nav class="ln-pager" aria-label="Konular arası gezinme">
          ${prev ? `<a class="ln-pg" href="#/learn/${course.id}/${prev.id}"><small>◀ Önceki konu</small><span>${esc(prev.title)}</span></a>` : '<span></span>'}
          ${next ? `<a class="ln-pg ln-pg-next" href="#/learn/${course.id}/${next.id}"><small>Sonraki konu ▶</small><span>${esc(next.title)}</span></a>`
                 : `<a class="ln-pg ln-pg-next" href="#/course/${course.id}"><small>Kurs sonu ▶</small><span>Kurs sayfasına dön</span></a>`}
        </nav>
      </section>
    </div>`;
  }, { wide: true, title: 'Ders', after: mount });

  function mount(p) {
    const root = $('#ln'); if (!root) return;
    const course = App.course(p.courseId), topic = App.topic(p.topicId);
    const ts = App.courseTopics(course.id); const idx = ts.findIndex(t => t.id === topic.id);
    S = { cid: course.id, tid: topic.id, course, topic, next: ts[idx + 1] || null, mode: null, cleanups: [], keyHook: null };
    const myS = S;

    // Etkileşimler (olay delegasyonu)
    const onClick = (e) => {
      const m = e.target.closest('[data-mode]'); if (m && root.contains(m)) { openMode(m.dataset.mode, true); return; }
      const g = e.target.closest('[data-go-mode]'); if (g) { e.preventDefault(); openMode(g.dataset.goMode, true); return; }
      if (e.target.closest('[data-side-close]')) { root.classList.remove('ln-open'); return; }
      if (e.target.closest('#ln-side-btn')) {
        if (isDesktop()) { const c = root.classList.toggle('ln-collapsed'); try { localStorage.setItem(LS_SIDE, c ? '1' : '0'); } catch (er) {} }
        else root.classList.toggle('ln-open');
      }
    };
    root.addEventListener('click', onClick);

    const onKey = (e) => {
      if (S !== myS || e.metaKey || e.ctrlKey || e.altKey) return;
      const tg = e.target; if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName))) return;
      if (document.querySelector('#modal-root .modal')) return;
      if (e.key === 'Escape' && root.classList.contains('ln-open')) { root.classList.remove('ln-open'); return; }
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !S.arrowsOwned) {
        const ids = modeIds(); const i = ids.indexOf(S.mode) + (e.key === 'ArrowRight' ? 1 : -1);
        if (i >= 0 && i < ids.length) { e.preventDefault(); openMode(ids[i], true); const b = $(`.ln-mode[data-mode="${ids[i]}"]`); b && b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
        return;
      }
      if (S.keyHook) S.keyHook(e);
    };
    document.addEventListener('keydown', onKey);

    // Aktif konuyu müfredatta görünür yap
    const side = $('#ln-side'); const act = side && $('.ln-topic.active', side);
    if (act) side.scrollTop = Math.max(0, act.offsetTop - side.clientHeight / 3);

    App.onLeave(() => { teardownMode(); root.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); hideBubble(); if (S === myS) S = null; });
    openMode(validMode(App.query().mode), false);
  }

  function teardownMode() {
    if (!S) return;
    S.cleanups.splice(0).forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    S.keyHook = null; S.arrowsOwned = false;
  }
  const addCleanup = (fn) => S.cleanups.push(fn);

  function openMode(mode, user) {
    if (!S) return; mode = validMode(mode);
    if (user && mode === S.mode) return;
    teardownMode();
    S.mode = mode;
    if (user) {
      history.replaceState(null, '', location.pathname + location.search + `#/learn/${S.cid}/${S.tid}?mode=${mode}`);
      const head = $('#ln-modes'); const top = head ? head.getBoundingClientRect().top : 0;
      if (top < 64) window.scrollTo({ top: Math.max(0, window.scrollY + top - 80), behavior: reduced() ? 'auto' : 'smooth' });
    }
    App.setLast(S.cid, S.tid, mode);
    $('#ln-modes').innerHTML = tabsHTML(S.tid, mode);
    const stage = $('#ln-stage'); stage.className = 'ln-stage ln-stage-' + mode; stage.innerHTML = '';
    try { RENDER[mode](stage); } catch (e) { console.error(e); stage.innerHTML = App.emptyState('⚠️', 'Bu bölüm açılamadı', esc(e.message)); }
    refreshNext();
    $('#ln').classList.remove('ln-open');
  }

  function refreshNext() { const b = $('#ln-nextbox'); if (b) b.innerHTML = nextHTML(); }
  function refreshStatus() {
    if (!S) return;
    const st = $('#ln-status'); if (st) st.innerHTML = statusHTML(S.tid);
    const md = $('#ln-modes'); if (md) md.innerHTML = tabsHTML(S.tid, S.mode);
    const side = $('#ln-side'); if (side) { const sc = side.scrollTop; side.innerHTML = sideHTML(S.course, S.tid); side.scrollTop = sc; }
    refreshNext();
  }

  // Bir modu tamamla (çekirdek markMode + arayüz güncelleme + kutlama)
  function complete(mode) {
    if (!S) return;
    const me = App.me(); const wasDone = !!me.done[S.tid]; const had = doneModes(S.tid).includes(mode);
    App.markMode(S.tid, mode);
    if (!had) refreshStatus();
    if (!wasDone && me.done[S.tid]) celebrate();
  }

  function celebrate() {
    const ring = $('#ln-status .ln-ring'); if (!ring) return;
    ring.classList.add('ln-pop');
    if (reduced()) return;
    const r = ring.getBoundingClientRect();
    const box = document.createElement('div'); box.className = 'ln-confetti'; box.setAttribute('aria-hidden', 'true');
    box.style.left = (r.left + r.width / 2) + 'px'; box.style.top = (r.top + r.height / 2) + 'px';
    const colors = ['var(--primary)', 'var(--accent)', '#b4472f', 'var(--text)', '#7fb89a'];
    for (let i = 0; i < 22; i++) {
      const s = document.createElement('i'); const a = (i / 22) * Math.PI * 2 + Math.random() * .3; const d = 40 + Math.random() * 46;
      s.style.setProperty('--x', Math.cos(a) * d + 'px'); s.style.setProperty('--y', Math.sin(a) * d + 'px');
      s.style.setProperty('--r', (Math.random() * 360 - 180) + 'deg'); s.style.background = colors[i % colors.length];
      if (i % 3 === 0) s.style.borderRadius = '50%';
      box.appendChild(s);
    }
    document.body.appendChild(box); setTimeout(() => box.remove(), 600);
  }

  // ---------- Modlar ----------
  const RENDER = {};

  // VIDEO — sahte oynatıcı
  RENDER.video = (el) => {
    const t = S.topic, c = S.course; const total = parseDur(t.duration) || 600;
    const chapters = (t.chapters || []).map(ch => ({ ...ch, s: parseDur(ch.t) }));
    const REAL = 20000; // 1x hızda ≈20 sn
    let pos = 0, playing = false, speed = 1, raf = 0, last = 0, cc = true, curCh = -1;
    const watched = doneModes(t.id).includes('video');
    el.innerHTML = `
      <div class="ln-player" id="ln-player">
        <div class="ln-screen" id="ln-screen">
          <div class="ln-board">
            <div class="ln-board-k">${c.emoji} ${esc(c.instructor)} · ${esc(t.title)}</div>
            <div class="ln-board-t" id="ln-board-t">${esc(chapters[0] ? chapters[0].title : t.title)}</div>
            <div class="ln-board-f" id="ln-board-f">${esc((t.keyPoints || [])[0] || '')}</div>
          </div>
          <span class="ln-demo-badge">Demo oynatıcı — gerçek video içermez</span>
          <button class="ln-bigplay" id="ln-bigplay" aria-label="Videoyu oynat"><svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></button>
          <div class="ln-sub" id="ln-sub" hidden></div>
          <div class="ln-end" id="ln-end" hidden></div>
        </div>
        <div class="ln-ctrl">
          <button class="ln-cbtn" id="ln-pp" aria-label="Oynat">▶</button>
          <span class="ln-time" id="ln-time">0:00 / ${fmt(total)}</span>
          <div class="ln-bar" id="ln-bar" title="İleri/geri sar">
            <div class="ln-bar-track"><div class="ln-bar-fill" id="ln-fill"></div></div>
            ${chapters.map((ch, i) => i === 0 ? '' : `<button class="ln-mark" data-ch="${i}" style="left:${ch.s / total * 100}%" title="${esc(ch.t)} · ${esc(ch.title)}" aria-label="Bölüme git: ${esc(ch.title)}"></button>`).join('')}
          </div>
          <div class="ln-speed" role="group" aria-label="Oynatma hızı">${[1, 1.5, 2].map(v => `<button data-speed="${v}" class="${v === 1 ? 'on' : ''}">${String(v).replace('.', ',')}x</button>`).join('')}</div>
          <button class="ln-cbtn ln-cc on" id="ln-cc" aria-pressed="true" title="Altyazı">CC</button>
        </div>
      </div>
      <div class="ln-under">
        <div class="ln-chapters"><h3 class="serif">Bölümler</h3>
          <ol>${chapters.map((ch, i) => `<li><button data-ch="${i}"><span class="ln-ch-t">${esc(ch.t)}</span><span class="ln-ch-n">${esc(ch.title)}</span><span class="ln-ch-now">izleniyor</span></button></li>`).join('')}</ol></div>
        <div class="ln-vinfo">
          <p class="muted small">${watched ? '✓ Bu yolu daha önce tamamladın. İstersen tekrar oynatabilirsin.' : 'Oynatıcı sona geldiğinde bu yol tamamlanır.'}</p>
          <p class="muted small"><kbd>Boşluk</kbd> oynat/duraklat · <kbd>←</kbd><kbd>→</kbd> yollar arasında geç</p>
          <p class="muted small">Bu bir <b>demo oynatıcıdır</b>; gerçek video içermez. Ekranda yalnızca bölüm başlıkları ve anahtar cümleler gösterilir.</p>
        </div>
      </div>
      ${srcNote(t, 'bölüm başlıkları ve ekrandaki cümleler')}`;
    const screen = $('#ln-screen', el), fill = $('#ln-fill', el), time = $('#ln-time', el), pp = $('#ln-pp', el), big = $('#ln-bigplay', el), sub = $('#ln-sub', el), end = $('#ln-end', el);

    function chapterAt(sec) { let k = 0; chapters.forEach((ch, i) => { if (sec >= ch.s) k = i; }); return k; }
    function paint() {
      const sec = pos * total;
      fill.style.width = (pos * 100) + '%'; time.textContent = fmt(sec) + ' / ' + fmt(total);
      const k = chapters.length ? chapterAt(sec) : -1;
      if (k !== curCh) {
        curCh = k;
        if (k >= 0) {
          $('#ln-board-t', el).textContent = chapters[k].title;
          const kp = t.keyPoints || []; $('#ln-board-f', el).textContent = kp.length ? kp[k % kp.length] : '';
          sub.textContent = `Bölüm ${k + 1} · ${chapters[k].title}`;
        }
        $$('.ln-chapters button', el).forEach((b, i) => b.classList.toggle('now', i === k));
      }
      sub.hidden = !cc || pos === 0 || pos >= 1;
      screen.classList.toggle('playing', playing);
      pp.textContent = playing ? '❚❚' : '▶'; pp.setAttribute('aria-label', playing ? 'Duraklat' : 'Oynat');
      big.hidden = playing || pos >= 1;
    }
    function tick() {
      const now = Date.now(); pos = Math.min(1, pos + (now - last) / REAL * speed); last = now;
      if (pos >= 1) { finish(); return; }
      paint();
    }
    function play() { if (pos >= 1) pos = 0; end.hidden = true; playing = true; last = Date.now(); clearInterval(raf); raf = setInterval(tick, 100); paint(); }
    function pause() { playing = false; clearInterval(raf); paint(); }
    function toggle() { playing ? pause() : play(); }
    function seek(f) { pos = Math.max(0, Math.min(.999, f)); end.hidden = true; last = Date.now(); paint(); }
    function finish() {
      playing = false; clearInterval(raf); pos = 1; paint();
      App.logStudy(Math.max(1, Math.round(total / 60)));
      complete('video');
      const nm = nextMode(t.id, 'video'); const m = nm && modeOf(nm);
      end.innerHTML = `<div class="ln-end-in"><div class="ln-end-ok">✓</div><h3>Video tamamlandı</h3>
        <p>Demo oynatıcının sonuna geldin. Konunun asıl metni “Konu Anlatımı” yolunda.</p>
        <div class="ln-end-act">${m ? `<button class="btn accent" data-go-mode="${nm}">Sıradaki: ${esc(m.label)} →</button>` : (S.next ? `<a class="btn accent" href="#/learn/${S.cid}/${S.next.id}">Sonraki konu →</a>` : '')}
        <button class="btn ln-replay" id="ln-replay">↺ Tekrar izle</button></div></div>`;
      end.hidden = false;
      $('#ln-replay', end).onclick = () => { pos = 0; play(); };
    }

    big.onclick = play; pp.onclick = toggle;
    screen.addEventListener('click', (e) => { if (e.target === screen || e.target.closest('.ln-board')) toggle(); });
    $('#ln-bar', el).addEventListener('click', (e) => {
      const mk = e.target.closest('.ln-mark'); if (mk) { seek(chapters[+mk.dataset.ch].s / total); return; }
      const r = $('.ln-bar-track', el).getBoundingClientRect(); seek((e.clientX - r.left) / r.width);
    });
    $$('.ln-chapters button', el).forEach(b => b.onclick = () => { seek(chapters[+b.dataset.ch].s / total); if (!playing) play(); });
    $$('[data-speed]', el).forEach(b => b.onclick = () => { speed = +b.dataset.speed; $$('[data-speed]', el).forEach(x => x.classList.toggle('on', x === b)); });
    $('#ln-cc', el).onclick = (e) => { cc = !cc; e.currentTarget.classList.toggle('on', cc); e.currentTarget.setAttribute('aria-pressed', cc); paint(); };
    S.keyHook = (e) => { if (e.key === ' ' && !(e.target.closest && e.target.closest('button,a'))) { e.preventDefault(); toggle(); } };
    paint();
    addCleanup(() => { playing = false; clearInterval(raf); });
  };

  // TEXT — konu anlatımı
  RENDER.text = (el) => {
    const t = S.topic; const read = doneModes(t.id).includes('text');
    const words = (t.text || []).reduce((n, s) => n + (s.h + ' ' + s.p).split(/\s+/).length, 0);
    const mins = Math.max(1, Math.round(words / 180));
    el.innerHTML = `
      <div class="ln-rp" aria-hidden="true"><span id="ln-rp"></span></div>
      <div class="ln-text">
        <article class="ln-article" id="ln-article">
          <p class="ln-lede">Yaklaşık ${mins} dakikalık okuma. Önemli gördüğün bir yeri <b>seç</b>, tek dokunuşla notlarına ekle.</p>
          ${(t.text || []).map((s, i, arr) => `<section><h2>${arr.length > 1 ? `<span class="ln-sec-n">${i + 1}</span>` : ''}${esc(s.h)}</h2><p>${esc(s.p)}</p></section>`).join('')}
          ${(t.text || []).length ? '' : '<p class="muted">Bu konu için metin bulunamadı.</p>'}
          <div class="ln-read-end" id="ln-read-end">${readEnd(read)}</div>
          ${K().sourceBox ? K().sourceBox(t) : ''}
        </article>
        <aside class="ln-keys"><h3 class="serif">🔑 Anahtar noktalar</h3>
          ${(t.keyPoints || []).length ? `<ul>${t.keyPoints.map(k => `<li>${esc(k)}</li>`).join('')}</ul>` : '<p class="muted small">Bu konuda anahtar nokta çıkarılamadı.</p>'}
          ${(t.cards || []).length ? '<button class="btn sm" data-go-mode="cards">🃏 Kartlarla pekiştir</button>' : ''}
          <p class="ln-keys-src">Maddeden otomatik çıkarılan cümleler.</p>
        </aside>
      </div>`;
    function readEnd(done) {
      return done ? `<span class="ln-read-ok">✓ Bu anlatımı okudun</span><button class="btn sm" data-go-mode="quiz">📝 Kendini test et</button>`
                  : `<button class="btn primary" id="ln-read-done">Okudum ✓</button><span class="muted small">Sona geldiğinde ya da “Okudum” dediğinde bu yol tamamlanır.</span>`;
    }
    const art = $('#ln-article', el), bar = $('#ln-rp', el);
    const markRead = () => { if (doneModes(t.id).includes('text')) return; App.logStudy(mins); complete('text'); $('#ln-read-end', el).innerHTML = readEnd(true); };
    el.addEventListener('click', (e) => { if (e.target.closest('#ln-read-done')) markRead(); });
    function progress() { const r = art.getBoundingClientRect(); const h = r.height; return Math.max(0, Math.min(1, (window.innerHeight - r.top) / h)); }
    const autoOk = progress() < .95; // metin tek ekrana sığıyorsa otomatik işaretleme yapma
    const onScroll = () => { const p = progress(); bar.style.width = (p * 100) + '%'; hideBubble(); if (autoOk && p >= .99) markRead(); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

    // Seçim balonu: "Notlarıma ekle"
    const onUp = () => setTimeout(() => {
      const sel = window.getSelection(); const txt = sel ? sel.toString().trim() : '';
      if (!txt || txt.length < 2 || !sel.rangeCount) { hideBubble(); return; }
      const rng = sel.getRangeAt(0); if (!art.contains(rng.commonAncestorContainer)) { hideBubble(); return; }
      showBubble(rng.getBoundingClientRect(), txt.slice(0, 400));
    }, 0);
    art.addEventListener('mouseup', onUp); art.addEventListener('touchend', onUp); art.addEventListener('keyup', onUp);
    const onDown = (e) => { if (!e.target.closest('.ln-bubble')) hideBubble(); };
    document.addEventListener('mousedown', onDown);
    addCleanup(() => { window.removeEventListener('scroll', onScroll); document.removeEventListener('mousedown', onDown); hideBubble(); });
  };

  function showBubble(rect, text) {
    hideBubble();
    const b = document.createElement('button'); b.className = 'ln-bubble'; b.type = 'button'; b.innerHTML = '✏️ Notlarıma ekle';
    document.body.appendChild(b);
    const w = b.offsetWidth; const x = Math.max(8, Math.min(window.innerWidth - w - 8, rect.left + rect.width / 2 - w / 2));
    const y = rect.top > 60 ? rect.top - b.offsetHeight - 8 : rect.bottom + 8;
    b.style.left = x + 'px'; b.style.top = y + 'px';
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.onclick = () => { addNote('• ' + text); const s = window.getSelection(); s && s.removeAllRanges(); hideBubble(); App.toast('✏️ Notlarına eklendi'); };
  }
  function hideBubble() { $$('.ln-bubble').forEach(b => b.remove()); }
  function addNote(line) {
    const me = App.me(); const cur = (me.notes[S.tid] || '').replace(/\s+$/, '');
    me.notes[S.tid] = (cur ? cur + '\n' : '') + line; App.save();
    complete('notes');
  }

  // MINDMAP
  RENDER.mindmap = (el) => {
    const t = S.topic; const me = App.me();
    if (!me.mindmapsViewed.includes(t.id)) { me.mindmapsViewed.push(t.id); if (me.mindmapsViewed.length >= 5) App.award('harita'); App.save(); }
    const done = doneModes(t.id).includes('mindmap');
    el.innerHTML = `
      <div class="ln-panel-head"><div><h2 class="serif">Zihin haritası</h2><p class="muted small">Dalları açarak konunun iskeletini gör. Tüm dalları gezdiğinde bu yol tamamlanır.</p></div>
        <button class="btn ${done ? '' : 'primary'}" id="ln-mm-done" ${done ? 'disabled' : ''}>${done ? '✓ İnceledin' : 'İnceledim ✓'}</button></div>
      <div class="ln-mm-box" id="ln-mm"></div>
      ${srcNote(t, 'harita')}`;
    const box = $('#ln-mm', el);
    const onComplete = () => { complete('mindmap'); const b = $('#ln-mm-done', el); if (b) { b.disabled = true; b.textContent = '✓ İnceledin'; b.classList.remove('primary'); } };
    $('#ln-mm-done', el).onclick = onComplete;
    let comp = null;
    if (window.Study && typeof Study.mindmap === 'function') {
      try { comp = Study.mindmap(box, t.mindmap, { topicId: t.id, interactive: true, onComplete }); } catch (e) { console.error(e); comp = null; box.innerHTML = ''; }
    }
    if (!comp && !box.childElementCount) comp = fallbackMindmap(box, t.mindmap, onComplete);
    addCleanup(() => comp && comp.destroy && comp.destroy());
  };

  function fallbackMindmap(box, tree, onComplete) {
    const kids = (tree && tree.children) || [];
    const seen = new Set();
    box.innerHTML = `<div class="ln-mmf">
      <div class="ln-mmf-root serif">${esc(tree ? tree.label : '')}</div>
      <div class="ln-mmf-branches">${kids.map((b, i) => `<div class="ln-mmf-b" data-b="${i}">
        <button class="ln-mmf-bh" aria-expanded="false"><span>${esc(b.label)}</span><small>${(b.children || []).length ? (b.children || []).length + ' alt' : 'alt başlık yok'}</small></button>
        <ul hidden>${(b.children || []).map(x => `<li>${esc(x.label)}</li>`).join('') || '<li class="muted">Bu dalın alt başlığı yok.</li>'}</ul></div>`).join('')}</div>
      <p class="muted small ln-mmf-p" id="ln-mmf-p">0/${kids.length} dal açıldı</p></div>`;
    const onClick = (e) => {
      const h = e.target.closest('.ln-mmf-bh'); if (!h) return;
      const b = h.parentElement; const ul = $('ul', b); const open = ul.hidden; ul.hidden = !open; h.setAttribute('aria-expanded', open); b.classList.toggle('open', open);
      if (open) { seen.add(b.dataset.b); $('#ln-mmf-p', box).textContent = `${seen.size}/${kids.length} dal açıldı`; if (seen.size === kids.length) onComplete(); }
    };
    box.addEventListener('click', onClick);
    return { destroy() { box.removeEventListener('click', onClick); } };
  }

  // CARDS
  RENDER.cards = (el) => {
    const t = S.topic;
    const cards = (t.cards || []).map(c => ({ key: t.id + ':' + c.id, q: c.q, a: c.a, topicId: t.id }));
    el.innerHTML = `<div class="ln-panel-head"><div><h2 class="serif">Bilgi kartları</h2><p class="muted small">Ön yüzde başlık, arka yüzde maddeden bir cümle var. Önce hatırlamaya çalış, sonra kartı çevir. Kartlar aralıklı tekrar kutuna eklenir.</p></div></div><div class="ln-fc-box" id="ln-fc"></div><div id="ln-fc-src"></div>`;
    const box = $('#ln-fc', el);
    const onDone = () => { if (S) S.arrowsOwned = false; App.logStudy(Math.max(1, Math.round(cards.length / 2))); complete('cards'); };
    let comp = null;
    if (window.Study && typeof Study.flashcards === 'function') {
      // Study kartları ←/→ tuşlarını değerlendirme için kullanır; bu modda mod geçişini ona bırak
      try { comp = Study.flashcards(box, cards, { srs: true, onDone }); S.arrowsOwned = !!comp; } catch (e) { console.error(e); comp = null; box.innerHTML = ''; }
    }
    // Study bileşeni her kartın altında kaynağını zaten gösterir; yedek bileşende tek satırlık not eklenir.
    if (!comp && !box.childElementCount) { comp = fallbackCards(box, cards, onDone); $('#ln-fc-src', el).innerHTML = srcNote(t, 'kartlar'); }
    addCleanup(() => comp && comp.destroy && comp.destroy());
  };

  function fallbackCards(box, cards, onDone) {
    let i = 0, flipped = false; const stats = { again: 0, hard: 0, good: 0, easy: 0 };
    const G = [['again', 'Tekrar', '1'], ['hard', 'Zor', '2'], ['good', 'İyi', '3'], ['easy', 'Kolay', '4']];
    function draw() {
      if (!cards.length) { box.innerHTML = App.emptyState('🃏', 'Bu konuda kart yok'); return; }
      if (i >= cards.length) {
        const known = stats.good + stats.easy;
        box.innerHTML = `<div class="ln-fcf-done"><div class="ln-end-ok">✓</div><h3 class="serif">${cards.length} kartı tamamladın</h3><p class="muted">${known} kartı bildin, ${cards.length - known} kart yakında tekrar karşına çıkacak.</p><button class="btn" id="ln-fc-again">↺ Baştan çalış</button></div>`;
        $('#ln-fc-again', box).onclick = () => { i = 0; flipped = false; Object.keys(stats).forEach(k => stats[k] = 0); draw(); };
        onDone(stats); return;
      }
      const c = cards[i];
      box.innerHTML = `<div class="ln-fcf">
        <div class="ln-fcf-top"><span>Kart ${i + 1}/${cards.length}</span>${App.progressBar(i / cards.length * 100)}</div>
        <button class="ln-fcf-card${flipped ? ' flipped' : ''}" id="ln-fcf-card" aria-label="Kartı çevir">
          <span class="ln-fcf-face ln-fcf-front"><small>Başlık</small><b>${esc(c.q)}</b><em>Çevirmek için dokun</em></span>
          <span class="ln-fcf-face ln-fcf-back"><small>Maddeden</small><span class="ln-fcf-a">${esc(c.a)}</span></span></button>
        <div class="ln-fcf-grade" ${flipped ? '' : 'hidden'}>${G.map(g => `<button class="btn ln-g-${g[0]}" data-g="${g[0]}">${g[1]}</button>`).join('')}</div></div>`;
      $('#ln-fcf-card', box).onclick = flip;
      $$('[data-g]', box).forEach(b => b.onclick = () => grade(b.dataset.g));
    }
    function flip() { flipped = !flipped; const c = $('#ln-fcf-card', box); c && c.classList.toggle('flipped', flipped); const g = $('.ln-fcf-grade', box); if (g) g.hidden = !flipped; }
    function grade(g) { App.reviewCard(cards[i].key, g); stats[g]++; i++; flipped = false; draw(); }
    S.keyHook = (e) => {
      if (i >= cards.length) return;
      if (e.key === ' ' || e.key === 'Enter') { if (!(e.target.closest && e.target.closest('button'))) { e.preventDefault(); flip(); } }
      else if (flipped && /^[1-4]$/.test(e.key)) grade(G[+e.key - 1][0]);
    };
    draw();
    return { destroy() {} };
  }

  // QUIZ — konu testi
  RENDER.quiz = (el, only) => {
    const t = S.topic; const me = App.me();
    const all = t.questions || [];
    const retry = Array.isArray(only);
    const list = retry ? all.filter(q => only.includes(q.id)) : all.slice();
    const res = {}; let i = 0, answered = false;
    if (!list.length) { el.innerHTML = App.emptyState('📝', 'Bu konuda soru yok'); return; }
    const savedWrongs = all.filter(q => me.wrongs.includes(t.id + ':' + q.id)).map(q => q.id);
    const lastRes = me.quizResults[t.id];

    function seg() { return list.map((q, k) => `<span class="${k in res ? (res[k] ? 'ok' : 'err') : (k === i ? 'cur' : '')}"></span>`).join(''); }
    function drawQ() {
      answered = false; const q = list[i];
      el.innerHTML = `<div class="ln-quiz">
        <div class="ln-q-meta">
          <span class="ln-q-n">Soru ${i + 1} <small>/ ${list.length}</small></span>
          ${retry ? '<span class="tag accent">Yanlışları tekrar</span>' : ''}
          <span class="ln-diff d${q.difficulty || 1}" title="Zorluk">${'●'.repeat(q.difficulty || 1)}${'○'.repeat(3 - (q.difficulty || 1))} ${DIFF[q.difficulty || 1]}</span>
          ${!retry && i === 0 && lastRes ? `<span class="muted small ln-q-last">Son denemen: ${lastRes.score}/${lastRes.total}</span>` : ''}
          ${!retry && i === 0 && savedWrongs.length ? `<button class="btn sm" id="ln-q-wr">Kayıtlı ${savedWrongs.length} yanlışını çöz</button>` : ''}
        </div>
        <div class="ln-q-seg" aria-hidden="true">${seg()}</div>
        <p class="ln-q-text" lang="en">${esc(q.text)}</p>
        <div class="ln-opts" role="group" aria-label="Seçenekler">${q.options.map((o, k) => `<button class="ln-opt" data-k="${k}"><span class="ln-opt-l">${LETTERS[k]}</span><span class="ln-opt-t" lang="en">${esc(o)}</span></button>`).join('')}</div>
        <div class="ln-explain" id="ln-explain" hidden></div>
        <p class="muted small ln-q-hint hide-mobile">İpucu: <kbd>A</kbd>–<kbd>${LETTERS[q.options.length - 1]}</kbd> ya da <kbd>1</kbd>–<kbd>${q.options.length}</kbd> ile seç, <kbd>Enter</kbd> ile devam et.</p>
        ${K().questionNote ? K().questionNote() : ''}
      </div>`;
      $$('.ln-opt', el).forEach(b => b.onclick = () => choose(+b.dataset.k));
      const wr = $('#ln-q-wr', el); if (wr) wr.onclick = () => restart(savedWrongs);
    }
    function choose(k) {
      if (answered) return; answered = true;
      const q = list[i]; const ok = k === q.answer; res[i] = ok;
      $$('.ln-opt', el).forEach((b, j) => { b.disabled = true; if (j === q.answer) b.classList.add('ok'); else if (j === k) b.classList.add('err'); else b.classList.add('dim'); });
      const ex = $('#ln-explain', el);
      ex.className = 'ln-explain ' + (ok ? 'ok' : 'err');
      ex.innerHTML = `<div class="ln-ex-h">${ok ? '✓ Doğru!' : `✗ Yanlış — doğru cevap <b>${LETTERS[q.answer]}</b>`}</div>
        <p>${esc(q.explain || '')}</p>
        <button class="btn primary" id="ln-q-next">${i + 1 < list.length ? 'Sonraki soru →' : 'Sonucu gör →'}</button>`;
      ex.hidden = false;
      $('.ln-q-seg', el).innerHTML = seg();
      const nx = $('#ln-q-next', el); nx.onclick = () => { i++; i < list.length ? drawQ() : finish(); }; nx.focus({ preventScroll: true });
    }
    function finish() {
      const c = Object.values(res).filter(Boolean).length, n = list.length; const pct = Math.round(c / n * 100);
      list.forEach((q, k) => {
        const key = t.id + ':' + q.id; const at = me.wrongs.indexOf(key);
        if (res[k]) { if (at >= 0) me.wrongs.splice(at, 1); } else if (at < 0) me.wrongs.push(key);
      });
      if (!retry) me.quizResults[t.id] = { score: c, total: n, at: App.nowISO() };
      App.save();
      App.logStudy(Math.max(1, n));
      if (c > 0) App.addXP(c * 5, 'Konu testi');
      if (!retry && c === n) App.award('tam-puan');
      if (!retry) complete('quiz');
      const wrongIds = list.filter((q, k) => !res[k]).map(q => q.id);
      const msg = pct === 100 ? 'Kusursuz! Bu konuyu gerçekten kavramışsın.' : pct >= 60 ? 'İyi gidiyorsun. Yanlışlarına bir göz at, sonra tekrar dene.' : 'Sorun değil, öğrenmek böyle olur. Konu anlatımına dönüp tekrar deneyebilirsin.';
      el.innerHTML = `<div class="ln-result">
        <div class="ln-result-top">
          <div class="ln-result-ring">${App.ring(pct, 132, 11, pct >= 60 ? 'var(--primary)' : 'var(--accent)')}<span><b>${c}/${n}</b><small>%${pct}</small></span></div>
          <div><h2 class="serif">${retry ? 'Tekrar turu bitti' : 'Konu testi bitti'}</h2><p>${msg}</p>
            <div class="ln-result-act">
              ${wrongIds.length ? `<button class="btn primary" id="ln-q-rw">↺ Yanlışları tekrar çöz (${wrongIds.length})</button>` : ''}
              <button class="btn" id="ln-q-again">Baştan çöz</button>
              ${pct < 60 ? '<button class="btn" data-go-mode="text">📄 Konu anlatımına dön</button>' : ''}
            </div></div>
        </div>
        <ol class="ln-review">${list.map((q, k) => `<li class="${res[k] ? 'ok' : 'err'}"><span class="ln-rv-ic">${res[k] ? '✓' : '✗'}</span><div><p lang="en">${esc(q.text)}</p><small>Doğru cevap: <b lang="en">${LETTERS[q.answer]}) ${esc(q.options[q.answer])}</b></small></div></li>`).join('')}</ol>
        ${K().questionNote ? K().questionNote() : ''}
      </div>`;
      const rw = $('#ln-q-rw', el); if (rw) rw.onclick = () => restart(wrongIds);
      $('#ln-q-again', el).onclick = () => restart(null);
    }
    function restart(ids) { teardownMode(); RENDER.quiz(el, ids); refreshNext(); window.scrollTo({ top: Math.max(0, window.scrollY + el.getBoundingClientRect().top - 90), behavior: 'auto' }); }
    S.keyHook = (e) => {
      if (i >= list.length) return;
      const q = list[i]; if (!q) return;
      if (!answered) {
        let k = -1; if (/^[1-9]$/.test(e.key)) k = +e.key - 1; else { const L = LETTERS.indexOf(e.key.toUpperCase()); if (e.key.length === 1 && L >= 0) k = L; }
        if (k >= 0 && k < q.options.length) { e.preventDefault(); choose(k); }
      } else if (e.key === 'Enter' && !(e.target.closest && e.target.closest('button'))) { e.preventDefault(); const nx = $('#ln-q-next', el); nx && nx.click(); }
    };
    drawQ();
  };

  // NOTES
  RENDER.notes = (el) => {
    const t = S.topic; const me = App.me();
    el.innerHTML = `<div class="ln-notes">
      <div class="ln-notes-main">
        <div class="ln-notes-bar"><h2 class="serif">Notlarım</h2><span class="ln-saved muted small" id="ln-saved">Otomatik kaydedilir</span></div>
        <textarea class="ln-ta" id="ln-ta" aria-label="Bu konudaki notların" placeholder="Bu konuda aklında kalmasını istediklerini kendi cümlelerinle yaz…&#10;&#10;İpucu: kendi cümlelerinle yazmak, okumaktan çok daha kalıcıdır.">${esc(me.notes[t.id] || '')}</textarea>
        <div class="ln-notes-foot"><button class="btn sm" id="ln-addkp">🔑 Anahtar noktaları ekle</button><span class="muted small" id="ln-count"></span></div>
      </div>
      <aside class="ln-keys"><h3 class="serif">🔑 Anahtar noktalar</h3><ul>${(t.keyPoints || []).map(k => `<li>${esc(k)}</li>`).join('')}</ul>
        <p class="muted small">Konu anlatımında bir metni seçerek de doğrudan buraya ekleyebilirsin.</p></aside>
    </div>`;
    const ta = $('#ln-ta', el), cnt = $('#ln-count', el), saved = $('#ln-saved', el);
    let timer = 0;
    const count = () => { cnt.textContent = ta.value.length.toLocaleString('tr-TR') + ' karakter'; };
    const save = () => {
      clearTimeout(timer); timer = 0;
      const v = ta.value; if ((me.notes[t.id] || '') === v) return;
      if (v.trim()) me.notes[t.id] = v; else delete me.notes[t.id];
      App.save(); saved.textContent = '✓ Kaydedildi'; saved.classList.add('on');
      if (v.trim()) complete('notes');
    };
    ta.addEventListener('input', () => { count(); saved.textContent = 'Kaydediliyor…'; saved.classList.remove('on'); clearTimeout(timer); timer = setTimeout(save, 500); });
    ta.addEventListener('blur', save);
    $('#ln-addkp', el).onclick = () => {
      const add = (t.keyPoints || []).filter(k => !ta.value.includes(k)).map(k => '• ' + k);
      if (!add.length) { App.toast('Anahtar noktalar zaten notlarında'); return; }
      ta.value = (ta.value.replace(/\s+$/, '') ? ta.value.replace(/\s+$/, '') + '\n' : '') + add.join('\n');
      count(); save(); App.toast(`🔑 ${add.length} anahtar nokta eklendi`);
    };
    count();
    addCleanup(() => { if (timer) save(); });
  };
})();
