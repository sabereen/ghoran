/**
 * نوع متن قرآن
 *
 * tanzil-simple-clean: متن بدون علامت، مناسب برای جستجو
 * tanzil-simple-min: متن کم علامت، برای کپی و اشتراک گذاری در برنامه‌های مختلف
 * imla: رسم الاملا
 * hafs: رسم الخط عثمان طه اصلی - باید با فونت مربوطه استفاده شود
 * hafs-v13: رسم الخط عثمان طه اصلی نسخه قدیمی - باید با فونت مربوطه استفاده شود
 */
export type QuranTextType =
  | 'tanzil-simple-clean'
  | 'tanzil-simple-min'
  | 'imla'
  | 'hafs'
  | 'hafs-v13'
  | 'qpc-v1'
  | 'qpc-v2'

/**
 * مشخصات رسم الخط
 */
export type QuranTextMeta = {
  name: QuranTextType
}
