import type { QuranTextType } from '@ghoran/text'
import type { NormalizationProfile } from './normalize'
import type { Normalizer } from './tokenize'

export type SearchMode = 'phrase' | 'allWords' | 'anyWord' | 'substring'
export interface SearchScope {
  /** Public 1-based surah numbers. Combined scope fields intersect. */
  surahs?: readonly number[]
  /** Zero-based, half-open canonical ayah range. */
  ayahRange?: readonly [start: number, end: number]
  ayahIndices?: readonly number[]
}
export interface SearchSignal {
  readonly aborted: boolean
  addEventListener(
    type: 'abort',
    listener: () => void,
    options?: { once?: boolean },
  ): void
  removeEventListener(type: 'abort', listener: () => void): void
}
export interface SearchOptions {
  mode?: SearchMode
  normalization?: NormalizationProfile
  scope?: SearchScope
  limit?: number
  offset?: number
  signal?: SearchSignal
}
export interface SearchMatch {
  /** Lexical token indices after normalization: zero-based, half-open. */
  startWord: number
  endWord: number
  /** UTF-16 offsets into tokenized normalized text (tokens joined by one space). */
  normalizedStart: number
  normalizedEnd: number
  /** UTF-16 offsets into sourceText, expanded to full graphemes. */
  sourceStart: number
  sourceEnd: number
}
export interface SearchHit {
  ayahIndex: number
  key: string
  /** Number of occurrences. Ordering is always canonical Quran order. */
  score: number
  sourceText: string
  normalization: NormalizationProfile | 'custom' | 'none'
  matches: SearchMatch[]
}
export interface SearchResponse {
  total: number
  hits: SearchHit[]
}
export interface QuranSearchOptions {
  /** QPC uses tanzil-simple-clean as its semantic companion. */
  corpus?: QuranTextType | readonly string[]
  /** For selected custom verses. Unique canonical IDs, one per supplied string. */
  ayahIndices?: readonly number[]
  normalization?: NormalizationProfile
  /** 'none' preserves translation letters/case; functions are direct-mode only. */
  normalizer?: Normalizer | 'none'
}
export interface QuranSearch {
  readonly execution: 'direct' | 'worker'
  search(query: string, options?: SearchOptions): Promise<SearchResponse>
  dispose(): void
}
