"""Embed the frozen report's own scientific figures for a single offline HTML."""
import argparse
import base64
from pathlib import Path
import re

from pipeline import ROOT


def build(root):
    reports=(root/'reports').resolve()
    document=(reports/'report.fa.html').read_text()
    def embed(match):
        path=(reports/match[1]).resolve()
        if not path.is_relative_to(reports) or path.suffix!='.png':
            raise ValueError('Unexpected local figure path')
        return 'src="data:image/png;base64,'+base64.b64encode(path.read_bytes()).decode()+'"'
    document=re.sub(r'src="([^"]+\.png)"',embed,document)
    output=reports/'report.fa.standalone.html';output.write_text(document)
    print({'standalone_report':str(output),'bytes':output.stat().st_size},flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--root',type=Path,default=ROOT)
    build(parser.parse_args().root.resolve())
