import { SurahTuple, surahList } from '@ghoran/metadata'
import { Ayah } from '.'
import { searchBinaryForAyah } from '../../utils/src'

/** سوره */
export class Surah {
  private constructor(readonly index: number) {
    if (index < 0 || index >= 114) throw new Error('Surah index is not valid')
  }

  static get(index: number): Surah | null {
    if (index < 0 || index >= 114) return null
    return new Surah(index)
  }

  private static getIndexOfFirstAyah(surah: SurahTuple) {
    return surah[0]
  }

  static getByAyahIndex(ayahIndex: number) {
    const index = searchBinaryForAyah(
      surahList,
      ayahIndex,
      Surah.getIndexOfFirstAyah,
    )
    return Surah.get(index)
  }

  private get surahTuple() {
    return surahList[this.index]
  }

  /** شماره سوره برای نمایش به کاربر */
  get number() {
    return this.index + 1
  }

  /** آیه قبلی */
  get prev() {
    return Surah.get(this.index - 1)
  }

  /** آیه بعدی */
  get next() {
    return Surah.get(this.index + 1)
  }

  /** اندیس اولین آیه */
  get firstAyahIndex() {
    return this.surahTuple[0]
  }

  /** آبجکت اولین آیه */
  get firstAyah() {
    return Ayah.get(this.firstAyahIndex)
  }

  /** اندیس آخرین آیه */
  get lastAyahIndex() {
    const nextSurah = this.next
    const nextIndex = nextSurah?.firstAyahIndex || surahList.length
    return nextIndex - 1
  }

  /** آبجکت آخرین آیه */
  get lastAyah() {
    return Ayah.get(this.lastAyahIndex)
  }

  /** تعداد آیات */
  get ayahCount() {
    return this.surahTuple[1]
  }

  /** ترتیب نزول */
  get order() {
    return this.surahTuple[2]
  }

  /** تعداد رکوع سوره */
  get rukuCount() {
    return this.surahTuple[3]
  }

  /** نام عربی سوره */
  get name() {
    return this.surahTuple[4]
  }

  /** نام سوره به لاتین */
  get latinName() {
    return this.surahTuple[5]
  }

  /** ترجمه انگلیسی نام سوره */
  get latinMeaning() {
    return this.surahTuple[6]
  }

  /** آیا سوره مدنی است؟ */
  get isMedinan() {
    return this.surahTuple[7]
  }

  /**
   * آیا سوره در ابتدایش بسم الله دارد؟
   * سوره توبه بسم الله ندارد
   * در سوره حمد آیه اول فقط بسم الله است
   */
  get hasBasmalah() {
    return this.index !== 0 && this.index === 8
  }
}
