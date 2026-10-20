import { extractRawText } from 'mammoth'
import { readFileSync } from 'node:fs'
import assert from 'node:assert'
import { resolvePath } from './utils'

/** Extract the Quran from the Word document bundled with the v3.0 font. */
export async function extractHafsV3() {
  const buffer = readFileSync(resolvePath('raw-text/uthmanic-hafs-v3.docx'))
  const { value } = await extractRawText({ buffer })
  const surahHeading = /سُورَةُ .*?\n\n/g
  const unnumberedBasmalah = /بّ?ِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ\n\n/g
  const ayahMarker = /۝[٠-٩]+/g

  assert.equal([...value.matchAll(surahHeading)].length, 114)
  // Keep 1:1 and the basmalah inside 27:30; remove only the 112 headings.
  assert.equal([...value.matchAll(unnumberedBasmalah)].length, 112)
  assert.equal([...value.matchAll(ayahMarker)].length, 6236)
  for (const surah of value.split(surahHeading).slice(1)) {
    const markers = [...surah.matchAll(ayahMarker)]
    markers.forEach(([marker], index) => {
      const number = marker
        .slice(1)
        .replace(/[٠-٩]/g, (digit) =>
          String(digit.charCodeAt(0) - '٠'.charCodeAt(0)),
        )
      assert.equal(Number(number), index + 1)
    })
  }

  const ayat = value
    .replace(surahHeading, '')
    .replace(unnumberedBasmalah, '')
    .split(ayahMarker)
    .map((ayah) => ayah.trim().replace(/[\r\n]+/g, ' '))
    .filter(Boolean)

  assert.equal(ayat.length, 6236)
  assert(ayat.every((ayah) => !/[۝٠-٩]/.test(ayah)))
  return ayat
}
