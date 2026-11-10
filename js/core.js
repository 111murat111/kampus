// Çekirdek: durum deposu, router, yerleşim ve yardımcılar (öğrenci odaklı platform).
(function () {
  const KEY = 'kampus-v3';
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function load() {
    try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {}
    return { db: clone(window.SEED), session: null };
  }
  let state = load();

  const App = {
    routes: [],
    // Her render sonrası çalışan genel kancalar: fn(path, params, hasLayout). Modüller push eder (ör. Hocaya Sor butonu, onboarding yönlendirmesi).
    afterRender: [],
    // Render öncesi yönlendirme kancaları: fn(path) → yeni yol (string) dönerse oraya gidilir.
    beforeRender: [],
    get db() { return state.db; },
    get user() { return state.session ? state.db.users.find(u => u.id === state.session.userId) : null; },
    save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} },
    reset() { state = { db: clone(window.SEED), session: state.session }; App.save(); App.render(); App.toast('Demo verisi sıfırlandı'); },
    login(userId) { state.session = { userId }; App.save(); location.hash = '#/dashboard'; App.render(); },
    logout() { state.session = null; App.save(); location.hash = '#/home'; App.render(); },
    uid(p = 'id') { return p + Math.random().toString(36).slice(2, 8); },

    // ---- Router ----
    // App.route('/course/:id', (params) => htmlString, { title, layout: true|false, after(params), wide: bool })
    route(pattern, render, opts = {}) {
      const keys = []; const rx = new RegExp('^' + pattern.replace(/:[^/]+/g, m => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$');
      App.routes.push({ pattern, rx, keys, render, opts });
    },
    go(path) { location.hash = '#' + path; },
    query() { const q = location.hash.split('?')[1] || ''; return Object.fromEntries(new URLSearchParams(q)); },
    render() {
      if (window._pageCleanup) { try { window._pageCleanup(); } catch (e) {} window._pageCleanup = null; }
      const path = (location.hash.slice(1) || '/dashboard').split('?')[0];
      const as = new URLSearchParams(location.search).get('as');
      if (as && state.db.users.some(u => u.id === as) && (!state.session || state.session.userId !== as)) { state.session = { userId: as }; App.save(); }
      if (!App.user && path !== '/login' && path !== '/home') { location.hash = '#/home'; return; }
      for (const fn of App.beforeRender) { let to = null; try { to = fn(path); } catch (e) { console.error(e); } if (to && to !== path) { location.hash = '#' + to; return; } }
      let match = null, params = {};
      for (const r of App.routes) { const m = path.match(r.rx); if (m) { match = r; r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1])); break; } }
      const root = document.getElementById('app');
      let content;
      try { content = match ? match.render(params) : App.emptyState('🧭', 'Sayfa bulunamadı', 'Aradığınız sayfa bu prototipte yok.'); }
      catch (e) { console.error(e); content = App.emptyState('⚠️', 'Bir hata oluştu', App.esc(e.message)); }
      const layout = !match || match.opts.layout !== false;
      root.innerHTML = '';
      if (layout) {
        root.innerHTML = App.shell(path, match && match.opts.wide);
        const main = root.querySelector('#main');
        if (typeof content === 'string') main.innerHTML = content; else if (content) main.appendChild(content);
        App.bindShell();
      } else {
        if (typeof content === 'string') root.innerHTML = content; else if (content) root.appendChild(content);
      }
      if (match && match.opts.after) { try { match.opts.after(params); } catch (e) { console.error(e); } }
      App.afterRender.forEach(fn => { try { fn(path, params, layout); } catch (e) { console.error(e); } });
      document.title = (match && match.opts.title ? match.opts.title + ' · ' : '') + 'Kampüs';
      window.scrollTo(0, 0);
    },
    // Sayfa ayrılırken (bir sonraki render'dan önce) çalışacak temizlik: zamanlayıcılar, dinleyiciler vb.
    onLeave(fn) { const prev = window._pageCleanup; window._pageCleanup = () => { prev && prev(); fn(); }; },

    // ---- Shell ----
    nav() {
      return [
        { href: '/dashboard', icon: '🏠', label: 'Panom' },
        { href: '/discover', icon: '🧭', label: 'Keşfet' },
        { href: '/my', icon: '📚', label: 'Kurslarım' },
        { href: '/paths', icon: '🛤️', label: 'Öğrenme Yolları' },
        { href: '/review', icon: '🃏', label: 'Tekrar', badge: App.dueCards().length },
        { href: '/practice', icon: '📝', label: 'Test Merkezi' },
        { href: '/mindmaps', icon: '🗺️', label: 'Zihin Haritaları' },
        { href: '/focus', icon: '🍅', label: 'Odak & Plan' },
        { href: '/rooms', icon: '👥', label: 'Çalışma Odaları' },
        { href: '/ask', icon: '💬', label: 'Hocaya Sor' },
        { href: '/stats', icon: '📈', label: 'İlerleme & Lig' }
      ];
    },
    shell(path, wide) {
      const u = App.user, me = App.me();
      const on = (h) => path === h || path.startsWith(h + '/');
      const cur = (b) => b ? ' aria-current="page"' : '';
      const nav = App.nav().map(i => `<a class="nav-item ${on(i.href) ? 'active' : ''}" href="#${i.href}"${cur(on(i.href))}><span class="nav-ic" aria-hidden="true">${i.icon}</span><span>${i.label}</span>${i.badge ? `<span class="pill" aria-label="${i.badge} kart bekliyor">${i.badge}</span>` : ''}</a>`).join('');
      const myCourses = App.myCourses().map(c => { const a = path.includes('/learn/' + c.id) || path === '/course/' + c.id; return `<a class="nav-course ${a ? 'active' : ''}" href="#/course/${c.id}"${cur(a)}><span class="dot" style="background:${c.color}" aria-hidden="true"></span><span class="nav-course-t">${App.esc(c.title.split(':')[0])}</span><small aria-label="yüzde ${App.courseProgress(c.id)} tamamlandı">%${App.courseProgress(c.id)}</small></a>`; }).join('');
      const lvl = App.level();
      // Mobil alt sekme çubuğu (≤760px görünür)
      const due = App.dueCards().length;
      const ic = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
      const tabs = [
        { href: '/dashboard', label: 'Panom', d: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>' },
        { href: '/discover', label: 'Keşfet', d: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>' },
        { href: '/review', label: 'Tekrar', d: '<rect x="4" y="6" width="13" height="15" rx="2"/><path d="M8 3h10a2 2 0 0 1 2 2v12"/>', badge: due },
        { href: '/practice', label: 'Test', d: '<path d="M9 4h6v3H9z"/><path d="M8 5.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1h-2"/><path d="m9 14 2 2 4-4"/>' }
      ].map(t => { const a = on(t.href) || (t.href === '/practice' && (path.startsWith('/exam') || path === '/wrongs')); return `<a class="tab-item ${a ? 'active' : ''}" href="#${t.href}"${cur(a)}>${ic(t.d)}${t.badge ? `<span class="tab-badge" aria-hidden="true">${t.badge > 99 ? '99+' : t.badge}</span>` : ''}<span class="tab-l">${t.label}${t.badge ? `<span class="sr-only">, ${t.badge} kart bekliyor</span>` : ''}</span></a>`; }).join('');
      return `
      <a class="skip-link" href="#main">İçeriğe atla</a>
      <div class="layout">
        <aside class="sidebar" id="sidebar" aria-label="Kenar çubuğu">
          <a class="brand" href="#/dashboard"><span class="logo" aria-hidden="true">K</span><span>Kampüs</span></a>
          <nav class="nav" aria-label="Ana menü">${nav}</nav>
          <div class="nav-section" id="nav-courses-h">Kurslarım</div>
          <nav class="nav" aria-labelledby="nav-courses-h">${myCourses || '<a class="nav-course" href="#/discover">+ Kurs keşfet</a>'}</nav>
          <div class="sidebar-foot"><span class="tag">DEMO</span> Gerçek bağlantı yok<span class="sidebar-foot-links">İçerik: Vikipedi · CC BY-SA 4.0 · <a href="#/sources">Kaynaklar</a></span></div>
        </aside>
        <div class="drawer-scrim" id="drawer-scrim" aria-hidden="true"></div>
        <div class="main-wrap">
          <header class="topbar">
            <button class="icon-btn only-mobile" id="menu-btn" aria-label="Menüyü aç" aria-controls="sidebar" aria-expanded="false"><span aria-hidden="true">☰</span></button>
            <form class="search" id="global-search" role="search"><input placeholder="Kurs, konu ara…" name="q" autocomplete="off" aria-label="Kurs veya konu ara" type="search"></form>
            <div class="topbar-right">
              <a class="chip-stat" href="#/stats" title="Çalışma serisi" aria-label="Çalışma serisi: ${me.streak} gün"><span aria-hidden="true">🔥</span> <b>${me.streak}</b><span class="hide-mobile"> gün</span></a>
              <a class="chip-stat" href="#/stats" title="Seviye ${lvl.level}" aria-label="${me.xp.toLocaleString('tr-TR')} XP, seviye ${lvl.level}"><span aria-hidden="true">⭐</span> <b>${me.xp.toLocaleString('tr-TR')}</b><span class="hide-mobile"> XP</span></a>
              <div class="user-menu">
                <button class="avatar-btn" id="user-btn" aria-haspopup="true" aria-expanded="false" aria-controls="user-dd" aria-label="Kullanıcı menüsü: ${App.esc(u.name)}">${App.avatar(u)}<span class="hide-mobile">${App.esc(u.name)}<br><small class="muted">Seviye ${lvl.level} · ${App.esc(u.target || '')}</small></span></button>
                <div class="dropdown" id="user-dd">
                  <a href="#/profile">Profil</a>
                  <a href="#/sources">Kaynaklar</a>
                  <a href="#" id="a11y-open">Görünüm &amp; Erişilebilirlik <kbd class="kbd">Alt+A</kbd></a>
                  ${state.db.users.filter(x => x.id !== u.id).map(x => `<a href="#" data-switch="${x.id}">${App.esc(x.name)} olarak geç</a>`).join('')}
                  <a href="#" id="reset-demo">Demo verisini sıfırla</a>
                  <a href="#" id="logout">Çıkış yap</a>
                </div>
              </div>
            </div>
          </header>
          <main id="main" class="main ${wide ? 'wide' : ''}" tabindex="-1"></main>
        </div>
        <nav class="tabbar" id="tabbar" aria-label="Alt sekmeler">${tabs}<button type="button" class="tab-item" id="tab-more" aria-controls="sidebar" aria-expanded="false">${ic('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>')}<span class="tab-l">Daha fazla</span></button></nav>
      </div>`;
    },
    bindShell() {
      const $ = (s) => document.querySelector(s);
      const dd = $('#user-dd'), ub = $('#user-btn');
      const setDD = (open, focusFirst) => {
        dd.classList.toggle('open', open); ub.setAttribute('aria-expanded', String(open));
        if (open && focusFirst) { const f = dd.querySelector('a'); f && f.focus(); }
      };
      ub.onclick = (e) => { e.stopPropagation(); setDD(!dd.classList.contains('open'), e.detail === 0); };
      // Klavye: Esc kapatır ve odağı butona döndürür; ok tuşları öğeler arasında gezer.
      dd.parentElement.onkeydown = (e) => {
        const items = [...dd.querySelectorAll('a')]; const i = items.indexOf(document.activeElement);
        if (e.key === 'Escape' && dd.classList.contains('open')) { e.preventDefault(); setDD(false); ub.focus(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); if (!dd.classList.contains('open')) setDD(true); (items[i + 1] || items[0]).focus(); }
        else if (e.key === 'ArrowUp' && dd.classList.contains('open')) { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
      };
      dd.parentElement.addEventListener('focusout', (e) => { if (!dd.parentElement.contains(e.relatedTarget) && e.relatedTarget) setDD(false); });
      document.addEventListener('click', () => { const d = $('#user-dd'); if (d) { d.classList.remove('open'); const b = $('#user-btn'); b && b.setAttribute('aria-expanded', 'false'); } }, { once: true });
      $('#logout').onclick = (e) => { e.preventDefault(); App.logout(); };
      $('#reset-demo').onclick = (e) => { e.preventDefault(); App.reset(); };
      document.querySelectorAll('[data-switch]').forEach(a => a.onclick = (e) => { e.preventDefault(); App.login(a.dataset.switch); App.toast('Hesap değiştirildi'); });
      const drawer = (open) => App.drawer ? App.drawer(open) : $('#sidebar').classList.toggle('open', open);
      $('#menu-btn').onclick = () => drawer(!$('#sidebar').classList.contains('open'));
      $('#tab-more').onclick = () => drawer(!$('#sidebar').classList.contains('open'));
      $('#global-search').onsubmit = (e) => { e.preventDefault(); const q = e.target.q.value.trim(); App.go('/discover?q=' + encodeURIComponent(q)); };
    },

    // ---- İçerik erişimi ----
    course: (id) => state.db.courses.find(c => c.id === id),
    topic: (id) => state.db.topics.find(t => t.id === id),
    path: (id) => state.db.paths.find(p => p.id === id),
    exam: (id) => state.db.exams.find(e => e.id === id),
    courseTopics(courseId) { const c = App.course(courseId); return c ? c.units.flatMap(u => u.topics).map(App.topic).filter(Boolean) : []; },
    allQuestions(courseId) { return App.courseTopics(courseId).flatMap(t => t.questions.map(q => ({ ...q, key: t.id + ':' + q.id, topicId: t.id, courseId }))); },
    question(key) { const [tid, qid] = key.split(':'); const t = App.topic(tid); const q = t && t.questions.find(x => x.id === qid); return q ? { ...q, key, topicId: tid, courseId: t.courseId } : null; },

    // ---- Öğrenci durumu ----
    me() {
      const u = App.user; if (!u) return null;
      const p = state.db.progress; if (!p[u.id]) p[u.id] = { enrolled: [], activePath: null, done: {}, modes: {}, last: null, notes: {}, cards: {}, quizResults: {}, wrongs: [], exams: [], xp: 0, streak: 0, lastStudy: null, studyLog: {}, goal: { dailyMinutes: 45 }, pomodoros: 0, badges: [], plan: [], mindmapsViewed: [], onboarded: false };
      return p[u.id];
    },
    myCourses() { const me = App.me(); return me ? me.enrolled.map(App.course).filter(Boolean) : []; },
    isEnrolled(courseId) { return App.me().enrolled.includes(courseId); },
    enroll(courseId) { const me = App.me(); if (!me.enrolled.includes(courseId)) { me.enrolled.push(courseId); App.addXP(20, 'Kursa kaydoldun'); App.save(); } },
    courseProgress(courseId) { const ts = App.courseTopics(courseId); if (!ts.length) return 0; const me = App.me(); return Math.round(ts.filter(t => me.done[t.id]).length / ts.length * 100); },
    // Öğrenme modları
    MODES: [
      { id: 'video', label: 'Video', icon: '🎬' }, { id: 'text', label: 'Konu Anlatımı', icon: '📄' },
      { id: 'mindmap', label: 'Zihin Haritası', icon: '🗺️' }, { id: 'cards', label: 'Bilgi Kartları', icon: '🃏' },
      { id: 'quiz', label: 'Konu Testi', icon: '📝' }, { id: 'notes', label: 'Notlarım', icon: '✏️' }
    ],
    // Bir öğrenme modunu tamamla. 3 farklı mod (notlar hariç) tamamlanınca konu "tamamlandı" sayılır.
    markMode(topicId, mode) {
      const me = App.me(); const arr = me.modes[topicId] = me.modes[topicId] || [];
      if (!arr.includes(mode)) { arr.push(mode); App.addXP(10, 'Öğrenme adımı'); }
      if (!me.done[topicId] && arr.filter(m => m !== 'notes').length >= 3) { me.done[topicId] = true; App.addXP(50, 'Konu tamamlandı'); App.award('ilk-adim'); App.toast('🎉 Konu tamamlandı! +50 XP'); }
      App.save();
    },
    toggleDone(topicId) { const me = App.me(); me.done[topicId] = !me.done[topicId]; if (me.done[topicId]) { App.addXP(50, 'Konu tamamlandı'); App.award('ilk-adim'); } App.save(); },
    setLast(courseId, topicId, mode) { const me = App.me(); me.last = { courseId, topicId, mode, pos: 0 }; App.save(); },

    // ---- Oyunlaştırma ----
    addXP(n, reason) {
      const me = App.me(); const before = App.level().level; me.xp += n;
      App.logStudy(0);
      const after = App.level().level;
      if (after > before) setTimeout(() => App.toast(`⭐ Seviye ${after}! Harika gidiyorsun.`), 400);
      App.save(); App.refreshChips();
    },
    level() { const xp = App.me() ? App.me().xp : 0; let level = 1, need = 200, acc = 0; while (xp >= acc + need) { acc += need; level++; need = Math.round(need * 1.25); } return { level, cur: xp - acc, need, pct: Math.round((xp - acc) / need * 100) }; },
    award(badgeId) { const me = App.me(); if (me.badges.includes(badgeId)) return false; me.badges.push(badgeId); const b = state.db.badges.find(x => x.id === badgeId); App.save(); if (b) setTimeout(() => App.toast(`${b.icon} Rozet kazandın: ${b.name}`), 700); return true; },
    // Çalışma süresi kaydı (dakika) + seri güncelleme
    logStudy(minutes) {
      const me = App.me(); const d = App.today();
      me.studyLog[d] = (me.studyLog[d] || 0) + minutes;
      if (me.lastStudy !== d) {
        const y = new Date(App.now()); y.setDate(y.getDate() - 1);
        me.streak = me.lastStudy === App.ymd(y) ? me.streak + 1 : 1;
        me.lastStudy = d;
        if (me.streak >= 7) App.award('seri-7');
      }
      App.save();
    },
    refreshChips() {
      const me = App.me(); if (!me) return;
      document.querySelectorAll('.chip-stat b').forEach((b, i) => { b.textContent = i === 0 ? me.streak : me.xp.toLocaleString('tr-TR'); });
    },

    // ---- Aralıklı tekrar (Leitner, 5 kutu) ----
    BOX_DAYS: [0, 1, 2, 4, 7, 15],
    cardKey: (topicId, cardId) => topicId + ':' + cardId,
    allCards(courseIds) { const ids = courseIds || App.me().enrolled; return ids.flatMap(cid => App.courseTopics(cid).flatMap(t => t.cards.map(c => ({ ...c, key: App.cardKey(t.id, c.id), topicId: t.id, courseId: cid })))); },
    cardState(key) { return App.me().cards[key] || null; },
    dueCards() { const me = App.me(); if (!me) return []; const today = App.today(); return App.allCards().filter(c => { const s = me.cards[c.key]; return s && s.due <= today; }); },
    newCards() { const me = App.me(); return App.allCards().filter(c => !me.cards[c.key]); },
    reviewCard(key, grade) { // grade: 'again' | 'hard' | 'good' | 'easy'
      const me = App.me(); const s = me.cards[key] || { box: 0, due: App.today() };
      if (grade === 'again') s.box = 1; else if (grade === 'hard') s.box = Math.max(1, s.box); else if (grade === 'good') s.box = Math.min(5, s.box + 1); else s.box = Math.min(5, s.box + 2);
      const d = new Date(App.now()); d.setDate(d.getDate() + App.BOX_DAYS[s.box]); s.due = App.ymd(d);
      me.cards[key] = s; me.cardReviews = (me.cardReviews || 0) + 1;
      if (me.cardReviews >= 50) App.award('kart-50');
      App.addXP(grade === 'again' ? 1 : 3, 'Kart tekrarı');
      App.save(); return s;
    },

    // ---- Biçim yardımcıları ----
    now() { return new Date('2026-11-09T12:00'); },
    today() { return App.ymd(App.now()); },
    ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
    nowISO() { const d = new Date(); const n = App.now(); n.setHours(d.getHours(), d.getMinutes()); return App.ymd(n) + 'T' + String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'); },
    fmtDate(iso, withTime = true) { const d = new Date(iso); return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) + (withTime ? ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''); },
    fmtShort(iso) { const d = new Date(iso); return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }); },
    relTime(iso) {
      const diff = (new Date(iso) - App.now()) / 36e5; const abs = Math.abs(diff);
      const txt = abs < 1 ? 'birkaç dakika' : abs < 24 ? Math.round(abs) + ' saat' : Math.round(abs / 24) + ' gün';
      return diff >= 0 ? txt + ' sonra' : txt + ' önce';
    },
    esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    avatar(u, size = 36) { return `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${size * 0.38}px">${App.esc(u.avatar)}</span>`; },
    progressBar(p, color) { return `<div class="progress"><span style="width:${p}%;${color ? 'background:' + color : ''}"></span></div>`; },
    ring(pct, size = 64, stroke = 6, color = 'var(--primary)') {
      const r = (size - stroke) / 2, c = 2 * Math.PI * r;
      return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(100, pct) / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
    },
    emptyState(icon, title, text = '', action = '') { return `<div class="empty"><div class="empty-ic">${icon}</div><h3>${title}</h3><p class="muted">${text}</p>${action}</div>`; },
    breadcrumbs(items) { return `<nav class="crumbs">${items.map((it, i) => i < items.length - 1 ? `<a href="#${it[1]}">${App.esc(it[0])}</a><span>›</span>` : `<span>${App.esc(it[0])}</span>`).join('')}</nav>`; },
    stars(r) { const n = Math.round(r); return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); },

    // ---- UI: toast & modal ----
    toast(msg, type = 'ok') {
      const el = document.createElement('div'); el.className = 'toast ' + type; el.textContent = msg;
      const box = document.getElementById('toasts'); if (!box.hasAttribute('role')) { box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); }
      document.getElementById('toasts').appendChild(el); setTimeout(() => el.classList.add('hide'), 2600); setTimeout(() => el.remove(), 3000);
    },
    modal({ title, body, actions = [], wide = false }) {
      const root = document.getElementById('modal-root');
      // Erişilebilir diyalog: role=dialog + aria-modal, başlık bağlantısı, odak tuzağı, Esc ile kapanma, kapanınca odağı geri ver.
      const opener = root.querySelector('.modal') ? (root._opener || null) : document.activeElement;
      const tid = App.uid('mt-');
      root.innerHTML = `<div class="modal-bg"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="${tid}" tabindex="-1"><div class="modal-head"><h3 id="${tid}">${title}</h3><button class="icon-btn" data-x aria-label="Kapat"><span aria-hidden="true">✕</span></button></div><div class="modal-body">${body}</div><div class="modal-foot">${actions.map((a, i) => `<button class="btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}" data-a="${i}">${a.label}</button>`).join('')}</div></div></div>`;
      root._opener = opener;
      const el = root.querySelector('.modal');
      const close = () => {
        if (!root.contains(el)) return;
        root.innerHTML = ''; const o = root._opener; root._opener = null;
        if (o && o.isConnected && typeof o.focus === 'function') o.focus(); else { const m = document.getElementById('main'); m && m.focus({ preventScroll: true }); }
      };
      const FOC = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
        if (e.key !== 'Tab') return;
        const f = [...el.querySelectorAll(FOC)].filter(x => x.offsetParent !== null || x === document.activeElement);
        if (!f.length) { e.preventDefault(); el.focus(); return; }
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
      setTimeout(() => { if (!root.contains(el) || el.contains(document.activeElement)) return; const f = el.querySelector('.modal-body input:not([type=hidden]):not([disabled]), .modal-body select, .modal-body textarea'); (f || el).focus(); }, 0);
      root.querySelector('[data-x]').onclick = close;
      root.querySelector('.modal-bg').onclick = (e) => { if (e.target.classList.contains('modal-bg')) close(); };
      root.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { const a = actions[+b.dataset.a]; a.onClick ? a.onClick(close, el) : close(); });
      return el;
    },
    confirm(text, onYes) { App.modal({ title: 'Emin misin?', body: `<p>${text}</p>`, actions: [{ label: 'Vazgeç' }, { label: 'Evet', primary: true, onClick: (c) => { c(); onYes(); } }] }); }
  };

  window.App = App;
  // Rota değişimi: a11y.js varsa (görünüm geçişi + odak yönetimi) onun üzerinden render et.
  window.addEventListener('hashchange', () => App.navRender ? App.navRender() : App.render());
})();
