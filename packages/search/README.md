# @ghoran/search

Headless TypeScript Quran search for Node.js and browsers. No UI dependencies.
ESM with declarations; Quran text loads lazily from `@ghoran/text`.

```sh
pnpm add @ghoran/search
```

```ts
import { createQuranSearch, getHighlightSegments } from '@ghoran/search'
import { importText } from '@ghoran/text'

const search = await createQuranSearch()
const { hits, total } = await search.search('الرحمن الرحيم')
const display = (await importText('hafs-v3')).default
const segments = getHighlightSegments(display[hits[0].ayahIndex], hits[0])
search.dispose()
```

Search supports `phrase` (default), `allWords`, `anyWord`, and opt-in `substring`,
with canonical ayah IDs, intersecting scopes, pagination and occurrence positions.
`normalizeArabic(text, { profile: 'strict' | 'standard' | 'loose' })` is standalone.
All results are structured-clone-compatible. Highlight segments preserve every
original character; advanced callers can inspect `getHighlightRanges()` for
`exact`/`word` accuracy and unresolved match indices.

Browser workers are optional. In a local `quran.worker.ts`:

```ts
import '@ghoran/search/worker'
```

Then, in Vite/Vue/Nuxt client code:

```ts
import { createBrowserQuranSearch } from '@ghoran/search/browser'

const search = await createBrowserQuranSearch({
  workerFactory: () =>
    new Worker(new URL('./quran.worker.ts', import.meta.url), {
      type: 'module',
    }),
})
```

Set `worker: { format: 'es' }` in `vite.config.ts` (Nuxt:
`vite: { worker: { format: 'es' } }`) so lazy text imports can split into chunks.

The published worker subpath resolves to `dist/worker.mjs`; keep its generated
chunks together. The explicit local wrapper lets Vite build the worker in both
development and production. Do not pass a package specifier to `new URL()`.
No factory means direct execution, including SSR. A provided factory failing to
initialize rejects; fallback requires `fallback: 'direct'` and `onFallback`.
Use `AbortSignal` per request, and dispose engines when their owner unmounts.
Cancellation rejects and ignores the eventual reply; synchronous CPU work already
running is not interrupted. Calls are independent; the library does not globally
cancel other consumers' searches.

Highlight alignment validates lexical content, supports unambiguous joins/splits
up to three words, and rejects ambiguous or unsupported correspondences. It never
assumes equal word counts prove alignment. QPC is a font glyph encoding: Arabic
search uses the canonical semantic companion and glyph highlights require an
explicit trusted `wordMap`. No automatic QPC correspondence is claimed.

Requires modern JavaScript with Unicode property escapes (Node 22.18+ is the
repository baseline). `Intl.Segmenter` is an optional progressive enhancement:
when absent, search still works and substring highlights expand to complete
lexical words with `accuracy: 'word'`. No polyfill is needed or loaded. Original
text and Arabic combining marks are preserved; full validation of complex Unicode
grapheme boundaries is available only with native segmentation. Trusted `wordMap`
ranges always validate bounds, ordering and surrogate boundaries, with full
grapheme validation when supported. Core utilities have no DOM or Node built-in
imports. Custom corpora may supply canonical IDs and a custom or
identity normalizer; function normalizers are available only in direct mode.

[Full guide, normalization tables, limitations, and demo](https://sabereen.github.io/ghoran/packages/search)

Repository verification: `pnpm verify`, `pnpm check:search-browser` (Chromium),
`pnpm bench:search`. Measured results live in `bench/results.json` in the repository.
