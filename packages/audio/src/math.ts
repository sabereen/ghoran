export function dbToLinearGain(db: number): number {
  if (!Number.isFinite(db)) throw new RangeError('Gain must be finite')
  const result = 10 ** (db / 20)
  if (!Number.isFinite(result) || result === 0)
    throw new RangeError('Gain is outside the representable range')
  return result
}
