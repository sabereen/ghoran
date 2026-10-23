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
node packages/audio/scripts/import-pair-levels.mjs /tmp/ghoran-audio-research/packages/audio/data
pnpm --filter @ghoran/audio build
pnpm test
```

واردکننده هش ورودی‌ها، پوشش ۸۱٬۰۶۸ فایل، تمام ۳۲۴٬۲۷۲ توصیه، اتصال هر توصیه به هش فایل و سقف True Peak پس از کوانتیزه‌کردن را دوباره بررسی می‌کند. خروجی آن باید بدون تغییر در Git باقی بماند. برای اجرای مجدد استخراج صوت، راهنمای نسخهٔ پژوهشی را دنبال کنید.

Measured، Inferred و Recommended در آرشیو مستقل از هم هستند. runtime فقط سیاست baseline + حفاظت Peak را مصرف می‌کند؛ اصلاح آماری آیه یا جلسه خودکار اعمال نمی‌شود. پذیرش ۱۱ جایگزین، انتشار آن‌ها در CDN یا تأیید مستقل محتوای شنیداری را ثابت نمی‌کند؛ وضعیت انتشار هنوز در متادیتا مشخص است.


## بازتولید و اعتبارسنجی توازن جفت‌ها

`data/levels/*.bin` فقط اندازه‌گیری Measured است: signed int16 little-endian در گام‌های ۰٫۱ LU و sentinel ‎−۳۲۷۶۸ برای null. ترتیب اندیس ۰ تا ۶۲۳۵ است. مقدار، Integrated LUFS با قرارداد پخشِ snapshot است. `data/pair-evidence.json` هش آرشیو ورودی و اثرانگشت خروجی‌ها را نگه می‌دارد؛ هیچ دادهٔ Inferred وارد این سیاست نمی‌شود.

```sh
node packages/audio/scripts/import-pair-levels.mjs /tmp/ghoran-audio-research/packages/audio/data
pnpm --filter @ghoran/audio build
node packages/audio/scripts/audit-pairs.mjs /tmp/ghoran-audio-research/packages/audio/data
python packages/audio/scripts/audit-pair-audio.py packages/audio/reports/pair-validation.json
```

واردکننده، هش هر ۸۱٬۰۶۸ رکورد را به manifest صوت فعلی متصل می‌کند. ممیزی اول، تمام ۲۲۴٬۴۹۶ جفت و Peak خروجی را با اندازه‌گیری **کامل و کوانتیزه‌نشدهٔ آرشیو** بررسی می‌کند؛ `reports/pair-validation.json` شامل ماتریس ۳۶ ترکیب و فهرست ۱۳۰ محدودیت است. این‌ها **Recommended / پیش‌بینی** هستند.

ممیزی دوم، ۲۴ MP3 اصلی (۱۲ جفت، شامل شش نمونهٔ دمو و شش آیهٔ دیگر) را واقعاً دریافت، SHA-256 را بررسی و PCM پس از Gain پایه و توازن را با FFmpeg EBU R128 دوباره اندازه می‌گیرد. برای مونو، کپی صریحِ هم‌دامنه به دو کانال استفاده می‌شود. `reports/pair-audio-validation.json` این نتایج **Measured پس از Gain ثابت**، نسخهٔ FFmpeg و حجم دانلود را ثبت می‌کند. MP3 بازنویسی یا Encode نمی‌شود؛ فایل دانلودشده در پوشهٔ موقت حذف می‌شود. فایل اول، خروجی ممیزی دوم را بازسازی نمی‌کند و این دو نوع شواهد عمداً جدا هستند.

این روش رنگ صدا، تراکم گفتار یا تفاوت ادراک فردی را مدل نمی‌کند. محدودیت LUFS به‌ویژه در قطعات بسیار کوتاه پابرجاست. هدف عددی ۱ LU را نباید نتیجهٔ آزمون شنیداری یا یکسان‌کردن بلندی همهٔ آیات تعبیر کرد.
