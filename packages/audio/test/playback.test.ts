import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
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
  readFileSync(join(data, 'snapshot.json'), 'utf8'),
).sourceIds.map((id: AudioSourceId) => ({ id }))
const reference = JSON.parse(
  readFileSync(new URL('./fixtures/reference.json', import.meta.url), 'utf8'),
)

describe('player-facing gain profiles', () => {
  it('shares zero-based indices with text and preserves all canonical URL addresses', () => {
    expect(parhizgar.getGainDb(0)).toBe(-7.54)
    expect(getAudioUrl(parhizgar, 261)).toBe(
      'https://asset.nasimrezvan.com/data/Parhizgar/002255.mp3',
    )
    expect(getAudioUrl(ansarian.metadata, 6235)).toContain('/114006.mp3')
    const filenames = createHash('sha256')
    for (let index = 0; index < 6236; index++) {
      const name = getAudioUrl(parhizgar, index)
        .split('/')
        .at(-1)!
        .replace('.mp3', '')
      filenames.update(`${index}:${name}\n`)
      expect(parhizgar.getRecommendation(index).ayahIndex).toBe(index)
    }
    expect(filenames.digest('hex')).toBe(reference.fileStemsSha256)
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
  it('preserves every reference gain, peak flag and hash at all four targets', async () => {
    const peakCounts: Record<number, number> = {
      [-23]: 0,
      [-20]: 0,
      [-18]: 0,
      [-16]: 0,
    }
    for (const { id } of sources) {
      const manifest = await loadAudioContentManifest(id)
      for (const target of [-23, -20, -18, -16] as const) {
        const profile = await loadAudioSource(id, { targetLufs: target })
        const digest = createHash('sha256')
        for (let index = 0; index < 6236; index++) {
          const result = profile.getRecommendation(index)
          expect(result.status).toBe('ready')
          if (result.status !== 'ready') throw Error('Reference gain lost')
          expect(result.gainDb).toBeGreaterThanOrEqual(-18)
          expect(result.gainDb).toBeLessThanOrEqual(8)
          expect(result.gainLinear).toBeCloseTo(10 ** (result.gainDb / 20), 12)
          digest.update(
            JSON.stringify([
              index,
              Math.round(result.gainDb * 100),
              result.peakLimited,
              manifest.getHash(index),
            ]) + '\n',
          )
          peakCounts[target] += Number(result.peakLimited)
        }
        // Golden digests were calculated from the archived scientific records,
        // independently of the compact snapshot or generated TS modules.
        expect(digest.digest('hex')).toBe(reference.digests[id][target])
      }
    }
    expect(peakCounts).toEqual({
      [-23]: 4,
      [-20]: 566,
      [-18]: 6854,
      [-16]: 24566,
    })
  }, 60000)
})
