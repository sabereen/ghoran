# @ghoran/audio-analysis

پروفایل‌های کم‌حجم و Tree-shakable برای هماهنگی بلندی تلاوت و ترجمهٔ صوتی قرآن؛ بدون وابستگی اجرایی، دریافت صوت، Decode، تحلیل لحظه‌ای یا کنترل پلیر.

## شروع سریع

```ts
import { parhizgar, ansarian } from '@ghoran/audio-analysis'

const gain = parhizgar.getGain('2:255') // ضریب خطی آماده، با حفاظت Peak
const translationGain = ansarian.getGain('2:255')
const url = parhizgar.getUrl('2:255')

if (gain !== null) {
  // مقدار آماده را به کنترل Gain پلیر خود بدهید.
}
```

هر منبع فقط متادیتا و استثناهای خودش را دارد. import نام‌دارِ بالا توسط bundler قابل Tree Shaking است. برای مرزبندی صریح‌تر، ورودی مستقل نیز وجود دارد:

```ts
import parhizgar from '@ghoran/audio-analysis/sources/parhizgar'
import ansarian from '@ghoran/audio-analysis/sources/ansarian'
```

ورودی اصلی هیچ catalog سراسری، manifest هش، loader پویا یا اندازه‌گیری پژوهشی را وارد مسیر پخش نمی‌کند. بیلد مصرف‌کنندهٔ واقعی، نبود متادیتای ۱۱ منبع دیگر، سایر سیاست‌ها و دادهٔ SHA-256 را برای این مثال بررسی می‌کند. ورود namespace و استفادهٔ پویا از همهٔ exportها می‌تواند مانع حذف منابع شود؛ برای پروژه با منابع ثابت، named import یا subpath مناسب است.

## API هر منبع

| API                                | خروجی                                                             |
| ---------------------------------- | ----------------------------------------------------------------- |
| `profile.getGain(verse)`           | ضریب دامنهٔ نهایی یا `null`                                       |
| `profile.getGainDb(verse)`         | Gain نهایی برحسب dB یا `null`                                     |
| `profile.getRecommendation(verse)` | وضعیت، علت نبود Gain، حفاظت Peak و نسخهٔ داده                     |
| `profile.getUrl(verse)`            | URL اصلی؛ دریافت یا تأیید بایت انجام نمی‌دهد                      |
| `profile.metadata`                 | نام، نوع، baseline، تعداد اندازه‌گیری و contentRevision همان منبع |
| `profile.policy`                   | هدف، سقف Peak، حاشیه و حدود افزایش/کاهش                           |

`verse` یکی از این سه نوع است:

```ts
parhizgar.getGain('2:255')
parhizgar.getGain({ surah: 2, ayah: 255 })
parhizgar.getGain(262) // ordinal یک‌مبنا؛ برابر با 2:255
```

**عدد از ۱ تا ۶۲۳۶ است.** اندیس صفرمبنای `@ghoran/text` و `Ayah.get(index)` را با `index + 1` تبدیل کنید، یا مستقیماً `ayah.key` را بدهید. آدرس نامعتبر خطا می‌دهد؛ فایل نامعتبر یا شاخص اندازه‌گیری‌نشده `null` می‌دهد. `null` را با `1` یا Gain پایه جایگزین نکنید.

برای lookup با شناسهٔ منبع فقط منابع مورد استفاده را ثبت کنید:

```ts
import {
  createAudioNormalizer,
  parhizgar,
  ansarian,
} from '@ghoran/audio-analysis'

const audio = createAudioNormalizer({ sources: [parhizgar, ansarian] })
const gain = audio.getGain('parhizgar', '2:255')
const details = audio.getRecommendation('ansarian', '2:255')
```

TypeScript شناسه‌ها را به منابع ثبت‌شده محدود می‌کند. منبع تکراری، هدف متفاوت یا snapshot ناسازگار پذیرفته نمی‌شود. lookup همگام است و هیچ I/O ندارد. ضرایب خطی پس از آماده‌سازی هر منبع cache می‌شوند؛ هیچ ضرب نمونه‌ای توسط این کتابخانه اجرا نمی‌شود.

## سیاست‌های دیگر؛ فقط در صورت import

ورودی پیش‌فرض هر منبع، سیاست **‎−۲۰ LUFS** است. برای ‎−۲۳، ‎−۱۸ و ‎−۱۶، فقط همان منبع و سیاست را import کنید:

```ts
import parhizgar from '@ghoran/audio-analysis/targets/-23/parhizgar'
import ansarian from '@ghoran/audio-analysis/targets/-23/ansarian'
```

برای اپ با انتخاب پویا، loader اختیاری وجود دارد:

```ts
import { loadAudioSource } from '@ghoran/audio-analysis/load'

const profile = await loadAudioSource('parhizgar', { targetLufs: -20 })
const gain = profile.getGain('1:1')
```

مسیر `/load` در bundler می‌تواند chunkهای جداگانهٔ تمام گزینه‌های قابل انتخاب را **تولید** کند؛ فقط گزینهٔ درخواست‌شده را **بارگیری** می‌کند. برای حذف کامل سایر منابع از خروجی پروژه، ورودی‌های ثابت را به کار ببرید. فهرست منابع برای UI انتخاب قاری، جداست:

```ts
import { audioSources } from '@ghoran/audio-analysis/catalog'
```

## حفاظت Peak و حفظ اصالت

سیاست فعلی Gain پایهٔ مجموعه را همراه با حفاظت True Peak اعمال می‌کند. اصلاح بخش ضبط و outlier استنباطی خودکار اعمال نمی‌شود. کل فایل یک Gain ثابت دارد؛ دامنهٔ طبیعی داخل آیه صاف نمی‌شود. هیچ MP3 تغییر یا دوباره Encode نشده است.

سقف True Peak برابر ‎−۱ dBTP و حاشیهٔ اضافی ۰٫۱۵ dB است. افزایش حداکثر ۸ و کاهش حداکثر ۱۸ dB است. Gain به گام‌های **۰٫۰۱ dB به سمت مقدار کمتر** تبدیل می‌شود؛ اختلاف از توصیهٔ دقیق کمتر از ۰٫۰۱ dB است و حفاظت Peak با عدد نهایی بررسی می‌شود. برای مثال Gain پایهٔ ‎−۷٫۵۳۳ به ‎−۷٫۵۴ تبدیل می‌شود. دقت ثابت، تعداد مقادیر و حجم داده را کاهش می‌دهد.

LUFS هدف، baseline مجموعه است؛ قرار نیست هر آیه به ‎−۲۰ برسد. اعداد بر قرارداد پخش مونو با کپی دامنهٔ یکسان به هر دو کانال تکیه دارند. در pan-law دیگر، توصیه‌ها نیاز به بازتولید دارند. جمع چند صوت هم‌زمان و تقویت دیگری پس از این Gain، به headroom جدا نیاز دارد.

## تطبیق با نسخهٔ واقعی صوت

`getGain` یک lookup روی **صوت مرجع اندازه‌گیری‌شده** است؛ تغییر محتوای URL ثابت را تشخیص نمی‌دهد. `snapshotId` و `contentRevision` شناسهٔ نسخه‌اند و به‌تنهایی اثبات تطابق بایت‌های فایل نیستند. در `getRecommendation` مقدار `contentVerified` صریحاً `false` است.

برای مسیر سخت‌گیرانه، فقط manifest هش همان منبع را وارد کنید و SHA-256 واقعی فایل دریافت‌شده را بدهید:

```ts
import parhizgar from '@ghoran/audio-analysis/sources/parhizgar'
import hashes from '@ghoran/audio-analysis/hashes/parhizgar'
import { getVerifiedAudioGain } from '@ghoran/audio-analysis/verify'

const gain = getVerifiedAudioGain(parhizgar, hashes, '2:255', actualAudioSha256)
// محتوای تغییرکرده، revision ناسازگار یا Gain ناموجود -> null
```

هش از بایت‌های فایل اصلی است، نه PCM Decodeشده. محاسبهٔ هش را می‌توانید یک بار در مسیر دانلود/cache انجام دهید. کتابخانه صوت را دوباره دریافت نمی‌کند و WebCrypto/DOM/Node API در runtime لازم ندارد. manifest هش عمداً از دادهٔ Gain بزرگ‌تر و کاملاً اختیاری است. برای بارگیری پویا از `loadAudioContentManifest` در `/load` استفاده کنید.

## منابع و وضعیت داده

شناسه‌ها: `parhizgar`, `ghamadi`, `husary`, `minshawy-murattal`, `minshawy-mujawwad`, `motaz`, `abdulbasit`, `almuiqly`, `jafarpour`, `ansarian`, `maleki`, `makarem-kabiri`, `fooladvand-hedayatfar`.

exportهای نام‌دار دوکلمه‌ای camelCase هستند: `minshawyMurattal`, `minshawyMujawwad`, `makaremKabiri`, `fooladvandHedayatfar`. subpath همیشه شناسهٔ اصلی خط‌تیره‌دار را دارد.

فهرست کامل ۸۱٬۰۶۸ مورد بررسی شده است؛ ۸۱٬۰۵۸ فایل Decode معتبر و ۸۱٬۰۵۷ فایل دارای Gain هستند. ۱۰ فایل نامعتبر و پرهیزگار ۳۹:۷۱ با مدت ۰٫۲۳۵ ثانیه Gain ندارند. موفقیت Decode، صحت محتوای آیه یا انتساب قاری را ثابت نمی‌کند. ۱۱۲ URL معیقلی برخلاف پسوند mp3 محتوای PCM دارند؛ انتخاب decoder باید از روی محتوای واقعی انجام شود.

## توسعه و بازتولید

دادهٔ Measured، Inferred و Recommended کامل در پوشه‌های `analysis/` و `data/` **مخزن Git** و آرشیو مستقل نگهداری می‌شود؛ فایل‌های حجیم پژوهشی در بستهٔ npm نیستند. `/profiles` ورود اختیاری پروفایل‌های استنباطی است. adapter قبلی `createGainLookup` برای JSON دلخواه در `/legacy` باقی است؛ export قدیمی `/data/*` از بستهٔ نصب‌شدنی حذف شده است.

```sh
pnpm --filter @ghoran/audio-analysis generate:runtime
pnpm --filter @ghoran/audio-analysis check:runtime
pnpm --filter @ghoran/audio-analysis build
pnpm test
pnpm check:packages
```

کامپایلر Node از snapshot متعهدشدهٔ داده، بدون Python، FFmpeg یا شبکه، ورودی‌های مستقل هر منبع و سیاست را بازتولید می‌کند. هش ورودی‌ها، شمار رکوردها، تطابق توصیه‌ها، حدود Gain و سقف Peak را برای تمام ۳۲۴٬۲۷۲ ترکیب منبع/آیه/هدف بررسی می‌کند. اختلاف با سیاست baseline-only باعث شکست بیلد می‌شود؛ اصلاح‌های استنباطی تأییدشدهٔ احتمالی آینده بدون تغییر صریح این قرارداد وارد runtime نمی‌شوند.

کد تحت MIT؛ ساختار سوره و آیه از [Tanzil Project](https://tanzil.net/docs/Quran_Metadata) است؛ snapshot و attribution کامل آن نیز در مخزن حفظ شده‌اند. صوت‌های اصلی داخل npm یا آرشیو تحلیل توزیع نمی‌شوند.
