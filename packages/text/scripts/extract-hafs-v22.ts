/**
 * @packageDocumentation
 * این اسکریپت فایل‌های ورد ارائه شده توسط مرکز ملک فهد را می‌خواند
 * و فایل‌های جیسون برای استفاده در کتابخانه تولید می‌کند.
 */
import { extractRawText } from 'mammoth'
import { writeFileSync, readFileSync } from 'node:fs'
import assert from 'node:assert'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const dirname = fileURLToPath(new URL('./', import.meta.url))

const suraNameRegex = /سُورَةُ (.*?)\n\n/gm
const removableBasmalahRegex =
  /(?:بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ|بِّسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ)\n\n/gm

export async function extractHafsV22() {
  const content = readFileSync(
    resolve(dirname, '../raw-text/uthmanic-hafs-v22.docx'),
  )

  const result = await extractRawText({
    buffer: content,
  })

  let text = result.value

  assert.equal([...text.matchAll(suraNameRegex)].length, 114)
  assert.equal([...text.matchAll(removableBasmalahRegex)].length, 114 - 2)

  text = text.replace(removableBasmalahRegex, '').replace(suraNameRegex, '')

  const ayat = text
    .trim()
    .split(/[٠-٩]+/g)
    .map((text) => text.trim())
    .filter(Boolean)

  assert.equal(ayat.length, 6236)

  writeFileSync(
    resolve(dirname, '../json/quran-text-hafs-v22.json'),
    JSON.stringify(ayat, null, 2),
  )
}
