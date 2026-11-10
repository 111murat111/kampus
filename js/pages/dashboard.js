// Panom (/dashboard) — öğrenciyi motive eden ana ekran.
// Ayrıca discover.js'in de kullandığı küçük ortak yardımcıları (window.KUI) tanımlar.
(function () {
  const esc = (s) => App.esc(s);
  const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');
  const lower = (s) => String(s || '').toLocaleLowerCase('tr-TR');
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------- Ortak yardımcılar ----------------
  const KUI = {
    fmt, lower,
    learnHref(courseId, topicId, mode) { return `#/learn/${courseId}/${topicId}${mode ? '?mode=' + mode : ''}`; },
    modeOf(id) { return App.MODES.find(m => m.id === id) || App.MODES[0]; },
    // Bir kursta sıradaki konu: kaldığı yer → ilk tamamlanmamış → ilk konu
    nextTopic(courseId) {
      const me = App.me(); const ts = App.courseTopics(courseId);
      if (me.last && me.last.courseId === courseId && App.topic(me.last.topicId)) return { topic: App.topic(me.last.topicId), mode: me.last.mode, resumed: true };
      const t = ts.find(x => !me.done[x.id]) || ts[0];
      if (!t) return null;
      const doneModes = me.modes[t.id] || [];
      const mode = (App.MODES.find(m => m.id !== 'notes' && !doneModes.includes(m.id)) || App.MODES[0]).id;
      return { topic: t, mode, resumed: false };
    },
    // Konu bazında başarı (konu testleri + denemeler)
    topicScores() {
      const me = App.me(); const acc = {};
      const add = (tid, c, t) => { if (!t) return; const a = acc[tid] = acc[tid] || { c: 0, t: 0 }; a.c += c; a.t += t; };
      Object.entries(me.quizResults || {}).forEach(([tid, r]) => add(tid, r.score, r.total));
      (me.exams || []).forEach(ex => Object.entries(ex.byTopic || {}).forEach(([tid, r]) => add(tid, r.c, r.t)));
      return acc;
    },
    weakTopics() {
      const sc = KUI.topicScores();
      return Object.entries(sc).map(([tid, s]) => ({ topic: App.topic(tid), pct: Math.round(s.c / s.t * 100), c: s.c, t: s.t }))
        .filter(x => x.topic && x.pct < 60).sort((a, b) => a.pct - b.pct);
    },
    pathProgress(p) { if (!p || !p.steps.length) return 0; return Math.round(p.steps.reduce((s, st) => s + App.courseProgress(st.courseId), 0) / p.steps.length); },
    // İçerik otomatik çekildiği için "güncelleme tarihi" = içeriğin çekildiği gün.
    updatedOf() { return App.db.contentFetchedAt || App.today(); },
    // Kaynak gösterimi (CC BY-SA 4.0) — tüm sayfalar ortak kullanır.
    extLink(href, label) { return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`; },
    // Konu metninin kaynağı: tam kutu. topic.source yoksa boş döner.
    sourceBox(t) {
      const s = t && t.source; if (!s || !s.url) return '';
      return `<aside class="src-box" aria-label="Kaynak"><span class="src-box-k">Kaynak</span><p>${esc(s.name || 'Vikipedi')} — ${KUI.extLink(s.url, '«' + (s.title || t.title) + '»')} · ${s.licenseUrl ? KUI.extLink(s.licenseUrl, s.license || 'CC BY-SA 4.0') : esc(s.license || 'CC BY-SA 4.0')} · Metin kısaltılarak alınmıştır. <a href="#/sources">Tüm kaynaklar</a></p></aside>`;
    },
    // Tek satırlık not: what = 'harita' | 'kartlar' | 'bölüm başlıkları' …
    sourceNote(t, what) {
      const s = t && t.source; if (!s || !s.url) return '';
      return `<p class="src-note">Bu ${esc(what)} ${KUI.extLink(s.url, (s.name || 'Vikipedi') + ' maddesinden')} otomatik türetilmiştir · ${s.licenseUrl ? KUI.extLink(s.licenseUrl, s.license || 'CC BY-SA 4.0') : esc(s.license || 'CC BY-SA 4.0')}</p>`;
    },
    // Soruların kaynağı (Open Trivia DB).
    questionNote() {
      const s = (App.db.sources || []).find(x => /trivia/i.test(x.name)); if (!s) return '';
      return `<p class="src-note">Sorular: ${KUI.extLink(s.url, 'Open Trivia DB')} (${s.licenseUrl ? KUI.extLink(s.licenseUrl, s.license) : esc(s.license)}) · İngilizce · <a href="#/sources">Kaynaklar</a></p>`;
    },
    // Düz renk kapak + ince nokta dokusu + büyük emoji
    cover(c, cls = '') {
      const cat = (App.db.categories.find(x => x.id === c.category) || {}).name || '';
      return `<div class="dsc-cover ${cls}" style="--c:${c.color}"><span class="dsc-cover-cat">${esc(cat)}</span><span class="dsc-cover-tag serif">${esc((c.tags || [])[0] || '')}</span><span class="dsc-cover-emoji" aria-hidden="true">${c.emoji}</span></div>`;
    },
    // Yumuşak giriş animasyonları: halkalar, ilerleme çubukları, sayılar
    animateIn(root) {
      if (!root || reduced()) return;
      root.querySelectorAll('svg.ring').forEach(svg => {
        const c = svg.querySelectorAll('circle')[1]; if (!c) return;
        const target = c.getAttribute('stroke-dashoffset'); const full = c.getAttribute('stroke-dasharray');
        c.style.transition = 'none'; c.style.strokeDashoffset = full;
        requestAnimationFrame(() => requestAnimationFrame(() => { c.style.transition = 'stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)'; c.style.strokeDashoffset = target; }));
      });
      root.querySelectorAll('.progress > span').forEach(s => {
        const w = s.style.width; s.style.transition = 'none'; s.style.width = '0';
        requestAnimationFrame(() => requestAnimationFrame(() => { s.style.transition = 'width .9s cubic-bezier(.2,.7,.2,1)'; s.style.width = w; }));
      });
      const els = root.querySelectorAll('[data-count]'); if (!els.length) return;
      let raf, t0 = null; const dur = 900;
      const tick = (ts) => {
        if (t0 === null) t0 = ts; const k = Math.min(1, (ts - t0) / dur); const e = 1 - Math.pow(1 - k, 3);
        els.forEach(el => { el.textContent = fmt(Math.round(+el.dataset.count * e)); });
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      App.onLeave(() => cancelAnimationFrame(raf));
    },
    courseCard(c, opts = {}) {
      const enrolled = App.isEnrolled(c.id); const p = App.courseProgress(c.id);
      return `<a class="dsc-card" href="#/course/${c.id}">
        ${KUI.cover(c)}
        ${enrolled ? `<span class="dsc-enrolled">✓ Kayıtlı</span>` : ''}
        <div class="dsc-card-body">
          <h3 class="dsc-card-t">${esc(c.title)}</h3>
          <div class="dsc-card-ins">${esc(c.instructor)}</div>
          <div class="dsc-rate"><b>${c.rating.toFixed(1).replace('.', ',')}</b><span class="dsc-stars">${App.stars(c.rating)}</span><span class="muted">(${fmt(c.ratingCount)})</span></div>
          <div class="dsc-meta"><span>👥 ${fmt(c.students)}</span><span>⏱ ${c.hours} saat</span><span class="tag ${c.level === 'İleri' ? 'accent' : c.level === 'Orta' ? 'primary' : ''}">${esc(c.level)}</span></div>
          ${opts.extra || ''}
          ${enrolled ? `<div class="dsc-card-prog">${App.progressBar(p)}<small>%${p}</small></div>` : ''}
        </div>
      </a>`;
    }
  };
  window.KUI = KUI;

  // ---------------- Panom ----------------
  const DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  function greeting() { const h = new Date().getHours(); return h < 6 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar'; }

  function lastNDays(n) {
    const out = []; const base = App.now();
    for (let i = n - 1; i >= 0; i--) { const d = new Date(base); d.setDate(d.getDate() - i); out.push(d); }
    return out;
  }

  function continueCard(me) {
    const courses = App.myCourses();
    if (!courses.length) {
      return `<section class="card dsh-continue dsh-continue-empty">
        <div><div class="dsh-eyebrow">İlk adım</div><h2 class="serif dsh-cont-t">Öğrenme yolculuğun bir kursla başlar.</h2>
        <p class="muted">Hedefine uygun bir kurs seç, ücretsiz kaydol ve ilk konuyu bugün bitir.</p>
        <a class="btn primary" href="#/discover">Kursları keşfet →</a></div></section>`;
    }
    let cid = me.last && App.course(me.last.courseId) ? me.last.courseId : courses[0].id;
    const nx = KUI.nextTopic(cid); const c = App.course(cid);
    if (!nx) return '';
    const t = nx.topic; const mode = KUI.modeOf(nx.mode); const done = me.modes[t.id] || [];
    const unit = c.units.find(u => u.topics.includes(t.id));
    const pos = nx.resumed && me.last.pos ? `${Math.floor(me.last.pos / 60)}:${String(me.last.pos % 60).padStart(2, '0')}` : '';
    return `<section class="card dsh-continue">
      <a class="dsh-cont-cover" href="${KUI.learnHref(c.id, t.id, mode.id)}" style="--c:${c.color}" aria-label="Devam et"><span>${c.emoji}</span><i class="dsh-play">▶</i></a>
      <div class="dsh-cont-body">
        <div class="dsh-eyebrow">${nx.resumed ? 'Kaldığın yerden devam et' : 'Sıradaki konun'}</div>
        <h2 class="serif dsh-cont-t">${esc(t.title)}</h2>
        <div class="muted small">${esc(c.title)}${unit ? ' · ' + esc(unit.title) : ''}</div>
        <div class="dsh-modes" title="Bu konuda tamamladığın öğrenme yolları">
          ${App.MODES.map(m => `<span class="dsh-mode ${done.includes(m.id) ? 'on' : ''} ${m.id === mode.id ? 'cur' : ''}" title="${m.label}">${m.icon}</span>`).join('')}
          <small class="muted">${done.filter(m => m !== 'notes').length}/3 yol → konu tamam</small>
        </div>
        <div class="row dsh-cont-actions">
          <a class="btn primary" href="${KUI.learnHref(c.id, t.id, mode.id)}">▶ ${nx.resumed ? 'Devam et' : 'Başla'} · ${mode.icon} ${mode.label}${pos ? ` <span class="dsh-pos">${pos}</span>` : ''}</a>
          <a class="btn ghost" href="#/course/${c.id}">Müfredat</a>
        </div>
      </div>
      <div class="dsh-cont-ring">${App.ring(App.courseProgress(c.id), 84, 7)}<div><b>%${App.courseProgress(c.id)}</b><small>kurs</small></div></div>
    </section>`;
  }

  function goalCard(me) {
    const goal = (me.goal && me.goal.dailyMinutes) || 45;
    const todayMin = me.studyLog[App.today()] || 0; const pct = Math.min(100, Math.round(todayMin / goal * 100));
    const lvl = App.level();
    const msg = todayMin === 0 ? `Bugün henüz başlamadın. 15 dakika ile ısın — serin ${me.streak + 1}. güne çıksın.` : pct >= 100 ? 'Günlük hedef tamam! Bugün kendinle gurur duyabilirsin.' : `Hedefe ${goal - todayMin} dakika kaldı. Bir pomodoro yeter!`;
    return `<section class="card dsh-goal">
      <div class="dsh-goal-top">
        <div class="dsh-goal-ring">${App.ring(pct, 112, 10, 'var(--primary)')}<div><b data-count="${todayMin}">${todayMin}</b><small>/ ${goal} dk</small></div></div>
        <div class="dsh-goal-txt">
          <div class="dsh-eyebrow">Günlük hedef</div>
          <p>${msg}</p>
          <a class="btn sm" href="#/focus">🍅 Odak modunu aç</a>
        </div>
      </div>
      <div class="dsh-goal-stats">
        <a href="#/stats" class="dsh-mini"><span class="dsh-fire">🔥</span><div><b data-count="${me.streak}">${me.streak}</b><small>gün seri</small></div></a>
        <a href="#/stats" class="dsh-mini dsh-lvl"><div class="row between"><span><b>Seviye ${lvl.level}</b></span><small class="muted">${fmt(lvl.cur)} / ${fmt(lvl.need)} XP</small></div>${App.progressBar(lvl.pct, 'var(--accent)')}</a>
      </div>
    </section>`;
  }

  function tasksCard(me) {
    const today = App.today(); me.plan = me.plan || [];
    const plan = me.plan.filter(p => p.day === today);
    const due = App.dueCards().length; const weak = KUI.weakTopics()[0];
    const rows = plan.map(p => {
      const t = p.topicId && App.topic(p.topicId);
      const href = t ? KUI.learnHref(t.courseId, t.id) : /kart/i.test(p.title) ? '#/review' : /deneme/i.test(p.title) ? '#/practice' : '';
      return `<li class="dsh-task ${p.done ? 'done' : ''}">
        <button class="dsh-check" data-plan="${p.id}" aria-label="${p.done ? 'Geri al' : 'Tamamlandı işaretle'}">${p.done ? '✓' : ''}</button>
        <div class="dsh-task-t"><b>${esc(p.title)}</b>${t ? `<small class="muted">${esc(App.course(t.courseId).title.split(':')[0])}</small>` : '<small class="muted">Planından</small>'}</div>
        ${href && !p.done ? `<a class="btn sm" href="${href}">Başla</a>` : ''}
      </li>`;
    });
    if (due) rows.push(`<li class="dsh-task"><span class="dsh-check auto">🃏</span><div class="dsh-task-t"><b>${due} bilgi kartı tekrar bekliyor</b><small class="muted">Unutmadan önce yakala · ~${Math.max(2, Math.round(due * 0.5))} dk</small></div><a class="btn sm accent" href="#/review">Tekrar et</a></li>`);
    if (weak) rows.push(`<li class="dsh-task"><span class="dsh-check auto">🎯</span><div class="dsh-task-t"><b>${esc(weak.topic.title)} konusunu pekiştir</b><small class="muted">Başarın %${weak.pct} — kartlar + konu testiyle toparla</small></div><a class="btn sm" href="${KUI.learnHref(weak.topic.courseId, weak.topic.id, 'cards')}">Pekiştir</a></li>`);
    const total = plan.length, doneN = plan.filter(p => p.done).length;
    return `<section class="card dsh-tasks">
      <div class="card-head"><h3>Bugünün görevleri</h3>${total ? `<span class="tag ${doneN === total ? 'ok' : ''}">${doneN}/${total} plan</span>` : ''}</div>
      ${rows.length ? `<ul class="list dsh-task-list">${rows.join('')}</ul>` : `<div class="dsh-empty-sm"><p class="muted">Bugün için planlanmış görev yok. Küçük bir plan, büyük fark yaratır.</p><a class="btn sm" href="#/focus">+ Bugünü planla</a></div>`}
    </section>`;
  }

  function weekCard(me) {
    const days = lastNDays(7); const goal = (me.goal && me.goal.dailyMinutes) || 45;
    const vals = days.map(d => me.studyLog[App.ymd(d)] || 0);
    const max = Math.max(goal, ...vals, 1); const total = vals.reduce((a, b) => a + b, 0);
    const hit = vals.filter(v => v >= goal).length;
    return `<section class="card dsh-week">
      <div class="card-head"><h3>Bu hafta</h3><a class="small" href="#/stats">Ayrıntılar →</a></div>
      <div class="dsh-week-sum"><div><b class="serif" data-count="${total}">${total}</b><small>dakika</small></div><div><b class="serif">${hit}/7</b><small>hedef günü</small></div></div>
      <div class="dsh-bars" style="--goal-k:${(goal / max).toFixed(3)}">
        <span class="dsh-goal-line"><i>hedef ${goal} dk</i></span>
        ${days.map((d, i) => { const v = vals[i]; const isToday = i === 6; return `<div class="dsh-bar ${v >= goal ? 'hit' : ''} ${isToday ? 'today' : ''}" title="${v} dk"><span style="height:${Math.max(v ? 4 : 0, v / max * 100)}%;animation-delay:${i * 60}ms"></span><small>${isToday ? 'Bugün' : DAYS[d.getDay()]}</small></div>`; }).join('')}
      </div>
    </section>`;
  }

  function coursesBlock(me) {
    const cs = App.myCourses();
    if (!cs.length) return '';
    return `<section class="dsh-sec">
      <div class="dsh-sec-head"><h2 class="serif">Kurslarım</h2><a class="small" href="#/my">Tümü →</a></div>
      <div class="dsh-courses">${cs.map(c => {
        const p = App.courseProgress(c.id); const nx = KUI.nextTopic(c.id); const ts = App.courseTopics(c.id);
        return `<a class="card dsh-course" href="${nx ? KUI.learnHref(c.id, nx.topic.id, nx.mode) : '#/course/' + c.id}">
          <span class="dsh-course-ic" style="--c:${c.color}">${c.emoji}</span>
          <div class="dsh-course-b"><b>${esc(c.title.split(':')[0])}</b><small class="muted">${ts.filter(t => me.done[t.id]).length}/${ts.length} konu${nx ? ' · Sıradaki: ' + esc(nx.topic.title) : ''}</small>${App.progressBar(p, c.color)}</div>
          <span class="dsh-course-p">%${p}</span>
        </a>`;
      }).join('')}</div>
    </section>`;
  }

  function weakCard() {
    const weak = KUI.weakTopics();
    return `<section class="card dsh-weak">
      <div class="card-head"><h3>Eksik konuların</h3><a class="small" href="#/wrongs">Yanlışlarım →</a></div>
      ${weak.length ? `<ul class="list">${weak.slice(0, 4).map(w => {
        const c = App.course(w.topic.courseId);
        return `<li><a class="dsh-weak-row" href="${KUI.learnHref(w.topic.courseId, w.topic.id, 'text')}">
          <span class="dsh-weak-pct ${w.pct < 35 ? 'bad' : ''}">%${w.pct}</span>
          <span class="dsh-weak-t"><b>${esc(w.topic.title)}</b><small class="muted">${esc(c ? c.title.split(':')[0] : '')} · ${w.c}/${w.t} doğru</small></span>
          <span class="dsh-go">Çalış →</span></a></li>`;
      }).join('')}</ul><p class="small muted dsh-note">Testlerde %60'ın altında kalan konular. Önce konu anlatımı, sonra kartlar — sonra testi tekrar dene.</p>`
      : `<div class="dsh-empty-sm"><p class="muted">Şu an eksik görünen konu yok 🎉 Konu testi çözdükçe burada sana özel öneriler belirecek.</p><a class="btn sm" href="#/practice">Test çöz</a></div>`}
    </section>`;
  }

  function pathCard(me) {
    const p = me.activePath && App.path(me.activePath);
    if (!p) return `<section class="card dsh-path"><div class="card-head"><h3>Öğrenme yolu</h3></div><div class="dsh-empty-sm"><p class="muted">Hedefine giden adım adım bir rota seç; ne çalışacağını düşünmekle vakit kaybetme.</p><a class="btn sm primary" href="#/paths">Yolları gör →</a></div></section>`;
    const pct = KUI.pathProgress(p); const activeIdx = p.steps.findIndex(s => App.courseProgress(s.courseId) < 100);
    return `<section class="card dsh-path">
      <div class="card-head"><h3>${p.emoji} ${esc(p.title)}</h3><span class="tag primary">%${pct}</span></div>
      <ol class="dsh-metro">${p.steps.map((s, i) => {
        const c = App.course(s.courseId); const cp = App.courseProgress(s.courseId);
        const st = cp >= 100 ? 'done' : i === activeIdx ? 'active' : 'locked';
        return `<li class="${st}"><i></i><a href="#/course/${s.courseId}"><b>${esc(c ? c.title.split(':')[0] : s.courseId)}</b><small class="muted">${esc(s.note)} · %${cp}</small></a></li>`;
      }).join('')}</ol>
      <a class="small" href="#/paths/${p.id}">Yol haritasını aç →</a>
    </section>`;
  }

  function leagueCard(me) {
    const u = App.user;
    const rows = App.db.league.map(x => ({ ...x })).concat([{ name: u.name.split(' ')[0] + ' (sen)', avatar: u.avatar, xp: me.xp, me: true }]).sort((a, b) => b.xp - a.xp);
    const rank = rows.findIndex(r => r.me); const above = rows[rank - 1];
    let show = rows.slice(0, 5); if (rank >= 5) show = rows.slice(0, 3).concat([rows[rank - 1], rows[rank]]);
    return `<section class="card dsh-league">
      <div class="card-head"><h3>Haftalık lig</h3><span class="tag accent">${rank + 1}. sıradasın</span></div>
      <ol class="dsh-lg">${show.map(r => { const i = rows.indexOf(r); return `<li class="${r.me ? 'me' : ''}"><span class="dsh-lg-n">${i + 1}</span>${App.avatar(r, 28)}<span class="dsh-lg-name">${esc(r.name)}</span><b>${fmt(r.xp)}</b></li>`; }).join('')}</ol>
      <p class="small muted dsh-note">${above ? `<b>${esc(above.name)}</b>'i geçmek için <b>${fmt(above.xp - me.xp + 1)} XP</b> daha. Bir konu tamamlamak +50 XP!` : 'Zirvedesin! Yerini korumak için seriyi bozma.'}</p>
    </section>`;
  }

  function badgesStrip(me) {
    const all = App.db.badges; const got = me.badges || [];
    return `<section class="dsh-sec">
      <div class="dsh-sec-head"><h2 class="serif">Rozetler <small class="muted">${got.length}/${all.length}</small></h2><a class="small" href="#/profile">Profilim →</a></div>
      <div class="dsh-badges">${all.map(b => `<div class="dsh-badge ${got.includes(b.id) ? 'got' : ''}" title="${esc(b.desc)}"><span>${b.icon}</span><b>${esc(b.name)}</b><small>${got.includes(b.id) ? 'Kazanıldı' : esc(b.desc)}</small></div>`).join('')}</div>
    </section>`;
  }

  function suggest() {
    // Öncelik: etkin öğrenme yolundaki kayıt olunmamış kurslar, sonra puana göre.
    const me = App.me(); const p = me.activePath && App.path(me.activePath);
    const onPath = p ? p.steps.map(s => s.courseId) : [];
    const list = App.db.courses.filter(c => !App.isEnrolled(c.id)).sort((a, b) => onPath.includes(b.id) - onPath.includes(a.id) || b.rating - a.rating).slice(0, 3);
    if (!list.length) return '';
    return `<div class="dsh-sug">${list.map(c => `<a href="#/course/${c.id}"><span style="--c:${c.color}">${c.emoji}</span><b>${esc(c.title.split(':')[0])}</b><small>★ ${c.rating.toFixed(1).replace('.', ',')}</small></a>`).join('')}</div>`;
  }

  App.route('/dashboard', () => {
    const u = App.user, me = App.me();
    me.goal = me.goal || { dailyMinutes: 45 }; me.studyLog = me.studyLog || {}; me.badges = me.badges || [];
    const date = App.now().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
    const first = u.name.split(' ')[0];
    const sub = me.streak >= 3 ? `${me.streak} gündür aralıksız çalışıyorsun — bu ritmi koru.` : 'Her gün biraz, ama her gün. Bugün küçük bir adım yeter.';
    return `<div class="dsh">
      <header class="dsh-hello">
        <div><div class="dsh-date">${esc(date)}${u.target ? ' · ' + esc(u.target) : ''}</div>
        <h1 class="dsh-h1">${greeting()}, ${esc(first)}.</h1>
        <p class="muted dsh-sub">${sub}</p></div>
      </header>
      <div class="dsh-top">${continueCard(me)}${goalCard(me)}</div>
      <div class="dsh-two">${tasksCard(me)}${weekCard(me)}</div>
      ${coursesBlock(me)}
      <div class="dsh-two">${weakCard()}${pathCard(me)}</div>
      <div class="dsh-two dsh-two-b">${leagueCard(me)}<section class="card dsh-cta"><div class="dsh-eyebrow">Yeni bir şey öğren</div><h3 class="serif">Merak ettiğin bir konu mu var?</h3><p class="muted small">Katalogda ${App.db.courses.length} kurs ve ${App.db.topics.length} konu seni bekliyor. Sana önerdiklerimiz:</p>${suggest()}<a class="btn" href="#/discover">🧭 Tüm kursları keşfet</a></section></div>
      ${badgesStrip(me)}
    </div>`;
  }, {
    title: 'Panom',
    after() {
      const root = document.querySelector('.dsh');
      KUI.animateIn(root);
      root.querySelectorAll('[data-plan]').forEach(b => b.onclick = () => {
        const me = App.me(); const p = me.plan.find(x => x.id === b.dataset.plan); if (!p) return;
        p.done = !p.done;
        if (p.done) { if (!p.xpGiven) { p.xpGiven = true; App.addXP(5, 'Plan görevi'); } App.toast('✓ Görev tamamlandı. Böyle devam!'); }
        App.save(); App.render();
      });
    }
  });
})();
