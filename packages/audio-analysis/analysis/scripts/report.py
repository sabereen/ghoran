"""Portable Persian report and numerical charts; no network required."""
import csv
import html
import re
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from pipeline import atomic_json


def fmt(x, digits=2):
    return "—" if x is None else f"{x:.{digits}f}"


def build_report(root, sources, records, profiles, anomalies, policies, pairs):
    folder = root / "reports"; folder.mkdir(exist_ok=True)
    progress = json.loads((folder / "progress.json").read_text())
    processing = json.loads((folder / "processing-statistics.json").read_text())
    coverage = progress["coverage"]
    # Charts have English identifiers to keep axis labels portable across fonts.
    fig, axes = plt.subplots(2, 2, figsize=(15, 10), constrained_layout=True)
    fields = [("native LUFS", lambda m: m["loudness"]["integrated_lufs"]),
              ("True peak (dBTP)", lambda m: m["loudness"]["true_peak_dbtp"]),
              ("Leading low energy (s)", lambda m: m["activity"]["leading_low_energy_s"]),
              ("Trailing low energy (s)", lambda m: m["activity"]["trailing_low_energy_s"])]
    for ax, (name, extract) in zip(axes.flat, fields):
        vals = [[extract(r["measured"]) for r in records[s["id"]]] for s in sources]
        vals = [[v for v in group if v is not None] for group in vals]
        ax.boxplot([v if v else [float("nan")] for v in vals], tick_labels=[s["id"] for s in sources], showfliers=True, flierprops={"markersize": 2}, vert=False)
        ax.set_title(name); ax.grid(axis="x", alpha=.2)
    fig.suptitle("Observed files only — incomplete inventory" if not progress["complete_inventory"] else "Observed audio measurements")
    fig.savefig(folder / "distributions.png", dpi=150); plt.close(fig)
    fig, axes = plt.subplots(1, 2, figsize=(14, 5), constrained_layout=True)
    for source in sources:
        sid = source["id"]; rs = records[sid]
        native = [r["measured"]["loudness"]["integrated_lufs"] for r in rs if r["measured"]["loudness"]["integrated_lufs"] is not None]
        if native:
            axes[0].hist(native, bins=np.arange(-55, 1, 1), histtype="step", label=sid)
        x = [r["ordinal"] for r in rs if r["measured"]["dualmono_playback_lufs"] is not None]
        y = [r["measured"]["dualmono_playback_lufs"] for r in rs if r["measured"]["dualmono_playback_lufs"] is not None]
        axes[1].scatter(x, y, s=4, alpha=.5, label=sid)
    axes[0].set(xlabel="Native LUFS", ylabel="File count", title="Full observed distribution")
    axes[1].set(xlabel="Canonical verse ordinal", ylabel="Playback-convention LUFS", title="Observed coverage / level continuity")
    axes[0].legend(fontsize=7); axes[1].grid(alpha=.2)
    fig.savefig(folder / "histogram-continuity.png", dpi=150); plt.close(fig)
    reciters = [s for s in sources if s["kind"] != "translation"]
    translators = [s for s in sources if s["kind"] == "translation"]
    matrix = np.array([[next(p["median_translator_minus_reciter_lu"] for p in pairs if p["reciter"] == r["id"] and p["translator"] == t["id"]) for t in translators] for r in reciters], dtype=float)
    fig, ax = plt.subplots(figsize=(10, 7), constrained_layout=True)
    im = ax.imshow(matrix, cmap="coolwarm", vmin=-15, vmax=15)
    ax.set_xticks(range(4), [s["id"] for s in translators], rotation=15)
    ax.set_yticks(range(9), [s["id"] for s in reciters])
    for y in range(9):
        for x in range(4):
            if np.isfinite(matrix[y, x]):
                ax.text(x, y, f"{matrix[y,x]:+.1f}", ha="center", va="center")
    fig.colorbar(im, ax=ax, label="Median translator minus reciter (LU), matched verses")
    ax.set_title("Observed pairs; mono duplicated playback convention" + ("; provisional" if not progress['complete_inventory'] else ""))
    fig.savefig(folder / "pairing-matrix.png", dpi=150); plt.close(fig)
    with (folder / "coverage.csv").open("w") as f:
        writer = csv.DictWriter(f, fieldnames=list(coverage[0])); writer.writeheader(); writer.writerows(coverage)
    with (folder / "measurement-summary.csv").open("w") as f:
        fields_csv = ["source_id", "ordinal", "verse_id", "status", "duration_s", "integrated_lufs", "playback_lufs", "true_peak_dbtp", "rms_dbfs", "active_duration_s", "leading_low_energy_s", "trailing_low_energy_s", "sha256"]
        writer = csv.DictWriter(f, fieldnames=fields_csv); writer.writeheader()
        for source in sources:
            for r in records[source["id"]]:
                m = r["measured"]; a = m["activity"]
                writer.writerow({"source_id": source["id"], "ordinal": r["ordinal"], "verse_id": r["verse_id"], "status": r["status"],
                                 "duration_s": m["duration_s"], "integrated_lufs": m["loudness"]["integrated_lufs"],
                                 "playback_lufs": m["dualmono_playback_lufs"], "true_peak_dbtp": m["loudness"]["true_peak_dbtp"],
                                 "rms_dbfs": m["rms_dbfs"], "active_duration_s": a["active_duration_s"],
                                 "leading_low_energy_s": a["leading_low_energy_s"], "trailing_low_energy_s": a["trailing_low_energy_s"], "sha256": m["sha256"]})
    successful = sum(c["success"] for c in coverage)
    unprocessed = sum(c["unprocessed"] for c in coverage)
    lines = ["# گزارش استخراج و تحلیل صوت قرآن", "", f"زمان snapshot به UTC: {progress['updated_at']}", "",
             f"**وضعیت: {'فهرست همهٔ منابع بررسی شده است' if progress['complete_inventory'] else 'ناقص و قابل ادامه'}. {successful:,} فایل با موفقیت اندازه‌گیری شده و {unprocessed:,} مورد هنوز بررسی نشده است.**",
             "", "نبودن رکورد به معنای ناموجودبودن فایل نیست. 404/410 از خطای شبکه و خطای Decode جدا است. " + ("همهٔ شناسه‌های مورد انتظار بررسی شده‌اند؛ معتبر بودن انتساب و محتوای خوانده‌شده نیازمند بازبینی مستقل است." if progress['complete_inventory'] else "نتایج فعلی برای تعمیم قطعی به تمام قرآن کافی نیستند."), "",
             "## تفکیک اعتبار نتایج", "",
             "- Measured: خروجی واقعی FFmpeg از بایت‌های دریافت‌شده؛ شامل هش، شرایط اندازه‌گیری و محدودیت دقت. این امر صحت محتوای تلاوت یا انتساب قاری را ثابت نمی‌کند.",
             "- Inferred: baseline، تخمین فعالیت صوت، فرضیهٔ تغییر ضبط و ناهنجاری‌ها. انرژی پایین لزوماً سکوت شنیداری نیست و امتیاز اطمینان، احتمال کالیبره‌شده نیست.",
             "- Recommended: سناریوی Gain وابسته به سیاست؛ اصلاح‌های استنباطی تا ثبت تأیید انسانی اعمال نمی‌شوند. هیچ MP3 تغییر نکرده است.", "",
             "## پوشش واقعی", "", "| منبع | موفق | ناموجود | نامعتبر | موقت | HTTP دیگر | بررسی‌نشده |", "|---|---:|---:|---:|---:|---:|---:|"]
    for c in coverage:
        lines.append(f"| {c['source_id']} | {c['success']} | {c['missing']} | {c['invalid']} | {c['temporary_error']} | {c['http_error']} | {c['unprocessed']} |")
    quality_summary=json.loads((folder/'quality-summary.json').read_text())
    lines += ['', '## نوع واقعی دادهٔ صوتی', '',
              'پسوند URL مبنای تشخیص Codec نبوده است. فایل غیر MP3 که با پسوند mp3 ارائه شده باشد، در صورت Decode معتبر در اندازه‌گیری‌ها باقی می‌ماند و برای سازگاری Container/MIME پلیر پرچم می‌گیرد؛ هیچ تبدیل فرمت انجام نشده است.', '',
              '| منبع | تعداد به تفکیک Codec واقعی | ناسازگار با پسوند MP3 |', '|---|---|---:|']
    for entry in quality_summary['sources']:
        lines.append(f"| {entry['source_id']} | {', '.join(codec+': '+str(n) for codec,n in entry['codec_counts'].items())} | {entry['codec_extension_mismatch']} |")
    lines += ["", "## توزیع‌ها و مقایسهٔ سطح بلندی", "", "![توزیع اندازه‌گیری‌ها](distributions.png)", "", "![توزیع و پیوستگی](histogram-continuity.png)", "",
              "برای مقایسهٔ منصفانهٔ منابع، نمودارهای زیر فقط آیات مشترکِ معتبر هر ۱۳ منبع با مدت حداقل سه ثانیه و فعالیت حداقل یک ثانیه را نشان می‌دهند. اعداد هر نمودار تعداد واقعی cohort را مشخص می‌کند. این نمودارها از پهنای کلی توزیع، جهش همسایه‌ها و سطح معمول صدا تفکیک می‌سازند.", '',
              '![سطح و پراکندگی مشترک](distributions/level-and-spread.png)', '',
              '![شکل توزیع قاریان](distributions/recitation-histograms.png)', '',
              '![شکل توزیع ترجمه‌ها](distributions/translation-histograms.png)', '',
              '![پیوستگی آیات مجاور](distributions/neighbor-continuity.png)', '',
              "هر آیه یک مشاهده است. baseline، میانهٔ وزنی با وزن مدت فعالیتِ محدودشده به ۲۰ ثانیه است؛ LUFS آلبوم یا اندازه‌گیری یک اجرای پیوسته محسوب نمی‌شود. فایل‌های کوتاه و دارای فعالیت زیر یک ثانیه از baseline کنار گذاشته می‌شوند.", "",
              "LUFS اصلی با کانال‌های واقعی فایل و dualmono=false ثبت شده است. برای مقایسهٔ پخش متعارف، به فایل مونو ۳٫۰۱۰۳ LU افزوده می‌شود؛ این فقط برای پخشی معتبر است که مونو را با همان دامنه به هر دو کانال کپی کند. در صورت pan-law متفاوت باید این فرض تغییر کند.", "",
              "| منبع | میانه LUFS اصلی | baseline پخش | MAD پخش | p95 True Peak |", "|---|---:|---:|---:|---:|"]
    for source in sources:
        p = profiles[source["id"]]
        lines.append(f"| {source['id']} | {fmt(p['native_integrated_lufs']['median'])} | {fmt(p['baseline_playback_lufs'])} | {fmt(p['dualmono_playback_lufs']['mad'])} | {fmt(p['true_peak_dbtp']['p95'])} |")
    lines += ["", "## فرضیه‌های تغییر شرایط ضبط", "",
              "آزمون پنجره‌های دوطرفهٔ ۲۰ آیه‌ای، بررسی پایداری در نیم‌پنجره‌ها، حذف قله‌های نزدیک و شواهد طیف/نویز به کار رفته است. تحلیل از روی شکاف‌های بررسی‌نشده نمی‌پرد. مرز سوره و جزء فقط شاهد کمکی است. حذف یک پنجره به علت کمبود داده به معنای نبود تغییر نیست.", ""]
    lines += ['هماهنگی proxy نویز با LUFS شاهد مستقلی نیست، چون هر دو از همان دامنهٔ صوت مشتق می‌شوند؛ centroid طیفی نیز به واج‌های خوانده‌شده حساس است. حتی چند شاهد هم‌سو، جلسهٔ تاریخی ضبط یا خطای میکس را ثابت نمی‌کند.', '',
              'حساسیت تغییر پایدار نیز قابل تنظیم است: ضریب حداقل جهش برای ترتیل ۱، مجوّد ۱٫۵ و ترجمه ۰٫۸۵ است؛ نسبت به حد پایهٔ ۳ LU. مجوّد محافظه‌کارانه‌تر و ترجمه حساس‌تر بررسی می‌شود.', '',
              '![روند در ترتیب قرآن](distributions/quran-order-traces.png)', '']
    n_changes = 0
    for source in sources:
        data = json.loads((root / "segments" / (source["id"] + ".json")).read_text())
        for cp in data["change_points"]:
            n_changes += 1
            lines.append(f"- {source['id']}، حوالی {cp['at_verse_id']}: تغییر {cp['delta_lu']:+.2f} LU، امتیاز اطمینان {cp['confidence_score']:.2f}؛ نیازمند بازبینی.")
    if n_changes == 0:
        lines.append("با داده‌های فعلی نقطهٔ تغییر پایداری که معیارهای محافظه‌کارانه را بگذراند اثبات آماری نشده است؛ پوشش ناقص و تعداد همسایه‌های متوالی این نتیجه را محدود می‌کند.")
    failures = [json.loads(line) for line in (folder / "failures.jsonl").read_text().splitlines() if line]
    if failures:
        lines += ["", "## فایل‌های دریافت‌نشده یا نامعتبر", "", "| منبع | آیه | وضعیت | تشخیص |", "|---|---|---|---|"]
        for r in failures[:30]:
            lines.append(f"| {r['source_id']} | {r['verse_id']} | {r['status']} | {r['failure_classification']} |")
        lines += ["", "جزئیات HTTP و خطا در failures.jsonl آمده است. پاسخ ۲۰۰ با بایت صفر، فایل خالی است؛ 404 یا خطای موقت تلقی نمی‌شود."]
    lines += ["", "## مهم‌ترین موارد بازبینی", "", "موارد زیر تشخیص خطای قطعی یا اجازهٔ اصلاح نیستند. پرچم metadata خراب MP3 ممکن است صرفاً مربوط به comment frame باشد و خرابی صوت را ثابت نمی‌کند.", "",
              "| منبع | آیه | نوع | شدت | اطمینان |", "|---|---|---|---|---:|"]
    top = [(sid, a) for sid, group in anomalies.items() for a in group]
    top.sort(key=lambda z: ({"high": 0, "medium": 1, "low": 2}[z[1]["severity"]], -z[1].get("review_priority_score", 50), -z[1]["confidence_score"]))
    for sid, a in top[:40]:
        lines.append(f"| {sid} | {a.get('verse_id', 'گروه تکراری')} | {a['type']} | {a['severity']} | {a['confidence_score']:.2f} |")
    duration_review=json.loads((folder/'duration-review.json').read_text())
    lines += ['', '## بازبینی مستقل مدت فایل', '',
              'مدت هر آیه با میانهٔ همان آیه در منابع هم‌نوع مقایسه و سرعت معمول هر منبع جبران شده است. کاندیدا باید هم بیش از چهار برابر کوتاه‌تر/بلندتر از انتظار و هم فراتر از چهار مقیاس MAD لگاریتمی باشد. حداقل پنج قاری همتا یا دو مترجم همتا لازم است. تکرار و بیان طبیعی مجوّد می‌تواند چنین اختلافی بسازد؛ این آزمون صحت متن آیه را ثابت نمی‌کند و هیچ اصلاحی از آن اعمال نمی‌شود.', '',
              f"تعداد کاندیداهای بازبینی مدت: {duration_review['candidate_count']}. جزئیات در duration-review.json و anomalies/cross-source-duration.jsonl است.", '',
              '| منبع | آیه | مدت ثانیه | نسبت به انتظار |', '|---|---|---:|---:|']
    for r in duration_review['candidates'][:20]:
        lines.append(f"| {r['source_id']} | {r['verse_id']} | {r['evidence']['duration_s']:.2f} | {r['evidence']['duration_ratio_to_expected']:.2f} |")
    lines += ["", f"تعداد کل پرچم‌های استنباطی: {len(top):,}. یک فایل ممکن است چند پرچم داشته باشد. جزئیات شواهد در anomalies و تکرارهای بین منابع در cross-source-duplicates.json است.", "",
              "## ماتریس ۹ قاری × ۴ مترجم", "", "![سازگاری بلندی منابع](pairing-matrix.png)", "",
              "عدد مثبت یعنی مترجم در آیات مشترک بلندتر است. این مقایسهٔ جفت‌شدهٔ آیه‌ای است؛ تغییرات طبیعی اجرای آیه را حذف نمی‌کند. تعداد آیات مشترک، توزیع اختلاف و سهم اختلاف بیش از ۶ LU در pairing-matrix.json آمده است.", "",
              "## سیاست‌های Gain", "",
              "فرمول ضریب دامنه: `gainLinear = 10 ** (gainDb / 20)`. هیچ فشرده‌سازی، limiter یا بازکدگذاری انجام نشده است.", "",
              "چهار هدف ‎−۲۳، ‎−۲۰، ‎−۱۸ و ‎−۱۶ LUFS در قرارداد پخش مقایسه شده‌اند. ‎−۲۳ مبنای محافظه‌کارانهٔ مناسب برای حفظ headroom است؛ ‎−۲۰ گزینهٔ میانی برای ارزیابی شنیداری و ‎−۱۸/−۱۶ گزینه‌های بلندتر با احتمال محدودشدن بیشتر توسط peak هستند. ‎−۲۳ مرجع پخش EBU است؛ سایر اعداد سیاست این پروژه‌اند و استاندارد اجباری برای اپ نیستند.", "",
              "پیشنهاد اولیه تا تکمیل پوشش و آزمون شنیداری: سیاست پایهٔ منبع با هدف ‎−۲۳ برای حفظ headroom؛ هدف ‎−۲۰ را نیز به عنوان گزینهٔ آزمایشی مقایسه کنید. هیچ هدف نهایی یا اصلاح آیه‌ای به‌صورت قطعی توصیه نمی‌شود.", "",
              "| منبع | هدف | Gain پایه درخواستی dB | محدودشده به peak | محدودشده به سقف Gain | میانه پخش پیش‌بینی‌شده |", "|---|---:|---:|---:|---:|---:|"]
    for p in policies:
        lines.append(f"| {p['source_id']} | {p['target_lufs']} | {fmt(p['baseline_gain_requested_db'])} | {p['n_peak_limited']}/{p['n']} | {p['n_gain_limited']} | {fmt(p['predicted_playback_lufs']['median'])} |")
    policy_pairs = json.loads((folder / "pairing-policy-comparison.json").read_text())
    lines += ["", "ارزیابی اثر سیاست روی جفت قاری/مترجم (میانهٔ اختلاف مطلق آیه‌ای، سپس میانه روی ۳۶ جفت):", "",
              "| هدف LUFS | سهم محدودیت peak | سهم محدودیت Gain | اختلاف مطلق میانهٔ جفت‌ها LU |", "|---:|---:|---:|---:|"]
    for a in policy_pairs["aggregate"]:
        lines.append(f"| {a['target_lufs']} | {fmt(100*a['peak_limited_fraction'] if a['peak_limited_fraction'] is not None else None)}٪ | {fmt(100*a['gain_limited_fraction'] if a['gain_limited_fraction'] is not None else None)}٪ | {fmt(a['median_pairwise_absolute_mismatch_lu'])} |")
    selection = policy_pairs["target_selection"]
    lines += ["", f"پیشنهاد محاسباتی موقت برای آزمون شنیداری: {fmt(selection['suggested_trial_target_lufs'],0)} LUFS؛ بلندترین سطح آزموده‌شده که سهم peak-limited آن از {100*selection['maximum_peak_limited_fraction']:.0f}٪ بیشتر نیست و اختلاف میانهٔ جفت‌ها حداکثر {selection['maximum_extra_pair_mismatch_lu']:.2f} LU از بهترین سناریو فاصله دارد. این معیار سیاست قابل تغییر است و برتری ادراکی را اثبات نمی‌کند؛ برای بیشترین headroom، ‎−۲۳ همچنان گزینهٔ محافظه‌کارانه است."]
    raw_mismatch = np.median([p["median_absolute_mismatch_lu"] for p in pairs if p["median_absolute_mismatch_lu"] is not None]) if any(p["median_absolute_mismatch_lu"] is not None for p in pairs) else None
    lines += ["", f"اختلاف متناظر پیش از Gain: {fmt(raw_mismatch)} LU. گروه آیات مشترکِ پس از سیاست ممکن است به علت Gain برابر null اندکی متفاوت باشد؛ نتایج شبیه‌سازی‌اند و جای آزمون شنیداری را نمی‌گیرند."]
    lines += ["", "Gain پایه برای هر منبع ثابت است و فراز و فرود آن را حفظ می‌کند. سقف True Peak برابر ‎−۱ dBTP با حاشیهٔ اضافی ۰٫۱۵ dB برای دقت اندازه‌گیری است. افزایش حداکثر ۸ و کاهش حداکثر ۱۸ dB است؛ این حدود در config تغییرپذیرند. اگر محدودیت کاهش نیز مانع رعایت سقف شود Gain برابر null خواهد بود.", "",
              "مدل سه‌سطحی: Gain پایه + اصلاح بخش با شدت ۰٫۵ و سقف ۲ dB + اصلاح ناهنجاری محلی با شدت ۰٫۲۵ و سقف ۱ dB. دو اصلاح آخر فقط پیشنهاد بازبینی هستند و پیش‌فرض اعمال نمی‌شوند؛ فایل approvals.json تصمیم انسانی را ثبت می‌کند. آمار preview سیاست سلسله‌مراتبی جدا از نتیجهٔ مجاز نگهداری می‌شود.", "",
              "اختلاف هر آیه با هدف، الزاماً خطا نیست: هدف برای baseline مجموعه است. محدودیت True Peak، سقف افزایش و تنوع طبیعی اجرا می‌توانند از رسیدن برخی فایل‌ها به آن جلوگیری کنند. policy-comparison.json نتایج همهٔ سناریوها را ثبت می‌کند.", "",
              "## مصرف در Web Audio و Media3", "",
              "در وب، هر فایل از MediaElementAudioSourceNode به GainNode و سپس خروجی متصل شود. مقدار Gain از هش همان نسخهٔ فایل انتخاب و با رمپ کوتاه پیش از آغاز صوت تنظیم شود. تنظیم Gain در زمان سکوت بهتر از جهش وسط حرف است. حجم‌های معمولی HTMLMediaElement بالاتر از یک را پشتیبانی نمی‌کنند؛ برای boost از GainNode استفاده کنید. CORS میزبان باید اجازهٔ خواندن صوت در Web Audio را بدهد؛ در غیر این صورت مسیر گراف ممکن است بی‌صدا شود. ترکیب چند صدای هم‌زمان به headroom جداگانه نیاز دارد و تضمین peak تک‌فایلی برای crossfade جمع‌شده کافی نیست.", "",
              "در Android، Player.setVolume فقط برای attenuation در محدودهٔ صفر تا یک مناسب است. برای Gain مثبت، AudioProcessor در مسیر PCM یا GainProcessor متناسب با نسخهٔ Media3 به کار رود؛ bypass شدن پردازش در offload/passthrough باید بررسی شود. پردازش دامنهٔ نمونه‌ها با فرمت PCM و تبدیل عددی درست و بدون limiter پنهان انجام شود. تنظیمات صدا و حجم کاربر مستقل باقی بماند. این خروجی در اپ ادغام یا روی دستگاه شنیداری آزمایش نشده است.", "",
              "## آمار اجرا و محدودیت‌ها", "",
              f"- رویدادهای ثبت‌شدهٔ پردازش: {processing['events']:,}؛ این تعداد شامل تلاش‌های تکراری/نسخه‌های روش هم می‌شود.",
              f"- بایت‌های دانلود ثبت‌شده در تحلیل: {processing['downloaded_bytes_all_attempts']:,} ({processing['downloaded_bytes_all_attempts']/1024**2:.1f} MiB). ترافیک آزمایش‌های اتصال و metadata در این عدد نیست.",
              '- این حجم، بایت‌های بدنهٔ پاسخِ ثبت‌شده است؛ انتقال نیمه‌کاره‌ای که پیش از بازگشت payload شکست خورده باشد ممکن است شمرده نشود. سربار شبکه نیز داخل آن نیست؛ حجم موفقِ فایل‌های یکتا جدا ثبت شده است.',
              f"- مجموع مدت صوت معتبر: {processing['unique_decoded_audio_duration_s']/3600:.2f} ساعت؛ حجم فایل‌های موفق یکتا: {processing['unique_successful_file_bytes']/1024**3:.3f} GiB.",
              f"- فاصلهٔ اولین تا آخرین event: {fmt(processing['event_span_elapsed_s']/3600 if processing['event_span_elapsed_s'] is not None else None)} ساعت، شامل توقف‌ها. مجموع زمان دیواری کارهای فایل‌ها: {processing['sum_file_processing_wall_s']/3600:.2f} ساعت؛ به دلیل هم‌زمانی برابر زمان نشست یا زمان CPU نیست.",
              ('- همهٔ ۸۱٬۰۶۸ شناسهٔ مورد انتظار بررسی شده‌اند. موفق، ناموجود، نامعتبر و خطاهای حل‌نشده در جدول پوشش جدا هستند؛ هیچ مجموعه‌ای از پیش کامل فرض نشده است.' if progress['complete_inventory'] else '- پوشش هنوز ناقص است. checkpoint واقعی و کد ادامه همراه خروجی است؛ کامل بودن هیچ منبعی فرض نشده است.'),
              "- هم‌زمانی میزبان، backoff، سقف حجم، timeout و پاک‌سازی فایل موقت فعال‌اند. تغییر URL ثابت با SHA-256 و ETag/Last-Modified در بازاعتبارسنجی قابل تشخیص است؛ در نبود بازاعتبارسنجی، تغییر دوردست خودبه‌خود معلوم نمی‌شود.",
              "- آزمون‌های مصنوعی sanity check هستند؛ گواهی کامل انطباق رسمی با مجموعهٔ آزمون EBU انجام نشده است. نسخه و پارامترهای FFmpeg ثبت شده‌اند.",
              "- تخمین فعالیت صوت، غیرقطعی است و سکوت سخت را از نفس، طنین یا حرف آرام به‌طور معنایی جدا نمی‌کند. خروجی مجوز trim خودکار نیست.", "",
              "## منابع و روش", "",
              "- ساختار قرآن: [Tanzil](https://tanzil.net/docs/Quran_Metadata)، snapshot و SHA-256 در metadata؛ cross-check با [AlQuran Cloud](https://api.alquran.cloud/v1/meta). ناشران جدا ممکن است منشأ شمارش مشترک داشته باشند.",
              "- [ITU-R BS.1770](https://www.itu.int/rec/R-REC-BS.1770) و [FFmpeg ebur128](https://ffmpeg.org/ffmpeg-filters.html#ebur128-1): اندازه‌گیری LUFS با gate استاندارد؛ True Peak تخمینی از oversampling پیاده‌سازی FFmpeg.",
              "- [EBU Tech 3342](https://tech.ebu.ch/docs/tech/tech3342.pdf): LRA برای گفتارهای بسیار کوتاه می‌تواند گمراه‌کننده باشد. شرط حداقل ۳۰ ثانیه و ۱۰۰ پنجرهٔ کوتاه‌مدت معتبر، سیاست محافظه‌کارانهٔ این دیتاست است، نه حداقل اجباری استاندارد.",
              "- [Web Audio GainNode](https://www.w3.org/TR/2021/REC-webaudio-20210617/#GainNode)، [Media3 AudioProcessor](https://developer.android.com/reference/androidx/media3/common/audio/AudioProcessor)، [Media3 Player](https://developer.android.com/reference/androidx/media3/common/Player).", ""]
    calibration = folder / "calibration-reference.json"
    if calibration.exists():
        c = json.loads(calibration.read_text())
        if c.get("passed"):
            lines += ["", f"آزمون تک‌سیگنال مرجع رسمی EBU: مقدار {c['measured_native_lufs']:.3f} LUFS در برابر انتظار ‎−۲۳ LUFS، داخل تلورانس ±۰٫۲ LU. این آزمون تک‌سیگنال جای گواهی مجموعهٔ کامل را نمی‌گیرد."]
        else:
            lines += ["", "دریافت سیگنال مرجع رسمی EBU در این اجرا ممکن نشد: " + str(c.get("error", {}).get("message", "unknown")) + ". نتیجهٔ این آزمون اجراشده یا موفق معرفی نمی‌شود؛ جزئیات در calibration-reference.json است."]
    text = "\n".join(lines)
    (folder / "report.fa.md").write_text(text)
    # Minimal standalone HTML, same content and locally linked static charts.
    body = []; table = False; listing = False
    def inline(value):
        value=html.escape(value)
        value=re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)',r'<a href="\2">\1</a>',value)
        value=re.sub(r'`([^`]+)`',r'<code>\1</code>',value)
        return re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',value)
    for line in lines:
        if line.startswith("|"):
            if line.startswith("|---"):
                continue
            if not table:
                body.append("<table>"); table = True
            cells = [v.strip() for v in line.strip("|").split("|")]
            body.append('<tr>'+''.join('<td dir="'+('ltr' if re.fullmatch(r'[+\-−\d.٪%/:—\s]+',c) else 'auto')+'">'+inline(c)+'</td>' for c in cells)+'</tr>')
            continue
        if table:
            body.append("</table>"); table = False
        if line.startswith("!["):
            filename = line.split("(", 1)[1].rstrip(")")
            body.append(f'<img src="{filename}" alt="نمودار تحلیل صوت">')
        elif line.startswith("#"):
            n = len(line) - len(line.lstrip("#"))
            body.append(f"<h{n}>" + html.escape(line[n:].strip()) + f"</h{n}>")
        elif line:
            body.append("<p>" + inline(line) + "</p>")
    if table:
        body.append("</table>")
    style = "body{max-width:1250px;margin:40px auto;padding:0 24px;font:17px/1.9 Tahoma,Arial;color:#17312d;background:#f6faf8}h1,h2{color:#09685b}table{width:100%;border-collapse:collapse;font-size:14px;background:white;direction:rtl}td{border:1px solid #cbdcd6;padding:8px}tr:first-child{font-weight:bold;background:#e3f0e9}img{max-width:100%;background:white;border:1px solid #dae4df;border-radius:10px}p{overflow-wrap:anywhere}"
    (folder / "report.fa.html").write_text('<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>گزارش تحلیل صوت قرآن</title><style>' + style + '</style><body>' + "\n".join(body) + '</body></html>')
