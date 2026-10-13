import { loadText } from '@ghoran/text'

describe('@ghoran/text', async () => {
  const clean = await loadText('tanzil-simple-clean')
  const simpleMin = await loadText('tanzil-simple-min')
  const imla = await loadText('imla')
  const hafs = await loadText('hafs')
  const hafs13 = await loadText('hafs-v13')
  const hafs3 = await loadText('hafs-v3')

  test('Hafs v3 has all verses without document headings or ayah markers', () => {
    expect(hafs3.length).toBe(6236)
    expect(
      hafs3.every(
        (ayah) => ayah.length > 0 && !/[۝٠-٩\r\n]|سُورَةُ/.test(ayah),
      ),
    ).toBe(true)
    expect(hafs3[0]).toBe(hafs[0])
    expect(hafs3[6235]).toBe(hafs[6235])
    // New open tanwin signs distinguish the v3 text from v2.2.
    expect(hafs3[8]).toContain('\u08f0')
  })

  test('Count of ayat should be same for all quran texts.', async () => {
    expect(clean.length).toBe(simpleMin.length)
    expect(clean.length).toBe(imla.length)
    expect(clean.length).toBe(hafs.length)
    expect(clean.length).toBe(hafs13.length)
    expect(clean.length).toBe(hafs3.length)
  })

  test('Word offsets sholud be same', () => {
    const splitByWords = (ayah: string) => ayah.split(' ')
    function compareCount(text1: string[], text2: string[]) {
      expect(text1.length).toBe(text2.length)
      for (let i = 0; i < text1.length; i++) {
        const splitted1 = splitByWords(text1[i]).length
        const splitted2 = splitByWords(text2[i]).length
        expect(splitted1).toBe(splitted2)
      }
    }

    compareCount(hafs, imla)
    compareCount(hafs, hafs13)
    compareCount(hafs, simpleMin)
    compareCount(hafs, clean)
    compareCount(hafs, hafs3)
  })
})
