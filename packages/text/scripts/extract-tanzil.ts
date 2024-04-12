/**
 * @packageDocumentation
 * این اسکریپت فایل‌های متن خام ارائه شده توسط سایت تنزیل را می‌خواند
 * و فایل‌های جیسون برای استفاده در کتابخانه تولید می‌کند.
 * چرا که به دلایل مجوزی ما حق تغییر متن فایل تنزیل و انتشار مجدد آن را نداریم
 * فلذا متن اصلی را درون ریپازیتوری قرار داده‌ایم و از طریق این اسکریپت اصلاحیه‌های لازم را اعمال می‌کنیم
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const dirname = fileURLToPath(new URL('./', import.meta.url))

const r = (path: string) => resolve(dirname, path)

export function extractTanzilText(name: string) {
  const path = r(`../raw-text/tanzil/${name}.txt`)
  const text = fs.readFileSync(path).toString()
  const textAsArray = text.split('\n').slice(0, 6236)
  const finalPath = r(`../json/${name}-tanzil.json`)
  fs.writeFileSync(finalPath, JSON.stringify(textAsArray, null, 2))
}
