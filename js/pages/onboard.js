// İlk giriş sihirbazı (/onboarding) — hedef, seviye, zaman ve öğrenme tarzına göre kişisel plan.
// - Yeni kullanıcı (me().onboarded === false) her rotada buraya yönlendirilir.
// - /onboarding?redo=1 ile profil sayfasından tekrar açılabilir.
(function () {
  const esc = (s) => App.esc(s);

  // ---- Sabit seçenekler ----
  // Hedefler yeni kataloğa (App.db.paths) göre çözülür: kurs listesi yolun adımlarından gelir, koda kurs id'si gömülmez.
  const TERM_END = '2027-01-11'; // güz dönemi final haftası (tahmini)
  const CLASSES = ['1. sınıf', '2. sınıf', '3. sınıf', '4. sınıf'];
  const GOAL_DEFS = [
    { id: 'bm', icon: '🖥️', label: 'Bilgisayar Mühendisliği', sub: 'Bölüm derslerine düzenli çalışmak', path: 'cs-temel', exam: 'Final haftası', date: TERM_END, target: 'Bilgisayar Mühendisliği', grades: CLASSES },
    { id: 'ym', icon: '🧑‍💻', label: 'Yazılım Mühendisliği', sub: 'Programlama ve algoritma ağırlıklı', path: 'cs-temel', exam: 'Final haftası', date: TERM_END, target: 'Yazılım Mühendisliği', grades: CLASSES },
    { id: 'yz', icon: '📊', label: 'Yapay Zekâ / Veri', sub: 'Algoritma ve veri temeli', path: 'cs-temel', exam: 'Final haftası', date: TERM_END, target: 'Yapay Zekâ ve Veri Mühendisliği', grades: CLASSES },
    { id: 'baska', icon: '🔀', label: 'Başka bölüm, CS dersi alıyorum', sub: 'Seçmeli ya da çift ana dal / yan dal', path: 'cs-temel', exam: 'Final haftası', date: TERM_END, target: 'Başka bölüm · CS dersi alıyor', grades: CLASSES },
    { id: 'mulakat', icon: '🎯', label: 'Teknik mülakata hazırlanıyorum', sub: 'Staj ve iş görüşmeleri', path: 'mulakat', exam: null, date: null, target: 'Teknik mülakat hazırlığı', grades: CLASSES.concat(['Mezun']), dateLabel: 'Mülakat tarihin belli mi?' },
    { id: 'merak', icon: '✨', label: 'Sadece merak', sub: 'Biraz her şeyden, kendi hızımda', path: null, exam: null, date: null, target: 'Keşif', grades: ['Hiç kod yazmadım', 'Biraz denedim', 'Temel biliyorum'], level: true }
  ];
  const uniq = (a) => a.filter((x, i) => x && a.indexOf(x) === i);
  function resolveGoal(d) {
    const paths = App.db.paths || [];
    const p = d.path ? (App.path(d.path) || paths[0] || null) : null;
    // Yol varsa adımları; yoksa her yolun ilk kursu (katalogdan bir tadımlık).
    let courses = p ? p.steps.map(st => st.courseId) : uniq(paths.map(x => x.steps[0] && x.steps[0].courseId));
    courses = uniq(courses).filter(cid => App.course(cid));
    if (!courses.length) courses = App.db.courses.slice(0, 3).map(c => c.id);
    return Object.assign({}, d, { path: p ? p.id : null, courses });
  }
  const goals = () => GOAL_DEFS.map(resolveGoal);
  const LEVELS = [{ v: 0, label: 'Zayıf' }, { v: 1, label: 'Orta' }, { v: 2, label: 'İyi' }];
  const MINUTES = [15, 30, 45, 60, 90];
  const SLOTS = [{ id: 'sabah', icon: '🌅', label: 'Sabah' }, { id: 'oglen', icon: '☀️', label: 'Öğlen' }, { id: 'aksam', icon: '🌇', label: 'Akşam' }, { id: 'gece', icon: '🌙', label: 'Gece' }];
  const PMODES = [
    { id: 'video', icon: '🎬', label: 'Video izleyerek', sub: 'Bölüm bölüm ilerlemek' },
    { id: 'text', icon: '📄', label: 'Okuyarak', sub: 'Konu anlatımı, kendi hızımda' },
    { id: 'mindmap', icon: '🗺️', label: 'Zihin haritasıyla', sub: 'Büyük resmi görmek' },
    { id: 'cards', icon: '🃏', label: 'Bilgi kartlarıyla', sub: 'Kısa, sık tekrar' },
    { id: 'quiz', icon: '📝', label: 'Soru çözerek', sub: 'Yaparak öğrenmek' }
  ];
  const STEP_COUNT = 6; // soru adımları; 6 = analiz, 7 = sonuç

  const goalOf = (id) => { const G = goals(); return G.find(g => g.id === id) || G[0]; };
  const initials = (name) => { const w = name.trim().split(/\s+/).filter(Boolean); return ((w[0] || 'Y')[0] + (w.length > 1 ? w[w.length - 1][0] : (w[0] || 'Ö')[1] || '')).toLocaleUpperCase('tr-TR'); };
  const addDays = (ymd, n) => { const d = new Date(ymd + 'T12:00'); d.setDate(d.getDate() + n); return App.ymd(d); };
  const dayName = (ymd, i) => i === 0 ? 'Bugün' : i === 1 ? 'Yarın' : new Date(ymd + 'T12:00').toLocaleDateString('tr-TR', { weekday: 'long' });
  const daysLeft = (ymd) => ymd ? Math.round((new Date(ymd + 'T12:00') - App.now()) / 864e5) : null;
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Yönlendirme kancası ----
  App.beforeRender.push((path) => {
    if (path !== '/onboarding') { s = null; step = 0; } // sihirbazdan çıkıldı → taslağı unut
    if (!App.user) return null;
    const me = App.me();
    if (me.onboarded === false && path !== '/onboarding') return '/onboarding';
    if (path === '/onboarding' && me.onboarded !== false && !App.query().redo) return '/dashboard';
    return null;
  });

  // ---- Durum ----
  // Taslak: aynı rotanın yeniden çizilmesinde (ör. görünüm geçişi, tema değişimi) cevaplar ve adım korunur.
  let s = null, step = 0, dir = 1, owner = null;
  function freshState() {
    const u = App.user, me = App.me(), prev = me.onboardAnswers;
    if (prev) return JSON.parse(JSON.stringify(prev));
    const tg = u.target || '';
    const gd = tg ? GOAL_DEFS.find(g => g.target === tg) : null; const goal = gd ? gd.id : null;
    const gr = gd && gd.grades.includes(u.grade) ? u.grade : null;
    return { name: u.name === 'Yeni Öğrenci' ? '' : u.name, goal, grade: gr, examDate: me.examDate || '', levels: Object.assign({}, me.selfLevels || {}), minutes: (me.goal && me.goal.dailyMinutes) || 45, slots: (me.goal && me.goal.slots) || [], modes: (me.prefModes || []).slice() };
  }

  // ---- Plan üretimi ----
  function buildPlan(st) {
    const g = goalOf(st.goal), me = App.me(), today = App.today();
    const lv = (cid) => st.levels[cid] ?? 1;
    const courses = g.courses.slice().sort((a, b) => lv(a) - lv(b) || g.courses.indexOf(a) - g.courses.indexOf(b));
    // Zayıf ders her turda iki kez, orta bir kez, iyi bir kez (ama sona) sıraya girer
    const queues = courses.map(cid => App.courseTopics(cid).filter(t => !me.done[t.id]));
    const order = [];
    for (let round = 0; round < 6 && order.length < 12; round++) {
      courses.forEach((cid, i) => { const reps = lv(cid) === 0 ? 2 : 1; for (let r = 0; r < reps; r++) { const t = queues[i].shift(); if (t) order.push(t); } });
    }
    const modes = st.modes.length ? st.modes : ['video', 'quiz'];
    const label = { video: 'video', text: 'konu anlatımı', mindmap: 'zihin haritası', cards: 'bilgi kartları', quiz: 'konu testi' };
    const nTopics = st.minutes <= 15 ? 4 : st.minutes <= 45 ? 5 : 6;
    const tasks = order.slice(0, nTopics).map((t, i) => {
      const m = modes[i % modes.length];
      const extra = lv(t.courseId) === 0 && m !== 'quiz' ? ' + konu testi' : '';
      return { title: `${t.title} · ${label[m]}${extra}`, topicId: t.id };
    });
    // Tekrar ve deneme görevleri
    tasks.splice(Math.min(2, tasks.length), 0, { title: 'Günlük kart tekrarı (10 dk)', topicId: null });
    // Haftalık kontrol: seçilen kursları en çok kapsayan deneme (katalogdan).
    const ex = (App.db.exams || []).map(e => ({ e, n: e.sections.filter(sc => g.courses.includes(sc.courseId)).length })).sort((a, b) => b.n - a.n)[0];
    if (ex && ex.n && tasks.length < 7) tasks.push({ title: `Deneme: ${ex.e.title} — haftalık kontrol`, topicId: null });
    const n = tasks.length;
    return tasks.slice(0, 7).map((t, i) => ({ id: App.uid('p'), day: addDays(today, Math.floor(i * 7 / n)), title: t.title, topicId: t.topicId, done: false }));
  }

  function styleAdvice(st) {
    const m = st.modes.length ? st.modes : ['video', 'quiz'];
    const has = (x) => m.includes(x);
    let head;
    if (has('video') && has('quiz')) head = 'İzle → çöz döngüsü: kısa bir video, hemen ardından konu testi.';
    else if (has('text') && has('mindmap')) head = 'Oku → haritala: konuyu okuyup kendi zihin haritanla özetle.';
    else if (has('cards') && has('quiz')) head = 'Hatırla → uygula: kartlarla bilgiyi çağır, sorularla pekiştir.';
    else if (has('video')) head = 'Önce dinle: her konuya videoyla gir, notlarını bölüm başlıklarına göre al.';
    else if (has('text')) head = 'Kendi hızında oku: konu anlatımını bölüm bölüm ilerle, önemli noktaları işaretle.';
    else if (has('mindmap')) head = 'Büyük resimden başla: önce zihin haritası, sonra ayrıntılar.';
    else if (has('cards')) head = 'Kısa ve sık: gün içine dağılmış 5 dakikalık kart tekrarları.';
    else head = 'Yaparak öğren: önce soru, takıldığın yerde konu anlatımına dön.';
    const tips = [];
    if (has('video')) tips.push('Videoları 1.25× hızda izle, bölüm sonlarında dur ve kendine anlat.');
    if (has('text')) tips.push('Okurken her başlığın altına tek cümlelik özet yaz — Notlarım sekmesi tam bunun için.');
    if (has('mindmap')) tips.push('Zihin haritasını konuya başlamadan önce 1 dakika incele; sonra kapatıp hatırlamaya çalış.');
    if (has('cards')) tips.push('Kartlar aralıklı tekrar sistemiyle gelir: unutmak üzereyken karşına çıkar.');
    if (has('quiz')) tips.push('Yanlışların otomatik olarak “Yanlışlarım” listesine düşer; haftada bir onları yeniden çöz.');
    if (!has('cards')) tips.push('Kartları seçmedin ama günde 10 dakikalık tekrar unutmayı ciddi biçimde azaltır — planına bir tane ekledik.');
    const slot = st.slots[0] && SLOTS.find(x => x.id === st.slots[0]);
    const blocks = Math.max(1, Math.round(st.minutes / 30));
    const when = `${slot ? slot.label.toLocaleLowerCase('tr-TR') + ' saatlerinde ' : 'Her gün '}${st.minutes} dakika: ${st.minutes >= 45 ? blocks + ' × (25 dk odak + 5 dk mola)' : 'tek oturum, telefon uzakta'}.`;
    return { head, tips: tips.slice(0, 4), when: when.charAt(0).toLocaleUpperCase('tr-TR') + when.slice(1) };
  }

  // ---- Kaydet ----
  function finish(st) {
    const u = App.user, me = App.me(), g = goalOf(st.goal);
    const name = (st.name || '').trim() || (u.name === 'Yeni Öğrenci' ? 'Yeni Öğrenci' : u.name);
    u.name = name; u.avatar = initials(name); u.target = g.target;
    if (st.grade) u.grade = st.grade;
    const lv = (cid) => st.levels[cid] ?? 1;
    const ordered = g.courses.slice().sort((a, b) => lv(a) - lv(b));
    ordered.forEach(cid => { if (!me.enrolled.includes(cid)) me.enrolled.push(cid); });
    me.activePath = g.path || me.activePath || null;
    me.goal = Object.assign({}, me.goal, { dailyMinutes: st.minutes, slots: st.slots.slice() });
    me.prefModes = st.modes.length ? st.modes.slice() : ['video', 'quiz'];
    me.selfLevels = Object.assign({}, st.levels);
    if (st.examDate) me.examDate = st.examDate;
    me.plan = buildPlan(st);
    me.onboardAnswers = JSON.parse(JSON.stringify(st));
    const first = me.onboarded === false && !me.onboardXP;
    me.onboarded = true; me.onboardXP = true;
    App.save();
    s = null; step = 0;
    if (first) { App.addXP(50, 'Planını oluşturdun'); App.toast(`🎉 Planın hazır, ${name.split(' ')[0]}! +50 XP`); }
    else App.toast('Planın güncellendi');
    App.go('/dashboard');
  }

  function skip() {
    const st = Object.assign({}, s);
    if (!st.goal) st.goal = 'merak';
    if (!st.modes.length) st.modes = ['video', 'quiz'];
    finish(st);
  }

  // ---- Adım görünümleri ----
  const radioCards = (name, items, cur, cls = '') => `<div class="ob-choices ${cls}" role="radiogroup" aria-labelledby="ob-q">${items.map(it => `
    <label class="ob-choice ${cur === it.id ? 'on' : ''}">
      <input type="radio" name="${name}" value="${esc(it.id)}" ${cur === it.id ? 'checked' : ''}>
      ${it.icon ? `<span class="ob-choice-ic" aria-hidden="true">${it.icon}</span>` : ''}
      <span class="ob-choice-t"><b>${esc(it.label)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>
      <span class="ob-tick" aria-hidden="true"></span>
    </label>`).join('')}</div>`;

  const head = (kicker, q, lead = '') => `<p class="ob-kicker">${kicker}</p><h1 class="ob-q" id="ob-q" tabindex="-1">${q}</h1>${lead ? `<p class="ob-lead">${lead}</p>` : ''}`;

  const VIEWS = [
    // a) Hoş geldin + ad
    () => `${head('Hoş geldin 👋', 'Seni tanıyarak başlayalım.<br><em>Adın ne?</em>', 'Altı kısa soru, yaklaşık bir dakika. Cevaplarına göre sana özel bir çalışma planı hazırlayacağız.')}
      <div class="ob-name">
        <label for="ob-name" class="ob-label">Adın ve soyadın</label>
        <input id="ob-name" class="ob-input" type="text" autocomplete="name" maxlength="40" placeholder="Örn. Zeynep Kaya" value="${esc(s.name)}">
        <span class="ob-preview" aria-hidden="true"><span class="ob-av" id="ob-av">${esc(initials(s.name || 'Yeni Öğrenci'))}</span><span class="muted small">Profil rozetin böyle görünecek</span></span>
      </div>`,
    // b) Hedef
    () => `${head('Hedef', 'Ne için çalışıyorsun?', 'Kurs önerilerini ve planını buna göre şekillendireceğiz.')}
      ${radioCards('goal', goals(), s.goal, 'ob-goals')}`,
    // c) Sınıf / seviye + vize-final tarihi
    () => {
      const g = goalOf(s.goal); const grades = g.grades;
      const isSchool = !g.level;
      const left = daysLeft(s.examDate);
      return `${head(g.icon + ' ' + esc(g.label), isSchool ? 'Kaçıncı sınıftasın?' : 'Şu an ne seviyedesin?')}
      ${radioCards('grade', grades.map(x => ({ id: x, label: x })), s.grade, 'ob-pills')}
      <div class="ob-date">
        <label for="ob-date" class="ob-label">${g.exam ? 'Vize / final tarihin <span class="muted">(dönem sonu için tahmini; kendi takvimine göre değiştir)</span>' : esc(g.dateLabel || 'Kendine bir hedef tarih koymak ister misin?') + ' <span class="muted">(isteğe bağlı)</span>'}</label>
        <div class="ob-date-row"><input id="ob-date" class="ob-input" type="date" min="${App.today()}" value="${esc(s.examDate)}">
        <span class="ob-left" id="ob-left" aria-live="polite">${left != null && left > 0 ? `<b>${left}</b> gün var` : ''}</span></div>
      </div>`;
    },
    // d) Öz değerlendirme
    () => {
      const g = goalOf(s.goal);
      const rows = g.courses.map(cid => {
        const c = App.course(cid); const cur = s.levels[cid] ?? 1; const nm = c.title.split(':')[0];
        return `<div class="ob-assess-row">
          <span class="ob-assess-c"><span class="ob-assess-ic" style="--c:${c.color}" aria-hidden="true">${c.emoji}</span><span id="ob-l-${cid}">${esc(nm)}</span></span>
          <div class="ob-seg" role="radiogroup" aria-labelledby="ob-l-${cid}" data-c="${cur}">
            ${LEVELS.map(l => `<label class="${cur === l.v ? 'on' : ''}"><input type="radio" name="lv-${cid}" value="${l.v}" data-course="${cid}" ${cur === l.v ? 'checked' : ''}><span>${l.label}</span></label>`).join('')}
            <i class="ob-seg-thumb" aria-hidden="true"></i>
          </div>
        </div>`;
      }).join('');
      return `${head('Dürüst ol, kimse görmüyor', 'Bu derslerde kendini nasıl değerlendiriyorsun?', 'Zayıf olduğun derslerle başlayacağız. Sonra konu testleri bu tahmini kendiliğinden düzeltir.')}
        <div class="ob-assess">${rows}</div>`;
    },
    // e) Zaman
    () => `${head('Zaman', 'Günde ne kadar zaman ayırabilirsin?', 'Az ama her gün, çok ama ara sıradan iyidir.')}
      <div class="ob-mins" role="radiogroup" aria-labelledby="ob-q">${MINUTES.map(m => `
        <label class="ob-min ${s.minutes === m ? 'on' : ''}">
          <input type="radio" name="min" value="${m}" ${s.minutes === m ? 'checked' : ''}>
          <span class="ob-min-ring" aria-hidden="true">${App.ring(m / 90 * 100, 64, 5, 'currentColor')}</span>
          <b>${m}</b><small>dakika</small>
        </label>`).join('')}</div>
      <p class="ob-label ob-slots-l" id="ob-slots-l">Hangi saatlerde? <span class="muted">(birden çok seçebilirsin)</span></p>
      <div class="ob-chips" role="group" aria-labelledby="ob-slots-l">${SLOTS.map(x => `
        <label class="ob-chip ${s.slots.includes(x.id) ? 'on' : ''}"><input type="checkbox" name="slot" value="${x.id}" ${s.slots.includes(x.id) ? 'checked' : ''}><span aria-hidden="true">${x.icon}</span>${x.label}</label>`).join('')}</div>`,
    // f) Öğrenme tarzı
    () => `${head('Tarzın', 'Nasıl öğrenmeyi seversin?', 'Birden çok seçebilirsin. Her konu tüm modlarda var; seçtiklerin öne çıkar.')}
      <div class="ob-choices ob-modes" role="group" aria-labelledby="ob-q">${PMODES.map(it => `
        <label class="ob-choice ${s.modes.includes(it.id) ? 'on' : ''}">
          <input type="checkbox" name="mode" value="${it.id}" ${s.modes.includes(it.id) ? 'checked' : ''}>
          <span class="ob-choice-ic" aria-hidden="true">${it.icon}</span>
          <span class="ob-choice-t"><b>${it.label}</b><small>${it.sub}</small></span>
          <span class="ob-tick sq" aria-hidden="true"></span>
        </label>`).join('')}</div>`,
    // g1) Analiz
    () => {
      const g = goalOf(s.goal);
      const lines = [`${g.label} hedefin inceleniyor`, 'Ders seviyelerin karşılaştırılıyor', `${g.courses.length} kurs arasından sıralama yapılıyor`, `Günlük ${s.minutes} dakikaya göre konu dağıtılıyor`, 'İlk haftan takvime yerleştiriliyor'];
      return `<div class="ob-analyze" role="status" aria-live="polite">
        <div class="ob-spin" aria-hidden="true"><span></span></div>
        <h1 class="ob-q" id="ob-q" tabindex="-1">Planın hazırlanıyor…</h1>
        <ul class="ob-steps">${lines.map((l, i) => `<li data-i="${i}"><span class="ob-steps-m" aria-hidden="true"></span>${esc(l)}</li>`).join('')}</ul>
      </div>`;
    },
    // g2) Sonuç
    () => {
      const g = goalOf(s.goal); const path = g.path && App.path(g.path);
      const lv = (cid) => s.levels[cid] ?? 1;
      const ordered = g.courses.slice().sort((a, b) => lv(a) - lv(b));
      const plan = buildPlan(s); const adv = styleAdvice(s);
      const firstName = (s.name || '').trim().split(' ')[0];
      const lvTag = (v) => v === 0 ? '<span class="tag err">Zayıf · öncelik</span>' : v === 1 ? '<span class="tag warn">Orta</span>' : '<span class="tag ok">İyi</span>';
      const today = App.today();
      const byDay = {}; plan.forEach(p => (byDay[p.day] = byDay[p.day] || []).push(p));
      const left = daysLeft(s.examDate);
      return `<div class="ob-result">
        ${head('Planın hazır', `${firstName ? esc(firstName) + ', i' : 'İ'}şte <em>senin</em> yolun.`, left > 0 ? `${g.exam ? 'Final haftasına' : 'Hedef tarihine'} ${left} gün var. Her gün ${s.minutes} dakikayla oraya varacağız.` : `Her gün ${s.minutes} dakikayla, adım adım.`)}
        <div class="ob-res-grid">
          <section class="ob-card ob-path">
            <p class="ob-card-k">Önerilen öğrenme yolu</p>
            <h2 class="serif">${path ? path.emoji + ' ' + esc(path.title) : g.icon + ' ' + esc(g.label) + ' — kişisel yol'}</h2>
            <p class="muted small">${path ? esc(path.desc) : 'Seçtiğin hedefe göre derlenmiş kurs sırası.'}</p>
            <ol class="ob-courses">${ordered.map((cid, i) => { const c = App.course(cid); return `<li><span class="ob-cnum">${i + 1}</span><span class="ob-cic" style="--c:${c.color}" aria-hidden="true">${c.emoji}</span><span class="ob-ct"><b>${esc(c.title)}</b><small>${App.courseTopics(cid).length} konu · ${c.hours} saat</small></span>${lvTag(lv(cid))}</li>`; }).join('')}</ol>
            <p class="small muted ob-enroll-n">Bu ${ordered.length} kursa otomatik kaydolacaksın.</p>
          </section>
          <section class="ob-card ob-goalc">
            <p class="ob-card-k">Günlük hedef</p>
            <div class="ob-goal-ring">${App.ring(s.minutes / 90 * 100, 104, 8)}<span><b>${s.minutes}</b><small>dk / gün</small></span></div>
            <p class="small muted">${s.slots.length ? s.slots.map(id => SLOTS.find(x => x.id === id).label).join(', ') + ' saatlerinde' : 'Sana uyan herhangi bir saatte'}</p>
          </section>
          <section class="ob-card ob-week">
            <p class="ob-card-k">İlk haftan</p>
            <ol class="ob-days">${Object.keys(byDay).map(d => { const i = Math.round((new Date(d + 'T12:00') - new Date(today + 'T12:00')) / 864e5); return `<li><span class="ob-day"><b>${dayName(d, i)}</b><small>${App.fmtShort(d + 'T12:00')}</small></span><ul>${byDay[d].map(p => `<li>${esc(p.title)}</li>`).join('')}</ul></li>`; }).join('')}</ol>
          </section>
          <section class="ob-card ob-style">
            <p class="ob-card-k">Senin için önerilen çalışma tarzı</p>
            <p class="ob-style-h serif">${esc(adv.head)}</p>
            <ul class="ob-tips">${adv.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
            <p class="small ob-when">⏱ ${esc(adv.when)}</p>
          </section>
        </div>
      </div>`;
    }
  ];

  // ---- Doğrulama ----
  function valid() {
    if (step === 1) return !!s.goal;
    if (step === 5) return s.modes.length > 0;
    return true;
  }
  const hint = () => step === 1 ? 'Devam etmek için bir hedef seç.' : step === 5 ? 'En az bir öğrenme yolu seç.' : '';

  // ---- Çizim ----
  function paint(focus = true) {
    const stage = document.getElementById('ob-stage'); if (!stage) return;
    const root = document.querySelector('.ob');
    root.dataset.step = step;
    stage.innerHTML = `<div class="ob-pane ${reduced() ? '' : (dir > 0 ? 'ob-in-f' : dir < 0 ? 'ob-in-b' : '')}">${VIEWS[step]()}</div>`;
    // ilerleme noktaları
    document.querySelectorAll('.ob-dot').forEach((d, i) => { d.classList.toggle('on', i === step); d.classList.toggle('done', i < step || step >= STEP_COUNT); });
    const prog = document.getElementById('ob-prog');
    prog.setAttribute('aria-valuenow', Math.min(step + 1, STEP_COUNT));
    document.getElementById('ob-sr').textContent = step < STEP_COUNT ? `Adım ${step + 1} / ${STEP_COUNT}` : step === STEP_COUNT ? 'Planın hazırlanıyor' : 'Planın hazır';
    // alt çubuk
    const foot = document.getElementById('ob-foot');
    const back = document.getElementById('ob-back'), next = document.getElementById('ob-next');
    foot.hidden = step === STEP_COUNT;
    back.style.visibility = step === 0 ? 'hidden' : '';
    back.textContent = step === STEP_COUNT + 1 ? '← Düzenle' : '← Geri';
    next.innerHTML = step === STEP_COUNT + 1 ? 'Hadi başlayalım →' : step === STEP_COUNT - 1 ? 'Planımı hazırla →' : 'Devam →';
    next.classList.toggle('ob-go', step === STEP_COUNT + 1);
    const sk = document.getElementById('ob-skip'); if (sk) sk.hidden = step >= STEP_COUNT;
    updateNext();
    bindStep();
    if (step === STEP_COUNT) runAnalysis();
    if (focus) {
      const f = step === 0 ? document.getElementById('ob-name') : document.getElementById('ob-q');
      if (f) f.focus({ preventScroll: true });
    }
    const sc = document.querySelector('.ob-main'); if (sc) sc.scrollTop = 0;
    window.scrollTo(0, 0);
  }
  function updateNext() {
    const next = document.getElementById('ob-next'); if (!next) return;
    const ok = valid();
    next.setAttribute('aria-disabled', ok ? 'false' : 'true');
    const h = document.getElementById('ob-hint'); h.textContent = '';
  }

  let timers = [];
  function runAnalysis() {
    const lis = document.querySelectorAll('.ob-steps li'); const per = 380;
    lis.forEach((li, i) => {
      timers.push(setTimeout(() => { li.classList.add('run'); }, i * per));
      timers.push(setTimeout(() => { li.classList.remove('run'); li.classList.add('ok'); }, i * per + per - 40));
    });
    timers.push(setTimeout(() => { dir = 1; step = STEP_COUNT + 1; paint(); }, lis.length * per + 250));
  }

  function go(delta) {
    if (step === STEP_COUNT) return;
    if (delta > 0) {
      if (!valid()) { const h = document.getElementById('ob-hint'); h.textContent = hint(); return; }
      if (step === STEP_COUNT + 1) { finish(s); return; }
      if (step === 1 && !s.examDate) { const g = goalOf(s.goal); s.examDate = g.date || ''; }
    } else {
      if (step === 0) return;
      if (step === STEP_COUNT + 1) { dir = -1; step = STEP_COUNT - 1; paint(); return; }
    }
    dir = delta; step += delta; paint();
  }

  function bindStep() {
    const stage = document.getElementById('ob-stage');
    const name = document.getElementById('ob-name');
    if (name) name.oninput = () => { s.name = name.value; document.getElementById('ob-av').textContent = initials(name.value || 'Yeni Öğrenci'); };
    const date = document.getElementById('ob-date');
    if (date) date.onchange = date.oninput = () => { s.examDate = date.value; const l = daysLeft(date.value); document.getElementById('ob-left').innerHTML = l != null && l > 0 ? `<b>${l}</b> gün var` : ''; };
    stage.querySelectorAll('input[type=radio], input[type=checkbox]').forEach(inp => inp.onchange = () => {
      const n = inp.name;
      if (n === 'goal') { if (s.goal !== inp.value) { s.goal = inp.value; s.grade = null; s.levels = {}; s.examDate = goalOf(inp.value).date || ''; } }
      else if (n === 'grade') s.grade = inp.value;
      else if (n === 'min') s.minutes = +inp.value;
      else if (n.startsWith('lv-')) { s.levels[inp.dataset.course] = +inp.value; inp.closest('.ob-seg').dataset.c = inp.value; }
      else if (n === 'slot' || n === 'mode') {
        const arr = n === 'slot' ? s.slots : s.modes; const i = arr.indexOf(inp.value);
        if (inp.checked && i < 0) arr.push(inp.value); else if (!inp.checked && i >= 0) arr.splice(i, 1);
      }
      // görsel durum
      if (inp.type === 'radio') stage.querySelectorAll(`input[name="${n}"]`).forEach(o => o.closest('label').classList.toggle('on', o.checked));
      else inp.closest('label').classList.toggle('on', inp.checked);
      updateNext();
    });
    // Seçim kartına çift tık → hızlıca ilerle (tek seçimli adımlarda)
    stage.querySelectorAll('.ob-goals .ob-choice').forEach(l => l.ondblclick = () => go(1));
  }

  App.route('/onboarding', () => {
    const redo = !!App.query().redo;
    if (!s || owner !== App.user.id) { s = freshState(); step = 0; dir = 1; owner = App.user.id; }
    timers = [];
    return `<div class="ob" data-step="0">
      <header class="ob-top">
        <span class="ob-brand"><span class="logo">K</span><span class="hide-mobile">Kampüs</span></span>
        <div class="ob-dots" id="ob-prog" role="progressbar" aria-label="Kurulum ilerlemesi" aria-valuemin="1" aria-valuemax="${STEP_COUNT}" aria-valuenow="1">
          ${Array.from({ length: STEP_COUNT }, () => '<span class="ob-dot"></span>').join('')}
        </div>
        <div class="ob-top-r">
          ${redo ? '<a class="ob-link ob-close" href="#/profile">Vazgeç ✕</a>' : '<button class="ob-link" id="ob-skip" type="button">Atla</button>'}
        </div>
      </header>
      <p class="ob-sr" id="ob-sr" aria-live="polite"></p>
      <main class="ob-main"><div class="ob-stage" id="ob-stage"></div></main>
      <footer class="ob-foot" id="ob-foot">
        <button class="ob-back" id="ob-back" type="button">← Geri</button>
        <span class="ob-hint" id="ob-hint" role="alert"></span>
        <button class="ob-next" id="ob-next" type="button">Devam →</button>
        <span class="ob-keys hide-mobile" aria-hidden="true"><kbd>Enter</kbd> ileri · <kbd>←</kbd> geri</span>
      </footer>
    </div>`;
  }, {
    title: 'Hoş geldin', layout: false,
    after() {
      document.getElementById('ob-next').onclick = () => go(1);
      document.getElementById('ob-back').onclick = () => go(-1);
      const sk = document.getElementById('ob-skip'); if (sk) sk.onclick = skip;
      const onKey = (e) => {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
        if (document.getElementById('modal-root').children.length) return;
        const t = e.target; const tag = (t.tagName || '').toLowerCase(); const type = (t.type || '').toLowerCase();
        if (e.key === 'Enter') {
          if (tag === 'button' || tag === 'a' || tag === 'textarea') return;
          if (type === 'checkbox') { e.preventDefault(); t.click(); return; } // Enter ile işaretle
          e.preventDefault(); go(1);
        } else if (e.key === 'ArrowLeft') {
          if (type === 'radio' || (tag === 'input' && type !== 'checkbox') || tag === 'textarea' || tag === 'select') return;
          e.preventDefault(); go(-1);
        }
      };
      document.addEventListener('keydown', onKey);
      App.onLeave(() => { document.removeEventListener('keydown', onKey); timers.forEach(clearTimeout); timers = []; });
      dir = 0; paint(false);
      const n = document.getElementById('ob-name'); if (n && !n.value) n.focus({ preventScroll: true });
    }
  });

  // Dışarıdan erişim (ör. profil sayfasındaki "Planımı yeniden oluştur" bağlantısı #/onboarding?redo=1 kullanır)
  window.Onboard = { get GOALS() { return goals(); }, buildPlan };
})();
