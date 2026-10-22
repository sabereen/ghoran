import sourceData from '../data/sources.json'
import coverageData from '../data/coverage.json'

export const sources = sourceData.sources
export const datasetCoverage = coverageData

/** A compact data file is loaded separately; the runtime never fetches audio. */
export interface CompactGainDataset {
  schema_version: '1.0.0'
  source_id: string
  target_playback_lufs: number
  provisional: boolean
  fields: readonly ['ordinal', 'gain_db', 'content_sha256']
  values: readonly (readonly [
    ordinal: number,
    gainDb: number | null,
    contentSha256: string,
  ])[]
}

export interface GainRecommendation {
  sourceId: string
  ordinal: number
  contentSha256: string
  gainDb: number | null
  gainLinear: number | null
  provisional: boolean
  targetPlaybackLufs: number
}

/** Convert amplitude gain, without a limiter, compressor, or player side effect. */
export function dbToLinearGain(db: number): number {
  if (!Number.isFinite(db)) throw new RangeError('Gain must be finite')
  const result = 10 ** (db / 20)
  if (!Number.isFinite(result) || result === 0)
    throw new RangeError('Gain is outside the representable range')
  return result
}

/** One-based Quran ordinal. Text-package zero-based indices require +1. */
export function createGainLookup(dataset: CompactGainDataset) {
  if (
    dataset.schema_version !== '1.0.0' ||
    !dataset.source_id ||
    !Number.isFinite(dataset.target_playback_lufs) ||
    typeof dataset.provisional !== 'boolean' ||
    dataset.fields.join(',') !== 'ordinal,gain_db,content_sha256'
  ) {
    throw new TypeError('Unsupported compact gain dataset')
  }
  const entries = new Map<number, GainRecommendation>()
  for (const [ordinal, gainDb, hash] of dataset.values) {
    if (
      !Number.isInteger(ordinal) ||
      ordinal < 1 ||
      ordinal > 6236 ||
      entries.has(ordinal) ||
      !/^[0-9a-f]{64}$/.test(hash) ||
      (gainDb !== null && !Number.isFinite(gainDb))
    ) {
      throw new TypeError('Invalid or duplicate gain entry')
    }
    entries.set(ordinal, {
      sourceId: dataset.source_id,
      ordinal,
      contentSha256: hash,
      gainDb,
      gainLinear: gainDb === null ? null : dbToLinearGain(gainDb),
      provisional: dataset.provisional,
      targetPlaybackLufs: dataset.target_playback_lufs,
    })
  }
  return {
    sourceId: dataset.source_id,
    size: entries.size,
    /** Missing verse or a changed file returns null; no fallback gain is invented. */
    get(ordinal: number, contentSha256: string): GainRecommendation | null {
      const entry = entries.get(ordinal)
      return entry && entry.contentSha256 === contentSha256
        ? { ...entry }
        : null
    },
  }
}
