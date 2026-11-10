// Tanıtım (landing) sayfası — bilgisayar bölümü öğrencileri için kendi kendine öğrenme platformu.
// Animasyon yığını (GSAP + ScrollTrigger + SplitText + CustomEase + Lenis) route açılınca dinamik yüklenir;
// yüklenemezse sayfa CSS/IO animasyonlarıyla çalışır. Sayfadan çıkınca her şey temizlenir.
(function () {
  const EGGS = {
    konami: 'Konami kodu → mezuniyet',
    logo: 'Logoya 5 kez tıkla',
    kahve: '"kahve" yaz',
    dot: 'Başlığın noktası',
    stat: 'Memnuniyet oranına 3 kez tıkla',
    quiz: 'Mini testi doğru çöz'
  };
  const found = new Set();
  try { JSON.parse(localStorage.getItem('kampus-eggs') || '[]').forEach(k => found.add(k)); } catch (e) {}

  const COURSES = ['Programlamaya Giriş', 'Veri Yapıları', 'Algoritmalar', 'İşletim Sistemleri', 'Veritabanı Sistemleri', 'Bilgisayar Ağları', 'Bağlı liste', 'Büyük O gösterimi', 'İkili arama ağacı', 'SQL', 'Özyineleme', 'TCP/IP'];

  // Öğrenmenin 6 yolu (yatay kaydırma)
  const WAYS = [
    { t: 'Video ders', d: 'Kısa, bölümlenmiş anlatımlar. 1,5× hız, bölüm atlama ve kaldığın saniyeden devam.', v: 'video' },
    { t: 'Konu anlatımı', d: 'Okumayı sevenlere sade metin, çözümlü örnekler ve sayfa sonunda tek ekranlık özet.', v: 'read' },
    { t: 'Zihin haritası', d: 'Konuyu kuşbakışı gör. Dallara dokun, ilgili videoya ya da teste atla.', v: 'map' },
    { t: 'Bilgi kartları', d: 'Aralıklı tekrar algoritması unutmak üzere olduğun kartı tam zamanında önüne getirir.', v: 'cards' },
    { t: 'Konu testi', d: 'Her konunun sonunda 10–15 soru. Yanlışların otomatik olarak yanlışlar defterine düşer.', v: 'test' },
    { t: 'Deneme sınavı', d: 'Gerçek süreyle mini vize ve final denemeleri. Bitince puan, sıralama ve eksik konu analizi.', v: 'exam' }
  ];

  // Özellik panelleri
  const STEPS = [
    { k: 'Zihin haritası', t: 'Konunun haritası elinde', d: 'Veri yapılarını diziden grafa tek bakışta gör. Her dal, o başlığın videosuna, kartlarına ve testine açılır.' },
    { k: 'Bilgi kartları', t: 'Unutmadan önce tekrar', d: 'Bildiğin kart seyrekleşir, zorlandığın kart sıklaşır. Günde 15 dakika, finale kadar kalıcı.' },
    { k: 'Konu testi', t: 'Çöz, anında öğren', d: 'Her sorunun altında adım adım açıklama. Yanlışların yanlışlar defterinde seni bekler.' },
    { k: 'Deneme & analiz', t: 'Puanın neden düştü?', d: 'Deneme sonrası ders ve konu bazında doğru sayısı, süre analizi ve “önce bunları çalış” listesi.' },
    { k: 'Seri & plan', t: 'Her gün biraz, ama her gün', d: 'Pomodoro sayacı, haftalık çalışma planı, seri takvimi, XP ve haftalık lig. Motivasyon şansa kalmasın.' }
  ];

  // Öğrenme yolları (sticky yığın)
  const PATHS = [
    { tag: 'En popüler', t: 'Bilgisayar Bilimi Temelleri', m: '16 hafta · 6 ders · haftalık mini vize', s: ['Programlamaya Giriş', 'Veri Yapıları', 'Algoritmalar', 'Veritabanı Sistemleri'], p: 34 },
    { tag: 'Staj & iş', t: 'Teknik Mülakat Hazırlığı', m: '8 hafta · günlük 20 dk · soru çözümü', s: ['Büyük O gösterimi', 'Diziler & bağlı liste', 'Ağaçlar & graflar', 'Deneme mülakatı'], p: 52 },
    { tag: 'Sistem', t: 'Sistem ve Ağ', m: '12 hafta · İşletim Sistemleri + Bilgisayar Ağları', s: ['Süreçler & iş parçacıkları', 'Bellek yönetimi', 'TCP/IP', 'Yönlendirme'], p: 18 }
  ];

  const GSAP_CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/';
  const CDN = {
    'gsap.min.js': GSAP_CDN + 'gsap.min.js',
    'ScrollTrigger.min.js': GSAP_CDN + 'ScrollTrigger.min.js',
    'SplitText.min.js': GSAP_CDN + 'SplitText.min.js',
    'CustomEase.min.js': GSAP_CDN + 'CustomEase.min.js',
    'lenis.min.js': 'https://cdn.jsdelivr.net/npm/lenis@1.3.27/dist/lenis.min.js',
    'lenis.css': 'https://cdn.jsdelivr.net/npm/lenis@1.3.27/dist/lenis.css'
  };

  // Buton metni: hover'da yukarı kayar, alttan aynısı gelir (kopya CSS ile üretilir; DOM metni tek kalır)
  const R = (t) => `<span class="hm-roll" data-t="${t}"><span>${t}</span></span>`;

  // ---------- Görseller ----------
  function mock() {
    return `
    <div class="hm-window">
      <div class="hm-win-bar"><i></i><i></i><i></i><span>kampus.app/bugun</span></div>
      <div class="hm-win-body">
        <div class="hm-win-side">
          <b class="hm-mark sm">K</b>
          ${['Bugün', 'Kurslarım', 'Bilgi kartları', 'Denemeler', 'Yanlışlar defteri', 'Lig'].map((x, i) => `<span class="${i === 0 ? 'on' : ''}">${x}</span>`).join('')}
        </div>
        <div class="hm-win-main">
          <div class="hm-win-top">
            <div><small>10 KASIM SALI</small><h4>Günaydın, Elif</h4></div>
            <div class="hm-chips"><span>🔥 <b>23</b> gün seri</span><span>⚡ 1.240 XP</span><span class="hide-sm">📅 Vize’ye 12 gün</span></div>
          </div>
          <div class="hm-win-grid">
            <div class="hm-goal">
              <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="bg" cx="60" cy="60" r="52"/><circle class="fg" cx="60" cy="60" r="52"/><circle class="tip" cx="112" cy="60" r="1"/></svg>
              <div class="hm-goal-t"><b>40</b><span>/ 60 dk</span></div>
              <p>Günlük hedef</p>
            </div>
            <div class="hm-resume">
              <em>KALDIĞIN YERDEN DEVAM</em>
              <strong>Bağlı liste · Tek yönlü</strong>
              <span>Veri Yapıları · Video <span class="hm-vt">08:42</span> / 14:10</span>
              <div class="hm-bar"><span style="--w:61%"></span></div>
              <b class="hm-play" aria-hidden="true"><i class="rp"></i><span class="a">▶</span><span class="b"></span></b>
              <i class="hm-ghost" aria-hidden="true"><svg viewBox="0 0 18 18"><path d="M1.5 1.5l5.2 14.2 2.3-5.9 5.9-2.3z"/></svg></i>
            </div>
            <div class="hm-plan hm-weak">
              <em>EKSİK KONULARIN</em>
              <ul>
                <li><span>Büyük O gösterimi</span><b data-pct="33">%33</b></li><li><span>İkili arama ağacı</span><b data-pct="50">%50</b></li><li><span>SQL birleştirmeleri</span><b data-pct="50">%50</b></li>
              </ul>
              <small>Bugün: Büyük O gösterimi · 15 dk →</small>
            </div>
          </div>
          <div class="hm-win-cards">
            ${[['DERS', 'Veri Yapıları', 62], ['DERS', 'Algoritmalar', 38], ['DERS', 'Veritabanı Sistemleri', 81]].map(([c, t, p], i) => `
              <div class="hm-win-card" style="--d:${i * 120}ms"><em>${c}</em><strong>${t}</strong><div class="hm-bar"><span style="--w:${p}%"></span></div><small>%${p}</small></div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
  }

  function wayVisual(v) {
    if (v === 'video') return `<div class="hm-w-video"><div class="scr"><b>▶</b><span>Bağlı liste</span><i>1,5×</i></div><div class="tl"><span></span><u style="left:22%"></u><u style="left:48%"></u><u style="left:77%"></u></div><small>08:42 / 14:10</small></div>`;
    if (v === 'read') return `<div class="hm-w-read"><b>Bağlı liste nedir?</b><span></span><span></span><span class="mk"></span><span style="width:70%"></span><div class="sum">Özet · 1 ekran</div></div>`;
    if (v === 'map') return `<svg class="hm-w-map" viewBox="0 0 240 150" aria-hidden="true"><g class="ln"><path d="M120 75 L44 30"/><path d="M120 75 L200 28"/><path d="M120 75 L40 122"/><path d="M120 75 L204 120"/></g><g class="nd"><circle cx="44" cy="30" r="9"/><circle cx="200" cy="28" r="9"/><circle cx="40" cy="122" r="9"/><circle cx="204" cy="120" r="9"/></g><rect class="core" x="88" y="61" width="64" height="28" rx="14"/><text x="120" y="79">Ağaç</text></svg>`;
    if (v === 'cards') return `<div class="hm-w-cards"><div></div><div></div><div class="top"><small>Veri Yapıları</small><b>Yığın hangi sırayla çalışır?</b><span><i>Tekrar</i><i>Zor</i><i class="ok">Kolay</i></span></div></div>`;
    if (v === 'test') return `<div class="hm-w-test"><small>Soru 7 / 15</small>${['A) O(1)', 'B) O(n)', 'C) O(log n)', 'D) O(n²)'].map((x, i) => `<span class="${i === 2 ? 'ok' : ''}">${x}</span>`).join('')}</div>`;
    return `<div class="hm-w-exam"><div class="tm"><small>Mini Vize #3</small><b>00:42:40</b></div><div class="grid">${Array.from({ length: 40 }, (_, i) => `<i class="${i < 27 ? 'a' : ''}${i === 9 || i === 21 ? ' x' : ''}"></i>`).join('')}</div></div>`;
  }

  function stepVisual(i) {
    if (i === 0) {
      const nodes = [['Dizi', 48, 40], ['Bağlı liste', 300, 34], ['Yığın & kuyruk', 40, 196], ['Ağaç', 306, 204], ['Graf', 174, 250]];
      return `<div class="hm-vis hm-vis-map"><svg viewBox="0 0 360 280" aria-hidden="true">
        ${nodes.map(([, x, y], j) => `<path pathLength="1" style="--d:${j * 150}ms" d="M180 130 Q ${(180 + x) / 2} ${y < 130 ? y + 30 : y - 30} ${x} ${y}"/>`).join('')}
        <g class="core-g"><rect class="core" x="110" y="110" width="140" height="40" rx="20"/><circle class="sock" cx="129" cy="130" r="5.5"/><text class="core-t" x="189" y="135.5">Veri yapıları</text></g>
        ${nodes.map(([t, x, y], j) => `<g class="n" style="--d:${500 + j * 150}ms"><rect x="${x - 50}" y="${y - 15}" width="100" height="30" rx="15"/><text x="${x}" y="${y + 5}">${t}</text></g>`).join('')}
      </svg></div>`;
    }
    if (i === 1) return `<div class="hm-vis hm-vis-flip">
        <div class="fc"><div class="fc-in"><div class="f"><small>Veri Yapıları · Yığın</small><b>Yığın hangi sırayla çalışır?</b><span>Çevirmek için dokun</span></div><div class="b"><small>Cevap</small><b>LIFO</b><span>Son giren ilk çıkar</span></div></div></div>
        <div class="ivl">${['1 gün', '3 gün', '7 gün', '16 gün', '35 gün'].map((x, j) => `<span style="--d:${j * 160}ms">${x}</span>`).join('<i>→</i>')}</div></div>`;
    if (i === 2) return `<div class="hm-vis hm-vis-quiz" id="hm-quiz">
        <p>İkili aramanın zaman karmaşıklığı nedir?</p>
        ${['O(n)', 'O(n²)', 'O(log n)', 'O(1)'].map((o, j) => `<button data-q="${j}"><b>${'ABCD'[j]}</b>${o}</button>`).join('')}
        <small class="hm-quiz-msg"></small></div>`;
    if (i === 3) return `<div class="hm-vis hm-vis-net">
        <div class="hd"><span>Mini vize puanları</span><b>+27 puan</b></div>
        <div class="hm-vis-bars">${[61, 66, 64, 72, 79, 88].map((v, j) => `<div style="--d:${j * 110}ms"><span style="--h:${Math.round(v / 1.2)}%"><em>${v}</em></span><small>D${j + 2}</small></div>`).join('')}</div>
        <div class="miss"><span>Eksik: <b>Büyük O</b> · 4 yanlış</span><span>Eksik: <b>SQL</b> · süre</span></div></div>`;
    const lv = [0, 1, 2, 1, 3, 2, 0, 1, 2, 3, 3, 1, 2, 2, 3, 2, 1, 3, 3, 2, 1, 2, 3, 3, 2, 3, 3, 1, 2, 3, 3, 3, 2, 3, 3];
    return `<div class="hm-vis hm-vis-streak">
        <div class="hd"><b>🔥 23 gün</b><span>Bu hafta 6 / 7 gün · 4 s 20 dk</span></div>
        <div class="cal">${lv.map((l, j) => `<i class="l${l}" style="--d:${j * 22}ms"></i>`).join('')}</div>
        <div class="pomo"><span>Pomodoro</span><b>25:00</b><span>Odak · 2 / 4</span></div></div>`;
  }

  // Son 6 denemenin puan çizgisi (ürün anı); son nokta hardal noktanın durağıdır
  function sparkline() {
    const v = [61, 66, 64, 72, 79, 88], pt = v.map((y, i) => [6 + i * 21.6, 40 - (y - 58) * 1.1]);
    const last = pt[pt.length - 1];
    return `<div class="hm-sparkl"><svg viewBox="0 0 120 44" aria-hidden="true"><path pathLength="1" d="M${pt.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L')}"/><circle class="pt" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4"/></svg><small>SON 6 DENEME</small></div>`;
  }

  App.route('/home', () => `
  <div class="hm pending" id="hm">
    <div class="hm-progress"><span id="hm-prog"></span></div>
    <header class="hm-nav" id="hm-nav">
      <a class="hm-brand" id="hm-logo" href="#/home"><b class="hm-mark">K</b><span>Kampüs</span></a>
      <nav class="hm-links">
        <a data-scroll="hm-ways">6 yol</a><a data-scroll="hm-features">Özellikler</a><a data-scroll="hm-paths">Öğrenme yolları</a>
      </nav>
      <div class="hm-nav-cta">
        <span class="hm-eggs" id="hm-eggs" title="Gizli sürprizler">🥚 <b>${found.size}</b>/6</span>
        <a class="hm-btn ghost" href="#/login">${R('Giriş')}</a>
        <button class="hm-btn" data-start>${R('Eksiklerimi bul')}</button>
      </div>
    </header>

    <section class="hm-hero">
      <p class="hm-eyebrow hm-in" style="--d:0ms"><span class="hm-live"></span><span class="hm-eyebrow-t" id="hm-eyebrow">Bilgisayar bölümü öğrencileri için · Ücretsiz</span></p>
      <h1 class="hm-title" id="hm-title">Eksiğini bul.<br><i>Kendi yolunla</i> <span class="hm-nw">kapat<span class="hm-dot" id="hm-dot">.</span></span></h1>
      <p class="hm-sub hm-in" style="--d:120ms">Kampüs 2 dakikada zayıf konularını çıkarır, her gün ne çalışacağını söyler.<br>Video, zihin haritası, bilgi kartı ya da deneme — sana hangisi uyuyorsa.</p>
      <div class="hm-ctas hm-in" style="--d:180ms">
        <button class="hm-btn lg hm-magnet" data-start>${R('Eksiklerimi bul')} <span>→</span></button>
        <button class="hm-btn lg ghost hm-magnet" data-scroll="hm-showcase">${R('Nasıl çalıştığını gör ↓')}</button>
      </div>
      <p class="hm-cta-note hm-in" style="--d:240ms">2 dakikalık seviye analizi · Kayıt gerekmez · <a data-demo="u1">Hazır demo hesabıyla gez</a></p>
    </section>

    <section class="hm-showcase" id="hm-showcase">
      <div class="hm-stage" id="hm-stage"><div class="hm-tilt" id="hm-tilt">${mock()}</div></div>
    </section>

    <section class="hm-marquee" aria-hidden="true">
      <div class="hm-track" data-speed="0.92">${[...COURSES, ...COURSES].map(c => `<span>${c}</span><b>✦</b>`).join('')}</div>
      <div class="hm-track rev" data-speed="1.06">${[...COURSES, ...COURSES].reverse().map(c => `<span>${c}</span><b>✦</b>`).join('')}</div>
    </section>

    <section class="hm-ways" id="hm-ways">
      <div class="hm-ways-head">
        <p class="hm-kicker">Öğrenmenin 6 yolu</p>
        <h2 class="hm-h2">Herkes aynı şekilde öğrenmez.<br><i>Sen seçersin.</i></h2>
      </div>
      <div class="hm-ways-view" id="hm-ways-view">
        <div class="hm-ways-track" id="hm-ways-track">
          ${WAYS.map((w, i) => `
            <article class="hm-way">
              <div class="hm-way-vis">${wayVisual(w.v)}</div>
              <span class="hm-way-n">0${i + 1}</span>
              <h3>${w.t}</h3><p>${w.d}</p>
            </article>`).join('')}
          <article class="hm-way hm-way-end">
            <h3>Hepsi aynı konunun etrafında.</h3>
            <p>Bağlı liste videosunu izle, haritasına bak, kartlarını çevir, testini çöz. İlerlemen tek bir yerde birikir.</p>
            <button class="hm-btn" data-demo="u1">${R('Bir konu seç')} <span>→</span></button>
          </article>
        </div>
      </div>
    </section>

    <section class="hm-features" id="hm-features">
      <div class="hm-sticky">
        <p class="hm-kicker">Çalışma masan</p>
        <h2 class="hm-h2">Ne çalışacağını düşünme. <i>Çalış.</i></h2>
        <ol class="hm-steps" id="hm-steps">${STEPS.map((s, i) => `<li data-i="${i}" class="${i === 0 ? 'on' : ''}"><span>0${i + 1}</span>${s.k}</li>`).join('')}</ol>
      </div>
      <div class="hm-panels">
        ${STEPS.map((s, i) => `
          <article class="hm-panel" data-i="${i}">
            <div class="hm-panel-vis">${stepVisual(i)}</div>
            <h3>${s.t}</h3><p>${s.d}</p>
          </article>`).join('')}
      </div>
    </section>

    <section class="hm-moment" id="hm-moment">
      <div class="hm-moment-frame" id="hm-moment-frame">
        <div class="hm-moment-in">
          <div class="hm-moment-copy" data-speed="0.94">
            <p class="hm-kicker">Deneme analizi</p>
            <h2>Deneme bitti.<br><i>Eksiğin belli.</i></h2>
            <p>Her denemeden sonra Kampüs sonucunu konu konu ayırır ve yalnızca eksik olduğun yerler için kısa bir çalışma listesi çıkarır.</p>
          </div>
          <div class="hm-report" id="hm-report">
            <div class="hm-report-top">
              <div><small>TEMEL DERSLER MİNİ VİZE · 10 KASIM</small><b>88 <span>puan</span></b></div>
              ${sparkline()}
              <div class="rank"><small>Sıralama</small><b>İlk %5</b></div>
            </div>
            <div class="hm-report-rows">
              ${[['Veri Yapıları', 9, 10], ['Algoritmalar', 7, 10], ['Veritabanı', 8, 10], ['Ağlar', 6, 10]].map(([n, v, max]) => `
                <div><span>${n}</span><div class="t"><i style="--w:${(v / max * 100).toFixed(0)}%"></i></div><b>${v}/${max}</b></div>`).join('')}
            </div>
            <div class="hm-report-todo">
              <small>ÖNCE BUNLARI ÇALIŞ</small>
              ${[['Büyük O', '4 yanlış', '12 dk video · 15 soru'], ['SQL', 'süre aşımı', '20 dk hız çalışması'], ['TCP/IP', '3 boş', 'Zihin haritası · 10 kart']].map(([t, w, a]) => `<div><b>${t}</b><span>${w}</span><em>${a}</em></div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="hm-stats" id="hm-stats">
      ${[[12400, '', 'aktif öğrenci'], [480, '', 'konu anlatımı'], [94, '%', 'memnuniyet', 'stat'], [1.2, 'M', 'çözülen soru']].map(([n, u, l, egg]) => `
        <div class="hm-stat hm-reveal" ${egg ? 'id="hm-stat-egg"' : ''}><b data-count="${n}" data-unit="${u}">${fmt(n, u)}</b><span>${l}</span></div>`).join('')}
      <p class="hm-fine">* Demo rakamlar. Prototiptir, gerçek veri yoktur.</p>
    </section>

    <section class="hm-quote">
      <p id="hm-words">Vize puanım 61’den 88’e çıktı. Sihir yok: her akşam yirmi dakika kart, haftada bir deneme ve hiç kapatmadığım bir <span class="hm-ul">yanlışlar defteri<svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M3 7.5 C 28 3, 52 10.5, 88 6 S 150 3.5, 197 7"/></svg></span>.</p>
      <cite>— Elif Y., bilgisayar mühendisliği 2. sınıf <em>(hayali)</em></cite>
    </section>

    <section class="hm-paths" id="hm-paths">
      <div class="hm-paths-head">
        <p class="hm-kicker">Öğrenme yolları</p>
        <h2 class="hm-h2">Nereden başlayacağını<br>biz çizdik.</h2>
        <p class="hm-paths-lead">Her yol haftalara bölünmüş bir yol haritası: hangi gün hangi video, hangi kart, hangi deneme.</p>
      </div>
      <div class="hm-stack">
        ${PATHS.map((p, i) => `
          <article class="hm-path c${i + 1}" style="--i:${i}">
            <div class="hm-path-l">
              <span class="hm-path-tag">${p.tag}</span>
              <h3>${p.t}</h3>
              <p>${p.m}</p>
              <button class="hm-btn" data-demo="u1">${R('Bu yolu başlat')} <span>→</span></button>
            </div>
            <ol class="hm-path-r">${p.s.map((s, j) => `<li><span>${j + 1}. etap</span>${s}</li>`).join('')}</ol>
            <div class="hm-path-bar"><span style="width:${p.p}%"></span><small>Öğrencilerin ortalama ilerlemesi %${p.p}</small></div>
          </article>`).join('')}
      </div>
    </section>

    <section class="hm-final">
      <h2 class="hm-final-title hm-reveal">Bugün 20 dakikan var mı?<br><i>Başlayalım.</i></h2>
      <button class="hm-btn lg hm-magnet hm-reveal" data-demo="u1">${R('Ücretsiz başla')} <span>→</span></button>
      <p class="hm-hint hm-reveal">İpucu: Bu sayfada 6 sürpriz saklı. Klavye de işe yarayabilir. ↑↑↓↓</p>
    </section>

    <footer class="hm-foot">
      <span><b class="hm-mark sm">K</b> Kampüs — tasarım prototipi</span>
      <span class="hm-foot-src">İçerikler Vikipedi ve Open Trivia DB'den alınmıştır (CC BY-SA 4.0) · <a href="#/sources">Kaynaklar</a></span>
      <span>Gerçek bağlantı yok · 2026</span>
    </footer>
    <div class="hm-layer" id="hm-layer"></div>
  </div>`, {
    title: 'Hoş geldin',
    layout: false,
    after: bind
  });

  function fmt(v, unit) {
    const dec = (+v) % 1 ? 1 : 0;
    const txt = dec ? (+v).toFixed(1).replace('.', ',') : Math.round(v).toLocaleString('tr-TR');
    return unit === '%' ? '%' + txt : txt + unit;
  }

  // ---------- Kütüphane yükleyici (bir kez yüklenir, tekrar girişte yeniden kullanılır) ----------
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = false; s.crossOrigin = 'anonymous';
      s.onload = res; s.onerror = () => { s.remove(); rej(new Error(src)); };
      document.head.appendChild(s);
    });
  }
  // CDN olmazsa yerel vendor/ kopyası denenir
  const loadOne = (f, ok) => ok() ? Promise.resolve() : loadScript(CDN[f]).catch(() => loadScript('vendor/' + f));
  function loadLibs() {
    if (window._hmLibs) return window._hmLibs;
    if (!document.getElementById('hm-lenis-css')) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.id = 'hm-lenis-css'; l.href = CDN['lenis.css'];
      l.onerror = () => { l.onerror = null; l.href = 'vendor/lenis.css'; };
      document.head.appendChild(l);
    }
    window._hmLibs = loadOne('gsap.min.js', () => window.gsap)
      .then(() => Promise.all([
        loadOne('ScrollTrigger.min.js', () => window.ScrollTrigger),
        loadOne('SplitText.min.js', () => window.SplitText),
        loadOne('CustomEase.min.js', () => window.CustomEase).catch(() => {}), // isteğe bağlı: yoksa yerleşik eğriler
        loadOne('lenis.min.js', () => window.Lenis).catch(() => {})
      ]))
      .then(() => !!(window.gsap && window.ScrollTrigger && window.SplitText), () => false);
    // Başarısız olursa bir sonraki girişte yeniden denensin
    window._hmLibs.then(ok => { if (!ok) window._hmLibs = null; });
    return window._hmLibs;
  }
  const timeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(false), ms))]);

  function bind() {
    if (window._hmAbort) window._hmAbort.abort();
    const ac = new AbortController(); window._hmAbort = ac;
    const sig = { signal: ac.signal };
    const onAbort = (fn) => ac.signal.addEventListener('abort', () => { try { fn(); } catch (e) {} });
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));
    const root = $('#hm'), html = document.documentElement;
    const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
    const isReduce = () => mqReduce.matches || html.classList.contains('reduce-motion');
    const reduce = isReduce();

    // Sayfadan ayrılma: hashchange ya da #app içeriği değiştiğinde (App.render) temizle
    window.addEventListener('hashchange', () => ac.abort(), { once: true, signal: ac.signal });
    const appEl = document.getElementById('app');
    const mo = new MutationObserver(() => { if (!document.body.contains(root)) ac.abort(); });
    if (appEl) mo.observe(appEl, { childList: true });
    onAbort(() => mo.disconnect());

    // Hareket tercihi (sistem ayarı ya da html.reduce-motion sınıfı) sayfa açıkken değişirse baştan kur
    const rerender = () => { if (!ac.signal.aborted && isReduce() !== reduce && document.body.contains(root)) App.render(); };
    mqReduce.addEventListener('change', rerender, sig);
    const classMo = new MutationObserver(rerender);
    classMo.observe(html, { attributes: true, attributeFilter: ['class'] });
    onAbort(() => classMo.disconnect());

    let lenis = null, mm = null, rafFn = null, cursor = null;
    onAbort(() => {
      try { if (mm) mm.revert(); } catch (e) {}
      if (window.ScrollTrigger) { try { ScrollTrigger.getAll().forEach(t => t.kill(true)); } catch (e) {} }
      if (lenis) { try { lenis.destroy(); } catch (e) {} lenis = null; }
      if (rafFn && window.gsap) gsap.ticker.remove(rafFn);
      if (window.gsap) gsap.ticker.lagSmoothing(500, 33);
      if (cursor) cursor.remove();
      document.querySelectorAll('.hm-cursor').forEach(n => n.remove());
      document.querySelectorAll('.pin-spacer').forEach(n => { if (!document.getElementById('app').contains(n)) return; n.replaceWith(...n.childNodes); });
      html.classList.remove('lenis', 'lenis-smooth', 'lenis-stopped', 'lenis-scrolling', 'lenis-autoToggle');
      html.style.removeProperty('scroll-behavior');
    });

    // ---- Hero: metin en geç ~350 ms'de görünür. Kütüphane o ana dek hazırsa GSAP girişi, değilse CSS girişi ----
    let heroShown = false;
    function showHeroCss() {
      if (heroShown || ac.signal.aborted) return; heroShown = true;
      root.classList.add('css'); root.classList.remove('pending');
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('ready', 'live')));
    }
    if (reduce) {
      // Hareket yok: her şey yerinde ve görünür; animasyon kütüphanesi hiç yüklenmez
      heroShown = true; root.classList.remove('pending'); root.classList.add('live');
    } else {
      root.classList.add('anim');
      const heroTimer = setTimeout(showHeroCss, 350);
      onAbort(() => clearTimeout(heroTimer));
      timeout(loadLibs(), 3500).then((ok) => {
        if (ac.signal.aborted) return;
        clearTimeout(heroTimer);
        if (ok) { try { setupGsap(); } catch (e) { console.error(e); setupFallback(); } }
        else setupFallback();
      });
    }

    // ---- Ortak bağlamalar (her modda) ----
    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
    const scrollToId = (id) => {
      const el = document.getElementById(id); if (!el) return;
      if (lenis) lenis.scrollTo(el, { offset: -60, duration: 1.1, easing: easeOutQuart });
      else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    };
    $$('[data-demo]').forEach(b => b.addEventListener('click', () => App.login('u1'), sig));

    // Ana CTA: butondan büyüyen yeşil daire ekranı kaplar (≤450 ms), sonra yeni öğrenci oluşturulup
    // ilk giriş sihirbazına geçilir (onboard.js beforeRender ile /onboarding'e yönlendirir)
    let leaving = false;
    function wipeThen(btn, go) {
      if (leaving) return;
      if (reduce || !btn.animate) return go();
      leaving = true;
      const r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const rad = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy)) + 12;
      const w = document.createElement('div'); w.className = 'hm-wipe';
      w.style.cssText = `left:${cx - rad}px;top:${cy - rad}px;width:${rad * 2}px;height:${rad * 2}px`;
      document.body.appendChild(w);
      let done = false;
      const fin = () => {
        if (done) return; done = true;
        try { go(); } finally {
          const rm = () => w.remove();
          try { w.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-out', fill: 'forwards' }).onfinish = rm; } catch (e) {}
          setTimeout(rm, 420);
        }
      };
      try { w.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' }).onfinish = fin; } catch (e) {}
      setTimeout(fin, 450);
    }
    $$('[data-start]').forEach(b => b.addEventListener('click', () => wipeThen(b, () => {
      const id = 'n' + Date.now().toString(36);
      App.db.users.push({ id, name: 'Yeni Öğrenci', email: '', avatar: 'YÖ', grade: '', target: '', city: '' });
      App.save(); App.login(id);
    }), sig));
    $$('[data-scroll]').forEach(a => a.addEventListener('click', () => scrollToId(a.dataset.scroll), sig));

    // Nav + üst ilerleme çubuğu. Sayfa yüksekliği yalnız değiştiğinde ölçülür (kaydırma sırasında layout okunmaz)
    const nav = $('#hm-nav'), prog = $('#hm-prog');
    let maxScroll = 1, progress = 0, solid = null;
    function onScroll() {
      const y = scrollY;
      progress = Math.max(0, Math.min(1, y / maxScroll));
      prog.style.transform = `scaleX(${progress})`;
      const s = y > 20; if (s !== solid) { solid = s; nav.classList.toggle('solid', s); }
    }
    const measureMax = () => { maxScroll = Math.max(1, html.scrollHeight - innerHeight); onScroll(); };
    window.addEventListener('scroll', onScroll, { passive: true, signal: ac.signal });
    window.addEventListener('resize', measureMax, { passive: true, signal: ac.signal });
    if (window.ResizeObserver) { const ro = new ResizeObserver(measureMax); ro.observe(root); onAbort(() => ro.disconnect()); }
    measureMax();

    // Aktif özellik adımı + panel/öğe görünürlüğü (IO)
    const panels = $$('.hm-panel'), steps = $$('#hm-steps li');
    const stepIO = new IntersectionObserver((ents) => ents.forEach(e => {
      if (e.isIntersecting) steps.forEach((s, i) => s.classList.toggle('on', i === +e.target.dataset.i));
    }), { rootMargin: '-48% 0px -48% 0px' });
    panels.forEach(p => stepIO.observe(p));
    steps.forEach(li => li.addEventListener('click', () => {
      const p = panels[+li.dataset.i];
      if (lenis) lenis.scrollTo(p, { offset: -(innerHeight / 2 - p.offsetHeight / 2), duration: 1.1, easing: easeOutQuart });
      else p.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }, sig));
    const io = new IntersectionObserver((ents) => ents.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('shown');
      io.unobserve(e.target);
    }), { threshold: 0.2 });
    $$('.hm-reveal, .hm-panel, .hm-way, #hm-report').forEach(el => io.observe(el));
    // Görünmeyen bölümlerdeki sonsuz animasyonlar (marquee, süzülen kartlar, ping) duraklatılır
    const pauseIO = new IntersectionObserver((ents) => ents.forEach(e => {
      e.target._on = e.isIntersecting;
      e.target.toggleAttribute('data-off', !e.isIntersecting);
    }), { rootMargin: '60px 0px' });
    $$('.hm-hero, .hm-showcase, .hm-marquee, .hm-ways, .hm-panel, .hm-final').forEach(el => { el._on = true; pauseIO.observe(el); });
    onAbort(() => { io.disconnect(); stepIO.disconnect(); pauseIO.disconnect(); });

    function countUp(el) {
      if (el._counted) return; el._counted = true;
      const target = parseFloat(el.dataset.count), unit = el.dataset.unit;
      const t0 = performance.now(), dur = 1100;
      (function tick(now) {
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        if (!el.dataset.locked) el.textContent = fmt(p < 1 ? (target % 1 ? target * e : Math.round(target * e)) : target, unit);
        if (p < 1 && document.body.contains(el)) requestAnimationFrame(tick);
      })(t0);
    }

    // 10 sn hareketsizlik → hardal nokta bir kez zıplar (yeniden hareket edilene dek tekrarlamaz)
    let traveler = null, travelerOn = false;
    if (!reduce) {
      let lastAct = performance.now(), hopped = false;
      const act = () => { lastAct = performance.now(); hopped = false; };
      ['mousemove', 'keydown', 'pointerdown', 'wheel', 'touchstart', 'scroll'].forEach(ev => window.addEventListener(ev, act, { passive: true, signal: ac.signal }));
      const idleT = setInterval(() => {
        if (hopped || document.hidden || performance.now() - lastAct < 10000) return;
        hopped = true;
        const el = travelerOn && traveler ? traveler.firstElementChild : $('#hm-dot');
        if (!el || el.classList.contains('gone')) return;
        el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop');
        setTimeout(() => el.classList.remove('hop'), 1300);
      }, 1000);
      onAbort(() => clearInterval(idleT));
    }

    // ---- Yedek mod: GSAP yok (offline vb.) → CSS geçişleri + IO ----
    function setupFallback() {
      $$('[data-count]').forEach(el => { el.textContent = fmt(0, el.dataset.unit); });
      const cio = new IntersectionObserver((ents) => ents.forEach(e => { if (e.isIntersecting) { e.target.querySelectorAll('[data-count]').forEach(countUp); cio.unobserve(e.target); } }), { threshold: 0.3 });
      cio.observe($('#hm-stats')); onAbort(() => cio.disconnect());
      showHeroCss();
    }

    // ---- GSAP modu ----
    function setupGsap() {
      const heroLate = heroShown; // hero CSS ile çoktan göründüyse GSAP girişi atlanır
      heroShown = true;
      gsap.registerPlugin(ScrollTrigger, SplitText);
      // Tek hareket dili: 3 imza eğri + 3 süre. Scrub edilen her şey 'none'.
      const E = { enter: 'expo.out', spring: 'back.out(1.7)', inout: 'power3.inOut' };
      if (window.CustomEase) {
        gsap.registerPlugin(CustomEase);
        CustomEase.create('hmEnter', '0.16,1,0.3,1');                                              // giriş: hızlı çıkış, uzun yumuşak iniş
        CustomEase.create('hmSpring', 'M0,0 C0.12,0 0.18,1.32 0.42,1.1 0.58,0.96 0.72,1 1,1');     // vurgu: hafif taşma + toparlanma
        CustomEase.create('hmInOut', '0.7,0,0.2,1');                                               // yer değiştirme
        E.enter = 'hmEnter'; E.spring = 'hmSpring'; E.inout = 'hmInOut';
      }
      const D = { s: 0.35, m: 0.7, l: 1.1 };
      const SCRUB = 0.7;
      ScrollTrigger.config({ ignoreMobileResize: true });
      mm = gsap.matchMedia();

      mm.add({ any: 'all', desk: '(min-width: 901px)', fine: '(hover: hover) and (pointer: fine)' }, (ctx) => {
        const { desk, fine } = ctx.conditions;
        // Bu bağlamın (kırılım değişince ya da sayfadan çıkınca) temizlik listesi + dinleyici sinyali
        const cleanups = [], cac = new AbortController(), csig = { signal: cac.signal, passive: true };
        const later = (fn) => cleanups.push(fn);
        later(() => cac.abort());
        const tickers = [];
        const addTick = (fn) => { gsap.ticker.add(fn); tickers.push(fn); };
        later(() => tickers.forEach(fn => gsap.ticker.remove(fn)));

        root.classList.remove('anim'); root.classList.add('gs');
        if (desk) root.classList.add('jm');
        later(() => { root.classList.remove('gs', 'jm', 'hpin', 'jsmarq', 'jsflip'); root.classList.add('anim'); });

        // Bölüm girişleri için tek kalıp: kicker → başlık satırları (maskeli) → içerik
        const once = (trigger, start) => ({ trigger, start: start || 'top 82%', once: true });
        const rise = (els, trigger, delay, start) => gsap.from(els, { y: 28, autoAlpha: 0, duration: D.m, ease: E.enter, stagger: 0.07, delay: delay || 0, scrollTrigger: once(trigger, start) });
        const lines = (el, trigger, delay, start) => SplitText.create(el, {
          type: 'lines', mask: 'lines', autoSplit: true, linesClass: 'hm-split-line',
          onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: D.l, ease: E.enter, stagger: 0.08, delay: delay || 0, scrollTrigger: once(trigger, start) })
        });
        const sectionIn = (trigger, o) => {
          if (o.kicker) rise(o.kicker, trigger, 0, o.start);
          if (o.title) lines(o.title, trigger, 0.08, o.start);
          if (o.items && o.items.length) rise(o.items, trigger, 0.24, o.start);
        };

        // 1) Lenis yumuşak kaydırma (yalnız masaüstü; dokunmatikte yerel kaydırma en akıcısı)
        if (desk && window.Lenis && !lenis) {
          lenis = new Lenis({ lerp: 0.115, wheelMultiplier: 0.95, smoothWheel: true, syncTouch: false });
          lenis.on('scroll', ScrollTrigger.update);
          rafFn = (t) => { if (lenis) lenis.raf(t * 1000); };
          gsap.ticker.add(rafFn);
          gsap.ticker.lagSmoothing(0);
        }
        later(() => {
          if (lenis) { lenis.destroy(); lenis = null; }
          if (rafFn) { gsap.ticker.remove(rafFn); rafFn = null; }
        });

        // Kaydırma hızı: tek kaynak. Hıza duyarlı her şey (marquee, kart eğimi, kart sallanması) buradan beslenir
        let vel = 0;
        const sk = { v: 0 }, skClamp = gsap.utils.clamp(-9, 9), skewers = [];
        const applySkew = () => skewers.forEach(fn => fn(sk.v));
        let hoverRect = null; // imleç eğimi için önbellek; kaydırınca geçersizleşir
        ScrollTrigger.create({
          start: 0, end: 'max',
          onUpdate(self) {
            vel = self.getVelocity(); hoverRect = null;
            const s = skClamp(vel / -280);
            if (Math.abs(s) > Math.abs(sk.v)) {
              sk.v = s;
              gsap.to(sk, { v: 0, duration: D.l, ease: E.spring, overwrite: true, onUpdate: applySkew }); // durunca yay gibi toparlanır
            }
          }
        });

        // 2) Hero girişi: maskeli satırlar; metin ~0.3 sn'de okunur
        const tilt = $('#hm-tilt');
        const TILT = { rotateX: 22, scale: 0.88, y: 40 };
        if (desk) {
          gsap.set(tilt, { transformPerspective: 1400, transformOrigin: '50% 0%' });
          // Hero CSS ile çoktan göründüyse maket sıçramasın: eğik duruşa yumuşakça geçer
          if (heroLate) gsap.to(tilt, { ...TILT, duration: D.m, ease: E.inout }); else gsap.set(tilt, TILT);
        }
        if (!heroLate) {
          const heroIn = $$('.hm-hero .hm-in');
          gsap.set(heroIn, { autoAlpha: 0, y: 16 });
          if (!desk) gsap.set(tilt, { autoAlpha: 0, y: 40 });
          SplitText.create('#hm-title', {
            type: 'lines', mask: 'lines', autoSplit: true, linesClass: 'hm-split-line',
            onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: D.m, ease: E.enter, stagger: 0.07 })
          });
          root.classList.remove('pending'); root.classList.add('live');
          gsap.to(heroIn, { autoAlpha: 1, y: 0, duration: D.m, ease: E.enter, stagger: 0.06, delay: 0.08 });
          if (!desk) gsap.to(tilt, { autoAlpha: 1, y: 0, duration: D.l, ease: E.enter, delay: 0.3 });
        }

        // ===== Hardal nokta yolculuğu (masaüstü) =====
        // Başlıktaki nokta kaydırınca kopar: halka ucu → (ilerleme çubuğunun ucu) → zihin haritası kökü →
        // net grafiğinin son noktası → final CTA. Konum her karede canlı hedeflerden hesaplanır; geri kaydırınca aynı yoldan döner.
        const j = { a: 0, ringOut: 0, map: 0, mapOut: 0, spark: 0, sparkOut: 0, cta: 0 };
        if (desk) {
          traveler = document.createElement('div'); traveler.className = 'hm-trav'; traveler.innerHTML = '<i></i>';
          $('#hm-layer').appendChild(traveler);
          later(() => {
            if (traveler) traveler.remove(); traveler = null; travelerOn = false;
            const d = $('#hm-dot'); if (d) d.classList.remove('away');
          });
        }

        // 3) Pinned uygulama maketi (masaüstü): düzleşirken arayüz sırayla canlanır
        if (desk) {
          const fg = $('.hm-goal .fg'), tip = $('.hm-goal .tip'), goalN = $('.hm-goal-t b');
          const RING = 326.7, st = { f: 0, vt: 522 };
          let lastN = -1, lastT = '';
          const goalFinal = goalN.textContent;
          const setRing = () => {
            fg.style.strokeDashoffset = (RING * (1 - st.f)).toFixed(1);
            const a = st.f * Math.PI * 2;
            tip.setAttribute('cx', (60 + 52 * Math.cos(a)).toFixed(2)); tip.setAttribute('cy', (60 + 52 * Math.sin(a)).toFixed(2));
            const n = Math.round(st.f * 60); if (n !== lastN) { lastN = n; goalN.textContent = n; }
          };
          const vtEl = $('.hm-vt'), vtFinal = vtEl.textContent;
          const setVt = () => { const s = Math.round(st.vt), t = String(s / 60 | 0).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); if (t !== lastT) { lastT = t; vtEl.textContent = t; } };
          const pcts = $$('.hm-weak li b').map(el => ({ el, to: parseInt(el.dataset.pct, 10) || 0, v: 0, last: -1, final: el.textContent }));
          const setPct = (p) => { const n = Math.round(p.v); if (n !== p.last) { p.last = n; p.el.textContent = '%' + n; } };
          pcts.forEach(setPct); setRing();
          const resumeBar = $('.hm-resume .hm-bar span'), courseBars = $$('.hm-win-card .hm-bar span');
          const ghost = $('.hm-ghost'), play = $('.hm-play'), rp = $('.hm-play .rp');
          gsap.set(resumeBar, { width: '100%' });
          gsap.set(play, { transformOrigin: '50% 50%' });

          const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '#hm-showcase', start: 'top top', end: '+=120%', pin: true, scrub: SCRUB, anticipatePin: 1, invalidateOnRefresh: true } });
          // Pin sırasında maket ekranın ortasına iner (üstte nav payı bırakarak)
          const midY = () => Math.max(0, 62 + (innerHeight - 62 - tilt.offsetHeight) / 2 - (parseFloat(getComputedStyle($('#hm-showcase')).paddingTop) || 0));
          tl.fromTo(tilt, TILT, { rotateX: 0, scale: 1, y: midY, duration: 3, immediateRender: false }, 0)
            .to(st, { f: 2 / 3, duration: 3.6, onUpdate: setRing }, 0.5)                               // halka dolar, nokta ucunda taşınır
            .fromTo(resumeBar, { scaleX: 0 }, { scaleX: 0.61, duration: 2, ease: E.enter }, 1)
            .fromTo(courseBars, { scaleX: 0 }, { scaleX: 1, duration: 2, stagger: 0.3, ease: E.enter }, 1.4);
          pcts.forEach((p, i) => tl.to(p, { v: p.to, duration: 1.5, onUpdate: () => setPct(p) }, 3 + i * 0.4)); // eksik konu yüzdeleri sayar
          tl.fromTo(ghost, { x: -190, y: 120, autoAlpha: 0 }, { x: 0, y: 0, autoAlpha: 1, duration: 1.8, ease: E.inout }, 5) // hayalet imleç gelir
            .to(ghost, { scale: 0.8, duration: 0.25 }, 6.9)
            .to(play, { scale: 0.84, duration: 0.25 }, 6.9)                                               // tıklar
            .to(ghost, { scale: 1, duration: 0.3 }, 7.15)
            .to(play, { scale: 1, duration: 0.6, ease: E.spring }, 7.15)
            .fromTo(rp, { scale: 1, opacity: 0.45 }, { scale: 2.1, opacity: 0, duration: 0.9, ease: E.enter }, 7.15)
            .to('.hm-play .a', { opacity: 0, duration: 0.15 }, 7.15)
            .to('.hm-play .b', { opacity: 1, duration: 0.15 }, 7.15)
            .to(resumeBar, { scaleX: 0.8, duration: 2.5 }, 7.4)                                           // ilerleme çubuğu akar
            .to(st, { vt: 680, duration: 2.5, onUpdate: setVt }, 7.4)
            .to(ghost, { x: 36, y: 54, autoAlpha: 0, duration: 1, ease: E.inout }, 8.6)
            .to({}, { duration: 0.4 }, 9.6);

          gsap.to(j, { a: 1, ease: 'none', scrollTrigger: { trigger: '#hm-showcase', start: 24, endTrigger: '#hm-showcase', end: 'top top', scrub: SCRUB } });
          gsap.to(j, { ringOut: 1, ease: 'none', scrollTrigger: { trigger: '#hm-showcase', start: 'bottom 62%', end: 'bottom 22%', scrub: SCRUB } });
          later(() => {
            fg.style.strokeDashoffset = ''; tip.setAttribute('cx', 112); tip.setAttribute('cy', 60);
            goalN.textContent = goalFinal; vtEl.textContent = vtFinal; pcts.forEach(p => { p.el.textContent = p.final; });
          });
        }

        // 4) Kayan kurs şeridi: JS ile sürülür → kaydırma hızıyla hızlanır/yön değiştirir, eğilir; görünmezken durur
        {
          const sec = $('.hm-marquee');
          const tracks = $$('.hm-track').map((el, i) => ({ el, dir: i ? 1 : -1, base: i ? 34 : 46, x: 0, half: 1, setX: gsap.quickSetter(el, 'x', 'px'), setSkew: gsap.quickSetter(el, 'skewX', 'deg') }));
          root.classList.add('jsmarq');
          const measure = () => tracks.forEach(t => { t.half = (t.el.scrollWidth + (parseFloat(getComputedStyle(t.el).columnGap) || 0)) / 2; });
          measure();
          ScrollTrigger.addEventListener('refreshInit', measure);
          later(() => ScrollTrigger.removeEventListener('refreshInit', measure));
          let hover = 0, mul = 1, vs = 0;
          sec.addEventListener('mouseenter', () => { hover = 1; }, csig);
          sec.addEventListener('mouseleave', () => { hover = 0; }, csig);
          addTick((time, dt) => {
            vel *= 0.92;
            if (!sec._on) return;
            const d = Math.min(dt, 50) / 1000;
            vs += (vel - vs) * 0.12;
            mul += ((hover ? 0 : 1) - mul) * 0.08;
            tracks.forEach(t => {
              t.x += t.dir * (t.base * mul + vs * 0.28) * d;
              t.x = gsap.utils.wrap(-t.half, 0, t.x);
              t.setX(t.x);
            });
          });
          skewers.push((v) => { if (sec._on) tracks.forEach(t => t.setSkew(v * 1.4)); });
        }

        // 5) Yatay kaydırma: Öğrenmenin 6 yolu
        const waysSec = $('#hm-ways'), ways = $$('.hm-way');
        sectionIn(waysSec, { kicker: '.hm-ways .hm-kicker', title: '.hm-ways .hm-h2', items: ways, start: 'top 72%' });
        if (desk) {
          const view = $('#hm-ways-view'), track = $('#hm-ways-track');
          root.classList.add('hpin');
          const dist = () => Math.max(0, track.scrollWidth - view.clientWidth);
          const hz = gsap.to(track, {
            x: () => -dist(), ease: 'none',
            scrollTrigger: { trigger: waysSec, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: SCRUB, invalidateOnRefresh: true, anticipatePin: 1 }
          });
          // Kart içi parallax: görsel, karttan farklı hızda kayar
          ways.forEach(w => {
            const inner = w.querySelector('.hm-way-vis > *'); if (!inner) return;
            gsap.fromTo(inner, { x: 34 }, { x: -34, ease: 'none', scrollTrigger: { trigger: w, containerAnimation: hz, start: 'left right', end: 'right left', scrub: true } });
          });
          // Hıza göre eğilme
          const setWaySkew = gsap.quickSetter(ways, 'skewX', 'deg');
          skewers.push((v) => { if (waysSec._on) setWaySkew(v * 0.7); });
        }

        // 6) Özellikler: yapışkan sol sütun + paneller
        sectionIn('#hm-features', { kicker: '.hm-sticky .hm-kicker', title: '.hm-sticky .hm-h2', items: $$('#hm-steps li'), start: 'top 75%' });
        panels.forEach(p => rise([p.querySelector('.hm-panel-vis'), p.querySelector('h3'), p.querySelector('p')], p, 0, 'top 84%'));

        // Zihin haritası: nokta kök düğüme oturur, dallar scrub ile çizilir, düğümler yaylı belirir
        if (desk) {
          const map = $('.hm-vis-map');
          gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: map, start: 'top 82%', end: 'top 24%', scrub: SCRUB } })
            .to(j, { map: 1, duration: 3 }, 0)
            .fromTo(map.querySelector('.core-g'), { scale: 0.2, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1.6, ease: E.spring, transformOrigin: '50% 50%' }, 1.9)
            .fromTo(map.querySelectorAll('path'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 2.6, stagger: 0.5 }, 3.2)
            .fromTo(map.querySelectorAll('.n'), { scale: 0.3, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1.8, stagger: 0.5, ease: E.spring, transformOrigin: '50% 50%' }, 4.6)
            .to({}, { duration: 0.6 }, 8.4);
          gsap.to(j, { mapOut: 1, ease: 'none', scrollTrigger: { trigger: map, start: 'bottom 42%', end: 'bottom 14%', scrub: SCRUB } });
        }

        // Bilgi kartı: imleci izleyen 3B eğim + üzerine gelince çevrilme + kaydırma hızıyla sallanma
        {
          const card = $('.hm-vis-flip .fc'), cin = $('.hm-vis-flip .fc-in');
          const pv = card.closest('.hm-panel-vis'), panel = card.closest('.hm-panel');
          if (fine) {
            root.classList.add('jsflip');
            const rx = gsap.quickTo(card, 'rotationX', { duration: D.m, ease: E.enter }), ry = gsap.quickTo(card, 'rotationY', { duration: D.m, ease: E.enter });
            let flipped = false;
            const flip = (to) => {
              if (to === flipped) return; flipped = to;
              gsap.to(cin, { rotationY: to ? 180 : 0, duration: D.l, ease: E.spring, overwrite: 'auto' });
              gsap.fromTo(card, { scale: 1 }, { scale: 1.06, duration: D.s, ease: E.enter, yoyo: true, repeat: 1, overwrite: 'auto' });
            };
            pv.addEventListener('mousemove', (e) => {
              if (!hoverRect) hoverRect = pv.getBoundingClientRect();
              ry(((e.clientX - hoverRect.left) / hoverRect.width - 0.5) * 24);
              rx(((e.clientY - hoverRect.top) / hoverRect.height - 0.5) * -18);
            }, csig);
            pv.addEventListener('mouseleave', () => { rx(0); ry(0); hoverRect = null; }, csig);
            card.addEventListener('mouseenter', () => flip(true), csig);
            card.addEventListener('mouseleave', () => flip(false), csig);
            card.addEventListener('click', () => flip(!flipped), csig);
            const setSway = gsap.quickSetter(card, 'rotation', 'deg');
            skewers.push((v) => { if (panel._on) setSway(v * 0.8); });
          }
        }

        // 7) "Ürün anı": çerçeve yalnız transform ile genişler (clip-path yok)
        {
          const frame = $('#hm-moment-frame'), report = $('#hm-report');
          if (desk) {
            const mst = { trigger: '#hm-moment', start: 'top 92%', end: 'top 10%', scrub: SCRUB };
            gsap.fromTo(frame, { scale: 0.8 }, { scale: 1, ease: 'none', transformOrigin: '50% 30%', scrollTrigger: mst });
            gsap.fromTo(report, { y: 90 }, { y: 0, ease: 'none', scrollTrigger: { ...mst } });
            // Net grafiği çizilir, nokta son değere oturur
            gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '#hm-moment', start: 'top 55%', end: 'top 8%', scrub: SCRUB } })
              .fromTo('.hm-sparkl path', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 3 }, 0)
              .to(j, { spark: 1, duration: 3 }, 0.6)
              .to({}, { duration: 0.4 }, 3.6);
            gsap.to(j, { sparkOut: 1, ease: 'none', scrollTrigger: { trigger: '#hm-moment', start: 'bottom 72%', end: 'bottom 44%', scrub: SCRUB } });
          } else {
            gsap.from(frame, { scale: 0.94, autoAlpha: 0, duration: D.l, ease: E.enter, scrollTrigger: once('#hm-moment', 'top 85%') });
          }
          sectionIn('.hm-moment-copy', { kicker: '.hm-moment .hm-kicker', title: '.hm-moment h2', items: ['.hm-moment-copy > p:last-child'], start: desk ? 'top 62%' : 'top 82%' });
        }

        // 8) Rakamlar: odometre (basamaklar dikey kayarak döner)
        {
          const els = $$('[data-count]');
          const built = els.map(el => {
            const final = fmt(parseFloat(el.dataset.count), el.dataset.unit);
            let n = 0;
            el.innerHTML = `<span class="hm-sr">${final}</span><span class="hm-od" aria-hidden="true">` + Array.from(final).map(ch => {
              if (!/\d/.test(ch)) return `<span class="s">${ch}</span>`;
              const seq = []; for (let k = 0; k <= 10 + (+ch); k++) seq.push(k % 10);
              return `<span class="d" style="--n:${n++}"><span class="c">${seq.map(k => `<span>${k}</span>`).join('')}</span></span>`;
            }).join('') + '</span>';
            return { el, final };
          });
          const restore = () => built.forEach(b => { if (!b.el.dataset.locked && b.el.querySelector('.hm-od')) b.el.textContent = b.final; });
          later(restore);
          rise($$('.hm-stat'), '#hm-stats', 0);
          ScrollTrigger.create({
            trigger: '#hm-stats', start: 'top 82%', once: true,
            onEnter: () => built.forEach((b, bi) => {
              const cols = b.el.querySelectorAll('.hm-od .c');
              cols.forEach((c, i) => gsap.to(c, {
                yPercent: -100 * (c.children.length - 1) / c.children.length, duration: D.l + 0.5 + i * 0.12, delay: 0.1 + bi * 0.07, ease: E.enter,
                onComplete: i === cols.length - 1 ? () => { if (!b.el.dataset.locked && b.el.querySelector('.hm-od')) b.el.textContent = b.final; } : null
              }));
            })
          });
        }

        // 9) Alıntı: kelimeler aydınlanır, anahtar ifadenin altı elle çizilmiş gibi çizilir
        {
          const ul = $('.hm-ul path');
          SplitText.create('#hm-words', {
            type: 'words', autoSplit: true, ignore: '.hm-ul',
            onSplit(self) {
              const words = self.words; // altı çizilen ifade bölünmez (ignore): tek parça aydınlanır
              if (desk) {
                return gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '#hm-words', start: 'top 82%', end: 'bottom 48%', scrub: SCRUB } })
                  .fromTo(words, { opacity: 0.14 }, { opacity: 1, stagger: 0.1, duration: 0.3 }, 0)
                  .fromTo(ul, { strokeDashoffset: 1.03 }, { strokeDashoffset: 0, duration: 0.8 }, '-=0.5');
              }
              return gsap.timeline({ scrollTrigger: once('#hm-words', 'top 80%') })
                .fromTo(words, { opacity: 0.14 }, { opacity: 1, stagger: 0.035, duration: D.s, ease: 'none' }, 0)
                .fromTo(ul, { strokeDashoffset: 1.03 }, { strokeDashoffset: 0, duration: D.m, ease: E.inout }, '-=0.2');
            }
          });
          rise('.hm-quote cite', '.hm-quote cite', 0, 'top 90%');
        }

        // 10) Öğrenme yolları + kapanış
        sectionIn('.hm-paths-head', { kicker: '.hm-paths .hm-kicker', title: '.hm-paths .hm-h2', items: ['.hm-paths-lead'] });
        $$('.hm-path').forEach(p => rise([...p.querySelectorAll('.hm-path-l > *'), ...p.querySelectorAll('.hm-path-r li')], p, 0, 'top 80%'));
        sectionIn('.hm-final', { title: '.hm-final-title', items: ['.hm-final .hm-btn', '.hm-hint'], start: 'top 78%' });
        if (desk) gsap.to(j, { cta: 1, ease: 'none', scrollTrigger: { trigger: '.hm-final', start: 'top 80%', end: () => Math.max(1, ScrollTrigger.maxScroll(window) - 30), scrub: SCRUB, invalidateOnRefresh: true } });

        // Hafif parallax (masaüstü)
        if (desk) $$('[data-speed]').forEach(el => {
          const d = (1 - parseFloat(el.dataset.speed)) * 160;
          gsap.fromTo(el, { y: -d }, { y: d, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
        });

        // ===== Yolculuk: her karede konum =====
        if (desk && traveler) {
          const home = { el: null, dx: 0, dy: 0, s: 14, ok: false };
          const measureHome = () => {
            const el = $('#hm-dot'); home.el = el; home.ok = false; if (!el) return;
            const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize) || 100;
            const probe = document.createElement('span'); probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
            el.appendChild(probe);
            const pr = probe.getBoundingClientRect(), r = el.getBoundingClientRect(); probe.remove();
            let w = 0, asc = 0, desc = 0, left = 0, right = 0;
            try {
              const c = document.createElement('canvas').getContext('2d');
              c.font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
              const m = c.measureText('.');
              left = m.actualBoundingBoxLeft; right = m.actualBoundingBoxRight; asc = m.actualBoundingBoxAscent; desc = m.actualBoundingBoxDescent;
              w = left + right;
            } catch (e) {}
            if (!(w > 2) || !(asc + desc > 2)) { w = fs * 0.14; left = -fs * 0.06; right = fs * 0.2; asc = fs * 0.13; desc = fs * 0.01; }
            home.dx = (right - left) / 2; home.dy = (pr.top - r.top) - (asc - desc) / 2;
            home.s = Math.max(w, asc + desc); home.ok = true;
          };
          const invalidate = () => { home.ok = false; };
          window.addEventListener('resize', invalidate, csig);
          ScrollTrigger.addEventListener('refresh', invalidate);
          later(() => ScrollTrigger.removeEventListener('refresh', invalidate));

          const tipEl = $('.hm-goal .tip'), sockEl = $('.hm-vis-map .sock'), ptEl = $('.hm-sparkl .pt'), ctaEl = $('.hm-final .hm-btn');
          const center = (el, s) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: s || Math.max(8, r.width) }; };
          const P = {
            home: () => { if (!home.ok || !home.el || !home.el.isConnected) measureHome(); const r = home.el.getBoundingClientRect(); return { x: r.left + home.dx, y: r.top + home.dy, s: home.s }; },
            ring: () => center(tipEl, 13),
            bar: () => ({ x: Math.max(5, Math.min(innerWidth - 5, progress * innerWidth)), y: 3, s: 8 }),
            map: () => center(sockEl),
            spark: () => center(ptEl),
            cta: () => { const r = ctaEl.getBoundingClientRect(); return { x: r.right + 22, y: r.top + r.height / 2, s: 14 }; }
          };
          const sIn = (t) => t * t, sOut = (t) => 1 - (1 - t) * (1 - t), sIO = (t) => t * t * (3 - 2 * t);
          // Uçuşlar: x ve y farklı eğriyle ilerler → düz çizgi değil, yay
          const legs = [
            { k: 'a', to: P.ring, ex: sIO, ey: sIn },
            { k: 'ringOut', to: P.bar, ex: sIn, ey: sOut },
            { k: 'map', to: P.map, ex: sOut, ey: sIn },
            { k: 'mapOut', to: P.bar, ex: sIn, ey: sOut },
            { k: 'spark', to: P.spark, ex: sOut, ey: sIn },
            { k: 'sparkOut', to: P.bar, ex: sIn, ey: sOut },
            { k: 'cta', to: P.cta, ex: sOut, ey: sIn }
          ];
          const inner = traveler.firstElementChild;
          let lastTf = '', lastQ = '', pulsing = false;
          addTick(() => {
            const on = j.a > 0.002;
            if (on !== travelerOn) {
              travelerOn = on; traveler.classList.toggle('on', on);
              const d = $('#hm-dot'); if (d) d.classList.toggle('away', on);
            }
            if (!on) return;
            let from = -1;
            for (let i = legs.length - 1; i >= 0; i--) if (j[legs[i].k] > 0.998) { from = i; break; }
            const p = from < 0 ? P.home() : legs[from].to();
            for (let i = from + 1; i < legs.length; i++) {
              const L = legs[i], t = j[L.k]; if (t < 0.002) continue;
              const q = L.to();
              p.x += (q.x - p.x) * L.ex(t); p.y += (q.y - p.y) * L.ey(t); p.s += (q.s - p.s) * t;
            }
            const tf = `translate3d(${(p.x - 8).toFixed(1)}px,${(p.y - 8).toFixed(1)}px,0) scale(${(p.s / 16).toFixed(3)})`;
            if (tf !== lastTf) { lastTf = tf; traveler.style.transform = tf; }
            const q = Math.min(1, j.a * 5).toFixed(2); // başlıktaki nokta baklava biçimli; koparken daireye döner
            if (q !== lastQ) { lastQ = q; traveler.style.setProperty('--q', q); }
            const pulse = j.cta > 0.985;
            if (pulse !== pulsing) { pulsing = pulse; inner.classList.toggle('pulse', pulse); }
          });
        }

        // 11) İmleç: ince nokta; etkileşimli öğede büyür, yatay bölümde "Kaydır →" etiketi taşır. Manyetik butonlar.
        if (fine) {
          cursor = document.createElement('div'); cursor.className = 'hm-cursor'; cursor.innerHTML = '<i></i><span>Kaydır →</span>';
          document.body.appendChild(cursor);
          const dot = cursor.firstElementChild, lbl = cursor.lastElementChild;
          gsap.set(cursor, { x: innerWidth / 2, y: innerHeight / 2, autoAlpha: 0 });
          const qx = gsap.quickTo(cursor, 'x', { duration: D.s, ease: E.enter }), qy = gsap.quickTo(cursor, 'y', { duration: D.s, ease: E.enter });
          const hot = 'a, button, [data-demo], [data-scroll], .hm-steps li, .hm-dot, #hm-stat-egg, #hm-eggs, .hm-vis-flip .fc';
          let shown = false, mode = '';
          const setMode = (m) => {
            if (m === mode) return; mode = m;
            cursor.classList.toggle('hot', m === 'hot'); cursor.classList.toggle('lbl', m === 'label');
            gsap.to(dot, { scale: m === 'label' ? 7.6 : m === 'hot' ? 4.2 : 1, duration: D.s, ease: E.enter, overwrite: 'auto' });
            gsap.to(lbl, { autoAlpha: m === 'label' ? 1 : 0, duration: D.s, ease: E.enter, overwrite: 'auto' });
          };
          const modeOf = (t) => !t || !t.closest ? '' : t.closest(hot) ? 'hot' : (desk && t.closest('#hm-ways-view')) ? 'label' : '';
          window.addEventListener('mousemove', (e) => {
            qx(e.clientX); qy(e.clientY);
            if (!shown) { shown = true; gsap.to(cursor, { autoAlpha: 1, duration: D.s, overwrite: 'auto' }); }
          }, csig);
          document.addEventListener('mouseover', (e) => setMode(modeOf(e.target)), csig);
          html.addEventListener('mouseleave', () => { shown = false; gsap.to(cursor, { autoAlpha: 0, duration: D.s, overwrite: 'auto' }); }, csig);
          later(() => { if (cursor) { cursor.remove(); cursor = null; } });

          $$('.hm-magnet').forEach(b => {
            const mx = gsap.quickTo(b, 'x', { duration: D.s, ease: E.enter }), my = gsap.quickTo(b, 'y', { duration: D.s, ease: E.enter });
            let r = null;
            b.addEventListener('mouseenter', () => { r = b.getBoundingClientRect(); }, csig);
            b.addEventListener('mousemove', (e) => { if (!r) return; mx((e.clientX - r.left - r.width / 2) * 0.2); my((e.clientY - r.top - r.height / 2) * 0.32); }, csig);
            b.addEventListener('mouseleave', () => { r = null; mx(0); my(0); }, csig);
          });
        }

        return () => { cleanups.splice(0).forEach(fn => { try { fn(); } catch (e) {} }); };
      });

      ScrollTrigger.sort(); ScrollTrigger.refresh();
      // Fontlar/yerleşim oturunca konumları yeniden ölç
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!ac.signal.aborted) { ScrollTrigger.sort(); ScrollTrigger.refresh(); } });
    }

    // ===== Sürprizler =====
    function egg(key, msg) {
      const isNew = !found.has(key);
      found.add(key);
      try { localStorage.setItem('kampus-eggs', JSON.stringify([...found])); } catch (e) {}
      const c = $('#hm-eggs'); if (c) { c.querySelector('b').textContent = found.size; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
      App.toast((isNew ? '🥚 Sürpriz bulundu! ' : '') + msg);
      if (isNew && found.size === 6) setTimeout(() => { rain(['🎓', '📚', '✦', '🥚'], 90); App.toast('🏆 Altı sürprizin hepsini buldun. +500 XP, onur listesindesin!'); }, 900);
    }
    $('#hm-eggs').addEventListener('click', () => {
      App.modal({ title: 'Gizli sürprizler', body: `<ul class="hm-egg-list">${Object.entries(EGGS).map(([k, v]) => `<li class="${found.has(k) ? 'ok' : ''}"><span>${found.has(k) ? '✓' : '?'}</span>${found.has(k) ? v : '••••••••••'}</li>`).join('')}</ul><p class="muted small">${found.size}/6 bulundu.</p>`, actions: [{ label: 'Sıfırla', onClick: (close) => { found.clear(); try { localStorage.removeItem('kampus-eggs'); } catch (e) {} close(); App.render(); } }, { label: 'Tamam', primary: true }] });
    }, sig);

    // 1) Konami kodu  &  3) "kahve" yaz
    const seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let pos = 0, typed = '';
    window.addEventListener('keydown', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      pos = k === seq[pos] ? pos + 1 : (k === seq[0] ? 1 : 0);
      if (pos === seq.length) { pos = 0; rain(['🎓'], 70); egg('konami', 'Tebrikler, sınav bitti ve kazandın! Kepler havada 🎓'); }
      if (e.key.length === 1) {
        typed = (typed + e.key.toLocaleLowerCase('tr-TR')).slice(-5);
        if (typed === 'kahve') { root.classList.add('coffee'); steam(); egg('kahve', 'Gece çalışma modu açıldı ☕ Sayfa sıcacık.'); }
      }
    }, sig);

    // 2) Logoya 5 kez tıkla
    let clicks = 0, clickT;
    $('#hm-logo').addEventListener('click', (e) => {
      e.preventDefault(); clicks++; clearTimeout(clickT); clickT = setTimeout(() => clicks = 0, 1200);
      const m = $('#hm-logo .hm-mark'); m.classList.remove('wobble'); void m.offsetWidth; m.classList.add('wobble');
      if (clicks >= 5) { clicks = 0; m.classList.add('spin'); setTimeout(() => m.classList.remove('spin'), 1200); egg('logo', 'Müdavim rozeti kazandın (+50 XP).'); }
    }, sig);

    // 4) Başlıktaki nokta düşer ve zıplar (SplitText yeniden bölebildiği için olay delegasyonu)
    root.addEventListener('click', (ev) => {
      const dot = ev.target.closest && ev.target.closest('.hm-dot');
      if (!dot || dot.classList.contains('gone')) return;
      const r = dot.getBoundingClientRect();
      const b = document.createElement('span'); b.className = 'hm-ball'; b.textContent = '.';
      b.style.left = r.left + 'px'; b.style.top = r.top + 'px'; $('#hm-layer').appendChild(b);
      dot.classList.add('gone');
      let x = r.left, y = r.top, vx = 3.2, vy = -9, bounces = 0;
      const floor = innerHeight - 70;
      (function fall() {
        vy += 0.55; x += vx; y += vy;
        if (y > floor) { y = floor; vy *= -0.62; vx *= 0.85; bounces++; }
        b.style.transform = `translate(${x - r.left}px, ${y - r.top}px) rotate(${x * 3}deg)`;
        if (bounces < 6 && document.body.contains(b) && !reduce) requestAnimationFrame(fall);
        else { b.classList.add('fade'); setTimeout(() => { b.remove(); dot.classList.remove('gone'); }, 1400); }
      })();
      egg('dot', 'Noktayı düşürdün. Cümle yarım kaldı ama olsun.');
    }, sig);

    // 5) Memnuniyete 3 kez tıkla
    let sc = 0; const st = $('#hm-stat-egg');
    st.addEventListener('click', () => {
      if (++sc < 3) return; sc = 0;
      const b = st.querySelector('b'); b.dataset.locked = '1'; b.textContent = '%100'; st.querySelector('span').textContent = 'memnuniyet (biraz yuvarladık)';
      st.classList.add('wiggle'); egg('stat', 'Pazarlama ekibi bunu görmesin.');
    }, sig);

    // 6) Mini test (Konu testi paneli)
    $$('#hm-quiz button').forEach(b => b.addEventListener('click', () => {
      const ok = b.dataset.q === '2'; const msg = $('#hm-quiz .hm-quiz-msg');
      $$('#hm-quiz button').forEach(x => x.classList.remove('right', 'wrong'));
      b.classList.add(ok ? 'right' : 'wrong');
      msg.textContent = ok ? 'Doğru! Her adımda arama aralığı yarıya iner. +10 XP' : 'Olmadı — yanlışlar defterine eklendi. Tekrar dene.';
      if (ok) { burst(b); egg('quiz', 'Tam puan! Konu testini ilk denemede geçtin.'); }
    }, sig));

    // Efekt yardımcıları
    function rain(chars, n) {
      if (reduce) return;
      const layer = $('#hm-layer'); if (!layer) return;
      for (let i = 0; i < n; i++) {
        const s = document.createElement('span'); s.className = 'hm-drop';
        s.textContent = chars[i % chars.length];
        s.style.left = Math.random() * 100 + 'vw';
        s.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
        s.style.setProperty('--x', (Math.random() * 200 - 100) + 'px');
        s.style.animationDuration = (2.2 + Math.random() * 2.2) + 's';
        s.style.animationDelay = Math.random() * 0.8 + 's';
        s.style.fontSize = (18 + Math.random() * 22) + 'px';
        layer.appendChild(s); setTimeout(() => s.remove(), 5200);
      }
    }
    function burst(el) {
      const r = el.getBoundingClientRect(), layer = $('#hm-layer');
      for (let i = 0; i < 18; i++) {
        const s = document.createElement('i'); s.className = 'hm-spark';
        const a = (i / 18) * Math.PI * 2, d = 50 + Math.random() * 40;
        s.style.left = (r.left + r.width / 2) + 'px'; s.style.top = (r.top + r.height / 2) + 'px';
        s.style.setProperty('--tx', Math.cos(a) * d + 'px'); s.style.setProperty('--ty', Math.sin(a) * d + 'px');
        layer.appendChild(s); setTimeout(() => s.remove(), 800);
      }
    }
    function steam() {
      const layer = $('#hm-layer');
      const cup = document.createElement('div'); cup.className = 'hm-cup'; cup.innerHTML = '<i></i><i></i><i></i>☕';
      layer.appendChild(cup); setTimeout(() => cup.classList.add('bye'), 4500); setTimeout(() => cup.remove(), 5200);
    }

    if (!window._hmHello) {
      window._hmHello = true;
      console.log('%cKampüs', 'font: 700 28px ui-serif, Georgia; color:#1e5b43');
      console.log('Konsola bakan meraklı öğrenci! Bir ipucu: ↑ ↑ ↓ ↓ ← → ← → B A');
    }
  }
})();
