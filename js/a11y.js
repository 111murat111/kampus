// Erişilebilirlik + mobil uygulama katmanı:
//  - Görünüm & Erişilebilirlik ayarları (yazı boyutu, yüksek kontrast, hareketi azalt, disleksi dostu yazı, tema) → localStorage, anında uygulanır
//  - Rota değişiminde odak yönetimi + aria-live duyuru, "İçeriğe atla", Alt+A kısayolu
//  - Mobil çekmece (kaydırarak kapanma, arka perde), sayfa geçişi (View Transitions / CSS yedeği)
//  - "Ana ekrana ekle" bandı (/dashboard), service worker kaydı
(function () {
  const App = window.App;
  const root = document.documentElement;
  const KEY = 'kampus-a11y';
  const INSTALL_KEY = 'kampus-install-dismissed';
  const DEF = { font: 100, hc: false, motion: false, dys: false, theme: 'system' };
  const esc = (s) => App.esc(s);
  let prefs = Object.assign({}, DEF);
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s === 'object') prefs = Object.assign(prefs, s); } catch (e) {}

  // ---------- Medya sorgusu geçersiz kılma (tema + hareket) ----------
  // Tüm aynı-köken stil sayfalarındaki @media (prefers-color-scheme / prefers-reduced-motion) kurallarını,
  // kullanıcının seçimine göre yeniden yazar; böylece sayfa CSS'lerine dokunmadan tema/hareket zorlanabilir.
  const realMM = window.matchMedia ? window.matchMedia.bind(window) : null;
  const sysDark = () => !!(realMM && realMM('(prefers-color-scheme: dark)').matches);
  const sysReduce = () => !!(realMM && realMM('(prefers-reduced-motion: reduce)').matches);
  const TRUE = '(min-width: 0px)', FALSE = '(max-width: 0px) and (min-width: 1px)';
  function rewrite(text) {
    let t = text;
    if (prefs.theme === 'dark') t = t.replace(/\(\s*prefers-color-scheme:\s*dark\s*\)/g, TRUE).replace(/\(\s*prefers-color-scheme:\s*light\s*\)/g, FALSE);
    else if (prefs.theme === 'light') t = t.replace(/\(\s*prefers-color-scheme:\s*dark\s*\)/g, FALSE).replace(/\(\s*prefers-color-scheme:\s*light\s*\)/g, TRUE);
    if (prefs.motion) t = t.replace(/\(\s*prefers-reduced-motion:\s*reduce\s*\)/g, TRUE).replace(/\(\s*prefers-reduced-motion:\s*no-preference\s*\)/g, FALSE);
    return t;
  }
  function walk(rules) {
    for (const r of rules) {
      if (r.media && r.cssRules && typeof CSSMediaRule !== 'undefined' && r instanceof CSSMediaRule) {
        if (r.__orig == null) { if (!/prefers-(color-scheme|reduced-motion)/.test(r.media.mediaText)) { walk(r.cssRules); continue; } r.__orig = r.media.mediaText; }
        const next = rewrite(r.__orig);
        if (r.media.mediaText !== next) { try { r.media.mediaText = next; } catch (e) {} }
        walk(r.cssRules);
      } else if (r.cssRules) walk(r.cssRules);
    }
  }
  function applyMedia() {
    for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch (e) { continue; } if (rules) walk(rules); }
  }
  // JS tarafında matchMedia ile hareket/tema soran modüller (gsap.matchMedia dahil) için de aynı tercih geçerli olsun.
  if (realMM) {
    window.matchMedia = function (q) {
      const s = String(q);
      let forced = null;
      if (prefs.motion && /prefers-reduced-motion/.test(s)) forced = /reduce/.test(s) && !/no-preference/.test(s);
      else if (prefs.theme !== 'system' && /prefers-color-scheme/.test(s)) forced = /dark/.test(s) ? prefs.theme === 'dark' : prefs.theme === 'light';
      if (forced === null) return realMM(q);
      const real = realMM(q);
      return { matches: forced, media: s, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; }, __real: real };
    };
  }

  const isDark = () => prefs.theme === 'dark' || (prefs.theme === 'system' && sysDark());
  const reduced = () => prefs.motion || sysReduce();
  function apply() {
    root.classList.remove('fs-90', 'fs-115');
    if (prefs.font === 90) root.classList.add('fs-90'); else if (prefs.font === 115) root.classList.add('fs-115');
    root.classList.toggle('hc', !!prefs.hc);
    root.classList.toggle('reduce-motion', !!prefs.motion);
    root.classList.toggle('dyslexic', !!prefs.dys);
    root.classList.toggle('dark', isDark());
    if (prefs.theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', prefs.theme);
    root.style.colorScheme = prefs.theme === 'system' ? 'light dark' : prefs.theme;
    const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute('content', isDark() ? '#12110d' : '#1e5b43');
    applyMedia();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {} }
  apply();
  if (realMM) { try { realMM('(prefers-color-scheme: dark)').addEventListener('change', apply); } catch (e) {} }
  window.addEventListener('load', applyMedia); // geç yüklenen stil sayfaları için

  App.a11y = { get prefs() { return Object.assign({}, prefs); }, set(k, v) { prefs[k] = v; save(); apply(); }, reset() { prefs = Object.assign({}, DEF); save(); apply(); }, reduced };

  // ---------- Canlı bölge (rota duyurusu) ----------
  const live = document.createElement('div');
  live.id = 'route-announcer'; live.className = 'sr-only'; live.setAttribute('aria-live', 'polite'); live.setAttribute('aria-atomic', 'true');
  document.body.appendChild(live);
  const toasts = document.getElementById('toasts');
  if (toasts) { toasts.setAttribute('role', 'status'); toasts.setAttribute('aria-live', 'polite'); }
  const mr = document.getElementById('modal-root'); if (mr) mr.setAttribute('aria-live', 'off');

  // ---------- Görünüm & Erişilebilirlik paneli ----------
  function openSettings() {
    const p = prefs;
    const seg = (name, label, opts) => `<fieldset class="ax-set"><legend>${label}</legend><div class="ax-seg">${opts.map(([v, l, aria]) => `<label><input type="radio" name="${name}" value="${v}" ${String(p[name]) === String(v) ? 'checked' : ''}${aria ? ` aria-label="${aria}"` : ''}><span>${l}</span></label>`).join('')}</div></fieldset>`;
    const sw = (name, title, desc) => `<label class="ax-row"><span><b>${title}</b><small>${desc}</small></span><span class="ax-sw"><input type="checkbox" role="switch" name="${name}" ${p[name] ? 'checked' : ''}><i aria-hidden="true"></i></span></label>`;
    const el = App.modal({
      title: 'Görünüm &amp; Erişilebilirlik',
      body: `<form id="ax-form" onsubmit="return false">
        ${seg('font', 'Yazı boyutu', [[90, 'A−', 'Küçük yazı (%90)'], [100, 'A', 'Normal yazı (%100)'], [115, 'A+', 'Büyük yazı (%115)']])}
        ${seg('theme', 'Tema', [['light', '☀︎ Açık', 'Açık tema'], ['dark', '☾ Koyu', 'Koyu tema'], ['system', 'Sistem', 'Sistem temasını izle']])}
        ${sw('hc', 'Yüksek kontrast', 'Daha koyu metin, belirgin kenarlıklar, buzlu cam yok.')}
        ${sw('motion', 'Hareketi azalt', 'Tüm animasyon ve geçişler kapanır (sistem ayarından bağımsız).')}
        ${sw('dys', 'Disleksi dostu yazı', 'Daha geniş harf ve satır aralığı, başlıklar sans-serif.')}
        <div class="ax-preview" aria-hidden="true"><h4>Önizleme: Yüzde problemleri</h4><p>Bir sayının %20'si 30 ise, sayının tamamı 150'dir.</p></div>
        <p class="small muted" style="margin:12px 0 0">Kısayol: <kbd class="kbd" style="float:none">Alt</kbd> + <kbd class="kbd" style="float:none">A</kbd> · Ayarlar bu cihazda saklanır.</p>
      </form>`,
      actions: [{ label: 'Varsayılana dön', onClick: (close) => { App.a11y.reset(); close(); App.toast('Görünüm varsayılana döndü'); } }, { label: 'Tamam', primary: true }]
    });
    const form = el.querySelector('#ax-form');
    form.addEventListener('change', (e) => {
      const t = e.target; if (!t.name) return;
      const v = t.type === 'checkbox' ? t.checked : (t.name === 'font' ? +t.value : t.value);
      App.a11y.set(t.name, v);
    });
    // İlk odak: seçili yazı boyutu düğmesi
    setTimeout(() => { const f = form.querySelector('input[name=font]:checked'); f && f.focus(); }, 10);
  }
  App.openA11y = openSettings;

  document.addEventListener('keydown', (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.code === 'KeyA' || e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      if (document.querySelector('#modal-root .modal')) return;
      openSettings();
    }
  });

  // "İçeriğe atla": hash router'ı bozmadan ana alana odaklan.
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('.skip-link');
    if (!a) return;
    e.preventDefault();
    const m = document.getElementById('main'); if (m) { m.focus(); m.scrollIntoView(); }
  });

  // ---------- Çekmece (mobil kenar çubuğu) ----------
  let drawerOpener = null;
  App.drawer = function (open) {
    const sb = document.getElementById('sidebar'); if (!sb) return;
    open = open == null ? !sb.classList.contains('open') : !!open;
    sb.classList.toggle('open', open);
    document.body.classList.toggle('drawer-open', open);
    ['menu-btn', 'tab-more'].forEach(id => { const b = document.getElementById(id); b && b.setAttribute('aria-expanded', String(open)); });
    if (open) {
      drawerOpener = document.activeElement;
      setTimeout(() => { const f = sb.querySelector('.nav-item.active') || sb.querySelector('a'); f && f.focus({ preventScroll: true }); }, 30);
    } else if (drawerOpener && drawerOpener.isConnected && sb.contains(document.activeElement)) { drawerOpener.focus(); drawerOpener = null; }
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('drawer-open') && !document.querySelector('#modal-root .modal')) { e.preventDefault(); App.drawer(false); }
  });
  function bindDrawer() {
    const sb = document.getElementById('sidebar'), scrim = document.getElementById('drawer-scrim');
    if (!sb) return;
    if (scrim) scrim.onclick = () => App.drawer(false);
    // Sola kaydırarak kapat (çekmece ya da perde üzerinde)
    let x0 = null, y0 = 0, dx = 0, horiz = null;
    const start = (e) => { if (!sb.classList.contains('open')) return; const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; dx = 0; horiz = null; };
    const move = (e) => {
      if (x0 == null) return; const t = e.touches[0]; dx = t.clientX - x0; const dy = t.clientY - y0;
      if (horiz == null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) horiz = Math.abs(dx) > Math.abs(dy);
      if (!horiz) return;
      sb.classList.add('dragging'); const d = Math.min(0, dx); sb.style.transform = `translateX(${d}px)`;
      if (scrim) scrim.style.opacity = String(Math.max(0, 1 + d / sb.offsetWidth));
    };
    const end = () => {
      if (x0 == null) return; x0 = null; sb.classList.remove('dragging'); sb.style.transform = ''; if (scrim) scrim.style.opacity = '';
      if (horiz && dx < -Math.min(80, sb.offsetWidth * .3)) App.drawer(false);
    };
    [sb, scrim].forEach(n => { if (!n) return; n.addEventListener('touchstart', start, { passive: true }); n.addEventListener('touchmove', move, { passive: true }); n.addEventListener('touchend', end); n.addEventListener('touchcancel', end); });
    // Çekmecede bir bağlantıya tıklanınca kapat (aynı sayfaya tıklanırsa render olmaz)
    sb.addEventListener('click', (e) => { if (e.target.closest('a') && sb.classList.contains('open')) App.drawer(false); });
  }

  // ---------- Rota geçişi + odak yönetimi ----------
  let lastPath = null, renders = 0;
  const curPath = () => (location.hash.slice(1) || '/dashboard').split('?')[0];
  App.navRender = function () {
    const next = curPath();
    const changed = next !== lastPath;
    if (changed && lastPath != null && document.startViewTransition && !reduced() && !document.hidden) {
      // Güvenlik ağı: geçiş geri çağrısı gecikirse (arka plan sekmesi, kare üretilmiyor) render'ı bekletme.
      let done = false; const run = () => { if (done) return; done = true; App.render(); };
      try {
        const vt = document.startViewTransition(run);
        // Geçiş atlanınca (skipTransition, hızlı ardışık gezinme) bu promise'ler AbortError ile reddedilir; yakalanmazsa konsola "Uncaught (in promise)" düşer.
        ['finished', 'ready', 'updateCallbackDone'].forEach(k => { try { const pr = vt && vt[k]; if (pr && typeof pr.catch === 'function') pr.catch(() => {}); } catch (e) {} });
        setTimeout(() => { if (!done) { try { vt.skipTransition(); } catch (e) {} run(); } }, 300);
        return;
      } catch (e) { if (done) return; }
    }
    App.render();
  };

  App.afterRender.push(function (path, params, layout) {
    renders++;
    const changed = lastPath !== null && path !== lastPath;
    lastPath = path;
    document.body.classList.remove('drawer-open');
    if (layout) {
      bindDrawer();
      const ax = document.getElementById('a11y-open');
      if (ax) ax.onclick = (e) => { e.preventDefault(); const d = document.getElementById('user-dd'); d && d.classList.remove('open'); openSettings(); };
      const main = document.getElementById('main');
      // CSS yedek animasyonu (View Transitions yoksa)
      if (changed && main && !document.startViewTransition && !reduced()) { main.classList.add('route-enter'); main.addEventListener('animationend', () => main.classList.remove('route-enter'), { once: true }); }
    }
    if (changed) {
      // Sayfa kendi odağını ayarlamadıysa: başlığa (yoksa ana alana) odaklan ve başlığı duyur.
      setTimeout(() => {
        const scope = document.getElementById('main') || document.getElementById('app');
        const h = scope && scope.querySelector('h1');
        const ae = document.activeElement;
        if (!ae || ae === document.body || !ae.isConnected) {
          if (h) { if (!h.hasAttribute('tabindex')) { h.setAttribute('tabindex', '-1'); h.setAttribute('data-route-focus', ''); } h.focus({ preventScroll: true }); }
          else if (scope && scope.id === 'main') scope.focus({ preventScroll: true });
        }
        const name = (h && h.textContent.trim()) || document.title.replace(/ · Kampüs$/, '');
        live.textContent = ''; setTimeout(() => { live.textContent = name + ' sayfası'; }, 60);
      }, 0);
    }
    if (path === '/dashboard' && layout) installBand();
  });

  // ---------- "Ana ekrana ekle" ----------
  let deferredPrompt = null;
  const isStandalone = () => (realMM && realMM('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const dismissed = () => { try { return localStorage.getItem(INSTALL_KEY) === '1'; } catch (e) { return false; } };
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    if (curPath() === '/dashboard') installBand();
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; const b = document.getElementById('install-band'); b && b.remove(); try { localStorage.setItem(INSTALL_KEY, '1'); } catch (e) {} });
  function installBand() {
    if (dismissed() || isStandalone()) return;
    const main = document.getElementById('main'); if (!main) return;
    const narrow = realMM && realMM('(max-width: 760px)').matches;
    const ios = isIOS();
    if (!deferredPrompt && !ios && !narrow) return; // masaüstünde, kurulum sunulmuyorsa gösterme
    const old = document.getElementById('install-band'); if (old) old.remove();
    const share = '<svg class="ib-share" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
    let text, action = '';
    if (deferredPrompt) { text = '<span>Kampüs’ü uygulama gibi aç: tek dokunuş, tam ekran, çevrimdışı da çalışır.</span>'; action = '<button class="btn primary sm" id="ib-install">Yükle</button>'; }
    else if (ios) text = `<span>Safari’de ${share} <b style="display:inline">Paylaş</b> → <b style="display:inline">Ana Ekrana Ekle</b>’ye dokun.</span>`;
    else text = '<span>Tarayıcı menüsünden <b style="display:inline">Ana ekrana ekle</b> / <b style="display:inline">Uygulamayı yükle</b>’yi seç.</span>';
    const band = document.createElement('aside');
    band.className = 'install-band'; band.id = 'install-band'; band.setAttribute('aria-label', 'Ana ekrana ekle');
    band.innerHTML = `<span class="ib-ic" aria-hidden="true">K</span><div class="ib-t"><b>Kampüs’ü ana ekranına ekle</b>${text}</div>${action}<button class="icon-btn ib-x" id="ib-x" aria-label="Bu ipucunu kapat"><span aria-hidden="true">✕</span></button>`;
    main.insertBefore(band, main.firstChild);
    band.querySelector('#ib-x').onclick = () => { try { localStorage.setItem(INSTALL_KEY, '1'); } catch (e) {} band.remove(); const h = main.querySelector('h1'); h ? (h.setAttribute('tabindex', h.getAttribute('tabindex') || '-1'), h.focus()) : main.focus(); };
    const ib = band.querySelector('#ib-install');
    if (ib) ib.onclick = async () => {
      if (!deferredPrompt) return; deferredPrompt.prompt();
      try { const r = await deferredPrompt.userChoice; if (r && r.outcome === 'accepted') { band.remove(); try { localStorage.setItem(INSTALL_KEY, '1'); } catch (e) {} } } catch (e) {}
      deferredPrompt = null;
    };
  }

  // ---------- Service worker ----------
  // Yalnız http(s) üzerinde ve güvenli bağlamda (https ya da localhost/127.0.0.1) kaydedilir.
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && window.isSecureContext) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => { try { reg.update(); } catch (e) {} }).catch(() => {});
    });
  }
})();
