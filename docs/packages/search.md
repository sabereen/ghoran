---
title: Quran search (@ghoran/search)
lang: en-US
dir: ltr
---

<script setup>
import SearchDemo from '../components/SearchDemo.vue'
</script>

# Quran search — `@ghoran/search`

A small, headless ESM library with TypeScript declarations. Use it from vanilla
JavaScript, Node.js, React, Vue or Nuxt. It has no UI, DOM, database or search-service
dependency. Quran text comes from the existing `@ghoran/text` package; search does
not ship another copy of the Quran.

## Try it

<ClientOnly><SearchDemo /></ClientOnly>

The demo loads on demand, searches in a module worker, and displays Hafs v3 text.
Results are limited to ten verses. Rendering uses text interpolation, never HTML.

## Install and search

```sh
pnpm add @ghoran/search
# Also add these when importing them directly:
pnpm add @ghoran/text @ghoran/entity @ghoran/metadata
```

```ts
import { createQuranSearch } from '@ghoran/search'

const search = await createQuranSearch()
const results = await search.search('الرحمن الرحيم')
console.log(results.total, results.hits)
// Release instance-owned normalized data when finished:
search.dispose()
```

The default corpus is `tanzil-simple-clean`. Other Arabic corpora include
`tanzil-simple-min`, `imla`, `hafs`, `hafs-v13` and `hafs-v3`:

```ts
const search = await createQuranSearch({ corpus: 'hafs-v3' })
```

QPC v1/v2 are **font glyph encodings**, not ordinary Unicode Arabic. Selecting
`qpc-v1` or `qpc-v2` searches the `tanzil-simple-clean` semantic companion. Results
contain that companion's source text and token positions. QPC display mapping is
explicit; see the highlighting limitations below.

## Modes, ordering and pagination

```ts
await search.search('الرحمن الرحيم', { mode: 'phrase' })
await search.search('رحيم الله', { mode: 'allWords' })
await search.search('رحيم غفور', { mode: 'anyWord' })
await search.search('رحم', { mode: 'substring' })
await search.search('الله', { limit: 10, offset: 20 })
```

| Mode               | Meaning                                                                          |
| ------------------ | -------------------------------------------------------------------------------- |
| `phrase` (default) | Consecutive, ordered lexical tokens after normalization.                         |
| `allWords`         | Every distinct query token occurs, in any order.                                 |
| `anyWord`          | At least one query token occurs.                                                 |
| `substring`        | Literal substring of normalized tokens joined with spaces; allows partial words. |

Word modes never match `الله` inside `بالله`. Punctuation and whitespace separate
lexical tokens. A phrase may span punctuation. NBSP used by text homogenization is
also whitespace; token indices are **not** `text.split(' ')` indices. Standalone
Quran annotations do not become tokens. Repeated query tokens require consecutive
repetitions in phrase mode; word-set modes deduplicate them. All occurrences,
including overlapping ones, appear in a hit's `matches`.

Every mode returns canonical Quran order. `score` is occurrence count, with no
relevance sorting. `total` counts matching **verses**, before pagination. Defaults
are `limit: 20`, `offset: 0`; `limit: 0` returns just the count. Empty, whitespace,
mark-only and non-word queries return zero hits. Queries are literal; they never
become regular expressions. Wrong query types and unknown modes throw. Pagination
must use nonnegative safe integers. There is no implicit maximum result count;
requesting all common-word results increases allocation and transport cost.

## Arabic normalization

```ts
import { normalizeArabic } from '@ghoran/search'

normalizeArabic('ٱلرَّحِيمِ') // 'الرحيم'
normalizeArabic('أَحَدٌ', { profile: 'strict' }) // 'أحد'
normalizeArabic('مَدْرَسَة', { profile: 'loose' }) // 'مدرسه'

const strictSearch = await createQuranSearch({ normalization: 'strict' })
await search.search('أحد', { normalization: 'strict' })
```

| Behavior                                                                 | `strict`                | `standard` (default)           | `loose`      |
| ------------------------------------------------------------------------ | ----------------------- | ------------------------------ | ------------ |
| NFC canonical composition                                                | Yes                     | Yes                            | Yes          |
| Arabic presentation-form ligatures                                       | Compatibility expansion | Same                           | Same         |
| Vowels, shadda, sukun, tatweel, superscript alef, pause/recitation signs | Remove                  | Remove                         | Remove       |
| Alef `آ أ إ ٱ`                                                           | Preserve                | `ا`                            | `ا`          |
| Persian `ی ک`                                                            | Preserve                | Arabic `ي ك`                   | Arabic `ي ك` |
| Hamza on waw/yeh `ؤ ئ`                                                   | Preserve                | Preserve                       | `و ي`        |
| Standalone `ء` / residual combining hamza and madda                      | Preserve                | Preserve except on folded alef | Remove       |
| Alef maqsura `ى`                                                         | Preserve                | Preserve                       | `ي`          |
| Ta marbuta `ة`                                                           | Preserve                | Preserve                       | `ه`          |
| Whitespace                                                               | Trim and collapse       | Same                           | Same         |
| Other scripts' marks and compatibility characters                        | Preserve                | Preserve                       | Preserve     |

The explicit removal ranges are U+0610–061A, U+064B–0652, U+0656–065F,
U+0670, U+06D6–06ED, U+08D3–08E1 and U+08E3–08FF, plus U+08E2.
These cover Quranic annotations, small waw/yeh and Hafs v3 open tanwin.
U+0653–0655 (madda/hamza) are deliberately handled separately. NFC runs before and
after transformations, including unexpected combining sequences. Only Arabic
presentation ranges U+FB50–FDFF and U+FE70–FEFC receive compatibility expansion;
there is no blanket NFKC or deletion of every Unicode combining mark.

All profiles are pure and idempotent. “Strict” is conservative **search
normalization**, not a reversible spelling or linguistic identity operation:
vocalization and small-letter distinctions are still lost. Standard intentionally
merges alef/hamza-on-alef variants. Loose can produce false positives such as
`على`/`علي` or `مدرسة`/`مدرسه`, and removes standalone hamza. None of these profiles
performs morphology, root extraction, stemming, synonyms or fuzzy matching.

Removing superscript alef does not universally reconstruct imla spelling: for
example, Uthmanic `كِتَٰب` normalizes differently from `كتاب`. Prefer searching the
default corpus and mapping highlights to display text. The highlighter can use
limited spelling alternatives without silently broadening search semantics.
Never apply Arabic presentation normalization to QPC glyph codes.

## Scope: surahs, ranges and selected verses

```ts
await search.search('الله', { scope: { surahs: [1, 2] } })
await search.search('الله', { scope: { ayahRange: [7, 293] } })
await search.search('الله', { scope: { ayahIndices: [0, 8, 255, 6221] } })
```

Surah numbers are public **1–114**. Ayah indices are canonical **0–6235**.
Ranges are half-open: `[7, 293)` includes Al-Baqara only. Fields intersect when
combined. An empty set or an empty range matches nothing. Invalid indices,
fractional values, reversed ranges and out-of-bounds ranges throw, even for an
empty query. Duplicate scope entries are harmless.

Reuse metadata for chapter bounds:

```ts
import { surahList } from '@ghoran/metadata'
const [start, count] = surahList[1] // Al-Baqara, index 1 = public surah 2
const results = await search.search('الله', {
  scope: { ayahRange: [start, start + count] },
})
```

## Results and indexing conventions

```ts
import type { SearchResponse, SearchHit, SearchMatch } from '@ghoran/search'
import { Ayah } from '@ghoran/entity'

const response: SearchResponse = await search.search('الرحمن الرحيم')
const hit: SearchHit = response.hits[0]
const ayah = Ayah.get(hit.ayahIndex)
console.log(hit.key, ayah.page.number, ayah.surahNumber)
```

A response is `{ total, hits }`. A hit contains `ayahIndex`, `key`, `score`,
`sourceText`, `normalization` and `matches`. It contains no entity class instances.
The complete object is JSON-serializable and structured-clone-compatible.
`sourceText` makes each hit independently usable for highlighting.

All match ranges are zero-based and half-open:

| Fields                             | Addressed string/sequence                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `startWord`, `endWord`             | Lexical token indices **after normalization**.                                                                 |
| `normalizedStart`, `normalizedEnd` | UTF-16 offsets into normalized token values joined by a single space.                                          |
| `sourceStart`, `sourceEnd`         | UTF-16 offsets into the original `sourceText`; full graphemes, or whole words if exact mapping is unavailable. |

`sourceText.slice(match.sourceStart, match.sourceEnd)` is safe for same-source
rendering. Never apply normalized offsets or these source offsets to a different
orthography. A custom normalizer can expand one word into several tokens; mapping
falls back to that original word when per-character correspondence is unavailable.

## Highlighting across Arabic orthographies

```ts
import { getHighlightSegments, getHighlightRanges } from '@ghoran/search'
import { importText } from '@ghoran/text'

const display = (await importText('hafs-v3')).default
const { hits } = await search.search('الرحمن الرحيم')
const hit = hits[0]
const original = display[hit.ayahIndex]
const segments = getHighlightSegments(original, hit)
// [{ text, start, end, highlighted }, ...]
console.assert(segments.map((segment) => segment.text).join('') === original)

const { ranges, unresolvedMatches } = getHighlightRanges(original, hit)
// ranges: { start, end, accuracy: 'exact' | 'word' }[]
```

Render each segment as a text node/interpolation, with `<mark>` for highlighted
segments. No HTML strings or DOM APIs are generated. Original marks, punctuation,
spacing, NBSP and surrogate pairs remain intact. Offsets use UTF-16. With native
`Intl.Segmenter`, ranges end on grapheme boundaries. Multiple and overlapping matches merge into disjoint
ranges, including whitespace between adjacent selected words.

Alignment checks **word content**. It never relies only on equal word counts or
the existing homogenization script's filtered-letter counts. Built-in Arabic
alignment compares standard-normalized spelling plus an optional expansion of
superscript alef; waw/maqsura carrying superscript alef may correspond to alef. Quranic `ءَا`
and precomposed `آ` are also accepted spelling alternatives.
One-to-many/many-to-one joins up to three lexical words are supported. An optimal
sequence alignment accepts only correspondences shared by all minimum-cost paths.
Ambiguous repeated words and unsupported spelling differences remain unresolved.
For oversized custom texts, alignment work is bounded to 65,536 word-pair states;
larger nonidentical alignments remain unresolved rather than allocating an unbounded matrix.

If normalized letters correspond exactly, substring matches receive character
ranges including attached combining marks. If validated words have different
spelling, highlighting expands to whole display words. A matched part of a joined
word can therefore highlight the whole joined word. No fuzzy letter similarity,
blanket alef deletion, or ta-marbuta/ta substitution is used for alignment.
`unresolvedMatches` lists match indices with at least one unmapped word; other
validated words may still be highlighted. Inspect it when complete coverage is
required. A missing highlight is preferable to assigning a match to an unrelated
word.

### QPC and explicit mappings

QPC codes are reused by page-specific fonts. Codepoints, spaces, glyph counts or
Unicode decomposition cannot validate their Arabic meaning. By default QPC
highlights are unresolved. Supply a **trusted** source-token-to-display range map
from your verified content pipeline:

```ts
// Golden correspondence for 1:1 in this repository's QPC v2 corpus only.
const qpc = (await importText('qpc-v2')).default[0] // ﱁﱂﱃﱄﱅ
const hit = (
  await search.search('الرحمن الرحيم', {
    scope: { ayahIndices: [0] },
  })
).hits[0]
const wordMap = [0, 1, 2, 3].map((start) => ({ start, end: start + 1 }))
const segments = getHighlightSegments(qpc, hit, { wordMap })
// Highlights ﱃﱄ; leaves the final verse-number glyph unhighlighted.
```

This example is not a general QPC algorithm. A QPC word may occupy several glyphs,
word divisions may differ, and number/pause glyphs must be excluded. `wordMap`
length must equal the normalized source token count; use `null` for unknown words.
Ranges must be ordered and in bounds. Surrogate boundaries are always checked;
full grapheme boundaries are additionally checked when `Intl.Segmenter` is available.
The library validates those structural constraints; **semantic correctness of supplied maps
belongs to their provider**. No automatic full-Quran QPC map is shipped because
this repository's encoded glyph data does not establish semantic correspondence.
QPC also requires the correct [page font](/fonts).

## Browser Worker: Vite, Vue and Nuxt

The package exports a real `@ghoran/search/worker` module asset, which imports the
same engine as direct execution. Its relative generated chunks ship alongside it.
Use a local worker entry so the consumer's bundler resolves package imports and
emits all worker dependencies:

```ts
// src/quran.worker.ts — this is the complete file
import '@ghoran/search/worker'
```

```ts
// src/search.ts — browser/client code
import { createBrowserQuranSearch } from '@ghoran/search/browser'

export const search = await createBrowserQuranSearch({
  workerFactory: () =>
    new Worker(new URL('./quran.worker.ts', import.meta.url), {
      type: 'module',
    }),
})
```

Configure ESM worker output because lazy Quran loading uses code splitting. This
is required by Vite versions whose worker output defaults to IIFE (including the
Vite version used by VitePress):

```ts
// vite.config.ts
import { defineConfig } from 'vite'
export default defineConfig({ worker: { format: 'es' } })
```

For Nuxt, put the equivalent in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({ vite: { worker: { format: 'es' } } })
```

Keep the literal `new URL('./quran.worker.ts', import.meta.url)` expression inside
`new Worker` so Vite recognizes it in both development and production. Do not use
`new URL('@ghoran/search/worker', import.meta.url)`: package specifiers are not
relative URLs. The wrapper imports the **published export**, with no monorepo path.
A Vite-specific alternative is `import QuranWorker from '@ghoran/search/worker?worker'`
then `workerFactory: () => new QuranWorker()`; the local wrapper is the tested recipe.

For Nuxt, construct the worker in `onMounted` or a `.client.ts` plugin, using a local
wrapper next to the component/plugin. Do not instantiate `Worker` during SSR.
The browser entrypoint itself is SSR-safe and has no top-level worker creation.
Omitting `workerFactory` explicitly uses direct execution; `search.execution`
reports `'worker'` or `'direct'`. Supplying a factory makes initialization failures
reject by default. An explicit fallback must communicate the reason:

```ts
const search = await createBrowserQuranSearch({
  workerFactory: () =>
    new Worker(new URL('./quran.worker.ts', import.meta.url), {
      type: 'module',
    }),
  fallback: 'direct',
  onFallback(error) {
    console.warn('Worker unavailable; using main thread', error)
  },
  timeoutMs: 30_000, // default initialization/request timeout
})
```

Runtime worker errors reject pending requests, terminate the worker and leave the
instance unusable. They do not silently rerun queries on the main thread.
Search validation errors reject that request while the worker remains usable.
Every request has its own ID; concurrent/out-of-order responses cannot resolve
another request. `dispose()` rejects pending work, removes listeners and terminates
the worker. Calls after disposal reject.

### Vue/Nuxt lifecycle and stale results

```vue
<script setup lang="ts">
import { onMounted, onBeforeUnmount, shallowRef } from 'vue'
import { createBrowserQuranSearch } from '@ghoran/search/browser'
import type { QuranSearch, SearchResponse } from '@ghoran/search'

const results = shallowRef<SearchResponse>({ total: 0, hits: [] })
let search: QuranSearch | undefined
let controller: AbortController | undefined
let generation = 0
let destroyed = false

onMounted(async () => {
  const engine = await createBrowserQuranSearch({
    workerFactory: () =>
      new Worker(new URL('./quran.worker.ts', import.meta.url), {
        type: 'module',
      }),
  })
  if (destroyed) engine.dispose()
  else search = engine
})
async function update(query: string) {
  if (!search) return
  controller?.abort()
  controller = new AbortController()
  const current = ++generation
  try {
    const response = await search.search(query, { signal: controller.signal })
    if (current === generation) results.value = response
  } catch (error) {
    if ((error as Error).name !== 'AbortError') console.error(error)
  }
}
onBeforeUnmount(() => {
  destroyed = true
  generation++
  controller?.abort()
  search?.dispose()
})
</script>
```

Aborting rejects promptly on the caller side and ignores the eventual reply.
Already-running synchronous loading/normalization/search CPU work is not interrupted;
disposal terminates the worker. Direct searches only check cancellation before and
after their synchronous scan. Calls remain independent: the library does not guess
which caller owns the “latest” query. Abort the previous request and use a sequence
guard when updating reactive UI. Debounce text input to avoid queuing obsolete scans.

### Older browsers: progressive enhancement

`Intl.Segmenter` is optional. If the environment has no implementation (including
inside a worker), initialization, normalization and search continue without a
polyfill or a missing-API error. Native segmentation is detected lazily and reused
when available.

Without it, original-string positions and highlights expand to complete lexical
words, including for partial substring matches. For example, searching `الله`
inside `بِاللَّهِ` still matches, but the highlight covers `بِاللَّهِ` instead of
just `اللَّهِ`. `getHighlightRanges()` reports `accuracy: 'word'`. Original text,
spacing, surrogate pairs and the word's Arabic combining marks are preserved.
Normalized match positions remain available, so a hit returned by an older worker
can regain finer highlighting when rendered in an environment with segmentation.

This fallback does not implement full Unicode grapheme segmentation. Complex emoji,
joiner sequences and scripts outside ordinary Arabic may receive less precise
boundaries. Explicit `wordMap` values remain trusted assertions: bounds, order and
surrogate boundaries are always validated; full grapheme validation runs only when
native segmentation is available. No dependencies or polyfills are added. Unicode
property escapes and the repository's other JavaScript requirements still apply.

## Node.js and custom verse-aligned text

The main entrypoint has no browser globals or Node-only imports. It loads text using
`importText`, avoiding the text package's browser CacheStorage adapter. Node needs
no Worker or DOM declarations; use normal ESM and `await createQuranSearch()`.
Unicode property escapes are required; use Node 22.18+ (the repository baseline)
or browsers supporting those JavaScript features. `Intl.Segmenter` enhances
highlight precision when available and is not required for search.

To search only lesson verses while retaining canonical IDs:

```ts
const text = (await importText('tanzil-simple-clean')).default
const ayahIndices = [0, 8, 255, 6221]
const lesson = await createQuranSearch({
  corpus: ayahIndices.map((index) => text[index]),
  ayahIndices,
})
```

For translations or other content aligned with Quran verses:

```ts
// Full-length arrays default to positional canonical ayah indices.
const translations = ['In the name of God', 'Praise belongs to God']
const translated = await createQuranSearch({
  corpus: translations,
  normalizer: 'none', // retains Persian letters, accents and case
})
// Or direct-mode case-insensitive matching:
const lower = (text: string) => text.toLocaleLowerCase('en')
const caseInsensitive = await createQuranSearch({
  corpus: translations,
  normalizer: lower,
})
const hit = (await caseInsensitive.search('GOD')).hits[0]
getHighlightSegments(hit.sourceText, hit, { normalizer: lower })
```

Custom arrays contain at most 6,236 strings. Supply unique canonical `ayahIndices`
for subsets, or positional indices are used. Inputs are copied and results sorted
by canonical ID. Empty arrays are valid. Custom functions must be deterministic
and operate on individual lexical words; punctuation/tokenization remains shared.
A per-query Arabic profile cannot override a custom/identity normalizer. Function
normalizers cannot cross worker transport; use direct mode or the serializable
`normalizer: 'none'`. Arabic cross-orthography spelling alternatives are disabled
for custom/identity normalization.

## Performance and ownership

A linear scan is sufficient for this corpus. Each engine normalizes its selected
corpus once on initialization. A different Arabic profile is prepared lazily on
first use and retained in that instance (at most three profiles). No application-
wide mutable engine cache, inverted index or persistent storage is used. Concurrent
factories have independent normalized data; JavaScript's module loader reuses text
imports. A warm factory still normalizes its own corpus. Reuse an engine across
queries and dispose it when its owner ends. Imported text modules may remain in
the runtime's module cache after disposal.

The package's static code does not embed Quran text. Bundlers may **emit** chunks
for all text editions because `@ghoran/text` exposes dynamic imports for them, but
only the selected semantic corpus downloads at initialization. Loading a display
edition is a separate download. Worker cold-start time also includes its module
loading. Results include source strings and can increase clone cost for large
limits.

Run the reproducible production-output benchmark after building:

```sh
pnpm build
pnpm bench:search
# Refresh the committed raw measurements:
pnpm --filter @ghoran/search exec node --expose-gc bench/search.mjs --write
```

Measurements and environment are recorded in the repository's
[`packages/search/bench/results.json`](https://github.com/sabereen/ghoran/blob/main/packages/search/bench/results.json).
The benchmark measures cold and warm factories, repeated query median/p95,
post-GC heap change, generated ESM/gzip sizes and real-thread worker round trips.
Worker CPU/clone timings use Node's worker threads with the published browser
worker module; they do not include browser network downloads. Results are not
Android device measurements. On lower-end devices prefer workers, debounce input,
keep result limits small and test cold loading on target hardware.

Measured on **19 October 2026**, Node v24.19.0, Linux x64,
AMD EPYC 9V74 80-Core Processor. Each query has 10 warmups and 100 measured repetitions;
initialization uses five fresh-process or fresh-instance samples. Cold timing
includes module loading and corpus preparation, excluding Node process startup.

| Query        | Median (ms) | p95 (ms) | Matching verses |
| ------------ | ----------: | -------: | --------------: |
| common word  |       1.917 |    4.126 |            1567 |
| phrase       |       1.346 |    1.923 |               6 |
| allWords     |       2.178 |    3.843 |              41 |
| anyWord      |       1.661 |    2.463 |            1589 |
| many results |       2.959 |    8.878 |            2023 |
| single surah |       0.495 |    0.995 |             139 |
| substring    |       0.703 |    1.106 |             201 |

Cold initialization median: **192.0 ms**; warm-module, new-instance
initialization: **144.0 ms**. Incremental post-GC heap for one normalized
engine was approximately **12.78 MiB**, with the text module already cached.
Worker initialization was **238.9 ms**; common-word worker search median
was **2.372 ms**, with an empty round trip median of
**0.026 ms**. These timings measure Node worker CPU/clone overhead.

Generated main ESM plus its shared runtime chunk: **22.31 kB raw / 7.24 kB gzip**.
The browser adapter adds 3.97 kB raw / 1.36 kB gzip; the worker entry adds
1.23 kB raw / 0.55 kB gzip and reuses the shared engine. These are tsdown production
ESM sizes before consumer tree-shaking/minification, excluding external metadata,
text-loader dependencies and Quran data. The text package’s selected canonical
corpus chunk is approximately 196.7 kB gzip; its other editions are lazy chunks.

The measured scans do not justify an inverted index for this iteration. Results
vary with runtime load, device, profile and result limit; no mobile latency guarantee
is inferred from this server-class CPU.

## Verification and troubleshooting

`pnpm verify` builds all seven packages, typechecks, runs Vitest, installs actual
packed tarballs into an independent offline consumer, verifies ESM/declarations,
executes the published worker in a real thread, checks Vite dev resolution and
production worker emission, and builds the docs. `pnpm check:search-browser`
also runs the packed Vite application in Chromium in development and production;
set `CHROME_BIN` if Chromium is not on PATH. Release scripts discover packages and
publish dependencies before their consumers. No publish command runs as part of
this implementation's verification.

- **No match in a display corpus:** small alef and Uthmanic spelling can differ.
  Search `tanzil-simple-clean` and map the hit to the display edition.
- **Some words are not highlighted:** inspect `unresolvedMatches`. An ambiguous,
  unsupported or mismatched verse is never guessed by word count.
- **QPC results have no highlights:** provide trusted `wordMap` ranges and the
  correct page font. Normalizing glyph codes cannot recover their Arabic text.
- **Wrong offsets:** normalized offsets, original UTF-16 offsets and lexical word
  indices address different sequences. Use the segment API across orthographies.
- **Worker 404, MIME or CSP error:** keep the local wrapper, let Vite bundle its
  package import, deploy emitted chunks, and allow your module worker in CSP. If a build reports IIFE/code-splitting errors,
  set Vite's `worker.format` to `'es'`.
  Raw Node module resolution does not turn a package specifier into a browser URL.
- **SSR says Worker is undefined:** create the factory's worker inside a client
  lifecycle hook. Omit the factory for explicit server-side direct execution.
- **Memory grows:** reuse engines, limit profile switching and dispose component-
  owned engines. Do not create an engine on every keystroke.
- **Old results replace new ones:** abort prior calls and guard UI assignment with
  a generation ID. Independent concurrent searches are intentionally supported.
