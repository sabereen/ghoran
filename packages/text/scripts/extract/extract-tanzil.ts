/**
 * @packageDocumentation
 * این اسکریپت فایل‌های متن خام ارائه شده توسط سایت تنزیل را می‌خواند
 * و فایل‌های جیسون برای استفاده در کتابخانه تولید می‌کند.
 * چرا که به دلایل مجوزی ما حق تغییر متن فایل تنزیل و انتشار مجدد آن را نداریم
 * فلذا متن اصلی را درون ریپازیتوری قرار داده‌ایم و از طریق این اسکریپت اصلاحیه‌های لازم را اعمال می‌کنیم
 */
import fs from 'node:fs'
import { resolvePath } from './utils'

export function extractTanzilText(name: string) {
  const path = resolvePath(`raw-text/tanzil/${name}.txt`)
  const text = fs.readFileSync(path).toString()
  const textAsArray = text.split(/\r?\n/g).slice(0, 6236)
  return textAsArray
}
