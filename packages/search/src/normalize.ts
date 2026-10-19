export type NormalizationProfile = 'strict' | 'standard' | 'loose'
export interface NormalizeArabicOptions {
  profile?: NormalizationProfile
}

// Explicit Arabic ranges: never erase arbitrary Unicode marks (e.g. Persian
// letters, Hebrew niqqud, or Latin accents). Hamza/madda marks are handled below.
const vocalization =
  /[\u0610-\u061a\u064b-\u0652\u0656-\u065f\u0670\u06d6-\u06ed\u08d3-\u08e1\u08e3-\u08ff]/gu
const annotations = /[\u06dd\u06de\u06e9\u08e2]/gu
const presentation = /[\ufb50-\ufdff\ufe70-\ufefc]/gu

export function validateProfile(
  profile: string,
): asserts profile is NormalizationProfile {
  if (!['strict', 'standard', 'loose'].includes(profile)) {
    throw new RangeError(`Unknown normalization profile: ${profile}`)
  }
}

/** Normalize a copy of Arabic text. Does not perform stemming or transliteration. */
export function normalizeArabic(
  text: string,
  options: NormalizeArabicOptions = {},
): string {
  if (typeof text !== 'string') throw new TypeError('text must be a string')
  const profile = options.profile ?? 'standard'
  validateProfile(profile)
  // Fold only Arabic presentation forms, not all Unicode compatibility characters.
  // QPC glyph encodings occupy these ranges too: never use this on QPC font codes.
  let result = text
    .replace(presentation, (ch) => ch.normalize('NFKC'))
    .normalize('NFC')
  result = result
    .replace(vocalization, '')
    .replace(annotations, '')
    .replace(/ـ/gu, '')
    .normalize('NFC')
  if (profile !== 'strict') {
    result = result
      .replace(/[آأإٱ]/gu, 'ا')
      .replace(/ک/gu, 'ك')
      .replace(/ی/gu, 'ي')
      .replace(/ا[\u0653-\u0655]+/gu, 'ا')
    // Decomposed hamza attached to an alef has been composed by NFC. Standalone
    // hamza and hamza on waw/yeh remain meaningful in the standard profile.
  }
  if (profile === 'loose') {
    result = result
      .replace(/[ؤئ]/gu, (ch) => (ch === 'ؤ' ? 'و' : 'ي'))
      .replace(/[\u0653-\u0655ء]/gu, '')
      .replace(/ى/gu, 'ي')
      .replace(/ة/gu, 'ه')
  }
  return result.replace(/\s+/gu, ' ').trim().normalize('NFC')
}
