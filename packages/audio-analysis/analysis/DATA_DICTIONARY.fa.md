# فرهنگ دادهٔ صوت قرآن

هر فایل با `(source_id, ordinal)` و شکل انسانی `(source_id, verse_id)` مشخص می‌شود. ترتیب JSONL همواره ترتیب واقعی قرآن است. فایل‌های خارج از محدودهٔ ۶٬۲۳۶ شناسه پیمایش نمی‌شوند.

| فیلد/مسیر | واحد/نوع | تفسیر |
|---|---|---|
| `schema_version` | semver | قرارداد ساختار داده؛ نسخهٔ افزایشی عمده ممکن است breaking باشد |
| `measurement_config_sha256` | SHA-256 | تنظیمات DSP، کد و FFmpeg؛ تنظیمات target در این fingerprint نیست |
| `measured_at` | ISO-8601 UTC | زمان پردازش این نسخه؛ `revalidated_at` زمان بررسی مجدد است |
| `status` | enum | success، missing، invalid، temporary_error یا http_error |
| `http` | object | وضعیت HTTP، validatorها، تلاش‌ها و بایت‌های ثبت‌شده |
| `measured.sha256` | SHA-256 | بایت‌های دقیق فایل دریافت‌شده |
| `measured.decoded_pcm_sha256` | SHA-256 | PCM native-rate float32 با همان نسخهٔ decoder |
| `measured.loudness.integrated_lufs` | LUFS/null | خروجی استاندارد ebur128، native channels، بدون dual-mono compensation |
| `measured.loudness.true_peak_dbtp` | dBTP/null | بیشینهٔ True Peak همهٔ کانال‌ها، دقت ثبت ۰٫۱dB؛ infinity به null تبدیل می‌شود |
| `measured.sample_peak_dbfs` | dBFS/null | بیشینهٔ دامنهٔ نمونهٔ decoded؛ امکان مقدار مثبت در خروجی float MP3 وجود دارد |
| `measured.rms_dbfs` | dBFS/null | RMS روی تمام نمونه‌ها و کانال‌ها؛ میانگین دامنهٔ موج نیست |
| `measured.channel_rms_dbfs` | آرایه dBFS/null | RMS هر کانال؛ کانال خاموش null دارد زیرا log(0) تعریف‌نشده است |
| `measured.duration_s` | ثانیه | تعداد نمونهٔ decoded تقسیم بر sample rate؛ delay/padding مطابق رفتار FFmpeg |
| `measured.container_duration_s` | ثانیه/null | مدت اعلامی demuxer؛ ممکن است با مدت decoded فرق کند |
| `measured.loudness.lra_lu` | LU/null | فقط با شرط مدت/تعداد پنجره؛ صفر واقعی با null فرق دارد |
| `measured.loudness.momentary_above_absolute_gate_lufs` | آماره | پنجره‌های کامل ۴۰۰ms بالاتر از ‎−۷۰؛ n/min/p05/median/p95/max/MAD |
| `measured.loudness.shortterm_above_absolute_gate_lufs` | آماره | همان تعریف، با پنجرهٔ سه‌ثانیه‌ای |
| `measured.activity.active_duration_s` | ثانیه | مجموع بازه‌های تشخیص‌داده‌شده با padding محافظ؛ تخمین فعالیت، نه VAD معنایی |
| `measured.activity.active_rms_dbfs` | dBFS/null | RMS نمونه‌های داخل بازه‌ها، بدون تغییر فایل اصلی |
| `measured.activity.active_momentary_lufs` | آماره LUFS | پنجره‌های M با ≥۷۵٪ overlap فعالیت؛ Integrated روی صوت cut‌شده نیست |
| `measured.activity.active_intervals_s` | آرایه `[start,end]` | بر حسب timeline فایل اصلی؛ بازه‌ها هم‌پوشانی ندارند |
| `measured.activity.leading_low_energy_s` | ثانیه/null | شروع نخستین بازهٔ محافظت‌شده؛ نه تضمین سکوت قابل حذف |
| `measured.activity.trailing_low_energy_s` | ثانیه/null | فاصلهٔ انتهای آخرین بازه تا پایان PCM |
| `measured.activity.whole_file_low_energy_s` | ثانیه/null | فقط وقتی کل فایل زیر آستانهٔ near-silent است؛ وگرنه null یعنی not applicable |
| `measured.activity.noise_floor_proxy_dbfs` | dBFS | میانهٔ ۲۰٪ آرام‌تر فریم‌ها؛ ممکن است واج آرام باشد، تضمین نویز نیست |
| `measured.activity.boundary_confidence` | low/moderate | جدایی توزیع انرژی؛ هیچ مقدار high/certain صادر نمی‌شود |
| `measured.spectral` | Hz و نسبت | Welch روی پرانرژی‌ترین کانال؛ centroid، سهم زیر ۲۰۰Hz و بالای ۴kHz |
| `measured.samples_at_or_above_full_scale` | تعداد | نمونه‌های تمام کانال‌ها با قدرمطلق ≥۱؛ clipping تاریخی را ثابت نمی‌کند |
| `measured.samples_near_full_scale` | تعداد | قدرمطلق ≥۰٫۹۹۹؛ شاخص احتیاطی |
| `measured.media.reported_bitrate_bps` | bit/s/null | bitrate گزارش‌شده؛ VBR می‌تواند تقریبی باشد |
| `measured.media.effective_bitrate_bps` | bit/s | ۸×حجم فایل/مدت decoded؛ شامل سربار metadata است |
| `measured.dualmono_playback_lufs` | LUFS/null | تبدیل قراردادی مونو به پخش دوکاناله با دامنهٔ برابر؛ متر مستقل جدید نیست |
| `measured.quality_flags` | آرایه string | هشدار و محدودیت اندازه‌گیری؛ ضرورتاً خرابی فایل نیست |
| `null_reasons` | map | علت مقدار تعریف‌نشده؛ برای loudness و activity در object خودشان نیز موجود است |
| `profiles.*.baseline_playback_lufs` | LUFS/null | استنباط مقاوم، میانهٔ وزنی با سقف وزن مدت |
| `segments.*.content_set_sha256` | SHA-256 | digest ترتیب شناسه و هش بایت اعضای همان بازه برای اتصال تأیید به نسخهٔ دقیق |
| `anomalies.*.confidence_score` | ۰..۱ | امتیاز heuristic؛ احتمال آماری کالیبره‌شده نیست |
| `anomalies.*.review_priority_score` | ۰..۱۰۰ | اولویت صف بازبینی؛ از شدت و شواهد بحرانی اثر می‌پذیرد و confidence نیست |
| `quality_audit.diagnostic_measurements_only` | boolean | در فایل invalid دارای خطای جزئی Decode، مقادیر decoded فقط برای تشخیص حفظ شده‌اند و برای baseline/Gain معتبر نیستند |
| `recommendations.*.gain_db` | dB/null | Gain مجاز پس از حدود افزایش/کاهش و سقف peak |
| `recommendations.*.gain_linear` | ضریب دامنه/null | `10 ** (gain_db / 20)`؛ ضریب توان نیست |
| `recommendations.*.ceiling_limited` | boolean/null | درخواست Gain به خاطر peak محدود شد |
| `recommendations.*.file_target_shortfall_lu` | LU/null | اختلاف پیش‌بینی هر فایل با هدف baseline؛ به خودی خود خطا نیست |
| `recommendations.*.hierarchical_preview_not_authorized` | object | شبیه‌سازی اصلاح‌های استنباطی پیش از بازبینی؛ توصیهٔ فعال نیست |
| `provisional` | boolean | پوشش موفق کمتر از ۸۰٪؛ داده برای تعمیم کامل کافی نیست |

تمام `null`های آماری همراه با `n=0` یا reason تفسیر می‌شوند. صفر سکوت، صفر clipping و LRA صفر اندازه‌گیری‌شده معتبرند. برای پخش، null Gain به معنای صفر dB تجویزی نیست: پلیر می‌تواند سیاست fallback مستقل داشته باشد، اما نباید مقدار مفقود را نتیجهٔ این ابزار معرفی کند.

SQLite مرجع ادامهٔ عملیات است و JSONL/CSV نمای قابل توزیع‌اند. در صورت هم‌زمانی پردازش، از `package.py` استفاده کنید: از SQLite backup تراکنشی می‌گیرد و تمام نمای آماری را روی همان snapshot دوباره می‌سازد. آرشیو شامل manifest هش همهٔ فایل‌هاست؛ manifest از هش خودش مستثنی است.
