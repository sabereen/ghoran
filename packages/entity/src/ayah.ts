import { juzList, pageList, sajdahMap, surahList } from '@ghoran/metadata'
import { searchBinaryForAyah, simpleCache } from '@ghoran/utils'
import { COUNT_OF_AYAHS } from '@ghoran/metadata/constants'
import { Surah, Page } from '.'

const cache = new Map<number, Ayah>()

/**‌ آیه */
export class Ayah {
  protected constructor(readonly index: number) {
    if (index < 0 || index >= COUNT_OF_AYAHS)
      throw new Error('Ayah index is not valid.')
  }

  static get(index: number) {
    let ayah = cache.get(index)
    if (!ayah) {
      ayah = new this(index)
      cache.set(index, ayah)
    }
    return ayah
  }

  /** گرفتن آبجکت آیه بر اساس شماره سوره و شماره آیه در آن سوره */
  static getBySurahNumber(surahNumber: number, ayahNumberInSurah: number) {
    const surah = surahList[surahNumber - 1]
    if (!surah) return null
    const index = surah[0] + ayahNumberInSurah
    return this.get(index)
  }

  protected get class() {
    return this.constructor as typeof Ayah
  }

  /** کلید آیه که به صورت 2:1 مثلا برای آیه 1 از سوره 2 استفاده می‌شود */
  get key() {
    return `${this.surahNumber}:${this.ayahNumber}`
  }

  /** آیه‌ی قبلی */
  get prev(): Ayah | null {
    if (this.index <= 0) return null
    return this.class.get(this.index - 1)
  }

  /** آیه بعدی */
  get next(): Ayah | null {
    if (this.index >= COUNT_OF_AYAHS - 1) return null
    return this.class.get(this.index + 1)
  }

  /** آبجکت سوره‌ی مربوط به آیه */
  @simpleCache()
  get surah() {
    return Surah.getByAyahIndex(this.index)
  }

  /** شماره سوره برای نمایش به کاربر */
  get surahNumber() {
    return this.surah.index + 1
  }

  /** شماره آیه برای نمایش به کاربر */
  get ayahNumber() {
    return this.index - this.surah.firstAyahIndex + 1
  }

  /** اندیس جزء */
  @simpleCache()
  get juzIndex() {
    return searchBinaryForAyah(juzList, this.index)
  }

  /** شماره جزء برای نمایش به کاربر */
  get juzNumber() {
    return this.juzIndex + 1
  }

  /** اندیس صفحه */
  @simpleCache()
  get pageIndex() {
    return searchBinaryForAyah(pageList, this.index)
  }

  /** آبجکت صفحه */
  get page() {
    return Page.get(this.pageIndex)
  }

  /** شماره صفحه برای نمایش به کاربر */
  get pageNumber() {
    return this.pageIndex + 1
  }

  /** آیا سجده دارد؟ */
  get sajdah() {
    return this.index in sajdahMap
  }

  /** آیا سجده واجب دارد */
  get obligatorySajdah() {
    return sajdahMap[this.index] === true
  }

  /** آیا این آیه اوّلین آیه‌ی سوره است؟ */
  get isFirstOfSurah() {
    return this.ayahNumber === 1
  }
}
