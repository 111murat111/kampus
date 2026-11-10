// Kaynaklar ve Lisanslar (/sources) — CC BY-SA 4.0 kaynak gösterimi (src-).
// İçerik js/content.js'ten gelir (tools/fetch_content.py üretir); bu sayfa yalnızca listeler, içerik yazmaz.
(function () {
  const esc = (s) => App.esc(s);
  const ext = (href, label) => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
  const host = (url) => { try { return new URL(url).host.replace(/^www\./, ''); } catch (e) { return url || ''; } };

  function sourcesPage() {
    const db = App.db; const sources = db.sources || [];
    const fetched = db.contentFetchedAt ? App.fmtDate(db.contentFetchedAt + 'T12:00', false) : null;
    const topics = db.topics || [];
    const nQ = topics.reduce((n, t) => n + (t.questions || []).length, 0);
    const nCards = topics.reduce((n, t) => n + (t.cards || []).length, 0);
    const withSrc = topics.filter(t => t.source && t.source.url).length;

    const srcCards = sources.map(s => `
      <article class="card src-card">
        <div class="src-card-top"><h3 class="serif">${esc(s.name)}</h3><span class="tag primary">${esc(s.license || '')}</span></div>
        <p>${esc(s.use || '')}</p>
        <p class="src-card-links small">${s.url ? ext(s.url, host(s.url)) : ''}${s.url && s.licenseUrl ? ' · ' : ''}${s.licenseUrl ? ext(s.licenseUrl, 'Lisans metni') : ''}</p>
      </article>`).join('');

    // Konu → kaynak madde tablosu, kurslara göre gruplu.
    const groups = db.courses.map(c => {
      const ts = App.courseTopics(c.id); if (!ts.length) return '';
      return `<tbody>
        <tr class="src-group"><th colspan="4" scope="colgroup"><span class="dot" style="background:${esc(c.color)}" aria-hidden="true"></span>${esc(c.title)}</th></tr>
        ${ts.map(t => { const s = t.source || {}; return `<tr>
          <td><a href="#/learn/${esc(c.id)}/${esc(t.id)}?mode=text">${esc(t.title)}</a></td>
          <td>${s.url ? ext(s.url, (s.name || 'Vikipedi') + ' — «' + (s.title || t.title) + '»') : '<span class="muted">Kaynak belirtilmemiş</span>'}</td>
          <td>${s.licenseUrl ? ext(s.licenseUrl, s.license || 'CC BY-SA 4.0') : esc(s.license || '—')}</td>
          <td class="src-num">${(t.text || []).length} bölüm · ${(t.cards || []).length} kart · ${(t.questions || []).length} soru</td>
        </tr>`; }).join('')}
      </tbody>`;
    }).join('');

    return `<div class="src">
      <header class="page-head"><div>
        <div class="src-eyebrow">Açık içerik</div>
        <h1>Kaynaklar ve Lisanslar</h1>
        <p class="muted">Bu sitedeki ders içeriği elle yazılmaz; açık lisanslı kaynaklardan otomatik alınır. Kullanılan her kaynak ve lisansı aşağıdadır.</p>
      </div></header>

      <dl class="src-facts">
        <div><dt>İçeriğin çekildiği tarih</dt><dd>${fetched ? esc(fetched) : 'Bilinmiyor'}</dd></div>
        <div><dt>Konu</dt><dd>${topics.length}</dd></div>
        <div><dt>Bilgi kartı</dt><dd>${nCards}</dd></div>
        <div><dt>Soru</dt><dd>${nQ}</dd></div>
      </dl>

      <section class="src-sec">
        <h2 class="serif">Kaynaklar</h2>
        ${sources.length ? `<div class="src-cards">${srcCards}</div>` : App.emptyState('📚', 'Kaynak listesi boş', 'İçerik dosyası yüklenemedi ya da kaynak bilgisi içermiyor.')}
      </section>

      <section class="src-sec">
        <h2 class="serif">İçerik nasıl hazırlanıyor</h2>
        <ol class="src-how">
          <li><b>Otomatik betik.</b> Konu metinleri, bir betik aracılığıyla Türkçe Vikipedi maddelerinden çekilir. Elle ders metni yazılmaz.</li>
          <li><b>Metin kısaltılır, sözcükler değiştirilmez.</b> Maddelerin yalnızca bir bölümü alınır; alınan cümleler olduğu gibi bırakılır. Bu yüzden kaynak maddedeki yazım ve anlatım kusurları burada da görülebilir.</li>
          <li><b>Harita, kart ve anahtar noktalar türetilir.</b> Zihin haritaları maddenin bölüm başlıklarından, bilgi kartları ve anahtar noktalar maddedeki cümlelerden otomatik çıkarılır.</li>
          <li><b>Sorular İngilizcedir.</b> Test ve deneme soruları Open Trivia DB’nin genel bilgisayar sorularıdır; konulara yalnızca gevşek biçimde eşleştirilir. Bir soru, altında göründüğü konunun metninde geçmeyen bir bilgiyi sorabilir.</li>
          <li><b>Video yoktur.</b> “Video” yolu bir demo oynatıcıdır; gerçek video içermez.</li>
        </ol>
      </section>

      <section class="src-sec">
        <div class="src-sec-head"><h2 class="serif">Konuların kaynak maddeleri</h2><span class="small muted">${withSrc}/${topics.length} konuda kaynak bağlantısı var</span></div>
        <div class="card src-table-card"><div class="table-wrap"><table class="table src-table">
          <thead><tr><th scope="col">Konu</th><th scope="col">Kaynak madde</th><th scope="col">Lisans</th><th scope="col" class="src-num">Türetilen içerik</th></tr></thead>
          ${groups}
        </table></div></div>
      </section>

      <section class="src-sec src-legal">
        <h2 class="serif">Lisans notu</h2>
        <p>Yukarıdaki kaynaklardan alınan metinler ve sorular <b>CC BY-SA 4.0</b> ile lisanslıdır; bu sitede kısaltılarak kullanılmıştır ve aynı lisansla paylaşılır. Özgün maddelerin yazarlarına ve sürüm geçmişine, her maddenin kendi sayfasından ulaşabilirsin.</p>
        <p><b>Site kodu içerikten ayrıdır.</b> Arayüz, tasarım ve uygulama kodu bu lisansın kapsamında değildir; CC BY-SA yalnızca yukarıda listelenen kaynaklardan gelen ders içeriği için geçerlidir.</p>
        <p class="muted small">Bu bir prototiptir. Puanlar, öğrenci sayıları, lig tablosu, çalışma odalarındaki kişiler ve kurs yorumları örnek veridir.</p>
      </section>
    </div>`;
  }

  App.route('/sources', sourcesPage, { title: 'Kaynaklar ve Lisanslar' });
})();
