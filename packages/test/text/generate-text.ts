import { fixedTexts } from '../../text/scripts/homogenization-word-offset'

describe('Word Offset', () => {
  test('Word offsets should be same', () => {
    const splitByWords = (ayah: string) => ayah.split(' ')
    function compareCount(text1: string[], text2: string[]) {
      expect(text1.length).toBe(text2.length)
      for (let i = 0; i < text1.length; i++) {
        const splitted1 = splitByWords(text1[i]).length
        const splitted2 = splitByWords(text2[i]).length
        expect(splitted1).toBe(splitted2)
      }
    }

    compareCount(fixedTexts.hafs, fixedTexts.imla)
    compareCount(fixedTexts.hafs, fixedTexts['hafs-v13'])
    compareCount(fixedTexts.hafs, fixedTexts['tanzil-simple-clean'])
    compareCount(fixedTexts.hafs, fixedTexts['tanzil-simple-min'])
  })
})
