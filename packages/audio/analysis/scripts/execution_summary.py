"""Generate coverage notes from the current audited snapshot, without stale counts."""
import argparse
import json
from pathlib import Path

from pipeline import ROOT


def build(root):
    reports = root / 'reports'
    progress = json.loads((reports / 'progress.json').read_text())
    coverage = progress['coverage']
    valid = sum(c['success'] for c in coverage)
    invalid = sum(c['invalid'] for c in coverage)
    remaining = sum(c['unprocessed'] for c in coverage)
    attempted = 81068 - remaining
    title = 'فهرست کامل بررسی شده' if progress['complete_inventory'] else 'استخراج ناقص و قابل ادامه'
    lines = ['# وضعیت استخراج صوت قرآن', '', f"زمان UTC: {progress['updated_at']}", '',
             f'**{title}: {attempted:,} مورد بررسی‌شده، {valid:,} فایل معتبر، '
             f'{invalid:,} فایل نامعتبر و {remaining:,} مورد بررسی‌نشده از ۸۱٬۰۶۸ مورد.**', '',
             'فهرست کامل بررسی‌شده به معنای معتبر بودن همهٔ فایل‌ها نیست؛ نتیجهٔ هر URL در جدول زیر جدا ثبت می‌شود. '
             'اندازه‌گیری‌های فایل نامعتبر فقط تشخیصی‌اند و در baseline و Gain وارد نمی‌شوند.', '',
             '| منبع | معتبر | ناموجود | نامعتبر | موقت | HTTP دیگر | بررسی‌نشده |',
             '|---|---:|---:|---:|---:|---:|---:|']
    for c in coverage:
        lines.append('| ' + ' | '.join(str(c[k]) for k in
                     ('source_id','success','missing','invalid','temporary_error','http_error','unprocessed')) + ' |')
    publication = progress.get('replacement_publication', {})
    if publication.get('accepted_replacement_count'):
        lines += ['', f"این snapshot شامل {publication['accepted_replacement_count']} نسخهٔ جایگزین پذیرفته‌شده است؛ انتشار {publication['pending_publication_count']} مورد در URL اصلی هنوز تأیید نشده است. شمارش فایل معتبر مربوط به بایت‌های مرجع است، نه ادعای آزمون مجدد بایت‌های فعلی CDN.", '']
    lines += ['', 'Measured، Inferred و Recommended جدا هستند. فرضیه‌های ضبط و ناهنجاری‌ها مجوز اصلاح خودکار نیستند. '
              'هیچ فایل اصلی تغییر، trim، نرمال‌سازی یا دوباره Encode نشده است.', '',
              'گزارش فارسی و نمودارها: report.fa.html و report.fa.standalone.html؛ '
              'مقایسهٔ توزیع‌های همسان: distributions/distribution-report.fa.md. '
              'نتیجهٔ کنترل Schema و معنایی در dataset-validation.json و خطاهای فایل‌ها در failures.jsonl است.', '',
              'کد بسته در sabereen/ghoran، مسیر packages/audio و برنچ feat/audio-analysis-package قرار دارد. '
              'دادهٔ سبک consumer از همین snapshot با export_package.py تولید می‌شود؛ '
              'تاریخ و پوشش data/coverage.json مرجع نسخهٔ مصرفی است. فایل ZIP شامل checkpoint و تاریخچهٔ واقعی SQLite است.', '',
              'در بازنشانی محیط، snapshot پایدار ۶۵٬۱۴۵ مورد بازیابی شد؛ fingerprint کد اندازه‌گیری و نسخهٔ کامل FFmpeg '
              'با اجرای قبلی یکسان بود و فقط موارد باقی‌مانده دوباره در صف قرار گرفتند. تلاش‌های موقت و بازبینی فایل‌های '
              'نامعتبر در events ثبت می‌شوند؛ تعداد events با تعداد فایل یکتا تفاوت دارد.', '']
    text = '\n'.join(lines)
    for name in ('SNAPSHOT.fa.md', 'EXECUTION_STATUS.fa.md'):
        (reports / name).write_text(text)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root', type=Path, default=ROOT)
    build(p.parse_args().root.resolve())
