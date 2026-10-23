/** Shared address contract; deliberately contains no Quran addressing data. */
export function assertAyahIndex(ayahIndex: number): void {
  if (!Number.isInteger(ayahIndex) || ayahIndex < 0 || ayahIndex >= 6236)
    throw new RangeError('Ayah index must be an integer from 0 to 6235')
}
