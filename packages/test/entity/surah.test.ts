import { Surah } from '@ghoran/entity'

describe('Surah class', () => {
  test('invalid indexes', () => {
    expect(() => Surah.get(-1)).toThrow()
    expect(() => Surah.get(114)).toThrow()
  })
})
