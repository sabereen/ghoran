/** Optional URL addressing. This module is never imported by gain profiles. */
import { assertAyahIndex } from './ayah-index'
import { surahLengths } from './generated/addressing'
import type { AudioSource, AudioSourceProfile, AyahIndex } from './types'

/** Build a canonical URL without downloading or verifying its content. */
export function getAudioUrl(
  source: AudioSource | AudioSourceProfile,
  ayahIndex: AyahIndex,
): string {
  assertAyahIndex(ayahIndex)
  let surahIndex = 0
  let localIndex = ayahIndex
  while (localIndex >= surahLengths[surahIndex]) {
    localIndex -= surahLengths[surahIndex]
    surahIndex++
  }
  const fileStem = `${String(surahIndex + 1).padStart(3, '0')}${String(localIndex + 1).padStart(3, '0')}`
  const metadata = 'metadata' in source ? source.metadata : source
  return metadata.urlTemplate.replace('{file_stem}', fileStem)
}
