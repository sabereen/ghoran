/**
 * @packageDocumentation
 * در این فایل اسکریپتی نوشته ایم که به صورت خودکار
 * تمام ترجمه‌های موجود در سایت تنزیل را دانلود کرده و در پوشه‌ی ترجمه‌ها می‌ریزد
 */
import fs from 'fs-extra'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const dirname = fileURLToPath(new URL('.', import.meta.url))

const r = (path: string) => resolve(dirname, path)

type TranslationItem = {
  /** لینک دانلود فایل */
  link: string
  /** اسم دو حرفی زبان ترجمه */
  language: string
  /** نام مترجم */
  translator: string
}

/**
 * لیست ترجمه‌های موجود در سایت تنزیل را می‌خواند و بر می‌گرداند
 **/
async function fetchList(): Promise<TranslationItem[]> {
  // sample of download liks: `https://tanzil.net/trans/?transID=sq.nahi&type=txt`
  // sample of hrefs: `<a href="/trans/sq.nahi"`
  const htmlOfPage = await fetch('https://tanzil.net/trans/').then((r) =>
    r.text(),
  )
  const linkStrings = htmlOfPage.matchAll(/href="\/trans\/(.*?)"/g)
  const translationItems = [...linkStrings]
    .map((item) => item[1])
    .filter((tr) => tr && !tr.startsWith('log'))

  const links = translationItems.map((name) => ({
    link: `https://tanzil.net/trans/?transID=${name}&type=txt`,
    language: name.split('.')[0],
    translator: name.split('.')[1],
  }))

  return links
}

/**
 * لیست لینک‌ها را می‌گیرد و دانلود می‌کند
 * @param items - لیست آیتم‌ها برای دانلود
 */
async function downloadLinks(items: TranslationItem[]) {
  for (const item of items) {
    const dir = r(`../json/${item.language}`)
    const fullPath = resolve(dir, `tanzil-${item.translator}.json`)

    const isExists = await fs.exists(fullPath)
    if (isExists) continue

    console.log(
      `downloading tanzil translation ${item.language}.${item.translator}`,
    )

    const text = await fetch(item.link).then((r) => r.text())
    const textAsArray = text.split(/\r?\n/)
    textAsArray.length = 6236

    await fs.ensureDir(dir)
    await fs.writeFile(fullPath, JSON.stringify(textAsArray, null, 2))
  }
}

/**
 * تولید تایپ‌های تایپ‌اسکریپت بر اساس لیست ترجمه ها
 * @param items - لیست آیتم‌ها برای تولید تایپ
 */
async function generateTypes(items: TranslationItem[]) {
  const itemsMap: Record<string, string[]> = {}

  items.forEach((item) => {
    itemsMap[item.language] ||= []
    itemsMap[item.language].push(item.translator)
  })

  const code = Array.from(Object.keys(itemsMap))
    .map((language) => {
      const translators = itemsMap[language]
        .map((translator) => `'tanzil-${translator}'`)
        .join(' | ')
      return `${language}: ${translators}`
    })
    .join('\n  ')

  const finalCode = `export type Translations = {\n  ${code}\n}\n`

  await fs.writeFile(r('../src/generated-types.ts'), finalCode)
}

/**
 * تمامی ترجمه‌های موجود در سایت تنزیل را دانلود می‌کند
 * و در پوشه‌ی مربوطه ذخیره می‌کند
 */
async function fetchListAndDownload() {
  const list = await fetchList()
  await generateTypes(list)
  await downloadLinks(list)
}

fetchListAndDownload()
