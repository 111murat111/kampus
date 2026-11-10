# Kampüs

Üniversite bilgisayar bölümü öğrencileri için kendi kendine öğrenme platformu **prototipi**. Yalnızca arayüz ve demo: gerçek sunucu, hesap ya da yapay zekâ bağlantısı yoktur; tüm veri tarayıcıda (localStorage) tutulur.

## Özellikler

- Animasyonlu tanıtım sayfası (GSAP + Lenis), 6 gizli sürpriz
- İlk giriş sihirbazı: hedefe göre kişisel yol ve haftalık plan
- Kurs kataloğu, öğrenme yolları
- Her konu için 6 öğrenme yolu: video (demo oynatıcı), konu anlatımı, zihin haritası, bilgi kartları (aralıklı tekrar), konu testi, notlar
- Test merkezi: soru bankası, süreli deneme, yanlışlar defteri, eksik konu analizi
- Pomodoro, haftalık plan, çalışma odaları (simülasyon), seri / XP / rozet / lig
- "Hocaya Sor": önceden hazırlanmış yanıtlarla çalışan sahte asistan
- Mobil alt sekme çubuğu, PWA (çevrimdışı açılır), erişilebilirlik ayarları

## Çalıştırma

Derleme adımı yoktur. Klasörü herhangi bir statik sunucuyla açın:

```
python3 -m http.server 8765
```

Sonra `http://127.0.0.1:8765` adresine gidin. Demo hesabıyla doğrudan girmek için `?as=u1` ekleyin.

## İçerik ve lisanslar

Konu içerikleri elle yazılmamıştır; `tools/fetch_content.py` betiğiyle açık lisanslı kaynaklardan çekilip `js/content.js` dosyasına gömülür:

| Kaynak | Kullanım | Lisans |
|---|---|---|
| [Vikipedi (Türkçe)](https://tr.wikipedia.org) | Konu anlatımları (kısaltılmış); zihin haritaları, anahtar noktalar ve bilgi kartları maddelerden otomatik türetilir | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.tr) |
| [Open Trivia Database](https://opentdb.com) | Test ve deneme soruları (İngilizce, "Science: Computers") | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

Bu nedenle `js/content.js` dosyası **CC BY-SA 4.0** ile lisanslıdır. Her konunun kaynak maddesi uygulamadaki "Kaynaklar ve Lisanslar" sayfasında listelenir.

`vendor/` klasöründeki kütüphaneler kendi lisanslarına tabidir: GSAP (GreenSock "Standard no-charge" lisansı), Lenis (MIT).

İçeriği yenilemek için: `python3 tools/fetch_content.py`
