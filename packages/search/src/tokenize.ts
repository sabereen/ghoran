export interface Token {
  value: string
  start: number
  end: number
  normalizedStart: number
  normalizedEnd: number
}
export type Normalizer = (text: string) => string
export interface PreparedText {
  text: string
  tokens: Token[]
}

// Join controls can attach a lexical character to a larger grapheme (including
// emoji). Take the grapheme path only for those unusual strings; Quran corpora
// use the fast lexical scan. Never create a token ending inside a ZWJ cluster.
function* rawWords(text: string): Generator<{ text: string; start: number }> {
  if (!/[\u200c\u200d]/u.test(text)) {
    for (const match of text.matchAll(
      /[\p{L}\p{N}\u0640][\p{L}\p{N}\p{M}\u0640]*/gu,
    )) {
      yield { text: match[0], start: match.index! }
    }
    return
  }
  let start = -1,
    word = ''
  for (const part of graphemes(text)) {
    if (
      /^[\p{L}\p{N}\p{M}\u0640\u200c\u200d]+$/u.test(part.segment) &&
      (start >= 0 || /[\p{L}\p{N}]/u.test(part.segment))
    ) {
      if (start < 0) start = part.index
      word += part.segment
    } else if (start >= 0) {
      yield { text: word, start }
      start = -1
      word = ''
    }
  }
  if (start >= 0) yield { text: word, start }
}

/** Lexical words, not space-separated font glyphs or standalone Quran marks. */
export function prepareText(text: string, normalize: Normalizer): PreparedText {
  const tokens: Token[] = []
  let normalized = ''
  for (const raw of rawWords(text)) {
    const value = normalize(raw.text)
    if (typeof value !== 'string')
      throw new TypeError('normalizer must return a string')
    // A custom normalizer may expand one original token into several tokens.
    for (const part of value.matchAll(
      /[\p{L}\p{N}][\p{L}\p{N}\p{M}\u200c\u200d]*/gu,
    )) {
      if (!/[\p{L}\p{N}]/u.test(part[0])) continue
      if (normalized) normalized += ' '
      const start = normalized.length
      normalized += part[0]
      tokens.push({
        value: part[0],
        start: raw.start,
        end: raw.start + raw.text.length,
        normalizedStart: start,
        normalizedEnd: normalized.length,
      })
    }
  }
  return { text: normalized, tokens }
}

let segmenter: Intl.Segmenter | undefined
export function graphemes(text: string): Intl.Segments {
  segmenter ??= new Intl.Segmenter('ar', { granularity: 'grapheme' })
  return segmenter.segment(text)
}

/** Map only when per-grapheme normalization reproduces the whole token exactly.
 * Otherwise the caller must highlight the complete word. Includes all marks and
 * surrogate pairs in each selected grapheme. No offsets into detached marks.
 */
export function characterRange(
  text: string,
  token: Token,
  start: number,
  end: number,
  normalize: Normalizer,
): { start: number; end: number } | undefined {
  const original = text.slice(token.start, token.end)
  let value = ''
  const units: { start: number; end: number; from: number; to: number }[] = []
  for (const grapheme of graphemes(original)) {
    const part = normalize(grapheme.segment)
    const from = value.length
    value += part
    units.push({
      start: token.start + grapheme.index,
      end: token.start + grapheme.index + grapheme.segment.length,
      from,
      to: value.length,
    })
  }
  if (value !== token.value || start < 0 || end > value.length || start >= end)
    return
  const selected = units.filter((unit) => unit.to > start && unit.from < end)
  if (!selected.length) return
  return { start: selected[0].start, end: selected[selected.length - 1].end }
}
