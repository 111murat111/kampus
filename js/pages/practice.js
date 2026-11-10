// Test Merkezi: soru bankası, deneme sınavları, sonuçlar, yanlışlarım, eksik konu analizi (pr-).
(function () {
  const esc = (s) => App.esc(s);
  // Şık harfleri: sorular 2 (True/False) ya da 4 şıklı olabilir; harf ve kısayollar şık sayısına göre çalışır.
  const L = 'ABCDEFGH';
  const lastL = (q) => L[Math.max(1, Math.min(L.length, q.options.length)) - 1];
  // Klavye tuşu → şık sırası (A/B/… ya da 1/2/…); soruda o şık yoksa -1.
  const keyIdx = (k, q) => { let i = k.length === 1 ? L.indexOf(k) : -1; if (i < 0 && /^[1-9]$/.test(k)) i = +k - 1; return i >= 0 && q && i < q.options.length ? i : -1; };
  const qNote = () => (window.KUI && window.KUI.questionNote ? window.KUI.questionNote() : '');
  // Deneme puanı: doğru sayısı. Yanlışlar puan düşürmez (kayıttaki `net` alanı geriye dönük uyum için durur, arayüzde kullanılmaz).
  const examTotal = (e) => e.correct + e.wrong + e.empty;
  const examPct = (e) => pctOf(e.correct, examTotal(e));
  const safeColor = (c) => /^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : 'var(--primary)';
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pctOf = (c, t) => t ? Math.round(c / t * 100) : 0;
  const mmss = (sec) => { sec = Math.max(0, Math.ceil(sec)); return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); };
  const isTyping = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable || document.querySelector('#modal-root .modal');

  // ---- Isı rengi: kiremit → hardal → yeşil ----
  const STOPS = [[0, [180, 71, 47]], [55, [200, 146, 44]], [85, [47, 125, 79]], [100, [30, 91, 67]]];
  function heatRGB(p) {
    for (let i = 1; i < STOPS.length; i++) {
      const [p1, c1] = STOPS[i]; const [p0, c0] = STOPS[i - 1];
      if (p <= p1) { const k = (p - p0) / (p1 - p0); return c0.map((v, j) => Math.round(v + (c1[j] - v) * k)); }
    }
    return STOPS[STOPS.length - 1][1];
  }
  const heat = (p, a = 1) => { const c = heatRGB(Math.max(0, Math.min(100, p))); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  const heatLabel = (p) => p < 50 ? 'Zayıf' : p < 75 ? 'Gelişiyor' : 'Sağlam';

  // ---- Eksik konu analizi (focus.js de kullanır) ----
  function topicStats() {
    const me = App.me(); const m = {};
    const add = (tid, src, c, t) => {
      if (!t || !App.topic(tid)) return;
      const o = m[tid] = m[tid] || { topicId: tid, quiz: { c: 0, t: 0 }, exam: { c: 0, t: 0 }, bank: { c: 0, t: 0 }, c: 0, t: 0 };
      o[src].c += c; o[src].t += t; o.c += c; o.t += t;
    };
    Object.entries(me.quizResults || {}).forEach(([tid, r]) => add(tid, 'quiz', r.score, r.total));
    (me.exams || []).slice(-5).forEach(e => Object.entries(e.byTopic || {}).forEach(([tid, r]) => add(tid, 'exam', r.c, r.t)));
    Object.entries(me.bankStats || {}).forEach(([tid, r]) => add(tid, 'bank', r.c, r.t));
    return Object.values(m).map(o => {
      const topic = App.topic(o.topicId);
      return { ...o, topic, course: App.course(topic.courseId), pct: pctOf(o.c, o.t) };
    }).sort((a, b) => a.pct - b.pct || b.t - a.t);
  }
  window.KampusPractice = { topicStats };

  const wrongCount = () => (App.me().wrongs || []).filter(k => App.question(k)).length;

  function bump(map, tid, ok) { const r = map[tid] = map[tid] || { c: 0, t: 0 }; r.t++; if (ok) r.c++; }

  // ================= 1. TEST MERKEZİ =================
  function hub() {
    const me = App.me(); const wc = wrongCount();
    const stats = topicStats(); const weak = stats.filter(s => s.pct < 75).slice(0, 3);
    const lastExam = (me.exams || []).slice(-1)[0];
    const enrolledQ = me.enrolled.reduce((n, cid) => n + App.allQuestions(cid).length, 0);
    const cell = (r) => r.t ? `<td class="pr-hcell" style="--h:${heat(pctOf(r.c, r.t), .2)};--hs:${heat(pctOf(r.c, r.t))}"><b>%${pctOf(r.c, r.t)}</b><small>${r.c}/${r.t}</small></td>` : `<td class="pr-hcell pr-hnone">—</td>`;
    return `
    <div class="pr-head">
      <div><div class="pr-eyebrow">Test Merkezi</div><h1>Bugün kaç soru çözüyoruz?</h1>
      <p class="muted">Çöz, yanlışını gör, eksiğini kapat. Her doğru cevap seni hedefe bir adım yaklaştırır.</p></div>
    </div>
    <div class="pr-entry-grid">
      <a class="pr-entry" href="#/practice/bank">
        <span class="pr-entry-ic">🧮</span>
        <span class="pr-entry-t">Soru Bankası</span>
        <span class="pr-entry-d">Kurs, konu ve zorluğa göre kendi testini oluştur. Anında çözüm ve açıklama.</span>
        <span class="pr-entry-f"><span class="tag">${enrolledQ} soru kurslarında</span><span class="pr-go">Test oluştur →</span></span>
      </a>
      <a class="pr-entry" href="#/practice/exams">
        <span class="pr-entry-ic">⏱️</span>
        <span class="pr-entry-t">Denemeler</span>
        <span class="pr-entry-d">Süreli deneme. Optik form, doğru sayısı ve konu analizi.</span>
        <span class="pr-entry-f"><span class="tag">${lastExam ? 'Son deneme: %' + examPct(lastExam) : App.db.exams.length + ' deneme hazır'}</span><span class="pr-go">Denemeye gir →</span></span>
      </a>
      <a class="pr-entry pr-entry-err" href="#/wrongs">
        <span class="pr-entry-ic">🔁</span>
        <span class="pr-entry-t">Yanlışlarım ${wc ? `<span class="pr-count">${wc}</span>` : ''}</span>
        <span class="pr-entry-d">${wc ? 'Yanlış yaptığın sorular burada bekliyor. Doğru çözdükçe listeden düşer.' : 'Listen tertemiz. Yeni test çözdükçe hataların burada toplanır.'}</span>
        <span class="pr-entry-f"><span class="tag ${wc ? 'err' : 'ok'}">${wc ? wc + ' soru tekrar bekliyor' : 'Hiç yanlış yok'}</span><span class="pr-go">${wc ? 'Tekrar çöz →' : 'Göz at →'}</span></span>
      </a>
    </div>

    <section class="card pr-analysis">
      <div class="card-head"><div><h2 class="serif">Eksik konu analizi</h2>
        <p class="muted small" style="margin:0">Konu testleri, son 5 deneme ve soru bankası sonuçlarından hesaplanır.</p></div>
        <div class="pr-legend"><span style="--c:${heat(20)}">Zayıf</span><span style="--c:${heat(60)}">Gelişiyor</span><span style="--c:${heat(90)}">Sağlam</span></div></div>
      ${stats.length ? `
      ${weak.length ? `<div class="pr-weak-grid">${weak.map((s, i) => `
        <div class="pr-weak" style="--hs:${heat(s.pct)}">
          <div class="pr-weak-top"><span class="pr-weak-rank">${i + 1}</span><span class="small muted">${esc(s.course.title.split(':')[0])}</span><b class="pr-weak-pct">%${s.pct}</b></div>
          <div class="pr-weak-t">${esc(s.topic.title)}</div>
          <div class="pr-bar"><span style="width:${s.pct}%;background:var(--hs)"></span></div>
          <div class="pr-weak-act">
            <a class="btn sm primary" href="#/learn/${esc(s.course.id)}/${esc(s.topicId)}?mode=text">📄 Bu konuyu çalış</a>
            <a class="btn sm" href="#/practice/bank?course=${esc(s.course.id)}&topic=${esc(s.topicId)}">Bu konudan soru çöz</a>
          </div>
        </div>`).join('')}</div>` : `<div class="notice ok">Tüm konularda %75’in üzerindesin. Şimdi bir deneme ile kendini sına! <a href="#/practice/exams">Denemelere git →</a></div>`}
      <div class="table-wrap"><table class="table pr-heat">
        <thead><tr><th>Konu</th><th>Konu testi</th><th>Denemeler</th><th>Soru bankası</th><th>Genel</th><th></th></tr></thead>
        <tbody>${stats.map(s => `<tr>
          <td><a href="#/learn/${esc(s.course.id)}/${esc(s.topicId)}?mode=text" class="pr-heat-t"><span class="dot" style="background:${safeColor(s.course.color)}"></span>${esc(s.topic.title)}</a><div class="small muted">${esc(s.course.title.split(':')[0])}</div></td>
          ${cell(s.quiz)}${cell(s.exam)}${cell(s.bank)}
          <td class="pr-hcell pr-hmain" style="--h:${heat(s.pct, .28)};--hs:${heat(s.pct)}"><b>%${s.pct}</b><small>${heatLabel(s.pct)}</small></td>
          <td><a class="btn sm ghost" href="#/practice/bank?course=${esc(s.course.id)}&topic=${esc(s.topicId)}" title="Bu konudan soru çöz">Çöz →</a></td>
        </tr>`).join('')}</tbody></table></div>`
      : App.emptyState('📊', 'Henüz veri yok', 'Birkaç soru çöz ya da bir deneme bitir; zayıf konuların burada belirecek.', '<a class="btn primary" href="#/practice/bank">İlk testini başlat</a>')}
    </section>`;
  }

  // ================= 2. SORU BANKASI =================
  let quiz = null; // aktif test durumu

  function bankPage() {
    const q = App.query(); const me = App.me();
    const courses = App.db.courses.slice().sort((a, b) => (me.enrolled.includes(b.id) ? 1 : 0) - (me.enrolled.includes(a.id) ? 1 : 0));
    const courseId = q.course && App.course(q.course) ? q.course : (me.enrolled[0] || courses[0].id);
    return `
    ${App.breadcrumbs([['Test Merkezi', '/practice'], ['Soru Bankası']])}
    <div id="pr-quiz-host">
      <div class="pr-head"><div><h1>Soru Bankası</h1><p class="muted">Kendi testini kur. Her soruda cevabını kontrol edip açıklamayı hemen okuyabilirsin.</p></div></div>
      <div class="pr-bank">
        <form class="card pr-bank-form" id="pr-bank-form">
          <div class="field"><label for="pr-c">Kurs</label>
            <select id="pr-c" name="course">${courses.map(c => `<option value="${esc(c.id)}" ${c.id === courseId ? 'selected' : ''}>${esc(c.emoji)} ${esc(c.title.split(':')[0])}${me.enrolled.includes(c.id) ? '' : ' (kayıtlı değil)'}</option>`).join('')}</select></div>
          <div class="field"><label for="pr-t">Konu</label><select id="pr-t" name="topic"></select></div>
          <div class="field"><label>Zorluk</label>
            <div class="pr-seg" role="radiogroup" aria-label="Zorluk">${[['0', 'Karışık'], ['1', 'Kolay'], ['2', 'Orta'], ['3', 'Zor']].map(([v, l], i) => `<label><input type="radio" name="diff" value="${v}" ${i === 0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
          <div class="field"><label>Soru sayısı</label>
            <div class="pr-seg" role="radiogroup" aria-label="Soru sayısı">${[5, 10, 20].map((n, i) => `<label><input type="radio" name="count" value="${n}" ${i === 1 ? 'checked' : ''}><span>${n} soru</span></label>`).join('')}</div></div>
          <div class="pr-pool" id="pr-pool"></div>
          <button class="btn primary pr-big" id="pr-start" type="submit">Testi başlat →</button>
        </form>
        <aside class="pr-tips card">
          <h3 class="serif">Nasıl çalışır?</h3>
          <ol class="pr-steps">
            <li><b>Seç.</b> Şıkkı tıkla ya da klavyeden şıkkın harfine (<kbd>A</kbd>, <kbd>B</kbd>…) veya sırasına (<kbd>1</kbd>, <kbd>2</kbd>…) bas.</li>
            <li><b>Kontrol et.</b> <kbd>Enter</kbd> ile cevabını gör, açıklamayı oku.</li>
            <li><b>İşaretle.</b> Emin olmadığın soruya 🚩 koy, sonra dön.</li>
            <li><b>Bitir.</b> Yanlışların otomatik olarak <a href="#/wrongs">Yanlışlarım</a>’a eklenir.</li>
          </ol>
          <p class="small muted">İpucu: <kbd>←</kbd> <kbd>→</kbd> ile sorular arasında gezin. Sorular İngilizcedir; iki şıklı (True/False) ya da dört şıklı olabilir.</p>
          ${qNote()}
        </aside>
      </div>
    </div>`;
  }

  function bankAfter() {
    const form = document.getElementById('pr-bank-form'); if (!form) return;
    const q = App.query();
    const fillTopics = (sel) => {
      const ts = App.courseTopics(form.course.value);
      form.topic.innerHTML = `<option value="">Tüm konular</option>` + ts.map(t => `<option value="${esc(t.id)}" ${t.id === sel ? 'selected' : ''}>${esc(t.title)} (${t.questions.length})</option>`).join('');
    };
    const pool = () => {
      const d = +form.diff.value;
      return App.allQuestions(form.course.value).filter(x => (!form.topic.value || x.topicId === form.topic.value) && (!d || x.difficulty === d));
    };
    const upd = () => {
      const n = pool().length, want = +form.count.value;
      document.getElementById('pr-pool').innerHTML = n === 0 ? `<span class="tag err">Bu filtrede soru yok</span> <span class="small muted">Zorluğu “Karışık” yapmayı dene.</span>`
        : n < want ? `<span class="tag accent">Havuzda ${n} soru var</span> <span class="small muted">Test ${n} soruyla başlayacak.</span>`
          : `<span class="tag ok">Havuzda ${n} soru var</span> <span class="small muted">Rastgele ${want} tanesi seçilecek.</span>`;
      document.getElementById('pr-start').disabled = n === 0;
    };
    fillTopics(q.topic); upd();
    form.course.onchange = () => { fillTopics(''); upd(); };
    form.onchange = upd;
    form.onsubmit = (e) => {
      e.preventDefault();
      const qs = shuffle(pool()).slice(0, +form.count.value); if (!qs.length) return;
      const t = form.topic.value ? App.topic(form.topic.value).title : App.course(form.course.value).title.split(':')[0];
      startQuiz(document.getElementById('pr-quiz-host'), qs, { title: t, mode: 'bank' });
    };
    bindQuizKeys();
  }

  // ---- Test motoru (soru bankası + yanlışlarım) ----
  function startQuiz(host, qs, opts) {
    quiz = { host, qs, opts, i: 0, ans: {}, checked: {}, flags: {}, started: Date.now(), done: false };
    host.onclick = onQuizClick;
    drawQuiz(); window.scrollTo(0, 0);
  }
  function drawQuiz() {
    const s = quiz; if (!s || !s.host.isConnected) return;
    const q = s.qs[s.i]; const t = App.topic(q.topicId); const c = App.course(q.courseId);
    const a = s.ans[q.key]; const chk = s.checked[q.key];
    const answered = Object.keys(s.ans).length;
    const dots = s.qs.map((x, i) => {
      const cls = [i === s.i ? 'cur' : '', s.ans[x.key] != null ? 'ans' : '', s.checked[x.key] ? (s.ans[x.key] === x.answer ? 'ok' : 'err') : '', s.flags[x.key] ? 'flag' : ''].join(' ');
      return `<button class="pr-dot ${cls}" data-go="${i}" aria-label="Soru ${i + 1}${s.checked[x.key] ? (s.ans[x.key] === x.answer ? ', doğru' : ', yanlış') : s.ans[x.key] != null ? ', cevaplandı' : ''}${s.flags[x.key] ? ', işaretli' : ''}"${i === s.i ? ' aria-current="step"' : ''}>${i + 1}</button>`;
    }).join('');
    const last = s.i === s.qs.length - 1;
    s.host.innerHTML = `
    <div class="pr-quiz">
      <div class="pr-quiz-top">
        <div><div class="pr-eyebrow">${s.opts.mode === 'wrongs' ? 'Yanlışlarımı tekrar çöz' : 'Soru Bankası'} · ${esc(s.opts.title)}</div>
          <div class="pr-quiz-prog"><b>Soru ${s.i + 1}</b> / ${s.qs.length} <span class="muted">· ${answered} cevaplandı</span></div></div>
        <button class="btn" data-act="finish">Testi bitir</button>
      </div>
      <div class="pr-bar pr-quiz-bar"><span style="width:${(answered / s.qs.length) * 100}%"></span></div>
      <div class="pr-dots">${dots}</div>
      <article class="card pr-q">
        <div class="pr-q-meta"><span class="dot" style="background:${safeColor(c.color)}"></span>${esc(c.title.split(':')[0])} · ${esc(t.title)}
          <span class="pr-diff" title="Zorluk">${'●'.repeat(q.difficulty || 1)}${'○'.repeat(3 - (q.difficulty || 1))}</span>
          <button class="pr-flag ${s.flags[q.key] ? 'on' : ''}" data-act="flag" title="İşaretle (F)">🚩 ${s.flags[q.key] ? 'İşaretli' : 'İşaretle'}</button></div>
        <p class="pr-q-text" lang="en">${esc(q.text)}</p>
        <div class="pr-opts">${q.options.map((o, i) => {
          let cls = a === i ? 'sel' : '';
          if (chk) cls = i === q.answer ? 'ok' : (a === i ? 'err' : 'dim');
          return `<button class="pr-opt ${cls}" data-opt="${i}" ${chk ? 'disabled' : ''}><span class="pr-opt-l">${L[i]}</span><span lang="en">${esc(o)}</span>${chk && i === q.answer ? '<span class="pr-opt-mark">✓ Doğru cevap</span>' : chk && a === i ? '<span class="pr-opt-mark">Senin cevabın</span>' : ''}</button>`;
        }).join('')}</div>
        ${chk ? `<div class="pr-explain ${a === q.answer ? 'ok' : 'err'}"><b>${a === q.answer ? 'Doğru! 🎯' : a == null ? 'Boş bıraktın.' : 'Bu sefer olmadı.'}</b> ${esc(q.explain || '')}
          ${a !== q.answer ? `<div class="small" style="margin-top:6px"><a href="#/learn/${esc(q.courseId)}/${esc(q.topicId)}?mode=text">Konu anlatımına göz at →</a></div>` : ''}</div>` : ''}
        <div class="pr-q-actions">
          <button class="btn" data-act="prev" ${s.i === 0 ? 'disabled' : ''}>← Önceki</button>
          <span class="pr-kbd-hint small muted hide-mobile"><kbd>A</kbd>–<kbd>${lastL(q)}</kbd> seç · <kbd>Enter</kbd> kontrol · <kbd>F</kbd> işaretle</span>
          ${!chk ? `<button class="btn accent" data-act="check">${a == null ? 'Cevabı göster' : 'Kontrol et'}</button>` : ''}
          ${last ? `<button class="btn primary" data-act="finish">Testi bitir ✓</button>` : `<button class="btn primary" data-act="next">Sonraki →</button>`}
        </div>
      </article>
      ${qNote()}
    </div>`;
  }
  function onQuizClick(e) {
    const s = quiz; if (!s || s.done) return;
    const el = e.target.closest('[data-opt],[data-go],[data-act]'); if (!el) return;
    if (el.dataset.opt != null) return pick(+el.dataset.opt);
    if (el.dataset.go != null) { s.i = +el.dataset.go; return drawQuiz(); }
    act(el.dataset.act);
  }
  function pick(i) { const s = quiz; const q = s.qs[s.i]; if (s.checked[q.key] || i >= q.options.length) return; s.ans[q.key] = s.ans[q.key] === i ? undefined : i; if (s.ans[q.key] === undefined) delete s.ans[q.key]; drawQuiz(); }
  function act(a) {
    const s = quiz; const q = s.qs[s.i];
    if (a === 'prev' && s.i > 0) { s.i--; drawQuiz(); }
    else if (a === 'next' && s.i < s.qs.length - 1) { s.i++; drawQuiz(); }
    else if (a === 'check') { s.checked[q.key] = true; drawQuiz(); }
    else if (a === 'flag') { s.flags[q.key] = !s.flags[q.key]; drawQuiz(); }
    else if (a === 'finish') {
      const empty = s.qs.filter(x => s.ans[x.key] == null).length;
      const flagged = s.qs.filter(x => s.flags[x.key]).length;
      if (empty || flagged) App.confirm(`${empty ? `<b>${empty}</b> soru boş` : ''}${empty && flagged ? ', ' : ''}${flagged ? `<b>${flagged}</b> soru işaretli` : ''}. Yine de bitirmek istiyor musun?`, finishQuiz);
      else finishQuiz();
    }
  }
  function bindQuizKeys() {
    const onKey = (e) => {
      if (!quiz || quiz.done || !quiz.host.isConnected || isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toUpperCase();
      const idx = keyIdx(k, quiz.qs[quiz.i]);
      if (idx >= 0) { e.preventDefault(); pick(idx); }
      else if (e.key === 'Enter') { e.preventDefault(); const q = quiz.qs[quiz.i]; quiz.checked[q.key] ? act(quiz.i === quiz.qs.length - 1 ? 'finish' : 'next') : act('check'); }
      else if (e.key === 'ArrowRight') act('next');
      else if (e.key === 'ArrowLeft') act('prev');
      else if (k === 'F') act('flag');
    };
    document.addEventListener('keydown', onKey);
    App.onLeave(() => { document.removeEventListener('keydown', onKey); quiz = null; });
  }
  function finishQuiz() {
    const s = quiz; s.done = true; const me = App.me();
    me.bankStats = me.bankStats || {};
    let c = 0, w = 0, e = 0; const wrongList = []; let removed = 0;
    s.qs.forEach(q => {
      const a = s.ans[q.key];
      if (a == null) { e++; return; }
      const ok = a === q.answer; bump(me.bankStats, q.topicId, ok);
      if (ok) { c++; const ix = me.wrongs.indexOf(q.key); if (ix >= 0) { me.wrongs.splice(ix, 1); removed++; } }
      else { w++; wrongList.push(q); if (!me.wrongs.includes(q.key)) me.wrongs.push(q.key); }
    });
    const mins = Math.max(1, Math.round((Date.now() - s.started) / 60000));
    App.logStudy(mins);
    const xp = c * 3 + 5; App.addXP(xp, 'Test');
    if (c === s.qs.length && s.qs.length >= 5) App.award('tam-puan');
    App.save();
    const p = pctOf(c, s.qs.length);
    const msg = p >= 85 ? 'Muhteşem! Bu konular sağlam.' : p >= 60 ? 'İyi gidiyorsun, birkaç eksik kaldı.' : p >= 30 ? 'Temeli var, tekrar zamanı.' : 'Moral bozmak yok — yanlışlar en iyi öğretmen.';
    s.host.onclick = null;
    s.host.innerHTML = `
    <div class="pr-res">
      <div class="card pr-res-hero">
        <div class="pr-res-ring">${App.ring(p, 132, 10, heat(p))}<div><b>%${p}</b><small>başarı</small></div></div>
        <div class="pr-res-info">
          <div class="pr-eyebrow">${esc(s.opts.title)} · Test bitti</div>
          <h1>${msg}</h1>
          <div class="pr-res-nums">
            <span class="pr-n ok"><b>${c}</b> doğru</span><span class="pr-n err"><b>${w}</b> yanlış</span><span class="pr-n"><b>${e}</b> boş</span><span class="pr-n acc"><b>+${xp}</b> XP</span>
          </div>
          <p class="small muted">${s.opts.mode === 'wrongs' ? (removed ? `${removed} soru Yanlışlarım listesinden çıktı. ` : '') : (w ? `${w} yanlış soru Yanlışlarım’a eklendi. ` : '')}${mins} dakika çalışma kaydedildi.</p>
          <div class="row" style="flex-wrap:wrap">
            ${s.opts.mode === 'wrongs' ? `<a class="btn primary" href="#/wrongs" data-reload>Yanlışlarıma dön</a>` : `<a class="btn primary" href="#/practice/bank" data-reload>Yeni test oluştur</a>`}
            ${w ? `<button class="btn accent" id="pr-retry">Yanlışları tekrar çöz (${w})</button>` : ''}
            <a class="btn" href="#/practice">Test Merkezi</a>
          </div>
        </div>
      </div>
      ${wrongList.length ? `<h2 class="serif" style="margin-top:28px">Yanlış yaptıkların</h2>
      <div class="stack">${wrongList.map(q => reviewItem(q, s.ans[q.key])).join('')}</div>` : ''}
    </div>`;
    const r = document.getElementById('pr-retry'); if (r) r.onclick = () => startQuiz(s.host, shuffle(wrongList), { title: 'Bu testin yanlışları', mode: 'wrongs' });
    s.host.querySelectorAll('[data-reload]').forEach(a => a.onclick = (ev) => { if (location.hash.split('?')[0] === a.getAttribute('href')) { ev.preventDefault(); App.render(); } });
    window.scrollTo(0, 0);
  }

  function reviewItem(q, given, num) {
    const t = App.topic(q.topicId);
    const st = given == null ? 'emp' : given === q.answer ? 'ok' : 'err';
    return `<div class="pr-rev ${st}">
      <div class="pr-rev-head">${num != null ? `<span class="pr-rev-n">${num}</span>` : ''}<span class="small muted">${esc(t ? t.title : '')}</span>
        <span class="tag ${st === 'ok' ? 'ok' : st === 'err' ? 'err' : ''}">${st === 'ok' ? 'Doğru' : st === 'err' ? 'Yanlış' : 'Boş'}</span></div>
      <p class="pr-rev-q" lang="en">${esc(q.text)}</p>
      <div class="pr-rev-ans">
        <span>Senin cevabın: <b class="pr-a-${st}">${given == null ? '—' : L[given] + ') ' + esc(q.options[given])}</b></span>
        <span>Doğru cevap: <b class="ok">${L[q.answer]}) ${esc(q.options[q.answer])}</b></span>
      </div>
      ${q.explain ? `<p class="pr-rev-exp">💡 ${esc(q.explain)}</p>` : ''}
    </div>`;
  }

  // ================= 3. DENEME (sade mod) =================
  let exam = null; // { examId, qs, ans, flags, cur, endsAt, started }

  function buildExam(ex) {
    const qs = [];
    ex.sections.forEach((sec, si) => shuffle(App.allQuestions(sec.courseId)).slice(0, sec.count).forEach(q => qs.push({ ...q, sec: si })));
    return { examId: ex.id, qs, ans: {}, flags: {}, cur: 0, started: Date.now(), endsAt: Date.now() + ex.duration * 60000 };
  }

  function examPage({ id }) {
    const ex = App.exam(id);
    if (!ex) return `<div class="pr-ex-shell"><div class="pr-ex-intro">${App.emptyState('🧭', 'Deneme bulunamadı', '', '<a class="btn primary" href="#/practice/exams">Denemelere dön</a>')}</div></div>`;
    const resume = exam && exam.examId === id && exam.endsAt > Date.now();
    const avail = ex.sections.map(s => Math.min(s.count, App.allQuestions(s.courseId).length));
    const total = avail.reduce((a, b) => a + b, 0);
    const past = App.me().exams.filter(e => e.examId === id);
    return `<div class="pr-ex-shell" id="pr-ex">
      <div class="pr-ex-intro">
        <a class="pr-ex-back" href="#/practice/exams">← Denemeler</a>
        <div class="card pr-ex-card">
          <div class="pr-eyebrow">Deneme</div>
          <h1>${esc(ex.title)}</h1>
          <p class="muted">${esc(ex.desc)}</p>
          <div class="pr-ex-facts">
            <div><b>${ex.duration}</b><span>dakika</span></div>
            <div><b>${total}</b><span>soru</span></div>
            <div><b>${ex.sections.length}</b><span>bölüm</span></div>
          </div>
          <table class="table pr-ex-secs"><thead><tr><th>Bölüm</th><th>Kurs</th><th style="text-align:right">Soru</th></tr></thead>
            <tbody>${ex.sections.map((s, i) => `<tr><td><b>${esc(s.label)}</b></td><td class="muted">${esc((App.course(s.courseId) || {}).title || '')}</td><td style="text-align:right">${avail[i]}${avail[i] < s.count ? ` <span class="small muted">/ ${s.count}</span>` : ''}</td></tr>`).join('')}</tbody></table>
          <ul class="pr-rules">
            <li><b>Yanlışlar puan düşürmez.</b> Puanın doğru sayındır; emin olmadığın soruda en iyi tahminini işaretle.</li>
            <li>Sorular <b>İngilizcedir</b>; iki şıklı (True/False) ya da dört şıklı olabilir.</li>
            <li>Süre bitince deneme <b>otomatik olarak</b> biter ve değerlendirilir.</li>
            <li>Sağdaki optik formdan istediğin soruya atlayabilir, 🚩 ile soru işaretleyebilirsin.</li>
            <li>Klavye: şık harfi (<kbd>A</kbd>, <kbd>B</kbd>…) işaretle, <kbd>←</kbd> <kbd>→</kbd> gezin, <kbd>F</kbd> işaret koy.</li>
          </ul>
          ${qNote()}
          ${past.length ? `<p class="small muted">Bu denemeyi ${past.length} kez çözdün. En iyi sonucun: <b>${Math.max(...past.map(p => p.correct))} doğru</b>. Hadi rekoru kır!</p>` : `<p class="small muted">İlk denemen mi? Derin bir nefes al — telefonu uzağa koy. 📵</p>`}
          <div class="row" style="flex-wrap:wrap;margin-top:8px">
            ${resume ? `<button class="btn primary pr-big" id="pr-ex-resume">Kaldığın yerden devam et (${mmss((exam.endsAt - Date.now()) / 1000)})</button><button class="btn" id="pr-ex-start">Baştan başla</button>`
              : `<button class="btn primary pr-big" id="pr-ex-start" ${total ? '' : 'disabled'}>Denemeye başla →</button>`}
          </div>
        </div>
      </div>
    </div>`;
  }

  function examAfter({ id }) {
    const ex = App.exam(id); if (!ex) return;
    const host = document.getElementById('pr-ex');
    let tick = null;
    const stop = () => { if (tick) clearInterval(tick); tick = null; };
    const begin = (fresh) => {
      if (fresh || !exam || exam.examId !== id) exam = buildExam(ex);
      host.onclick = onClick; drawExam(); stop(); tick = setInterval(updTimer, 1000); updTimer();
    };
    const startBtn = document.getElementById('pr-ex-start'); if (startBtn) startBtn.onclick = () => begin(true);
    const resBtn = document.getElementById('pr-ex-resume'); if (resBtn) resBtn.onclick = () => begin(false);

    function sectionOf(i) { return exam.qs[i].sec; }
    function drawExam() {
      const s = exam; const q = s.qs[s.cur]; const curSec = sectionOf(s.cur);
      const t = App.topic(q.topicId);
      const answered = Object.keys(s.ans).length;
      const secStart = (si) => s.qs.findIndex(x => x.sec === si);
      const nums = {}; let n = 0; s.qs.forEach((x, i) => nums[i] = ++n);
      host.innerHTML = `
      <div class="pr-ex-run">
        <header class="pr-ex-bar">
          <div class="pr-ex-title"><span class="pr-eyebrow">Deneme</span><b>${esc(ex.title)}</b></div>
          <nav class="pr-ex-tabs" aria-label="Bölümler">${ex.sections.map((sec, si) => {
            const qsSec = s.qs.filter(x => x.sec === si); if (!qsSec.length) return '';
            const a = qsSec.filter(x => s.ans[x.key] != null).length;
            return `<button class="pr-ex-tab ${si === curSec ? 'on' : ''}" data-go="${secStart(si)}">${esc(sec.label)} <small>${a}/${qsSec.length}</small></button>`;
          }).join('')}</nav>
          <div class="pr-timer" id="pr-timer" role="timer" aria-live="off">⏱ <span>--:--</span></div>
          <button class="btn primary" data-act="finish">Denemeyi bitir</button>
        </header>
        <div class="pr-ex-body">
          <main class="pr-ex-main">
            <div class="pr-ex-qhead"><span class="pr-ex-qn">${nums[s.cur]}</span><span class="small muted">${esc(ex.sections[curSec].label)} · ${esc(t ? t.title : '')}</span>
              <button class="pr-flag ${s.flags[q.key] ? 'on' : ''}" data-act="flag">🚩 ${s.flags[q.key] ? 'İşaretli' : 'İşaretle'}</button></div>
            <p class="pr-q-text" lang="en">${esc(q.text)}</p>
            <div class="pr-opts">${q.options.map((o, i) => `<button class="pr-opt ${s.ans[q.key] === i ? 'sel' : ''}" data-opt="${i}"><span class="pr-opt-l">${L[i]}</span><span lang="en">${esc(o)}</span></button>`).join('')}</div>
            <div class="pr-q-actions">
              <button class="btn" data-act="prev" ${s.cur === 0 ? 'disabled' : ''}>← Önceki</button>
              <button class="btn ghost" data-act="clear" ${s.ans[q.key] == null ? 'disabled' : ''}>Boş bırak</button>
              ${s.cur < s.qs.length - 1 ? `<button class="btn primary" data-act="next">Sonraki →</button>` : `<button class="btn primary" data-act="finish">Denemeyi bitir ✓</button>`}
            </div>
            ${qNote()}
          </main>
          <aside class="pr-optik" aria-label="Optik form">
            <div class="pr-optik-head"><b>Optik form</b><span class="small muted">${answered}/${s.qs.length} dolu</span></div>
            ${ex.sections.map((sec, si) => {
              const rows = s.qs.map((x, i) => [x, i]).filter(([x]) => x.sec === si); if (!rows.length) return '';
              return `<div class="pr-optik-sec">${esc(sec.label)}</div>` + rows.map(([x, i]) => `<div class="pr-optik-row ${i === s.cur ? 'cur' : ''}">
                <button class="pr-optik-n ${s.flags[x.key] ? 'flag' : ''}" data-go="${i}" title="${s.flags[x.key] ? 'İşaretli soru' : 'Soruya git'}">${nums[i]}</button>
                ${x.options.map((_, oi) => `<button class="pr-bub ${s.ans[x.key] === oi ? 'on' : ''}" data-bub="${i}:${oi}" aria-label="Soru ${nums[i]} ${L[oi]}">${L[oi]}</button>`).join('')}
              </div>`).join('');
            }).join('')}
            <div class="pr-optik-leg small muted"><span><i class="pr-bub on"></i> dolu</span><span><i class="pr-optik-n flag"></i> işaretli</span></div>
          </aside>
        </div>
      </div>`;
      updTimer();
    }
    function updTimer() {
      if (!exam) return;
      const left = (exam.endsAt - Date.now()) / 1000;
      const el = document.getElementById('pr-timer');
      if (el) { el.querySelector('span').textContent = mmss(left); el.classList.toggle('warn', left <= 300 && left > 60); el.classList.toggle('crit', left <= 60); }
      document.title = mmss(left) + ' · ' + ex.title + ' · Kampüs';
      if (left <= 0) { stop(); App.toast('⏰ Süre doldu! Denemen değerlendiriliyor.'); finish(); }
    }
    function setAns(i, oi) { const k = exam.qs[i].key; if (exam.ans[k] === oi) delete exam.ans[k]; else exam.ans[k] = oi; drawExam(); }
    function onClick(e) {
      const el = e.target.closest('[data-opt],[data-go],[data-act],[data-bub]'); if (!el || !exam) return;
      if (el.dataset.opt != null) return setAns(exam.cur, +el.dataset.opt);
      if (el.dataset.bub) { const [i, oi] = el.dataset.bub.split(':').map(Number); exam.cur = i; return setAns(i, oi); }
      if (el.dataset.go != null) { exam.cur = +el.dataset.go; return drawExam(); }
      doAct(el.dataset.act);
    }
    function doAct(a) {
      const s = exam; const q = s.qs[s.cur];
      if (a === 'prev' && s.cur > 0) { s.cur--; drawExam(); }
      else if (a === 'next' && s.cur < s.qs.length - 1) { s.cur++; drawExam(); }
      else if (a === 'clear') { delete s.ans[q.key]; drawExam(); }
      else if (a === 'flag') { s.flags[q.key] = !s.flags[q.key]; drawExam(); }
      else if (a === 'finish') {
        const empty = s.qs.filter(x => s.ans[x.key] == null).length;
        App.confirm(`${empty ? `<b>${empty}</b> soru boş. ` : 'Tüm soruları işaretledin. '}Denemeyi bitirip sonucunu görmek istiyor musun?<br><span class="small muted">Kalan süre: ${mmss((s.endsAt - Date.now()) / 1000)}</span>`, finish);
      }
    }
    function finish() {
      if (!exam) return; stop();
      const s = exam; exam = null; const me = App.me();
      let c = 0, w = 0, e = 0; const bySubject = {}, byTopic = {};
      const answers = s.qs.map(q => {
        const g = s.ans[q.key]; const sub = bySubject[q.courseId] = bySubject[q.courseId] || { c: 0, w: 0, e: 0 };
        const tp = byTopic[q.topicId] = byTopic[q.topicId] || { c: 0, t: 0 }; tp.t++;
        if (g == null) { e++; sub.e++; } else if (g === q.answer) { c++; sub.c++; tp.c++; } else { w++; sub.w++; if (!me.wrongs.includes(q.key)) me.wrongs.push(q.key); }
        return { key: q.key, given: g == null ? null : g, answer: q.answer, sec: q.sec };
      });
      const rid = App.uid('r');
      // Puan = doğru sayısı; yanlış götürmez. Alan adı `net` şemayla uyum için korunur.
      me.exams.push({ id: rid, examId: ex.id, at: App.nowISO(), correct: c, wrong: w, empty: e, net: c, bySubject, byTopic, answers });
      App.logStudy(Math.max(1, Math.round((Date.now() - s.started) / 60000)));
      App.award('deneme-1');
      App.addXP(30 + c * 5, 'Deneme');
      App.save();
      App.go('/exam/' + ex.id + '/result/' + rid);
    }
    const onKey = (e) => {
      if (!exam || !document.querySelector('.pr-ex-run') || isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toUpperCase(); const idx = keyIdx(k, exam.qs[exam.cur]);
      if (idx >= 0) { e.preventDefault(); setAns(exam.cur, idx); }
      else if (e.key === 'ArrowRight') doAct('next'); else if (e.key === 'ArrowLeft') doAct('prev'); else if (k === 'F') doAct('flag');
    };
    document.addEventListener('keydown', onKey);
    App.onLeave(() => { stop(); document.removeEventListener('keydown', onKey); });
  }

  // ================= 4. DENEME SONUCU =================
  function resultPage({ id, rid }) {
    const ex = App.exam(id); const me = App.me();
    const r = me.exams.find(x => x.id === rid);
    if (!ex || !r) return App.emptyState('🔎', 'Sonuç bulunamadı', 'Bu deneme sonucu kayıtlı değil.', '<a class="btn primary" href="#/practice/exams">Denemelere dön</a>');
    const total = r.correct + r.wrong + r.empty;
    const p = pctOf(r.correct, total);
    const sameExam = me.exams.filter(x => x.examId === id).sort((a, b) => a.at.localeCompare(b.at));
    const prev = sameExam[sameExam.indexOf(r) - 1];
    const diff = prev ? r.correct - prev.correct : null;
    const topics = Object.entries(r.byTopic || {}).map(([tid, v]) => ({ tp: App.topic(tid), tid, c: v.c, n: v.t, p: pctOf(v.c, v.t) })).filter(x => x.tp).sort((a, b) => a.p - b.p);
    const weak = topics.filter(x => x.p < 60);
    const msg = p >= 80 ? 'Harika bir deneme! 🎉' : p >= 55 ? 'Sağlam bir sonuç.' : p >= 30 ? 'Gelişmeye açık — eksikler belli.' : 'Her deneme bir harita: nereye çalışacağını gösterir.';
    // Grafik: aynı denemenin denemeleri (yoksa tüm denemeler)
    const series = (sameExam.length > 1 ? sameExam : me.exams.slice().sort((a, b) => a.at.localeCompare(b.at))).slice(-8);
    return `
    ${App.breadcrumbs([['Test Merkezi', '/practice'], ['Denemeler', '/practice/exams'], ['Sonuç']])}
    <div class="card pr-exres-hero">
      <div class="pr-exres-net"><span class="pr-eyebrow">Doğru sayın</span><b>${r.correct}</b><small>${total} soruda · %${p}</small>
        ${diff != null ? `<span class="tag ${diff >= 0 ? 'ok' : 'err'}">${diff >= 0 ? '▲ +' : '▼ '}${diff} doğru · önceki denemeye göre</span>` : ''}</div>
      <div class="pr-exres-info">
        <div class="pr-eyebrow">${esc(ex.title)} · ${App.fmtDate(r.at)}</div>
        <h1>${msg}</h1>
        <div class="pr-res-nums"><span class="pr-n ok"><b>${r.correct}</b> doğru</span><span class="pr-n err"><b>${r.wrong}</b> yanlış</span><span class="pr-n"><b>${r.empty}</b> boş</span><span class="pr-n acc"><b>%${p}</b> başarı</span></div>
        <div class="pr-stack-bar" aria-hidden="true"><span class="ok" style="flex:${r.correct}"></span><span class="err" style="flex:${r.wrong}"></span><span class="empty" style="flex:${r.empty}"></span></div>
        <div class="row" style="flex-wrap:wrap;margin-top:14px">
          <a class="btn primary" href="#/exam/${esc(id)}">Tekrar çöz</a>
          ${weak.length ? `<a class="btn accent" href="#/practice/bank?course=${esc(weak[0].tp.courseId)}&topic=${esc(weak[0].tid)}">En zayıf konudan soru çöz</a>` : ''}
          <a class="btn" href="#/practice/exams">Tüm denemeler</a>
        </div>
      </div>
    </div>

    <div class="pr-exres-grid">
      <section class="card">
        <h2 class="serif">Bölüm bazlı sonuçlar</h2>
        <div class="table-wrap"><table class="table"><thead><tr><th>Bölüm</th><th>D</th><th>Y</th><th>B</th><th style="text-align:right">Başarı</th></tr></thead>
        <tbody>${ex.sections.map(sec => { const v = (r.bySubject || {})[sec.courseId]; if (!v) return ''; const n = pctOf(v.c, v.c + v.w + v.e); return `<tr><td><b>${esc(sec.label)}</b></td><td class="pr-c-ok">${v.c}</td><td class="pr-c-err">${v.w}</td><td class="muted">${v.e}</td><td style="text-align:right"><b>%${n}</b></td></tr>`; }).join('')}
        <tr class="pr-total"><td>Toplam</td><td>${r.correct}</td><td>${r.wrong}</td><td>${r.empty}</td><td style="text-align:right">%${p}</td></tr></tbody></table></div>
      </section>
      <section class="card">
        <div class="card-head"><h2 class="serif">Gelişimin</h2><span class="small muted">${sameExam.length > 1 ? 'Bu denemedeki girişlerin' : 'Tüm denemelerin'}</span></div>
        ${netChart(series, r.id)}
        ${sameExam.length < 2 ? `<p class="small muted" style="margin:8px 0 0">Bu denemeyi bir kez daha çöz, gelişimini yan yana gör.</p>` : ''}
      </section>
    </div>

    <section class="card" style="margin-top:16px">
      <div class="card-head"><h2 class="serif">Konu bazlı başarı</h2><span class="small muted">En zayıftan güçlüye</span></div>
      <div class="pr-tbars">${topics.map(x => `<div class="pr-tbar">
        <a href="#/learn/${esc(x.tp.courseId)}/${esc(x.tid)}?mode=text">${esc(x.tp.title)}</a>
        <div class="pr-bar"><span style="width:${Math.max(x.p, 2)}%;background:${heat(x.p)}"></span></div>
        <b>%${x.p}</b><span class="small muted">${x.c}/${x.n}</span></div>`).join('')}</div>
      ${weak.length ? `<div class="pr-missing"><b>Eksik konuların:</b> ${weak.map(x => `<a class="pr-chip" href="#/learn/${esc(x.tp.courseId)}/${esc(x.tid)}?mode=text">📄 ${esc(x.tp.title)}</a>`).join('')}
        <span class="small muted">Konu anlatımını oku, sonra soru bankasından soru çöz.</span></div>` : `<div class="notice ok" style="margin:14px 0 0">Bu denemede %60’ın altında konu yok. Tebrikler! 💪</div>`}
    </section>

    <section class="card" style="margin-top:16px">
      <div class="card-head"><h2 class="serif">Soru soru inceleme</h2>
        ${r.answers ? `<div class="tabs pr-rev-tabs" role="tablist"><button class="tab active" data-f="all">Tümü</button><button class="tab" data-f="err">Yanlışlar</button><button class="tab" data-f="emp">Boşlar</button><button class="tab" data-f="ok">Doğrular</button></div>` : ''}</div>
      ${qNote()}
      ${r.answers ? `<div class="stack" id="pr-rev-list">${r.answers.map((a, i) => { const q = App.question(a.key); return q ? reviewItem(q, a.given, i + 1) : ''; }).join('')}</div>`
        : `<div class="notice">Bu deneme kaydında cevap ayrıntısı yok, bu yüzden soru soru inceleme yapılamıyor. Denemeyi yeniden çözersen tüm cevaplarını burada açıklamalarıyla görebilirsin. <a href="#/exam/${esc(id)}">Yeniden çöz →</a></div>`}
    </section>`;
  }
  function resultAfter() {
    const tabs = document.querySelectorAll('.pr-rev-tabs .tab');
    tabs.forEach(b => b.onclick = () => {
      tabs.forEach(x => x.classList.toggle('active', x === b));
      document.querySelectorAll('#pr-rev-list .pr-rev').forEach(el => { el.hidden = b.dataset.f !== 'all' && !el.classList.contains(b.dataset.f); });
    });
  }

  function netChart(series, curId) {
    if (!series.length) return '<p class="muted">Henüz deneme yok.</p>';
    const W = 460, H = 180, pad = { l: 30, r: 10, t: 22, b: 30 };
    // Çubuklar: doğru sayısı (yanlışlar puan düşürmez).
    const max = Math.max(1, ...series.map(examTotal));
    const min = 0;
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const bw = Math.min(46, iw / series.length * 0.6);
    const y = (v) => pad.t + ih - (v - min) / (max - min) * ih;
    const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
    const bars = series.map((s, i) => {
      const cx = pad.l + iw * (i + .5) / series.length; const top = y(s.correct), base = y(0);
      const ex = App.exam(s.examId);
      return `<g><rect x="${cx - bw / 2}" y="${Math.min(top, base)}" width="${bw}" height="${Math.max(2, Math.abs(base - top))}" rx="5" class="${s.id === curId ? 'pr-bar-cur' : 'pr-bar-old'}"><title>${esc(ex ? ex.title : '')} — ${App.fmtShort(s.at)}: ${s.correct}/${examTotal(s)} doğru</title></rect>
        <text x="${cx}" y="${Math.min(top, base) - 6}" text-anchor="middle" class="pr-ch-v">${s.correct}</text>
        <text x="${cx}" y="${H - 10}" text-anchor="middle" class="pr-ch-x">${esc(App.fmtShort(s.at))}</text></g>`;
    }).join('');
    return `<svg class="pr-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Denemelerde doğru sayısı grafiği">
      ${ticks.map(t => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}" class="pr-ch-grid"/><text x="${pad.l - 6}" y="${y(t) + 4}" text-anchor="end" class="pr-ch-x">${t}</text>`).join('')}
      ${bars}</svg>`;
  }

  // ================= 5. DENEME LİSTESİ =================
  function examsPage() {
    const me = App.me();
    const hist = me.exams.slice().sort((a, b) => b.at.localeCompare(a.at));
    return `
    ${App.breadcrumbs([['Test Merkezi', '/practice'], ['Denemeler']])}
    <div class="pr-head"><div><h1>Denemeler</h1><p class="muted">Vize ve final provası: süre tutulur, doğru sayın hesaplanır, eksik konuların çıkarılır.</p></div></div>
    <div class="pr-exam-list">${App.db.exams.map(ex => {
      const total = ex.sections.reduce((n, s) => n + Math.min(s.count, App.allQuestions(s.courseId).length), 0);
      const mine = me.exams.filter(e => e.examId === ex.id);
      const best = mine.length ? mine.slice().sort((a, b) => examPct(b) - examPct(a))[0] : null;
      const rel = ex.sections.some(s => me.enrolled.includes(s.courseId));
      return `<article class="card pr-exam-card">
        <div class="pr-exam-top"><h3 class="serif">${esc(ex.title)}</h3>${rel ? '<span class="tag primary">Senin için</span>' : ''}</div>
        <p class="muted small">${esc(ex.desc)}</p>
        <div class="pr-exam-meta"><span>⏱ ${ex.duration} dk</span><span>📝 ${total} soru</span><span>${ex.sections.map(s => esc(s.label)).join(' · ')}</span></div>
        <div class="pr-exam-foot">
          <span class="small">${best != null ? `En iyi: <b>${best.correct}/${examTotal(best)} doğru</b> · ${mine.length} giriş` : '<span class="muted">Henüz çözmedin</span>'}</span>
          <a class="btn ${rel ? 'primary' : ''}" href="#/exam/${esc(ex.id)}">${mine.length ? 'Tekrar çöz' : 'Başla'} →</a>
        </div>
      </article>`;
    }).join('')}</div>
    <section class="card" style="margin-top:20px">
      <div class="card-head"><h2 class="serif">Geçmiş sonuçların</h2>${hist.length ? `<span class="small muted">${hist.length} deneme</span>` : ''}</div>
      ${hist.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Deneme</th><th>Tarih</th><th>D</th><th>Y</th><th>B</th><th>Başarı</th><th></th></tr></thead><tbody>
        ${hist.map(h => { const ex = App.exam(h.examId); return `<tr><td><b>${esc(ex ? ex.title : h.examId)}</b></td><td class="muted">${App.fmtDate(h.at)}</td><td class="pr-c-ok">${h.correct}</td><td class="pr-c-err">${h.wrong}</td><td class="muted">${h.empty}</td><td><b>%${examPct(h)}</b></td><td style="text-align:right"><a class="btn sm" href="#/exam/${esc(h.examId)}/result/${esc(h.id)}">Sonucu gör</a></td></tr>`; }).join('')}
      </tbody></table></div>` : App.emptyState('⏱️', 'Henüz deneme çözmedin', 'İlk denemen en zoru — sonrası alışkanlık. 20 dakikan var mı?')}
    </section>`;
  }

  // ================= 6. YANLIŞLARIM =================
  function wrongsPage() {
    const me = App.me();
    const qs = me.wrongs.map(App.question).filter(Boolean);
    const groups = {};
    qs.forEach(q => { const g = groups[q.courseId] = groups[q.courseId] || {}; (g[q.topicId] = g[q.topicId] || []).push(q); });
    return `
    ${App.breadcrumbs([['Test Merkezi', '/practice'], ['Yanlışlarım']])}
    <div id="pr-quiz-host">
      <div class="pr-head"><div><h1>Yanlışlarım</h1>
        <p class="muted">${qs.length ? `${qs.length} soru seni bekliyor. Doğru çözdüğün her soru listeden kendiliğinden düşer.` : 'Hata yapmak öğrenmenin parçası; burası boşsa ya çok iyisin ya da henüz test çözmedin. 😉'}</p></div>
        ${qs.length ? `<button class="btn primary pr-big" id="pr-wr-all">🔁 Hepsini tekrar çöz</button>` : ''}</div>
      ${qs.length ? Object.entries(groups).map(([cid, tps]) => { const c = App.course(cid); return `
        <section class="pr-wr-course">
          <h2 class="serif"><span class="dot" style="background:${safeColor(c.color)}"></span>${esc(c.title.split(':')[0])} <span class="tag">${Object.values(tps).flat().length}</span></h2>
          ${Object.entries(tps).map(([tid, list]) => { const t = App.topic(tid); return `
          <div class="card pr-wr-topic">
            <div class="card-head"><h3>${esc(t.title)} <span class="muted small">· ${list.length} soru</span></h3>
              <div class="row"><a class="btn sm ghost" href="#/learn/${esc(cid)}/${esc(tid)}?mode=text">Konuyu çalış</a><button class="btn sm" data-wr-topic="${esc(tid)}">Bu konuyu çöz</button></div></div>
            <ul class="list">${list.map(q => `<li class="pr-wr-item">
              <div class="pr-wr-q"><p lang="en">${esc(q.text)}</p>
                <details><summary>Çözümü gör</summary><div class="pr-wr-sol"><b class="pr-c-ok" lang="en">${L[q.answer]}) ${esc(q.options[q.answer])}</b>${q.explain ? `<p>💡 ${esc(q.explain)}</p>` : ''}</div></details></div>
              <button class="btn sm" data-wr-rm="${esc(q.key)}">✓ Anladım, kaldır</button></li>`).join('')}</ul>
          </div>`; }).join('')}
        </section>`; }).join('')
        : App.emptyState('🌿', 'Listen tertemiz', 'Yeni bir test çöz; yanlış yaptığın sorular burada toplanır, tekrar çözünce çıkar.', '<a class="btn primary" href="#/practice/bank">Soru bankasına git</a>')}
      ${qs.length ? qNote() : ''}
    </div>`;
  }
  function wrongsAfter() {
    const host = document.getElementById('pr-quiz-host'); if (!host) return;
    const me = App.me();
    const all = () => me.wrongs.map(App.question).filter(Boolean);
    const b = document.getElementById('pr-wr-all'); if (b) b.onclick = () => startQuiz(host, shuffle(all()), { title: 'Tüm yanlışlar', mode: 'wrongs' });
    host.querySelectorAll('[data-wr-topic]').forEach(x => x.onclick = () => startQuiz(host, shuffle(all().filter(q => q.topicId === x.dataset.wrTopic)), { title: App.topic(x.dataset.wrTopic).title, mode: 'wrongs' }));
    host.querySelectorAll('[data-wr-rm]').forEach(x => x.onclick = () => {
      const i = me.wrongs.indexOf(x.dataset.wrRm); if (i >= 0) me.wrongs.splice(i, 1); App.save();
      App.toast('Listeden çıkarıldı. Bir yanlış daha az! ✓'); App.render();
    });
    bindQuizKeys();
  }

  // ---- Rotalar ----
  App.route('/practice', hub, { title: 'Test Merkezi' });
  App.route('/practice/bank', bankPage, { title: 'Soru Bankası', after: bankAfter });
  App.route('/practice/exams', examsPage, { title: 'Denemeler' });
  App.route('/exam/:id', examPage, { title: 'Deneme', layout: false, after: examAfter });
  App.route('/exam/:id/result/:rid', resultPage, { title: 'Deneme Sonucu', after: resultAfter });
  App.route('/wrongs', wrongsPage, { title: 'Yanlışlarım', after: wrongsAfter });
})();
