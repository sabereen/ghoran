import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import {
  createAudioNormalizer,
  audioDataset,
  parhizgar,
  ansarian,
  ghamadi,
  maleki,
  type AudioSourceId,
} from '../src/index'
import { createAudioSource } from '../src/playback'
import { getAudioUrl } from '../src/url'
import { loadAudioSource, loadAudioContentManifest } from '../src/load'
import { getVerifiedAudioGain, verifyAudioContent } from '../src/verify'

const data = fileURLToPath(new URL('../data/', import.meta.url))
const sources: { id: AudioSourceId }[] = JSON.parse(
  readFileSync(join(data, 'sources.json'), 'utf8'),
).sources

describe('player-facing gain profiles', () => {
  it('shares zero-based indices with text and preserves all canonical URL addresses', () => {
    expect(parhizgar.getGainDb(0)).toBe(-7.54)
    expect(getAudioUrl(parhizgar, 261)).toBe(
      'https://asset.nasimrezvan.com/data/Parhizgar/002255.mp3',
    )
    expect(getAudioUrl(ansarian.metadata, 6235)).toContain('/114006.mp3')
    const verses = JSON.parse(
      gunzipSync(readFileSync(join(data, 'verses.json.gz'))).toString(),
    )
    for (const [index, verse] of verses.entries()) {
      expect(getAudioUrl(parhizgar, index)).toBe(
        parhizgar.metadata.urlTemplate.replace('{file_stem}', verse.file_stem),
      )
      expect(parhizgar.getRecommendation(index).ayahIndex).toBe(index)
    }
    expect(parhizgar).not.toHaveProperty('getUrl')
    expect(parhizgar.getRecommendation(0)).not.toHaveProperty('verseId')
    expect(parhizgar.getRecommendation(0)).not.toHaveProperty('ordinal')
  })
  it('rejects invalid indices and removed address overloads without coercion', async () => {
    const hashes = await loadAudioContentManifest('parhizgar')
    for (const index of [
      -1,
      6236,
      1.5,
      NaN,
      Infinity,
      '2:255',
      { surah: 2, ayah: 255 },
      null,
      undefined,
    ]) {
      expect(() => parhizgar.getGain(index as never)).toThrow(RangeError)
      expect(() => parhizgar.getGainDb(index as never)).toThrow(RangeError)
      expect(() => parhizgar.getRecommendation(index as never)).toThrow(
        RangeError,
      )
      expect(() => getAudioUrl(parhizgar, index as never)).toThrow(RangeError)
      expect(() => hashes.getHash(index as never)).toThrow(RangeError)
    }
  })
  it('keeps peak protection and strict null semantics while adopted replacements become ready', () => {
    expect(ghamadi.getRecommendation(235)).toMatchObject({
      gainDb: -12.75,
      peakLimited: true,
    })
    expect(ansarian.getGainDb(165)).toBe(-3.55)
    expect(maleki.getRecommendation(383)).toMatchObject({
      status: 'ready',
      reason: null,
      contentVerified: false,
    })
    expect(parhizgar.getRecommendation(4128)).toMatchObject({
      status: 'ready',
      contentVerified: false,
    })
    expect(parhizgar.getGain(4128)).toBeGreaterThan(0)
    expect(audioDataset.pendingPublicationFiles).toBe(11)
    expect(parhizgar.metadata.pendingPublicationFiles).toBe(1)
    expect(maleki.metadata.pendingPublicationFiles).toBe(4)
    const unavailable = createAudioSource(parhizgar.metadata, {
      targetLufs: -20,
      base: -754,
      overrides: [],
      unavailable: [[0, 'invalid-audio']],
    })
    expect(unavailable.getGain(0)).toBeNull()
    expect(unavailable.getRecommendation(0)).toMatchObject({
      status: 'unavailable',
      reason: 'invalid-audio',
      gainLinear: null,
    })
    expect(Object.isFrozen(parhizgar.metadata)).toBe(true)
    expect(Object.isFrozen(parhizgar)).toBe(true)
  })
  it('registers selected sources and rejects mixed targets, duplicates, and unknown registrations', async () => {
    const normalizer = createAudioNormalizer({ sources: [parhizgar, ansarian] })
    expect(normalizer.getGain('parhizgar', 0)).toBe(parhizgar.getGain(0))
    // @ts-expect-error The registry includes only the two explicitly selected IDs.
    expect(() => normalizer.getGain('husary', 0)).toThrow(RangeError)
    expect(() => createAudioNormalizer({ sources: [] })).toThrow(RangeError)
    expect(() =>
      createAudioNormalizer({ sources: [parhizgar, parhizgar] }),
    ).toThrow(RangeError)
    const broadcast = await loadAudioSource('parhizgar', { targetLufs: -23 })
    expect(() =>
      createAudioNormalizer({ sources: [broadcast, ansarian] }),
    ).toThrow(RangeError)
    expect(broadcast.getGainDb(0)).toBe(-10.54)
    await expect(loadAudioSource('unknown' as never)).rejects.toThrow(
      RangeError,
    )
    await expect(
      loadAudioSource('parhizgar', { targetLufs: -19 as never }),
    ).rejects.toThrow(RangeError)
  })
  it('checks original-file hashes and never applies a mismatched revision', async () => {
    const hashes = await loadAudioContentManifest('parhizgar')
    const hash = hashes.getHash(0)!
    expect(verifyAudioContent(hashes, 0, hash)).toBe(true)
    expect(getVerifiedAudioGain(parhizgar, hashes, 0, hash)).toBe(
      parhizgar.getGain(0),
    )
    expect(
      getVerifiedAudioGain(parhizgar, hashes, 0, 'f'.repeat(64)),
    ).toBeNull()
    expect(getVerifiedAudioGain(ansarian, hashes, 0, hash)).toBeNull()
    expect(
      getVerifiedAudioGain(
        parhizgar,
        { ...hashes, contentRevision: 'old' },
        0,
        hash,
      ),
    ).toBeNull()
    expect(
      getVerifiedAudioGain(parhizgar, hashes, 4128, hashes.getHash(4128)!),
    ).toBe(parhizgar.getGain(4128))
    // The old, truncated CDN bytes must not acquire the replacement's gain.
    expect(
      getVerifiedAudioGain(
        parhizgar,
        hashes,
        4128,
        '7a3cdabd379430a7fd7eb6cacbdcc9509ace36b688cdfb243216369250eb9c2a',
      ),
    ).toBeNull()
    expect(() => verifyAudioContent(hashes, 0, 'bad')).toThrow(TypeError)
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
      const manifest = await loadAudioContentManifest(id)
      for (const [index, line] of lines.entries()) {
        expect(manifest.getHash(index)).toBe(JSON.parse(line).measured.sha256)
      }
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
          const result = profile.getRecommendation(record.ordinal - 1)
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
      expect(counts[target].ready).toBe(81068)
      expect(counts[target].unavailable).toBe(0)
    }
    expect(counts[-23].peak).toBe(4)
    expect(counts[-20].peak).toBe(566)
    expect(counts[-18].peak).toBe(6854)
    expect(counts[-16].peak).toBe(24566)
  }, 60000)
})
