import { SurahTuple, surahList } from '@ghoran/metadata'
import { searchBinaryForAyah } from '@ghoran/utils'

function getIndexOfFirstAyah(surah: SurahTuple) {
  return surah[0]
}

export class Ayah {
  private constructor(readonly index: number) {}

  static get(index: number) {
    return new Ayah(index)
  }

  static fromSurahNumber(surahNumber: number, ayahNumberInSurah: number) {
    const surah = surahList[surahNumber - 1]
    if (!surah) return null
    const index = surah[0] + ayahNumberInSurah
    return Ayah.get(index)
  }

  surahIndex() {
    return searchBinaryForAyah(surahList, this.index, getIndexOfFirstAyah)
  }
}
