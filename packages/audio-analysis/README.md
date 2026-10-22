# @ghoran/audio-analysis

داده و ابزار مستقل برای اندازه‌گیری بلندی، دینامیک و کیفیت فایل‌های تلاوت و ترجمهٔ صوتی قرآن. این پکیج به Qmad وابسته نیست و هیچ MP3 را تغییر نمی‌دهد.

## داده‌ها و قرارداد

- **Measured**: رکوردهای JSONL فشرده به تفکیک منبع در `data/measurements/*.jsonl.gz`؛ شامل LUFS، dBTP، RMS، مدت و تخمین فعالیت، هش و وضعیت پردازش.
- **Inferred**: baseline و آماره‌های مقاوم، توزیع بلندی، فرضیهٔ تغییر ضبط و ناهنجاری‌ها؛ در `analysis` و export اختیاری `@ghoran/audio-analysis/profiles`.
- **Recommended**: چهار سیاست هدف و فایل‌های JSON کوچک به تفکیک منبع در `data/recommendations/<target>/<source>.json`؛ نسخهٔ gzip نیز موجود است.

`datasetCoverage` مرجع پوشش واقعی است؛ نبود رکورد به معنی نبود فایل صوتی نیست. تا تکمیل استخراج، آمارها `provisional` هستند. بازه‌های سکوت، برآورد محافظه‌کارانه‌اند و مجوز trim خودکار نیستند. فایل‌های invalid دارای خطای فریم، فقط اندازه‌گیری تشخیصی دارند و وارد baseline یا Gain نشده‌اند.

خروجی مرحلهٔ export، فهرست معتبر هر ۶٬۲۳۶ آیه را در `data/verses.json.gz`، فرضیه‌های بخش ضبط را در `data/segments` و صف بازبینی را در `data/anomalies` قرار می‌دهد. `data/manifest.sha256.json` نسخهٔ بایتی خروجی‌های مصرف‌کننده را مشخص می‌کند. پوشش export فعلی را از `datasetCoverage` بخوانید؛ وضعیت اجرای قطع‌شده نیز در گزارش EXECUTION_STATUS.fa.md ثبت شده است.

شاخص `ordinal` از **۱** تا ۶۲۳۶ است؛ اندیس صفرمبنای `@ghoran/text` را با `index + 1` تبدیل کنید. `verse_id` شمارهٔ انسانی `surah:ayah` و نام MP3 شامل سه رقم سوره و سه رقم آیه است.

## مصرف در یک پلیر

```ts
import { createGainLookup, datasetCoverage } from '@ghoran/audio-analysis'
import type { CompactGainDataset } from '@ghoran/audio-analysis'

// فایل JSON فقط برای منبع و سیاست انتخاب‌شده بارگیری می‌شود؛ core هیچ fetch ندارد.
const dataset: CompactGainDataset = await loadYourSelectedDataset()
const lookup = createGainLookup(dataset)
const result = lookup.get(verseIndex + 1, actualAudioSha256)
if (result?.gainLinear !== null && result?.gainLinear !== undefined) {
  gainNode.gain.setValueAtTime(result.gainLinear, audioContext.currentTime)
}
```

`get` در صورت نبود آیه یا عدم تطابق هش، `null` برمی‌گرداند. مقدار Gain مفقود هرگز با صفر dB جایگزین نمی‌شود. `provisional` و هدف پخش در نتیجه حفظ می‌شوند. این helper پلیر را کنترل نمی‌کند و limiter/compressor ندارد؛ تبدیل دامنه `10 ** (dB / 20)` است.

داده‌های حجیم به core import نمی‌شوند. در Node می‌توانید مسیر داده را با `import.meta.resolve('@ghoran/audio-analysis/data/recommendations/-20/parhizgar.json')` پیدا کنید؛ در وب همان فایل انتخاب‌شده را روی میزبان خود سرو کنید. ورود profileها اختیاری است:

```ts
import { sourceProfiles } from '@ghoran/audio-analysis/profiles'
```

LUFS اصلی بر اساس کانال‌های واقعی فایل است. مقایسهٔ پخش، به مونو ۳٫۰۱۰۳ LU می‌افزاید، مشروط به کپی دامنهٔ یکسان در دو کانال؛ این فرض برای pan-law متفاوت باید تغییر کند. Gainها به هش نسخهٔ فایل متصل‌اند و تنظیمات حجم کاربر مستقل است. برای boost در Web Audio از GainNode و در Media3 از مسیر PCM/AudioProcessor استفاده می‌شود؛ CORS و bypass در offload باید در پلیر بررسی شوند.

## ابزار استخراج و بازتولید

ابزار Python/FFmpeg، schemaها، snapshot منبع تنزیل و provenance در `analysis/` حفظ شده‌اند. شرح کامل روش، محدودیت‌ها و ادامهٔ checkpoint در [راهنمای تحلیل](https://github.com/sabereen/ghoran/blob/main/packages/audio-analysis/analysis/README.md) و [فرهنگ داده](https://github.com/sabereen/ghoran/blob/main/packages/audio-analysis/analysis/DATA_DICTIONARY.fa.md) است. checkpoint عملیاتی در Git یا npm منتشر نمی‌شود؛ نتایج اندازه‌گیری‌شده و کد تحلیل در این مخزن نگهداری می‌شوند.

در توسعهٔ این پکیج، `extract` استخراج را بدون محدودیت زمانی دلخواه ادامه می‌دهد و `analyze` بازبینی Decode و تحلیل آماری را انجام می‌دهد. `export:data` نماهای فشردهٔ مصرف‌کننده را از snapshot تحلیل تولید می‌کند. تغییر اهداف Gain نیازی به دریافت دوبارهٔ صوت ندارد.

کد تحت MIT است. ساختار قرآن با attribution تنزیل در metadata نگهداری شده است. حقوق صوت‌های اصلی بررسی نشده و خود صوت‌ها همراه پکیج توزیع نمی‌شوند.
