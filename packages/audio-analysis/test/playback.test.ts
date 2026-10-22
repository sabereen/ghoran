import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import {
  createAudioNormalizer,
  getAudioVerse,
  toAudioVerseOrdinal,
  parhizgar,
  ansarian,
  ghamadi,
  maleki,
  type AudioSourceId,
} from '../src/index'
import { loadAudioSource, loadAudioContentManifest } from '../src/load'
import { getVerifiedAudioGain, verifyAudioContent } from '../src/verify'

const data = fileURLToPath(new URL('../data/', import.meta.url))
const sources: { id: AudioSourceId }[] = JSON.parse(
  readFileSync(join(data, 'sources.json'), 'utf8'),
).sources

describe('player-facing gain profiles', () => {
  it('accepts canonical keys, addresses, and one-based ordinals', () => {
    expect(parhizgar.getGain('2:1')).toBe(parhizgar.getGain(8))
    expect(parhizgar.getGain({ surah: 2, ayah: 1 })).toBe(parhizgar.getGain(8))
    expect(parhizgar.getGainDb('1:1')).toBe(-7.54)
    expect(parhizgar.getUrl('2:255')).toBe(
      'https://asset.nasimrezvan.com/data/Parhizgar/002255.mp3',
    )
    expect(ansarian.getUrl(6236)).toContain('/114006.mp3')
    expect(getAudioVerse(6236).verseId).toBe('114:6')
    for (let ordinal = 1; ordinal <= 6236; ordinal++) {
      const address = getAudioVerse(ordinal)
      expect(toAudioVerseOrdinal(address.verseId)).toBe(ordinal)
    }
  })
  it('rejects ambiguous zero-based indices and non-Quran addresses', () => {
    for (const verse of [
      0,
      6237,
      1.5,
      NaN,
      Infinity,
      '0:1',
      '2:287',
      '114:7',
      '001001',
      '1:1:1',
    ])
      expect(() => parhizgar.getGain(verse)).toThrow(RangeError)
    expect(() => parhizgar.getGain(null as never)).toThrow(TypeError)
  })
  it('handles real peak exceptions and unavailable content without fallback gains', () => {
    expect(ghamadi.getRecommendation(236)).toMatchObject({
      gainDb: -12.75,
      peakLimited: true,
    })
    expect(ansarian.getGainDb(166)).toBe(-3.55)
    expect(maleki.getRecommendation('3:91')).toMatchObject({
      status: 'unavailable',
      reason: 'invalid-audio',
      gainDb: null,
      gainLinear: null,
    })
    expect(parhizgar.getRecommendation('39:71')).toMatchObject({
      status: 'unavailable',
      reason: 'unmeasurable',
      gainLinear: null,
      contentVerified: false,
    })
    expect(Object.isFrozen(parhizgar.metadata)).toBe(true)
    expect(Object.isFrozen(parhizgar)).toBe(true)
  })
  it('registers selected sources and rejects mixed targets, duplicates, and unknown registrations', async () => {
    const normalizer = createAudioNormalizer({ sources: [parhizgar, ansarian] })
    expect(normalizer.getGain('parhizgar', '1:1')).toBe(
      parhizgar.getGain('1:1'),
    )
    // @ts-expect-error The registry includes only the two explicitly selected IDs.
    expect(() => normalizer.getGain('husary', '1:1')).toThrow(RangeError)
    expect(() => createAudioNormalizer({ sources: [] })).toThrow(RangeError)
    expect(() =>
      createAudioNormalizer({ sources: [parhizgar, parhizgar] }),
    ).toThrow(RangeError)
    const broadcast = await loadAudioSource('parhizgar', { targetLufs: -23 })
    expect(() =>
      createAudioNormalizer({ sources: [broadcast, ansarian] }),
    ).toThrow(RangeError)
    expect(broadcast.getGainDb('1:1')).toBe(-10.54)
    await expect(loadAudioSource('unknown' as never)).rejects.toThrow(
      RangeError,
    )
    await expect(
      loadAudioSource('parhizgar', { targetLufs: -19 as never }),
    ).rejects.toThrow(RangeError)
  })
  it('checks original-file hashes and never applies a mismatched revision', async () => {
    const hashes = await loadAudioContentManifest('parhizgar')
    const hash = hashes.getHash('1:1')!
    expect(verifyAudioContent(hashes, '1:1', hash)).toBe(true)
    expect(getVerifiedAudioGain(parhizgar, hashes, '1:1', hash)).toBe(
      parhizgar.getGain('1:1'),
    )
    expect(
      getVerifiedAudioGain(parhizgar, hashes, '1:1', 'f'.repeat(64)),
    ).toBeNull()
    expect(getVerifiedAudioGain(ansarian, hashes, '1:1', hash)).toBeNull()
    expect(
      getVerifiedAudioGain(
        parhizgar,
        { ...hashes, contentRevision: 'old' },
        '1:1',
        hash,
      ),
    ).toBeNull()
    expect(
      getVerifiedAudioGain(
        parhizgar,
        hashes,
        '39:71',
        hashes.getHash('39:71')!,
      ),
    ).toBeNull()
    expect(() => verifyAudioContent(hashes, '1:1', 'bad')).toThrow(TypeError)
  })
  it('preserves peak safety and nulls for every reference file at all four targets', async () => {
    const counts: Record<
      string,
      { ready: number; peak: number; unavailable: number }
    > = {}
    for (const target of [-23, -20, -18, -16] as const)
      counts[target] = { ready: 0, peak: 0, unavailable: 0 }
    for (const { id } of sources) {
      const lines = gunzipSync(
        readFileSync(join(data, 'measurements', id + '.jsonl.gz')),
      )
        .toString()
        .trim()
        .split('\n')
      expect(lines).toHaveLength(6236)
      for (const target of [-23, -20, -18, -16] as const) {
        const profile = await loadAudioSource(id, { targetLufs: target })
        const reference = JSON.parse(
          readFileSync(
            join(data, 'recommendations', String(target), id + '.json'),
            'utf8',
          ),
        )
        const gains = new Map<number, number | null>(
          reference.values.map(([ordinal, gain]: [number, number | null]) => [
            ordinal,
            gain,
          ]),
        )
        for (const line of lines) {
          const record = JSON.parse(line)
          const result = profile.getRecommendation(record.ordinal)
          const original = gains.get(record.ordinal)
          if (original === null || original === undefined) {
            if (result.gainLinear !== null)
              throw Error(
                'Missing gain gained a fallback: ' + id + '/' + record.ordinal,
              )
            counts[target].unavailable++
          } else {
            const db = result.gainDb!
            if (Math.abs(db - original) > 0.010501)
              throw Error('Gain differs from reference')
            if (record.measured.loudness.true_peak_dbtp + db > -1.15 + 1e-8)
              throw Error('Peak ceiling exceeded')
            if (
              db < -18 ||
              db > 8 ||
              Math.abs(result.gainLinear! - 10 ** (db / 20)) > 1e-12
            )
              throw Error('Invalid gain')
            counts[target].ready++
            counts[target].peak += Number(result.peakLimited)
          }
        }
      }
    }
    for (const target of [-23, -20, -18, -16]) {
      expect(counts[target].ready).toBe(81057)
      expect(counts[target].unavailable).toBe(11)
    }
    expect(counts[-23].peak).toBe(4)
    expect(counts[-20].peak).toBe(566)
    expect(counts[-18].peak).toBe(6852)
    expect(counts[-16].peak).toBe(24561)
  }, 60000)
})
