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
// emoji). Use native graphemes for those unusual strings when available; older
// runtimes keep the lexical scan and use conservative whole-word positions.
function* rawWords(text: string): Generator<{ text: string; start: number }> {
  const parts = /[\u200c\u200d]/u.test(text) ? graphemes(text) : undefined
  if (!parts) {
    for (const match of text.matchAll(
      /[\p{L}\p{N}\u0640][\p{L}\p{N}\p{M}\u0640\u200c\u200d]*/gu,
    )) {
      yield { text: match[0], start: match.index! }
    }
    return
  }
  let start = -1,
    word = ''
  for (const part of parts) {
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
export function graphemes(text: string): Intl.Segments | undefined {
  // Progressive enhancement, not a runtime requirement. Check even when a native
  // instance was cached: capability belongs to the current execution environment.
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function')
    return
  segmenter ??= new Intl.Segmenter('ar', { granularity: 'grapheme' })
  return segmenter.segment(text)
}

/** Map only when per-grapheme normalization reproduces the whole token exactly.
 * Otherwise the caller must highlight the complete word. Includes all marks and
 * surrogate pairs in each selected grapheme. Without native segmentation, return
 * no character range so callers use the existing whole-word fallback.
 */
export function characterRange(
  text: string,
  token: Token,
  start: number,
  end: number,
  normalize: Normalizer,
): { start: number; end: number } | undefined {
  const original = text.slice(token.start, token.end)
  const parts = graphemes(original)
  if (!parts) return
  let value = ''
  const units: { start: number; end: number; from: number; to: number }[] = []
  for (const grapheme of parts) {
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
