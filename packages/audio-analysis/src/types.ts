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
/** Numbers are ONE-based ordinals (1..6236), never zero-based text indices. */
export type AudioVerse =
  number | string | Readonly<{ surah: number; ayah: number }>
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
  readonly ordinal: number
  readonly verseId: string
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
  getGain(verse: AudioVerse): number | null
  getGainDb(verse: AudioVerse): number | null
  getRecommendation(verse: AudioVerse): AudioRecommendation
  getUrl(verse: AudioVerse): string
}
export interface AudioNormalizer<Id extends AudioSourceId = AudioSourceId> {
  readonly targetLufs: AudioLoudnessTarget
  readonly snapshotId: string
  getGain(source: Id, verse: AudioVerse): number | null
  getGainDb(source: Id, verse: AudioVerse): number | null
  getRecommendation(source: Id, verse: AudioVerse): AudioRecommendation
  getUrl(source: Id, verse: AudioVerse): string
}
export interface AudioContentManifest {
  readonly sourceId: AudioSourceId
  readonly contentRevision: string
  getHash(verse: AudioVerse): string | null
}
/** Internal compiler output; integer gains are hundredths of a dB. */
export interface AudioSourcePolicyData {
  readonly targetLufs: AudioLoudnessTarget
  readonly base: number | null
  readonly overrides: readonly (readonly [number, number, boolean])[]
  readonly unavailable: readonly (readonly [number, AudioUnavailableReason])[]
}
