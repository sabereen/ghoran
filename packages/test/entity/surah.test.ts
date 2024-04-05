import { Surah } from '@ghoran/entity'

describe('Surah class', () => {
  test('invalid indexes', () => {
    expect(() => Surah.get(-1)).toThrow()
    expect(() => Surah.get(114)).toThrow()
  })

  test('taha surah', () => {
    const surah = Surah.get(19)
    expect(surah.number).toBe(20)
    expect(surah.name).toBe('طه')
    expect(surah.firstAyahIndex).toBe(2348)
    expect(surah.ayahCount).toBe(135)
    expect(surah.order).toBe(45)
    expect(surah.rukuCount).toBe(8)
    expect(surah.latinName).toBe('Taa-Haa')
    expect(surah.latinMeaning).toBe('Taa-Haa')
    expect(surah.isMedinan).toBe(false)
    expect(surah.hasBasmalah).toBe(true)

    expect(surah.prev?.name).toBe('مريم')
    expect(surah.next?.name).toBe('الأنبياء')
  })

  test('get surah by ayah index', () => {
    const surah = Surah.getByAyahIndex(8)
    expect(surah.name).toBe('البقرة')
  })
})
