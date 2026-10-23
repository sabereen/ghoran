/** Optional, data-free verification helpers. The caller supplies the actual file hash. */
import { assertAyahIndex } from './ayah-index'
import type {
  AudioContentManifest,
  AudioSourceId,
  AudioSourceProfile,
  AyahIndex,
} from './types'

export function createAudioContentManifest(
  sourceId: AudioSourceId,
  contentRevision: string,
  hashes: string,
): AudioContentManifest {
  if (hashes.length !== 6236 * 64 || !/^[0-9a-f]+$/.test(hashes))
    throw new TypeError('Invalid original-file SHA-256 manifest')
  return Object.freeze({
    sourceId,
    contentRevision,
    getHash(ayahIndex: AyahIndex) {
      assertAyahIndex(ayahIndex)
      const hash = hashes.slice(ayahIndex * 64, (ayahIndex + 1) * 64)
      return hash === '0'.repeat(64) ? null : hash
    },
  })
}
export function verifyAudioContent(
  manifest: AudioContentManifest,
  ayahIndex: AyahIndex,
  actualSha256: string,
): boolean {
  if (!/^[0-9a-f]{64}$/.test(actualSha256))
    throw new TypeError('Expected lowercase original-file SHA-256')
  return manifest.getHash(ayahIndex) === actualSha256
}
/** Mismatched source revisions, changed bytes, and unavailable gains return null. */
export function getVerifiedAudioGain(
  source: AudioSourceProfile,
  manifest: AudioContentManifest,
  ayahIndex: AyahIndex,
  actualSha256: string,
): number | null {
  if (
    source.id !== manifest.sourceId ||
    source.metadata.contentRevision !== manifest.contentRevision
  )
    return null
  return verifyAudioContent(manifest, ayahIndex, actualSha256)
    ? source.getGain(ayahIndex)
    : null
}
