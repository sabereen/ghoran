# Quran text and fonts — `@ghoran/text`

This package provides Quran text and fonts.

## Installation

```bash
npm i @ghoran/text
```

## Raw text

If you only need the prepared text without JavaScript build tools, browse the JSON files:

https://unpkg.com/browse/@ghoran/text@latest/json/

## Quran text

Available orthographies include:

- `tanzil-simple-clean`: unmarked text suitable for Quran search.
- `tanzil-simple-min`: lightly marked text suitable for copying and sharing.
- `imla`: Imla spelling.
- `hafs`: Uthman Taha (Hafs) text; use its matching font.
- `hafs-v3`: Uthman Taha (Hafs) version 3.0; use `uthmanic-hafs-v3`.
- `hafs-v13`: an older Hafs edition; use its matching font.

See [orthographies and fonts](/en/fonts) for details.

```js
import { loadText } from '@ghoran/text'

// A complete array of Quran verses.
// Use the metadata package to divide it into chapters, pages, etc.
const quranText = await loadText('hafs')
```

::: tip Lazy loading
The selected orthography's array loads lazily for better performance.
:::

## Quran fonts

The package includes:

- `uthmanic-hafs`: use with the `hafs` text.
- `uthmanic-hafs-v3`: version 3.0; use with `hafs-v3`.
- `uthmanic-hafs-v13`: an older version with a bold weight; use with `hafs-v13`.

Import the stylesheet and apply the font class:

```js
import '@ghoran/text/fonts/uthmanic-hafs-v13/style.css'
```

```html
<div class="text-uthmanic-hafs-v13">...</div>
```
