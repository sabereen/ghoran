import { describe, it, expect } from 'vitest'
import { dbToLinearGain } from '../src/index'

describe('amplitude gain conversion', () => {
  it('converts dB and rejects nonrepresentable gains', () => {
    expect(dbToLinearGain(0)).toBe(1)
    expect(dbToLinearGain(-6)).toBeCloseTo(0.5011872336)
    expect(() => dbToLinearGain(Infinity)).toThrow(RangeError)
    expect(() => dbToLinearGain(10000)).toThrow(RangeError)
  })
})
