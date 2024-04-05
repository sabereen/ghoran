import { Ayah } from '@ghoran/entity'

describe('Ayah class', () => {
  test('invalid indexes', () => {
    expect(() => Ayah.get(-1)).toThrow()
    expect(() => Ayah.get(6236)).toThrow()
  })

  test('first ayah of baqarah', () => {
    const ayah = Ayah.get(7)
    expect(ayah.surahNumber).toBe(2)
    expect(ayah.ayahNumber).toBe(1)
    expect(ayah.pageNumber).toBe(2)
    expect(ayah.juzNumber).toBe(1)
    expect(ayah.sajdah).toBe(false)
    expect(ayah.obligatorySajdah).toBe(false)
  })
})
