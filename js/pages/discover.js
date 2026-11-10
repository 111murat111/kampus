// Keşfet (/discover), kurs tanıtım (/course/:id), Kurslarım (/my), Öğrenme Yolları (/paths, /paths/:id).
// Ortak yardımcılar: window.KUI (dashboard.js).
(function () {
  const esc = (s) => App.esc(s);
  const K = () => window.KUI;
  const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');
  const lower = (s) => String(s || '').toLocaleLowerCase('tr-TR');
  const LEVELS = ['Başlangıç', 'Orta', 'İleri'];
  const SORTS = [['popular', 'En popüler'], ['rating', 'En yüksek puan'], ['new', 'En yeni']];
  const MODE_DESC = {
    video: 'Bölüm başlıklarıyla demo oynatıcı; kaldığın saniyeden devam.',
    text: 'Vikipedi maddesinden kısaltılmış, bölümlere ayrılmış metin.',
    mindmap: 'Konuyu kuşbakışı gör, bağlantıları kur.',
    cards: 'Aralıklı tekrarla unutmadan önce hatırla.',
    quiz: 'Kendini sına (sorular İngilizce); yanlışların deftere düşsün.',
    notes: 'Kendi cümlelerinle özetle, kalıcı olsun.'
  };
  const monthYear = (ymd) => new Date(ymd + 'T12:00').toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  const startCourse = (courseId) => {
    const first = App.courseTopics(courseId)[0];
    App.enroll(courseId); App.save();
    App.toast('🎉 Kursa kaydoldun! +20 XP');
    if (first) App.go(`/learn/${courseId}/${first.id}?mode=video`); else App.render();
  };

  // ---------------- Keşfet ----------------
  function filterCourses(st) {
    const q = lower(st.q).trim();
    let list = App.db.courses.map(c => {
      let matchTopics = [];
      if (q) {
        const hay = lower([c.title, c.subtitle, c.instructor, (c.tags || []).join(' '), c.category].join(' '));
        matchTopics = App.courseTopics(c.id).filter(t => lower(t.title).includes(q));
        if (!hay.includes(q) && !matchTopics.length) return null;
      }
      return { c, matchTopics };
    }).filter(Boolean);
    if (st.cat) list = list.filter(x => x.c.category === st.cat);
    if (st.level) list = list.filter(x => x.c.level === st.level);
    const by = { popular: (a, b) => b.c.students - a.c.students, rating: (a, b) => b.c.rating - a.c.rating || b.c.ratingCount - a.c.ratingCount, new: (a, b) => K().updatedOf(b.c).localeCompare(K().updatedOf(a.c)) };
    return list.sort(by[st.sort] || by.popular);
  }

  function gridHTML(st) {
    const list = filterCourses(st);
    const head = `<div class="dsc-count">${st.q ? `<b>“${esc(st.q)}”</b> için ` : ''}${list.length} kurs${st.cat || st.level || st.q ? ' · <button class="dsc-clear" data-clear>Filtreleri temizle</button>' : ''}</div>`;
    if (!list.length) return head + App.emptyState('🔎', 'Bu aramayla eşleşen kurs yok', 'Daha kısa bir kelime dene ya da filtreleri kaldır. Belki aradığın şey başka bir adla duruyordur.', '<button class="btn" data-clear>Tüm kursları göster</button>');
    return head + `<div class="dsc-grid">${list.map(({ c, matchTopics }) => K().courseCard(c, {
      extra: matchTopics.length ? `<div class="dsc-hit">🔎 Konu: ${matchTopics.slice(0, 2).map(t => `<mark>${esc(t.title)}</mark>`).join(', ')}</div>` : ''
    })).join('')}</div>`;
  }

  function pathsStrip() {
    const me = App.me();
    return `<section class="dsc-sec">
      <div class="dsc-sec-head"><div><h2 class="serif">Öğrenme yolları</h2><p class="muted">Ne çalışacağını düşünme — hedefine giden rotayı seç, adım adım ilerle.</p></div><a class="small" href="#/paths">Tüm yollar →</a></div>
      <div class="dsc-paths">${App.db.paths.map(p => {
        const pct = K().pathProgress(p);
        return `<a class="dsc-path" href="#/paths/${p.id}">
          <span class="dsc-path-e">${p.emoji}</span>
          <b class="serif">${esc(p.title)}</b>
          <small class="muted">${esc(p.desc)}</small>
          <span class="dsc-path-steps">${p.steps.map(s => { const c = App.course(s.courseId); return c ? `<i style="--c:${c.color}" title="${esc(c.title)}">${c.emoji}</i>` : ''; }).join('<em>→</em>')}</span>
          <span class="dsc-path-f">${me.activePath === p.id ? '<span class="tag accent">Takip ediyorsun</span>' : `<span class="muted small">${p.steps.length} adım</span>`}<span class="small">%${pct}</span></span>
        </a>`;
      }).join('')}</div>
    </section>`;
  }

  App.route('/discover', () => {
    const qy = App.query(); const st = { q: qy.q || '', cat: qy.cat || '', level: qy.level || '', sort: qy.sort || 'popular' };
    const cats = App.db.categories;
    // Popüler aramalar: her kurstan ilk konunun başlığı (katalogdan dinamik).
    const popularTopics = App.db.courses.map(c => App.courseTopics(c.id)[0]).filter(Boolean).map(t => t.title).filter(t => t.length <= 22).slice(0, 5);
    const sample = lower((App.db.topics[1] || App.db.topics[0] || { title: 'konu' }).title);
    return `<div class="dsc">
      <section class="dsc-hero">
        <div class="dsc-hero-t">
          <div class="dsc-eyebrow">Keşfet</div>
          <h1 class="dsc-h1">Bugün ne öğrenmek <em>istersin?</em></h1>
          <p class="muted">${App.db.courses.length} kurs, ${App.db.topics.length} konu. Hepsi ücretsiz, hepsi 6 farklı yolla çalışılabilir.</p>
          <form class="dsc-search" id="dsc-search" role="search">
            <span aria-hidden="true">🔎</span>
            <input name="q" type="search" aria-label="Kurs ya da konu ara" value="${esc(st.q)}" placeholder="Kurs ya da konu ara… (ör. “${esc(sample)}”)" autocomplete="off">
            <button class="btn primary" type="submit">Ara</button>
          </form>
          <div class="dsc-pop"><span class="muted small">Popüler:</span>${popularTopics.map(t => `<button class="dsc-pop-b" data-q="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        </div>
      </section>
      <div class="dsc-filters">
        <div class="dsc-chips" role="group" aria-label="Kategori">
          <button class="dsc-chip ${!st.cat ? 'on' : ''}" data-cat="" aria-pressed="${!st.cat}">Tümü</button>
          ${cats.map(c => `<button class="dsc-chip ${st.cat === c.id ? 'on' : ''}" data-cat="${c.id}" aria-pressed="${st.cat === c.id}"><span aria-hidden="true">${c.emoji}</span> ${esc(c.name)}</button>`).join('')}
        </div>
        <div class="dsc-filters-r">
          <div class="tabs dsc-level" role="group" aria-label="Seviye">${['', ...LEVELS].map(l => `<button class="tab ${st.level === l ? 'active' : ''}" data-level="${l}" aria-pressed="${st.level === l}">${l || 'Tüm seviyeler'}</button>`).join('')}</div>
          <label class="dsc-sort"><span class="muted small">Sırala</span><select id="dsc-sort">${SORTS.map(([v, l]) => `<option value="${v}" ${st.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        </div>
      </div>
      <div id="dsc-results">${gridHTML(st)}</div>
      ${pathsStrip()}
    </div>`;
  }, {
    title: 'Keşfet',
    after() {
      const qy = App.query(); const st = { q: qy.q || '', cat: qy.cat || '', level: qy.level || '', sort: qy.sort || 'popular' };
      const root = document.querySelector('.dsc'); const res = root.querySelector('#dsc-results');
      const input = root.querySelector('#dsc-search input');
      const sync = () => {
        const p = new URLSearchParams(); Object.entries(st).forEach(([k, v]) => { if (v && !(k === 'sort' && v === 'popular')) p.set(k, v); });
        const s = p.toString(); history.replaceState(null, '', location.pathname + location.search + '#/discover' + (s ? '?' + s : ''));
        root.querySelectorAll('[data-cat]').forEach(b => { b.classList.toggle('on', b.dataset.cat === st.cat); b.setAttribute('aria-pressed', String(b.dataset.cat === st.cat)); });
        root.querySelectorAll('[data-level]').forEach(b => { b.classList.toggle('active', b.dataset.level === st.level); b.setAttribute('aria-pressed', String(b.dataset.level === st.level)); });
        res.innerHTML = gridHTML(st); bindRes(); K().animateIn(res);
      };
      const bindRes = () => res.querySelectorAll('[data-clear]').forEach(b => b.onclick = () => { st.q = ''; st.cat = ''; st.level = ''; input.value = ''; sync(); });
      bindRes(); K().animateIn(res);
      let tm; input.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { st.q = input.value.trim(); sync(); }, 180); };
      App.onLeave(() => clearTimeout(tm));
      root.querySelector('#dsc-search').onsubmit = (e) => { e.preventDefault(); st.q = input.value.trim(); sync(); res.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      root.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { input.value = b.dataset.q; st.q = b.dataset.q; sync(); });
      root.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { st.cat = b.dataset.cat; sync(); });
      root.querySelectorAll('[data-level]').forEach(b => b.onclick = () => { st.level = b.dataset.level; sync(); });
      root.querySelector('#dsc-sort').onchange = (e) => { st.sort = e.target.value; sync(); };
      const gs = document.querySelector('#global-search input'); if (gs && st.q) gs.value = st.q;
    }
  });

  // ---------------- Kurs tanıtım ----------------
  const REVIEWS = [
    { name: 'Melis A.', av: 'MA', r: 5, d: '2 hafta önce', t: () => 'Konu anlatımını okuyup zihin haritasına bakmak, sonra kartlarla tekrar etmek konuyu gerçekten oturttu.' },
    { name: 'Oğuz T.', av: 'OT', r: 5, d: '1 ay önce', t: () => 'Konu testlerinden sonra yanlışlarımın deftere düşmesi harika. Denemede aynı hataları yapmadım.' },
    { name: 'Defne Y.', av: 'DY', r: 4, d: '3 hafta önce', t: () => 'Okumayı sevdiğim için konu anlatımı modu tam bana göre. Bazı konularda metin kısa kalıyor.' },
    { name: 'Kerem B.', av: 'KB', r: 5, d: '5 gün önce', t: () => 'Her gün 30 dakika ayırarak ilerliyorum, seri sayacı beni motive ediyor. Kesinlikle tavsiye ederim.' }
  ];

  function curriculum(c) {
    const me = App.me(); const enrolled = App.isEnrolled(c.id);
    let n = 0;
    return c.units.map((u, ui) => {
      const ts = u.topics.map(App.topic).filter(Boolean);
      const doneN = ts.filter(t => me.done[t.id]).length;
      return `<details class="dsc-unit" ${ui === 0 || ts.some(t => me.last && me.last.topicId === t.id) ? 'open' : ''}>
        <summary><span class="dsc-unit-chev">›</span><b>${esc(u.title)}</b><span class="muted small">${ts.length} konu${enrolled ? ` · ${doneN}/${ts.length} tamam` : ''}</span></summary>
        <ul class="dsc-topics">${ts.map(t => {
          n++; const modes = me.modes[t.id] || []; const done = me.done[t.id]; const cur = me.last && me.last.topicId === t.id;
          return `<li><a class="dsc-topic ${done ? 'done' : ''} ${cur ? 'cur' : ''}" href="${K().learnHref(c.id, t.id)}" data-topic="${t.id}">
            <span class="dsc-topic-n">${done ? '✓' : n}</span>
            <span class="dsc-topic-t"><b>${esc(t.title)}</b>${cur ? '<small class="tag accent">Kaldığın yer</small>' : ''}</span>
            <span class="dsc-topic-m">${App.MODES.map(m => `<i class="${modes.includes(m.id) ? 'on' : ''}" title="${m.label}${modes.includes(m.id) ? ' ✓' : ''}">${m.icon}</i>`).join('')}</span>
            <span class="dsc-topic-d">${esc(t.duration)}</span>
          </a></li>`;
        }).join('')}</ul>
      </details>`;
    }).join('');
  }

  App.route('/course/:id', ({ id }) => {
    const c = App.course(id);
    if (!c) return App.emptyState('🧭', 'Kurs bulunamadı', 'Bu kurs kaldırılmış ya da adres yanlış olabilir.', '<a class="btn primary" href="#/discover">Keşfete dön</a>');
    const me = App.me(); const enrolled = App.isEnrolled(id); const ts = App.courseTopics(id);
    const p = App.courseProgress(id); const nx = K().nextTopic(id);
    const cat = App.db.categories.find(x => x.id === c.category);
    const nQ = ts.reduce((s, t) => s + t.questions.length, 0), nCards = ts.reduce((s, t) => s + t.cards.length, 0);
    const paths = App.db.paths.filter(pp => pp.steps.some(s => s.courseId === id));
    const side = `<aside class="dsc-buy">
      ${K().cover(c, 'big')}
      <div class="dsc-buy-b">
        ${enrolled ? `
          <div class="dsc-buy-prog">${App.ring(p, 76, 7)}<div><b class="serif">%${p} tamamlandı</b><small class="muted">${ts.filter(t => me.done[t.id]).length}/${ts.length} konu · ${p >= 100 ? 'Tebrikler! 🎓' : 'Harika gidiyorsun'}</small></div></div>
          ${nx ? `<a class="btn primary dsc-buy-cta" href="${K().learnHref(id, nx.topic.id, nx.mode)}">▶ ${nx.resumed ? 'Devam et' : 'Sıradaki konu'}</a><p class="small muted dsc-buy-next">${esc(nx.topic.title)} · ${K().modeOf(nx.mode).icon} ${K().modeOf(nx.mode).label}</p>` : ''}
        ` : `
          <div class="dsc-price"><b class="serif">Ücretsiz</b><span class="muted small">Sınırsız erişim</span></div>
          <button class="btn primary dsc-buy-cta" id="dsc-enroll">Ücretsiz kaydol ve başla</button>
          <p class="small muted dsc-buy-next">Kaydolunca ilk konu açılır · +20 XP</p>
        `}
        <ul class="dsc-incl">
          <li>📚 ${ts.length} konu, ${c.units.length} ünite · yaklaşık ${c.hours} saat</li><li>📄 Vikipedi kaynaklı konu anlatımı</li>
          <li>📝 ${nQ} test sorusu (İngilizce)</li><li>🃏 ${nCards} bilgi kartı</li><li>🗺️ Her konuya zihin haritası</li><li>🎬 Demo video oynatıcı (gerçek video yok)</li>
        </ul>
      </div>
    </aside>`;
    return `<div class="dsc dsc-course">
      <section class="dsc-band">
        ${App.breadcrumbs([['Keşfet', '/discover'], [cat ? cat.name : 'Kurs', '/discover?cat=' + c.category], [c.title.split(':')[0], '']])}
        <h1 class="dsc-band-t">${esc(c.title)}</h1>
        <p class="dsc-band-s">${esc(c.subtitle)}</p>
        <div class="dsc-band-m">
          ${c.rating >= 4.8 ? '<span class="dsc-best">En çok tercih edilen</span>' : ''}
          <span class="dsc-rate"><b>${c.rating.toFixed(1).replace('.', ',')}</b><span class="dsc-stars">${App.stars(c.rating)}</span><span>(${fmt(c.ratingCount)} değerlendirme)</span></span>
          <span>👥 ${fmt(c.students)} öğrenci</span>
        </div>
        <div class="dsc-band-m dsc-band-m2"><span>Kaynak: <b>${esc(c.instructor)}</b></span><span>🗓 Son güncelleme ${monthYear(K().updatedOf(c))}</span><span>📊 ${esc(c.level)}</span><span>Türkçe anlatım · İngilizce sorular</span></div>
      </section>
      <div class="dsc-course-main">
        <section class="card dsc-outcomes">
          <h2 class="serif">Neler öğreneceksin</h2>
          <ul>${c.outcomes.map(o => `<li><span>✓</span>${esc(o)}</li>`).join('')}</ul>
        </section>
        <section class="dsc-block">
          <h2 class="serif">Her konu, 6 farklı yolla</h2>
          <p class="muted">Herkes aynı şekilde öğrenmez. Konuyu sana uyan yollardan çalış; <b>notlar hariç 3 farklı yolu</b> tamamladığında konu “tamamlandı” sayılır.</p>
          <div class="dsc-modes">${App.MODES.map(m => `<div class="dsc-mode"><span>${m.icon}</span><b>${m.label}</b><small class="muted">${MODE_DESC[m.id] || ''}</small></div>`).join('')}</div>
        </section>
        <section class="dsc-block">
          <div class="row between dsc-curr-head"><h2 class="serif">Müfredat</h2><span class="muted small">${c.units.length} ünite · ${ts.length} konu · ${c.hours} saat</span></div>
          <div class="dsc-curr">${curriculum(c)}</div>
        </section>
        ${paths.length ? `<section class="dsc-block"><h2 class="serif">Bu kurs şu yollarda</h2><div class="dsc-inpaths">${paths.map(pp => { const i = pp.steps.findIndex(s => s.courseId === id); return `<a class="card dsc-inpath" href="#/paths/${pp.id}"><span>${pp.emoji}</span><div><b>${esc(pp.title)}</b><small class="muted">${pp.steps.length} adımın ${i + 1}.si · ${esc(pp.steps[i].note)}</small></div><em>→</em></a>`; }).join('')}</div></section>` : ''}
        <section class="dsc-block">
          <div class="row between"><h2 class="serif">Öğrenciler ne diyor</h2><span class="tag" title="Bu yorumlar gerçek kullanıcılara ait değildir">demo yorum</span></div>
          <p class="small muted dsc-demo-note">Aşağıdaki yorumlar, puanlar ve öğrenci sayıları prototip için yazılmış örneklerdir; gerçek kullanıcılara ait değildir.</p>
          <div class="dsc-reviews">${REVIEWS.map(r => `<figure class="card dsc-review"><div class="row">${App.avatar({ avatar: r.av }, 36)}<div><b>${r.name}</b> <span class="tag dsc-demo-tag">demo yorum</span><div class="small"><span class="dsc-stars">${App.stars(r.r)}</span> <span class="muted">${r.d}</span></div></div></div><blockquote>${esc(r.t(c))}</blockquote></figure>`).join('')}</div>
        </section>
        <section class="card dsc-instructor"><span class="dsc-ins-av serif" aria-hidden="true">W</span><div><div class="dsc-eyebrow">İçerik kaynağı</div><h3 class="serif">${esc(c.instructor)}</h3><p class="muted small">Bu kursun konu metinleri Türkçe Vikipedi maddelerinden kısaltılarak alınır; zihin haritaları ve kartlar aynı maddelerden otomatik türetilir. Sorular Open Trivia DB’den gelir. Lisans: CC BY-SA 4.0. <a href="#/sources">Kaynaklar ve lisanslar →</a></p></div></section>
      </div>
      ${side}
    </div>`;
  }, {
    title: 'Kurs',
    after({ id }) {
      const root = document.querySelector('.dsc-course'); if (!root) return;
      K().animateIn(root);
      const c = App.course(id); if (c) document.title = c.title.split(':')[0] + ' · Kampüs';
      const b = root.querySelector('#dsc-enroll'); if (b) b.onclick = () => startCourse(id);
      if (!App.isEnrolled(id)) root.querySelectorAll('[data-topic]').forEach(a => a.onclick = (e) => {
        e.preventDefault();
        App.modal({ title: 'Önce kaydolalım', body: `<p>Bu konuyu çalışmak için kursa ücretsiz kaydolman yeterli. İlerlemen, notların ve kartların kaydedilir.</p>`, actions: [{ label: 'Şimdi değil' }, { label: 'Ücretsiz kaydol', primary: true, onClick: (close) => { close(); App.enroll(id); App.save(); App.toast('🎉 Kursa kaydoldun! +20 XP'); App.go(`/learn/${id}/${a.dataset.topic}?mode=video`); } }] });
      });
    }
  });

  // ---------------- Kurslarım ----------------
  App.route('/my', () => {
    const me = App.me(); const cs = App.myCourses();
    if (!cs.length) return `<div class="dsc">${App.emptyState('📚', 'Henüz bir kursa kaydolmadın', 'Hedefine uygun bir kurs seç — hepsi ücretsiz. İlk konuyu bugün bitirmek sadece 15 dakika.', '<a class="btn primary" href="#/discover">🧭 Kursları keşfet</a>')}</div>`;
    const done = cs.filter(c => App.courseProgress(c.id) >= 100).length;
    const rows = cs.slice().sort((a, b) => (me.last && me.last.courseId === b.id) - (me.last && me.last.courseId === a.id)).map(c => {
      const p = App.courseProgress(c.id); const nx = K().nextTopic(c.id); const ts = App.courseTopics(c.id);
      return `<article class="card dsc-my">
        <a href="#/course/${c.id}" class="dsc-my-cover">${K().cover(c, 'sm')}</a>
        <div class="dsc-my-b">
          <a href="#/course/${c.id}" class="dsc-my-t"><h3 class="serif">${esc(c.title)}</h3></a>
          <div class="muted small">${esc(c.instructor)} · ${ts.filter(t => me.done[t.id]).length}/${ts.length} konu tamamlandı</div>
          <div class="dsc-my-p">${App.progressBar(p, c.color)}<b>%${p}</b></div>
          ${nx ? `<div class="small dsc-my-next">${nx.resumed ? '⏯ Son çalıştığın' : '➜ Sıradaki'}: <b>${esc(nx.topic.title)}</b> <span class="muted">· ${K().modeOf(nx.mode).icon} ${K().modeOf(nx.mode).label}</span></div>` : ''}
        </div>
        <div class="dsc-my-a">
          ${nx ? `<a class="btn primary" href="${K().learnHref(c.id, nx.topic.id, nx.mode)}">▶ ${p > 0 || nx.resumed ? 'Devam et' : 'Başla'}</a>` : ''}
          <a class="btn ghost sm" href="#/course/${c.id}">Müfredat</a>
        </div>
      </article>`;
    }).join('');
    return `<div class="dsc">
      <header class="page-head"><div><h1>Kurslarım</h1><p class="muted">${cs.length} kurs · ${done} tamamlandı · ortalama %${Math.round(cs.reduce((s, c) => s + App.courseProgress(c.id), 0) / cs.length)}</p></div><a class="btn" href="#/discover">+ Yeni kurs keşfet</a></header>
      <div class="stack dsc-my-list">${rows}</div>
    </div>`;
  }, { title: 'Kurslarım', after() { K().animateIn(document.querySelector('.dsc')); } });

  // ---------------- Öğrenme yolları ----------------
  App.route('/paths', () => {
    const me = App.me();
    return `<div class="dsc">
      <header class="page-head"><div><h1>Öğrenme Yolları</h1><p class="muted">Hedefine giden rota hazır. Bir yol seç, sıradaki adım hep belli olsun.</p></div></header>
      <div class="dsc-plist">${App.db.paths.map(p => {
        const pct = K().pathProgress(p); const active = me.activePath === p.id;
        const hours = p.steps.reduce((s, st) => s + ((App.course(st.courseId) || {}).hours || 0), 0);
        return `<a class="card dsc-pcard ${active ? 'active' : ''}" href="#/paths/${p.id}">
          <div class="dsc-pcard-top"><span class="dsc-pcard-e">${p.emoji}</span>${active ? '<span class="tag accent">Takip ediyorsun</span>' : ''}</div>
          <h2 class="serif">${esc(p.title)}</h2>
          <p class="muted">${esc(p.desc)}</p>
          <ol class="dsc-pcard-steps">${p.steps.map(s => { const c = App.course(s.courseId); const cp = App.courseProgress(s.courseId); return c ? `<li class="${cp >= 100 ? 'done' : ''}"><i style="--c:${c.color}">${c.emoji}</i><span>${esc(c.title.split(':')[0])}</span><small class="muted">%${cp}</small></li>` : ''; }).join('')}</ol>
          <div class="dsc-pcard-f"><span class="muted small">${p.steps.length} adım · ${hours} saat</span><span class="dsc-pcard-pct"><span>${App.ring(pct, 40, 4, 'var(--primary)')}</span><b>%${pct}</b></span></div>
        </a>`;
      }).join('')}</div>
    </div>`;
  }, { title: 'Öğrenme Yolları', after() { K().animateIn(document.querySelector('.dsc')); } });

  App.route('/paths/:id', ({ id }) => {
    const p = App.path(id);
    if (!p) return App.emptyState('🛤️', 'Yol bulunamadı', '', '<a class="btn" href="#/paths">Tüm yollar</a>');
    const me = App.me(); const active = me.activePath === id; const pct = K().pathProgress(p);
    const activeIdx = p.steps.findIndex(s => App.courseProgress(s.courseId) < 100);
    const hours = p.steps.reduce((s, st) => s + ((App.course(st.courseId) || {}).hours || 0), 0);
    const steps = p.steps.map((s, i) => {
      const c = App.course(s.courseId); if (!c) return '';
      const cp = App.courseProgress(c.id); const enrolled = App.isEnrolled(c.id);
      const st = cp >= 100 ? 'done' : i === activeIdx ? 'active' : 'locked';
      const nx = enrolled ? K().nextTopic(c.id) : null;
      const label = st === 'done' ? 'Tamamlandı' : st === 'active' ? 'Şu anki adım' : 'Sırada';
      return `<li class="dsc-stop ${st}">
        <span class="dsc-node">${st === 'done' ? '✓' : i + 1}</span>
        <div class="card dsc-stop-c">
          <div class="dsc-stop-h"><span class="dsc-stop-ic" style="--c:${c.color}">${c.emoji}</span><div><div class="dsc-stop-lbl">${i + 1}. adım · ${label}</div><h3 class="serif"><a href="#/course/${c.id}">${esc(c.title)}</a></h3><p class="muted small">${esc(s.note)} · ${c.hours} saat · ${App.courseTopics(c.id).length} konu</p></div></div>
          ${enrolled ? `<div class="dsc-stop-p">${App.progressBar(cp, st === 'done' ? 'var(--primary)' : c.color)}<b>%${cp}</b></div>` : ''}
          <div class="row dsc-stop-a">
            ${enrolled ? (nx && cp < 100 ? `<a class="btn ${st === 'active' ? 'primary' : ''} sm" href="${K().learnHref(c.id, nx.topic.id, nx.mode)}">▶ ${cp > 0 ? 'Devam et' : 'Başla'}</a>` : `<a class="btn sm" href="#/course/${c.id}">Kursa git</a>`) : `<button class="btn ${st === 'active' ? 'primary' : ''} sm" data-enroll="${c.id}">Ücretsiz kaydol</button>`}
            ${st === 'locked' && !enrolled ? '<span class="muted small">Önceki adımı bitirmen önerilir</span>' : ''}
          </div>
        </div>
      </li>`;
    }).join('');
    return `<div class="dsc dsc-pathd">
      ${App.breadcrumbs([['Öğrenme Yolları', '/paths'], [p.title, '']])}
      <header class="dsc-pathd-head">
        <span class="dsc-pathd-e">${p.emoji}</span>
        <div class="dsc-pathd-t"><h1>${esc(p.title)}</h1><p class="muted">${esc(p.desc)}</p>
          <div class="dsc-pathd-m"><span>🛤️ ${p.steps.length} adım</span><span>⏱ ${hours} saat</span><span>📈 %${pct} tamamlandı</span></div></div>
        <div class="dsc-pathd-cta">${active ? `<span class="tag accent">✓ Bu yolu takip ediyorsun</span><button class="btn ghost sm" id="dsc-unfollow">Takibi bırak</button>` : `<button class="btn primary" id="dsc-follow">Bu yolu takip et</button><small class="muted">Panonda sıradaki adımı gösteririz</small>`}</div>
      </header>
      <div class="dsc-pathd-bar">${App.progressBar(pct)}</div>
      <ol class="dsc-metro">${steps}<li class="dsc-stop finish ${pct >= 100 ? 'done' : ''}"><span class="dsc-node">🏁</span><div class="dsc-finish"><b class="serif">Hedef</b><span class="muted small">${pct >= 100 ? 'Tebrikler, yolu tamamladın!' : 'Tüm adımları bitirince burada olacaksın.'}</span></div></li></ol>
    </div>`;
  }, {
    title: 'Öğrenme Yolu',
    after({ id }) {
      const root = document.querySelector('.dsc-pathd'); if (!root) return;
      K().animateIn(root);
      const f = root.querySelector('#dsc-follow'); if (f) f.onclick = () => { App.me().activePath = id; App.save(); App.toast('🛤️ Yol takip ediliyor. Panonda seni bekliyor!'); App.render(); };
      const u = root.querySelector('#dsc-unfollow'); if (u) u.onclick = () => { App.me().activePath = null; App.save(); App.toast('Yol takibi bırakıldı'); App.render(); };
      root.querySelectorAll('[data-enroll]').forEach(b => b.onclick = () => { App.enroll(b.dataset.enroll); App.save(); App.toast('🎉 Kursa kaydoldun! +20 XP'); App.render(); });
    }
  });
})();
