import { SurahTuple, surahList } from '@ghoran/metadata'
import { searchBinaryForAyah } from '@ghoran/utils'
import { COUNT_OF_SURAHS } from '@ghoran/metadata/constants'
import { Ayah } from '.'

const cache = new Map<number, Surah>()

/** سوره */
export class Surah {
  protected constructor(readonly index: number) {
    if (index < 0 || index >= COUNT_OF_SURAHS)
      throw new Error('Surah index is not valid')
  }

  static get(index: number): Surah {
    let surah = cache.get(index)
    if (!surah) {
      surah = new this(index)
      cache.set(index, surah)
    }
    return surah
  }

  private static getIndexOfFirstAyah(surah: SurahTuple) {
    return surah[0]
  }

  static getByAyahIndex(ayahIndex: number) {
    const index = searchBinaryForAyah(
      surahList,
      ayahIndex,
      this.getIndexOfFirstAyah,
    )
    return this.get(index)
  }

  /** تمام سوره‌های قرآن را بر می‌گرداند */
  static getAll() {
    return surahList.map((_, i) => this.get(i))
  }

  private get surahTuple() {
    return surahList[this.index]
  }

  /** شماره سوره برای نمایش به کاربر */
  get number() {
    return this.index + 1
  }

  /** سوره قبلی */
  get prev(): Surah | null {
    if (this.index <= 0) return null
    return Surah.get(this.index - 1)
  }

  /** سوره بعدی */
  get next(): Surah | null {
    if (this.index >= COUNT_OF_SURAHS - 1) return null
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
    return this.index !== 0 && this.index !== 8
  }
}
