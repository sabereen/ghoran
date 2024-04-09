import { QuranTextType } from './types'

/**
 * به علت اینکه از نظر تایپ اسکریپتی ممکن است این فایل
 * درون محیط نودجی‌اس اجرا شود به کش‌استوریج دسترسی نداریم.
 * ما برای اینکه به مشکلی نخوریم آن را تعریف می‌کنیم ولی درون
 * try catch
 * از آن استفاده می‌کنیم که در محیط نود هم مشکلی پیش نیاید.
 */
declare const caches: any

/**
 * مستقیما جیسون مربوط به متن قرآن را ایمپورت می‌کند
 * @param type - نوع متن قرآن
 * @returns خروجی مستقیم ایمپورت پویا
 */
export function importText(
  type: QuranTextType,
): Promise<{ default: string[] }> {
  switch (type) {
    case 'clean':
      return import('../json/quran-text-clean.json')
    case 'simple-min':
      return import('../json/quran-text-simple-min.json')
    case 'imla':
      return import('../json/quran-text-emla.json')
    case 'hafs':
      return import('../json/quran-text-hafs-v22.json')
    case 'hafs-v13':
      return import('../json/quran-text-hafs-v13.json')
  }
}

/**
 * بر اساس نوع ورودی متن قرآن متناظر را بارگیری می‌کند
 * و نتیجه‌ی آن را کش می‌کند
 * @param type - نوع متن قرآن
 */
export async function loadText(
  type: QuranTextType,
  { cacheName = '@ghoran', cachePrefix = '@ghoran' } = {},
): Promise<string[]> {
  const cacheKey = `/${cachePrefix}/quran-text/${type}`
  try {
    const cache = await caches.open(cacheName)
    const response = await cache.match(cacheKey)
    if (response) {
      const text = await response.json()
      return text
    }
  } catch (err) {}
  const result = await importText(type)
  const text = result.default
  try {
    const cache = await caches.open(cacheName)
    await cache.put(
      cacheKey,
      new Response(JSON.stringify(text), {
        headers: { 'content-type': 'application/json' },
      }),
    )
  } finally {
    return text
  }
}
