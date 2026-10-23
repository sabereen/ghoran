import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createAudioPair, createAudioPairSource } from '../src/pair'
import { loadAudioPairSource } from '../src/load'
import motaz from '../src/paired/motaz'
import maleki from '../src/paired/maleki'
import { createAudioSource } from '../src/playback'
import type { AudioSourceId } from '../src/types'

describe('optional recitation/translation pair matching', () => {
  it('fixes the reported Fatiha mismatch without boosting or changing the quiet recitation', () => {
    const pair = createAudioPair({ recitation: motaz, translation: maleki })
    // Independent full-precision archived BS.1770 measurements for the reported file.
    const raw = { motaz: -30.090700043360187, maleki: -16.212 }
    const result = pair.getRecommendation(0)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw Error('Missing measured pair')
    expect(result.recitation.gainDb).toBe(2.66)
    expect(result.translation.gainDb).toBe(-10.24)
    expect(
      Math.abs(
        raw.maleki +
          result.translation.gainDb -
          raw.motaz -
          result.recitation.gainDb,
      ),
    ).toBeLessThan(1.1)
    expect(result.recitation.additionalCutDb).toBe(0)
    expect(result.contentVerified).toBe(false)
    // At Ayat al-Kursi the recitation is louder: do not indiscriminately cut Maleki.
    const long = pair.getRecommendation(261)
    expect(long).toMatchObject({
      recitation: { gainDb: 0.81 },
      translation: { gainDb: 0.11 },
    })
  })
  it('decodes every indexed measured value and bounds every pair; reports unattainable matches', async () => {
    const ids: AudioSourceId[] = JSON.parse(
      readFileSync(new URL('../data/snapshot.json', import.meta.url), 'utf8'),
    ).sourceIds
    const sources = await Promise.all(ids.map(loadAudioPairSource))
    for (const source of sources) {
      const bytes = readFileSync(
        new URL(`../data/levels/${source.profile.id}.bin`, import.meta.url),
      )
      for (let i = 0; i < 6236; i++) {
        const raw = bytes.readInt16LE(i * 2)
        expect(source.getPlaybackLoudness(i)).toBe(
          raw === -32768 ? null : raw / 10,
        )
      }
    }
    let limited = 0
    for (const r of sources.filter(
      (s) => s.profile.metadata.kind !== 'translation',
    )) {
      for (const t of sources.filter(
        (s) => s.profile.metadata.kind === 'translation',
      )) {
        const pair = createAudioPair({ recitation: r, translation: t })
        for (let i = 0; i < 6236; i++) {
          const result = pair.getRecommendation(i)
          if (result.status !== 'ready')
            throw Error(`Unavailable pair ${r.profile.id}/${t.profile.id}/${i}`)
          for (const [gain, source] of [
            [result.recitation, r],
            [result.translation, t],
          ] as const) {
            expect(gain.gainDb).toBeLessThanOrEqual(
              source.profile.getGainDb(i)! + 1e-9,
            )
            expect(gain.gainDb).toBeGreaterThanOrEqual(-18)
            expect(gain.gainLinear).toBeCloseTo(10 ** (gain.gainDb / 20), 12)
          }
          if (result.cutLimited) limited++
          else
            expect(Math.abs(result.differenceLu)).toBeLessThanOrEqual(
              1.00000001,
            )
        }
      }
    }
    expect(limited).toBe(130)
  }, 60000)
  it('respects custom budgets, rejects wrong pair types and keeps nulls explicit', () => {
    const pair = createAudioPair({
      recitation: motaz,
      translation: maleki,
      maximumAdditionalCutDb: 2,
    })
    expect(pair.getRecommendation(0)).toMatchObject({
      matched: false,
      cutLimited: true,
      translation: { additionalCutDb: 2 },
    })
    expect(() =>
      createAudioPair({ recitation: maleki, translation: motaz }),
    ).toThrow(RangeError)
    expect(() =>
      createAudioPair({
        recitation: motaz,
        translation: maleki,
        toleranceLu: NaN,
      }),
    ).toThrow(RangeError)
    expect(() => pair.getRecommendation(6236)).toThrow(RangeError)
    const nullLevels = createAudioPairSource(
      motaz.profile,
      Buffer.alloc(6236 * 2, Buffer.from([0, 128])).toString('base64'),
    )
    expect(
      createAudioPair({
        recitation: nullLevels,
        translation: maleki,
      }).getRecommendation(0),
    ).toMatchObject({ status: 'unavailable', recitation: null })
    const unavailable = createAudioSource(maleki.profile.metadata, {
      targetLufs: -20,
      base: 11,
      overrides: [],
      unavailable: [[0, 'invalid-audio']],
    })
    expect(
      createAudioPair({
        recitation: motaz,
        translation: { ...maleki, profile: unavailable },
      }).getRecommendation(0).status,
    ).toBe('unavailable')
  })
})
