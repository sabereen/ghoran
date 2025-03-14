import { Juz } from '@ghoran/entity'

describe('Page class', () => {
  test('invalid indexes', () => {
    expect(() => Juz.get(0)).not.toThrow()
    expect(() => Juz.get(-1)).toThrow()
    expect(() => Juz.get(30)).toThrow()
    expect(() => Juz.get(29)).not.toThrow()
  })

  test('juz 29', () => {
    const juz = Juz.get(29 - 1)
    expect(juz.firstAyah.key).toBe('67:1')
    expect(juz.lastAyah.key).toBe('77:50')
    expect(juz.next!.firstAyah.key).toBe('78:1')
    expect(juz.prev!.lastAyah.key).toBe('66:12')
    expect(juz.next!.next).toBeNull()
  })
})
