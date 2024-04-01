import { extractRawText } from 'mammoth'
import { writeFileSync, readFileSync } from 'node:fs'
import assert from 'assert'

const suraNameRegex = /سُورَةُ (.*?)\n\n/gm
const removableBasmalahRegex = /بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ\n\n/gm

export async function extractHafsV13() {
  const content = readFileSync(new URL('../raw-text/uthmanic-hafs-v13.docx', import.meta.url))

  const result = await extractRawText({
    buffer: content,
  })

  let text = result.value

  assert.equal([...text.matchAll(suraNameRegex)].length, 114)
  // assert.equal([...text.matchAll(removableBasmalahRegex)].length, 114 - 2)

  text = text
    .replace(removableBasmalahRegex, '')
    .replace(suraNameRegex, '')

  const ayat = text.trim()
    .split(/[٠-٩]+/g)
    .map(text => text.trim())
    .filter(Boolean)

  assert.equal(ayat.length, 6236)

  writeFileSync('./text/quran-text-hafs-v13.json', JSON.stringify(ayat, null, 2))
}
