# Quran metadata — `@ghoran/metadata`

This package provides Quran metadata, including chapter information, pages, juz divisions, and obligatory and recommended prostrations.

::: danger Low-level data
For a more convenient application API, use [@ghoran/entity](/en/packages/entity).
:::

## Installation

```bash
npm i @ghoran/metadata
```

## Chapters

`surahList` contains every chapter's metadata as a tuple:

```js
import { surahList } from '@ghoran/metadata'

// Al-Baqara (surah number 2, array index 1)
console.log(surahList[1])
```

The tuple fields are:

| Index | Meaning                         |
| ----- | ------------------------------- |
| 0     | Index of the first ayah         |
| 1     | Number of verses                |
| 2     | Revelation order                |
| 3     | Number of ruku divisions        |
| 4     | Arabic chapter name             |
| 5     | Transliterated name             |
| 6     | English translation of the name |
| 7     | Whether the chapter is Medinan  |

::: tip Why tuples instead of objects?
Tuples reduce the size of the data downloaded by web clients. The entity package provides convenient classes and objects around this data.
:::

## Pages

`pageList` is an array of first-ayah indices. Array index 0 corresponds to page 1. Use these indices to slice the verse array from [the text package](/en/packages/text):

```js
import { pageList } from '@ghoran/metadata'
import { loadText } from '@ghoran/text'

const quranText = await loadText('hafs')
const page = 2
const pageFirstAyah = pageList[page - 1]
const nextPageFirstAyah = pageList[page]
const ayatOfPage = quranText.slice(pageFirstAyah, nextPageFirstAyah)
```

For the final page, the next index is `undefined`, so `slice` includes the rest of the array.

## Juz divisions

`juzList` contains the first-ayah index of each juz, with the same structure as the page list.

## Hizb quarters

`hizbQuarterList` contains the first-ayah index of each quarter-hizb.

## Manzil divisions

`manzilList` contains the first-ayah index of each manzil.

## Ruku divisions

`rukuList` contains the first-ayah index of each ruku.

## Prostrations

Prostration metadata is available as both an array and an object.

### Array format

`sajdahListBySurahNumber` is a two-dimensional array. Each tuple contains:

| Index | Meaning                                       |
| ----- | --------------------------------------------- |
| 0     | Surah number (subtract 1 for the surah index) |
| 1     | Verse number within the surah                 |
| 2     | Whether prostration is obligatory             |

::: details Array source
<<< ../../../packages/metadata/src/sajdah.ts#sajdahListBySurahNumber
:::

### Object format

`sajdahMap` maps an ayah index to a boolean. An absent index means that the verse has no prostration. `true` means obligatory prostration; `false` means recommended prostration.

## Divisions by surah and verse number

The lists above use ayah indices. If your application needs surah and verse numbers instead, import:

- `pageListBySurahNumber`
- `juzListBySurahNumber`
- `hizbQuarterListBySurahNumber`
- `manzilListBySurahNumber`
- `rukuListBySuarhNumber`

Each list contains pairs: `[surahNumber, ayahNumberWithinSurah]`. Both numbers start at 1. The spelling `rukuListBySuarhNumber` matches the exported identifier.
