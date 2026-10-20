import { importText } from '@ghoran/text'
import {
  createQuranSearch,
  getHighlightRanges,
  getHighlightSegments,
  normalizeArabic,
} from '../src/index'

const NativeSegmenter = Intl.Segmenter
function withoutSegmenter() {
  vi.stubGlobal('Intl', { Segmenter: undefined })
}
afterEach(() => vi.unstubAllGlobals())

describe('Intl.Segmenter as progressive enhancement', () => {
  test('native substring precision degrades to whole words, even after native use', async () => {
    const text = '😀  بِاللَّهِ\tبِاللَّهِ!'
    const search = await createQuranSearch({ corpus: [text] })
    try {
      const native = (await search.search('الله', { mode: 'substring' }))
        .hits[0]
      expect(
        getHighlightSegments(text, native)
          .filter((s) => s.highlighted)
          .map((s) => s.text),
      ).toEqual(['اللَّهِ', 'اللَّهِ'])
      withoutSegmenter()
      const legacy = (await search.search('الله', { mode: 'substring' }))
        .hits[0]
      expect(
        legacy.matches.map((m) => text.slice(m.sourceStart, m.sourceEnd)),
      ).toEqual(['بِاللَّهِ', 'بِاللَّهِ'])
      expect(
        legacy.matches.map((m) => [m.normalizedStart, m.normalizedEnd]),
      ).toEqual(native.matches.map((m) => [m.normalizedStart, m.normalizedEnd]))
      const segments = getHighlightSegments(text, legacy)
      expect(segments.filter((s) => s.highlighted).map((s) => s.text)).toEqual([
        'بِاللَّهِ\tبِاللَّهِ',
      ])
      expect(segments.map((s) => s.text).join('')).toBe(text)
      expect(
        getHighlightRanges(text, legacy).ranges.every(
          (r) => r.accuracy === 'word',
        ),
      ).toBe(true)
      // Hits remain independently usable across execution environments.
      vi.unstubAllGlobals()
      expect(
        getHighlightSegments(text, legacy)
          .filter((s) => s.highlighted)
          .map((s) => s.text),
      ).toEqual(['اللَّهِ', 'اللَّهِ'])
    } finally {
      search.dispose()
    }
  })

  test('search and normalization work even when the Intl namespace is absent', async () => {
    vi.stubGlobal('Intl', undefined)
    expect(normalizeArabic('قُلْ')).toBe('قل')
    const search = await createQuranSearch({ corpus: ['قُلْ هُوَ الله'] })
    try {
      expect((await search.search('قل هو')).total).toBe(1)
      expect(await search.search('كتاب')).toEqual({ total: 0, hits: [] })
      expect(await search.search('الله', { limit: 0 })).toEqual({
        total: 1,
        hits: [],
      })
      expect(await search.search('')).toEqual({ total: 0, hits: [] })
    } finally {
      search.dispose()
    }
  })

  test.each(['phrase', 'allWords', 'anyWord', 'substring'] as const)(
    '%s retains IDs, totals, occurrences, scopes and pagination',
    async (mode) => {
      const corpus = [
        'الرحمن الرحيم الرحمن الرحيم',
        'الرحيم',
        'الله الرحمن',
        'ل\u200dا',
      ]
      const native = await createQuranSearch({ corpus })
      const options = {
        mode,
        scope: { ayahRange: [0, 3] as const },
        offset: 1,
        limit: 1,
      }
      const expected = await native.search('الرحيم', options)
      native.dispose()
      withoutSegmenter()
      const legacy = await createQuranSearch({ corpus })
      try {
        expect(await legacy.search('الرحيم', options)).toEqual(expected)
      } finally {
        legacy.dispose()
      }
    },
  )

  test('join controls, combining marks and supplementary letters keep original text', async () => {
    withoutSegmenter()
    for (const [text, query, expected] of [
      ['ل\u200dا', 'ل', 'ل\u200dا'],
      ['😀\u200dلا', 'لا', 'لا'],
      ['ب\u200cلا', 'لا', 'ب\u200cلا'],
      ['😀\ufe0fلا', 'لا', 'لا'],
      ['𐐀a\u0301', 'a', '𐐀a\u0301'],
    ]) {
      const search = await createQuranSearch({
        corpus: [text],
        normalizer: 'none',
      })
      try {
        const hit = (await search.search(query, { mode: 'substring' })).hits[0]
        expect(hit).toBeDefined()
        const segments = getHighlightSegments(text, hit)
        expect(segments.map((s) => s.text).join('')).toBe(text)
        expect(
          segments.filter((s) => s.highlighted).map((s) => s.text),
        ).toEqual([expected])
      } finally {
        search.dispose()
      }
    }
  })

  test.each([
    'hafs',
    'hafs-v13',
    'hafs-v3',
    'imla',
    'tanzil-simple-min',
    'tanzil-simple-clean',
  ] as const)('real %s text still maps complete words', async (edition) => {
    withoutSegmenter()
    const search = await createQuranSearch()
    try {
      const hit = (
        await search.search('الرحمن الرحيم', { scope: { ayahIndices: [0] } })
      ).hits[0]
      const display = (await importText(edition)).default[0]
      const segments = getHighlightSegments(display, hit)
      expect(segments.map((s) => s.text).join('')).toBe(display)
      expect(getHighlightRanges(display, hit).unresolvedMatches).toEqual([])
      expect(getHighlightRanges(display, hit).ranges).toMatchObject([
        { accuracy: 'word' },
      ])
      // Native segmentation is only an oracle in this test; the implementation
      // remains usable with Intl.Segmenter removed from its environment.
      const boundaries = new Set([
        0,
        display.length,
        ...Array.from(
          new NativeSegmenter('ar', { granularity: 'grapheme' }).segment(
            display,
          ),
          (g) => g.index,
        ),
      ])
      for (const s of segments) {
        expect(boundaries.has(s.start)).toBe(true)
        expect(boundaries.has(s.end)).toBe(true)
      }
    } finally {
      search.dispose()
    }
  })

  test.each(['qpc-v1', 'qpc-v2'] as const)(
    '%s trusted maps work without native grapheme validation',
    async (edition) => {
      withoutSegmenter()
      const search = await createQuranSearch()
      try {
        const hit = (
          await search.search('الرحمن الرحيم', { scope: { ayahIndices: [0] } })
        ).hits[0]
        const display = (await importText(edition)).default[0]
        const wordMap = (
          edition === 'qpc-v1' ? [0, 2, 4, 6] : [0, 1, 2, 3]
        ).map((start) => ({ start, end: start + 1 }))
        expect(getHighlightRanges(display, hit).unresolvedMatches).toEqual([0])
        const segments = getHighlightSegments(display, hit, { wordMap })
        expect(
          segments.filter((s) => s.highlighted).map((s) => s.text),
        ).toEqual([edition === 'qpc-v1' ? 'ﭓ ﭔ' : 'ﱃﱄ'])
        expect(segments.map((s) => s.text).join('')).toBe(display)
        expect(() =>
          getHighlightRanges('😀', hit, {
            wordMap: [{ start: 0, end: 1 }, null, null, null],
          }),
        ).toThrow(RangeError)
        expect(() =>
          getHighlightRanges(display, hit, {
            wordMap: [{ start: -1, end: 1 }, null, null, null],
          }),
        ).toThrow(RangeError)
      } finally {
        search.dispose()
      }
    },
  )
})
