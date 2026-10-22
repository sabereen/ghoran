# دیتاست مستقل تحلیل صوت قرآن

نسخهٔ schema: **1.0.0**؛ نسخهٔ ابزار: **0.1.0**. این ابزار به کد Qmad وابسته نیست؛ به عنوان ابزار مستقل در پکیج @ghoran/audio-analysis نگهداری می‌شود.

**پوشش snapshot را از `reports/progress.json` بخوانید. وجود این ابزار یا گذشتن پایلوت به معنای تکمیل ۸۱٬۰۶۸ فایل نیست.** رکوردهای واقعی در `measurements` و checkpoint قابل ادامه در بستهٔ دانلودی هستند. هیچ فایل اصلی نرمال‌سازی، trim یا دوباره MP3 نشده است.

## اجرای قابل بازتولید

نیازمندی: Linux، Python 3.11+، FFmpeg و ffprobe با فیلتر `ebur128` و True Peak. نسخهٔ مرجع این اجرا FFmpeg 6.1.1 است. کنترل هم‌زمانی `fcntl` مخصوص Linux/macOS است. نسخهٔ Python و تمام خروجی `ffmpeg -version` در `measurement-runs` ثبت می‌شود. نصب Python در venv توصیه می‌شود:

```bash
cd packages/audio-analysis/analysis
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install -r requirements.txt
python3 scripts/pipeline.py init
OPENBLAS_NUM_THREADS=1 python3 -m unittest discover -s tests -v
# اختیاری؛ دریافت سیگنال مرجع رسمی EBU و سنجش آن:
OPENBLAS_NUM_THREADS=1 python3 scripts/calibrate.py
OPENBLAS_NUM_THREADS=1 python3 scripts/pipeline.py run --phase pilot
python3 scripts/verify.py --pilot
OPENBLAS_NUM_THREADS=1 python3 scripts/pipeline.py run --phase full
OPENBLAS_NUM_THREADS=1 python3 scripts/analyze.py
python3 scripts/verify.py
python3 scripts/package.py
```

`init`، snapshot XML رسمی تنزیل و فهرست ناشر AlQuran Cloud را بررسی و ۶٬۲۳۶ شناسهٔ یکتا تولید می‌کند. سوره‌ها از ۱ تا ۱۱۴، آغاز هر سوره و مجموع آیات کنترل می‌شوند؛ شمار آیات تک‌تک سوره‌ها با ناشر جداگانه برابر است. این cross-check استقلال کامل منشأ داده را تضمین نمی‌کند. فایل‌های upstream و SHA-256 آن‌ها نگهداری می‌شوند. شماره‌گذاری حفص/کوفی است؛ `000000` یا بسملهٔ اضافی قبل از سوره‌ها ساخته نمی‌شود.

### اجرای چندپردازه بدون تغییر اندازه‌گیری

برای استفادهٔ بهتر از CPU، `parallel_run.py` همان تابع `measure.measure` را در فرایندهای جدا با روش spawn اجرا می‌کند. فایل‌های `measure.py` و `pipeline.py` و fingerprint علمی آن‌ها تغییر نمی‌کنند؛ نیازی به تکرار فایل‌های موفق نیست. آزمون برابری خروجی سری و چندپردازه، تمام فیلدهای اندازه‌گیری را دقیقاً برابر بررسی می‌کند. SHA کد زمان‌بند، تعداد فرایندها و بازهٔ شناسه‌های event در `execution-runs` نگهداری می‌شود. در این اجرا هشت فرایند DSP به کار رفته است؛ پیش‌فرض ابزار شش است و با `QURAN_DSP_PROCESSES` تغییر می‌کند. سقف اتصال و نرخ شروع هر میزبان همچنان مستقل و محدود است. خرابی خود worker، خرابی MP3 تلقی نمی‌شود.

```bash
OPENBLAS_NUM_THREADS=1 QURAN_DSP_PROCESSES=8 python3 scripts/parallel_run.py run --phase full
```

`duration-review.json` یک کنترل استنباطی مکمل است: مدت همان آیه در همتاهای هم‌نوع، پس از جبران سرعت معمول هر منبع، مقایسه می‌شود. اختلاف بیش از چهار برابر همراه با بیش از چهار مقیاس MAD لگاریتمی فقط کاندیدای بازبینی است؛ قرائت کشیده یا تکراری می‌تواند طبیعی باشد. پارامترها در بخش inference قابل تغییرند و این کنترل هیچ Gain یا ویرایش صوتی اعمال نمی‌کند.

برای اجرای محدود به زمان، بدون از دست رفتن کار:

```bash
OPENBLAS_NUM_THREADS=1 python3 scripts/pipeline.py run --phase full --max-seconds 1800
python3 scripts/pipeline.py export
OPENBLAS_NUM_THREADS=1 python3 scripts/analyze.py
python3 scripts/verify.py
python3 scripts/package.py
```

برای ادامهٔ همین snapshot، بسته را باز کنید و **همان پوشه** را به کار ببرید؛ ساختن خروجی خالی باعث از دست رفتن قابلیت ادامهٔ این snapshot می‌شود. `checkpoints/state.sqlite3` را نگه دارید. در نبود آن، کپی `portable.sqlite3` را به `state.sqlite3` برگردانید. WAL را هنگام انتقال دستی پایگاه فعال حذف نکنید؛ بسته‌ساز از API backup یک snapshot سازگار می‌گیرد.

```bash
# فقط اگر state.sqlite3 وجود ندارد:
cp checkpoints/portable.sqlite3 checkpoints/state.sqlite3
OPENBLAS_NUM_THREADS=1 python3 scripts/pipeline.py run --phase full
```

رکورد موفق با همان fingerprint دوباره دانلود یا تحلیل نمی‌شود. خطای موقت در اجرای بعدی دوباره تلاش می‌شود؛ `missing` فقط برای HTTP 404/410 است. `invalid` یعنی دریافت انجام شده ولی probe/decode/اندازه‌گیری معتبر نبوده است. 403 به معنی ناموجود بودن نیست و در `http_error` می‌ماند. همهٔ رویدادها و نسخه‌های پیشین رکورد در جدول `events` باقی می‌مانند. خطای validation جدید، آخرین اندازه‌گیری موفق را نابود نمی‌کند.

با `--revalidate` درخواست شرطی ETag/Last-Modified انجام می‌شود؛ پاسخ 304 تحلیل را تکرار نمی‌کند. در نبود validator، فایل دریافت و SHA-256 مقایسه می‌شود. تغییر بایت در URL ثابت با `previous_sha256` و `content_changed_at_same_url` ثبت می‌شود. تا زمانی که revalidate اجرا نشود، ابزار ادعای کشف تغییر دوردست ندارد. فایل تغییرنکرده با SHA برابر و پارامتر یکسان دوباره تحلیل نمی‌شود. تغییر نسخهٔ ابزار، کد اندازه‌گیری یا FFmpeg باعث fingerprint جدید و تحلیل مجدد می‌شود. تغییر اهداف Gain یا تنظیمات inference نیازمند دریافت مجدد نیست.

```bash
python3 scripts/pipeline.py run --phase full --sources ansarian --revalidate --max-seconds 1800
```

توقف کنترل‌شده: Ctrl+C در همان ترمینال یا ساخت فایل `checkpoints/STOP`. کارهای در حال اجرا تمام و ذخیره می‌شوند، سپس export انجام می‌شود. پیش از ادامه فایل STOP را حذف کنید. در config این اجرا ۲۴ worker، حداکثر ۸ دریافت هم‌زمان برای هر میزبان و فاصلهٔ شروع حداقل ۵۰ms ثبت شده است؛ اتصال HTTPS بازاستفاده می‌شود. این‌ها پارامتر انتقال‌اند و fingerprint اندازه‌گیری را تغییر نمی‌دهند. برای خطاهای موقت backoff نمایی با jitter، timeout و چهار تلاش داریم. 429 با حداقل ۱۰ ثانیه مکث retry می‌شود. فایل موقت پس از ثبت نتیجه پاک می‌شود؛ نمونه‌های MP3 در خروجی توزیع نمی‌شوند.

## ساختار داده

| مسیر | معنی |
|---|---|
| `sources.json` | ۱۳ شناسهٔ پایدار، نوع اجرا، نام فارسی و URL template؛ هیچ فرضی دربارهٔ کامل بودن ندارد |
| `metadata/verses.json` | ترتیب معتبر؛ `ordinal` از ۱ تا ۶۲۳۶ و `verse_id` به شکل `surah:ayah` |
| `metadata/provenance.json` | ناشر، checksum، attribution و نتیجهٔ cross-check |
| `config.json` | پارامترهای اندازه‌گیری، فعالیت، inference و سیاست Gain در قسمت‌های جدا |
| `measurement-runs/<fingerprint>.json` | پارامترها، SHA کد و نسخهٔ کامل ابزار؛ مستقل از هدف LUFS |
| `measurements/<source>.jsonl` | آخرین وضعیت هر مورد بررسی‌شده، URL، HTTP، هش و اندازه‌گیری |
| `checkpoints/state.sqlite3` | checkpoint عملیاتی تراکنشی و تاریخچهٔ immutable رویدادها |
| `checkpoints/portable.sqlite3` | backup سازگار قابل انتقال؛ در Git ثبت نمی‌شود |
| `profiles.json` | baseline و توزیع‌های مقاوم؛ دادهٔ Inferred |
| `segments/<source>.json` | runهای متوالی مشاهده‌شده و فرضیه‌های شرایط ضبط؛ gapهای ناشناخته به هم وصل نمی‌شوند |
| `anomalies/<source>.jsonl` | شواهد، شدت و وضعیت بازبینی؛ تشخیص، اجازهٔ اصلاح نیست |
| `recommendations/<target>/<source>.jsonl` | Gain درخواستی، محدودیت peak، نتیجه و اصلاح‌های هنوز تأییدنشده |
| `recommendations/<target>/*.compact.json.gz` | آرایهٔ سبک `[ordinal,gainDb,contentSha256]` برای پلیر |
| `reports/report.fa.html` | گزارش فارسی همراه نمودارهای محلی؛ فایل HTML را پس از unzip باز کنید |
| `reports/report.fa.md` | نسخهٔ Markdown گزارش |
| `reports/measurement-summary.csv` | جدول سادهٔ قابل مصرف در ابزارهای داده |
| `reports/pilot-validation.json` | نتیجهٔ پذیرش پایلوت؛ شامل محدودیت نبود آزمون شنیداری |
| `schemas` | قراردادهای JSON Schema و نسخه‌بندی |
| `scripts`, `tests` | کد مستقل و آزمون‌های سیگنال، inference و ادامهٔ اجرا |

هر رکورد JSONL مستقل است؛ برای مقدار نامعتبر `null` ثبت می‌شود. `0` صرفاً برای صفر واقعی مثل زمان سکوت صفر یا تعداد نمونهٔ clipped صفر است. توضیح null در `null_reasons` یا reason شاخص مربوط ثبت می‌شود. نبود کل measured در رکورد خطا، به معنای اندازه‌گیری‌نشدن است. خالی بودن فایل JSONL یعنی آن منبع هنوز رکوردی ندارد.

## تعریف شاخص‌ها و حدود علمی

### Measured

- مسیر `ffprobe → FFmpeg ebur128 + decode float32` بدون تغییر MP3. True Peak با oversampling پیاده‌سازی FFmpeg و خلاصهٔ دقت ۰٫۱ dB ثبت می‌شود؛ sample peak از نمونه‌های PCM float محاسبه می‌شود. RMS، میانگین انرژی تمام نمونه‌ها و کانال‌هاست؛ RMS هر کانال هم جداست. معیار clipping تعداد نمونه‌های ≥۱ و ≥۰٫۹۹۹ است؛ lossy overshoot به‌تنهایی clipping تاریخی را ثابت نمی‌کند.
- LUFS اصلی native با `dualmono=false`، gate مطلق ‎−۷۰ LUFS، gate نسبی ‎−۱۰ LU و بلوک ۴۰۰ms اندازه‌گیری می‌شود. فراداده هر ۱۰۰ms ثبت می‌شود؛ Integrated آخرین بلوک کامل FFmpeg است. این روش ممکن است کمتر از ۱۰۰ms انتهایی را در آمار loudness وارد نکند؛ مدت، RMS و peak کل PCM را پوشش می‌دهند. فایل کمتر از ۴۰۰ms یا بدون بلوک معتبر، LUFS برابر null دارد.
- آمار M از پنجرهٔ کامل ۴۰۰ms و S از پنجرهٔ کامل سه‌ثانیه‌ای و فقط مقادیر بالاتر از gate مطلق ساخته می‌شود؛ مقادیر warm-up شمرده نمی‌شوند. این «توزیع پنجره‌های بالاتر از gate» است، نه میانگین زمانی کل فایل یا شدت آواهای ساکت.
- LRA فقط برای مدت کل ≥۳۰s و حداقل ۱۰۰ پنجرهٔ S معتبر صادر می‌شود. حد ۳۰ ثانیه سیاست پروژه است، نه حداقل اجباری EBU. گفتارهای منفصل حتی با این شرط نیز نیازمند تفسیر محتاطانه‌اند.
- هش فایل از بایت‌های MP3 و هش PCM از خروجی native-rate float32 همان FFmpeg است. تطابق هش PCM تنها با sample rate، تعداد کانال و روش یکسان معنی دارد. تفاوت encoding/نسخهٔ decoder ممکن است هش PCM را عوض کند.

### تخمین فعالیت و سکوت کم‌انرژی

این اندازه‌گیری مبتنی بر انرژی، **تخمین** است و VAD معنایی یا تأیید سکوت شنیداری نیست. هیچ مرزی مجوز trim خودکار نیست.

در فریم ۲۰ms از بیشترین انرژی کانال‌ها استفاده می‌شود تا کانال‌های ضد‌فاز صوت را حذف نکنند. median سه‌فریمی، برآورد نیمهٔ آرام توزیع و دامنهٔ p80−p20 در برابر نویز به کار می‌رود. آستانهٔ روشن‌شدن از کمینهٔ `noiseProxy+10dB` و `p95−30dB` با کف ‎−۷۵dBFS تعیین می‌شود. آستانهٔ خاموش‌شدن ۶dB پایین‌تر است؛ بخش‌های متصل به عبور از آستانهٔ بالا تا آستانهٔ پایین حفظ می‌شوند. شکاف زیر ۱۸۰ms وصل و در دو طرف ۱۲۰ms حاشیهٔ محافظ افزوده می‌شود. جدایی انرژی زیر ۸dB موجب confidence پایین است.

`active_duration_s` مجموع بازه‌هاست، نه فاصلهٔ نخستین تا آخرین صدا. RMS بخش فعال و توزیع M با دست‌کم ۷۵٪ هم‌پوشانی با فعالیت گزارش می‌شوند. این شاخص M، Integrated LUFS یک فایل cut‌شده نیست. نفس، حرف آرام و طنین ممکن است با نویز هم‌پوشانی داشته باشند؛ گوش دادن قبل از تصمیم دربارهٔ فاصلهٔ پخش لازم است.

### Inferred

Baseline، میانهٔ وزنی بر حسب مدت فعالیت با سقف وزن ۲۰ ثانیه است؛ آیات فعال زیر یک ثانیه کنار گذاشته می‌شوند. median، MAD، صدک‌ها و گروه‌های مدت بررسی می‌شوند. برای تشخیص محلی، اثر گروه‌های مدت فقط با حداقل ۲۰ نمونه تخمین زده می‌شود. پنجرهٔ ۱۵ همسایه در هر طرف، MAD با کف ۱ LU و حداقل هشت همسایه لازم است. معیار robust-z برای ترجمه ۳٫۵، ترتیل ۴٫۵ و مجوّد ۶ است؛ انحراف حداقل ۴ LU نیز لازم است.

Change point به دو پنجرهٔ متوالی ۲۰ آیه‌ای با دست‌کم ۸۰٪ نمونهٔ معتبر، جهش پایدار حداقل ۳ LU و اثر مقاوم حداقل ۲ نیاز دارد؛ برای مجوّد آستانهٔ تغییر ۱٫۵ برابر است. میانه‌های نیم‌پنجره‌ها پایداری را کنترل می‌کنند. شواهد نویز، centroid طیف و قالب کانال/rate confidence را تقویت می‌کنند؛ مرز سوره/جزء شرط قطعی نیست. confidenceها heuristic‌اند و احتمال کالیبره‌شده یا تاریخچهٔ واقعی جلسهٔ ضبط نیستند. یک آیهٔ بلند منفرد نباید session تلقی شود؛ آزمون مصنوعی این تفاوت را کنترل می‌کند.

مدت بسیار غیرعادی با حد مطلق زیر ۰٫۲۵s یا بیش از ۶۰۰s پرچم می‌گیرد. فعلاً تعداد کلمات متن وارد مدل مدت نشده است؛ بنابراین زمان طولانی آیهٔ بلند به خودی خود خطا نیست. تشخیص تکراری‌ها معنای تلاوت را بررسی نمی‌کند؛ بسمله و ترجیع طبیعی ممکن است عمداً تکراری باشند.

### Recommended

در قرارداد پخش فرضی، mono به دو کانال با همان دامنه کپی می‌شود؛ از این رو `dualmono_playback_lufs = native + 3.0103` برای مونو و native برای استریو است. اگر پلیر از pan-law دیگری استفاده کند، baseline و توصیه‌ها باید متناسب بازتولید شوند. این تبدیل، تغییر فایل یا تخمین جلسهٔ ضبط نیست؛ قرارداد کانال پلیر است.

`baseGain = target − sourceBaseline`. مدل کامل می‌تواند اصلاح بخش با شدت ۰٫۵ و سقف ±۲dB و اصلاح outlier با شدت ۰٫۲۵ و سقف ±۱dB را اضافه کند. پیش‌فرض هر دو صفرِ اعمال‌شده‌اند؛ مقدار candidate و preview جداست. فقط پس از بازبینی، شیء تأیید را به `approvals.json` اضافه و `analyze.py` را اجرا کنید. تأیید بخش شامل `source_id`, `segment_id`, `content_set_sha256` و تأیید فایل شامل `source_id`, `verse_id`, `content_sha256` است. شناسهٔ بخش از ابتدا و انتهای بازه ساخته می‌شود؛ تغییر بازه یا بایت‌های هر عضو، تأیید قبلی را نامعتبر می‌کند. رشتهٔ تنها یا هش نامنطبق، هیچ اصلاحی را فعال نمی‌کند.

```json
{
  "segments": [{"source_id": "ansarian", "segment_id": "segment-0001-0100", "content_set_sha256": "COPY_EXACT_REVIEWED_SET_HASH"}],
  "files": [{"source_id": "ansarian", "verse_id": "1:1", "content_sha256": "COPY_EXACT_REVIEWED_FILE_HASH"}]
}
```

این مثال فقط شکل داده است؛ هیچ موردی در فایل تأییدهای تحویلی فعال نشده است.

```text
linearGain = 10 ** (gainDb / 20)
upperGain = min(maxBoost, peakCeiling − measuredTruePeak − 0.15)
gainDb = clamp(requestedGain, −maxCut, upperGain)
```

اگر بازهٔ مجاز خالی باشد یا اندازه‌گیری loudness/peak معتبر نباشد، Gain برابر null است. هیچ compression یا limiting به جای Gain وارد نمی‌شود. هدف ‎−۲۳، ‎−۲۰، ‎−۱۸ یا ‎−۱۶ تنها در recommendations تعریف می‌شود و دادهٔ خام مستقل است. constant gain دینامیک درون فایل را حفظ می‌کند؛ محدودکردن جداگانهٔ فایل‌های پرpeak می‌تواند اختلاف بین فایل‌ها را تغییر دهد، پس `ceiling_limited` باید در طراحی پلیر و گزارش دیده شود.

## وضعیت کیفیت و ادامهٔ پروژه

۱۳ آزمون این اجرا شامل سینوس کالیبره، RMS، ۳dB مونو/استریو، intersample peak، فایل کوتاه، سکوت، صوت ضد‌فاز، تغییر منفرد در برابر پایدار، عدم پرش از gap، اتصال تأیید به هش دقیق محتوا، resume، پاسخ 304، تغییر بایت در URL ثابت و قرنطینهٔ idempotent خطای Decode با حفظ تاریخچه است. سیگنال مرجع تک‌کانالهٔ رسمی EBU نیز واقعاً دریافت و سنجیده شد: ‎−۲۲٫۹۷۲ LUFS در برابر انتظار ‎−۲۳ (داخل تلورانس ±۰٫۲). نتیجه، هش سیگنال و مشخصات اندازه‌گیری در `reports/calibration-reference.json` است. آزمون رسمی کامل مجموعهٔ ۷۰ سیگنال EBU و بازبینی شنیداری همهٔ پرچم‌ها انجام نشده است.

`analyze.py` پیش از محاسبهٔ baseline، از `quality_audit.py` برای بازبینی خطاهای واقعی Decode استفاده می‌کند. ممکن است FFmpeg با وجود خطای چند فریم return code صفر بدهد؛ چنین فایلی از success به invalid منتقل می‌شود، با حفظ لاگ، رویداد اولیه و اندازه‌گیری صرفاً تشخیصی. فایل دارای `quality_audit.diagnostic_measurements_only=true` نباید وارد baseline یا Gain شود. هشدار comment/lyrics در ID3، به‌تنهایی خطای Decode صوت تلقی نمی‌شود. این بازبینی از لاگ ذخیره‌شده استفاده می‌کند و به دانلود یا Decode دوباره نیاز ندارد. `verify.py` اجازهٔ موفق معرفی کردن فایل دارای شواهد خطای Decode را نمی‌دهد.

در snapshot فعلی، انتخاب هدفِ آزمایشی علاوه بر حدود Gain بر اساس دو پارامتر `target_selection_maximum_peak_limited_fraction` و `target_selection_maximum_extra_pair_mismatch_lu` انجام می‌شود: بلندترین هدف آزموده‌شده با محدودیت peak زیر ۵٪ و اختلاف جفت‌ها حداکثر ۰٫۲۵ LU بیشتر از بهترین سناریو. این سیاست پیش‌فرض است، برتری ادراکی یا هدف مناسب همهٔ پلیرها را ثابت نمی‌کند.

آزمون HEAD سه URL نمونه با Origin برابر `https://example.org`، پاسخ ۲۰۰، `Access-Control-Allow-Origin: *` و پشتیبانی byte ranges نشان داد؛ snapshot در `metadata/transport-audit.json` است. این آزمون فقط برای همان سه URL و روش HEAD است؛ رفتار GET، CORS تمام مجموعه‌ها و مسیر گراف صوت باید در پلیر واقعی بررسی شود.

گزارش فارسی، ماتریس ۹×۴ آیات مشترک و سیاست‌های Gain از دادهٔ تکمیل‌شده تولید می‌شوند؛ همهٔ آمارهای با پوشش زیر ۸۰٪ با `provisional=true` همراه‌اند. هیچ خروجی با فرض پوشش کامل پر نمی‌شود. برای تمام بودن واقعی، `success + missing + invalid + temporary_error + http_error + unprocessed = 6236` باید در تک‌تک منابع برقرار باشد؛ صفر شدن unprocessed فقط پایان بررسی فهرست است و خطاهای موقت هنوز باید retry شوند.

حقوق صوت متعلق به صاحبان منابع است و در این مأموریت بررسی نشده؛ بسته فقط متادیتا و کد را توزیع می‌کند. ساختار قرآن از Tanzil با attribution فوق است. برای تغییر ابزار، پیشنهاد commit: `feat(audio): add resumable Quran loudness analysis pipeline`.
