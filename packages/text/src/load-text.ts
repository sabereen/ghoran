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
    case 'tanzil-simple-clean':
      return import('../json/quran-text-tanzil-simple-clean.json')
    case 'tanzil-simple-min':
      return import('../json/quran-text-tanzil-simple-min.json')
    case 'imla':
      return import('../json/quran-text-imla.json')
    case 'hafs':
      return import('../json/quran-text-hafs.json')
    case 'hafs-v13':
      return import('../json/quran-text-hafs-v13.json')
    case 'qpc-v1':
      return import('../json/quran-text-qpc-v1.json')
    case 'qpc-v2':
      return import('../json/quran-text-qpc-v2.json')
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
  const cacheKey = `/${cachePrefix}/quran-text/${type}?v=0.2`
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
