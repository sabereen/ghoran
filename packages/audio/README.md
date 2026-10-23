# @ghoran/audio

پروفایل‌های کم‌حجم و Tree-shakable برای هماهنگی بلندی تلاوت و ترجمهٔ صوتی قرآن؛ بدون وابستگی اجرایی، دریافت صوت، Decode، تحلیل لحظه‌ای یا کنترل پلیر.


## توازن همان آیه و ترجمه — نسخهٔ ۰٫۳

Gain پایهٔ مجموعه، اختلافِ تک‌تک جفت‌ها را تضمین نمی‌کند: در روش قبلی، ترجمهٔ ملکی در فاتحهٔ ۱ حدود **۱۱٫۳ LU** بلندتر از معتز باقی می‌ماند. برای پخش پشت‌سرهم، از API اختیاریِ توازن استفاده کنید:

```ts
import motaz from '@ghoran/audio/paired/motaz'
import maleki from '@ghoran/audio/paired/maleki'
import { createAudioPair } from '@ghoran/audio/pair'

const audio = createAudioPair({ recitation: motaz, translation: maleki })
const result = audio.getRecommendation(ayahIndex)
if (result.status === 'ready') {
  recitationGainNode.gain.value = result.recitation.gainLinear
  translationGainNode.gain.value = result.translation.gainLinear
  // matched / cutLimited / differenceLu نشان می‌دهند هدف دست‌یافتنی بوده یا خیر.
}
```

این حالت ابتدا Gain پایه و حفاظت Peak را می‌گیرد، سپس **فقط عضو بلندتر همان جفت را کاهش** می‌دهد تا اختلافِ پیش‌بینی‌شده حداکثر ۱ LU شود. فایل آرام‌تر، سطح قابل دستیابی را تعیین می‌کند؛ قرار نیست همهٔ آیات یکسان یا حتماً ‎−۲۰ LUFS شوند. هیچ تقویت اضافه، limiter، compressor، تغییر سکوت یا DSP لحظه‌ای انجام نمی‌شود. Gain کل هر فایل ثابت است، پس دینامیک داخل فایل حفظ می‌شود؛ **دینامیک بین فایل‌ها تغییر می‌کند**. این سیاست انتخابیِ پخش است، نه اعلام خطا یا اصلاح خودکار فرضیه‌های ضبط.

`toleranceLu` پیش‌فرض ۱ و `maximumAdditionalCutDb` پیش‌فرض ۱۸ است؛ سقف مطلق کاهش پروفایل نیز رعایت می‌شود. کمبود بودجه با `matched: false` و `cutLimited: true` مشخص می‌شود. دادهٔ نامعتبر `status: 'unavailable'` و خروجی‌های `null` می‌دهد؛ چیزی از همسایه حدس زده نمی‌شود.

ورودی‌های `/sources/*` همچنان **Gain پایه + استثناها** هستند. فقط `/paired/*` علاوه بر آن، ۶٬۲۳۶ اندازه‌گیری بلندی پخش را با دقت ۰٫۱ LU نگه می‌دارد: ۱۲٬۴۷۲ بایت باینری برای هر منبع، حدود ۸ KB فشرده در ماژول منتشرشده. این داده آرایهٔ Gain نیست و مستقل از سیاست جفت است. فقط منابع importشده وارد باندل می‌شوند؛ جدول آدرس، هش‌ها و سایر قاریان وارد نمی‌شوند. خطای اختلاف ناشی از کوانتیزه‌کردن حداکثر ۰٫۱ LU است. نزدیک‌شدن LUFS، برابری کامل ادراک، رنگ صدا یا دینامیک را تضمین نمی‌کند.

در ممیزی تمام **۲۲۴٬۴۹۶ جفت مرجع**، ۱۳۰ جفت با سقف کاهش قابل تطبیق کامل نبودند. برای معتز–ملکی، صدک ۹۵ اختلاف از ۵٫۲۵ به ۱٫۰۶ LU و بیشینه از ۱۱٫۵۰ به ۱٫۱۰ LU رسید؛ این‌ها **پیش‌بینی از اندازه‌گیری مرجع** هستند، نه آزمون شنیداری. [گزارش و روش بازتولید](https://github.com/sabereen/ghoran/blob/main/packages/audio/RESEARCH.md) تفکیک دادهٔ خام، پیش‌بینی و اندازه‌گیری مجدد را توضیح می‌دهد.

این API هم بایتِ در حال پخش را تأیید نمی‌کند (`contentVerified: false`). برای تطبیق سخت‌گیرانه، هش **هر دو فایل اصلی** را با manifest همان منبع بررسی کنید. برای بخش کوتاه‌شدهٔ آیه، اندازه‌گیریِ کل آیه لزوماً بلندی همان بخش نیست.

## نسخهٔ مرجع فعلی

این snapshot شامل ۸۱٬۰۶۸ فایل قابل Decode و دارای Gain است؛ ۱۰ فایل خراب و یک فایل بسیار کوتاه با ۱۱ نسخهٔ جایگزین پذیرفته‌شده توسط کاربر رفع شده‌اند. سابقهٔ قبلی حفظ شده است. این پذیرش، تأیید مستقل شنیداریِ متن یا مرزها نیست.

**انتشار این ۱۱ نسخه در URLهای اصلی هنوز تأیید نشده است.** `audioDataset.pendingPublicationFiles` جمع آن‌ها و `profile.metadata.pendingPublicationFiles` تعداد هر منبع را نشان می‌دهد. تا جایگزینی بایت‌های CDN و پاک‌شدن cache قدیمی، Gain جدید فقط برای همان فایل مرجع جدید معتبر است. مسیر `/verify` هش قدیمی را رد می‌کند. نبود Gain در snapshot فعلی صفر است، ولی API همچنان برای نسخهٔ نامعتبر/ناشناخته یا هش نامنطبق `null` را حفظ می‌کند. هشدارهای آماری باقی‌مانده مستقل از این اصلاح‌ها هستند.

## شروع سریع

```ts
import { parhizgar, ansarian } from '@ghoran/audio'

const ayahIndex = 261 // بقره، آیهٔ ۲۵۵؛ همان اندیس متن و Ayah.index
const gain = parhizgar.getGain(ayahIndex) // ضریب خطی آماده، با حفاظت Peak
const translationGain = ansarian.getGain(ayahIndex)

if (gain !== null) {
  // مقدار آماده را به کنترل Gain پلیر خود بدهید.
}
```

هر منبع فقط متادیتا و استثناهای خودش را دارد. import نام‌دارِ بالا توسط bundler قابل Tree Shaking است. برای مرزبندی صریح‌تر، ورودی مستقل نیز وجود دارد:

```ts
import parhizgar from '@ghoran/audio/sources/parhizgar'
import ansarian from '@ghoran/audio/sources/ansarian'
```

ورودی اصلی هیچ catalog سراسری، manifest هش، loader پویا یا اندازه‌گیری پژوهشی را وارد مسیر پخش نمی‌کند. بیلد مصرف‌کنندهٔ واقعی، نبود متادیتای ۱۱ منبع دیگر، سایر سیاست‌ها و دادهٔ SHA-256 را برای این مثال بررسی می‌کند. ورود namespace و استفادهٔ پویا از همهٔ exportها می‌تواند مانع حذف منابع شود؛ برای پروژه با منابع ثابت، named import یا subpath مناسب است.

## API هر منبع

| API                                    | خروجی                                                             |
| -------------------------------------- | ----------------------------------------------------------------- |
| `profile.getGain(ayahIndex)`           | ضریب دامنهٔ نهایی یا `null`                                       |
| `profile.getGainDb(ayahIndex)`         | Gain نهایی برحسب dB یا `null`                                     |
| `profile.getRecommendation(ayahIndex)` | وضعیت، علت نبود Gain، حفاظت Peak و نسخهٔ داده                     |
| `profile.metadata`                     | نام، نوع، baseline، تعداد اندازه‌گیری و contentRevision همان منبع |
| `profile.policy`                       | هدف، سقف Peak، حاشیه و حدود افزایش/کاهش                           |

تمام APIهای آیه از **اندیس صفرمبنا، از ۰ تا ۶۲۳۵** استفاده می‌کنند؛ دقیقاً همان اندیس آرایهٔ متن، ترجمه و `Ayah.index`. عدد یک‌مبنا، رشته و آبجکت آدرس پشتیبانی نمی‌شوند. اندیس نامعتبر `RangeError` می‌دهد؛ اندازه‌گیری نامعتبر یا ناموجود `null` می‌دهد. `null` را با `1` یا Gain پایه جایگزین نکنید.

```ts
parhizgar.getGain(0) // فاتحه ۱
parhizgar.getGain(261) // بقره ۲۵۵
parhizgar.getGain(6235) // ناس ۶
```

`getRecommendation` همان `ayahIndex` ورودی را برمی‌گرداند؛ برای تولید جزئیات Gain هیچ تبدیل سوره/آیه انجام نمی‌شود. دادهٔ runtime همچنان **Gain پایه + استثناهای کم‌تعداد** است و آرایهٔ ۶۲۳۶تایی Gain برای هر منبع نگهداری نمی‌شود.

### URL اختیاری

کد تبدیل اندیس به نام فایل و جدول ۱۱۴ سوره فقط از ورودی مستقل `/url` وارد می‌شوند؛ پروفایل‌ها و registry متد `getUrl` ندارند. در برنامه‌ای که URL خودش را دارد، این ورودی را import نکنید:

```ts
import { getAudioUrl } from '@ghoran/audio/url'

const url = getAudioUrl(parhizgar, 261) // .../002255.mp3
// metadata انتخاب‌شده از /catalog نیز پذیرفته می‌شود.
```

این تابع دریافت فایل یا تأیید محتوای URL انجام نمی‌دهد. اگر آدرس سوره/آیه دارید، می‌توانید با `Ayah.getByKey('2:255')!.index` از `@ghoran/entity` اندیس مشترک بگیرید؛ پکیج صوت برای Gain به آن پکیج وابسته نیست.

برای lookup با شناسهٔ منبع فقط منابع مورد استفاده را ثبت کنید:

```ts
import { createAudioNormalizer, parhizgar, ansarian } from '@ghoran/audio'

const audio = createAudioNormalizer({ sources: [parhizgar, ansarian] })
const gain = audio.getGain('parhizgar', 261)
const details = audio.getRecommendation('ansarian', 261)
```

TypeScript شناسه‌ها را به منابع ثبت‌شده محدود می‌کند. منبع تکراری، هدف متفاوت یا snapshot ناسازگار پذیرفته نمی‌شود. lookup همگام است و هیچ I/O ندارد. ضرایب خطی پس از آماده‌سازی هر منبع cache می‌شوند؛ هیچ ضرب نمونه‌ای توسط این کتابخانه اجرا نمی‌شود.

## سیاست‌های دیگر؛ فقط در صورت import

ورودی پیش‌فرض هر منبع، سیاست **‎−۲۰ LUFS** است. برای ‎−۲۳، ‎−۱۸ و ‎−۱۶، فقط همان منبع و سیاست را import کنید:

```ts
import parhizgar from '@ghoran/audio/targets/-23/parhizgar'
import ansarian from '@ghoran/audio/targets/-23/ansarian'
```

برای اپ با انتخاب پویا، loader اختیاری وجود دارد:

```ts
import { loadAudioSource } from '@ghoran/audio/load'

const profile = await loadAudioSource('parhizgar', { targetLufs: -20 })
const gain = profile.getGain(0)
```

مسیر `/load` در bundler می‌تواند chunkهای جداگانهٔ تمام گزینه‌های قابل انتخاب را **تولید** کند؛ فقط گزینهٔ درخواست‌شده را **بارگیری** می‌کند. برای حذف کامل سایر منابع از خروجی پروژه، ورودی‌های ثابت را به کار ببرید. فهرست منابع برای UI انتخاب قاری، جداست:

```ts
import { audioSources } from '@ghoran/audio/catalog'
```

## حفاظت Peak و حفظ اصالت

سیاست فعلی Gain پایهٔ مجموعه را همراه با حفاظت True Peak اعمال می‌کند. اصلاح بخش ضبط و outlier استنباطی خودکار اعمال نمی‌شود. کل فایل یک Gain ثابت دارد؛ دامنهٔ طبیعی داخل آیه صاف نمی‌شود. هیچ MP3 تغییر یا دوباره Encode نشده است.

سقف True Peak برابر ‎−۱ dBTP و حاشیهٔ اضافی ۰٫۱۵ dB است. افزایش حداکثر ۸ و کاهش حداکثر ۱۸ dB است. Gain به گام‌های **۰٫۰۱ dB به سمت مقدار کمتر** تبدیل می‌شود؛ اختلاف از توصیهٔ دقیق کمتر از ۰٫۰۱ dB است و حفاظت Peak با عدد نهایی بررسی می‌شود. برای مثال Gain پایهٔ ‎−۷٫۵۳۳ به ‎−۷٫۵۴ تبدیل می‌شود. دقت ثابت، تعداد مقادیر و حجم داده را کاهش می‌دهد.

LUFS هدف، baseline مجموعه است؛ قرار نیست هر آیه به ‎−۲۰ برسد. اعداد بر قرارداد پخش مونو با کپی دامنهٔ یکسان به هر دو کانال تکیه دارند. در pan-law دیگر، توصیه‌ها نیاز به بازتولید دارند. جمع چند صوت هم‌زمان و تقویت دیگری پس از این Gain، به headroom جدا نیاز دارد.

## تطبیق با نسخهٔ واقعی صوت

`getGain` یک lookup روی **صوت مرجع اندازه‌گیری‌شده** است؛ تغییر محتوای URL ثابت را تشخیص نمی‌دهد. `snapshotId` و `contentRevision` شناسهٔ نسخه‌اند و به‌تنهایی اثبات تطابق بایت‌های فایل نیستند. در `getRecommendation` مقدار `contentVerified` صریحاً `false` است.

برای مسیر سخت‌گیرانه، فقط manifest هش همان منبع را وارد کنید و SHA-256 واقعی فایل دریافت‌شده را بدهید:

```ts
import parhizgar from '@ghoran/audio/sources/parhizgar'
import hashes from '@ghoran/audio/hashes/parhizgar'
import { getVerifiedAudioGain } from '@ghoran/audio/verify'

const gain = getVerifiedAudioGain(parhizgar, hashes, 261, actualAudioSha256)
// محتوای تغییرکرده، revision ناسازگار یا Gain ناموجود -> null
```

هش از بایت‌های فایل اصلی است، نه PCM Decodeشده. محاسبهٔ هش را می‌توانید یک بار در مسیر دانلود/cache انجام دهید. کتابخانه صوت را دوباره دریافت نمی‌کند و WebCrypto/DOM/Node API در runtime لازم ندارد. manifest هش عمداً از دادهٔ Gain بزرگ‌تر و کاملاً اختیاری است. برای بارگیری پویا از `loadAudioContentManifest` در `/load` استفاده کنید.

## منابع و وضعیت داده

شناسه‌ها: `parhizgar`, `ghamadi`, `husary`, `minshawy-murattal`, `minshawy-mujawwad`, `motaz`, `abdulbasit`, `almuiqly`, `jafarpour`, `ansarian`, `maleki`, `makarem-kabiri`, `fooladvand-hedayatfar`.

exportهای نام‌دار دوکلمه‌ای camelCase هستند: `minshawyMurattal`, `minshawyMujawwad`, `makaremKabiri`, `fooladvandHedayatfar`. subpath همیشه شناسهٔ اصلی خط‌تیره‌دار را دارد.

فهرست کامل ۸۱٬۰۶۸ مورد بررسی شده است؛ snapshot مرجع فعلی پس از پذیرش جایگزین‌ها برای همهٔ موارد Gain دارد. انتشار ۱۱ جایگزین در URL اصلی همچنان تأیید نشده است. موفقیت Decode، صحت محتوای آیه یا انتساب قاری را ثابت نمی‌کند. ۱۱۲ URL معیقلی برخلاف پسوند mp3 محتوای PCM دارند؛ انتخاب decoder باید از روی محتوای واقعی انجام شود.

## توسعه و بازتولید

پکیج پخش، snapshot کم‌حجم و کنترل‌شدهٔ Gain پایه + استثناها را نگه می‌دارد. اندازه‌گیری‌های کامل و ابزار پژوهشی در [نسخهٔ آرشیوی](https://github.com/sabereen/ghoran/tree/fbd55d0fe9c3cf5559a0af9e0b6ca1e9da37d365/packages/audio) حفظ شده‌اند؛ گزارش‌های حجیم، نمودارها و تاریخچه‌های اجرایی داخل این پکیج نیستند.

```sh
pnpm --filter @ghoran/audio build
pnpm --filter @ghoran/audio check:runtime
pnpm test
pnpm check:packages
```

ماژول‌های مستقل هر منبع و سیاست در بیلد با Node تولید می‌شوند و خروجی تولیدشده در Git تکرار نمی‌شود. Python، FFmpeg و شبکه برای بیلد روزمره لازم نیستند. [RESEARCH.md](https://github.com/sabereen/ghoran/blob/main/packages/audio/RESEARCH.md) ورودی‌ها، مرجع ثابت و دستور بازتولید علمی را توضیح می‌دهد.

[دموی مقایسهٔ شنیداری](https://sabereen.github.io/ghoran/demo/audio/) امکان انتخاب هر ۹ قاری و ۴ ترجمه و مقایسهٔ همان صوت با Gain و بدون آن را دارد.

کد تحت MIT؛ ساختار سوره و آیه از [Tanzil Project](https://tanzil.net/docs/Quran_Metadata) است؛ منبع و روش اعتبارسنجی در آرشیو پژوهش حفظ شده‌اند. صوت‌های اصلی داخل پکیج npm توزیع نمی‌شوند.
