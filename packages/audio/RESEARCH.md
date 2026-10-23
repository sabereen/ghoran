# منبع داده و بازتولید

این پکیج فقط دادهٔ لازم برای پخش را نگه می‌دارد. اندازه‌گیری‌ها، گزارش‌ها، نمودارها، متدهای Python/FFmpeg و تاریخچهٔ ۱۱ جایگزین در [نسخهٔ پژوهشی ثابت](https://github.com/sabereen/ghoran/tree/fbd55d0fe9c3cf5559a0af9e0b6ca1e9da37d365/packages/audio) حفظ شده‌اند. برنچ `archive/quran-audio-analysis-2026-10-23` به همین کامیت اشاره می‌کند؛ این پوشه‌های حجیم وارد main نمی‌شوند.

- `data/snapshot.json`: قرارداد و نسخهٔ داده، طول سوره‌ها و شمارش‌های ممیزی.
- `data/sources/*.json`: متادیتای هر منبع، Gain پایه و استثناها برای چهار سیاست؛ اندیس‌ها صفرمبنا هستند.
- `data/hashes/*.bin`: هش SHA-256 فایل‌ها به ترتیب اندیس، هر هش دقیقاً ۳۲ بایت؛ ۶۲۳۶ هش برای هر منبع. این داده فقط با import صریح `/hashes/<id>` وارد باندل می‌شود.
- `data/manifest.sha256.json`: کنترل تغییر تمام ورودی‌های بیلد.
- `test/fixtures/reference.json`: اثرانگشت Gain، Peak و هش‌های کامل پژوهش؛ بازتولید ماژول‌ها نباید این اثرانگشت‌ها را تغییر دهد.

بیلد عادی فقط Node نیاز دارد و هیچ دانلود، تحلیل صوت یا Python اجرا نمی‌کند:

```sh
pnpm --filter @ghoran/audio build
pnpm --filter @ghoran/audio check:runtime
```

برای بازتولید snapshot از نتایج کامل پژوهش:

```sh
git worktree add --detach /tmp/ghoran-audio-research fbd55d0fe9c3cf5559a0af9e0b6ca1e9da37d365
pnpm --filter @ghoran/audio import:analysis /tmp/ghoran-audio-research/packages/audio/data
pnpm --filter @ghoran/audio build
pnpm test
```

واردکننده هش ورودی‌ها، پوشش ۸۱٬۰۶۸ فایل، تمام ۳۲۴٬۲۷۲ توصیه، اتصال هر توصیه به هش فایل و سقف True Peak پس از کوانتیزه‌کردن را دوباره بررسی می‌کند. خروجی آن باید بدون تغییر در Git باقی بماند. برای اجرای مجدد استخراج صوت، راهنمای نسخهٔ پژوهشی را دنبال کنید.

Measured، Inferred و Recommended در آرشیو مستقل از هم هستند. runtime فقط سیاست baseline + حفاظت Peak را مصرف می‌کند؛ اصلاح آماری آیه یا جلسه خودکار اعمال نمی‌شود. پذیرش ۱۱ جایگزین، انتشار آن‌ها در CDN یا تأیید مستقل محتوای شنیداری را ثابت نمی‌کند؛ وضعیت انتشار هنوز در متادیتا مشخص است.
