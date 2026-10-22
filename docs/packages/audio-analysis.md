# تحلیل صوت قرآن

`@ghoran/audio-analysis` اندازه‌گیری‌های صوتی، استنباط‌های آماری و پیشنهادهای Gain را به شکل سه لایهٔ جدا نگه می‌دارد. این داده برای وب، اندروید یا هر پلیر دیگر قابل استفاده است؛ هیچ صوتی خودکار trim یا normalize نمی‌شود.

```ts
import {
  sources,
  datasetCoverage,
  createGainLookup,
} from '@ghoran/audio-analysis'
```

پوشش واقعی را از `datasetCoverage` بخوانید. دادهٔ ناقص به عنوان کل قرآن معرفی نمی‌شود. مقایسهٔ ثبات بلندی باید پراکندگی بین آیات، تغییرات همسایه‌ها و دینامیک داخل هر آیه را جدا کند؛ مجوّدِ پرنوسان ضرورتاً ضبط نامنظم نیست.

نمونه‌های مصرف، روش اندازه‌گیری، فایل‌های JSONL/gzip، قرارداد ordinal یک‌مبنا و محدودیت‌های LUFS در [README پکیج](https://github.com/sabereen/ghoran/tree/main/packages/audio-analysis) مستند شده‌اند.
