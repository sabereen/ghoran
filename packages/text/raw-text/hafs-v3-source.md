# Hafs Uthmanic Script v3.0

Retrieved on 2026-10-13 from the archived package in
[quran-ws/quran-text](https://github.com/quran-ws/quran-text/blob/b7c62daa3ac4c9ec37a398b35b8f246cee5bb217/sources/kfgqpc/UthmanicHafs-v-3.0.zip).

The archive contains the matching Word document and TTF. The font's name table
identifies `KFGQPC HAFS Uthmanic Script`, `Version 3.0`, and
`King Fahd Glorious Quran Printing Complex`. The binaries are copied unchanged.
The existing build generates WOFF2 from the TTF and extracts the Quran from the
Word document, removing surah headings, standalone basmalahs, and ayah markers.
It then applies the library's existing word-offset normalization (nonbreaking
spaces) so the text can be used alongside the other editions.

## Provenance limitation

This is an archived copy, not a download independently verified against the
publisher. The upstream manifest explicitly records no original publisher URL
for this v3 package. The official developer/font pages timed out during research.
The hashes below identify the exact files used; they do not establish publisher
authenticity or prove this is the newest release. Do not confuse this Unicode
font version with the separate QPC page-glyph V1/V2/V4 families.

## SHA-256

| File                     | SHA-256                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `UthmanicHafs-v-3.0.zip` | `cdec7341b7c684e7b8dd469c4b68988914d2784e924c7e6cbb9cb4b57c24f013` |
| `uthmanic-hafs-v3.docx`  | `a01bed32cfa28952aa8558dfa88239ce36dfda9857ced9ea0912d5f6369080d4` |
| `uthmanic-hafs-v3.ttf`   | `5c47602425fb4190327ab9e1a2e8ed2f53dceaf595d8ccc29ac32b8b209ad398` |

The font and Quran text retain their KFGQPC ownership and usage terms; the
library's MIT license does not relicense these assets. The font's embedded name
table contains its end-user license agreement. See also the
[official developer page](https://qurancomplex.gov.sa/en/techquran/dev/).
