# Anahtar — Gayrimenkul Ofisi Yönetim Platformu

Gayrimenkul ofisleri için portföy, kontrat, ekip ve ciro takibi. Her ofis kendi
e-posta uzantısıyla giriş yapar ve yalnızca kendi verisini görür; platform bu
sayede birden çok ofise ayrı ayrı sunulabilir.

> "Anahtar" ürünün geçici adıdır. Değiştirmek için yalnızca
> `src/lib/config.ts` dosyasındaki `APP_NAME` değerini düzenleyin.

## Neler yapar?

| Konu | Ne sağlar |
| --- | --- |
| **Portföyler** | Kiralık ve satılık ayrı sekmelerde. Durumlar: *Sunulabilir, Kapora Alındı, Kiralandı, Satıldı, Pasif*. Arama, danışman ve ekip filtresi. |
| **Sahibinden linki** | Portföye ilan linki eklenir; tek tıkla kopyalanır veya WhatsApp ile müşteriye gönderilir. |
| **Kontratlar** | Kiralama / satış kontratı girilir; portföy kendiliğinden "Kiralandı / Satıldı" olur, ciro ve kazanç hesaplanır. |
| **Çapraz işlemler** | Bir danışmanın portföyünü başka bir danışman (örn. başka ekipten) kapatırsa işlem "çapraz" olarak işaretlenir, ciro paylaşılır ve yönetici bunu ayrıca görür. |
| **Kayıtsız portföy uyarısı** | Kontratta yazan daire sistemde kayıtlı bir portföyle eşleşmezse üst yönetime uyarı düşer. |
| **Ekipler** | Ekipler, ekip liderleri, danışmanlar; kişi ve ekip bazında kiralama, satış, ciro. |
| **Ciro ve kazanç** | Ofis, ekip ve danışman bazında dönemsel rapor ve aylık grafik. |
| **Giriş onayı** | Herkes kendi kurumsal e-postasıyla kayıt olur; üst yönetici izin vermeden kimse giriş yapamaz. |
| **Çok ofisli yapı** | Platform sahibi yeni ofis açar; her ofis e-posta uzantısından tanınır. |

## Roller

| Rol | Görebildikleri |
| --- | --- |
| **Platform Yöneticisi** | Ofisleri açar/kapatır, e-posta uzantılarını ve üst yöneticileri yönetir. Ofislerin portföy ve kontrat verisini **görmez**; yalnızca özet sayıları görür. |
| **Üst Yönetici** | Ofisteki her şey: tüm portföyler, kontratlar, uyarılar, ciro ve kazançlar; giriş onayı, rol/ekip atama, şifre sıfırlama, ofis ayarları. Bir ofiste birden çok üst yönetici olabilir. |
| **Ekip Lideri** | Tüm portföyler; kendi ekibinin kontratları, cirosu ve kazançları; ekibindeki danışmanların portföylerini düzenleme. |
| **Danışman** | Tüm portföyler (müşteriye sunabilmek için); yalnızca kendi kontratları, ciro payı ve kazancı. |

## Portföy güvencesi nasıl çalışır?

1. **Mal sahibi bilgisi gizlidir.** Bir portföyün mal sahibi adı, telefonu ve
   özel notlarını yalnızca portföyün danışmanı, ekip lideri ve üst yönetici
   görür. Diğer danışmanlar portföyü görür ama mal sahibine doğrudan ulaşamaz.
2. **Aynı daire iki kez kaydedilemez.** "Nida Park Sitesi, B Blok, Daire 12"
   ile "NİDAPARK sit. b blok no:12" aynı daire olarak tanınır; ikinci kayıt
   reddedilir ve dairenin kimin portföyünde olduğu söylenir.
3. **Her kapanış bir kontrata bağlıdır.** "Kiralandı / Satıldı" durumu elle
   seçilemez; yalnızca kontrat girilince oluşur.
4. **Kontrat daireyi eşleştirir.** Danışman daireyi listeden seçmez de elle
   yazarsa sistem yine kayıtlı portföyle eşleştirir ve gerekiyorsa çapraz işlem
   olarak kaydeder.
5. **Eşleşmeyen kontrat uyarı üretir.** Sistemde kaydı olmayan bir daireye
   kontrat girilirse üst yöneticinin **Uyarılar** sayfasına düşer. Yönetici
   benzer kayıtları görür; uyarıyı mevcut portföye bağlayarak, portföy kaydı
   oluşturarak ya da açıklama yazarak kapatır.
6. **Her işlem kayıt altındadır.** Kim, neyi, ne zaman değiştirdi; portföy ve
   kontrat sayfalarındaki "Geçmiş" bölümünde görünür ve silinemez.

## Ciro ve kazanç hesabı

- **Ciro:** Kontrattaki hizmet bedeli (ofisin aldığı komisyon).
- **Çapraz işlem:** Ciro, portföy sahibi ile işlemi yapan danışman arasında
  paylaşılır (varsayılan %50 / %50).
- **Kazanç:** Danışmanın kendi ciro payından aldığı tutar (varsayılan %50);
  kalan ofise aittir.

Oranlar **Ayarlar** sayfasından ofis geneli için, **Ekip** sayfasından kişiye
özel değiştirilebilir. Değişiklik yalnızca sonraki kontratlara uygulanır.

## Veriler nerede durur?

Tüm veriler **PostgreSQL** veritabanında saklanır; tarayıcıda (localStorage vb.)
hiçbir iş verisi tutulmaz. Ofisler arası ayrım hem uygulama katmanında hem de
veritabanı kısıtlarıyla (bileşik yabancı anahtarlar) güvence altındadır: bir
ofisin kontratı başka bir ofisin portföyüne veya danışmanına bağlanamaz.

Şifreler geri çözülemeyen biçimde (scrypt) saklanır. Oturumlar sunucuda tutulur;
hesap kapatıldığında veya şifre sıfırlandığında açık oturumlar hemen sona erer.

---

## Yerelde çalıştırma

Gerekenler: Node.js 20.9+ ve PostgreSQL 14+.

```bash
npm install
cp .env.example .env        # DATABASE_URL ve platform yöneticisi bilgilerini doldurun
npm run dev                 # http://localhost:3000
```

Uygulama açılırken veritabanı tablolarını kendisi kurar ve `.env` içindeki
platform yöneticisi hesabını oluşturur.

### Demo verisi

Uygulamayı dolu hâliyle görmek için (30 kişilik ofis, 3 ekip, portföyler,
kontratlar, çapraz işlemler, uyarılar ve ikinci bir ofis):

```bash
npm run db:seed:demo
```

Tüm demo hesaplarının şifresi `Demo1234`:

| Hesap | E-posta |
| --- | --- |
| Üst yönetici | `sultan.aydemir@rwpozitif.com` |
| Ekip lideri | `kerem.aydin@rwpozitif.com` |
| Danışman | `silan.yildiz@rwpozitif.com`, `zeynep.arslan@rwpozitif.com` |
| Diğer ofis (yalıtımı görmek için) | `hakan.demir@remaxdemo.com` |

Demo verisi yalnızca tanıtım içindir; canlı ortamda yüklenmez.

---

## Yayına alma

İki şeye ihtiyaç var: uygulamayı çalıştıracak bir barındırma hizmeti ve
yedeklemesi açık bir PostgreSQL veritabanı.

### Ortam değişkenleri

| Değişken | Açıklama |
| --- | --- |
| `DATABASE_URL` | PostgreSQL bağlantı adresi |
| `DATABASE_SSL` | Bulut veritabanlarında `true`, yerelde `false` |
| `PLATFORM_ADMIN_EMAIL` | Platform sahibinin giriş e-postası |
| `PLATFORM_ADMIN_PASSWORD` | En az 12 karakter, harf ve rakam içermeli |
| `PLATFORM_ADMIN_NAME` | İsteğe bağlı görünen ad |

### Seçenek A — Yönetilen barındırma (önerilen)

Railway, Render, Vercel gibi bir hizmet + yönetilen PostgreSQL (Neon, Supabase,
Railway Postgres vb.). Veritabanı yedeklerini sağlayıcı alır.

1. Sağlayıcıda bir PostgreSQL veritabanı oluşturun ve bağlantı adresini alın.
2. Bu depoyu barındırma hizmetine bağlayın.
3. Yukarıdaki ortam değişkenlerini girin.
4. Derleme komutu `npm run build`, başlatma komutu `npm run start`.
5. Alan adınızı bağlayın (HTTPS zorunludur; oturum çerezi yalnızca HTTPS'te çalışır).

İlk açılışta tablolar ve platform yöneticisi kendiliğinden oluşur. Sağlık
denetimi adresi: `/api/saglik`.

### Seçenek B — Kendi sunucunuz (Docker)

```bash
cp .env.example .env    # POSTGRES_PASSWORD ve PLATFORM_ADMIN_* değerlerini doldurun
docker compose up -d --build
```

Uygulama 3000 portunda açılır; önüne HTTPS sağlayan bir ters vekil (Caddy,
Nginx, Cloudflare) koyun. Veriler `pgdata` biriminde kalıcıdır; düzenli yedek
almak sizin sorumluluğunuzdadır (`pg_dump`).

### İlk kurulum (yayından sonra)

1. Platform sahibi `PLATFORM_ADMIN_EMAIL` ile giriş yapar → **Yeni ofis**.
2. Ofis adı, e-posta uzantısı (örn. `ofisiniz.com`) ve üst yöneticinin
   e-postası girilir. Ekranda bir **geçici şifre** görünür; üst yöneticiye
   güvenli bir yoldan iletilir.
3. Üst yönetici geçici şifreyle girer, kendi şifresini belirler.
4. **Ekip** sayfasından ekiplerini oluşturur.
5. Danışmanlar **Kayıt ol** sayfasından ofis e-postalarıyla kayıt olur.
6. Üst yönetici **Ekip** sayfasında her birine rol ve ekip atayıp giriş izni verir.

Başka bir ofise satış yapıldığında yalnızca 1–2. adımlar tekrarlanır.

---

## Komutlar

| Komut | İşlev |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` / `npm run start` | Canlı ortam derlemesi ve sunucusu |
| `npm test` | Otomatik testler (ayrı bir test veritabanı gerekir, bkz. aşağı) |
| `npm run typecheck` / `npm run lint` | Tip ve kod denetimi |
| `npm run db:generate` | Şema değişikliğinden migrasyon üretir |
| `npm run setup` | Migrasyon + platform yöneticisi (otomatik kurulum kapalıysa) |
| `npm run db:seed:demo` | Demo verisi |

### Testler

Testler iş kurallarını gerçek bir PostgreSQL üzerinde doğrular: giriş onayı,
portföy eşleştirme, çapraz işlem ve ciro paylaşımı, kayıtsız portföy uyarısı,
yetkiler ve ofisler arası yalıtım.

```bash
createdb anahtar_test
TEST_DATABASE_URL=postgres://kullanici:sifre@localhost:5432/anahtar_test npm test
```

Test veritabanı her çalıştırmada sıfırlanır; adında `test` geçmeyen bir
veritabanına karşı çalışmayı reddeder.

## Proje yapısı

```
src/
  app/            Sayfalar (giriş, panel, portföyler, kontratlar, uyarılar, ekip, kazanç, ayarlar, platform)
  components/     Arayüz bileşenleri
  lib/
    db/           Veritabanı şeması ve bağlantısı
    domain/       İş kuralları: daire eşleştirme, komisyon, yetkiler, para/tarih
    services/     Veri katmanı (tüm sorgular ofis ve yetkiye göre sınırlanır)
    actions/      Formların sunucu işlemleri
    auth/         Şifre, oturum, sayfa korumaları
drizzle/          Veritabanı migrasyonları
scripts/          Kurulum ve demo verisi betikleri
tests/            Otomatik testler
```

Teknoloji: Next.js 16, React 19, TypeScript, PostgreSQL, Drizzle ORM, Tailwind CSS.

## Bilinen sınırlar ve sonraki adımlar

- **E-posta doğrulaması yok.** Kayıtta e-postanın kişiye ait olduğu
  doğrulanmaz; güvence, üst yöneticinin kişiyi tanıyarak onay vermesidir.
  E-posta gönderim hizmeti bağlandığında doğrulama, "şifremi unuttum" ve
  uyarıların e-postayla iletilmesi eklenebilir. Şu an unutulan şifreyi üst
  yönetici sıfırlar.
- **Sahibinden entegrasyonu link düzeyindedir.** Sahibinden'in açık bir
  veri arayüzü olmadığı için ilan bilgileri otomatik çekilmez.
- **Fotoğraf ve belge yükleme yok** (kontrat PDF'i, daire fotoğrafı).
- **Tek para birimi:** Türk lirası.
- **KVKK:** Sistem mal sahibi ve müşteri adları gibi kişisel veriler saklar.
  Canlı kullanımda aydınlatma metni, veri saklama süresi ve sunucu konumu gibi
  yükümlülükler ofisin / platform sahibinin sorumluluğundadır.
