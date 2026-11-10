// Çalışma Odaları — birlikte sessiz çalışma ("study with me") (rm-).
// Gerçek backend yok: diğer katılımcılar, sohbet ve sayaçlar istemci tarafında simüle edilir.
// Ortak Pomodoro oda başlangıç zamanından hesaplanır; aynı odadaki herkes aynı turdadır.
(function () {
  const esc = (s) => App.esc(s);
  const MIN = 60000;
  const XP_ROOM = 20; // kişisel Pomodoro 15 XP + 5 XP birlikte çalışma bonusu
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

  // ---- Zamanlayıcılar: hepsi buradan; sayfadan çıkınca App.onLeave ile temizlenir ----
  let timers = [];
  function every(fn, ms) { const id = setInterval(fn, ms); timers.push(() => clearInterval(id)); return id; }
  function later(fn, ms) { const id = setTimeout(fn, ms); timers.push(() => clearTimeout(id)); return id; }
  function clearAll() { timers.forEach(f => f()); timers = []; }
  function startPage() { clearAll(); App.onLeave(clearAll); }

  // ---- Tohumlu rastgele (aynı gün aynı oda → aynı kişiler) ----
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];
  const dayStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const dayKey = () => App.ymd(new Date());

  // ---- Odalar ----
  // Odalar katalogdaki kurslara bağlanır; listede olmayan kurs id'si süzülür, hiçbiri yoksa tüm katalog kullanılır.
  const ALL = App.db.courses.map(c => c.id);
  const cs = (...ids) => { const ok = ids.filter(id => App.course(id)); return ok.length ? ok : ALL; };
  const FAKE = [
    { id: 'algo-final', name: 'Algoritmalar Final Kampı', emoji: '🧮', tag: 'Algoritmalar', courses: cs('algo'), focus: 50, brk: 10, offset: 17, base: 38, desc: 'Uzun odak blokları, kısa molalar. Final haftasına hazırlananlar burada.' },
    { id: 'ds-lab', name: 'Veri Yapıları Lab', emoji: '🌳', tag: 'Veri Yapıları', courses: cs('ds'), focus: 25, brk: 5, offset: 3, base: 21, desc: 'Klasik 25/5. Lab föyü ve ödev çalışanlar için.' },
    { id: 'kutuphane', name: 'Sessiz Kütüphane', emoji: '📚', tag: 'Karışık', courses: ALL, focus: 25, brk: 5, offset: 11, base: 64, desc: 'Herkes kendi işinde. Sadece klavye sesi.' },
    { id: 'leetcode', name: 'LeetCode Saati', emoji: '⌨️', tag: 'Mülakat hazırlığı', courses: cs('ds', 'algo'), focus: 45, brk: 15, offset: 7, base: 12, desc: 'Soru çöz, molada takıldığın yeri sor.' },
    { id: 'gece-kod', name: 'Gece Kod Kulübü', emoji: '🌙', tag: 'Gece kuşları', courses: cs('prog', 'os', 'net'), focus: 50, brk: 10, offset: 360, base: 17, desc: 'Proje teslimi yaklaşanlar için uzun turlar.' },
    { id: 'sistem-vize', name: 'Sistem Dersleri Vize Odası', emoji: '⚙️', tag: 'OS · Ağ · Veritabanı', courses: cs('os', 'net', 'db'), focus: 25, brk: 5, offset: 19, base: 9, desc: 'Kart tekrarı ve konu testleri.' }
  ];
  // Listede görünmeyen, yalnız davet koduyla girilen demo özel oda
  const SECRET = { id: 'gizli-kamp', name: 'Proje Grubu — Kapalı Oda', emoji: '🔒', tag: 'Özel · Proje', courses: cs('prog', 'ds', 'algo'), focus: 40, brk: 10, offset: 5, base: 7, private: true, code: 'KAMP26', desc: 'Proje arkadaşlarıyla kapalı oda.' };

  function myRooms() { const me = App.me(); if (!me.rooms) me.rooms = []; return me.rooms; }
  function findRoom(id) { return FAKE.find(r => r.id === id) || (id === SECRET.id ? SECRET : null) || myRooms().find(r => r.id === id) || null; }
  const roomGoal = (r) => r.mine ? 12 : 50;

  // Ortak saat: herkes aynı başlangıç anından hesaplar → aynı tur, aynı kalan süre.
  function phase(r, now = Date.now()) {
    const F = r.focus * MIN, B = r.brk * MIN, C = F + B;
    const start = r.startAt != null ? r.startAt : dayStart(now) + r.offset * MIN;
    const el = now - start; const cycle = Math.floor(el / C); const pos = el - cycle * C;
    if (pos < F) return { focus: true, left: F - pos, total: F, cycle, phaseStart: now - pos };
    return { focus: false, left: C - pos, total: B, cycle, phaseStart: now - (pos - F) };
  }

  // ---- Canlı sayılar (modül belleğinde; sayfalar arası korunur, simülasyon yalnız sayfa açıkken işler) ----
  const live = {};
  function liveOf(r) {
    if (!live[r.id]) {
      const g = rng(hash(r.id + dayKey()));
      const goal = roomGoal(r);
      live[r.id] = { count: r.mine ? 1 + Math.floor(g() * 3) : r.base + Math.round((g() - .5) * 8), done: r.mine ? Math.floor(g() * 3) : 18 + Math.floor(g() * 22) };
      live[r.id].done = Math.min(goal - 3, live[r.id].done);
    }
    return live[r.id];
  }
  function driftCounts() {
    FAKE.concat([SECRET], myRooms()).forEach(r => {
      const L = liveOf(r); const d = pick([-1, 0, 0, 0, 1]);
      const lo = r.mine ? 1 : Math.max(3, r.base - 7), hi = r.mine ? 6 : r.base + 7;
      L.count = Math.max(lo, Math.min(hi, L.count + d));
      if (!r.mine && Math.random() < .06 && L.done < roomGoal(r)) L.done++;
    });
  }
  const totalLive = () => FAKE.reduce((s, r) => s + liveOf(r).count, 0);

  // ---- Sahte kişiler ----
  const EXTRA = [
    ['Deniz Y.', 'DY'], ['Kaan E.', 'KE'], ['İrem S.', 'İS'], ['Yusuf K.', 'YK'], ['Ayşe N.', 'AN'], ['Emre Ç.', 'EÇ'], ['Nehir A.', 'NA'], ['Ali R.', 'AR'],
    ['Defne T.', 'DT'], ['Ömer F.', 'ÖF'], ['Beren D.', 'BD'], ['Arda U.', 'AU'], ['Zehra M.', 'ZM'], ['Efe G.', 'EG'], ['Melis H.', 'MH'], ['Kerem B.', 'KB']
  ];
  const COLORS = ['#1e5b43', '#c8922c', '#b4472f', '#2c4a6b', '#5b6b1e', '#7a5a14', '#3d3d3d', '#8a3b2a'];
  function pool() {
    const lg = (App.db.league || []).map(x => [x.name, x.avatar]);
    return lg.concat(EXTRA).map(([name, avatar], i) => ({ id: 'p' + i, name, avatar, color: COLORS[i % COLORS.length] }));
  }
  function topicLine(r, g) {
    const cid = pick(r.courses, g); const c = App.course(cid);
    const ts = App.courseTopics(cid);
    if (!c || !ts.length || g() < .15) return pick(['Deneme çözüyor', 'Soru bankası · karışık', 'Yanlış defteri tekrarı', 'Ödev · kod yazıyor', 'Kart tekrarı'], g);
    return c.title.split(':')[0] + ' · ' + pick(ts, g).title;
  }
  function makePerson(p, r, g, ph) {
    return { ...p, topic: topicLine(r, g), mins: 10 + Math.floor(g() * 170), status: statusFor(ph, g) };
  }
  function statusFor(ph, g = Math.random) { const x = g(); return ph.focus ? (x < .86 ? 'focus' : 'away') : (x < .7 ? 'break' : x < .9 ? 'focus' : 'away'); }
  const STATUS = { focus: 'odakta', break: 'molada', away: 'uzakta' };

  // Sohbet mesajları: ders içeriği yazılmaz; konu adları katalogdan seçilir.
  const MSGS = [
    'Su içmeyi unutmayın 💧', 'Bu tur çok verimliydi', 'Ben bu molada esneme yapıyorum', 'Kaçıncı turdasınız?', 'Bir tur daha, sonra yemek 🍝',
    'Sessizlik iyi geliyor, teşekkürler herkese', 'Denemede iki soru daha doğru yaptım 🎉', 'Telefonu başka odaya koydum, işe yarıyor', 'Ödev teslimine az kaldı, devam'
  ];
  function randomMsg() {
    const ts = App.db.topics || [];
    if (ts.length > 1 && Math.random() < .35) {
      const a = pick(ts), b = pick(ts.filter(t => t.id !== a.id));
      return pick([`${a.title} bitti, sırada ${b.title} 💪`, `Biri ${a.title} konusunu anlatsın 😅`, `${a.title} kafamda oturdu sonunda`, `${a.title} kartlarını tekrar ediyorum`]);
    }
    return pick(MSGS);
  }

  // ================= /rooms — oda listesi =================
  function phaseLabel(ph) { return ph.focus ? `Odak · <b>${mmss(ph.left)}</b> kaldı` : `Mola · <b>${mmss(ph.left)}</b>`; }
  function stack(r) {
    const g = rng(hash(r.id + 'stack')); const ps = pool().slice().sort(() => g() - .5).slice(0, 4);
    return ps.map(p => `<span class="avatar rm-av" style="background:${p.color}" aria-hidden="true">${esc(p.avatar)}</span>`).join('');
  }
  function roomCard(r) {
    const ph = phase(r), L = liveOf(r);
    return `
    <article class="rm-card ${ph.focus ? '' : 'is-break'}" data-room="${esc(r.id)}">
      <div class="rm-card-top">
        <span class="rm-emoji" aria-hidden="true">${esc(r.emoji || '📘')}</span>
        <span class="tag ${r.private ? 'accent' : ''}">${esc(r.tag)}</span>
        <span class="rm-live"><i aria-hidden="true"></i><b data-count>${L.count}</b> kişi</span>
      </div>
      <h3 class="serif">${esc(r.name)}</h3>
      <p class="small muted rm-desc">${esc(r.desc || `${r.focus} dk odak · ${r.brk} dk mola`)}</p>
      ${r.private ? `<p class="small rm-code">🔒 Özel oda · Davet kodu: <code>${esc(r.code)}</code></p>` : ''}
      <div class="rm-card-phase" data-phase aria-label="Ortak Pomodoro durumu">
        <span class="rm-ph-dot" aria-hidden="true"></span><span data-phase-txt>${phaseLabel(ph)}</span>
        <span class="rm-card-cfg small muted">${r.focus}/${r.brk}</span>
      </div>
      <div class="rm-card-bar" aria-hidden="true"><span data-bar style="width:${Math.round(ph.left / ph.total * 100)}%"></span></div>
      <div class="rm-card-foot">
        <div class="rm-stack" aria-hidden="true">${stack(r)}</div>
        ${r.mine ? `<button class="btn sm ghost rm-del" data-del="${esc(r.id)}" aria-label="${esc(r.name)} odasını sil">Sil</button>` : ''}
        <a class="btn primary sm" href="#/rooms/${encodeURIComponent(r.id)}" aria-label="${esc(r.name)} odasına katıl">Katıl</a>
      </div>
    </article>`;
  }

  function listPage() {
    const me = App.me(); const mine = myRooms();
    return `
    <div class="rm-page">
      <div class="page-head rm-head">
        <div><span class="rm-eyebrow">Birlikte sessiz çalışma</span><h1>Çalışma Odaları</h1>
          <p class="muted">Kamera yok, konuşma yok. Aynı saatte, aynı turda — sadece birlikte odaklanmak.</p></div>
        <div class="row rm-head-actions">
          <button class="btn" id="rm-code-btn">🔑 Kodla katıl</button>
          <button class="btn primary" id="rm-new-btn">＋ Oda oluştur</button>
        </div>
      </div>
      <section class="rm-now" aria-live="off">
        <span class="rm-pulse" aria-hidden="true"></span>
        <p>Şu an <b id="rm-total">${totalLive().toLocaleString('tr-TR')}</b> kişi seninle birlikte çalışıyor.</p>
        <span class="rm-now-me small muted">Odalarda tamamladığın: <b>${me.roomPomos || 0}</b> 🍅</span>
      </section>
      ${mine.length ? `<h2 class="rm-sec">Odalarım</h2><div class="rm-grid" id="rm-mine">${mine.map(roomCard).join('')}</div>` : ''}
      <h2 class="rm-sec">Canlı odalar</h2>
      <div class="rm-grid" id="rm-list">${FAKE.map(roomCard).join('')}</div>
      <p class="small muted rm-note">Bu bir prototip: diğer katılımcılar simülasyondur. Sayaçlar herkes için aynı saatten hesaplanır.</p>
    </div>`;
  }

  function listAfter() {
    startPage();
    const upd = () => {
      document.querySelectorAll('.rm-card[data-room]').forEach(el => {
        const r = findRoom(el.dataset.room); if (!r) return;
        const ph = phase(r);
        el.querySelector('[data-phase-txt]').innerHTML = phaseLabel(ph);
        el.querySelector('[data-bar]').style.width = Math.round(ph.left / ph.total * 100) + '%';
        el.classList.toggle('is-break', !ph.focus);
      });
    };
    const drift = () => {
      driftCounts();
      document.querySelectorAll('.rm-card[data-room]').forEach(el => { const r = findRoom(el.dataset.room); if (r) el.querySelector('[data-count]').textContent = liveOf(r).count; });
      const t = document.getElementById('rm-total'); if (t) t.textContent = totalLive().toLocaleString('tr-TR');
    };
    every(upd, 1000);
    every(drift, 3500);
    document.getElementById('rm-new-btn').onclick = createModal;
    document.getElementById('rm-code-btn').onclick = codeModal;
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const r = findRoom(b.dataset.del);
      App.confirm(`“${esc(r.name)}” odasını silmek istiyor musun?`, () => { const me = App.me(); me.rooms = myRooms().filter(x => x.id !== r.id); App.save(); App.render(); App.toast('Oda silindi'); });
    });
  }

  function genCode() { const a = 'ABCDEFGHJKLMNPRSTUVYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }

  function createModal() {
    const code = genCode();
    const courses = App.myCourses();
    const el = App.modal({
      title: 'Oda oluştur',
      body: `
      <form id="rm-form" class="rm-form" onsubmit="return false">
        <div class="field"><label for="rm-f-name">Oda adı</label><input id="rm-f-name" maxlength="40" placeholder="Ör. Akşam Kod Maratonu" required></div>
        <div class="field"><label for="rm-f-course">Konu / kurs</label>
          <select id="rm-f-course"><option value="">Karışık — herkes kendi dersine</option>${courses.map(c => `<option value="${esc(c.id)}">${esc(c.emoji || '')} ${esc(c.title.split(':')[0])}</option>`).join('')}</select></div>
        <div class="rm-form-row">
          <div class="field"><label for="rm-f-focus">Odak süresi</label><select id="rm-f-focus">${[25, 30, 40, 45, 50].map(v => `<option value="${v}">${v} dk</option>`).join('')}</select></div>
          <div class="field"><label for="rm-f-brk">Mola süresi</label><select id="rm-f-brk">${[5, 10, 15].map(v => `<option value="${v}">${v} dk</option>`).join('')}</select></div>
        </div>
        <fieldset class="rm-vis"><legend>Görünürlük</legend>
          <label><input type="radio" name="rm-vis" value="public" checked> <span><b>Herkese açık</b><small class="muted">Listede görünür, herkes katılabilir.</small></span></label>
          <label><input type="radio" name="rm-vis" value="private"> <span><b>Özel</b><small class="muted">Yalnızca davet koduyla girilir.</small></span></label>
        </fieldset>
        <p class="rm-code-preview" id="rm-code-preview" hidden>Davet kodu: <code>${code}</code> <span class="small muted">— arkadaşlarınla paylaş</span></p>
      </form>`,
      actions: [{ label: 'Vazgeç' }, {
        label: 'Oluştur', primary: true, onClick: (close, m) => {
          const name = m.querySelector('#rm-f-name').value.trim();
          if (!name) { App.toast('Odaya bir ad ver', 'err'); m.querySelector('#rm-f-name').focus(); return; }
          const cid = m.querySelector('#rm-f-course').value; const c = cid && App.course(cid);
          const priv = m.querySelector('input[name="rm-vis"]:checked').value === 'private';
          const r = {
            id: App.uid('rm'), name, emoji: c ? (c.emoji || '📘') : '📚', tag: c ? c.title.split(':')[0] : 'Karışık',
            courses: c ? [c.id] : (App.me().enrolled.length ? App.me().enrolled.slice() : ALL),
            focus: +m.querySelector('#rm-f-focus').value, brk: +m.querySelector('#rm-f-brk').value,
            private: priv, code: priv ? code : null, startAt: Date.now(), mine: true, createdAt: App.nowISO(),
            desc: `${priv ? 'Özel oda' : 'Herkese açık'} · ${m.querySelector('#rm-f-focus').value} dk odak`
          };
          myRooms().unshift(r); App.save(); close();
          App.toast(priv ? `Oda hazır · Davet kodu ${code}` : 'Oda hazır — ilk tur başladı');
          App.go('/rooms/' + r.id);
        }
      }]
    });
    const prev = el.querySelector('#rm-code-preview');
    el.querySelectorAll('input[name="rm-vis"]').forEach(i => i.onchange = () => { prev.hidden = el.querySelector('input[name="rm-vis"]:checked').value !== 'private'; });
    el.querySelector('#rm-f-name').focus();
  }

  function codeModal() {
    const el = App.modal({
      title: 'Davet koduyla katıl',
      body: `<form id="rm-code-form" onsubmit="return false"><div class="field"><label for="rm-code-in">Davet kodu</label>
        <input id="rm-code-in" maxlength="8" autocomplete="off" placeholder="ÖR. KAMP26" style="text-transform:uppercase;letter-spacing:.12em"></div>
        <p class="small muted">Demo için <code>KAMP26</code> kodunu deneyebilirsin.</p></form>`,
      actions: [{ label: 'Vazgeç' }, {
        label: 'Katıl', primary: true, onClick: (close, m) => {
          const v = m.querySelector('#rm-code-in').value.trim().toUpperCase();
          const r = v === SECRET.code ? SECRET : myRooms().find(x => x.code && x.code === v);
          if (!r) { App.toast('Bu kodla bir oda bulunamadı', 'err'); return; }
          close(); App.go('/rooms/' + r.id);
        }
      }]
    });
    const inp = el.querySelector('#rm-code-in'); inp.focus();
    inp.onkeydown = (e) => { if (e.key === 'Enter') el.querySelector('[data-a="1"]').click(); };
  }

  // ================= /rooms/:id — oda içi =================
  let S = null; // oda oturumu (yalnız sayfa açıkken)

  function topicOptions(sel) {
    return `<option value="">Genel tekrar</option>` + App.myCourses().map(c => `<optgroup label="${esc(c.title.split(':')[0])}">${App.courseTopics(c.id).map(t => `<option value="${esc(t.id)}" ${t.id === sel ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</optgroup>`).join('');
  }
  function myTopicText() {
    const me = App.me(); const t = me.roomTopic && App.topic(me.roomTopic);
    if (!t) return 'Genel tekrar'; const c = App.course(t.courseId);
    return (c ? c.title.split(':')[0] + ' · ' : '') + t.title;
  }

  function roomPage(params) {
    const r = findRoom(params.id);
    if (!r) return App.emptyState('🚪', 'Oda bulunamadı', 'Bu oda kapanmış ya da bağlantı hatalı olabilir.', '<a class="btn primary" href="#/rooms">Odalara dön</a>');
    const ph = phase(r), L = liveOf(r), g = rng(hash(r.id + dayKey() + 'people'));
    const shown = Math.min(L.count - 1, r.mine ? 3 : 9);
    const people = pool().sort(() => g() - .5);
    S = { r, joinedAt: Date.now(), last: { focus: ph.focus, cycle: ph.cycle, phaseStart: ph.phaseStart }, people: people.slice(0, Math.max(0, shown)).map(p => makePerson(p, r, g, ph)), bench: people.slice(Math.max(0, shown)), msgs: [], myFocusMs: 0, lastTick: Date.now() };
    S.msgs.push({ sys: true, text: ph.focus ? 'Odak turu sürüyor. Sohbet molada açılır.' : 'Mola zamanı — merhaba demek için iyi an.' });
    if (!ph.focus) S.msgs.push(fakeMsg());
    const u = App.user, goal = roomGoal(r);
    const R = 112, C = 2 * Math.PI * R;
    return `
    <div class="rm-page rm-room ${ph.focus ? 'is-focus' : 'is-break'}" id="rm-room">
      ${App.breadcrumbs([['Çalışma Odaları', '/rooms'], [r.name, '']])}
      <div class="rm-room-head">
        <div>
          <h1><span aria-hidden="true">${esc(r.emoji || '📘')}</span> ${esc(r.name)}</h1>
          <p class="muted small rm-room-meta"><span class="tag ${r.private ? 'accent' : ''}">${esc(r.tag)}</span> ${r.focus} dk odak · ${r.brk} dk mola · <b id="rm-count">${L.count}</b> kişi
            ${r.private && r.code ? ` · Davet kodu <code>${esc(r.code)}</code>` : ''}</p>
        </div>
        <button class="btn rm-leave" id="rm-leave" aria-label="Odadan ayrıl">🚪 Ayrıl</button>
      </div>

      <div class="rm-layout">
        <div class="rm-main">
          <section class="card rm-timer" aria-labelledby="rm-ph-name">
            <div class="rm-ring-wrap">
              <svg class="rm-ring" viewBox="0 0 260 260" aria-hidden="true"><circle class="rm-ring-track" cx="130" cy="130" r="${R}"/><circle class="rm-ring-bar" id="rm-ring-bar" cx="130" cy="130" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - ph.left / ph.total)}" transform="rotate(-90 130 130)"/></svg>
              <div class="rm-ring-in">
                <span class="rm-ph-name" id="rm-ph-name">${ph.focus ? 'Odak' : 'Mola'}</span>
                <span class="rm-time" id="rm-time" role="timer" aria-live="off">${mmss(ph.left)}</span>
                <span class="rm-ring-sub" id="rm-ring-sub">${ph.focus ? 'herkes aynı turda' : 'nefes al, esne, su iç'}</span>
              </div>
            </div>
            <div class="rm-timer-side">
              <p class="rm-sync small muted">🕰️ Oda saatine senkron — tur, odanın başlangıç saatinden hesaplanır.</p>
              <div class="rm-goal">
                <div class="row between small"><b>Bugün oda olarak ${goal} pomodoro</b><span><b id="rm-goal-n">${Math.min(L.done, goal)}</b>/${goal}</span></div>
                <div class="progress rm-goal-bar" role="progressbar" aria-label="Oda hedefi" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(L.done, goal)}" id="rm-goal-bar"><span style="width:${Math.min(100, L.done / goal * 100)}%"></span></div>
              </div>
              <p class="small rm-mine-stat" id="rm-mine-stat">${presenceText()}</p>
              <ul class="rm-feed" id="rm-feed" role="log" aria-live="polite" aria-label="Oda bildirimleri"></ul>
            </div>
          </section>

          <section aria-labelledby="rm-ppl-h">
            <div class="row between rm-sec-row"><h2 class="rm-sec" id="rm-ppl-h">Odadakiler</h2><span class="small muted" id="rm-more"></span></div>
            <div class="rm-people" id="rm-people">
              <article class="rm-p rm-me" aria-label="Senin kartın">
                <div class="rm-cam" aria-hidden="true"><span>📷</span><small>kamera kapalı</small></div>
                <div class="rm-p-row">${avatarHTML({ avatar: u.avatar, color: 'var(--primary)' }, 'focus', 'rm-me-dot')}<div class="rm-p-id"><b>${esc(u.name.split(' ')[0])} <small class="muted">(sen)</small></b></div></div>
                <label class="small rm-me-lbl" for="rm-topic">Ne çalışıyorsun?</label>
                <select id="rm-topic" class="input rm-topic">${topicOptions(App.me().roomTopic)}</select>
              </article>
              ${S.people.map(personCard).join('')}
            </div>
          </section>
        </div>

        <aside class="card rm-chat" aria-labelledby="rm-chat-h">
          <div class="rm-chat-head"><h2 class="rm-sec" id="rm-chat-h">Sohbet</h2><span class="tag" id="rm-chat-state">${ph.focus ? '🔒 kilitli' : 'açık'}</span></div>
          <ol class="rm-msgs" id="rm-msgs" role="log" aria-live="polite" aria-label="Sohbet mesajları">${S.msgs.map(msgHTML).join('')}</ol>
          <div class="rm-lock" id="rm-lock" ${ph.focus ? '' : 'hidden'}>Odak sırasında sohbet kapalı 🤫<small>Molada açılacak.</small></div>
          <form class="rm-send" id="rm-send" ${ph.focus ? 'hidden' : ''}>
            <label class="rm-sr" for="rm-msg">Mesaj yaz</label>
            <input id="rm-msg" class="input" maxlength="140" autocomplete="off" placeholder="Molada bir şey yaz…" ${ph.focus ? 'disabled' : ''}>
            <button class="btn primary sm" type="submit" ${ph.focus ? 'disabled' : ''}>Gönder</button>
          </form>
          <div class="rm-react" role="group" aria-label="Hızlı tepki gönder">
            ${[['👏', 'Alkış'], ['🔥', 'Ateş'], ['💪', 'Güç']].map(([e, l]) => `<button class="rm-react-btn" data-react="${e}" aria-label="${l} tepkisi gönder">${e}</button>`).join('')}
            <span class="small muted">tepkiler her an serbest</span>
          </div>
          <div class="rm-fly" id="rm-fly" aria-hidden="true"></div>
        </aside>
      </div>
    </div>`;
  }

  function avatarHTML(p, status, id) {
    return `<span class="rm-av-wrap"><span class="avatar rm-av" style="width:44px;height:44px;font-size:16px;background:${p.color}" aria-hidden="true">${esc(p.avatar)}</span><i class="rm-dot is-${status}" ${id ? `id="${id}"` : ''} aria-hidden="true"></i></span>`;
  }
  function personCard(p) {
    return `<article class="rm-p" data-pid="${p.id}" aria-label="${esc(p.name)}, ${STATUS[p.status]}">
      <div class="rm-p-row">${avatarHTML(p, p.status)}<div class="rm-p-id"><b>${esc(p.name)}</b><span class="rm-st is-${p.status}">${STATUS[p.status]}</span></div></div>
      <p class="rm-p-topic small"><span class="muted">şu an:</span> ${esc(p.topic)}</p>
      <p class="rm-p-time small muted">⏱ <span data-mins>${p.mins}</span> dk odak</p>
    </article>`;
  }
  function msgHTML(m) {
    if (m.sys) return `<li class="rm-msg sys">${esc(m.text)}</li>`;
    return `<li class="rm-msg ${m.me ? 'me' : ''}"><span class="avatar rm-av" style="width:26px;height:26px;font-size:10px;background:${m.color}" aria-hidden="true">${esc(m.avatar)}</span><div><b>${esc(m.name)}</b><p>${esc(m.text)}</p></div></li>`;
  }
  function fakeMsg() {
    const p = (S.people.length ? pick(S.people) : pick(pool()));
    return { name: p.name, avatar: p.avatar, color: p.color, text: randomMsg() };
  }
  function presenceText() {
    if (!S) return '';
    const m = Math.floor(S.myFocusMs / MIN);
    return `Bu oturumda odakta geçirdiğin süre: <b>${m} dk</b>`;
  }

  function roomAfter(params) {
    startPage();
    if (!S || !S.r || S.r.id !== params.id) return;
    const s = S; const r = s.r; const $ = (id) => document.getElementById(id);
    const R = 112, C = 2 * Math.PI * R;
    App.onLeave(() => { if (S === s) S = null; });

    const feed = (text) => {
      const ul = $('rm-feed'); if (!ul) return;
      const li = document.createElement('li'); li.textContent = text; ul.prepend(li);
      while (ul.children.length > 3) ul.lastElementChild.remove();
    };
    const refreshMore = () => { const n = liveOf(r).count - 1 - s.people.length; $('rm-more').textContent = n > 0 ? `+${n} kişi daha sessizce çalışıyor` : ''; $('rm-count').textContent = liveOf(r).count; };
    const addMsg = (m) => {
      s.msgs.push(m); if (s.msgs.length > 40) s.msgs.shift();
      const ol = $('rm-msgs'); ol.insertAdjacentHTML('beforeend', msgHTML(m));
      while (ol.children.length > 40) ol.firstElementChild.remove();
      ol.scrollTop = ol.scrollHeight;
    };
    const updGoal = () => {
      const L = liveOf(r), goal = roomGoal(r), n = Math.min(L.done, goal);
      $('rm-goal-n').textContent = n; const bar = $('rm-goal-bar'); bar.setAttribute('aria-valuenow', n); bar.firstElementChild.style.width = (n / goal * 100) + '%';
      bar.classList.toggle('done', n >= goal);
    };
    const setPhaseUI = (ph) => {
      const root = $('rm-room'); root.classList.toggle('is-focus', ph.focus); root.classList.toggle('is-break', !ph.focus);
      $('rm-ph-name').textContent = ph.focus ? 'Odak' : 'Mola';
      $('rm-ring-sub').textContent = ph.focus ? 'herkes aynı turda' : 'nefes al, esne, su iç';
      $('rm-chat-state').textContent = ph.focus ? '🔒 kilitli' : 'açık';
      $('rm-lock').hidden = !ph.focus; $('rm-send').hidden = ph.focus;
      $('rm-msg').disabled = ph.focus; $('rm-send').querySelector('button').disabled = ph.focus;
      s.people.forEach(p => { p.status = statusFor(ph); });
      redrawPeople();
    };
    const redrawPeople = () => {
      const box = $('rm-people');
      s.people.forEach(p => {
        const el = box.querySelector(`[data-pid="${p.id}"]`); if (!el) return;
        el.setAttribute('aria-label', `${p.name}, ${STATUS[p.status]}`);
        el.querySelector('.rm-dot').className = 'rm-dot is-' + p.status;
        const st = el.querySelector('.rm-st'); st.className = 'rm-st is-' + p.status; st.textContent = STATUS[p.status];
        el.querySelector('[data-mins]').textContent = p.mins;
      });
    };

    function completeFocus(focusStart, focusEnd) {
      const F = r.focus * MIN; const present = focusEnd - Math.max(s.joinedAt, focusStart);
      const L = liveOf(r); const others = s.people.filter(p => p.status === 'focus').length;
      L.done += Math.max(1, Math.round(others / 3));
      if (present >= F * 0.5) {
        const me = App.me(); const mins = Math.max(1, Math.round(present / MIN));
        me.pomodoros = (me.pomodoros || 0) + 1; me.roomPomos = (me.roomPomos || 0) + 1;
        me.pomoLog = me.pomoLog || {}; me.pomoLog[App.today()] = (me.pomoLog[App.today()] || 0) + 1;
        App.logStudy(mins); App.addXP(XP_ROOM, 'Birlikte çalışma');
        if (me.pomodoros >= 10) App.award('pomodoro');
        App.save(); L.done += 1;
        App.toast(`🍅 Oda turu tamam! +${XP_ROOM} XP (birlikte çalışma bonusu dahil) · ${mins} dk kaydedildi`);
        feed('Turu odayla birlikte tamamladın 🍅');
      } else {
        feed('Bu tura geç katıldın; bir sonraki tam turda pomodoro sayılacak.');
      }
      updGoal();
    }

    const tick = () => {
      const now = Date.now(); const ph = phase(r, now);
      if (s.last.focus) s.myFocusMs += Math.min(now - s.lastTick, 5000);
      s.lastTick = now;
      const last = s.last;
      if (last.focus && (ph.cycle !== last.cycle || !ph.focus)) completeFocus(last.phaseStart, last.phaseStart + r.focus * MIN);
      if (ph.focus !== last.focus || ph.cycle !== last.cycle) {
        setPhaseUI(ph);
        if (ph.focus) { feed('Yeni odak turu başladı. Sohbet kapandı 🤫'); addMsg({ sys: true, text: 'Odak turu başladı — sohbet kilitlendi.' }); }
        else { feed(`Mola! ${r.brk} dakika nefes al. Sohbet açıldı.`); addMsg({ sys: true, text: 'Mola başladı — sohbet açık.' }); later(() => { if (!phase(r).focus) addMsg(fakeMsg()); }, 2500); }
      }
      s.last = { focus: ph.focus, cycle: ph.cycle, phaseStart: ph.phaseStart };
      $('rm-time').textContent = mmss(ph.left);
      $('rm-ring-bar').setAttribute('stroke-dashoffset', C * (1 - ph.left / ph.total));
      $('rm-mine-stat').innerHTML = presenceText();
      document.title = `${mmss(ph.left)} ${ph.focus ? 'Odak' : 'Mola'} · ${r.name}`;
    };

    // Katılım / ayrılma simülasyonu — rastgele aralıklarla
    const scheduleJoinLeave = () => later(() => {
      const ph = phase(r); const L = liveOf(r); const box = $('rm-people');
      const leave = s.people.length > (r.mine ? 1 : 5) && (Math.random() < .45 || s.people.length >= 12 || !s.bench.length);
      if (leave) {
        const i = Math.floor(Math.random() * s.people.length); const p = s.people.splice(i, 1)[0]; s.bench.push(p);
        L.count = Math.max(1 + s.people.length, L.count - 1);
        const el = box.querySelector(`[data-pid="${p.id}"]`);
        if (el) { el.classList.add('leaving'); later(() => el.remove(), reduced() ? 0 : 320); }
        feed(`${p.name} odadan ayrıldı`);
      } else if (s.bench.length) {
        const p = makePerson(s.bench.shift(), r, Math.random, ph); p.mins = 0;
        s.people.push(p); L.count++;
        box.insertAdjacentHTML('beforeend', personCard(p));
        const el = box.lastElementChild; el.classList.add('entering'); later(() => el.classList.remove('entering'), 400);
        feed(`${p.name} odaya katıldı 👋`);
      }
      refreshMore();
      scheduleJoinLeave();
    }, 9000 + Math.random() * 14000);

    // Sahte etkinlik: odak dakikaları, ara sıra durum değişimi, molada mesajlar, tepkiler
    const minuteSim = () => { const ph = phase(r); s.people.forEach(p => { if (p.status === 'focus' && ph.focus) p.mins++; }); redrawPeople(); };
    const chatter = () => later(() => {
      const ph = phase(r);
      if (!ph.focus && Math.random() < .75) addMsg(fakeMsg());
      if (Math.random() < .35) fly(pick(['👏', '🔥', '💪']), true);
      if (ph.focus && Math.random() < .25 && s.people.length) { const p = pick(s.people); p.status = p.status === 'focus' ? 'away' : 'focus'; redrawPeople(); }
      chatter();
    }, 6000 + Math.random() * 8000);

    function fly(emo, other) {
      const box = $('rm-fly'); if (!box) return;
      const sp = document.createElement('span'); sp.className = 'rm-fly-e' + (other ? ' other' : ''); sp.textContent = emo;
      sp.style.left = (10 + Math.random() * 75) + '%';
      box.appendChild(sp); later(() => sp.remove(), reduced() ? 900 : 1300);
    }

    // Etkileşimler
    $('rm-leave').onclick = () => {
      const ph = phase(r);
      const go = () => { App.go('/rooms'); App.toast('Odadan ayrıldın. Görüşmek üzere 👋'); };
      if (ph.focus && Date.now() - s.joinedAt > MIN) App.confirm('Odak turu sürüyor. Şimdi ayrılırsan bu tur pomodoro olarak sayılmaz.', go); else go();
    };
    $('rm-topic').onchange = (e) => { App.me().roomTopic = e.target.value || null; App.save(); feed(`Konun güncellendi: ${myTopicText()}`); };
    $('rm-send').onsubmit = (e) => {
      e.preventDefault(); if (phase(r).focus) return;
      const inp = $('rm-msg'); const v = inp.value.trim(); if (!v) return;
      const u = App.user; addMsg({ me: true, name: u.name.split(' ')[0], avatar: u.avatar, color: 'var(--primary)', text: v }); inp.value = '';
      if (Math.random() < .6) later(() => { if (!phase(r).focus) addMsg(fakeMsg()); }, 2500 + Math.random() * 3000);
    };
    document.querySelectorAll('[data-react]').forEach(b => b.onclick = () => fly(b.dataset.react, false));

    $('rm-msgs').scrollTop = 1e6;
    refreshMore(); updGoal(); tick(); later(tick, 30);
    every(tick, 1000);
    every(minuteSim, MIN);
    every(() => { driftCounts(); const L = liveOf(r); L.count = Math.max(L.count, 1 + s.people.length); refreshMore(); updGoal(); }, 5000);
    scheduleJoinLeave(); chatter();
    later(() => feed(`${r.name} odasına katıldın. İyi çalışmalar!`), 300);
  }

  App.route('/rooms', listPage, { title: 'Çalışma Odaları', after: listAfter });
  App.route('/rooms/:id', roomPage, { title: 'Çalışma Odası', wide: true, after: roomAfter });
})();
