// Demo veri — gerçek bağlantı yok. Üniversite bilgisayar bölümü öğrencilerine yönelik kendi kendine öğrenme platformu.
// KONU İÇERİKLERİ burada yazılmaz: js/content.js dosyasından gelir (window.CONTENT). O dosya tools/fetch_content.py ile
// açık lisanslı kaynaklardan (Türkçe Vikipedi, Open Trivia DB — CC BY-SA 4.0) otomatik üretilir.
// ŞEMA:
// course: { id, title, subtitle, category, level, color, emoji, instructor, rating, ratingCount, students, hours, tags[], outcomes[], units:[{ id, title, topics:[topicId] }] }
// topic:  { id, courseId, title, duration, chapters:[{t,title}], text:[{h,p}], keyPoints[], mindmap:{label,children[]}, cards:[{id,q,a}],
//           questions:[{id,text,options[],answer,explain,difficulty(1-3),source}], source:{name,title,url,license,licenseUrl,note} }
// path:   { id, title, desc, emoji, steps:[{courseId, note}] }
// exam:   { id, title, desc, duration(dk), sections:[{courseId, count, label}] }
(function () {
  const C = window.CONTENT || { topics: [], sources: [], fetchedAt: null };
  const ids = (cid) => C.topics.filter(t => t.courseId === cid).map(t => t.id);
  const titles = (cid) => C.topics.filter(t => t.courseId === cid).map(t => t.title);
  // Kurs kazanımları konu başlıklarından üretilir (içerik yazılmaz).
  const outcomes = (cid) => titles(cid).map(t => t + ' konusunu çalışırsın');
  // Üniteler: konular ikişerli gruplanır.
  const units = (cid, names) => { const all = ids(cid); const out = []; for (let i = 0; i < all.length; i += 2) out.push({ id: 'u' + (out.length + 1), title: names[out.length] || 'Bölüm ' + (out.length + 1), topics: all.slice(i, i + 2) }); return out; };
  const SRC = 'Açık kaynak · Vikipedi';

  window.SEED = {
    users: [
      { id: 'u1', name: 'Elif Yılmaz', email: 'elif@kampus.demo', avatar: 'EY', grade: '2. sınıf', target: 'Bilgisayar Mühendisliği', city: 'İstanbul' },
      { id: 'u2', name: 'Can Demir', email: 'can@kampus.demo', avatar: 'CD', grade: '1. sınıf', target: 'Yazılım Mühendisliği', city: 'Ankara' }
    ],
    categories: [
      { id: 'prog', name: 'Programlama', emoji: '💻' }, { id: 'kuram', name: 'Algoritma & Veri Yapıları', emoji: '🧩' },
      { id: 'sistem', name: 'Sistemler', emoji: '⚙️' }, { id: 'veri', name: 'Veri & Ağ', emoji: '🌐' }
    ],
    courses: [
      { id: 'prog', title: 'Programlamaya Giriş', subtitle: titles('prog').join(' · '), category: 'prog', level: 'Başlangıç', color: '#3d3d3d', emoji: '🐍', instructor: SRC, rating: 4.8, ratingCount: 4100, students: 22100, hours: 12, tags: ['1. sınıf', 'Programlama'], outcomes: outcomes('prog'), units: units('prog', ['Dil ve Temeller', 'Yaklaşımlar']) },
      { id: 'ds', title: 'Veri Yapıları', subtitle: titles('ds').join(' · '), category: 'kuram', level: 'Orta', color: '#1e5b43', emoji: '🌳', instructor: SRC, rating: 4.7, ratingCount: 2210, students: 12030, hours: 14, tags: ['2. sınıf', 'Veri Yapıları'], outcomes: outcomes('ds'), units: units('ds', ['Temel Yapılar', 'Ağaçlar ve Tablolar']) },
      { id: 'algo', title: 'Algoritmalar', subtitle: titles('algo').join(' · '), category: 'kuram', level: 'Orta', color: '#8a3b2a', emoji: '🧮', instructor: SRC, rating: 4.9, ratingCount: 3412, students: 18450, hours: 18, tags: ['2. sınıf', 'Algoritma Analizi'], outcomes: outcomes('algo'), units: units('algo', ['Analiz', 'Sıralama', 'Arama ve Çizgeler']) },
      { id: 'os', title: 'İşletim Sistemleri', subtitle: titles('os').join(' · '), category: 'sistem', level: 'İleri', color: '#2c4a6b', emoji: '⚙️', instructor: SRC, rating: 4.6, ratingCount: 1540, students: 8420, hours: 16, tags: ['3. sınıf', 'Sistemler'], outcomes: outcomes('os'), units: units('os', ['Süreçler', 'Eşzamanlılık ve Bellek']) },
      { id: 'db', title: 'Veritabanı Sistemleri', subtitle: titles('db').join(' · '), category: 'veri', level: 'Orta', color: '#7a5a14', emoji: '🗄️', instructor: SRC, rating: 4.7, ratingCount: 1890, students: 9870, hours: 13, tags: ['2. sınıf', 'Veritabanı'], outcomes: outcomes('db'), units: units('db', ['Temeller', 'SQL ve Tasarım']) },
      { id: 'net', title: 'Bilgisayar Ağları', subtitle: titles('net').join(' · '), category: 'veri', level: 'İleri', color: '#5b6b1e', emoji: '🌐', instructor: SRC, rating: 4.8, ratingCount: 2760, students: 15200, hours: 17, tags: ['3. sınıf', 'Ağlar'], outcomes: outcomes('net'), units: units('net', ['Katmanlar', 'Adresleme', 'Uygulama Katmanı']) }
    ],
    topics: C.topics,
    sources: C.sources,
    contentFetchedAt: C.fetchedAt,
    paths: [
      { id: 'cs-temel', title: 'Bilgisayar Bilimi Temelleri', emoji: '🎓', desc: 'İlk iki yılın çekirdek dersleri: programlama, veri yapıları, algoritmalar.', steps: [{ courseId: 'prog', note: 'Programlama temeli' }, { courseId: 'ds', note: 'Veri yapıları' }, { courseId: 'algo', note: 'Algoritma analizi' }] },
      { id: 'mulakat', title: 'Teknik Mülakat Hazırlığı', emoji: '🧑‍💻', desc: 'Staj ve iş görüşmelerinde en çok sorulan konular.', steps: [{ courseId: 'ds', note: 'Veri yapıları' }, { courseId: 'algo', note: 'Algoritmalar' }, { courseId: 'db', note: 'SQL ve veritabanı' }] },
      { id: 'sistem', title: 'Sistem ve Ağ', emoji: '🖧', desc: 'İşletim sistemleri, ağlar ve veritabanları: üst sınıf sistem dersleri.', steps: [{ courseId: 'os', note: 'İşletim sistemleri' }, { courseId: 'net', note: 'Bilgisayar ağları' }, { courseId: 'db', note: 'Veritabanı sistemleri' }] }
    ],
    exams: [
      { id: 'vize-temel', title: 'Temel Dersler Mini Vize', desc: 'Programlama, veri yapıları ve algoritmalar karışık.', duration: 20, sections: [{ courseId: 'prog', count: 4, label: 'Programlama' }, { courseId: 'ds', count: 4, label: 'Veri Yapıları' }, { courseId: 'algo', count: 4, label: 'Algoritmalar' }] },
      { id: 'sistem-tarama', title: 'Sistem Dersleri Taraması', desc: 'İşletim sistemleri ve bilgisayar ağları.', duration: 15, sections: [{ courseId: 'os', count: 5, label: 'İşletim Sistemleri' }, { courseId: 'net', count: 5, label: 'Ağlar' }] },
      { id: 'genel', title: 'Bilgisayar Bilimi Genel Deneme', desc: 'Altı dersin tamamından karma sorular.', duration: 25, sections: [{ courseId: 'prog', count: 3, label: 'Programlama' }, { courseId: 'algo', count: 3, label: 'Algoritmalar' }, { courseId: 'os', count: 3, label: 'İşletim Sistemleri' }, { courseId: 'db', count: 3, label: 'Veritabanı' }, { courseId: 'net', count: 3, label: 'Ağlar' }] }
    ],
    badges: [
      { id: 'ilk-adim', name: 'İlk Adım', icon: '👣', desc: 'İlk konunu tamamladın.' },
      { id: 'seri-7', name: '7 Gün Seri', icon: '🔥', desc: '7 gün üst üste çalıştın.' },
      { id: 'kart-50', name: 'Kart Ustası', icon: '🃏', desc: '50 bilgi kartı tekrarladın.' },
      { id: 'tam-puan', name: 'Tam Puan', icon: '🏆', desc: 'Bir konu testinde hepsi doğru.' },
      { id: 'deneme-1', name: 'Deneme Savaşçısı', icon: '⚔️', desc: 'İlk denemeni bitirdin.' },
      { id: 'harita', name: 'Haritacı', icon: '🗺️', desc: '5 zihin haritası inceledin.' },
      { id: 'pomodoro', name: 'Odak Ustası', icon: '🍅', desc: '10 pomodoro tamamladın.' },
      { id: 'gece', name: 'Gece Kuşu', icon: '🦉', desc: 'Gece 23:00’ten sonra çalıştın.' }
    ],
    league: [
      { name: 'Zeynep K.', avatar: 'ZK', xp: 2840 }, { name: 'Mert A.', avatar: 'MA', xp: 2310 }, { name: 'Selin Ö.', avatar: 'SÖ', xp: 1980 },
      { name: 'Ahmet T.', avatar: 'AT', xp: 1420 }, { name: 'Ece B.', avatar: 'EB', xp: 990 }, { name: 'Burak S.', avatar: 'BS', xp: 610 }
    ],
    progress: {
      u1: {
        enrolled: ['prog', 'ds', 'algo'],
        activePath: 'cs-temel',
        done: { 'prog-python': true, 'prog-degisken': true, 'ds-veriyapisi': true },
        modes: { 'prog-python': ['video', 'text', 'quiz'], 'prog-degisken': ['video', 'mindmap', 'text'], 'ds-veriyapisi': ['text', 'cards', 'quiz'], 'ds-bagliliste': ['video'] },
        last: { courseId: 'ds', topicId: 'ds-bagliliste', mode: 'video', pos: 312 },
        notes: {},
        cards: { 'prog-python:c1': { box: 3, due: '2026-11-09' }, 'prog-python:c2': { box: 2, due: '2026-11-08' }, 'ds-veriyapisi:c1': { box: 1, due: '2026-11-09' }, 'prog-degisken:c1': { box: 4, due: '2026-11-15' } },
        quizResults: { 'prog-python': { score: 2, total: 3, at: '2026-11-06T20:10' }, 'prog-degisken': { score: 1, total: 3, at: '2026-11-07T21:00' }, 'ds-veriyapisi': { score: 3, total: 3, at: '2026-11-08T19:30' } },
        wrongs: ['prog-degisken:q1', 'prog-degisken:q2', 'prog-python:q3'],
        exams: [{ id: 'r1', examId: 'vize-temel', at: '2026-11-04T15:00', correct: 7, wrong: 4, empty: 1, net: 6, bySubject: { prog: { c: 3, w: 1, e: 0 }, ds: { c: 2, w: 1, e: 1 }, algo: { c: 2, w: 2, e: 0 } }, byTopic: { 'prog-python': { c: 2, t: 2 }, 'prog-degisken': { c: 1, t: 2 }, 'ds-veriyapisi': { c: 2, t: 2 }, 'ds-bst': { c: 0, t: 2 }, 'algo-buyuko': { c: 1, t: 2 }, 'algo-siralama': { c: 1, t: 2 } }, answers: null }],
        xp: 1760, streak: 6, lastStudy: '2026-11-08',
        studyLog: { '2026-11-03': 45, '2026-11-04': 70, '2026-11-05': 30, '2026-11-06': 55, '2026-11-07': 80, '2026-11-08': 40 },
        goal: { dailyMinutes: 60 },
        pomodoros: 7,
        badges: ['ilk-adim', 'tam-puan'],
        plan: [
          { id: 'p1', day: '2026-11-09', title: 'Bağlı liste videosu', topicId: 'ds-bagliliste', done: false },
          { id: 'p2', day: '2026-11-09', title: 'Günlük kart tekrarı', topicId: null, done: false },
          { id: 'p3', day: '2026-11-10', title: 'Büyük O gösterimi + konu testi', topicId: 'algo-buyuko', done: false },
          { id: 'p4', day: '2026-11-11', title: 'Temel Dersler Mini Vize (tekrar)', topicId: null, done: false }
        ],
        mindmapsViewed: ['prog-degisken'],
        onboarded: true
      },
      u2: {
        enrolled: ['prog'], activePath: 'cs-temel', done: {}, modes: {}, last: null, notes: {}, cards: {}, quizResults: {}, wrongs: [], exams: [],
        xp: 240, streak: 1, lastStudy: '2026-11-08', studyLog: { '2026-11-08': 20 }, goal: { dailyMinutes: 30 }, pomodoros: 0, badges: [], plan: [], mindmapsViewed: [], onboarded: true
      }
    }
  };
})();
