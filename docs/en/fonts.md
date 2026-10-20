# Quran orthographies and fonts

A font and an orthography are related but different. Choosing an Uthman Taha font alone does not make text conform to the Uthman Taha orthography.

## Uthman Taha orthography

Tajwid teachers recommend this orthography because its marks and conventions follow the Hafs transmission from Asim, beyond the calligraphy itself.

The King Fahd Quran Printing Complex provides a specialized font and matching Quran text. Always use the text supplied for the selected font.

Version 3.0 is available as `hafs-v3` with `uthmanic-hafs-v3`:

```js
import { loadText } from '@ghoran/text'
import '@ghoran/text/fonts/uthmanic-hafs-v3/style.css'

const quranText = await loadText('hafs-v3')
```

Apply `text-uthmanic-hafs-v3` to the display element. The font has one weight; TTF and WOFF2 files ship with the package. Both text and font must be version 3, particularly because some tanwin marks use different codepoints in the newer text.

`hafs` and `uthmanic-hafs` still refer to version 2.2. Version 3 was added separately to preserve existing applications. Source details and SHA-256 hashes are recorded in `packages/text/raw-text/hafs-v3-source.md`.

```js
import { loadText } from '@ghoran/text'
import '@ghoran/text/fonts/uthmanic-hafs/style.css'

const quranText = await loadText('hafs')
```

This font has one weight. If you need the bold weight available in an older edition, use version 13:

```js
import { loadText } from '@ghoran/text'
import '@ghoran/text/fonts/uthmanic-hafs-v13/style.css'

const quranText = await loadText('hafs-v13')
```

## Imla orthography

Imla spelling aims to resemble pronunciation. Many Quran fonts support it, but nonspecialist fonts may not display its marks correctly.

```js
import { loadText } from '@ghoran/text'

const quranText = await loadText('imla')
```

## Lightly marked text

Text with fewer marks works well across many fonts, including nonspecialist fonts. It is suitable for copying and sharing through social networks and other applications because it is less likely to display incorrectly.

```js
import { loadText } from '@ghoran/text'

const quranText = await loadText('tanzil-simple-min')
```

## Unmarked text

Unmarked text is intended for processing such as search rather than reading.

```js
import { loadText } from '@ghoran/text'

const quranText = await loadText('tanzil-simple-clean')
```
