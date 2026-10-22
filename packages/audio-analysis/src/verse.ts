import { surahLengths } from './generated/dataset'
import type { AudioVerse } from './types'
const starts: readonly number[] = /* @__PURE__ */ (() => {
  const offsets = [0]
  for (const count of surahLengths)
    offsets.push(offsets[offsets.length - 1] + count)
  return offsets
})()

export function toAudioVerseOrdinal(verse: AudioVerse): number {
  if (typeof verse === 'number') {
    if (!Number.isInteger(verse) || verse < 1 || verse > 6236)
      throw new RangeError(
        'Audio verse ordinal must be an integer from 1 to 6236',
      )
    return verse
  }
  let surah: number, ayah: number
  if (typeof verse === 'string') {
    const match = /^([1-9]\d{0,2}):([1-9]\d{0,2})$/.exec(verse)
    if (!match)
      throw new RangeError(
        'Audio verse key must be surah:ayah, for example 2:255',
      )
    surah = Number(match[1])
    ayah = Number(match[2])
  } else if (verse && typeof verse === 'object') {
    surah = verse.surah
    ayah = verse.ayah
  } else throw new TypeError('Invalid audio verse')
  if (
    !Number.isInteger(surah) ||
    surah < 1 ||
    surah > 114 ||
    !Number.isInteger(ayah) ||
    ayah < 1 ||
    ayah > surahLengths[surah - 1]
  )
    throw new RangeError('Audio verse address is outside the Quran')
  return starts[surah - 1] + ayah
}

export function getAudioVerse(verse: AudioVerse) {
  const ordinal = toAudioVerseOrdinal(verse)
  let surah = 1
  while (ordinal > starts[surah]) surah++
  const ayah = ordinal - starts[surah - 1]
  return {
    ordinal,
    surah,
    ayah,
    verseId: `${surah}:${ayah}`,
    fileStem: `${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}`,
  }
}
