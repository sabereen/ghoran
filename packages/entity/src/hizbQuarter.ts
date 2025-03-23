import { Ayah } from '.'
import { hizbQuarterList } from '@ghoran/metadata'
import { COUNT_OF_AYAHS } from '@ghoran/metadata/constants'

/** تعداد ربع حزب‌ها در هر جزء */
const HIZB_QUARTER_IN_JUZ = 8

const cache = new Map<number, HizbQuarter>()

/** یک چهارم حزب */
export class HizbQuarter {
  protected constructor(readonly index: number) {
    if (index < 0 || index >= hizbQuarterList.length)
      throw new Error(`Hizb quarter index is not valid. (${index})`)
  }

  /**
   * اندیس ربع‌حزب را می‌گیرد و آبجکت ربع‌حزب را بر می‌گرداند
   * @param index - اندیس ربع‌حزب که همواره یک واحد از شماره ربع‌حزب کمتر است
   * @returns شیء ربع‌حزب
   */
  static get(index: number) {
    let juz = cache.get(index)
    if (!juz) {
      juz = new this(index)
      cache.set(index, juz)
    }
    return juz
  }

  /** تمام ربع حزب‌های قرآن را بر می‌گرداند */
  static getAll() {
    return hizbQuarterList.map((_, index) => this.get(index))
  }

  /** تمام ربع حزب‌های جزء مورد نظر را بر می‌گرداند */
  static getAllInJuz(juzIndex: number) {
    const startHizbQuarterIndex = juzIndex * HIZB_QUARTER_IN_JUZ
    const list: HizbQuarter[] = []
    for (let i = 0; i < HIZB_QUARTER_IN_JUZ; i++) {
      list.push(new this(startHizbQuarterIndex + i))
    }
    return list
  }

  protected get class() {
    return this.constructor as typeof HizbQuarter
  }

  /** ربع حزب فعلی چندمین ربع‌حزب مربوط به حزب است؟ */
  get number() {
    return (this.index % 4) + 1
  }

  /** شماره حزب مربوط به این ربع‌حزب */
  get hizbNumber() {
    return Math.floor(this.index / 4) + 1
  }

  /** اندیس جزئی که این ربع‌حزب در آن قرار دارد */
  get juzIndex() {
    return this.firstAyah.juzIndex
  }

  /** آبجکت جزئی که این ربع حزب متعلق به آن است */
  get juz() {
    return this.firstAyah.juz
  }

  /** اندیس اولین آیه‌ی ربع‌حزب */
  get firstAyahIndex() {
    return hizbQuarterList[this.index]
  }

  /** آبجکت اولین آیه‌ی ربع‌حزب */
  get firstAyah() {
    return Ayah.get(this.firstAyahIndex)
  }

  /** اندیس آخرین آیه ربع‌حزب */
  get lastAyahIndex(): number {
    return (this.next?.firstAyahIndex ?? COUNT_OF_AYAHS) - 1
  }

  /** آبجکت آخرین آیه ربع‌حزب */
  get lastAyah() {
    return Ayah.get(this.lastAyahIndex)
  }

  /** ربع‌حزب بعدی */
  get next(): HizbQuarter | null {
    if (this.index >= 29) return null
    return this.class.get(this.index + 1)
  }

  /** ربع‌حزب قبلی */
  get prev(): HizbQuarter | null {
    if (this.index <= 0) return null
    return this.class.get(this.index - 1)
  }

  /** تعداد آیات ربع‌حزب */
  get ayahCount() {
    return this.lastAyahIndex - this.firstAyahIndex + 1
  }
}
