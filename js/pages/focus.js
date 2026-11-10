// Odak & Plan (Pomodoro + haftalık plan), İlerleme & Lig, Profil (fc-).
(function () {
  const esc = (s) => App.esc(s);
  const safeColor = (c) => /^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : 'var(--primary)';
  const mmss = (sec) => { sec = Math.max(0, Math.ceil(sec)); return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); };
  const addDays = (ymd, n) => { const d = new Date(ymd + 'T12:00'); d.setDate(d.getDate() + n); return App.ymd(d); };
  const dayName = (ymd, opt = 'short') => new Date(ymd + 'T12:00').toLocaleDateString('tr-TR', { weekday: opt });
  const dayNum = (ymd) => new Date(ymd + 'T12:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const mondayOf = (ymd) => { const d = new Date(ymd + 'T12:00'); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return App.ymd(d); };
  const hm = (min) => { const h = Math.floor(min / 60), m = min % 60; return h ? `${h} sa${m ? ' ' + m + ' dk' : ''}` : `${m} dk`; };
  const topicOptions = (sel) => App.myCourses().map(c => `<optgroup label="${esc(c.title.split(':')[0])}">${App.courseTopics(c.id).map(t => `<option value="${esc(t.id)}" ${t.id === sel ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</optgroup>`).join('');

  // ================= 7. ODAK & PLAN =================
  // Zamanlayıcı durumu modül içinde tutulur; sayfadan çıkınca duraklatılır.
  let pomo = null;
  function pomoInit() {
    const me = App.me(); const st = me.pomoSettings || { work: 25, brk: 5 };
    if (!pomo || pomo.uid !== App.user.id) pomo = { uid: App.user.id, phase: 'work', work: st.work, brk: st.brk, left: st.work * 60, running: false, endsAt: 0, topicId: me.last ? me.last.topicId : '' };
    return pomo;
  }
  let weekOffset = 0;

  function focusPage() {
    const me = App.me(); const p = pomoInit();
    const today = App.today(); const goal = (me.goal && me.goal.dailyMinutes) || 45;
    const todayMin = me.studyLog[today] || 0; const gp = Math.min(100, Math.round(todayMin / goal * 100));
    const todayPomo = (me.pomoLog || {})[today] || 0;
    return `
    <div class="fc-head"><div><span class="fc-eyebrow">Odak &amp; Plan</span><h1>Tek iş, tam odak.</h1>
      <p class="muted">25 dakika çalış, 5 dakika nefes al. Küçük bloklar büyük sonuçlar doğurur.</p></div></div>
    <div class="fc-top">
      <section class="card fc-pomo" id="fc-pomo">${pomoInner(p)}</section>
      <div class="fc-side">
        <section class="card fc-goal">
          <div class="fc-goal-ring">${App.ring(gp, 104, 9, gp >= 100 ? 'var(--ok)' : 'var(--accent)')}<div><b>${todayMin}</b><small>/ ${goal} dk</small></div></div>
          <div class="fc-goal-info">
            <h3 class="serif">Bugünkü hedef</h3>
            <p class="small muted">${gp >= 100 ? 'Hedefini tamamladın! Bugün kendinle gurur duy. 🌿' : `Hedefe <b>${goal - todayMin} dk</b> kaldı — yaklaşık ${Math.ceil((goal - todayMin) / p.work)} pomodoro.`}</p>
            <form class="fc-goal-form" id="fc-goal-form"><label class="small" for="fc-goal-in">Günlük hedef</label>
              <select id="fc-goal-in" class="input">${[15, 30, 45, 60, 90, 120, 180].concat([goal]).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b).map(v => `<option value="${v}" ${v === goal ? 'selected' : ''}>${v} dakika</option>`).join('')}</select></form>
          </div>
        </section>
        <section class="card fc-mini-stats">
          <div><b>${todayPomo}</b><span>bugün 🍅</span></div>
          <div><b>${me.pomodoros}</b><span>toplam 🍅</span></div>
          <div><b>${me.streak}</b><span>gün seri 🔥</span></div>
        </section>
        ${me.pomodoros < 10 ? `<p class="small muted fc-badge-hint">🍅 “Odak Ustası” rozetine <b>${10 - me.pomodoros}</b> pomodoro kaldı.</p>` : ''}
      </div>
    </div>
    <section class="fc-plan" id="fc-plan">${planInner()}</section>`;
  }

  function pomoInner(p) {
    const total = (p.phase === 'work' ? p.work : p.brk) * 60;
    const R = 128, C = 2 * Math.PI * R;
    const frac = Math.max(0, Math.min(1, p.left / total));
    const t = p.topicId && App.topic(p.topicId);
    return `
      <div class="fc-phase-tabs" role="tablist">
        <button class="${p.phase === 'work' ? 'on' : ''}" data-phase="work">🍅 Odak</button>
        <button class="${p.phase === 'break' ? 'on' : ''}" data-phase="break">☕ Mola</button>
      </div>
      <div class="fc-ring-wrap ${p.phase}">
        <svg class="fc-ring" viewBox="0 0 280 280" aria-hidden="true">
          <circle cx="140" cy="140" r="${R}" class="fc-ring-track"/>
          <circle cx="140" cy="140" r="${R}" class="fc-ring-bar" id="fc-ring-bar" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}" transform="rotate(-90 140 140)"/>
        </svg>
        <div class="fc-ring-in">
          <div class="fc-time" id="fc-time" role="timer">${mmss(p.left)}</div>
          <div class="fc-ring-sub">${p.phase === 'work' ? (p.running ? 'Odaklan…' : p.left < total ? 'Duraklatıldı' : 'Hazır mısın?') : (p.running ? 'Mola — ekrandan uzaklaş' : 'Mola zamanı')}</div>
        </div>
      </div>
      <div class="fc-ctrls">
        <button class="btn" data-pc="reset" title="Sıfırla">↺ Sıfırla</button>
        <button class="btn primary fc-main-btn" data-pc="toggle">${p.running ? '❚❚ Duraklat' : (p.left < total ? '▶ Devam et' : '▶ Başlat')}</button>
        <button class="btn" data-pc="skip" title="Sonraki aşamaya geç">Atla ⏭</button>
      </div>
      <div class="fc-pomo-opts">
        <label class="fc-opt"><span>Ne çalışıyorsun?</span>
          <select id="fc-topic" class="input"><option value="">Serbest çalışma</option>${topicOptions(p.topicId)}</select></label>
        <label class="fc-opt fc-opt-n"><span>Odak (dk)</span><input id="fc-work" class="input" type="number" min="5" max="90" step="5" value="${p.work}" ${p.running ? 'disabled' : ''}></label>
        <label class="fc-opt fc-opt-n"><span>Mola (dk)</span><input id="fc-brk" class="input" type="number" min="1" max="30" value="${p.brk}" ${p.running ? 'disabled' : ''}></label>
      </div>
      ${t ? `<p class="small muted fc-pomo-t">Odak konusu: <a href="#/learn/${esc(t.courseId)}/${esc(t.id)}?mode=text">${esc(t.title)}</a> — bitince konu testini dene.</p>` : ''}`;
  }

  function planInner() {
    const me = App.me(); const today = App.today();
    const start = addDays(mondayOf(today), weekOffset * 7);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const tasks = me.plan || [];
    const wk = tasks.filter(t => days.includes(t.day)); const wkDone = wk.filter(t => t.done).length;
    return `
      <div class="fc-plan-head">
        <div><h2 class="serif">Haftalık çalışma planı</h2>
          <p class="small muted" style="margin:0">${dayNum(days[0])} – ${dayNum(days[6])} · ${wk.length ? `${wkDone}/${wk.length} görev tamam` : 'Bu hafta için henüz görev yok'}</p></div>
        <div class="row fc-plan-tools">
          <div class="fc-week-nav"><button class="icon-btn" data-wk="-1" aria-label="Önceki hafta">‹</button><button class="btn sm ghost" data-wk="0">Bu hafta</button><button class="icon-btn" data-wk="1" aria-label="Sonraki hafta">›</button></div>
          <button class="btn accent" id="fc-smart">✨ Akıllı plan öner</button>
          <button class="btn primary" data-add="${days.includes(today) ? today : days[0]}">+ Görev ekle</button>
        </div>
      </div>
      ${wk.length ? `<div class="pr-bar fc-wk-bar"><span style="width:${Math.round(wkDone / wk.length * 100)}%"></span></div>` : ''}
      <div class="fc-week">${days.map(d => {
        const list = tasks.filter(t => t.day === d);
        const past = d < today;
        return `<div class="fc-day ${d === today ? 'today' : ''} ${past ? 'past' : ''}">
          <div class="fc-day-head"><span>${esc(dayName(d))}</span><b>${new Date(d + 'T12:00').getDate()}</b>${d === today ? '<em>Bugün</em>' : ''}</div>
          <div class="fc-day-list">${list.map(t => {
            const tp = t.topicId && App.topic(t.topicId);
            return `<div class="fc-task ${t.done ? 'done' : ''}">
              <button class="fc-check" data-done="${esc(t.id)}" aria-label="${t.done ? 'Geri al' : 'Tamamla'}">${t.done ? '✓' : ''}</button>
              <div class="fc-task-b"><span class="fc-task-t">${esc(t.title)}</span>
                ${tp ? `<a class="fc-task-l" href="#/learn/${esc(tp.courseId)}/${esc(tp.id)}?mode=text">${esc(tp.title)} →</a>` : t.href ? `<a class="fc-task-l" href="#${esc(t.href)}">Git →</a>` : ''}</div>
              <button class="fc-del" data-del="${esc(t.id)}" aria-label="Sil" title="Sil">×</button>
            </div>`;
          }).join('')}</div>
          <button class="fc-day-add" data-add="${d}">+ Ekle</button>
        </div>`;
      }).join('')}</div>`;
  }

  function focusAfter() {
    const me = App.me(); const p = pomoInit();
    const pomoEl = document.getElementById('fc-pomo'); const planEl = document.getElementById('fc-plan');
    let tick = null;
    const total = () => (p.phase === 'work' ? p.work : p.brk) * 60;
    const setTitle = () => { document.title = (p.running || p.left < total()) ? `${mmss(p.left)} ${p.phase === 'work' ? '🍅 Odak' : '☕ Mola'} · Kampüs` : 'Odak & Plan · Kampüs'; };
    const drawPomo = () => { pomoEl.innerHTML = pomoInner(p); bindPomoInputs(); setTitle(); };
    const updTick = () => {
      p.left = Math.max(0, (p.endsAt - Date.now()) / 1000);
      const t = document.getElementById('fc-time'); if (t) t.textContent = mmss(p.left);
      const bar = document.getElementById('fc-ring-bar');
      if (bar) { const C = 2 * Math.PI * 128; bar.setAttribute('stroke-dashoffset', C * (1 - p.left / total())); }
      setTitle();
      if (p.left <= 0) complete();
    };
    const stop = () => { if (tick) clearInterval(tick); tick = null; };
    const start = () => { p.running = true; p.endsAt = Date.now() + p.left * 1000; stop(); tick = setInterval(updTick, 1000); drawPomo(); };
    const pause = () => { if (p.running) p.left = Math.max(0, (p.endsAt - Date.now()) / 1000); p.running = false; stop(); drawPomo(); };
    const setPhase = (ph) => { stop(); p.running = false; p.phase = ph; p.left = total(); drawPomo(); };
    function complete() {
      stop(); p.running = false;
      if (p.phase === 'work') {
        me.pomodoros = (me.pomodoros || 0) + 1;
        me.pomoLog = me.pomoLog || {}; me.pomoLog[App.today()] = (me.pomoLog[App.today()] || 0) + 1;
        App.logStudy(p.work); App.addXP(15, 'Pomodoro');
        if (me.pomodoros >= 10) App.award('pomodoro');
        if (new Date().getHours() >= 23) App.award('gece');
        App.save();
        App.toast(`🍅 Pomodoro tamam! +15 XP · ${p.work} dk kaydedildi. Şimdi mola.`);
        p.phase = 'break'; p.left = p.brk * 60;
        App.render(); // hedef halkası ve sayaçlar güncellensin
      } else {
        App.toast('☕ Mola bitti. Hazırsan yeni bir tura başla!');
        p.phase = 'work'; p.left = p.work * 60; drawPomo();
      }
    }
    function bindPomoInputs() {
      const tp = document.getElementById('fc-topic'); tp.onchange = () => { p.topicId = tp.value; drawPomo(); };
      const w = document.getElementById('fc-work'), b = document.getElementById('fc-brk');
      const saveSet = () => {
        p.work = Math.max(5, Math.min(90, +w.value || 25)); p.brk = Math.max(1, Math.min(30, +b.value || 5));
        me.pomoSettings = { work: p.work, brk: p.brk }; App.save();
        if (!p.running) { p.left = total(); drawPomo(); }
      };
      w.onchange = saveSet; b.onchange = saveSet;
    }
    pomoEl.onclick = (e) => {
      const ph = e.target.closest('[data-phase]'); if (ph) { if (ph.dataset.phase !== p.phase) setPhase(ph.dataset.phase); return; }
      const b = e.target.closest('[data-pc]'); if (!b) return;
      if (b.dataset.pc === 'toggle') p.running ? pause() : start();
      else if (b.dataset.pc === 'reset') setPhase(p.phase);
      else if (b.dataset.pc === 'skip') setPhase(p.phase === 'work' ? 'break' : 'work');
    };
    if (p.running) { p.endsAt = p.endsAt || Date.now() + p.left * 1000; tick = setInterval(updTick, 1000); }
    bindPomoInputs(); setTitle();
    App.onLeave(() => { if (p.running) { p.left = Math.max(0, (p.endsAt - Date.now()) / 1000); p.running = false; } stop(); });

    // Günlük hedef
    const gi = document.getElementById('fc-goal-in');
    gi.onchange = () => { me.goal = me.goal || {}; me.goal.dailyMinutes = +gi.value; App.save(); App.toast('Günlük hedef: ' + gi.value + ' dk'); App.render(); };

    // Plan
    const drawPlan = () => { planEl.innerHTML = planInner(); };
    planEl.onclick = (e) => {
      const el = e.target.closest('[data-wk],[data-add],[data-done],[data-del],#fc-smart'); if (!el) return;
      if (el.id === 'fc-smart') return smartPlan(drawPlan);
      if (el.dataset.wk != null) { weekOffset = el.dataset.wk === '0' ? 0 : weekOffset + +el.dataset.wk; return drawPlan(); }
      if (el.dataset.add) return addTask(el.dataset.add, drawPlan);
      if (el.dataset.done) {
        const t = me.plan.find(x => x.id === el.dataset.done); if (!t) return;
        t.done = !t.done;
        if (t.done && !t.xp) { t.xp = true; App.addXP(10, 'Plan görevi'); App.toast('✓ Görev tamam! +10 XP'); }
        App.save(); return drawPlan();
      }
      if (el.dataset.del) { me.plan = me.plan.filter(x => x.id !== el.dataset.del); App.save(); drawPlan(); App.toast('Görev silindi'); }
    };
  }

  function addTask(day, done) {
    const me = App.me(); const today = App.today();
    const start = addDays(mondayOf(today), weekOffset * 7);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    // Örnek metinler katalogdan: kullanıcının ilk kursu ve onun ilk konusu.
    const exC = App.myCourses()[0] || App.db.courses[0]; const exT = exC && App.courseTopics(exC.id)[0];
    const exCourse = exC ? exC.title : 'Ders', exTopic = exT ? exT.title : 'Konu';
    const el = App.modal({
      title: 'Plana görev ekle',
      body: `<div class="field"><label for="fc-t-day">Gün</label><select id="fc-t-day">${days.map(d => `<option value="${d}" ${d === day ? 'selected' : ''}>${esc(dayName(d, 'long'))}, ${esc(dayNum(d))}${d === today ? ' (bugün)' : ''}</option>`).join('')}</select></div>
        <div class="field"><label for="fc-t-title">Ne yapacaksın?</label><input id="fc-t-title" placeholder="ör. ${esc(exTopic)} — konu testi" maxlength="80"></div>
        <div class="field"><label for="fc-t-topic">Konu (isteğe bağlı)</label><select id="fc-t-topic"><option value="">Konu seçme</option>${topicOptions('')}</select></div>
        <p class="small muted" style="margin:0">İpucu: Küçük ve belirli görevler daha kolay tamamlanır. “${esc(exCourse)} çalış” yerine “${esc(exTopic)} — kartlar + konu testi”.</p>`,
      actions: [{ label: 'Vazgeç' }, { label: 'Ekle', primary: true, onClick: (close, m) => {
        const title = m.querySelector('#fc-t-title').value.trim(); const topicId = m.querySelector('#fc-t-topic').value || null;
        const tt = title || (topicId ? App.topic(topicId).title + ' çalış' : '');
        if (!tt) { m.querySelector('#fc-t-title').focus(); App.toast('Bir başlık yaz ya da konu seç', 'err'); return; }
        me.plan.push({ id: App.uid('p'), day: m.querySelector('#fc-t-day').value, title: tt, topicId, done: false });
        App.save(); close(); done(); App.toast('Görev plana eklendi');
      } }]
    });
    setTimeout(() => { const i = el.querySelector('#fc-t-title'); i && i.focus(); }, 30);
  }

  function smartPlan(done) {
    const me = App.me(); const today = App.today();
    const stats = window.KampusPractice ? window.KampusPractice.topicStats() : [];
    const weak = stats.filter(s => s.pct < 75 && me.enrolled.includes(s.topic.courseId)).slice(0, 3);
    const due = App.dueCards().length;
    const fresh = [];
    me.enrolled.forEach(cid => { const t = App.courseTopics(cid).find(t => !me.done[t.id] && !weak.some(w => w.topicId === t.id)); if (t) fresh.push(t); });
    const items = [];
    if (due) items.push({ title: `Kart tekrarı (${due} kart)`, topicId: null, href: '/review' });
    weak.forEach(w => {
      items.push({ title: `Konu anlatımı: ${w.topic.title} (%${w.pct})`, topicId: w.topicId });
      items.push({ title: `${w.topic.title} — soru çöz`, topicId: null, href: `/practice/bank?course=${w.topic.courseId}&topic=${w.topicId}` });
    });
    fresh.slice(0, 2).forEach(t => items.push({ title: `Yeni konu: ${t.title}`, topicId: t.id }));
    if ((me.wrongs || []).length) items.push({ title: `Yanlışlarımı tekrar çöz (${me.wrongs.length})`, topicId: null, href: '/wrongs' });
    const ex = App.db.exams.find(e => e.sections.some(s => me.enrolled.includes(s.courseId)));
    if (ex) items.push({ title: `Deneme: ${ex.title}`, topicId: null, href: '/exam/' + ex.id });
    // 2 görev/gün olarak bugünden itibaren dağıt
    const plan = items.map((it, i) => ({ ...it, day: addDays(today, Math.min(6, Math.floor(i / 2))) }))
      .filter(it => !me.plan.some(p => p.day === it.day && p.title === it.title));
    if (!plan.length) { App.toast('Planın zaten güncel görünüyor 👌'); return; }
    App.modal({
      title: '✨ Akıllı plan önerisi',
      body: `<p class="muted small">Eksik konu analizin${due ? ', bekleyen kartların' : ''} ve kurs ilerlemene göre önümüzdeki günler için ${plan.length} görev önerdik.</p>
        <ul class="fc-suggest">${plan.map(it => `<li><span class="fc-sg-day">${esc(it.day === today ? 'Bugün' : dayName(it.day, 'long'))}</span><span>${esc(it.title)}</span></li>`).join('')}</ul>`,
      actions: [{ label: 'Vazgeç' }, { label: 'Plana ekle', primary: true, onClick: (close) => {
        plan.forEach(it => me.plan.push({ id: App.uid('p'), day: it.day, title: it.title, topicId: it.topicId, href: it.href || null, done: false }));
        App.save(); close(); weekOffset = 0; done(); App.toast(`${plan.length} görev planına eklendi. Hadi başlayalım!`);
      } }]
    });
  }

  // ================= 8. İLERLEME & LİG =================
  function statsPage() {
    const me = App.me(); const u = App.user; const lvl = App.level(); const today = App.today();
    const log = me.studyLog || {};
    const totalMin = Object.values(log).reduce((a, b) => a + b, 0);
    const days = Object.keys(log).filter(d => log[d] > 0).length;
    // Isı haritası: son 12 hafta (Pzt başlangıçlı)
    const start = addDays(mondayOf(today), -77);
    const cols = Array.from({ length: 12 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
    const weekMin = Array.from({ length: 7 }, (_, i) => log[addDays(mondayOf(today), i)] || 0).reduce((a, b) => a + b, 0);
    const best = Object.keys(log).sort((a, b) => log[b] - log[a])[0];
    const lvlOf = (m) => !m ? 0 : m < 20 ? 1 : m < 45 ? 2 : m < 75 ? 3 : 4;
    const months = cols.map((c, i) => { const m = new Date(c[0] + 'T12:00').toLocaleDateString('tr-TR', { month: 'short' }); const prev = i && new Date(cols[i - 1][0] + 'T12:00').toLocaleDateString('tr-TR', { month: 'short' }); return m !== prev ? m : ''; });
    // Lig
    const league = App.db.league.map(x => ({ ...x })).concat([{ name: u.name, avatar: u.avatar, xp: me.xp, me: true }]).sort((a, b) => b.xp - a.xp);
    const myRank = league.findIndex(x => x.me) + 1;
    const exams = me.exams.slice().sort((a, b) => a.at.localeCompare(b.at));
    const badges = App.db.badges;
    return `
    <div class="fc-head"><div><span class="fc-eyebrow">İlerleme &amp; Lig</span><h1>Ne kadar yol aldığına bir bak.</h1>
      <p class="muted">Küçük adımlar birikiyor. Her gün biraz, her hafta daha iyi.</p></div></div>
    <div class="fc-stats-top">
      <section class="card fc-level">
        <div class="fc-level-ring">${App.ring(lvl.pct, 120, 10, 'var(--accent)')}<div><small>Seviye</small><b>${lvl.level}</b></div></div>
        <div><h3 class="serif">${me.xp.toLocaleString('tr-TR')} XP</h3>
          <p class="small muted">Seviye ${lvl.level + 1}’e <b>${(lvl.need - lvl.cur).toLocaleString('tr-TR')} XP</b> kaldı.</p>
          ${App.progressBar(lvl.pct, 'var(--accent)')}</div>
      </section>
      <section class="card fc-kpis">
        <div><b>🔥 ${me.streak}</b><span>gün seri</span></div>
        <div><b>${hm(totalMin)}</b><span>toplam çalışma</span></div>
        <div><b>${days}</b><span>aktif gün</span></div>
        <div><b>🍅 ${me.pomodoros}</b><span>pomodoro</span></div>
      </section>
    </div>

    <section class="card fc-cal-card">
      <div class="card-head"><div><h2 class="serif">Çalışma takvimi</h2><p class="small muted" style="margin:0">Son 12 hafta · her kare bir gün</p></div>
        <div class="fc-cal-leg small muted">Az ${[0, 1, 2, 3, 4].map(l => `<i class="fc-l${l}"></i>`).join('')} Çok</div></div>
      <div class="fc-cal-wrap"><div class="fc-cal-scroll"><div class="fc-cal">
        <div class="fc-cal-days"><span></span>${['Pzt', '', 'Çar', '', 'Cum', '', 'Paz'].map(d => `<span>${d}</span>`).join('')}</div>
        ${cols.map((c, i) => `<div class="fc-cal-col"><span class="fc-cal-m">${months[i]}</span>${c.map(d => d > today ? '<i class="fc-fut"></i>' : `<i class="fc-l${lvlOf(log[d])} ${d === today ? 'fc-today' : ''}" title="${esc(dayNum(d))}: ${log[d] ? log[d] + ' dk' : 'çalışma yok'}"></i>`).join('')}</div>`).join('')}
      </div></div>
      <div class="fc-cal-side">
        <div><b>${hm(weekMin)}</b><span>bu hafta</span></div>
        <div><b>${hm(Math.round(totalMin / Math.max(1, days)))}</b><span>aktif gün ortalaması</span></div>
        <div><b>${best ? hm(log[best]) : '—'}</b><span>${best ? 'en verimli gün · ' + esc(dayNum(best)) : 'en verimli gün'}</span></div>
      </div></div>
      ${days < 5 ? `<p class="small muted" style="margin:10px 0 0">Takvimin yeni doluyor — her gün en az bir kare yeşillendirmeye çalış.</p>` : ''}
    </section>

    <div class="fc-two">
      <section class="card">
        <div class="card-head"><h2 class="serif">Kurs ilerlemen</h2><a class="small" href="#/my">Kurslarım →</a></div>
        ${App.myCourses().length ? `<div class="fc-courses">${App.myCourses().map(c => { const p = App.courseProgress(c.id); const ts = App.courseTopics(c.id); return `
          <a class="fc-course" href="#/course/${esc(c.id)}"><span class="fc-course-e" style="background:${safeColor(c.color)}">${esc(c.emoji)}</span>
            <span class="fc-course-b"><span class="row between"><b>${esc(c.title.split(':')[0])}</b><span class="small muted">${ts.filter(t => me.done[t.id]).length}/${ts.length} konu · %${p}</span></span>${App.progressBar(p, safeColor(c.color))}</span></a>`; }).join('')}</div>`
          : App.emptyState('📚', 'Henüz kurs yok', '', '<a class="btn primary" href="#/discover">Kurs keşfet</a>')}
      </section>
      <section class="card">
        <div class="card-head"><h2 class="serif">Deneme başarı trendi</h2><a class="small" href="#/practice/exams">Denemeler →</a></div>
        ${trendChart(exams)}
      </section>
    </div>

    <div class="fc-two">
      <section class="card">
        <div class="card-head"><h2 class="serif">Rozetler</h2><span class="small muted">${me.badges.length}/${badges.length} kazanıldı</span></div>
        <div class="fc-badges">${badges.map(b => { const has = me.badges.includes(b.id); return `<div class="fc-badge ${has ? 'has' : ''}" title="${esc(b.desc)}"><span class="fc-badge-ic">${b.icon}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small>${has ? '' : '<em>Kilitli</em>'}</div>`; }).join('')}</div>
      </section>
      <section class="card fc-league">
        <div class="card-head"><div><h2 class="serif">Haftalık lig</h2><p class="small muted" style="margin:0">Gümüş Lig · Pazar gece sıfırlanır</p></div><span class="tag accent">${myRank}. sıradasın</span></div>
        <ol class="fc-lg">${league.map((x, i) => `
          <li class="${x.me ? 'me' : ''} ${i < 3 ? 'top' : ''}"><span class="fc-lg-r">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>${App.avatar(x, 32)}<span class="fc-lg-n">${esc(x.name)}${x.me ? ' <small>(sen)</small>' : ''}</span><b>${x.xp.toLocaleString('tr-TR')} XP</b></li>
          ${i === 2 ? '<li class="fc-lg-line" aria-label="Yükselme hattı"><span>▲ Yükselme hattı — ilk 3 Altın Lig’e çıkar</span></li>' : ''}`).join('')}</ol>
        <p class="small muted" style="margin:10px 0 0">${myRank <= 3 ? 'Yükselme bölgesindesin! Yerini korumak için çalışmaya devam. 💪' : `3. sıraya çıkmak için <b>${(league[2].xp - me.xp + 1).toLocaleString('tr-TR')} XP</b> lazım — yaklaşık ${Math.ceil((league[2].xp - me.xp + 1) / 15)} pomodoro.`}</p>
      </section>
    </div>`;
  }

  function trendChart(exams) {
    if (!exams.length) return App.emptyState('📈', 'Henüz deneme yok', 'İlk denemeni çöz, trendin burada belirsin.', '<a class="btn primary" href="#/practice/exams">Deneme çöz</a>');
    const W = 460, H = 190, pl = 34, pr = 16, pt = 22, pb = 30;
    // Başarı yüzdesi = doğru / toplam soru (yanlışlar puan düşürmez).
    const pctOf = (e) => { const t = e.correct + e.wrong + e.empty; return t ? Math.round(e.correct / t * 100) : 0; };
    const max = 100, min = 0;
    const x = (i) => exams.length === 1 ? (pl + (W - pl - pr) / 2) : pl + (W - pl - pr) * i / (exams.length - 1);
    const y = (v) => pt + (H - pt - pb) * (1 - (v - min) / (max - min));
    const pts = exams.map((e, i) => `${x(i)},${y(pctOf(e))}`).join(' ');
    const ticks = [0, 50, 100];
    return `<svg class="fc-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Deneme başarı trendi (yüzde)">
      ${ticks.map(t => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" class="fc-ch-grid"/><text x="${pl - 6}" y="${y(t) + 4}" text-anchor="end" class="fc-ch-x">%${t}</text>`).join('')}
      ${exams.length > 1 ? `<polyline points="${pts}" class="fc-ch-line"/>` : ''}
      ${exams.map((e, i) => { const ex = App.exam(e.examId); const v = pctOf(e); return `<a href="#/exam/${esc(e.examId)}/result/${esc(e.id)}"><circle cx="${x(i)}" cy="${y(v)}" r="5" class="fc-ch-dot"><title>${esc(ex ? ex.title : '')}: ${e.correct} doğru · %${v}</title></circle></a>
        <text x="${x(i)}" y="${y(v) - 10}" text-anchor="middle" class="fc-ch-v">%${v}</text>
        <text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="fc-ch-x">${esc(App.fmtShort(e.at))}</text>`; }).join('')}
    </svg>${exams.length === 1 ? '<p class="small muted" style="margin:6px 0 0">Bir deneme daha çözünce çizgin oluşacak.</p>' : ''}`;
  }

  // ================= 9. PROFİL =================
  // Hedef = bölüm. Seçenekler sihirbazdaki hedeflerle aynı (onboard.js); o modül yoksa yalnız mevcut değer gösterilir.
  const TERM_END = '2027-01-11'; // güz dönemi final haftası (tahmini)
  const CLASSES = ['1. sınıf', '2. sınıf', '3. sınıf', '4. sınıf'];
  const targetList = () => (window.Onboard ? window.Onboard.GOALS.map(g => g.target) : []);
  // Geri sayım: kullanıcının girdiği vize/final tarihi, yoksa tahmini dönem sonu.
  const termEnd = (me) => /^\d{4}-\d{2}-\d{2}$/.test(me.examDate || '') ? me.examDate : TERM_END;
  const NOTIFS = [
    { id: 'daily', label: 'Günlük çalışma hatırlatıcısı', desc: 'Her akşam 19:00’da nazik bir dürtme.' },
    { id: 'streak', label: 'Seri uyarısı', desc: 'Serin bozulmak üzereyken haber ver.' },
    { id: 'cards', label: 'Tekrar kartları', desc: 'Bekleyen kartların olduğunda.' },
    { id: 'league', label: 'Lig hareketleri', desc: 'Biri seni geçtiğinde.' }
  ];

  function profilePage() {
    const u = App.user; const me = App.me(); const lvl = App.level();
    const td = { date: termEnd(me), own: !!me.examDate };
    const left = Math.ceil((new Date(td.date + 'T09:00') - App.now()) / 864e5);
    const prefs = me.prefs = me.prefs || { daily: true, streak: true, cards: true, league: false };
    const goal = (me.goal && me.goal.dailyMinutes) || 45;
    return `
    <div class="fc-head"><div><span class="fc-eyebrow">Profil</span><h1>${esc(u.name)}</h1></div></div>
    <div class="fc-prof">
      <section class="card fc-prof-card">
        <div class="fc-prof-top">${App.avatar(u, 76)}
          <div><h2 class="serif" style="margin:0">${esc(u.name)}</h2><p class="muted small" style="margin:2px 0 0">${esc(u.email || '')}</p>
            <div class="row" style="margin-top:8px;flex-wrap:wrap"><span class="tag accent">Seviye ${lvl.level}</span><span class="tag">🔥 ${me.streak} gün</span></div></div>
          <button class="btn" id="fc-edit">✎ Düzenle</button></div>
        <dl class="fc-dl">
          <div><dt>Sınıf</dt><dd>${esc(u.grade || '—')}</dd></div>
          <div><dt>Bölüm / hedef</dt><dd>${esc(u.target || '—')}</dd></div>
          <div><dt>Şehir</dt><dd>${esc(u.city || '—')}</dd></div>
          <div><dt>Toplam XP</dt><dd>${me.xp.toLocaleString('tr-TR')}</dd></div>
        </dl>
        <p class="fc-redo"><a class="btn sm" href="#/onboarding?redo=1">↻ Planımı yeniden oluştur</a><span class="small muted">Hedef, tempo ve öğrenme tarzı sorularını baştan yanıtla.</span></p>
      </section>
      <section class="card fc-count">
        ${left > 0 ? `<span class="fc-eyebrow">Dönem sonu / final haftasına kalan</span>
          <div class="fc-count-n"><b>${left}</b><span>gün</span></div>
          <p class="small">${new Date(td.date + 'T12:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}</p>
          <div class="fc-count-split"><div><b>${Math.floor(left / 7)}</b><small>hafta</small></div><div><b>${Math.round(left * goal / 60)}</b><small>saat çalışma*</small></div><div><b>${Math.floor(left * goal / 25).toLocaleString('tr-TR')}</b><small>pomodoro*</small></div></div>
          <p class="small fc-count-note">*Günlük ${goal} dk hedefinle. ${td.own ? 'Tarihi sen belirledin.' : 'Tarih tahminidir; kendi akademik takvimine göre profilden değiştir.'}</p>`
        : `<span class="fc-eyebrow">Dönem sonu / final haftası</span><h3 class="serif">Yeni bir tarih belirle</h3><p class="small">Belirlediğin tarih geçti. Profili düzenleyip bir sonraki vize ya da final tarihini girersen geri sayımı burada görürsün.</p>`}
      </section>
    </div>
    <section class="card fc-prefs">
      <h2 class="serif">Tercihler</h2>
      <div class="fc-pref-row"><div><b>Günlük çalışma hedefi</b><p class="small muted">Odak sayfasındaki hedef halkası buna göre dolar.</p></div>
        <select class="input fc-pref-sel" id="fc-pref-goal">${[15, 30, 45, 60, 90, 120, 180].concat([goal]).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b).map(v => `<option value="${v}" ${v === goal ? 'selected' : ''}>${v} dakika</option>`).join('')}</select></div>
      ${NOTIFS.map(n => `<div class="fc-pref-row"><div><b>${n.label}</b><p class="small muted">${n.desc}</p></div>
        <label class="fc-switch"><input type="checkbox" data-pref="${n.id}" ${prefs[n.id] ? 'checked' : ''}><span aria-hidden="true"></span><em class="sr">${n.label}</em></label></div>`).join('')}
      <p class="small muted" style="margin:12px 0 0">Bildirimler bu prototipte yalnızca görseldir; gerçek bildirim gönderilmez.</p>
    </section>`;
  }

  function profileAfter() {
    const u = App.user; const me = App.me();
    document.getElementById('fc-pref-goal').onchange = (e) => { me.goal = me.goal || {}; me.goal.dailyMinutes = +e.target.value; App.save(); App.toast('Günlük hedef güncellendi'); App.render(); };
    document.querySelectorAll('[data-pref]').forEach(i => i.onchange = () => { me.prefs[i.dataset.pref] = i.checked; App.save(); App.toast(i.checked ? 'Bildirim açıldı' : 'Bildirim kapatıldı'); });
    document.getElementById('fc-edit').onclick = () => {
      const grades = CLASSES.slice(); if (u.grade && !grades.includes(u.grade)) grades.unshift(u.grade);
      const tv = targetList(); if (u.target && !tv.includes(u.target)) tv.unshift(u.target);
      App.modal({
        title: 'Profili düzenle',
        body: `<div class="field"><label for="fc-p-name">Ad soyad</label><input id="fc-p-name" value="${esc(u.name)}" maxlength="40"></div>
          <div class="grid grid-2" style="gap:12px"><div class="field"><label for="fc-p-grade">Sınıf</label><select id="fc-p-grade">${grades.map(g => `<option ${g === u.grade ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></div>
          <div class="field"><label for="fc-p-city">Şehir</label><input id="fc-p-city" value="${esc(u.city || '')}" maxlength="30"></div></div>
          <div class="field"><label for="fc-p-target">Bölüm / hedef</label><select id="fc-p-target">${tv.map(t => `<option ${t === u.target ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
          <div class="field"><label for="fc-p-date">Vize / final tarihi</label><input id="fc-p-date" type="date" min="${App.today()}" value="${esc(termEnd(me))}"></div>`,
        actions: [{ label: 'Vazgeç' }, { label: 'Kaydet', primary: true, onClick: (close, m) => {
          const name = m.querySelector('#fc-p-name').value.trim();
          if (!name) { App.toast('Ad boş olamaz', 'err'); return; }
          u.name = name; u.avatar = name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toLocaleUpperCase('tr-TR');
          u.grade = m.querySelector('#fc-p-grade').value; u.city = m.querySelector('#fc-p-city').value.trim(); u.target = m.querySelector('#fc-p-target').value;
          const dv = m.querySelector('#fc-p-date').value; if (dv && dv !== termEnd(me)) me.examDate = dv;
          App.save(); close(); App.render(); App.toast('Profil güncellendi');
        } }]
      });
    };
  }

  App.route('/focus', focusPage, { title: 'Odak & Plan', after: focusAfter, wide: true });
  App.route('/stats', statsPage, { title: 'İlerleme & Lig' });
  App.route('/profile', profilePage, { title: 'Profil', after: profileAfter });
})();
