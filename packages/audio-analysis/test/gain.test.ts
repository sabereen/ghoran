import { describe, it, expect } from 'vitest'
import {
  createGainLookup,
  dbToLinearGain,
  type CompactGainDataset,
} from '../src/index'

const hash = 'a'.repeat(64)
const data: CompactGainDataset = {
  schema_version: '1.0.0',
  source_id: 'fixture',
  target_playback_lufs: -20,
  provisional: true,
  fields: ['ordinal', 'gain_db', 'content_sha256'],
  values: [
    [1, -6, hash],
    [2, null, hash],
  ],
}

describe('gain metadata consumer', () => {
  it('converts amplitude dB and rejects nonrepresentable gains', () => {
    expect(dbToLinearGain(0)).toBe(1)
    expect(dbToLinearGain(-6)).toBeCloseTo(0.5011872336)
    expect(() => dbToLinearGain(Infinity)).toThrow(RangeError)
    expect(() => dbToLinearGain(10000)).toThrow(RangeError)
  })
  it('requires the exact content version and preserves unavailable/provisional data', () => {
    const lookup = createGainLookup(data)
    expect(lookup.get(1, hash)?.gainDb).toBe(-6)
    expect(lookup.get(1, 'b'.repeat(64))).toBeNull()
    expect(lookup.get(100, hash)).toBeNull()
    expect(lookup.get(2, hash)?.gainLinear).toBeNull()
    expect(lookup.get(1, hash)?.provisional).toBe(true)
    const result = lookup.get(1, hash)!
    result.gainDb = 200
    expect(lookup.get(1, hash)?.gainDb).toBe(-6)
  })
  it('rejects duplicate ordinals and wrong file hashes', () => {
    expect(() =>
      createGainLookup({
        ...data,
        values: [
          [1, 0, hash],
          [1, 2, hash],
        ],
      }),
    ).toThrow()
    expect(() =>
      createGainLookup({ ...data, values: [[1, 0, 'bad']] }),
    ).toThrow()
  })
})
