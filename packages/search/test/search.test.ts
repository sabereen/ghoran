import { createQuranSearch } from '../src/index'
import type { QuranSearch } from '../src/index'

const corpus = [
  'قُلْ هو الله أحد',
  'الله الله الله',
  'الله هو',
  'بالله',
  'الرحمن الرحيم الرحمن الرحيم',
  'aaaa aaa',
  '😀 أَ',
]
let search: QuranSearch
beforeEach(async () => {
  search = await createQuranSearch({ corpus })
})
afterEach(() => search.dispose())

describe('search modes and contracts', () => {
  test('phrases are ordered consecutive lexical tokens, in Quran order', async () => {
    const result = await search.search('هو الله')
    expect(result.total).toBe(1)
    expect(result.hits[0]).toMatchObject({
      ayahIndex: 0,
      key: '1:1',
      score: 1,
      sourceText: corpus[0],
      matches: [
        {
          startWord: 1,
          endWord: 3,
          normalizedStart: 3,
          normalizedEnd: 10,
          sourceStart: 5,
          sourceEnd: 12,
        },
      ],
    })
    expect(
      (await search.search('الله هو')).hits.map((h) => h.ayahIndex),
    ).toEqual([2])
    expect((await search.search('قل الله')).total).toBe(0)
  })
  test('allWords/anyWord are order independent and duplicate query words are a set', async () => {
    expect(
      (await search.search('الله هو', { mode: 'allWords' })).hits.map(
        (h) => h.ayahIndex,
      ),
    ).toEqual([0, 2])
    expect(
      (await search.search('الله الله', { mode: 'allWords' })).hits.map(
        (h) => h.ayahIndex,
      ),
    ).toEqual([0, 1, 2])
    expect(
      (await search.search('الله الرحيم', { mode: 'anyWord' })).hits.map(
        (h) => h.ayahIndex,
      ),
    ).toEqual([0, 1, 2, 4])
    expect((await search.search('قل الرحيم', { mode: 'allWords' })).total).toBe(
      0,
    )
  })
  test('token boundaries, punctuation, and opt-in substrings', async () => {
    expect((await search.search('الله')).hits.map((h) => h.ayahIndex)).toEqual([
      0, 1, 2,
    ])
    const result = await search.search('الله', { mode: 'substring' })
    expect(result.hits.map((h) => h.ayahIndex)).toEqual([0, 1, 2, 3])
    expect(result.hits[3].matches[0]).toMatchObject({
      startWord: 0,
      sourceStart: 1,
      sourceEnd: 5,
    })
    const punctuation = await createQuranSearch({
      corpus: ['hello, world!', 'helloworld'],
      normalizer: 'none',
    })
    expect((await punctuation.search('hello world')).total).toBe(1)
    punctuation.dispose()
  })
  test('multiple and overlapping matches are retained', async () => {
    expect((await search.search('الرحمن الرحيم')).hits[0].matches).toHaveLength(
      2,
    )
    expect(
      (await search.search('الله الله')).hits[0].matches.map((m) => [
        m.startWord,
        m.endWord,
      ]),
    ).toEqual([
      [0, 2],
      [1, 3],
    ])
    expect(
      (await search.search('aa', { mode: 'substring' })).hits[0].matches,
    ).toHaveLength(5)
  })
  test('pagination counts verses, includes totals, and is stable', async () => {
    const whole = await search.search('الله', { limit: 100 })
    expect(await search.search('الله', { offset: 1, limit: 1 })).toEqual({
      total: 3,
      hits: [whole.hits[1]],
    })
    expect(await search.search('الله', { limit: 0 })).toEqual({
      total: 3,
      hits: [],
    })
    expect(await search.search('الله', { offset: 99 })).toEqual({
      total: 3,
      hits: [],
    })
    expect(await search.search('الله', { limit: 100 })).toEqual(whole)
    expect(structuredClone(whole)).toEqual(whole)
  })
  test.each(['', ' \t\n', '۞ ۝', '.*[a-z]', '😀', '\u064e'])(
    'empty/non-word/regex query %j',
    async (query) => {
      expect(await search.search(query)).toEqual({ total: 0, hits: [] })
    },
  )
  test.each([
    { limit: -1 },
    { offset: 1.5 },
    { limit: Infinity },
    { mode: 'invalid' },
    { normalization: 'bad' },
    { scope: null },
    { scope: '2' },
    { scope: [] },
    { scope: { surahs: null } },
    { scope: { surahs: '2' } },
    { scope: { ayahRange: '0:7' } },
    { scope: { ayahIndices: 0 } },
    { scope: { surahs: [0] } },
    { scope: { surahs: [115] } },
    { scope: { ayahRange: [-1, 2] } },
    { scope: { ayahRange: [3, 2] } },
    { scope: { ayahRange: [0, 6237] } },
    { scope: { ayahRange: [0] } },
    { scope: { ayahIndices: [NaN] } },
    { scope: { ayahIndices: [6236] } },
  ])('rejects invalid options %j even for empty queries', async (options) => {
    await expect(search.search('', options as never)).rejects.toThrow()
  })
  test('rejects invalid queries, disposal and aborted calls', async () => {
    await expect(search.search(null as never)).rejects.toThrow(TypeError)
    const controller = new AbortController()
    controller.abort()
    await expect(
      search.search('الله', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    search.dispose()
    search.dispose()
    await expect(search.search('الله')).rejects.toThrow('disposed')
  })
  test('profiles are separately cached, with canonical equivalence and original offsets', async () => {
    expect((await search.search('احد')).total).toBe(1)
    expect(
      (await search.search('احد', { normalization: 'strict' })).total,
    ).toBe(0)
    expect((await search.search('احد')).total).toBe(1)
    const hit = (await search.search('ا')).hits[0]
    expect(hit.matches[0]).toMatchObject({ sourceStart: 3, sourceEnd: 6 })
  })
})

describe('corpora and scopes', () => {
  test('selected verses retain canonical IDs, sort deterministically, and intersect scopes', async () => {
    const strings = ['الله', 'الله', 'الله']
    const ids = [6235, 7, 0]
    const engine = await createQuranSearch({
      corpus: strings,
      ayahIndices: ids,
    })
    strings[1] = 'mutated'
    ids[1] = 100
    expect(
      (await engine.search('الله')).hits.map((h) => [h.ayahIndex, h.key]),
    ).toEqual([
      [0, '1:1'],
      [7, '2:1'],
      [6235, '114:6'],
    ])
    expect(
      (await engine.search('الله', { scope: { surahs: [2] } })).hits.map(
        (h) => h.ayahIndex,
      ),
    ).toEqual([7])
    expect(
      (
        await engine.search('الله', { scope: { ayahRange: [7, 6235] } })
      ).hits.map((h) => h.ayahIndex),
    ).toEqual([7])
    expect(
      (
        await engine.search('الله', {
          scope: { surahs: [1, 2], ayahIndices: [7, 6235] },
        })
      ).total,
    ).toBe(1)
    for (const scope of [
      { surahs: [] },
      { ayahIndices: [] },
      { ayahRange: [7, 7] as const },
    ]) {
      expect((await engine.search('الله', { scope })).total).toBe(0)
    }
    engine.dispose()
  })
  test('custom/identity normalizers support translation text', async () => {
    const engine = await createQuranSearch({
      corpus: ['Mercy of God', 'mercy of god', 'ی ک'],
      normalizer: 'none',
    })
    expect((await engine.search('Mercy')).total).toBe(1)
    expect((await engine.search('ي ك')).total).toBe(0)
    await expect(
      engine.search('Mercy', { normalization: 'loose' }),
    ).rejects.toThrow('cannot be overridden')
    engine.dispose()
    const lower = await createQuranSearch({
      corpus: ['Mercy of GOD'],
      normalizer: (text) => text.toLowerCase(),
    })
    expect((await lower.search('god')).total).toBe(1)
    lower.dispose()
  })
  test.each([
    { corpus: [1] },
    { corpus: new Array(2) },
    { corpus: ['a'], ayahIndices: [] },
    { corpus: ['a', 'b'], ayahIndices: [0, 0] },
    { corpus: ['a'], ayahIndices: [-1] },
    { corpus: ['a'], ayahIndices: new Array(1) },
    { corpus: 'bad' },
    { corpus: 'hafs', ayahIndices: [0] },
    { normalizer: 3 },
  ])('rejects invalid corpus configuration %j', async (options) => {
    await expect(createQuranSearch(options as never)).rejects.toThrow()
  })
  test('real Quran search and concurrent initialization', async () => {
    const engines = await Promise.all([
      createQuranSearch(),
      createQuranSearch(),
    ])
    const result = await engines[0].search('الرحمن الرحيم', {
      scope: { surahs: [1] },
    })
    expect(result.total).toBe(2)
    expect(result.hits.map((h) => h.key)).toEqual(['1:1', '1:3'])
    expect(
      await engines[1].search('الرحمن الرحيم', { scope: { surahs: [1] } }),
    ).toEqual(result)
    engines.forEach((engine) => engine.dispose())
  })
  test.each([
    'hafs',
    'hafs-v13',
    'hafs-v3',
    'imla',
    'tanzil-simple-min',
    'qpc-v1',
    'qpc-v2',
  ] as const)('selected corpus %s', async (corpus) => {
    const engine = await createQuranSearch({ corpus })
    expect(
      (await engine.search('الرحيم', { scope: { surahs: [1] } })).total,
    ).toBe(2)
    engine.dispose()
  })
})
