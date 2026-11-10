// Hocaya Sor — SAHTE yapay zekâ asistanı. Gerçek API yok: yanıtlar yerel içerikten (konu anlatımı, anahtar noktalar,
// soru bankası, zihin haritası) anahtar kelime eşleştirmesiyle derlenir. /ask tam sayfa + her yerden açılan yan panel.
// Sınıf öneki: ak-   Veri: me.askThreads = [{ id, title, topicId, lastTopic, at, msgs: [...] }], me.askXPDay
(function () {
  const esc = (s) => App.esc(s);
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const LETTERS = 'ABCDEFGH';
  // Öneriler: ilk öneri kullanıcının son çalıştığı / ilk konusundan üretilir (koda konu adı gömülmez).
  const SUGGEST_REST = ['Bir soru çözelim', 'Bana 3 soru sor', 'Konu özeti çıkar', 'Zihin haritası yap'];
  const suggest = () => { const t = App.user ? defaultTopic() : null; return (t ? [t.title + ' konusunu anlat'] : []).concat(SUGGEST_REST); };
  const DEMO_NOTE = 'Demo: gerçek yapay zekâ bağlantısı yok. Yanıtlar Vikipedi kaynaklı konu içeriğinden ve Open Trivia DB sorularından derlenir (CC BY-SA 4.0).';
  const ICON = {
    camera: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M4 8h3l1.6-2.4h6.8L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 19V5M6 11l6-6 6 6"/></svg>',
    stop: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>',
    expand: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  let seq = 0; // benzersiz id üretimi (sayfa + panel aynı anda DOM'da olabilir)

  // ---------- Durum ----------
  const S = { activeId: null, pendingTopic: null };
  function threads() { const me = App.me(); if (!Array.isArray(me.askThreads)) me.askThreads = []; return me.askThreads; }
  const getThread = (id) => (id ? threads().find(t => t.id === id) : null) || null;
  const nowISO = () => (App.nowISO ? App.nowISO() : new Date().toISOString());
  function dailyXP() {
    const me = App.me(); if (me.askXPDay === App.today()) return;
    me.askXPDay = App.today(); App.addXP(5, 'Hocaya Sor: günün ilk sorusu');
    App.toast('+5 XP · Günün ilk sorusu');
  }

  // ---------- Metin yardımcıları ----------
  const FOLD = { 'ı': 'i', 'ş': 's', 'ğ': 'g', 'ü': 'u', 'ö': 'o', 'ç': 'c', 'â': 'a', 'î': 'i', 'û': 'u' };
  const fold = (s) => String(s || '').toLocaleLowerCase('tr').replace(/[ışğüöçâîû]/g, c => FOLD[c]).replace(/[’'`]/g, ' ');
  const tokens = (s) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const isFormula = (s) => /[=+·/×−→⊂()0-9]/.test(s);
  const plain = (md) => String(md || '').replace(/\*\*/g, '').replace(/`/g, '');

  // Basit markdown: **kalın**, `kod`, ```blok```, ### başlık, - / 1. listeler (2 boşluk = bir seviye). ÖNCE kaçırılır.
  function inline(s) {
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + codes[+i] + '</code>');
  }
  function md(src) {
    const lines = esc(src).split('\n'); let out = '', para = [], inCode = false, code = [];
    const stack = []; // { type, li }
    const flushPara = () => { if (para.length) { out += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; } };
    const closeTo = (lvl) => { while (stack.length - 1 > lvl) { const s = stack.pop(); out += (s.li ? '</li>' : '') + '</' + s.type + '>'; } };
    for (const line of lines) {
      if (/^```/.test(line.trim())) {
        if (inCode) { out += '<pre><code>' + code.join('\n') + '</code></pre>'; code = []; inCode = false; }
        else { flushPara(); closeTo(-1); inCode = true; }
        continue;
      }
      if (inCode) { code.push(line); continue; }
      const m = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
      if (m) {
        flushPara();
        const lvl = Math.floor(m[1].length / 2), type = /\d/.test(m[2]) ? 'ol' : 'ul';
        closeTo(lvl);
        if (stack.length - 1 === lvl && stack[lvl].type !== type) closeTo(lvl - 1);
        while (stack.length - 1 < lvl) { out += '<' + type + '>'; stack.push({ type, li: false }); }
        const top = stack[stack.length - 1]; if (top.li) out += '</li>';
        out += '<li>' + inline(m[3]); top.li = true;
        continue;
      }
      if (!line.trim()) { flushPara(); closeTo(-1); continue; }
      closeTo(-1);
      const h = line.match(/^#{1,4}\s+(.*)$/);
      if (h) { flushPara(); out += '<h4>' + inline(h[1]) + '</h4>'; continue; }
      para.push(line);
    }
    if (inCode) out += '<pre><code>' + code.join('\n') + '</code></pre>';
    flushPara(); closeTo(-1);
    return out;
  }

  // ---------- Sahte yanıt motoru ----------
  // Anahtar sözcükler tümüyle katalogdan türetilir: konu başlığındaki sözcükler + kaynak madde adı + konu id'sinin son parçası
  // (ör. "net-tcp" → "tcp"). Elle yazılmış konu sözlüğü yoktur.
  const STOP = new Set(['ile', 'icin', 've', 'veri', 'sistemi', 'modeli', 'adresi', 'gosterimi', 'tablosu', 'yapisi', 'denetimi', 'protokolu', 'algoritmasi', 'programlama']);
  const kwCache = {};
  function topicKeywords(t) {
    if (kwCache[t.id]) return kwCache[t.id];
    const words = (t.title + ' ' + ((t.source && t.source.title) || '')).split(/[^0-9A-Za-zÇĞİÖŞÜçğıöşüâîû]+/).filter(Boolean);
    const auto = [];
    words.forEach(w => { const f = fold(w); const acronym = w.length >= 2 && w === w.toLocaleUpperCase('tr') && /[A-ZÇĞİÖŞÜ]/.test(w); if (!STOP.has(f) && (f.length >= 4 || acronym)) auto.push(f); });
    const slug = fold(String(t.id).split('-').slice(1).join('')); if (slug.length >= 2 && !STOP.has(slug)) auto.push(slug);
    return (kwCache[t.id] = Array.from(new Set(auto)));
  }
  const NOHIT = new Set(['kart', 'kartlar', 'karti']);
  function kwHit(kw, toks, ftext) {
    if (kw.includes(' ')) return ftext.includes(kw);
    // Kısa sözcükler (kısaltmalar: ip, dns, sql…) yalnızca birebir eşleşir.
    if (kw.length <= 3) return toks.includes(kw);
    return toks.some(tok => !NOHIT.has(tok) && (tok === kw || (tok.startsWith(kw) && (kw.length >= 5 || tok.length <= kw.length + 2))));
  }
  function detectTopic(text, ctx) {
    const toks = tokens(text), ftext = toks.join(' ');
    const me = App.me(); let best = null, bestScore = 0, hits = [];
    for (const t of App.db.topics) {
      const matched = topicKeywords(t).filter(kw => kwHit(kw, toks, ftext));
      if (!matched.length) continue;
      const score = matched.length + (me.enrolled.includes(t.courseId) ? 0.5 : 0) + (t.id === ctx ? 0.4 : 0);
      if (score > bestScore) { bestScore = score; best = t; hits = matched; }
    }
    return best ? { topic: best, hits } : null;
  }
  function intentOf(text) {
    const f = fold(text);
    if (/(yoruldum|yorgun|stres|motivasyon|motive|bunald|sikildim|kaygi|endise|odaklanamiyor|moralim|bikt|uykum|panik)/.test(f)) return 'motivate';
    if (/(soru sor|sorular sor|test et|beni sina|beni test|quiz|soru hazirla|\d+\s*soru|soru ver)/.test(f)) return 'quiz';
    if (/(zihin harita|harita)/.test(f)) return 'mindmap';
    if (/(ozet|kisaca|anahtar nokta)/.test(f)) return 'summary';
    if (/(coz|cozum|nasil|adim)/.test(f)) return 'solve';
    if (/(anlat|nedir|ne demek|acikla|basitce|ogret|anlamadim|mantig)/.test(f)) return 'explain';
    if (/(tesekkur|sagol|eyvallah)/.test(f)) return 'thanks';
    if (/^\s*(merhaba|selam|selamlar|hey|gunaydin|iyi aksamlar|naber|nasilsin)\b/.test(f)) return 'greet';
    return null;
  }
  function defaultTopic() {
    const me = App.me();
    if (me.last && App.topic(me.last.topicId)) return App.topic(me.last.topicId);
    for (const cid of me.enrolled) { const ts = App.courseTopics(cid); if (ts.length) return ts[0]; }
    return App.db.topics[0];
  }
  function bestKeyPoint(t, txt) {
    const tk = new Set(tokens(txt)); let best = t.keyPoints[0], sc = -1;
    t.keyPoints.forEach(k => { const s = tokens(k).filter(w => tk.has(w)).length; if (s > sc) { sc = s; best = k; } });
    return best;
  }
  const kpLine = (k) => '- ' + k;
  // Kaynak etiketleri (CC BY-SA 4.0): her yanıtın altında gösterilir.
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? u : '');
  function wikiSrc(t) { const sc = t.source || {}; return sc.url ? { src: (sc.name || 'Vikipedi') + ' · ' + (sc.title || t.title), srcUrl: safeUrl(sc.url) } : { src: 'Konu içeriği · ' + t.title, srcUrl: '' }; }
  function triviaSrc() { const sc = (App.db.sources || []).find(x => /trivia/i.test(x.name)) || {}; return { src: 'Open Trivia DB · İngilizce soru', srcUrl: safeUrl(sc.url) }; }
  // explain'i adımlara böl: önce cümle/;, sonra parçaları yeterince uzunsa → oklarından.
  function splitSteps(explain) {
    const out = [];
    String(explain).split(/\s*(?:;|\.\s+(?=\S))\s*/).forEach(ch => {
      ch = ch.replace(/\.$/, '').trim(); if (!ch) return;
      const parts = ch.split(/\s*→\s*/);
      if (parts.length > 1 && parts.every(p => p.length >= 8)) out.push(...parts); else out.push(ch);
    });
    return out;
  }
  function learnLink(t, mode) { return '#/learn/' + t.courseId + '/' + t.id + (mode ? '?mode=' + mode : ''); }

  const R = {
    explain(t, note) {
      const secs = t.text || []; const shown = secs.slice(0, 2), rest = secs.slice(2);
      let s = (note ? note + '\n\n' : '') + '**' + t.title + '** — Vikipedi maddesinden kısaltılmış anlatım:\n\n';
      s += shown.map(x => '- **' + x.h + ':** ' + x.p).join('\n');
      if (rest.length) s += '\n\n**Konu anlatımında devamı:** ' + rest.map(x => x.h).join(' · ');
      s += '\n\nİstersen bu konudan sana birkaç soru sorayım ya da haritasını çıkarayım.';
      return Object.assign({ md: s, topicId: t.id, chips: ['Bana 3 soru sor', 'Zihin haritası yap'], links: [{ href: learnLink(t, 'text'), label: 'Konu anlatımını aç' }] }, wikiSrc(t));
    },
    solve(t, q, intro) {
      const L = LETTERS[q.answer];
      let s = (intro ? intro + '\n\n' : 'Bu soruya birlikte bakalım.\n\n');
      s += '**Soru (İngilizce):** ' + q.text + '\n\n' + q.options.map((o, i) => '- ' + LETTERS[i] + ') ' + o).join('\n');
      s += '\n\n**Doğru cevap:** **' + L + ') ' + q.options[q.answer] + '**';
      s += '\n\nBu soru Open Trivia DB’den gelen genel bir bilgisayar sorusu; kaynağında adım adım çözüm yok, bu yüzden yalnızca doğru cevabı gösterebiliyorum.';
      return Object.assign({ md: s, topicId: t.id, chips: ['Bana 3 soru sor', 'Konu özeti çıkar'], links: [{ href: learnLink(t, 'quiz'), label: 'Konu testini aç' }] }, triviaSrc());
    },
    quiz(t, n) {
      const qs = shuffle(t.questions).slice(0, Math.max(1, Math.min(n || 3, t.questions.length)));
      if (!qs.length) return Object.assign({ md: '**' + t.title + '** konusunda henüz soru yok.', topicId: t.id, links: [], chips: ['Konu özeti çıkar'] }, wikiSrc(t));
      return Object.assign({ md: '**' + t.title + '** başlığı altındaki sorulardan ' + qs.length + ' tanesini seçtim (sorular İngilizce). Bir seçeneğe dokun, hemen kontrol edeyim:', topicId: t.id, quiz: qs.map(q => ({ key: t.id + ':' + q.id, picked: null })), links: [], chips: [] }, triviaSrc());
    },
    summary(t) {
      const kp = t.keyPoints || [];
      let s = '**' + t.title + ' — kısa özet**\n\n' + (kp.length ? kp.map(kpLine).join('\n') : 'Bu konu için anahtar nokta çıkarılamamış.');
      if ((t.text || []).length > 1) s += '\n\n**Başlıklar:** ' + t.text.map(x => x.h).join(' · ');
      s += '\n\nBu özeti notlarına ekleyip tekrar kartlarıyla pekiştirebilirsin.';
      return Object.assign({ md: s, topicId: t.id, links: [{ href: learnLink(t, 'cards'), label: 'Bilgi kartlarını aç' }], chips: ['Bana 3 soru sor'] }, wikiSrc(t));
    },
    mindmap(t) {
      const walk = (n, d) => '  '.repeat(d) + '- ' + (d === 0 ? '**' + n.label + '**' : n.label) + (n.children || []).map(c => '\n' + walk(c, d + 1)).join('');
      const s = '**' + t.title + '** için zihin haritası (maddenin bölüm başlıklarından):\n\n' + walk(t.mindmap || { label: t.title, children: [] }, 0);
      return Object.assign({ md: s, topicId: t.id, links: [{ href: '#/mindmaps/' + t.id, label: 'Haritayı aç' }], chips: ['Konu özeti çıkar'] }, wikiSrc(t));
    },
    motivate() {
      const me = App.me();
      const open = pick(['Yorulman çok normal; bu, gerçekten çalıştığını gösterir. Kendine biraz nefes alanı açalım.', 'Stresli hissetmen, bu işi önemsediğin anlamına gelir. Hepsini bir anda değil, küçük parçalarla halledeceğiz.', 'Böyle günler herkesin başına gelir. Hedefi küçültelim, yeter ki zincir kopmasın.']);
      let s = open + '\n\n**Şimdi şunu dene:**\n- **25 dakika** tek bir işe odaklan, sonra **5 dakika** mola ver (Pomodoro)\n- Sıradaki adımı küçült: sadece 1 konu ya da birkaç soru\n- Ekrandan kalk, su iç, iki dakika pencereden dışarı bak';
      if (me.streak) s += '\n\nSerin **' + me.streak + ' gün**. Bugün tek bir Pomodoro bile onu korumaya yeter.';
      return { md: s, src: 'Genel çalışma önerisi (ders içeriği değil)', topicId: null, links: [{ href: '#/focus', label: 'Pomodoro başlat' }], chips: [] };
    },
    greet() {
      const name = (App.user.name || '').split(' ')[0];
      return { md: 'Merhaba ' + name + '! Ben Hoca. Kurslarındaki konuların Vikipedi kaynaklı anlatımını özetleyebilir, haritasını çıkarabilir, seni sorularla test edebilirim. Nereden başlayalım?', src: '', topicId: null, links: [], chips: suggest() };
    },
    thanks() { return { md: 'Rica ederim! Takıldığın her yerde buradayım. Kısa bir tekrar için sana birkaç soru da sorabilirim.', src: '', topicId: null, links: [], chips: ['Bana 3 soru sor'] }; },
    unknown(ctxT) {
      const me = App.me();
      const ts = me.enrolled.flatMap(cid => App.courseTopics(cid));
      const sug = (ctxT ? [ctxT] : []).concat(ts.filter(t => !ctxT || t.id !== ctxT.id)).slice(0, 4);
      let s = 'Bunu henüz bilmiyorum. Bu demoda yalnızca kurslarındaki konular hakkında konuşabiliyorum.';
      if (sug.length) s += '\n\n**Şu konulara bakabilirim:**\n' + sug.map(t => '- ' + t.title).join('\n');
      return { md: s, src: '', topicId: null, links: [], chips: sug.slice(0, 3).map(t => t.title + ' anlat').concat(['Bana 3 soru sor']) };
    }
  };

  // Mesajdan yanıt üret. ctx: seçili bağlam konusu, last: sohbette en son konuşulan konu.
  function reply(text, ctx, last) {
    const intent = intentOf(text);
    if (intent === 'motivate') return R.motivate();
    if (intent === 'greet' && tokens(text).length <= 4) return R.greet();
    if (intent === 'thanks') return R.thanks();
    const det = detectTopic(text, ctx);
    const ctxT = App.topic(ctx) || null;
    let t = det ? det.topic : (ctxT || App.topic(last) || null);
    let note = '';
    const ensure = () => { if (!t) { t = defaultTopic(); note = 'Bir konu seçmediğin için son çalıştığın **' + t.title + '** konusunu kullandım.'; } return t; };
    const withNote = (r) => { if (note && intent !== 'explain' && intent) r.md = note + '\n\n' + r.md; return r; };
    if (intent === 'quiz') { const n = +(fold(text).match(/(\d+)\s*soru/) || [])[1] || 3; ensure(); return withNote(R.quiz(t, Math.min(5, n))); }
    if (intent === 'mindmap') { ensure(); return withNote(R.mindmap(t)); }
    if (intent === 'summary') { ensure(); return withNote(R.summary(t)); }
    if (intent === 'solve') {
      const me = App.me();
      if (!t && me.wrongs.length) { const q = App.question(me.wrongs[0]); if (q) { const tt = App.topic(q.topicId); return R.solve(tt, q, 'Yanlışlarından birini seçtim (**' + tt.title + '**). Birlikte bakalım.'); } }
      ensure();
      const nums = (text.match(/\d{2,}/g) || []);
      let q = nums.length ? t.questions.find(x => nums.some(n => x.text.includes(n))) : null;
      let intro = '';
      if (!q) { const wk = me.wrongs.find(k => k.startsWith(t.id + ':')); q = wk ? t.questions.find(x => t.id + ':' + x.id === wk) : null; if (q) intro = 'Bu konuda daha önce yanlış yaptığın soruyu seçtim. Birlikte bakalım.'; }
      if (!q) q = pick(t.questions);
      if (!q) return withNote(R.summary(t));
      return withNote(R.solve(t, q, intro));
    }
    if (t && (intent === 'explain' || det)) return R.explain(t, note);
    return R.unknown(ctxT);
  }
  function photoReply(ctx, last) {
    const me = App.me();
    const pool = App.topic(ctx) ? [App.topic(ctx)] : me.enrolled.flatMap(cid => App.courseTopics(cid));
    const withQ = (pool.length ? pool : App.db.topics).filter(x => (x.questions || []).length);
    const t = pick(withQ.length ? withQ : App.db.topics.filter(x => (x.questions || []).length)); if (!t) return R.unknown(null);
    const q = pick(t.questions);
    return R.solve(t, q, 'Bu demoda görsel okunmuyor ve yüklenmiyor; onun yerine **' + t.title + '** başlığından örnek bir soru seçtim.');
  }

  // ---------- Sohbet bileşeni (sayfa ve panel ortak) ----------
  function createChat(root, opts) {
    opts = opts || {};
    const C = { busy: false, timer: null, stream: null, uid: 'ak' + (++seq) };
    const compact = !!opts.compact;
    const thread = () => getThread(S.activeId);
    const ctxId = () => { const th = thread(); return th ? th.topicId : S.pendingTopic; };
    const $ = (s) => root.querySelector(s);

    function ctxOptions() {
      const me = App.me(), cur = ctxId();
      const groups = me.enrolled.map(App.course).filter(Boolean).map(c => `<optgroup label="${esc(c.title.split(':')[0])}">${App.courseTopics(c.id).map(t => `<option value="${t.id}" ${t.id === cur ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</optgroup>`).join('');
      const extra = cur && App.topic(cur) && !me.enrolled.includes(App.topic(cur).courseId) ? `<option value="${cur}" selected>${esc(App.topic(cur).title)}</option>` : '';
      return `<option value="">Genel (bağlam yok)</option>${extra}${groups}`;
    }
    function histHTML() {
      const list = threads();
      return `<div class="ak-hist-head"><h2 class="serif">Sohbetler</h2><button class="btn sm primary" data-act="new">${ICON.plus}<span>Yeni sohbet</span></button></div>
        ${list.length ? `<ul class="ak-hist-list">${list.map(t => { const tp = App.topic(t.topicId || t.lastTopic); return `<li class="${t.id === S.activeId ? 'active' : ''}"><button class="ak-th" data-th="${t.id}" ${t.id === S.activeId ? 'aria-current="true"' : ''}><span class="ak-th-t">${esc(t.title)}</span><small>${tp ? esc(tp.title) + ' · ' : ''}${t.msgs.length} mesaj</small></button><button class="ak-th-del" data-del="${t.id}" aria-label="Sohbeti sil: ${esc(t.title)}">${ICON.close}</button></li>`; }).join('')}</ul>` : '<p class="muted small ak-hist-empty">Henüz sohbet yok. İlk sorunu sor, burada saklansın.</p>'}`;
    }
    function welcomeHTML() {
      const t = App.topic(ctxId()); const name = (App.user.name || '').split(' ')[0];
      return `<div class="ak-welcome">
        <div class="ak-av ak-av-lg" aria-hidden="true">H</div>
        <h2 class="serif">Merhaba ${esc(name)}, neye takıldın?</h2>
        <p class="muted">${t ? `Bağlam: <b>${esc(t.title)}</b>. Bu konuyla ilgili ne istersen sor.` : 'Konu özeti, zihin haritası ya da mini test. Kurslarındaki içerikten yanıtlıyorum; kaynağı her yanıtın altında.'}</p>
        <div class="ak-chips" role="group" aria-label="Önerilen sorular">${(t ? ['Bu konuyu anlat'].concat(SUGGEST_REST) : suggest()).map(s => `<button class="ak-chip" data-chip="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      </div>`;
    }
    function quizHTML(m, mi) {
      const answered = m.quiz.filter(x => x.picked !== null);
      const correct = answered.filter(x => { const q = App.question(x.key); return q && x.picked === q.answer; }).length;
      return `<div class="ak-quiz">${m.quiz.map((qz, qi) => {
        const q = App.question(qz.key); if (!q) return '';
        const done = qz.picked !== null, ok = done && qz.picked === q.answer;
        return `<div class="ak-q ${done ? (ok ? 'is-ok' : 'is-err') : ''}">
          <p class="ak-q-t"><span class="ak-q-n">Soru ${qi + 1}</span><span lang="en">${esc(q.text)}</span></p>
          <div class="ak-opts" role="group" aria-label="Soru ${qi + 1} seçenekleri">${q.options.map((o, oi) => {
            const cls = done ? (oi === q.answer ? 'ok' : (oi === qz.picked ? 'err' : 'dim')) : '';
            return `<button class="ak-opt ${cls}" data-opt="${mi}:${qi}:${oi}" ${done ? 'disabled' : ''}><span class="ak-l">${LETTERS[oi]}</span><span lang="en">${esc(o)}</span></button>`;
          }).join('')}</div>
          ${done ? `<p class="ak-q-ex" role="status"><b>${ok ? 'Doğru!' : 'Yanlış.'}</b> ${ok ? '' : 'Doğru cevap ' + LETTERS[q.answer] + '. '}${esc(q.explain)}</p>` : ''}
        </div>`;
      }).join('')}${answered.length === m.quiz.length && m.quiz.length ? `<p class="ak-q-score" role="status"><b>${correct}/${m.quiz.length}</b> doğru. ${correct === m.quiz.length ? 'Harika, bu konu sende!' : 'Yanlışları Yanlışlarım listene ekledim, sonra tekrar bakarız.'}</p>` : ''}</div>`;
    }
    function botBody(m, mi) {
      if (m.stopped && !m.md) return '<p class="ak-stopped">Yanıt durduruldu.</p>';
      let h = `<div class="ak-md">${md(m.md)}</div>`;
      if (m.stopped) return h + '<p class="ak-stopped">Yanıt durduruldu.</p>';
      if (m.quiz && m.quiz.length) h += quizHTML(m, mi);
      if (m.links && m.links.length) h += `<div class="ak-links">${m.links.filter(l => /^#\//.test(l.href)).map(l => `<a class="btn sm" href="${esc(l.href)}">${esc(l.label)} →</a>`).join('')}</div>`;
      if (m.chips && m.chips.length) h += `<div class="ak-chips ak-chips-sm" role="group" aria-label="Önerilen devam soruları">${m.chips.map(c => `<button class="ak-chip" data-chip="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
      return h;
    }
    function metaHTML(m, mi) {
      const t = App.topic(m.topicId);
      return `<div class="ak-meta">${m.src ? `<span class="ak-src">Kaynak: ${safeUrl(m.srcUrl) ? `<a href="${esc(m.srcUrl)}" target="_blank" rel="noopener noreferrer">${esc(m.src)}</a>` : esc(m.src)}${safeUrl(m.srcUrl) ? ' · <a href="#/sources">CC BY-SA 4.0</a>' : ''}</span>` : ''}
        <div class="ak-acts">
          <button class="ak-act" data-rate="${mi}:1" aria-pressed="${m.rating === 1}" aria-label="Faydalı" title="Faydalı">👍</button>
          <button class="ak-act" data-rate="${mi}:-1" aria-pressed="${m.rating === -1}" aria-label="Faydalı değil" title="Faydalı değil">👎</button>
          <button class="ak-act ak-act-t" data-copy="${mi}">Kopyala</button>
          ${t && m.md ? `<button class="ak-act ak-act-t" data-note="${mi}" ${m.noted ? 'disabled' : ''}>${m.noted ? 'Notlarında ✓' : 'Notlarıma ekle'}</button>` : ''}
        </div></div>`;
    }
    function msgHTML(m, mi, pending) {
      if (m.role === 'user') {
        return `<div class="ak-msg ak-user" data-mi="${mi}"><span class="ak-sr">Sen: </span><div class="ak-bubble">${m.photo ? `<span class="ak-photo">${ICON.camera}<span>${esc(m.text)}</span></span>` : esc(m.text).replace(/\n/g, '<br>')}</div></div>`;
      }
      return `<div class="ak-msg ak-bot" data-mi="${mi}" ${pending ? 'aria-busy="true"' : ''}><div class="ak-av" aria-hidden="true">H</div><div class="ak-bubble"><span class="ak-sr">Hoca: </span>${pending ? `<p class="ak-typing"><span>${esc(pending)}</span><span class="ak-dots" aria-hidden="true"><i></i><i></i><i></i></span></p>` : botBody(m, mi) + metaHTML(m, mi)}</div></div>`;
    }
    function logHTML(pendingIdx, pendingLabel) {
      const th = thread();
      if (!th || !th.msgs.length) return welcomeHTML();
      return th.msgs.map((m, i) => msgHTML(m, i, i === pendingIdx ? pendingLabel : null)).join('');
    }

    function render() {
      const th = thread();
      root.innerHTML = `<div class="ak-chat ${compact ? 'ak-compact' : ''}">
        ${compact ? '' : `<aside class="ak-hist" aria-label="Sohbet geçmişi">${histHTML()}</aside><div class="ak-hist-scrim" data-act="hist"></div>`}
        <section class="ak-main" aria-label="Sohbet">
          <div class="ak-bar">
            ${compact ? '' : `<button class="btn sm ak-hist-btn" data-act="hist" aria-expanded="false">Sohbetler <span class="muted">${threads().length}</span></button>`}
            <label class="ak-ctx" for="${C.uid}-ctx"><span>Konu bağlamı</span></label>
            <select class="ak-sel" id="${C.uid}-ctx" data-ctx>${ctxOptions()}</select>
            ${!compact && th ? `<span class="ak-bar-t muted small">${esc(th.title)}</span>` : ''}
          </div>
          <div class="ak-log" role="log" aria-live="polite" aria-relevant="additions" aria-label="Mesajlar" tabindex="0">${logHTML()}</div>
          <form class="ak-comp" autocomplete="off">
            <input type="file" accept="image/*" class="ak-file" id="${C.uid}-file" hidden>
            <button type="button" class="ak-ib" data-act="photo" aria-label="Fotoğraftan soru sor" title="Fotoğraftan soru sor">${ICON.camera}</button>
            <label class="ak-sr" for="${C.uid}-in">Mesajın</label>
            <textarea id="${C.uid}-in" class="ak-in" rows="1" placeholder="Hocaya bir şey sor…"></textarea>
            <button type="submit" class="ak-send" aria-label="Gönder">${ICON.send}<span>Gönder</span></button>
          </form>
          <p class="ak-demo">${DEMO_NOTE}</p>
        </section>
      </div>`;
      bind(); scrollEnd(true);
      if (opts.onCtx) opts.onCtx(ctxId());
    }
    function refreshHist() { const h = $('.ak-hist'); if (h) h.innerHTML = histHTML(); const b = $('.ak-hist-btn .muted'); if (b) b.textContent = threads().length; }
    function scrollEnd(force) {
      const log = $('.ak-log'); if (!log) return;
      const near = log.scrollHeight - log.scrollTop - log.clientHeight < 140;
      if (force || near) log.scrollTop = log.scrollHeight;
    }
    function setSendMode(stop) {
      const b = $('.ak-send'); if (!b) return;
      b.classList.toggle('is-stop', stop);
      b.innerHTML = stop ? ICON.stop + '<span>Durdur</span>' : ICON.send + '<span>Gönder</span>';
      b.setAttribute('aria-label', stop ? 'Yanıtı durdur' : 'Gönder');
      const ph = $('[data-act="photo"]'); if (ph) ph.disabled = stop;
    }
    function replaceMsg(mi) {
      const th = thread(); const el = root.querySelector(`.ak-log [data-mi="${mi}"]`);
      if (!th || !el) return;
      const tmp = document.createElement('div'); tmp.innerHTML = msgHTML(th.msgs[mi], mi); el.replaceWith(tmp.firstElementChild);
    }

    // ---- gönderim + akış ----
    function ensureThread(title) {
      let th = thread();
      if (!th) {
        th = { id: App.uid('th'), title: title.slice(0, 52) + (title.length > 52 ? '…' : ''), topicId: S.pendingTopic || null, lastTopic: null, at: nowISO(), msgs: [] };
        threads().unshift(th); S.activeId = th.id; S.pendingTopic = null;
        if (threads().length > 30) threads().length = 30;
      } else { const arr = threads(); const i = arr.indexOf(th); if (i > 0) { arr.splice(i, 1); arr.unshift(th); } }
      th.at = nowISO();
      return th;
    }
    function send(text, photoName) {
      text = String(text || '').trim();
      if (C.busy || (!text && !photoName)) return;
      const th = ensureThread(photoName ? 'Fotoğraftan soru' : text);
      th.msgs.push(photoName ? { role: 'user', text: 'Fotoğraf: ' + photoName, photo: true, at: nowISO() } : { role: 'user', text, at: nowISO() });
      const r = photoName ? photoReply(th.topicId, th.lastTopic) : reply(text, th.topicId, th.lastTopic);
      if (r.topicId) th.lastTopic = r.topicId;
      const m = Object.assign({ role: 'bot', at: nowISO(), rating: 0, links: [], chips: [] }, r);
      th.msgs.push(m); App.save();
      dailyXP();
      // Kayıtta tam yanıt durur; akış yalnızca görsel. Durdurulursa kayıt kısaltılır.
      const mi = th.msgs.length - 1;
      $('.ak-log').innerHTML = logHTML(mi, photoName ? 'Görsel okunuyor…' : 'Hoca yazıyor…');
      refreshHist();
      const bt = $('.ak-bar-t'); if (bt) bt.textContent = th.title; else if (!compact) { const sel = $('.ak-sel'); sel && sel.insertAdjacentHTML('afterend', `<span class="ak-bar-t muted small">${esc(th.title)}</span>`); }
      scrollEnd(true);
      stream(mi, photoName ? 1500 : 650);
    }
    function stream(mi, delay) {
      const th = thread(); const m = th.msgs[mi];
      C.busy = true; setSendMode(true);
      const words = String(m.md).match(/\S+\s*/g) || [];
      C.stream = { mi, shown: 0, words, thId: th.id };
      const finish = () => { C.timer = null; C.stream = null; C.busy = false; replaceMsg(mi); setSendMode(false); scrollEnd(); };
      if (reduced()) { C.timer = setTimeout(finish, 120); return; }
      C.timer = setTimeout(function startStream() {
        const el = root.querySelector(`.ak-log [data-mi="${mi}"] .ak-bubble`); if (!el) return finish();
        el.innerHTML = '<span class="ak-sr">Hoca: </span><div class="ak-md"></div>';
        const out = el.querySelector('.ak-md');
        const tick = () => {
          const st = C.stream; if (!st) return;
          st.shown = Math.min(words.length, st.shown + 1 + (Math.random() < .45 ? 1 : 0));
          out.innerHTML = md(words.slice(0, st.shown).join('')) ;
          out.insertAdjacentHTML('beforeend', '<span class="ak-caret" aria-hidden="true"></span>');
          scrollEnd();
          if (st.shown >= words.length) { C.timer = setTimeout(finish, 120); return; }
          C.timer = setTimeout(tick, 34 + Math.random() * 40);
        };
        tick();
      }, delay);
    }
    function stop() {
      const st = C.stream; if (!st) return;
      clearTimeout(C.timer); C.timer = null;
      const th = getThread(st.thId); const m = th && th.msgs[st.mi];
      if (m) { m.md = st.words.slice(0, st.shown).join('').trim(); m.stopped = true; m.quiz = []; m.links = []; m.chips = []; App.save(); }
      C.stream = null; C.busy = false; replaceMsg(st.mi); setSendMode(false);
      const inp = $('.ak-in'); inp && inp.focus();
    }

    // ---- etkileşim ----
    function copyText(txt) {
      const done = () => App.toast('Yanıt kopyalandı');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done));
      else fallbackCopy(txt, done);
    }
    function fallbackCopy(txt, done) {
      const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { App.toast('Kopyalanamadı', 'err'); } ta.remove();
    }
    function onClick(e) {
      const b = e.target.closest('button, [data-act]'); if (!b || !root.contains(b)) return;
      const th = thread(); const d = b.dataset;
      if (d.chip) { send(d.chip); return; }
      if (d.act === 'new') { if (C.busy) stop(); S.activeId = null; S.pendingTopic = null; render(); $('.ak-in').focus(); return; }
      if (d.act === 'hist') { const ch = $('.ak-chat'); const open = ch.classList.toggle('ak-hist-open'); const hb = $('.ak-hist-btn'); hb && hb.setAttribute('aria-expanded', open); return; }
      if (d.act === 'photo') { $('.ak-file').click(); return; }
      if (d.th) { if (C.busy) stop(); S.activeId = d.th; S.pendingTopic = null; render(); return; }
      if (d.del) {
        const t = getThread(d.del);
        App.confirm('“' + esc(t ? t.title : '') + '” sohbeti silinsin mi?', () => { if (C.busy) stop(); const arr = threads(); const i = arr.findIndex(x => x.id === d.del); if (i >= 0) arr.splice(i, 1); if (S.activeId === d.del) S.activeId = null; App.save(); render(); App.toast('Sohbet silindi'); });
        return;
      }
      if (!th) return;
      if (d.opt) {
        const [mi, qi, oi] = d.opt.split(':').map(Number); const m = th.msgs[mi]; const qz = m && m.quiz && m.quiz[qi]; if (!qz || qz.picked !== null) return;
        qz.picked = oi; const q = App.question(qz.key);
        if (q) { if (oi === q.answer) App.addXP(2, 'Hocaya Sor sorusu'); else { const me = App.me(); if (!me.wrongs.includes(qz.key)) me.wrongs.push(qz.key); } }
        App.save(); replaceMsg(mi);
        const next = root.querySelector(`.ak-log [data-mi="${mi}"] .ak-q:not(.is-ok):not(.is-err) .ak-opt`) || root.querySelector(`.ak-log [data-mi="${mi}"] .ak-q-score`);
        if (next && next.focus) { if (next.tagName === 'BUTTON') next.focus(); }
        return;
      }
      if (d.rate) {
        const [mi, v] = d.rate.split(':').map(Number); const m = th.msgs[mi]; if (!m) return;
        m.rating = m.rating === v ? 0 : v; App.save();
        root.querySelectorAll(`[data-rate^="${mi}:"]`).forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.rate.split(':')[1] === m.rating)));
        if (m.rating) App.toast(m.rating === 1 ? 'Teşekkürler, işine yaradığına sevindim' : 'Geri bildirimin için teşekkürler');
        return;
      }
      if (d.copy !== undefined) { const m = th.msgs[+d.copy]; if (m) copyText(plain(m.md)); return; }
      if (d.note !== undefined) {
        const m = th.msgs[+d.note]; const t = m && App.topic(m.topicId); if (!t) return;
        const me = App.me(); const cur = (me.notes[t.id] || '').replace(/\s+$/, '');
        me.notes[t.id] = (cur ? cur + '\n\n' : '') + '— Hocaya Sor —\n' + plain(m.md);
        m.noted = true; App.save(); replaceMsg(+d.note);
        App.toast('Notlarına eklendi · ' + t.title);
      }
    }
    function bind() {
      root.onclick = onClick;
      const form = $('.ak-comp'), inp = $('.ak-in');
      form.onsubmit = (e) => { e.preventDefault(); if (C.busy) { stop(); return; } const v = inp.value; if (!v.trim()) return; inp.value = ''; grow(); send(v); };
      const grow = () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 150) + 'px'; };
      inp.oninput = grow;
      inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.onsubmit(e); } };
      $('.ak-sel').onchange = (e) => {
        const v = e.target.value || null; const th = thread();
        if (th) th.topicId = v; else S.pendingTopic = v;
        App.save();
        if (!th || !th.msgs.length) { $('.ak-log').innerHTML = welcomeHTML(); }
        refreshHist();
        if (opts.onCtx) opts.onCtx(v);
      };
      $('.ak-file').onchange = (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) send('', f.name); };
    }

    render();
    return {
      root,
      focus() { const i = $('.ak-in'); i && i.focus(); },
      newThread(topicId) { if (C.busy) stop(); S.activeId = null; S.pendingTopic = topicId || null; render(); },
      destroy() { clearTimeout(C.timer); C.timer = null; C.stream = null; C.busy = false; root.onclick = null; }
    };
  }

  // ---------- /ask tam sayfa ----------
  App.route('/ask', () => `<div class="ak-page">
      <header class="ak-head">
        <div><h1>Hocaya Sor</h1><p class="muted">Kurslarındaki içerikten konu özeti, zihin haritası ve mini test. Her yanıtın altında kaynağı yazar.</p></div>
      </header>
      <div class="ak-host"></div>
    </div>`, {
    title: 'Hocaya Sor', wide: true,
    after() {
      const q = App.query();
      if (q.topic && App.topic(q.topic)) { const th = getThread(S.activeId); if (!th || th.topicId !== q.topic) { S.activeId = null; S.pendingTopic = q.topic; } }
      const host = document.querySelector('.ak-host'); if (!host) return;
      const chat = createChat(host, {});
      App.onLeave(() => chat.destroy());
    }
  });

  // ---------- Yüzen buton + yan panel ----------
  const P = { fab: null, wrap: null, chat: null, open: false, routeTopic: null, lastFocus: null, closeT: null };
  function ensurePanel() {
    if (P.fab) return;
    P.fab = document.createElement('button');
    P.fab.className = 'ak-fab'; P.fab.type = 'button'; P.fab.hidden = true;
    P.fab.setAttribute('aria-haspopup', 'dialog'); P.fab.setAttribute('aria-controls', 'ak-panel'); P.fab.setAttribute('aria-expanded', 'false');
    P.fab.innerHTML = '<span class="ak-fab-m" aria-hidden="true">H</span><span class="ak-fab-l">Hocaya sor</span>';
    P.fab.onclick = () => (P.open ? closePanel() : openPanel());
    P.wrap = document.createElement('div');
    P.wrap.className = 'ak-pwrap'; P.wrap.hidden = true;
    P.wrap.innerHTML = `<div class="ak-scrim" data-pclose></div>
      <section class="ak-panel" id="ak-panel" role="dialog" aria-modal="true" aria-labelledby="ak-ptitle" aria-describedby="ak-pctx">
        <header class="ak-phead">
          <div class="ak-av" aria-hidden="true">H</div>
          <div class="ak-ptitles"><h2 id="ak-ptitle" class="serif">Hocaya Sor</h2><small id="ak-pctx" class="ak-pctx"></small></div>
          <button class="ak-hb" type="button" data-pnew aria-label="Yeni sohbet" title="Yeni sohbet">${ICON.plus}</button>
          <a class="ak-hb" href="#/ask" aria-label="Tam sayfada aç" title="Tam sayfada aç">${ICON.expand}</a>
          <button class="ak-hb" type="button" data-pclose aria-label="Paneli kapat" title="Kapat (Esc)">${ICON.close}</button>
        </header>
        <div class="ak-pbody"></div>
      </section>`;
    P.wrap.addEventListener('click', (e) => {
      if (e.target.closest('[data-pclose]')) { closePanel(); return; }
      if (e.target.closest('[data-pnew]')) { P.chat && P.chat.newThread(P.routeTopic); P.chat && P.chat.focus(); }
    });
    P.wrap.addEventListener('keydown', onPanelKey);
    document.body.appendChild(P.fab); document.body.appendChild(P.wrap);
  }
  function setCtxLabel(tid) {
    const el = P.wrap && P.wrap.querySelector('.ak-pctx'); if (!el) return;
    const t = App.topic(tid); el.textContent = t ? 'Bağlam: ' + t.title : 'Genel sohbet · bağlam seçilmedi';
  }
  function focusables() {
    return Array.from(P.wrap.querySelectorAll('.ak-panel a[href], .ak-panel button:not([disabled]), .ak-panel select, .ak-panel textarea, .ak-panel input:not([hidden]):not([type="file"]), .ak-panel [tabindex]:not([tabindex="-1"])')).filter(el => el.offsetParent !== null || el === document.activeElement);
  }
  function onPanelKey(e) {
    if (!P.open) return;
    if (e.key === 'Escape') { e.preventDefault(); closePanel(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !P.wrap.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function onDocFocus(e) { if (P.open && P.wrap && !P.wrap.contains(e.target) && !document.getElementById('modal-root').contains(e.target)) { const f = focusables(); f.length && f[0].focus(); } }
  function openPanel() {
    ensurePanel(); if (P.open) return;
    clearTimeout(P.closeT);
    if (P.routeTopic) { const th = getThread(S.activeId); if (!th || th.topicId !== P.routeTopic) { S.activeId = null; S.pendingTopic = P.routeTopic; } }
    P.lastFocus = document.activeElement;
    P.open = true; P.wrap.hidden = false;
    document.documentElement.classList.add('ak-locked');
    P.fab.setAttribute('aria-expanded', 'true');
    P.chat = createChat(P.wrap.querySelector('.ak-pbody'), { compact: true, onCtx: setCtxLabel });
    P.chat.focus();
    requestAnimationFrame(() => { if (P.open) P.wrap.classList.add('open'); });
    document.addEventListener('focusin', onDocFocus);
  }
  function closePanel(silent) {
    if (!P.open) return;
    P.open = false;
    document.removeEventListener('focusin', onDocFocus);
    if (P.chat) { P.chat.destroy(); P.chat = null; }
    P.wrap.classList.remove('open');
    document.documentElement.classList.remove('ak-locked');
    P.fab.setAttribute('aria-expanded', 'false');
    const done = () => { if (!P.open) { P.wrap.hidden = true; P.wrap.querySelector('.ak-pbody').innerHTML = ''; } };
    if (reduced()) done(); else P.closeT = setTimeout(done, 220);
    if (!silent && P.lastFocus && document.contains(P.lastFocus)) P.lastFocus.focus(); else if (!silent && !P.fab.hidden) P.fab.focus();
  }

  App.afterRender.push((path, params, hasLayout) => {
    ensurePanel();
    if (P.open) closePanel(true);
    P.routeTopic = path.startsWith('/learn/') && params && params.topicId && App.topic(params.topicId) ? params.topicId : null;
    const show = !!(hasLayout && App.user && path !== '/ask');
    P.fab.hidden = !show;
    P.fab.setAttribute('aria-label', P.routeTopic ? 'Hocaya sor: ' + App.topic(P.routeTopic).title : 'Hocaya sor');
  });

  window.AskHoca = { open: openPanel, close: closePanel, reply, md };
})();
