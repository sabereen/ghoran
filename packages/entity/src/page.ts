import { pageList } from '@ghoran/metadata'
import { COUNT_OF_AYAHS, COUNT_OF_PAGES } from '@ghoran/metadata/constants'
import { Ayah } from '.'

const cache = new Map<number, Page>()

/**‌ صفحه */
export class Page {
  protected constructor(readonly index: number) {
    if (index < 0 || index >= COUNT_OF_PAGES)
      throw new Error('Page index is not valid.')
  }

  /**
   * اندیس صفحه را می‌گیرد و آبجکت صفحه را بر می‌گرداند
   * @param index - اندیس صفحه که همواره یک واحد از شماره صفحه کمتر است
   * @returns شیء صفحه
   */
  static get(index: number) {
    let page = cache.get(index)
    if (!page) {
      page = new Page(index)
      cache.set(index, page)
    }
    return page
  }

  /**
   * لیست کل صفحات قرآن
   */
  static getAll() {
    return pageList.map((_, i) => this.get(i))
  }

  /**
   * شماره صفحه جهت نمایش به کاربر
   * @deprecated use `number` instead
   */
  get pageNumber() {
    return this.number
  }

  /** شماره صفحه جهت نمایش به کاربر */
  get number() {
    return this.index + 1
  }

  /** صفحه‌ی قبلی */
  get prev(): Page | null {
    if (this.index <= 0) return null
    return Page.get(this.index - 1)
  }

  /** صفحه‌ی بعدی */
  get next(): Page | null {
    if (this.index >= COUNT_OF_PAGES - 1) return null
    return Page.get(this.index + 1)
  }

  /** اندیس اوّلین آیه در صفحه */
  get firstAyahIndex(): number {
    return pageList[this.index]
  }

  /** آبجکت اولین آیه در صفحه */
  get firstAyah(): Ayah {
    return Ayah.get(this.firstAyahIndex)
  }

  /** اندیس آخرین آیه در صفحه */
  get lastAyahIndex(): number {
    const nextPage = this.next
    if (nextPage) return nextPage.firstAyahIndex - 1
    return COUNT_OF_AYAHS - 1
  }

  /** آبجکت آخرین آیه در صفحه */
  get lastAyah(): Ayah {
    return Ayah.get(this.lastAyahIndex)
  }

  /** تعداد آیات صفحه */
  get ayahCount() {
    return this.lastAyahIndex - this.firstAyahIndex + 1
  }
}
