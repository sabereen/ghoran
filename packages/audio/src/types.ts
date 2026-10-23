export type AudioSourceId =
  | 'parhizgar'
  | 'ghamadi'
  | 'husary'
  | 'minshawy-murattal'
  | 'minshawy-mujawwad'
  | 'motaz'
  | 'abdulbasit'
  | 'almuiqly'
  | 'jafarpour'
  | 'ansarian'
  | 'maleki'
  | 'makarem-kabiri'
  | 'fooladvand-hedayatfar'
export type AudioLoudnessTarget = -23 | -20 | -18 | -16
/** Zero-based Quran ayah index (0..6235), shared with text arrays and Ayah.index. */
export type AyahIndex = number
export type AudioUnavailableReason =
  | 'invalid-audio'
  | 'unmeasurable'
  | 'unprocessed'
  | 'missing-audio'
  | 'download-error'
  | 'peak-limit-unreachable'
export interface AudioSource {
  readonly id: AudioSourceId
  readonly nameFa: string
  readonly kind: 'recitation' | 'mujawwad' | 'translation'
  readonly urlTemplate: string
  readonly baselinePlaybackLufs: number | null
  /** Ordered reference audio hashes/statuses digest; not an individual file hash. */
  readonly contentRevision: string
  readonly measuredFiles: number
  readonly inventoryComplete: boolean
  /** Accepted reference revisions awaiting verification at their canonical URLs. */
  readonly pendingPublicationFiles?: number
}
export interface AudioGainPolicyInfo {
  readonly targetLufs: AudioLoudnessTarget
  readonly truePeakCeilingDbtp: number
  readonly truePeakMarginDb: number
  readonly maximumBoostDb: number
  readonly maximumCutDb: number
  readonly quantizationDb: number
  readonly inferredCorrectionsApplied: false
}
interface AudioRecommendationDetails {
  readonly sourceId: AudioSourceId
  readonly ayahIndex: AyahIndex
  readonly targetLufs: AudioLoudnessTarget
  readonly snapshotId: string
  readonly contentRevision: string
  /** Reference lookup does not verify audio bytes; see /verify. */
  readonly contentVerified: false
  readonly baseGainDb: number | null
  readonly peakLimited: boolean
  readonly provisional: boolean
}
/** Status narrows both gains to numbers or null in TypeScript. */
export type AudioRecommendation = AudioRecommendationDetails &
  (
    | {
        readonly status: 'ready'
        readonly reason: null
        readonly gainDb: number
        readonly gainLinear: number
      }
    | {
        readonly status: 'unavailable'
        readonly reason: AudioUnavailableReason
        readonly gainDb: null
        readonly gainLinear: null
      }
  )
export interface AudioSourceProfile<Id extends AudioSourceId = AudioSourceId> {
  readonly id: Id
  readonly metadata: AudioSource
  readonly targetLufs: AudioLoudnessTarget
  readonly snapshotId: string
  readonly policy: AudioGainPolicyInfo
  getGain(ayahIndex: AyahIndex): number | null
  getGainDb(ayahIndex: AyahIndex): number | null
  getRecommendation(ayahIndex: AyahIndex): AudioRecommendation
}
export interface AudioNormalizer<Id extends AudioSourceId = AudioSourceId> {
  readonly targetLufs: AudioLoudnessTarget
  readonly snapshotId: string
  getGain(source: Id, ayahIndex: AyahIndex): number | null
  getGainDb(source: Id, ayahIndex: AyahIndex): number | null
  getRecommendation(source: Id, ayahIndex: AyahIndex): AudioRecommendation
}
export interface AudioContentManifest {
  readonly sourceId: AudioSourceId
  readonly contentRevision: string
  getHash(ayahIndex: AyahIndex): string | null
}
/** Internal compiler output; keys are zero-based indices; gains are hundredths of a dB. */
export interface AudioSourcePolicyData {
  readonly targetLufs: AudioLoudnessTarget
  readonly base: number | null
  readonly overrides: readonly (readonly [number, number, boolean])[]
  readonly unavailable: readonly (readonly [number, AudioUnavailableReason])[]
}
