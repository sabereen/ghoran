import { Ayah } from '@ghoran/entity'

describe('Ayah class', () => {
  test('invalid indexes', () => {
    expect(() => Ayah.get(-1)).toThrow()
    expect(() => Ayah.get(6236)).toThrow()
  })
})
