/** دو تایی نشاندهنده‌ی شماره سوره و آیه */
export type SurahAyah = [surahNumber: number, ayahNumber: number]

/** مشخصات یک سوره در قالب یک آرایه‌ی چندتایی */
export type SurahTuple = [
  /** اندیس اوّلین آیه */
  start: number,
  /**‌ تعداد آیات سوره */
  ayaCount: number,
  /** ترتیب نزول */
  order: number,
  /** تعداد رکوع سوره */
  rukuCount: number,
  /** نام عربی سوره */
  name: string,
  /** نام سوره به لاتین */
  enName: string,
  /** ترجمه انگلیسی نام سوره */
  enMeaning: string,
  /** آیا سوره مدنی است؟ */
  isMedinan: boolean,
]

/** آیه سجده دار */
export type SajdahTuple = [
  /** شماره سوره */
  surahNumber: number,
  /** شماره آیه */
  ayahNumber: number,
  /** آیا سجده واجب است؟ */
  isObligatory: boolean,
]
