import { snapshotInfo } from './generated/dataset'
import { dbToLinearGain } from './math'
import { getAudioVerse, toAudioVerseOrdinal } from './verse'
import type {
  AudioGainPolicyInfo,
  AudioNormalizer,
  AudioRecommendation,
  AudioSource,
  AudioSourceId,
  AudioSourcePolicyData,
  AudioSourceProfile,
  AudioUnavailableReason,
  AudioVerse,
} from './types'

export const audioDataset = /* @__PURE__ */ Object.freeze(snapshotInfo)

/** Data-free source adapter; construction does not download/decode/analyze audio. */
export function createAudioSource<Id extends AudioSourceId>(
  metadata: AudioSource & { readonly id: Id },
  data: AudioSourcePolicyData,
): AudioSourceProfile<Id> {
  const source = Object.freeze({ ...metadata })
  const base = data.base === null ? null : data.base / 100
  const baseLinear = base === null ? null : dbToLinearGain(base)
  // Allocated only for a source that is actually queried, never for barrel imports.
  let overrides: Map<number, readonly [number, boolean, number]> | undefined
  let unavailable: Map<number, AudioUnavailableReason> | undefined
  const policy: AudioGainPolicyInfo = Object.freeze({
    targetLufs: data.targetLufs,
    truePeakCeilingDbtp: snapshotInfo.truePeakCeilingDbtp,
    truePeakMarginDb: snapshotInfo.truePeakMarginDb,
    maximumBoostDb: snapshotInfo.maximumBoostDb,
    maximumCutDb: snapshotInfo.maximumCutDb,
    quantizationDb: 0.01,
    inferredCorrectionsApplied: false,
  })
  function prepare() {
    if (!overrides) {
      overrides = new Map(
        data.overrides.map(([ordinal, gain, peak]) => [
          ordinal,
          [gain / 100, peak, dbToLinearGain(gain / 100)] as const,
        ]),
      )
      unavailable = new Map(data.unavailable)
    }
  }
  function getGainDb(verse: AudioVerse): number | null {
    const ordinal = toAudioVerseOrdinal(verse)
    prepare()
    if (unavailable!.has(ordinal)) return null
    return overrides!.get(ordinal)?.[0] ?? base
  }
  function getGain(verse: AudioVerse): number | null {
    const ordinal = toAudioVerseOrdinal(verse)
    prepare()
    if (unavailable!.has(ordinal)) return null
    return overrides!.get(ordinal)?.[2] ?? baseLinear
  }
  return Object.freeze({
    id: metadata.id,
    metadata: source,
    targetLufs: data.targetLufs,
    snapshotId: snapshotInfo.snapshotId,
    policy,
    getGainDb,
    getGain,
    getUrl(verse: AudioVerse) {
      return source.urlTemplate.replace(
        '{file_stem}',
        getAudioVerse(verse).fileStem,
      )
    },
    getRecommendation(verse: AudioVerse): AudioRecommendation {
      const address = getAudioVerse(verse),
        gainDb = getGainDb(address.ordinal)
      const common = {
        sourceId: source.id,
        ordinal: address.ordinal,
        verseId: address.verseId,
        targetLufs: data.targetLufs,
        snapshotId: snapshotInfo.snapshotId,
        contentRevision: source.contentRevision,
        contentVerified: false as const,
        baseGainDb: base,
        peakLimited: overrides!.get(address.ordinal)?.[1] ?? false,
        provisional: !source.inventoryComplete,
      }
      return gainDb === null
        ? {
            ...common,
            status: 'unavailable',
            reason: unavailable!.get(address.ordinal) ?? 'unmeasurable',
            gainDb: null,
            gainLinear: null,
          }
        : {
            ...common,
            status: 'ready',
            reason: null,
            gainDb,
            gainLinear: getGain(address.ordinal)!,
          }
    },
  })
}

/** Register only imported sources. A mixed-target registry is rejected. */
export function createAudioNormalizer<
  const T extends readonly AudioSourceProfile[],
>(options: { sources: T }): AudioNormalizer<T[number]['id']> {
  if (!options.sources.length)
    throw new RangeError('At least one audio source is required')
  const targetLufs = options.sources[0].targetLufs
  const sources = new Map<AudioSourceId, AudioSourceProfile>()
  for (const source of options.sources) {
    if (
      source.targetLufs !== targetLufs ||
      source.snapshotId !== snapshotInfo.snapshotId
    )
      throw new RangeError(
        'All sources must use the same target and dataset snapshot',
      )
    if (sources.has(source.id))
      throw new RangeError('Duplicate audio source: ' + source.id)
    sources.set(source.id, source)
  }
  function lookup(id: T[number]['id']) {
    const source = sources.get(id)
    if (!source) throw new RangeError('Audio source was not registered: ' + id)
    return source
  }
  return Object.freeze({
    targetLufs,
    snapshotId: snapshotInfo.snapshotId,
    getGain: (id: T[number]['id'], verse: AudioVerse) =>
      lookup(id).getGain(verse),
    getGainDb: (id: T[number]['id'], verse: AudioVerse) =>
      lookup(id).getGainDb(verse),
    getRecommendation: (id: T[number]['id'], verse: AudioVerse) =>
      lookup(id).getRecommendation(verse),
    getUrl: (id: T[number]['id'], verse: AudioVerse) =>
      lookup(id).getUrl(verse),
  })
}
