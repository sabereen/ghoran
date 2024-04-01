import { loadText } from '@ghoran/text'

describe('@ghoran/text', () => {
  test('Count of ayat should be same for all quran texts.', async () => {
    const clean = await loadText('clean')
    const simpleMin = await loadText('simple-min')
    const imla = await loadText('imla')
    const hafs = await loadText('hafs')
    const hafs13 = await loadText('hafs-v13')

    expect(clean.length).toBe(simpleMin.length)
    expect(clean.length).toBe(imla.length)
    expect(clean.length).toBe(hafs.length)
    expect(clean.length).toBe(hafs13.length)
  })
})
