import { importText } from '@ghoran/text'
import type { QuranTextType } from '@ghoran/text'
import {
  createQuranSearch,
  getHighlightRanges,
  getHighlightSegments,
} from '../src/index'
import type { SearchHit } from '../src/index'

async function hit(
  sourceText: string,
  query: string,
  mode: 'phrase' | 'substring' | 'anyWord' = 'phrase',
): Promise<SearchHit> {
  const engine = await createQuranSearch({ corpus: [sourceText] })
  const result = (await engine.search(query, { mode })).hits[0]
  engine.dispose()
  return result
}
function selected(text: string, result: SearchHit, options = {}) {
  const segments = getHighlightSegments(text, result, options)
  expect(segments.map((segment) => segment.text).join('')).toBe(text)
  for (const segment of segments)
    expect(text.slice(segment.start, segment.end)).toBe(segment.text)
  return segments
    .filter((segment) => segment.highlighted)
    .map((segment) => segment.text)
}

describe('real Quran golden highlights', () => {
  const cases: [QuranTextType, number, string, string, 'exact' | 'word'][] = [
    ['tanzil-simple-clean', 0, 'الرحمن الرحيم', 'الرحمن الرحيم', 'exact'],
    ['tanzil-simple-min', 0, 'الرحمن الرحيم', 'الرَّحمـٰنِ الرَّحيمِ', 'exact'],
    ['hafs', 0, 'الرحمن الرحيم', 'ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ', 'exact'],
    ['hafs-v13', 0, 'الرحمن الرحيم', 'ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ', 'exact'],
    ['hafs-v3', 0, 'الرحمن الرحيم', 'ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ', 'exact'],
    ['imla', 0, 'الرحمن الرحيم', 'الرَّحۡمٰنِ الرَّحٖیمِ', 'exact'],
    ['hafs', 15, 'آمنوا', 'ءَامَنُواْ', 'word'],
    ['hafs-v3', 15, 'آمنوا', 'ءَامَنُواْ', 'word'],
    ['imla', 15, 'آمنوا', 'ءاٰمَنُوا', 'word'],
    ['hafs', 8, 'ريب', 'رَيۡبَۛ', 'exact'],
    ['hafs', 8, 'هدى', 'هُدٗى', 'exact'],
    ['hafs', 8, 'الكتاب', 'ٱلۡكِتَٰبُ', 'word'],
    ['hafs-v13', 8, 'الكتاب', 'ٱلۡكِتَٰبُ', 'word'],
    ['hafs-v3', 8, 'الكتاب', 'ٱلۡكِتَٰبُ', 'word'],
  ]
  test.each(cases)(
    '%s ayahIndex %i query %s',
    async (edition, index, query, expected, accuracy) => {
      const source = (await importText('tanzil-simple-clean')).default[index]
      const display = (await importText(edition)).default[index]
      const result = await hit(source, query)
      expect(selected(display, result)).toEqual([expected])
      const mapping = getHighlightRanges(display, result)
      expect(mapping.unresolvedMatches).toEqual([])
      expect(mapping.ranges).toEqual([
        {
          start: display.indexOf(expected),
          end: display.indexOf(expected) + expected.length,
          accuracy,
        },
      ])
    },
  )
  test.each(['qpc-v1', 'qpc-v2'] as const)(
    'QPC %s requires trusted glyph correspondence, never decomposes glyph codes',
    async (edition) => {
      const source = (await importText('tanzil-simple-clean')).default[0]
      const display = (await importText(edition)).default[0]
      const result = await hit(source, 'الرحمن الرحيم')
      expect(selected(display, result)).toEqual([])
      expect(getHighlightRanges(display, result).unresolvedMatches).toEqual([0])
      // Golden word correspondence for 1:1, explicitly checked against the font's
      // words. The final glyph is the verse number, not a searchable Arabic word.
      const wordMap =
        edition === 'qpc-v1'
          ? [0, 2, 4, 6].map((start) => ({ start, end: start + 1 }))
          : [0, 1, 2, 3].map((start) => ({ start, end: start + 1 }))
      expect(selected(display, result, { wordMap })).toEqual([
        edition === 'qpc-v1' ? 'ﭓ ﭔ' : 'ﱃﱄ',
      ])
      expect(
        getHighlightRanges(display, result, { wordMap }).unresolvedMatches,
      ).toEqual([])
    },
  )
  test('reconstructs representative verses in every orthography, with no broken graphemes', async () => {
    const source = (await importText('tanzil-simple-clean')).default
    const engine = await createQuranSearch()
    const result = await engine.search('الله', { limit: 100 })
    for (const edition of [
      'hafs',
      'hafs-v13',
      'hafs-v3',
      'imla',
      'tanzil-simple-min',
      'tanzil-simple-clean',
      'qpc-v1',
      'qpc-v2',
    ] as const) {
      const texts = (await importText(edition)).default
      for (const item of result.hits) {
        expect(item.sourceText).toBe(source[item.ayahIndex])
        const display = texts[item.ayahIndex]
        const segments = getHighlightSegments(display, item)
        expect(segments.map((s) => s.text).join('')).toBe(display)
        const boundaries = new Set([
          0,
          display.length,
          ...Array.from(
            new Intl.Segmenter('ar', { granularity: 'grapheme' }).segment(
              display,
            ),
            (g) => g.index,
          ),
        ])
        for (const segment of segments) {
          expect(boundaries.has(segment.start)).toBe(true)
          expect(boundaries.has(segment.end)).toBe(true)
        }
      }
    }
    engine.dispose()
  })
})

describe('safe character and word mapping', () => {
  test('substring highlighting includes combining marks and preserves original spacing', async () => {
    const text = '😀  بِاللَّهِ\tبِاللَّهِ!'
    const result = await hit(text, 'الله', 'substring')
    expect(selected(text, result)).toEqual(['اللَّهِ', 'اللَّهِ'])
    const display = '😀\t بِٱللَّهِ  بِٱللَّهِ!'
    expect(selected(display, result)).toEqual(['ٱللَّهِ', 'ٱللَّهِ'])
  })
  test('orthographic spelling differences use complete words for partial substring matches', async () => {
    const result = await hit('الكتاب', 'تاب', 'substring')
    expect(selected('ٱلۡكِتَٰبُ', result)).toEqual(['ٱلۡكِتَٰبُ'])
    expect(getHighlightRanges('ٱلۡكِتَٰبُ', result).ranges[0].accuracy).toBe(
      'word',
    )
  })
  test('join controls and emoji never split grapheme boundaries', async () => {
    for (const text of ['ل\u200dا', '😀\u200dلا', 'ب\u200cلا', '😀\ufe0fلا']) {
      const result = await hit(text, 'لا', 'substring')
      // The ZWJ changes the first token's literal value, so query its first letter.
      const matched = result ?? (await hit(text, 'ل', 'substring'))
      const boundaries = new Set([
        0,
        text.length,
        ...Array.from(
          new Intl.Segmenter('ar', { granularity: 'grapheme' }).segment(text),
          (g) => g.index,
        ),
      ])
      for (const match of matched.matches) {
        expect(boundaries.has(match.sourceStart)).toBe(true)
        expect(boundaries.has(match.sourceEnd)).toBe(true)
      }
      expect(
        getHighlightSegments(text, matched)
          .map((s) => s.text)
          .join(''),
      ).toBe(text)
    }
    const engine = await createQuranSearch({ corpus: ['ℹ️\u200d😀'] })
    expect((await engine.search('ℹ', { mode: 'substring' })).total).toBe(0)
    engine.dispose()
  })
  test('multiple/overlapping matches merge without duplicating original text', async () => {
    const result = await hit('الله الله الله', 'الله الله')
    expect(selected('ٱللَّهُ ٱللَّهُ ٱللَّهُ', result)).toEqual([
      'ٱللَّهُ ٱللَّهُ ٱللَّهُ',
    ])
  })
  test('equal word counts cannot validate unrelated letters or reordered words', async () => {
    expect(selected('قال كتب', await hit('قل كتب', 'قل'))).toEqual([])
    const result = await hit('قل قال', 'قل قال')
    expect(getHighlightRanges('قال قل', result)).toEqual({
      ranges: [],
      unresolvedMatches: [0],
    })
  })
  test('ambiguous repeated words are unresolved', async () => {
    const result = await hit('الله الله', 'الله')
    expect(getHighlightRanges('الله', result)).toEqual({
      ranges: [],
      unresolvedMatches: [0, 1],
    })
  })
  test('unambiguous joins/splits use whole display words', async () => {
    expect(selected('أينما تكونوا', await hit('أين ما تكونوا', 'ما'))).toEqual([
      'أينما',
    ])
    expect(
      selected('أين ما تكونوا', await hit('أينما تكونوا', 'أينما')),
    ).toEqual(['أين ما'])
  })
  test('large custom alignments fail conservatively with bounded memory', async () => {
    const text = Array.from({ length: 260 }, (_, i) => `word${i}`).join(' ')
    const result = await hit(text, 'word0')
    expect(
      getHighlightRanges(text.replace('word259', 'different'), result),
    ).toEqual({ ranges: [], unresolvedMatches: [0] })
  })
  test('unmapped words do not prevent safely mapped words being highlighted', async () => {
    const result = await hit('قل كتاب', 'قل كتاب')
    expect(selected('قُلْ مختلف', result)).toEqual(['قُلْ'])
    expect(getHighlightRanges('قُلْ مختلف', result).unresolvedMatches).toEqual([
      0,
    ])
  })
  test('empty text and absent matches reconstruct exactly', async () => {
    const result = await hit('قل', 'قل')
    expect(selected('', result)).toEqual([])
    expect(getHighlightSegments(' \t😀', { ...result, matches: [] })).toEqual([
      { text: ' \t😀', start: 0, end: 4, highlighted: false },
    ])
  })
  test('explicit word maps validate UTF-16/grapheme boundaries and ordering', async () => {
    const result = await hit('قل هو', 'قل هو')
    for (const wordMap of [
      [{ start: 0, end: 1 }],
      [{ start: 0, end: 1 }, null],
      [
        { start: 2, end: 4 },
        { start: 0, end: 2 },
      ],
      [{ start: -1, end: 3 }, null],
    ]) {
      expect(() => getHighlightRanges('😀بِ', result, { wordMap })).toThrow(
        RangeError,
      )
    }
    expect(
      getHighlightRanges('😀بِ', result, {
        wordMap: [{ start: 0, end: 2 }, null],
      }).unresolvedMatches,
    ).toEqual([0])
    expect(() =>
      getHighlightRanges('قل', {
        ...result,
        matches: [{ ...result.matches[0], endWord: 99 }],
      }),
    ).toThrow(RangeError)
  })
  test('custom normalizers must be supplied again for mapping', async () => {
    const normalizer = (text: string) => text.toLowerCase()
    const engine = await createQuranSearch({
      corpus: ['Mercy of GOD'],
      normalizer,
    })
    const result = (await engine.search('god')).hits[0]
    expect(() => getHighlightSegments('Mercy of GOD', result)).toThrow(
      'custom normalizer',
    )
    expect(selected('Mercy of GOD', result, { normalizer })).toEqual(['GOD'])
    engine.dispose()
  })
})
