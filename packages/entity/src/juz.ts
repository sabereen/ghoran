import { Ayah, Page, Surah } from '.'
import { juzList } from '@ghoran/metadata'
import { COUNT_OF_AYAHS } from '@ghoran/metadata/constants'

const cache = new Map<number, Juz>()

/** جزء */
export class Juz {
  protected constructor(readonly index: number) {
    if (index < 0 || index >= juzList.length)
      throw new Error(`Ayah index is not valid. (${index})`)
  }

  /**
   * اندیس جزء را می‌گیرد و آبجکت جزء را بر می‌گرداند
   * @param index - اندیس جزء که همواره یک واحد از شماره جزء کمتر است
   * @returns شیء جزء
   */
  static get(index: number) {
    let juz = cache.get(index)
    if (!juz) {
      juz = new this(index)
      cache.set(index, juz)
    }
    return juz
  }

  /** تمام جزءهای قرآن را بر می‌گرداند */
  static getAll() {
    return juzList.map((_, index) => this.get(index))
  }

  /** شماره جزء جهت نمایش به کاربر */
  get number() {
    return this.index + 1
  }

  /** اندیس اولین آیه‌ی جزء */
  get firstAyahIndex() {
    return juzList[this.index]
  }

  /** آبجکت اولین آیه‌ی جزء */
  get firstAyah() {
    return Ayah.get(this.firstAyahIndex)
  }

  /** اندیس آخرین آیه جزء */
  get lastAyahIndex(): number {
    return (this.next?.firstAyahIndex ?? COUNT_OF_AYAHS) - 1
  }

  /** آبجکت آخرین آیه جزء */
  get lastAyah() {
    return Ayah.get(this.lastAyahIndex)
  }

  /** جزء بعدی */
  get next(): Juz | null {
    if (this.index >= 29) return null
    return Juz.get(this.index + 1)
  }

  /** جزء قبلی */
  get prev(): Juz | null {
    if (this.index <= 0) return null
    return Juz.get(this.index - 1)
  }

  /** تعداد آیات جزء */
  get ayahCount() {
    return this.lastAyahIndex - this.firstAyahIndex + 1
  }

  /** لیست سوره‌هایی که در این جزء وجود دارند */
  getSurahList() {
    const list: Surah[] = []
    let surah: Surah | null = this.firstAyah.surah
    do {
      list.push(surah)
      surah = surah?.next
    } while (surah?.firstAyah.juzIndex === this.index)

    return list
  }

  /** لیست صفحاتی که در این جزء وجود دارند */
  getPages() {
    const list: Page[] = []
    for (
      let page = this.firstAyah.page as Page | null;
      page?.firstAyah.juzIndex === this.index;
      page = page.next
    ) {
      list.push(page)
    }
    return list
  }
}
