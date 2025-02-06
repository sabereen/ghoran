import { Page } from '@ghoran/entity'

describe('Page class', () => {
  test('invalid indexes', () => {
    expect(() => Page.get(-1)).toThrow()
    expect(() => Page.get(605)).toThrow()
  })

  test('page 312', () => {
    const page = Page.get(312 - 1)
    expect(page.firstAyah.key).toBe('19:96')
    expect(page.lastAyah.key).toBe('20:12')
    expect(page.next?.firstAyah.key).toBe('20:13')
    expect(page.prev?.lastAyah.key).toBe('19:95')
  })
})
