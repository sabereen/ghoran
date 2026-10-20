---
title: جستجوی قرآن (@ghoran/search)
lang: fa
dir: rtl
---

<script setup>
import SearchDemo from '../demo/search/SearchDemo.vue'
</script>

# جستجوی قرآن — `@ghoran/search`

کتابخانه‌ای کوچک با قالب ESM و اعلان‌های TypeScript که در جاوااسکریپت ساده، Node.js، React، Vue و Nuxt قابل استفاده است. این پکیج رابط کاربری ندارد و به DOM، پایگاه داده یا سرویس جستجو وابسته نیست. متن قرآن را از پکیج `@ghoran/text` دریافت می‌کند و نسخهٔ دیگری از قرآن را همراه خود منتشر نمی‌کند.

## امتحان کنید

<ClientOnly><SearchDemo /></ClientOnly>

نتیجه‌ها پس از مکث کوتاه در تایپ به‌روز می‌شوند. دمو در یک module worker جستجو می‌کند و متن حفص نسخهٔ ۳ را با هایلایت نمایش می‌دهد. خروجی به ده آیه محدود است و متن با interpolation نمایش داده می‌شود، نه HTML.

[دموی کامل جستجو و کد منبع آن](/demo/search/)

## نصب و جستجو

```sh
pnpm add @ghoran/search
# Also add these when importing them directly:
pnpm add @ghoran/text @ghoran/entity @ghoran/metadata
```

```ts
import { createQuranSearch } from '@ghoran/search'

const search = await createQuranSearch()
const results = await search.search('الرحمن الرحيم')
console.log(results.total, results.hits)
// Release instance-owned normalized data when finished:
search.dispose()
```

متن پیش‌فرض `tanzil-simple-clean` است. متن‌های عربی دیگر شامل `tanzil-simple-min`، `imla`، `hafs`، `hafs-v13` و `hafs-v3` هستند:

```ts
const search = await createQuranSearch({ corpus: 'hafs-v3' })
```

QPC نسخهٔ ۱ و ۲ **کدگذاری گلیف‌های فونت** هستند، نه متن عادی یونیکد عربی. انتخاب `qpc-v1` یا `qpc-v2` باعث جستجو در متن معنایی همراه، یعنی `tanzil-simple-clean` می‌شود. متن مبدأ و موقعیت توکن‌های نتیجه به همان متن همراه مربوط‌اند. نگاشت برای نمایش QPC باید صریح باشد؛ محدودیت‌های آن در بخش هایلایت آمده است.

## حالت‌ها، ترتیب و صفحه‌بندی

```ts
await search.search('الرحمن الرحيم', { mode: 'phrase' })
await search.search('رحيم الله', { mode: 'allWords' })
await search.search('رحيم غفور', { mode: 'anyWord' })
await search.search('رحم', { mode: 'substring' })
await search.search('الله', { limit: 10, offset: 20 })
```

| حالت               | معنا                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `phrase` (پیش‌فرض) | توکن‌های واژگانیِ متوالی و به ترتیب، پس از نرمال‌سازی                                                      |
| `allWords`         | حضور همهٔ توکن‌های متمایز عبارت، با هر ترتیبی                                                              |
| `anyWord`          | حضور دست‌کم یکی از توکن‌ها                                                                                 |
| `substring`        | زیررشتهٔ عیناً مطابق در توکن‌های نرمال‌شده که با فاصله به هم وصل شده‌اند؛ برای بخشی از کلمه هم کاربرد دارد |

حالت‌های کلمه‌ای، `الله` را داخل `بالله` پیدا نمی‌کنند. علائم نگارشی و فاصله‌ها مرز توکن‌اند؛ یک عبارت می‌تواند از روی علائم نگارشی عبور کند. فاصلهٔ نشکن (NBSP) حاصل از همگن‌سازی متن هم فاصله محسوب می‌شود؛ اندیس توکن با اندیس `text.split(' ')` یکسان نیست. علائم مستقل قرآنی توکن نمی‌شوند. تکرار توکن در `phrase` به تکرار متوالی نیاز دارد، اما حالت‌های مجموعهٔ کلمات تکرارها را حذف می‌کنند. همهٔ رخدادها، حتی هم‌پوشان‌ها، در `matches` می‌آیند.

خروجی همهٔ حالت‌ها به ترتیب مصحف است. `score` تعداد رخدادهاست و مرتب‌سازی بر اساس ارتباط انجام نمی‌شود. `total` تعداد **آیه‌های** مطابق پیش از صفحه‌بندی است. پیش‌فرض‌ها `limit: 20` و `offset: 0` هستند؛ `limit: 0` فقط شمارش را برمی‌گرداند. عبارت خالی، فقط فاصله، فقط علامت یا بدون کلمه نتیجه ندارد. عبارت همیشه متن تحت‌اللفظی است و به regular expression تبدیل نمی‌شود. نوع اشتباه عبارت و حالت ناشناخته خطا می‌دهند. مقادیر صفحه‌بندی باید اعداد صحیح امن و نامنفی باشند. سقف ضمنی برای تعداد نتیجه‌ها وجود ندارد؛ درخواست همهٔ نتیجه‌های کلمات پرتکرار هزینهٔ حافظه و انتقال را زیاد می‌کند.

## نرمال‌سازی عربی

```ts
import { normalizeArabic } from '@ghoran/search'

normalizeArabic('ٱلرَّحِيمِ') // 'الرحيم'
normalizeArabic('أَحَدٌ', { profile: 'strict' }) // 'أحد'
normalizeArabic('مَدْرَسَة', { profile: 'loose' }) // 'مدرسه'

const strictSearch = await createQuranSearch({ normalization: 'strict' })
await search.search('أحد', { normalization: 'strict' })
```

| رفتار                                                  | `strict`                                   | `standard` (پیش‌فرض)        | `loose`    |
| ------------------------------------------------------ | ------------------------------------------ | --------------------------- | ---------- |
| ترکیب کانونی NFC                                       | بله                                        | بله                         | بله        |
| لیگاتورهای فرم نمایشی عربی                             | بسط سازگاری                                | همان                        | همان       |
| حرکت، تشدید، سکون، کشیده، الف کوچک و علائم وقف و تلاوت | حذف                                        | حذف                         | حذف        |
| الف `آ أ إ ٱ`                                          | حفظ                                        | `ا`                         | `ا`        |
| حروف فارسی `ی ک`                                       | حفظ                                        | عربی `ي ك`                  | عربی `ي ك` |
| همزه روی واو و یاء `ؤ ئ`                               | حفظ                                        | حفظ                         | `و ي`      |
| `ء` مستقل و همزه و مد ترکیبی باقی‌مانده                | حفظ                                        | حفظ به‌جز روی الف یکسان‌شده | حذف        |
| الف مقصوره `ى`                                         | حفظ                                        | حفظ                         | `ي`        |
| تاء مربوطه `ة`                                         | حفظ                                        | حفظ                         | `ه`        |
| فاصله‌ها                                               | حذف ابتدا و انتها و ادغام فاصله‌های متوالی | همان                        | همان       |
| علائم سایر خط‌ها و نویسه‌های سازگاری                   | حفظ                                        | حفظ                         | حفظ        |

بازه‌های حذف صریح عبارت‌اند از U+0610–061A، U+064B–0652، U+0656–065F، U+0670، U+06D6–06ED، U+08D3–08E1 و U+08E3–08FF، به‌اضافهٔ U+08E2. این‌ها علائم قرآنی، واو و یاء کوچک و تنوین باز حفص نسخهٔ ۳ را پوشش می‌دهند. U+0653–0655 (مد و همزه) جداگانه پردازش می‌شوند. NFC پیش و پس از تبدیل‌ها اجرا می‌شود، حتی برای ترکیب‌های غیرمنتظره. بسط سازگاری فقط روی بازه‌های نمایشی عربی U+FB50–FDFF و U+FE70–FEFC انجام می‌شود؛ NFKC سراسری یا حذف همهٔ combining markهای یونیکد نداریم.

همهٔ پروفایل‌ها خالص و idempotent هستند. `strict` یک **نرمال‌سازی محافظه‌کارانه برای جستجو** است، نه تبدیل برگشت‌پذیر املایی یا تشخیص هویت زبانی؛ حرکت‌ها و تفاوت حروف کوچک همچنان از دست می‌روند. `standard` عمداً گونه‌های الف و همزه روی الف را یکی می‌کند. `loose` ممکن است نتیجهٔ مثبت کاذب مثل `على`/`علي` یا `مدرسة`/`مدرسه` تولید کند و همزهٔ مستقل را حذف می‌کند. هیچ پروفایلی تحلیل صرفی، استخراج ریشه، stemming، مترادف یا تطبیق تقریبی انجام نمی‌دهد.

حذف الف کوچک همیشه املای معمول را بازسازی نمی‌کند؛ مثلاً `كِتَٰب` عثمانی با `كتاب` یکسان نرمال نمی‌شود. بهتر است در متن پیش‌فرض جستجو کنید و هایلایت را به متن نمایشی نگاشت کنید. هایلایتر می‌تواند تفاوت‌های املایی محدودی را بپذیرد، بدون اینکه معنای جستجو را پنهانی گسترش دهد. هرگز نرمال‌سازی نمایشی عربی را روی کدهای گلیف QPC اجرا نکنید.

## محدوده: سوره‌ها، بازه‌ها و آیه‌های منتخب

```ts
await search.search('الله', { scope: { surahs: [1, 2] } })
await search.search('الله', { scope: { ayahRange: [7, 293] } })
await search.search('الله', { scope: { ayahIndices: [0, 8, 255, 6221] } })
```

شمارهٔ عمومی سوره **۱ تا ۱۱۴** و اندیس آیه **۰ تا ۶۲۳۵** است. بازه‌ها نیمه‌بازند: `[7, 293)` فقط بقره را شامل می‌شود. اگر چند فیلد بدهید، اشتراک آن‌ها اعمال می‌شود. مجموعه یا بازهٔ خالی نتیجه ندارد. اندیس نامعتبر، اعشار، بازهٔ معکوس و خارج از محدوده حتی برای عبارت خالی خطا می‌دهند. تکرار اعضای محدوده مشکلی ندارد.

برای مرزهای سوره از متادیتا استفاده کنید:

```ts
import { surahList } from '@ghoran/metadata'
const [start, count] = surahList[1] // Al-Baqara, index 1 = public surah 2
const results = await search.search('الله', {
  scope: { ayahRange: [start, start + count] },
})
```

## خروجی و قراردادهای اندیس‌گذاری

```ts
import type { SearchResponse, SearchHit, SearchMatch } from '@ghoran/search'
import { Ayah } from '@ghoran/entity'

const response: SearchResponse = await search.search('الرحمن الرحيم')
const hit: SearchHit = response.hits[0]
const ayah = Ayah.get(hit.ayahIndex)
console.log(hit.key, ayah.page.number, ayah.surahNumber)
```

پاسخ به شکل `{ total, hits }` است. هر نتیجه فیلدهای `ayahIndex`، `key`، `score`، `sourceText`، `normalization` و `matches` دارد و نمونه‌ای از کلاس‌های entity در آن نیست. کل شیء با JSON و structured clone سازگار است. وجود `sourceText` باعث می‌شود هر نتیجه مستقلاً قابل هایلایت باشد.

همهٔ بازه‌های تطبیق از صفر شروع می‌شوند و نیمه‌بازند:

| فیلدها                             | رشته یا دنبالهٔ مربوط                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `startWord`, `endWord`             | اندیس توکن‌های واژگانی **پس از نرمال‌سازی**                                       |
| `normalizedStart`, `normalizedEnd` | آفست UTF-16 در توکن‌های نرمال‌شدهٔ متصل با یک فاصله                               |
| `sourceStart`, `sourceEnd`         | آفست UTF-16 در `sourceText` اصلی؛ گرافیم کامل، یا کل کلمه در صورت نبود نگاشت دقیق |

`sourceText.slice(match.sourceStart, match.sourceEnd)` برای نمایش همان مبدأ امن است. آفست نرمال‌شده یا آفست مبدأ را روی رسم‌الخط دیگری اعمال نکنید. نرمال‌ساز سفارشی ممکن است یک کلمه را به چند توکن بسط دهد؛ در نبود تناظر نویسه‌به‌نویسه، نگاشت به کل کلمهٔ اصلی برمی‌گردد.

## هایلایت میان رسم‌الخط‌های عربی

```ts
import { getHighlightSegments, getHighlightRanges } from '@ghoran/search'
import { importText } from '@ghoran/text'

const display = (await importText('hafs-v3')).default
const { hits } = await search.search('الرحمن الرحيم')
const hit = hits[0]
const original = display[hit.ayahIndex]
const segments = getHighlightSegments(original, hit)
// [{ text, start, end, highlighted }, ...]
console.assert(segments.map((segment) => segment.text).join('') === original)

const { ranges, unresolvedMatches } = getHighlightRanges(original, hit)
// ranges: { start, end, accuracy: 'exact' | 'word' }[]
```

هر قطعه را به شکل گرهٔ متنی یا interpolation نمایش دهید و قطعات هایلایت‌شده را در `<mark>` بگذارید. کتابخانه رشتهٔ HTML تولید نمی‌کند و از APIهای DOM استفاده نمی‌کند. علائم اصلی، نشانه‌گذاری، فاصله‌ها، NBSP و surrogate pairها حفظ می‌شوند. آفست‌ها UTF-16 هستند و در حضور `Intl.Segmenter` بومی، مرزها روی گرافیم می‌افتند. تطبیق‌های متعدد و هم‌پوشان در بازه‌های مجزا ادغام می‌شوند، از جمله فاصلهٔ میان کلمات منتخب مجاور.

ترازسازی **محتوای کلمات** را بررسی می‌کند؛ تنها برابر بودن تعداد کلمات یا شمار حروف فیلترشده در اسکریپت همگن‌سازی کافی نیست. ترازسازی داخلی، املای نرمال‌شدهٔ استاندارد را با امکان بسط الف کوچک مقایسه می‌کند؛ واو یا مقصورهٔ دارای الف کوچک ممکن است معادل الف باشد. `ءَا` قرآنی و `آ` مرکب هم تفاوت املایی قابل‌قبول‌اند.

اتصال یک‌به‌چند و چندبه‌یک تا سه کلمه پشتیبانی می‌شود. ترازسازی بهینه فقط تناظرهای مشترک در همهٔ مسیرهای کم‌هزینه را می‌پذیرد. کلمات تکراری مبهم و تفاوت‌های املایی پشتیبانی‌نشده حل‌نشده می‌مانند. برای متن‌های سفارشی بزرگ، محاسبه به ۶۵٬۵۳۶ حالت جفت‌کلمه محدود است؛ ترازسازی‌های بزرگ‌ترِ غیرهمسان به جای تخصیص ماتریس نامحدود، حل‌نشده می‌مانند.

اگر حروف نرمال‌شده دقیقاً متناظر باشند، تطبیق زیررشته بازهٔ نویسه‌ای همراه علائم متصل می‌گیرد. اگر کلمات معتبر املای متفاوتی داشته باشند، هایلایت به کل کلمات نمایشی گسترش می‌یابد؛ پس تطبیق بخشی از یک کلمهٔ متصل ممکن است کل آن را هایلایت کند. از شباهت تقریبی حروف، حذف کلی الف یا جایگزینی تاء مربوطه با تاء استفاده نمی‌شود. `unresolvedMatches` اندیس تطبیق‌هایی را می‌دهد که دست‌کم یک کلمهٔ بدون نگاشت دارند؛ سایر کلمات معتبر ممکن است هایلایت شوند. برای پوشش کامل آن را بررسی کنید. نبود هایلایت بهتر از نسبت دادن تطبیق به کلمهٔ نامرتبط است.

### QPC و نگاشت صریح

کدهای QPC در فونت‌های هر صفحه دوباره استفاده می‌شوند. codepoint، فاصله، تعداد گلیف و تجزیهٔ یونیکد معنای عربی آن‌ها را تأیید نمی‌کند. هایلایت QPC به‌طور پیش‌فرض حل‌نشده است. باید از فرایند محتوایی تأییدشدهٔ خود، یک نگاشت **قابل اعتماد** از توکن مبدأ به بازهٔ نمایشی بدهید:

```ts
// Golden correspondence for 1:1 in this repository's QPC v2 corpus only.
const qpc = (await importText('qpc-v2')).default[0] // ﱁﱂﱃﱄﱅ
const hit = (
  await search.search('الرحمن الرحيم', {
    scope: { ayahIndices: [0] },
  })
).hits[0]
const wordMap = [0, 1, 2, 3].map((start) => ({ start, end: start + 1 }))
const segments = getHighlightSegments(qpc, hit, { wordMap })
// Highlights ﱃﱄ; leaves the final verse-number glyph unhighlighted.
```

این مثال الگوریتم عمومی QPC نیست. هر کلمه ممکن است چند گلیف داشته باشد، مرزهای کلمات متفاوت باشند، و گلیف شماره و وقف باید کنار گذاشته شوند. طول `wordMap` باید با تعداد توکن‌های نرمال‌شدهٔ مبدأ برابر باشد؛ برای کلمات ناشناخته `null` بگذارید. بازه‌ها باید مرتب و در محدوده باشند. مرز surrogate همیشه و مرز گرافیم کامل در حضور `Intl.Segmenter` بررسی می‌شود. کتابخانه این ساختار را اعتبارسنجی می‌کند؛ **درستی معنایی نگاشت بر عهدهٔ ارائه‌دهنده است**. نگاشت خودکار کل قرآن برای QPC ارائه نمی‌شود، چون دادهٔ گلیف این مخزن تناظر معنایی را ثابت نمی‌کند. [فونت صفحهٔ مناسب](/fonts) هم لازم است.

## Worker مرورگر: Vite، Vue و Nuxt

پکیج، ماژول واقعی `@ghoran/search/worker` را منتشر می‌کند که همان موتور اجرای مستقیم را وارد می‌کند. chunkهای نسبی تولیدشده هم همراه آن هستند. از یک ورودی محلی Worker استفاده کنید تا bundler مصرف‌کننده importها را resolve و همهٔ وابستگی‌ها را منتشر کند:

```ts
// src/quran.worker.ts — this is the complete file
import '@ghoran/search/worker'
```

```ts
// src/search.ts — browser/client code
import { createBrowserQuranSearch } from '@ghoran/search/browser'

export const search = await createBrowserQuranSearch({
  workerFactory: () =>
    new Worker(new URL('./quran.worker.ts', import.meta.url), {
      type: 'module',
    }),
})
```

چون بارگذاری lazy قرآن از code splitting استفاده می‌کند، خروجی Worker باید ESM باشد. این تنظیم برای نسخه‌های Vite با پیش‌فرض IIFE، از جمله نسخهٔ مورد استفادهٔ VitePress، لازم است:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
export default defineConfig({ worker: { format: 'es' } })
```

در Nuxt تنظیم معادل را در `nuxt.config.ts` قرار دهید:

```ts
export default defineNuxtConfig({ vite: { worker: { format: 'es' } } })
```

عبارت ثابت `new URL('./quran.worker.ts', import.meta.url)` را داخل `new Worker` نگه دارید تا Vite در توسعه و تولید آن را تشخیص دهد. از `new URL('@ghoran/search/worker', import.meta.url)` استفاده نکنید؛ نام پکیج URL نسبی نیست. ورودی محلی، **export منتشرشده** را بدون مسیر monorepo وارد می‌کند. روش مخصوص Vite، یعنی `import QuranWorker from '@ghoran/search/worker?worker'` و سپس `workerFactory: () => new QuranWorker()` هم ممکن است، ولی روش ورودی محلی بررسی شده است.

در Nuxt، Worker را در `onMounted` یا افزونهٔ `.client.ts` با ورودی محلی کنار کامپوننت یا افزونه بسازید؛ هنگام SSR نمونه نسازید. خود entrypoint مرورگر برای SSR امن است و در سطح ماژول Worker نمی‌سازد. حذف `workerFactory` صریحاً اجرای مستقیم را انتخاب می‌کند؛ `search.execution` مقدار `'worker'` یا `'direct'` دارد. با ارائهٔ factory، خطای راه‌اندازی به‌طور پیش‌فرض reject می‌شود. fallback صریح باید دلیل را گزارش کند:

```ts
const search = await createBrowserQuranSearch({
  workerFactory: () =>
    new Worker(new URL('./quran.worker.ts', import.meta.url), {
      type: 'module',
    }),
  fallback: 'direct',
  onFallback(error) {
    console.warn('Worker unavailable; using main thread', error)
  },
  timeoutMs: 30_000, // default initialization/request timeout
})
```

خطای زمان اجرای Worker درخواست‌های معلق را reject می‌کند، Worker را می‌بندد و نمونه را غیرقابل استفاده می‌کند؛ جستجوها بی‌اطلاع روی نخ اصلی تکرار نمی‌شوند. خطای اعتبارسنجی جستجو فقط همان درخواست را رد می‌کند و Worker قابل استفاده می‌ماند. هر درخواست شناسهٔ مستقل دارد؛ پاسخ هم‌زمان یا خارج از ترتیب درخواست دیگری را resolve نمی‌کند. `dispose()` کارهای معلق را رد می‌کند، listenerها را برمی‌دارد و Worker را می‌بندد. فراخوانی بعد از آن reject می‌شود.

### چرخهٔ عمر Vue/Nuxt و نتیجه‌های قدیمی

```vue
<script setup lang="ts">
import { onMounted, onBeforeUnmount, shallowRef } from 'vue'
import { createBrowserQuranSearch } from '@ghoran/search/browser'
import type { QuranSearch, SearchResponse } from '@ghoran/search'

const results = shallowRef<SearchResponse>({ total: 0, hits: [] })
let search: QuranSearch | undefined
let controller: AbortController | undefined
let generation = 0
let destroyed = false

onMounted(async () => {
  const engine = await createBrowserQuranSearch({
    workerFactory: () =>
      new Worker(new URL('./quran.worker.ts', import.meta.url), {
        type: 'module',
      }),
  })
  if (destroyed) engine.dispose()
  else search = engine
})
async function update(query: string) {
  if (!search) return
  controller?.abort()
  controller = new AbortController()
  const current = ++generation
  try {
    const response = await search.search(query, { signal: controller.signal })
    if (current === generation) results.value = response
  } catch (error) {
    if ((error as Error).name !== 'AbortError') console.error(error)
  }
}
onBeforeUnmount(() => {
  destroyed = true
  generation++
  controller?.abort()
  search?.dispose()
})
</script>
```

لغو درخواست، سمت فراخواننده سریعاً reject می‌شود و پاسخ نهایی نادیده گرفته می‌شود؛ کار هم‌زمان CPU که برای بارگذاری، نرمال‌سازی یا جستجو شروع شده قطع نمی‌شود. `dispose()` خود Worker را خاتمه می‌دهد. جستجوی مستقیم فقط قبل و بعد از اسکن هم‌زمان لغو را بررسی می‌کند. فراخوانی‌ها مستقل‌اند و کتابخانه حدس نمی‌زند کدام درخواست «جدیدترین» است. درخواست قبلی را لغو و هنگام به‌روزرسانی UI از شمارندهٔ ترتیب استفاده کنید. برای جلوگیری از صف اسکن‌های قدیمی، ورودی متن را debounce کنید.

### مرورگرهای قدیمی: بهبود تدریجی

`Intl.Segmenter` اختیاری است. در محیط فاقد آن، حتی داخل Worker، راه‌اندازی، نرمال‌سازی و جستجو بدون polyfill یا خطای API ادامه می‌یابد. پیاده‌سازی بومی به‌صورت lazy تشخیص داده و دوباره استفاده می‌شود.

بدون آن، موقعیت در متن اصلی و هایلایت به کل کلمه گسترش می‌یابد، حتی برای تطبیق بخشی از کلمه. مثلاً جستجوی `الله` داخل `بِاللَّهِ` در حالت زیررشته همچنان نتیجه می‌دهد، ولی کل `بِاللَّهِ` به‌جای فقط `اللَّهِ` هایلایت می‌شود. خروجی `getHighlightRanges()` دارای `accuracy: 'word'` است. متن، فاصله‌ها، surrogate pairها و علائم ترکیبی عربی کلمه حفظ می‌شوند. موقعیت‌های نرمال‌شده باقی می‌مانند؛ پس نتیجهٔ Worker قدیمی هنگام نمایش در محیط دارای segmentation می‌تواند هایلایت دقیق‌تر بگیرد.

این fallback پیاده‌سازی کامل گرافیم یونیکد نیست؛ ایموجی پیچیده، دنباله‌های joiner و خط‌های غیرعربی ممکن است مرزهای کم‌دقت‌تری داشته باشند. `wordMap` همچنان ادعای مورد اعتماد ارائه‌دهنده است. محدوده، ترتیب و مرز surrogate همیشه و مرز گرافیم فقط با segmentation بومی بررسی می‌شود. وابستگی یا polyfill اضافه نمی‌شود. پشتیبانی Unicode property escape و سایر پیش‌نیازهای جاوااسکریپت مخزن همچنان لازم است.

## Node.js و متن سفارشی هم‌تراز با آیه‌ها

ورودی اصلی نه global مرورگر دارد و نه import مخصوص Node. بارگذاری از طریق `importText` انجام می‌شود و از آداپتر CacheStorage مرورگر استفاده نمی‌کند. در Node نیازی به Worker یا اعلان‌های DOM نیست؛ ESM معمول و `await createQuranSearch()` کافی است. Unicode property escape لازم است؛ از Node نسخهٔ 22.18 به بالا (حد پایهٔ مخزن) یا مرورگر پشتیبان این قابلیت‌ها استفاده کنید. `Intl.Segmenter` دقت هایلایت را بهتر می‌کند ولی برای جستجو ضروری نیست.

برای جستجو فقط در آیه‌های درس، با حفظ شناسه‌های اصلی:

```ts
const text = (await importText('tanzil-simple-clean')).default
const ayahIndices = [0, 8, 255, 6221]
const lesson = await createQuranSearch({
  corpus: ayahIndices.map((index) => text[index]),
  ayahIndices,
})
```

برای ترجمه یا محتوای هم‌تراز با آیه‌های قرآن:

```ts
// Full-length arrays default to positional canonical ayah indices.
const translations = ['In the name of God', 'Praise belongs to God']
const translated = await createQuranSearch({
  corpus: translations,
  normalizer: 'none', // retains Persian letters, accents and case
})
// Or direct-mode case-insensitive matching:
const lower = (text: string) => text.toLocaleLowerCase('en')
const caseInsensitive = await createQuranSearch({
  corpus: translations,
  normalizer: lower,
})
const hit = (await caseInsensitive.search('GOD')).hits[0]
getHighlightSegments(hit.sourceText, hit, { normalizer: lower })
```

آرایهٔ سفارشی حداکثر ۶٬۲۳۶ رشته دارد. برای زیرمجموعه‌ها `ayahIndices` یکتا با اندیس‌های اصلی بدهید؛ در غیر این صورت اندیس موقعیتی استفاده می‌شود. ورودی کپی و خروجی بر اساس شناسهٔ اصلی مرتب می‌شود. آرایهٔ خالی مجاز است. تابع سفارشی باید قطعی باشد و روی هر کلمهٔ واژگانی جداگانه کار کند؛ نشانه‌گذاری و توکن‌سازی مشترک می‌ماند. پروفایل عربی در سطح درخواست نمی‌تواند نرمال‌ساز سفارشی یا identity را جایگزین کند. تابع از مرز انتقال Worker عبور نمی‌کند؛ اجرای مستقیم یا مقدار قابل‌انتقال `normalizer: 'none'` را انتخاب کنید. تفاوت‌های املایی میان رسم‌الخط‌های عربی برای نرمال‌ساز سفارشی یا identity غیرفعال‌اند.

## کارایی و مالکیت منابع

اسکن خطی برای این مجموعه کافی است. هر موتور متن منتخب خود را یک بار هنگام راه‌اندازی نرمال می‌کند. پروفایل عربی متفاوت در اولین استفاده به‌صورت lazy آماده و در همان نمونه نگهداری می‌شود (حداکثر سه پروفایل). کش موتور سراسریِ قابل تغییر، inverted index یا ذخیره‌سازی پایدار وجود ندارد. factoryهای هم‌زمان دادهٔ نرمال‌شدهٔ مستقل دارند؛ بارگذار ماژول جاوااسکریپت import متن را بازاستفاده می‌کند. حتی factory با ماژول از قبل بارگذاری‌شده، متن خود را نرمال می‌کند. موتور را میان درخواست‌ها بازاستفاده و در پایان عمر مالک dispose کنید. ماژول متن ممکن است پس از dispose در کش runtime بماند.

کد ایستای پکیج متن قرآن را جاسازی نمی‌کند. bundler ممکن است chunk همهٔ نسخه‌ها را **تولید** کند، چون `@ghoran/text` برای همه import پویا دارد؛ ولی هنگام راه‌اندازی فقط متن معنایی منتخب دانلود می‌شود. نسخهٔ نمایشی دانلود جداگانه دارد. شروع سرد Worker بارگذاری ماژول‌های آن را هم شامل می‌شود. رشتهٔ مبدأ در نتیجه‌ها وجود دارد و limit بزرگ هزینهٔ clone را افزایش می‌دهد.

بنچمارک بازتولیدپذیر را پس از بیلد اجرا کنید:

```sh
pnpm build
pnpm bench:search
# Refresh the committed raw measurements:
pnpm --filter @ghoran/search exec node --expose-gc bench/search.mjs --write
```

اندازه‌گیری و مشخصات محیط در [`packages/search/bench/results.json`](https://github.com/sabereen/ghoran/blob/main/packages/search/bench/results.json) ثبت شده است. بنچمارک factory سرد و گرم، میانه و p95 درخواست تکراری، تغییر heap پس از GC، اندازهٔ ESM و gzip و رفت‌وبرگشت Worker واقعی را می‌سنجد. زمان CPU و clone با worker threadهای Node و ماژول منتشرشدهٔ مرورگر سنجیده می‌شود و دانلود شبکهٔ مرورگر را شامل نمی‌شود. این‌ها اندازه‌گیری دستگاه اندرویدی نیستند. روی دستگاه ضعیف‌تر Worker، debounce، limit کوچک و آزمایش بارگذاری سرد روی سخت‌افزار هدف را ترجیح دهید.

اندازه‌گیری در **۱۹ اکتبر ۲۰۲۶** با Node v24.19.0، Linux x64 و AMD EPYC 9V74 80-Core Processor انجام شده است. هر درخواست ۱۰ بار گرم‌کردن و ۱۰۰ بار اندازه‌گیری دارد؛ راه‌اندازی با پنج نمونهٔ فرایند یا نمونهٔ تازه سنجیده می‌شود. زمان سرد شامل بارگذاری ماژول و آماده‌سازی متن است، نه شروع فرایند Node.

| درخواست        | میانه (ms) | p95 (ms) | تعداد آیه |
| -------------- | ---------: | -------: | --------: |
| کلمهٔ پرتکرار  |      1.917 |    4.126 |      1567 |
| عبارت          |      1.346 |    1.923 |         6 |
| `allWords`     |      2.178 |    3.843 |        41 |
| `anyWord`      |      1.661 |    2.463 |      1589 |
| نتیجه‌های زیاد |      2.959 |    8.878 |      2023 |
| یک سوره        |      0.495 |    0.995 |       139 |
| زیررشته        |      0.703 |    1.106 |       201 |

میانهٔ راه‌اندازی سرد **192.0 ms** و راه‌اندازی نمونهٔ تازه با ماژول گرم **144.0 ms** است. افزایش heap پس از GC برای یک موتور با متن از پیش کش‌شده حدود **12.78 MiB** بود. راه‌اندازی Worker **238.9 ms**، میانهٔ جستجوی کلمهٔ پرتکرار در Worker **2.372 ms** و میانهٔ رفت‌وبرگشت خالی **0.026 ms** بود. این زمان‌ها هزینهٔ CPU و clone در Workerِ Node را می‌سنجند.

ESM اصلی و chunk مشترک runtime در مجموع **22.31 kB خام / 7.24 kB gzip** هستند. آداپتر مرورگر 3.97 kB خام / 1.36 kB gzip و ورودی Worker برابر 1.23 kB خام / 0.55 kB gzip اضافه می‌کند و موتور مشترک را بازاستفاده می‌کند. این اندازهٔ خروجی تولیدی tsdown پیش از tree shaking و minification مصرف‌کننده است و متادیتا، وابستگی بارگذار متن و دادهٔ قرآن را شامل نمی‌شود. chunk متن اصلی منتخب حدود 196.7 kB gzip است و سایر نسخه‌ها lazy هستند.

این اسکن‌های اندازه‌گیری‌شده برای این نسخه inverted index را توجیه نمی‌کنند. نتیجه با بار runtime، دستگاه، پروفایل و limit تغییر می‌کند؛ از این CPU سروری نمی‌توان تضمین تأخیر موبایل نتیجه گرفت.

## بررسی صحت و عیب‌یابی

`pnpm verify` هر هفت پکیج را بیلد و typecheck می‌کند، Vitest را اجرا می‌کند، tarballهای واقعی را در مصرف‌کنندهٔ مستقل آفلاین نصب می‌کند، ESM و اعلان‌ها را بررسی می‌کند، Worker منتشرشده را در نخ واقعی اجرا می‌کند، resolve در Vite dev و خروجی Worker تولیدی را بررسی می‌کند و مستندات را می‌سازد. `pnpm check:search-browser` برنامهٔ بسته‌بندی‌شدهٔ Vite را در Chromium در توسعه و تولید هم اجرا می‌کند؛ اگر مرورگر در PATH نیست `CHROME_BIN` را تنظیم کنید. اسکریپت انتشار پکیج‌ها را کشف و وابستگی‌ها را پیش از مصرف‌کنندگان منتشر می‌کند. بررسی صحت این پیاده‌سازی دستور انتشار اجرا نمی‌کند.

- **در متن نمایشی نتیجه ندارید:** الف کوچک و املای عثمانی ممکن است متفاوت باشند. در `tanzil-simple-clean` جستجو و نتیجه را به نسخهٔ نمایشی نگاشت کنید.
- **بعضی کلمات هایلایت نمی‌شوند:** `unresolvedMatches` را ببینید. برای آیهٔ مبهم، نامنطبق یا پشتیبانی‌نشده از شمار کلمات حدس زده نمی‌شود.
- **نتیجهٔ QPC هایلایت ندارد:** `wordMap` قابل اعتماد و فونت صفحهٔ درست بدهید؛ نرمال‌سازی کد گلیف متن عربی را بازیابی نمی‌کند.
- **آفست اشتباه است:** آفست نرمال‌شده، آفست UTF-16 اصلی و اندیس واژگانی به دنباله‌های متفاوت اشاره می‌کنند. میان رسم‌الخط‌ها از API قطعه‌بندی استفاده کنید.
- **خطای 404، MIME یا CSP در Worker:** ورودی محلی را نگه دارید، import پکیج را به Vite بسپارید، chunkهای تولیدشده را مستقر کنید و Worker ماژولی را در CSP مجاز کنید. برای خطای IIFE/code splitting، مقدار `worker.format` در Vite را `'es'` بگذارید. resolve خام ماژول Node نام پکیج را به URL مرورگر تبدیل نمی‌کند.
- **خطای Worker is undefined در SSR:** Worker را در چرخهٔ عمر کلاینت بسازید؛ برای اجرای مستقیم سرور factory ندهید.
- **مصرف حافظه زیاد می‌شود:** موتور را بازاستفاده کنید، تغییر پروفایل را محدود کنید و موتور متعلق به کامپوننت را dispose کنید. با هر کلید موتور نسازید.
- **نتیجهٔ قدیمی جای جدید را می‌گیرد:** درخواست قبلی را لغو و تخصیص UI را با شناسهٔ نسل محافظت کنید. جستجوهای هم‌زمان مستقل عمداً پشتیبانی می‌شوند.
