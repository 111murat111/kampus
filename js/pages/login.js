// Giriş (/login) — sade, iki demo öğrenci + e-posta formu (demo).
(function () {
  const esc = (s) => App.esc(s);

  App.route('/login', () => {
    const db = App.db;
    const cards = db.users.map(u => {
      const p = db.progress[u.id] || {};
      const n = (p.enrolled || []).length;
      return `<button class="lgn-user" data-user="${u.id}">
        ${App.avatar(u, 48)}
        <span class="lgn-user-b"><b>${esc(u.name)}</b><small>${esc(u.grade || '')} · ${esc(u.target || '')}</small>
        <span class="lgn-user-m"><span>🔥 ${p.streak || 0} gün</span><span>⭐ ${(p.xp || 0).toLocaleString('tr-TR')} XP</span><span>📚 ${n} kurs</span></span></span>
        <span class="lgn-arrow" aria-hidden="true">→</span>
      </button>`;
    }).join('');
    return `<div class="lgn">
      <a class="lgn-back" href="#/home">← Ana sayfa</a>
      <div class="lgn-wrap">
        <section class="lgn-intro">
          <a class="lgn-brand" href="#/home"><span class="logo">K</span>Kampüs</a>
          <h1 class="lgn-h1">Tekrar hoş geldin.<br><em>Kaldığın yerden</em> devam edelim.</h1>
          <p class="lgn-lead">Video, konu anlatımı, zihin haritası, bilgi kartları ve testler — her konu, sana uyan yoldan.</p>
          <ul class="lgn-points">
            <li><span>🔥</span>Serini koru, her gün biraz ilerle</li>
            <li><span>🃏</span>Kartlar unutmadan önce karşına çıksın</li>
            <li><span>🎯</span>Eksik konuların otomatik belirlensin</li>
          </ul>
        </section>
        <section class="lgn-panel">
          <h2 class="serif">Giriş yap</h2>
          <p class="muted small">Bu bir prototip — bir demo öğrenciyle tek tıkla gir.</p>
          <div class="lgn-users">${cards}</div>
          <button class="ob-newuser" id="lgn-new" type="button"><span class="ob-newuser-ic" aria-hidden="true">＋</span><span><b>Yeni öğrenci olarak dene</b><small>Sıfırdan başla, 1 dakikada kişisel planını oluştur</small></span><span class="lgn-arrow" aria-hidden="true">→</span></button>
          <div class="lgn-or"><span>ya da e-postayla</span></div>
          <form class="lgn-form" id="lgn-form" novalidate>
            <div class="field"><label for="lgn-email">E-posta</label><input id="lgn-email" name="email" type="email" placeholder="elif@kampus.demo" autocomplete="email"></div>
            <div class="field"><label for="lgn-pass">Şifre</label><input id="lgn-pass" name="pass" type="password" placeholder="••••••••" autocomplete="current-password"></div>
            <p class="lgn-err" id="lgn-err" role="alert"></p>
            <button class="btn primary lgn-submit" type="submit">Giriş yap</button>
            <p class="small muted lgn-hint">Demo: <code>elif@kampus.demo</code> veya <code>can@kampus.demo</code>, şifre fark etmez.</p>
          </form>
        </section>
      </div>
    </div>`;
  }, {
    title: 'Giriş', layout: false,
    after() {
      document.querySelectorAll('[data-user]').forEach(b => b.onclick = () => {
        const u = App.db.users.find(x => x.id === b.dataset.user);
        App.login(u.id); App.toast(`Hoş geldin, ${u.name.split(' ')[0]}! 👋`);
      });
      // Yeni öğrenci: boş hesap aç → App.me() onboarded:false oluşturur → sihirbaza yönlenir (onboard.js)
      document.getElementById('lgn-new').onclick = () => {
        const id = 'u' + Date.now();
        App.db.users.push({ id, name: 'Yeni Öğrenci', email: id + '@kampus.demo', avatar: 'YÖ', grade: '', target: '', city: '' });
        App.save(); App.login(id);
      };
      const f = document.getElementById('lgn-form'); const err = document.getElementById('lgn-err');
      f.onsubmit = (e) => {
        e.preventDefault();
        const email = f.email.value.trim().toLocaleLowerCase('tr-TR');
        if (!email) { err.textContent = 'E-posta adresini yazar mısın?'; f.email.focus(); return; }
        const u = App.db.users.find(x => x.email.toLowerCase() === email);
        if (!u) { err.textContent = 'Bu e-postayla bir demo hesap bulamadık. Yukarıdaki öğrencilerden birini dene.'; f.email.focus(); return; }
        App.login(u.id); App.toast(`Hoş geldin, ${u.name.split(' ')[0]}! 👋`);
      };
    }
  });
})();
