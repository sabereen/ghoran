import { normalizeArabic } from '../src/index'

const strict = { profile: 'strict' } as const
const loose = { profile: 'loose' } as const

describe('Arabic normalization', () => {
  test.each([
    ['بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ', 'بسم الله الرحمن الرحيم'],
    ['آ أ إ ٱ ا', 'ا ا ا ا ا'],
    ['ؤ ئ ء ى ة', 'ؤ ئ ء ى ة'],
    ['ی ک ي ك', 'ي ك ي ك'],
    ['\t  قُلْ\n هُوَ\u00a0 ٱللَّهُ ', 'قل هو الله'],
    ['۞ قُلْ ۖ ۗ ۚ ۛ ۜ ۝ ۩', 'قل'],
    ['هُدًى هُدࣰى', 'هدى هدى'],
    ['الرَّحْـمٰن', 'الرحمن'],
    ['', ''],
    ['\u064e\u0651\u0670', ''],
    ['ا\u064e\u0654', 'ا'],
    ['\u0627\u0654 \u0627\u0655', 'ا ا'],
    ['ﻻ ﷲ', 'لا الله'],
  ])('%j → %j', (input, output) => expect(normalizeArabic(input)).toBe(output))

  test('strict preserves hamza, alef forms, maqsura, ta marbuta, Persian letters', () => {
    expect(normalizeArabic('آ أ إ ٱ ؤ ئ ء ى ة ی ک', strict)).toBe(
      'آ أ إ ٱ ؤ ئ ء ى ة ی ک',
    )
    expect(normalizeArabic('ا\u0654', strict)).toBe('أ')
  })
  test('loose explicitly merges meaningful distinctions', () => {
    expect(normalizeArabic('آ أ إ ٱ ؤ ئ ء ى ة', loose)).toBe('ا ا ا ا و ي ي ه')
    expect(normalizeArabic('شيء مدرسة على', loose)).toBe('شي مدرسه علي')
  })
  test('does not erase other scripts’ combining marks or fold unrelated compatibility forms', () => {
    expect(normalizeArabic('é e\u0301 שָ ①')).toBe('é é שָ ①')
    expect(normalizeArabic('گ چ پ ژ')).toBe('گ چ پ ژ')
    expect(normalizeArabic('ب\u0654')).toBe('ب\u0654')
  })
  test('deterministic and idempotent, including unusual combining sequences', () => {
    const cases = [
      'آ أ إ ٱ ؤ ئ ء ى ة ی ک',
      'ا\u064e\u0654',
      '\u0654\u0670ا',
      'ـٰ ﻻ ﷲ ۞',
      'قُرْآنٌ ۖ',
      'é\u0301\u064e',
      '\ud800',
      'ا\u0653\u0654',
    ]
    for (const profile of ['strict', 'standard', 'loose'] as const)
      for (const input of cases) {
        const output = normalizeArabic(input, { profile })
        expect(
          normalizeArabic(output, { profile }),
          `${profile} ${input}`,
        ).toBe(output)
      }
  })
  test('rejects invalid inputs and profiles', () => {
    expect(() => normalizeArabic(null as never)).toThrow(TypeError)
    expect(() => normalizeArabic('a', { profile: 'invalid' as never })).toThrow(
      RangeError,
    )
  })
})
