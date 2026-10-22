# Snapshot ناقص تحلیل صوت قرآن

زمان UTC: 2026-10-22T10:40:04.028229+00:00

**9,534 فایل معتبر، 3 فایل نامعتبر و 71,531 مورد بررسی‌نشده از ۸۱٬۰۶۸ مورد انتظار.**

استخراج واقعی است و پوشش کامل هیچ مجموعه‌ای ادعا نمی‌شود. Measured، Inferred و Recommended جدا هستند. هیچ MP3 تغییر نکرده و تمام اصلاح‌های استنباطی تأییدنشده باقی مانده‌اند.

| منبع | معتبر | ناموجود | نامعتبر | موقت/HTTP | بررسی‌نشده |
|---|---:|---:|---:|---:|---:|
| parhizgar | 734 | 0 | 0 | 0 | 5502 |
| ghamadi | 733 | 0 | 1 | 0 | 5502 |
| husary | 734 | 0 | 0 | 0 | 5502 |
| minshawy-murattal | 734 | 0 | 0 | 0 | 5502 |
| minshawy-mujawwad | 734 | 0 | 0 | 0 | 5502 |
| motaz | 734 | 0 | 0 | 0 | 5502 |
| abdulbasit | 734 | 0 | 0 | 0 | 5502 |
| almuiqly | 734 | 0 | 0 | 0 | 5502 |
| jafarpour | 733 | 0 | 0 | 0 | 5503 |
| ansarian | 733 | 0 | 0 | 0 | 5503 |
| maleki | 731 | 0 | 2 | 0 | 5503 |
| makarem-kabiri | 733 | 0 | 0 | 0 | 5503 |
| fooladvand-hedayatfar | 733 | 0 | 0 | 0 | 5503 |

## فایل‌های نامعتبر

- ghamadi، 4:94: partial_decode_error; diagnostic_metrics_not_valid_for_gain
- maleki، 3:91: http_200_empty_file
- maleki، 3:128: partial_decode_error; diagnostic_metrics_not_valid_for_gain

دو فایل خطادارِ Decode، diagnostic-only هستند؛ محاسبات decoded آن‌ها برای بازبینی حفظ شده و از baseline و Gain کنار گذاشته شده‌اند. لاگ اولیه، تغییر وضعیت و audit در SQLite باقی است.

دانلود ثبت‌شده: 3,864,254,800 بایت؛ صوت معتبر یکتای Decodeشده: 81.27 ساعت. ترافیک metadata، نصب ابزارها و سیگنال آزمون در عدد دانلود نیست.

پایلوت نهایی ۳۹۰/۳۹۰ موفق بود. ۱۳ آزمون گذشت و مرجع رسمی EBU مقدار ‎−۲۲٫۹۷۲ LUFS در برابر انتظار ‎−۲۳ داشت؛ گواهی کامل EBU یا بازبینی شنیداری ادعا نمی‌شود.

کنترل نهایی 9,537 رکورد و 38,136 توصیهٔ Gain: بدون خطای semantic یا JSON Schema.

| هدف LUFS | سهم محدودیت peak | میانهٔ اختلاف مطلق جفت‌ها LU |
|---:|---:|---:|
| -23 | 0.01٪ | 1.827 |
| -20 | 2.39٪ | 1.825 |
| -18 | 12.52٪ | 1.784 |
| -16 | 32.13٪ | 2.085 |

هدف پیشنهادی آزمایشی طبق سیاست فعلی: -20 LUFS؛ ‎−۲۳ گزینهٔ محافظه‌کارانه‌تر برای headroom است. تمام نتایج provisional و فاقد داوری شنیداری‌اند.

گزارش کامل فارسی HTML/Markdown، نمودارها، JSONL/CSV، چهار سناریوی Gain و خروجی سبک پلیر، کد دقیق نسخه‌ها، SQLite عملیاتی، backup قابل ادامه و manifest در بستهٔ quran-audio-analysis-partial.zip تحویل شده‌اند. دادهٔ حجیم وارد کد اجرایی اپ نشده است.

SHA-256 بسته: `4a84384f681d448052634856c0433196a0ec9b9562b31091e8145fe9f77f3b39`

پس از نصب requirements.txt در همان پوشهٔ بسته و با همان نسخهٔ FFmpeg، ادامه از checkpoint:

```bash
OPENBLAS_NUM_THREADS=1 python3 scripts/pipeline.py run --phase full --max-seconds 1800
python3 scripts/analyze.py
python3 scripts/verify.py
python3 scripts/package.py
```
