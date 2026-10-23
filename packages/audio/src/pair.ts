import { assertAyahIndex } from './ayah-index'
import { dbToLinearGain } from './math'
import type { AudioSourceProfile, AyahIndex } from './types'

/** Optional measured levels. Import only the sources used by the application. */
export interface AudioPairSource {
  readonly profile: AudioSourceProfile
  /** BS.1770 integrated loudness under the documented stereo playback convention. */
  getPlaybackLoudness(ayahIndex: AyahIndex): number | null
}

export interface AudioPairTrackGain {
  readonly sourceId: string
  readonly gainDb: number
  readonly gainLinear: number
  readonly additionalCutDb: number
  /** Prediction from reference bytes, quantized to 0.1 LU; not live metering. */
  readonly predictedLufs: number
}

export type AudioPairRecommendation =
  | {
      readonly status: 'ready'
      readonly ayahIndex: AyahIndex
      readonly recitation: AudioPairTrackGain
      readonly translation: AudioPairTrackGain
      readonly differenceLu: number
      readonly matched: boolean
      readonly cutLimited: boolean
      readonly contentVerified: false
    }
  | {
      readonly status: 'unavailable'
      readonly ayahIndex: AyahIndex
      readonly reason: 'unmeasurable'
      readonly recitation: null
      readonly translation: null
      readonly contentVerified: false
    }

/** Match a pair by attenuating its louder clip. No boost, limiter or audio DSP.
 * The quieter clip sets the attainable level; different ayahs can remain quiet/loud.
 * This explicitly changes between-file dynamics, while preserving within-file dynamics.
 */
export function createAudioPair(options: {
  recitation: AudioPairSource
  translation: AudioPairSource
  /** Allowed integrated-level difference. Default 1 LU, not perceptual equality. */
  toleranceLu?: number
  /** Additional attenuation budget, also bounded by each profile's absolute cut limit. */
  maximumAdditionalCutDb?: number
}) {
  const { recitation, translation } = options
  const tolerance = options.toleranceLu ?? 1
  const budget = options.maximumAdditionalCutDb ?? 18
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 6)
    throw new RangeError('toleranceLu must be between 0 and 6')
  if (!Number.isFinite(budget) || budget < 0 || budget > 18)
    throw new RangeError('maximumAdditionalCutDb must be between 0 and 18')
  if (
    recitation.profile.metadata.kind === 'translation' ||
    translation.profile.metadata.kind !== 'translation'
  )
    throw new RangeError('A pair requires a recitation and a translation')
  if (
    recitation.profile.targetLufs !== translation.profile.targetLufs ||
    recitation.profile.snapshotId !== translation.profile.snapshotId
  )
    throw new RangeError('A pair requires the same target and snapshot')

  function getRecommendation(ayahIndex: AyahIndex): AudioPairRecommendation {
    assertAyahIndex(ayahIndex)
    const sources = [recitation, translation] as const
    const gains = sources.map((source) => source.profile.getGainDb(ayahIndex))
    const levels = sources.map((source) =>
      source.getPlaybackLoudness(ayahIndex),
    )
    if (gains.some((v) => v === null) || levels.some((v) => v === null))
      return {
        status: 'unavailable',
        ayahIndex,
        reason: 'unmeasurable',
        recitation: null,
        translation: null,
        contentVerified: false,
      }
    const before = levels.map((level, i) => level! + gains[i]!)
    const louder = before[0]! > before[1]! ? 0 : 1
    const requested = Math.max(0, Math.abs(before[0]! - before[1]!) - tolerance)
    const available = Math.max(
      0,
      Math.min(
        budget,
        gains[louder]! + sources[louder]!.profile.policy.maximumCutDb,
      ),
    )
    const cuts = [0, 0]
    // Round attenuation upward to avoid exceeding the tolerance through rounding.
    cuts[louder] = Math.min(
      available,
      Math.ceil((requested - 1e-9) * 100) / 100,
    )
    const tracks = sources.map((source, i): AudioPairTrackGain => {
      const gainDb = Math.round((gains[i]! - cuts[i]!) * 100) / 100
      return {
        sourceId: source.profile.id,
        gainDb,
        gainLinear: dbToLinearGain(gainDb),
        additionalCutDb: cuts[i]!,
        predictedLufs: levels[i]! + gainDb,
      }
    })
    const differenceLu = tracks[1]!.predictedLufs - tracks[0]!.predictedLufs
    return {
      status: 'ready',
      ayahIndex,
      recitation: tracks[0]!,
      translation: tracks[1]!,
      differenceLu,
      matched: Math.abs(differenceLu) <= tolerance + 1e-8,
      cutLimited: requested > available + 1e-8,
      contentVerified: false,
    }
  }
  return Object.freeze({ getRecommendation })
}

/** Internal: little-endian signed 0.1-LU integers, -32768 means unmeasurable.
 * Read just two bytes from base64 without allocating a decoded array or using Node APIs.
 */
export function createAudioPairSource(
  profile: AudioSourceProfile,
  encoded: string,
): AudioPairSource {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  function byte(offset: number) {
    const position = Math.floor(offset / 3) * 4
    const slot = offset % 3
    const a = alphabet.indexOf(encoded.charAt(position + slot))
    const b = alphabet.indexOf(encoded.charAt(position + slot + 1))
    return (((a << 6) | b) >> (4 - slot * 2)) & 255
  }
  return Object.freeze({
    profile,
    getPlaybackLoudness(index: AyahIndex) {
      assertAyahIndex(index)
      const value = byte(index * 2) | (byte(index * 2 + 1) << 8)
      if (value === 32768) return null
      return (value >= 32768 ? value - 65536 : value) / 10
    },
  })
}
