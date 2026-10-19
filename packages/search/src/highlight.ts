import { normalizeArabic } from './normalize'
import {
  characterRange,
  graphemes,
  prepareText,
  type Normalizer,
  type Token,
} from './tokenize'
import type { SearchHit } from './types'

export interface HighlightRange {
  start: number
  end: number
  accuracy: 'exact' | 'word'
}
export interface HighlightMapping {
  ranges: HighlightRange[]
  /** Match indices for which at least one source word could not be mapped. */
  unresolvedMatches: number[]
}
export interface HighlightSegment {
  text: string
  start: number
  end: number
  highlighted: boolean
}
export interface HighlightOptions {
  /** Required for hits produced with a custom normalizer. */
  normalizer?: Normalizer
  /** Trusted, explicit source-token → display UTF-16 ranges. Required for QPC.
   * null means unknown. Multiple source words may map to the same display word.
   * These are assertions supplied by the caller, not inferred from glyph counts.
   */
  wordMap?: readonly ({ start: number; end: number } | null)[]
}

// Limited documented Uthmanic spelling alternatives. No fuzzy similarity or
// letter-count comparison: e.g. قال and قل must never become equivalent.
function forms(text: string, n: Normalizer, arabic: boolean): Set<string> {
  if (!arabic) return new Set([n(text)])
  const expanded = text
    .replace(/و[\u064b-\u0652]*ٰ/gu, 'ا')
    .replace(/ى[\u064b-\u0652]*ٰ/gu, 'ا')
    .replace(/ٰ/gu, 'ا')
  // Quranic ءَا and precomposed آ are alternate spellings of the same sequence.
  const madda = (value: string) => value.replace(/ء[\u064b-\u0652]*ا/gu, 'آ')
  return new Set([n(text), n(expanded), n(madda(text)), n(madda(expanded))])
}
function intersects(left: Set<string>, right: Set<string>): boolean {
  return [...left].some((value) => right.has(value))
}
interface Link {
  from: number
  to: number
}

/** Sequence alignment with insertions/deletions and exact spelling equivalences.
 * A mapping is accepted only if ALL minimum-cost paths give the same destination
 * and none can omit that source word. Repeated ambiguous words remain unresolved.
 * Joins/splits are limited to three tokens; unsupported cases fail conservatively.
 */
function align(
  source: string,
  a: Token[],
  target: string,
  b: Token[],
  normalize: Normalizer,
  arabic: boolean,
): (Link | undefined)[] {
  const n = a.length,
    m = b.length,
    width = m + 1
  const alternatives = (text: string, tokens: Token[]) =>
    tokens.map((_, i) =>
      [1, 2, 3].map((size) =>
        forms(
          tokens
            .slice(i, i + size)
            .map((t) => text.slice(t.start, t.end))
            .join(''),
          normalize,
          arabic,
        ),
      ),
    )
  const leftForms = alternatives(source, a),
    rightForms = alternatives(target, b)
  if (
    n === m &&
    a.every((_, i) => intersects(leftForms[i][0], rightForms[i][0]))
  ) {
    return a.map((_, i) => ({ from: i, to: i + 1 }))
  }
  // Quran verses fit comfortably. Bound memory for unusually large custom texts.
  if ((n + 1) * width > 65_536) return a.map(() => undefined)
  type Edge = { i: number; j: number; cost: number; match: boolean }
  const edges = (i: number, j: number): Edge[] => {
    const result: Edge[] = []
    if (i < n) result.push({ i: i + 1, j, cost: 4, match: false })
    if (j < m) result.push({ i, j: j + 1, cost: 4, match: false })
    for (let x = 1; x <= 3 && i + x <= n; x++) {
      for (let y = 1; y <= 3 && j + y <= m; y++) {
        if (x > 1 && y > 1) continue
        if (intersects(leftForms[i][x - 1], rightForms[j][y - 1]))
          result.push({ i: i + x, j: j + y, cost: x + y - 2, match: true })
      }
    }
    return result
  }
  // Compute edges once: normalization is more expensive than the tiny DP tables.
  const graph = Array.from({ length: (n + 1) * width }, (_, k) =>
    edges(Math.floor(k / width), k % width),
  )
  const forward = new Float64Array(graph.length).fill(Infinity)
  const backward = new Float64Array(graph.length).fill(Infinity)
  forward[0] = 0
  backward[graph.length - 1] = 0
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= m; j++) {
      const k = i * width + j
      for (const edge of graph[k]) {
        const next = edge.i * width + edge.j
        forward[next] = Math.min(forward[next], forward[k] + edge.cost)
      }
    }
  for (let i = n; i >= 0; i--)
    for (let j = m; j >= 0; j--) {
      const k = i * width + j
      for (const edge of graph[k])
        backward[k] = Math.min(
          backward[k],
          edge.cost + backward[edge.i * width + edge.j],
        )
    }
  const candidates = Array.from({ length: n }, () => new Map<string, Link>())
  const omitted = new Set<number>()
  const best = forward[graph.length - 1]
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= m; j++) {
      const k = i * width + j
      for (const edge of graph[k]) {
        if (forward[k] + edge.cost + backward[edge.i * width + edge.j] !== best)
          continue
        for (let s = i; s < edge.i; s++) {
          if (edge.match)
            candidates[s].set(`${j}:${edge.j}`, { from: j, to: edge.j })
          else omitted.add(s)
        }
      }
    }
  return candidates.map((choices, i) =>
    !omitted.has(i) && choices.size === 1
      ? [...choices.values()][0]
      : undefined,
  )
}

function mergeRanges(text: string, ranges: HighlightRange[]): HighlightRange[] {
  ranges.sort((a, b) => a.start - b.start || a.end - b.end)
  const result: HighlightRange[] = []
  for (const range of ranges) {
    const last = result[result.length - 1]
    if (
      last &&
      (range.start <= last.end ||
        /^\s*$/u.test(text.slice(last.end, range.start)))
    ) {
      last.end = Math.max(last.end, range.end)
      if (range.accuracy === 'word') last.accuracy = 'word'
    } else result.push({ ...range })
  }
  return result
}

/** Map a serializable hit onto original display text. Never modifies either text. */
export function getHighlightRanges(
  displayText: string,
  hit: SearchHit,
  options: HighlightOptions = {},
): HighlightMapping {
  if (typeof displayText !== 'string')
    throw new TypeError('displayText must be a string')
  if (hit.normalization === 'custom' && !options.normalizer)
    throw new TypeError("Supply the hit's custom normalizer")
  const normalize: Normalizer =
    options.normalizer ??
    (hit.normalization === 'none'
      ? (text) => text
      : (text) =>
          normalizeArabic(text, { profile: hit.normalization as 'standard' }))
  if (!hit.matches.length) return { ranges: [], unresolvedMatches: [] }
  const source = prepareText(hit.sourceText, normalize)
  const ranges: HighlightRange[] = [],
    unresolvedMatches: number[] = []
  const parts = graphemes(displayText)
  const boundaries = parts
    ? new Set<number>([0, displayText.length])
    : undefined
  if (parts) for (const part of parts) boundaries!.add(part.index)
  // Without native graphemes, trusted maps still validate bounds/order and must
  // not split surrogate pairs. Full grapheme validation is an enhancement.
  const validBoundary = (index: number) =>
    boundaries
      ? boundaries.has(index)
      : !(
          index > 0 &&
          index < displayText.length &&
          /[\ud800-\udbff]/u.test(displayText[index - 1]) &&
          /[\udc00-\udfff]/u.test(displayText[index])
        )
  const validRange = (start: number, end: number) =>
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 0 &&
    end > start &&
    end <= displayText.length &&
    validBoundary(start) &&
    validBoundary(end)
  if (options.wordMap) {
    if (options.wordMap.length !== source.tokens.length)
      throw new RangeError('wordMap must cover every source token')
    let previous = -1
    for (const range of options.wordMap)
      if (range) {
        if (!validRange(range.start, range.end) || range.start < previous)
          throw new RangeError('Invalid or unordered wordMap range')
        previous = range.start
      }
  }
  // QPC is page/font-specific. Unicode compatibility decomposition would turn
  // glyph codes into unrelated Arabic ligatures. Never infer its correspondence.
  const encoded = /[\ufb50-\ufdff\ufe70-\ufefc\ue000-\uf8ff]/u.test(displayText)
  const target =
    !encoded && displayText !== hit.sourceText
      ? prepareText(displayText, normalize)
      : undefined
  const links =
    target &&
    align(
      hit.sourceText,
      source.tokens,
      displayText,
      target.tokens,
      hit.normalization === 'custom' || hit.normalization === 'none'
        ? normalize
        : normalizeArabic,
      hit.normalization !== 'custom' && hit.normalization !== 'none',
    )
  hit.matches.forEach((match, matchIndex) => {
    if (
      !Number.isInteger(match.startWord) ||
      !Number.isInteger(match.endWord) ||
      match.startWord < 0 ||
      match.endWord <= match.startWord ||
      match.endWord > source.tokens.length ||
      !Number.isInteger(match.normalizedStart) ||
      !Number.isInteger(match.normalizedEnd) ||
      match.normalizedStart < source.tokens[match.startWord].normalizedStart ||
      match.normalizedEnd > source.tokens[match.endWord - 1].normalizedEnd ||
      match.normalizedStart >= match.normalizedEnd
    ) {
      throw new RangeError('Invalid match range')
    }
    let unresolved = false
    for (let i = match.startWord; i < match.endWord; i++) {
      const token = source.tokens[i]
      const start = Math.max(0, match.normalizedStart - token.normalizedStart)
      const end = Math.min(
        token.value.length,
        match.normalizedEnd - token.normalizedStart,
      )
      if (options.wordMap) {
        const range = options.wordMap[i]
        if (range) ranges.push({ ...range, accuracy: 'word' })
        else unresolved = true
      } else if (displayText === hit.sourceText) {
        const range = characterRange(displayText, token, start, end, normalize)
        ranges.push({
          start: range?.start ?? token.start,
          end: range?.end ?? token.end,
          accuracy: range ? 'exact' : 'word',
        })
      } else {
        const link = links?.[i]
        if (!link || !target) {
          unresolved = true
          continue
        }
        const first = target.tokens[link.from],
          last = target.tokens[link.to - 1]
        const range =
          link.to === link.from + 1 && first.value === token.value
            ? characterRange(displayText, first, start, end, normalize)
            : undefined
        ranges.push({
          start: range?.start ?? first.start,
          end: range?.end ?? last.end,
          accuracy: range ? 'exact' : 'word',
        })
      }
    }
    if (unresolved) unresolvedMatches.push(matchIndex)
  })
  return { ranges: mergeRanges(displayText, ranges), unresolvedMatches }
}

/** Renderer-independent segments. Concatenation always reconstructs displayText. */
export function getHighlightSegments(
  displayText: string,
  hit: SearchHit,
  options: HighlightOptions = {},
): HighlightSegment[] {
  const { ranges } = getHighlightRanges(displayText, hit, options)
  const segments: HighlightSegment[] = []
  let cursor = 0
  for (const range of ranges) {
    if (range.start > cursor)
      segments.push({
        text: displayText.slice(cursor, range.start),
        start: cursor,
        end: range.start,
        highlighted: false,
      })
    segments.push({
      text: displayText.slice(range.start, range.end),
      start: range.start,
      end: range.end,
      highlighted: true,
    })
    cursor = range.end
  }
  if (cursor < displayText.length)
    segments.push({
      text: displayText.slice(cursor),
      start: cursor,
      end: displayText.length,
      highlighted: false,
    })
  return segments
}
