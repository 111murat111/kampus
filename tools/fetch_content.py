#!/usr/bin/env python3
"""Açık lisanslı içerikleri çekip js/content.js dosyasını üretir.

Kaynaklar:
  - Konu metinleri: Türkçe Vikipedi (CC BY-SA 4.0) — metinler kısaltılarak, sözcükleri değiştirilmeden alınır.
    Zihin haritası, anahtar noktalar ve bilgi kartları aynı maddenin başlık yapısından otomatik türetilir.
  - Sorular: Open Trivia Database, "Science: Computers" kategorisi (CC BY-SA 4.0) — İngilizce.
Site çalışırken internete bağlanmaz; bu betik yalnızca içerik güncellenirken elle çalıştırılır:
  python3 tools/fetch_content.py
"""
import json, re, time, random, urllib.request, urllib.parse, urllib.error, datetime, os, sys

UA = {'User-Agent': 'kampus-prototype-content-fetch/0.1 (educational demo)'}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# kurs → [(konu kimliği, Vikipedi madde adı)]
COURSES = {
    'prog': [('prog-python', 'Python'), ('prog-degisken', 'Değişken (bilgisayar bilimi)'), ('prog-ozyineleme', 'Özyineleme'), ('prog-oop', 'Nesne yönelimli programlama')],
    'ds': [('ds-veriyapisi', 'Veri yapısı'), ('ds-bagliliste', 'Bağlı liste'), ('ds-bst', 'İkili arama ağacı'), ('ds-hash', 'Hash tablosu')],
    'algo': [('algo-algoritma', 'Algoritma'), ('algo-buyuko', 'Büyük O gösterimi'), ('algo-siralama', 'Sıralama algoritması'), ('algo-quicksort', 'Hızlı sıralama'), ('algo-ikiliarama', 'İkili arama algoritması'), ('algo-dijkstra', 'Dijkstra algoritması')],
    'os': [('os-isletim', 'İşletim sistemi'), ('os-thread', 'İş parçacığı'), ('os-deadlock', 'Deadlock'), ('os-sanalbellek', 'Sanal bellek')],
    'db': [('db-veritabani', 'Veritabanı'), ('db-iliskisel', 'İlişkisel veritabanı'), ('db-sql', 'SQL'), ('db-normalizasyon', 'Veritabanı normalizasyonu')],
    'net': [('net-osi', 'OSI modeli'), ('net-tcp', 'İletim Denetimi Protokolü'), ('net-ip', 'IP adresi'), ('net-dns', 'DNS'), ('net-http', 'HTTP')],
}
# Open Trivia DB sorularını kurslara eşlemek için anahtar sözcükler (küçük harf, İngilizce)
KEYWORDS = {
    'net': ['http', 'tcp', 'udp', ' ip ', 'ip address', 'dns', 'network', 'internet', 'port ', 'protocol', 'router', 'ethernet', 'wi-fi', 'wifi', 'url', 'domain', 'ssh', 'ftp', 'lan', 'www', 'web', 'html', 'browser'],
    'db': ['sql', 'database', 'query', 'relational'],
    'os': ['operating system', 'linux', 'windows', 'kernel', 'unix', 'ubuntu', 'macos', 'mac os', 'android', 'ram', 'memory', 'cpu', 'process', 'thread', 'boot', 'bios', 'file system', 'debian', 'dos'],
    'algo': ['algorithm', 'sort', 'search', 'complexity', 'big o', 'turing', 'np-', 'recursion', 'binary'],
    'ds': ['stack', 'queue', 'array', 'tree', 'hash', 'linked list', 'data structure', 'fifo', 'lifo', 'byte', 'bit'],
    'prog': ['python', 'java', 'programming', 'language', 'variable', 'function', 'class', 'object', 'c++', 'c#', 'compile', 'code', 'javascript', 'php', 'ruby', 'syntax', 'keyword'],
}
SKIP = {'kaynakça', 'dış bağlantılar', 'ayrıca bakınız', 'notlar', 'kaynaklar', 'bibliyografya', 'konuyla ilgili yayınlar', 'dipnotlar', 'ek okumalar', 'ileri okuma', 'galeri', 'dış kaynaklar', 'referanslar'}


CACHE = os.path.join(ROOT, 'tools', '.cache')


def get(url, cache=True):
    """JSON getirir; hız sınırına (429) takılırsa bekleyip yeniden dener. Yanıtlar tools/.cache altında saklanır."""
    import hashlib
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest() + '.json')
    if cache and os.path.exists(path):
        return json.load(open(path, encoding='utf-8'))
    for attempt in range(6):
        try:
            data = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30))
            if cache:
                json.dump(data, open(path, 'w', encoding='utf-8'), ensure_ascii=False)
            return data
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 5:
                raise
            time.sleep(8 * (attempt + 1))


def sentences(text):
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ0-9"“(])', text.strip()) if s.strip()]


def clip(text, limit):
    """Metni cümle sınırında keser; sözcükleri değiştirmez."""
    out = ''
    for s in sentences(text):
        if out and len(out) + len(s) + 1 > limit:
            break
        out = (out + ' ' + s).strip()
        if len(out) > limit:
            break
    return out


def clean(text):
    text = re.sub(r'\{\\displaystyle[^\n]*', '', text)       # LaTeX kalıntıları
    text = re.sub(r'[ \t]+', ' ', text)
    return re.sub(r'\n{2,}', '\n', text).strip()


def parse(extract):
    """Düz metin özütünü [(düzey, başlık, metin)] listesine çevirir. Giriş bölümü düzey 1'dir."""
    parts, level, head, buf = [], 1, None, []
    for line in extract.split('\n'):
        m = re.match(r'^(={2,})\s*(.*?)\s*\1$', line.strip())
        if m:
            parts.append((level, head, clean('\n'.join(buf))))
            level, head, buf = len(m.group(1)), m.group(2), []
        else:
            buf.append(line)
    parts.append((level, head, clean('\n'.join(buf))))
    return parts


def fetch_topic(tid, cid, title):
    q = urllib.parse.urlencode({'action': 'query', 'format': 'json', 'redirects': 1, 'prop': 'extracts|info', 'explaintext': 1, 'exsectionformat': 'wiki', 'inprop': 'url', 'titles': title})
    page = next(iter(get('https://tr.wikipedia.org/w/api.php?' + q)['query']['pages'].values()))
    parts = parse(page['extract'])
    name = re.sub(r'\s*\(.*?\)$', '', page['title'])
    intro = parts[0][2]

    # Konu anlatımı: giriş + metni olan ilk 4 ana bölüm
    text = [{'h': name, 'p': clip(intro, 900)}] if intro else []
    for lv, h, body in parts[1:]:
        if lv != 2 or h.lower() in SKIP or len(body) < 120:
            continue
        text.append({'h': h, 'p': clip(body.replace('\n', ' '), 800)})
        if len(text) >= 5:
            break

    # Zihin haritası: ana başlıklar → alt başlıklar
    children, cur = [], None
    for lv, h, body in parts[1:]:
        if h is None or h.lower() in SKIP:
            cur = None if lv == 2 else cur
            continue
        if lv == 2:
            cur = {'label': h[:40], 'children': []}
            children.append(cur)
        elif lv == 3 and cur is not None and len(cur['children']) < 4:
            cur['children'].append({'label': h[:36]})
    children = children[:6]
    if len(children) < 2:  # başlığı az olan maddeler: bölüm ilk cümlelerinden dallar
        children = [{'label': s[:38] + ('…' if len(s) > 38 else '')} for s in sentences(intro)[:4]]

    # Anahtar noktalar ve bilgi kartları: bölümlerin ilk cümleleri
    key_points, cards = [], []
    for i, sec in enumerate(text):
        ss = sentences(sec['p'])
        if not ss:
            continue
        first = ss[0]
        if len(first) <= 190 and len(key_points) < 5:
            key_points.append(first)
        ans = first if len(first) >= 60 or len(ss) < 2 else first + ' ' + ss[1]
        if len(ans) <= 320 and len(cards) < 5:
            cards.append({'id': 'c%d' % (len(cards) + 1), 'q': name if i == 0 else '%s — %s' % (name, sec['h']), 'a': ans})

    total = 8 + min(22, len(page['extract']) // 900)
    chapters = [{'t': '%02d:00' % (i * total // max(1, len(text))), 'title': sec['h']} for i, sec in enumerate(text)]
    return {
        'id': tid, 'courseId': cid, 'title': name, 'duration': '%02d:%02d' % (total, random.Random(tid).randrange(0, 60)),
        'chapters': chapters, 'text': text, 'keyPoints': key_points, 'mindmap': {'label': name, 'children': children},
        'cards': cards, 'questions': [],
        'source': {'name': 'Vikipedi', 'title': page['title'], 'url': page['fullurl'], 'license': 'CC BY-SA 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by-sa/4.0/deed.tr', 'note': 'Metin kısaltılarak alınmıştır; zihin haritası ve kartlar madde yapısından otomatik türetilmiştir.'}
    }


def fetch_questions():
    un = urllib.parse.unquote
    token = get('https://opentdb.com/api_token.php?command=request', cache=False)['token']
    out = []
    for _ in range(5):
        time.sleep(5.5)  # hız sınırı: 5 sn'de 1 istek
        d = get('https://opentdb.com/api.php?amount=50&category=18&encode=url3986&token=' + token, cache=False)
        if d['response_code'] != 0:
            break
        for r in d['results']:
            out.append({'text': un(r['question']), 'correct': un(r['correct_answer']), 'wrong': [un(x) for x in r['incorrect_answers']], 'difficulty': {'easy': 1, 'medium': 2, 'hard': 3}[r['difficulty']], 'type': r['type']})
    return out


def main():
    random.seed(42)
    topics = []
    for cid, items in COURSES.items():
        for tid, title in items:
            print('vikipedi:', title, file=sys.stderr)
            topics.append(fetch_topic(tid, cid, title))
            time.sleep(1.5)

    qs = fetch_questions()
    print('opentdb soru:', len(qs), file=sys.stderr)
    pools = {c: [] for c in COURSES}
    rest = []
    for q in qs:
        low = ' ' + (q['text'] + ' ' + q['correct']).lower() + ' '
        cid = next((c for c, kws in KEYWORDS.items() if any(k in low for k in kws)), None)
        (pools[cid] if cid else rest).append(q)
    by_course = {c: [t for t in topics if t['courseId'] == c] for c in COURSES}
    for cid, ts in by_course.items():
        pool = pools[cid]
        while len(pool) < len(ts) * 3 and rest:   # her konuya en az 3 soru düşsün
            pool.append(rest.pop())
        for i, q in enumerate(pool[:len(ts) * 6]):
            t = ts[i % len(ts)]
            if q['type'] == 'boolean':
                options, answer = ['True', 'False'], 0 if q['correct'] == 'True' else 1
            else:
                options = q['wrong'] + [q['correct']]
                random.shuffle(options)
                answer = options.index(q['correct'])
            t['questions'].append({'id': 'q%d' % (len(t['questions']) + 1), 'text': q['text'], 'options': options, 'answer': answer, 'explain': 'Doğru cevap: ' + q['correct'], 'difficulty': q['difficulty'], 'source': 'Open Trivia DB'})

    content = {
        'fetchedAt': datetime.date.today().isoformat(),
        'sources': [
            {'name': 'Vikipedi (Türkçe)', 'url': 'https://tr.wikipedia.org', 'license': 'CC BY-SA 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by-sa/4.0/deed.tr', 'use': 'Konu anlatımları; zihin haritaları, anahtar noktalar ve bilgi kartları bu maddelerden otomatik türetildi.'},
            {'name': 'Open Trivia Database', 'url': 'https://opentdb.com', 'license': 'CC BY-SA 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by-sa/4.0/', 'use': 'Test ve deneme soruları ("Science: Computers" kategorisi, İngilizce).'}
        ],
        'topics': topics
    }
    with open(os.path.join(ROOT, 'js', 'content.js'), 'w', encoding='utf-8') as f:
        f.write('// OTOMATİK ÜRETİLDİ — elle düzenlemeyin. Üretmek için: python3 tools/fetch_content.py\n')
        f.write('// İçerik lisansı: CC BY-SA 4.0 (Vikipedi, Open Trivia DB). Ayrıntı: window.CONTENT.sources\n')
        f.write('window.CONTENT = ' + json.dumps(content, ensure_ascii=False, indent=1) + ';\n')
    for t in topics:
        print('%-18s bölüm:%d kart:%d soru:%d harita:%d' % (t['id'], len(t['text']), len(t['cards']), len(t['questions']), len(t['mindmap']['children'])), file=sys.stderr)


if __name__ == '__main__':
    main()
