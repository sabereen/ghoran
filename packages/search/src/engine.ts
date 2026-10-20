import { surahList } from '@ghoran/metadata'
import type { QuranTextType } from '@ghoran/text'
import {
  normalizeArabic,
  validateProfile,
  type NormalizationProfile,
} from './normalize'
import {
  characterRange,
  prepareText,
  type Normalizer,
  type PreparedText,
} from './tokenize'
import type {
  QuranSearch,
  QuranSearchOptions,
  SearchHit,
  SearchMatch,
  SearchOptions,
  SearchScope,
} from './types'

const editions: QuranTextType[] = [
  'tanzil-simple-clean',
  'tanzil-simple-min',
  'imla',
  'hafs',
  'hafs-v13',
  'hafs-v3',
  'qpc-v1',
  'qpc-v2',
]
const identities = surahList.flatMap(([start, count], surah) =>
  Array.from({ length: count }, (_, index) => ({
    key: `${surah + 1}:${index + 1}`,
    surah: surah + 1,
    index: start + index,
  })),
)

export function integer(value: number, name: string, max: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > max)
    throw new RangeError(`Invalid ${name}`)
}
export function abortError(): Error {
  const error = new Error('Search aborted')
  error.name = 'AbortError'
  return error
}
export function checkSignal(options: SearchOptions): void {
  if (options.signal?.aborted) throw abortError()
}
function scopeFilter(scope: SearchScope = {}): (index: number) => boolean {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    throw new TypeError('scope must be an object')
  }
  for (const field of ['surahs', 'ayahIndices', 'ayahRange'] as const) {
    if (scope[field] !== undefined && !Array.isArray(scope[field])) {
      throw new TypeError(`scope.${field} must be an array`)
    }
  }
  for (const n of scope.surahs ?? []) {
    integer(n, 'surah', 114)
    if (!n) throw new RangeError('Invalid surah')
  }
  for (const n of scope.ayahIndices ?? []) integer(n, 'ayahIndex', 6235)
  if (scope.ayahRange) {
    if (scope.ayahRange.length !== 2) throw new RangeError('Invalid ayahRange')
    const [start, end] = scope.ayahRange
    integer(start, 'ayahRange start', 6236)
    integer(end, 'ayahRange end', 6236)
    if (end < start) throw new RangeError('Reversed ayahRange')
  }
  const surahs = scope.surahs && new Set(scope.surahs)
  const indices = scope.ayahIndices && new Set(scope.ayahIndices)
  return (index) =>
    (!surahs || surahs.has(identities[index].surah)) &&
    (!indices || indices.has(index)) &&
    (!scope.ayahRange ||
      (index >= scope.ayahRange[0] && index < scope.ayahRange[1]))
}

/** Lazily import the existing text package. No Quran data is copied into search. */
export async function createQuranSearch(
  options: QuranSearchOptions = {},
): Promise<QuranSearch> {
  const profile = options.normalization ?? 'standard'
  validateProfile(profile)
  if (
    options.normalizer !== undefined &&
    options.normalizer !== 'none' &&
    typeof options.normalizer !== 'function'
  ) {
    throw new TypeError('Invalid normalizer')
  }
  const corpus = options.corpus ?? 'tanzil-simple-clean'
  let strings: readonly string[]
  if (typeof corpus === 'string') {
    if (!editions.includes(corpus)) throw new RangeError('Unknown corpus')
    if (options.ayahIndices)
      throw new TypeError('ayahIndices requires a custom corpus')
    const { importText } = await import('@ghoran/text')
    strings = (
      await importText(
        corpus.startsWith('qpc-') ? 'tanzil-simple-clean' : corpus,
      )
    ).default
  } else strings = corpus
  if (
    !Array.isArray(strings) ||
    strings.length > 6236 ||
    !Array.from(strings).every((text) => typeof text === 'string')
  ) {
    throw new TypeError(
      'corpus must contain at most 6236 verse-aligned strings',
    )
  }
  const ids = options.ayahIndices ?? strings.map((_, index) => index)
  if (ids.length !== strings.length || new Set(ids).size !== ids.length)
    throw new RangeError('Invalid corpus ayahIndices')
  Array.from(ids).forEach((id) => integer(id, 'corpus ayahIndex', 6235))
  // Own the strings/IDs and caches. Consumers may mutate their input arrays later.
  let entries = strings
    .map((text, i) => ({ text, index: ids[i] }))
    .sort((a, b) => a.index - b.index)
  const caches = new Map<string, PreparedText[]>()
  const custom = options.normalizer
  const normalizeFor = (p: NormalizationProfile): Normalizer =>
    typeof custom === 'function'
      ? custom
      : custom === 'none'
        ? (text) => text
        : (text) => normalizeArabic(text, { profile: p })
  const prepare = (p: NormalizationProfile) => {
    const key = custom ? 'custom' : p
    let prepared = caches.get(key)
    if (!prepared) {
      prepared = entries.map((entry) =>
        prepareText(entry.text, normalizeFor(p)),
      )
      caches.set(key, prepared)
    }
    return prepared
  }
  prepare(profile)
  let disposed = false
  return {
    execution: 'direct',
    async search(query, searchOptions = {}) {
      if (disposed) throw new Error('Search disposed')
      if (typeof query !== 'string')
        throw new TypeError('query must be a string')
      checkSignal(searchOptions)
      const mode = searchOptions.mode ?? 'phrase'
      if (!['phrase', 'allWords', 'anyWord', 'substring'].includes(mode))
        throw new RangeError('Unknown search mode')
      const p = searchOptions.normalization ?? profile
      validateProfile(p)
      if (custom && searchOptions.normalization !== undefined)
        throw new TypeError(
          'Custom normalizer cannot be overridden by a profile',
        )
      const limit = searchOptions.limit ?? 20,
        offset = searchOptions.offset ?? 0
      integer(limit, 'limit', Number.MAX_SAFE_INTEGER)
      integer(offset, 'offset', Number.MAX_SAFE_INTEGER)
      const accepts = scopeFilter(searchOptions.scope)
      const normalize = normalizeFor(p)
      const needle = prepareText(query, normalize)
      if (!needle.tokens.length) return { total: 0, hits: [] }
      const words = needle.tokens.map((token) => token.value)
      const unique = new Set(words)
      const prepared = prepare(p)
      const hits: SearchHit[] = []
      let total = 0
      for (let v = 0; v < entries.length; v++) {
        const entry = entries[v]
        if (!accepts(entry.index)) continue
        const verse = prepared[v],
          tokens = verse.tokens
        const positions: [number, number, number, number][] = []
        if (mode === 'phrase') {
          for (let i = 0; i <= tokens.length - words.length; i++) {
            if (words.every((word, j) => tokens[i + j].value === word)) {
              positions.push([
                i,
                i + words.length,
                tokens[i].normalizedStart,
                tokens[i + words.length - 1].normalizedEnd,
              ])
            }
          }
        } else if (mode === 'substring') {
          let from = 0,
            at: number
          while ((at = verse.text.indexOf(needle.text, from)) !== -1) {
            const end = at + needle.text.length
            const startWord = tokens.findIndex(
              (token) => token.normalizedEnd > at,
            )
            let endWord = startWord + 1
            while (
              endWord < tokens.length &&
              tokens[endWord].normalizedStart < end
            )
              endWord++
            positions.push([startWord, endWord, at, end])
            from = at + 1 // Deliberately retain overlapping occurrences.
          }
        } else {
          const found = new Set<string>()
          tokens.forEach((token, i) => {
            if (unique.has(token.value)) {
              found.add(token.value)
              positions.push([
                i,
                i + 1,
                token.normalizedStart,
                token.normalizedEnd,
              ])
            }
          })
          if (mode === 'allWords' && found.size !== unique.size)
            positions.length = 0
        }
        if (!positions.length) continue
        const rank = total++
        if (rank < offset || hits.length >= limit) continue
        const matches: SearchMatch[] = positions.map(
          ([startWord, endWord, normalizedStart, normalizedEnd]) => {
            const first = tokens[startWord],
              last = tokens[endWord - 1]
            const startRange = characterRange(
              entry.text,
              first,
              normalizedStart - first.normalizedStart,
              Math.min(
                first.value.length,
                normalizedEnd - first.normalizedStart,
              ),
              normalize,
            )
            const endRange = characterRange(
              entry.text,
              last,
              Math.max(0, normalizedStart - last.normalizedStart),
              normalizedEnd - last.normalizedStart,
              normalize,
            )
            return {
              startWord,
              endWord,
              normalizedStart,
              normalizedEnd,
              sourceStart: startRange?.start ?? first.start,
              sourceEnd: endRange?.end ?? last.end,
            }
          },
        )
        hits.push({
          ayahIndex: entry.index,
          key: identities[entry.index].key,
          score: matches.length,
          sourceText: entry.text,
          normalization: custom === 'none' ? 'none' : custom ? 'custom' : p,
          matches,
        })
      }
      checkSignal(searchOptions)
      return { total, hits }
    },
    dispose() {
      disposed = true
      entries = []
      caches.clear()
    },
  }
}
