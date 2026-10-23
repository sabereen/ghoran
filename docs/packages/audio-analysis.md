# تحلیل صوت قرآن

نسخهٔ مرجع فعلی پس از پذیرش ۱۱ جایگزین توسط کاربر، برای هر ۸۱٬۰۶۸ فایل Gain معتبر دارد. انتشار این ۱۱ فایل در URLهای اصلی هنوز تأیید نشده است: `audioDataset.pendingPublicationFiles` مجموع و `profile.metadata.pendingPublicationFiles` تعداد هر مجموعه را نشان می‌دهد. هش قدیمی توسط `/verify` رد می‌شود؛ فایل cacheشدهٔ قدیمی را نباید با Gain مرجع جدید اشتباه گرفت. هشدارهای آماری مستقل از سلامت Decode هستند.

`@ghoran/audio-analysis` پروفایل‌های مستقل و Tree-shakable برای هماهنگی بلندی تلاوت و ترجمه دارد. اپ فقط Gain نهایی آماده را دریافت می‌کند؛ هیچ تحلیل صوتی یا دریافت فایل توسط کتابخانه انجام نمی‌شود.

```ts
import {
  parhizgar,
  ansarian,
  createAudioNormalizer,
} from '@ghoran/audio-analysis'

const audio = createAudioNormalizer({ sources: [parhizgar, ansarian] })
const gain = audio.getGain('parhizgar', '2:255') // ضریب خطی یا null
const url = audio.getUrl('parhizgar', '2:255')
```

برای پروژه با منابع ثابت، named import بالا یا ورودی مستقل `/sources/parhizgar` استفاده شود. متادیتای قاریان دیگر، سیاست‌های دیگر و manifest هش وارد باندل انتخاب ثابت نمی‌شوند؛ این رفتار با نصب tarball واقعی و بیلد Vite کنترل می‌شود.

پیش‌فرض ‎−۲۰ LUFS در سطح baseline مجموعه، همراه با حفاظت Peak هر فایل است؛ بیان طبیعی آیات حفظ می‌شود. سیاست دیگر از `/targets/-23/parhizgar` وارد می‌شود. `/load` برای انتخاب پویا و `/catalog` برای فهرست انتخاب منبع اختیاری‌اند. loader پویا ممکن است chunkهای تمام گزینه‌ها را تولید کند؛ واردکردن ثابت برای حذف کامل منابع دیگر مناسب است.

آدرس آیه می‌تواند `'2:255'`، `{ surah: 2, ayah: 255 }` یا ordinal **یک‌مبنا** باشد. برای اندیس صفرمبنای متن `index + 1` یا `Ayah.key` را به کار ببرید. فایل نامعتبر یا فاقد loudness معتبر `null` می‌دهد؛ جایگزین خودکار با Gain پایه وجود ندارد.

`getGain` به صوت مرجع مربوط است و بایت‌های در حال پخش را تأیید نمی‌کند. برای تطبیق سخت‌گیرانه، manifest فقط همان منبع را از `/hashes/parhizgar` و `getVerifiedAudioGain` را از `/verify` وارد کنید و هش واقعی فایل اصلی را بدهید.

داده‌های پژوهشی در مخزن Git و آرشیو مستقل هستند و داخل بستهٔ اجرایی npm قرار نمی‌گیرند. شرح کامل API، محدودیت‌های قرارداد مونو، اندازه‌گیری‌ها و بازتولید در [README پکیج](https://github.com/sabereen/ghoran/tree/main/packages/audio-analysis) آمده است.
