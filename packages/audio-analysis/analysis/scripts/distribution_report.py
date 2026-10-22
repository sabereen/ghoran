#!/usr/bin/env python3
"""Matched-verse loudness distributions, neighboring changes and intrinsic LRA."""
import argparse
from collections import Counter
from contextlib import closing
import csv
import json
from pathlib import Path
import sqlite3
import tempfile

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

from pipeline import ROOT, atomic_json, now
from quality_audit import audit


def describe(values):
    x = np.asarray(values, dtype=float)
    if not len(x):
        return {'n': 0, 'median': None, 'p05': None, 'p25': None, 'p75': None, 'p95': None, 'p95_p05_lu': None, 'mad_lu': None}
    p = np.percentile(x, [5, 25, 50, 75, 95])
    return {'n': len(x), 'median': float(p[2]), 'p05': float(p[0]), 'p25': float(p[1]),
            'p75': float(p[3]), 'p95': float(p[4]), 'p95_p05_lu': float(p[4]-p[0]),
            'mad_lu': float(np.median(np.abs(x-p[2])))}


def stats(root, output):
    sources = json.loads((root/'sources.json').read_text())['sources']
    verses = json.loads((root/'metadata/verses.json').read_text())
    # Every panel and numerical claim is based on one immutable, audited snapshot.
    with tempfile.TemporaryDirectory(prefix='distribution-snapshot-') as tmp:
        frozen = Path(tmp); (frozen/'checkpoints').mkdir()
        with closing(sqlite3.connect(root/'checkpoints/state.sqlite3')) as a, closing(sqlite3.connect(frozen/'checkpoints/state.sqlite3')) as b:
            a.backup(b)
        audit(frozen)
        with closing(sqlite3.connect(frozen/'checkpoints/state.sqlite3')) as c:
            status = c.execute('SELECT source,status,count(*) FROM records GROUP BY source,status').fetchall()
            rows = c.execute("""SELECT source,verse,
                json_extract(payload,'$.measured.loudness.integrated_lufs'),
                json_extract(payload,'$.measured.dualmono_playback_lufs'),
                json_extract(payload,'$.measured.duration_s'),
                json_extract(payload,'$.measured.activity.active_duration_s'),
                json_extract(payload,'$.measured.loudness.true_peak_dbtp'),
                json_extract(payload,'$.measured.loudness.lra_lu'),
                json_extract(payload,'$.measured.media.channels')
                FROM records WHERE status='success' ORDER BY source,verse""").fetchall()
    groups = {s['id']: [] for s in sources}
    for sid, ordinal, native, playback, duration, active, peak, lra, channels in rows:
        groups[sid].append({'ordinal': ordinal, 'native': native, 'lufs': playback, 'duration': duration,
                            'active': active, 'peak': peak, 'lra': lra, 'channels': channels})
    eligible = {sid: {r['ordinal']: r for r in rs if r['lufs'] is not None and r['duration'] >= 3 and r['active'] >= 1} for sid, rs in groups.items()}
    common = sorted(set.intersection(*(set(rs) for rs in eligible.values())))
    summaries = []
    for source in sources:
        sid = source['id']; all_rows = groups[sid]; cohort = [eligible[sid][o] for o in common]
        jumps = [abs(eligible[sid][b]['lufs']-eligible[sid][a]['lufs']) for a,b in zip(common,common[1:]) if b == a+1]
        summaries.append({'source_id': sid, 'name_fa': source['name_fa'], 'kind': source['kind'],
                          'n_valid': len(all_rows), 'n_matched': len(cohort),
                          'all_eligible': describe([r['lufs'] for r in eligible[sid].values()]),
                          'matched': describe([r['lufs'] for r in cohort]),
                          'adjacent_absolute_jump_lu': describe(jumps),
                          'adjacent_jump_above_3lu_fraction': sum(j>3 for j in jumps)/len(jumps) if jumps else None,
                          'adjacent_jump_above_6lu_fraction': sum(j>6 for j in jumps)/len(jumps) if jumps else None,
                          'lra_lu': describe([r['lra'] for r in cohort if r['lra'] is not None]),
                          'true_peak_above_0_fraction': sum(r['peak'] is not None and r['peak']>0 for r in cohort)/len(cohort) if cohort else None,
                          'channel_counts': dict(Counter(r['channels'] for r in all_rows))})
    counts = {s['id']: {} for s in sources}
    for sid, state, n in status:
        counts[sid][state] = n
    observed = sum(n for _,_,n in status)
    end_contiguous = 0
    observed_per_source = [{r['ordinal'] for r in groups[s['id']]} for s in sources]
    # Coverage prefix includes attempted failures, since they were actually checked.
    attempted_ordinals = set()
    for r in rows:
        attempted_ordinals.add(r[1])
    for i in range(1,6237):
        if i not in attempted_ordinals:
            break
        end_contiguous = i
    result = {'created_at': now(), 'schema_version': '1.0.0', 'data_class': 'inferred',
              'expected_total': 81068, 'observed_total': observed, 'valid_total': sum(len(v) for v in groups.values()),
              'unprocessed_total': 81068-observed, 'complete_inventory': observed == 81068,
              'provisional': observed < 81068, 'coverage_counts': counts,
              'matched_eligible_verses': len(common), 'matched_adjacent_pairs': sum(b==a+1 for a,b in zip(common,common[1:])),
              'cohort_rule': 'intersection of 13 sources; valid decode, duration >=3s, active duration >=1s; consecutive ordinals only for jumps',
              'loudness_convention': 'native BS.1770 +3.0103 LU for mono duplicated at equal amplitude to two channels',
              'highest_contiguous_observed_ordinal': end_contiguous,
              'highest_contiguous_observed_verse': verses[end_contiguous-1]['verse_id'] if end_contiguous else None,
              'sources': summaries}
    output.mkdir(parents=True,exist_ok=True)
    atomic_json(output/'distribution-summary.json',result)
    with (output/'distribution-summary.csv').open('w') as f:
        writer=csv.writer(f);writer.writerow(['source_id','n_valid','n_matched','median_playback_lufs','p95_p05_lu','mad_lu','median_adjacent_jump_lu','fraction_adjacent_above_3lu','median_lra_lu'])
        for s in summaries:
            writer.writerow([s['source_id'],s['n_valid'],s['n_matched'],s['matched']['median'],s['matched']['p95_p05_lu'],s['matched']['mad_lu'],s['adjacent_absolute_jump_lu']['median'],s['adjacent_jump_above_3lu_fraction'],s['lra_lu']['median']])
    plot(output,sources,groups,eligible,common,summaries,result)
    write_report(output,result)
    # Small trace data can drive a separately rendered interactive exploration.
    atomic_json(output/'distribution-traces.json',{'sources':sources,'common':common,
                'traces':{sid:[[r['ordinal'],round(r['lufs'],3),round(r['duration'],2)] for r in rs if r['lufs'] is not None] for sid,rs in groups.items()}})
    print(json.dumps({'observed':observed,'valid':result['valid_total'],'matched':len(common),'output':str(output)}))


def plot(output,sources,groups,eligible,common,summaries,result):
    plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'figure.facecolor':'#fcfcfa','axes.facecolor':'#fcfcfa','axes.labelcolor':'#233333','text.color':'#233333'})
    color = {s['id']: '#cb7d32' if s['kind']=='translation' else '#157c78' for s in sources}
    names=[s['id'] for s in sources]; by={s['source_id']:s for s in summaries}
    fig,axes=plt.subplots(1,2,figsize=(13,7.5),constrained_layout=True)
    for i,sid in enumerate(names):
        p=by[sid]['matched']; med=p['median'];c=color[sid]
        if med is None:continue
        axes[0].plot([p['p05'],p['p95']],[i,i],color=c,lw=2,alpha=.45)
        axes[0].plot([p['p25'],p['p75']],[i,i],color=c,lw=9,solid_capstyle='butt')
        axes[0].scatter([med],[i],s=26,color='#243535',zorder=3)
        axes[1].barh(i,p['p95_p05_lu'],color=c,alpha=.85,height=.55)
        axes[1].text(p['p95_p05_lu']+.12,i,f"{p['p95_p05_lu']:.1f}",va='center')
    for ax in axes:
        ax.set_yticks(range(len(names)),names);ax.invert_yaxis();ax.grid(axis='x',alpha=.15);ax.set_axisbelow(True)
    axes[0].set(xlabel='Playback-convention LUFS',title='Level: P05–P95 / IQR / median')
    axes[1].set(xlabel='LU (lower = less between-verse spread)',title='Between-verse central 90% width')
    axes[1].set_xlim(0,max((by[s]['matched']['p95_p05_lu'] or 0 for s in names),default=1)*1.17)
    label='FULL INVENTORY' if result['complete_inventory'] else 'PARTIAL INVENTORY'
    fig.suptitle(f"{label} · same {len(common):,} eligible verses in all 13 sources\nTeal: recitation · Orange: translation · spread is not a recording-quality score",fontsize=12)
    for suffix in ['png','svg']:fig.savefig(output/f'level-and-spread.{suffix}',dpi=170)
    plt.close(fig)
    fig,axes=plt.subplots(1,2,figsize=(13,7.5),constrained_layout=True)
    for i,sid in enumerate(names):
        p=by[sid]['adjacent_absolute_jump_lu'];c=color[sid]
        if p['median'] is not None:
            axes[0].plot([p['p05'],p['p95']],[i,i],color=c,lw=2,alpha=.45)
            axes[0].scatter([p['median']],[i],color=c,s=35)
        fraction=by[sid]['adjacent_jump_above_3lu_fraction']
        if fraction is not None:
            axes[1].barh(i,100*fraction,color=c,height=.55,alpha=.85)
            axes[1].text(100*fraction+.3,i,f'{100*fraction:.1f}%',va='center')
    for ax in axes:
        ax.set_yticks(range(len(names)),names);ax.invert_yaxis();ax.grid(axis='x',alpha=.15);ax.set_axisbelow(True)
    axes[0].set(xlabel='Absolute difference between adjacent verses (LU)',title='Neighbor continuity: median and P05–P95')
    axes[1].set(xlabel='Share of measured consecutive pairs (%)',title='Adjacent loudness jump greater than 3 LU')
    axes[1].set_xlim(0,max((100*(by[s]['adjacent_jump_above_3lu_fraction'] or 0) for s in names),default=1)*1.18+1)
    fig.suptitle(f"{result['matched_adjacent_pairs']:,} common consecutive eligible pairs · gaps never joined",fontsize=12)
    for suffix in ['png','svg']:fig.savefig(output/f'neighbor-continuity.{suffix}',dpi=170)
    plt.close(fig)
    # Identical bins/scales expose skew and multiple modes that quantiles hide.
    bins=np.arange(-45, 1.001, .5)
    for kind,title,shape in [('recitation','Recitations',(3,3)),('translation','Translations',(2,2))]:
        cohort_sources=[s for s in sources if (s['kind']=='translation')==(kind=='translation')]
        fig,axes=plt.subplots(*shape,figsize=(13,9 if kind=='recitation' else 6),sharex=True,sharey=True,constrained_layout=True)
        for ax,source in zip(axes.flat,cohort_sources):
            sid=source['id'];values=np.array([eligible[sid][o]['lufs'] for o in common])
            if len(values):
                ax.hist(values,bins=bins,weights=np.full(len(values),100/len(values)),color=color[sid],alpha=.8)
                ax.axvline(np.median(values),color='#233333',lw=1.3)
            ax.set_title(sid,loc='left');ax.grid(axis='y',alpha=.15);ax.set_xlim(-40,-5)
        fig.supxlabel('Playback-convention integrated loudness (LUFS), 0.5 LU bins')
        fig.supylabel('Percent of common eligible verses per bin')
        fig.suptitle(f'{title} · {len(common):,} matched verses · {label.lower()} · line: median',fontsize=12)
        for suffix in ['png','svg']:fig.savefig(output/f'{kind}-histograms.{suffix}',dpi=170)
        plt.close(fig)
    # Same x/y scales for all sources; preserve gaps and natural individual variation.
    fig,axes=plt.subplots(7,2,figsize=(15,16),sharex=True,sharey=True,constrained_layout=True)
    all_y=[r['lufs'] for rs in groups.values() for r in rs if r['lufs'] is not None]
    for ax,source in zip(axes.flat,sources):
        sid=source['id'];rs=[r for r in groups[sid] if r['lufs'] is not None]
        ax.scatter([r['ordinal'] for r in rs],[r['lufs'] for r in rs],s=4,color=color[sid],alpha=.4,rasterized=True)
        # A rolling median is shown only when >=8 observed neighbors lie within +/-15 ordinals.
        mapping={r['ordinal']:r['lufs'] for r in rs};xx=[];yy=[]
        for r in rs:
            neighbors=[mapping[o] for o in range(r['ordinal']-15,r['ordinal']+16) if o in mapping]
            if len(neighbors)>=8:xx.append(r['ordinal']);yy.append(float(np.median(neighbors)))
        start=0
        for k in range(1,len(xx)+1):
            if k==len(xx) or xx[k]!=xx[k-1]+1:
                ax.plot(xx[start:k],yy[start:k],color='#233333',lw=1);start=k
        ax.set_title(sid,loc='left');ax.grid(alpha=.1)
        ax.set_ylim(min(all_y)-1,max(all_y)+1)
    axes.flat[-1].axis('off')
    fig.supxlabel('Canonical Quran ordinal (1–6236); unobserved regions stay empty')
    fig.supylabel('Playback-convention integrated loudness (LUFS)')
    fig.suptitle('Observed level across Quran order · black: local rolling median · no gain applied',fontsize=12)
    fig.savefig(output/'quran-order-traces.png',dpi=150);plt.close(fig)


def write_report(output,data):
    rows=data['sources'];ranked=sorted(rows,key=lambda r:r['matched']['p95_p05_lu'] if r['matched']['p95_p05_lu'] is not None else float('inf'))
    lines=['# پراکندگی و پیوستگی بلندی صوت','',f"زمان snapshot به UTC: {data['created_at']}",'',f"{data['valid_total']:,} فایل معتبر؛ {data['unprocessed_total']:,} مورد بررسی‌نشده. مقایسهٔ منصفانه بر {data['matched_eligible_verses']:,} آیهٔ مشترک بین هر ۱۳ منبع انجام شده است.",'',
           'پوشش کامل هر مجموعه ۶٬۲۳۶ آیه است؛ بخش‌های بررسی‌نشده در نمودار ترتیب قرآن خالی مانده‌اند. مقایسهٔ این snapshot، نتیجه‌گیری دربارهٔ آیات دریافت‌نشده نیست.','',
           '## سه پرسش متفاوت','',
           '۱. سطح معمول صدا چقدر است؟ میانهٔ LUFS، مرکز بلندی هر مجموعه را نشان می‌دهد. پایین‌تر بودن این عدد یعنی صدای آرام‌تر، نه کیفیت پایین‌تر.',
           '۲. بلندی بین آیات چقدر پخش است؟ فاصلهٔ P05 تا P95 نود درصد میانی آیات را می‌پوشاند؛ IQR و MAD در کنار آن گزارش شده‌اند. Gain ثابت این پهنا را کم نمی‌کند و تنها کل توزیع را جابه‌جا می‌کند.',
           '۳. آیا آیات کنار هم جهش دارند؟ قدرمطلق اختلاف LUFS دو آیهٔ واقعاً متوالی، از پراکندگی سراسری متمایز است. هیچ فاصلهٔ بررسی‌نشده‌ای به هم وصل نشده است.', '',
           'این‌ها با LRA درون یک فایل فرق دارند. قاری مجوّد می‌تواند تغییرات طبیعی بیشتری داشته باشد؛ پراکندگی بیشتر، اثبات خطای ضبط یا مجوز صاف‌کردن بیان نیست.','',
           'قرارداد پخش برای مقایسه: LUFS اصلی، با افزودن ۳٫۰۱۰۳ LU برای فایل مونو در فرض کپی دامنهٔ یکسان به دو کانال. اعداد LUFS اصلی native در measurements حفظ شده‌اند. آیات کوتاه‌تر از سه ثانیه یا با فعالیت کمتر از یک ثانیه از cohort مشترک کنار گذاشته می‌شوند.','',
           '![سطح و پراکندگی](level-and-spread.png)','',
           '![شکل توزیع قاریان](recitation-histograms.png)','',
           '![شکل توزیع ترجمه‌ها](translation-histograms.png)','',
           '| منبع | میانهٔ پخش LUFS | پهنای ۹۰٪ LU | MAD | میانهٔ جهش همسایه LU | جهش بیشتر از ۳ LU |','|---|---:|---:|---:|---:|---:|']
    for s in rows:
        p=s['matched'];j=s['adjacent_absolute_jump_lu'];fraction=s['adjacent_jump_above_3lu_fraction']
        if p['median'] is not None:
            lines.append(f"| {s['name_fa']} | {p['median']:.2f} | {p['p95_p05_lu']:.2f} | {p['mad_lu']:.2f} | {j['median']:.2f} | {100*fraction:.1f}٪ |")
    lines+=['','![پیوستگی همسایه‌ها](neighbor-continuity.png)','','## برداشت عملی از همین نمونه','']
    rec=[s for s in ranked if s['kind']!='translation'];tr=[s for s in ranked if s['kind']=='translation']
    if rec and tr:
        lines.append(f"در آیات مشترک فعلی، کمترین پهنای ۹۰٪ میان تلاوت‌ها برای {rec[0]['name_fa']} ({rec[0]['matched']['p95_p05_lu']:.2f} LU) و میان ترجمه‌ها برای {tr[0]['name_fa']} ({tr[0]['matched']['p95_p05_lu']:.2f} LU) دیده می‌شود. این رتبه‌بندیِ پراکندگی است، نه رتبه‌بندی کیفیت یا مطلوبیت اجرا.")
    lines+=['', 'برای طراحی Gain ابتدا اختلاف مرکز مجموعه‌ها را جبران کنید. اگر پهنای یک مجموعه زیاد است، به جای برابرکردن تک‌تک آیات، نمودار روند و فرضیه‌های تغییر پایدار ضبط را بازبینی کنید. جهش‌های منفرد، سکوت زیاد یا خطای Decode باید جدا بررسی شوند.','',
            '![روند ترتیب قرآن](quran-order-traces.png)','',
            'نسخهٔ عددی همهٔ آمارها در distribution-summary.json و CSV است. درصد جهش‌های بیش از ۳ LU یک آستانهٔ توصیفی است، نه تشخیص قطعی آزاردهندگی. قضاوت ادراکی نهایی به گوش‌دادن روی دستگاه و محتوای همان آیات نیاز دارد.','']
    (output/'distribution-report.fa.md').write_text('\n'.join(lines))


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',type=Path,default=ROOT);p.add_argument('--output',type=Path)
    a=p.parse_args();stats(a.root.resolve(),(a.output or a.root/'reports/distributions').resolve())
