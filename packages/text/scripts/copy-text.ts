/**
 * @packageDocumentation
 * این اسکریپت فایل‌های متن قرآن که نیازی به تغییر ندارند را در پوشه جیسون کپی می‌کند
 */
import fs from 'fs-extra'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const dirname = fileURLToPath(new URL('./', import.meta.url))

const r = (path: string) => resolve(dirname, path)

export function copyQuranTexts() {
  fs.copySync(r(`../raw-text/copy`), r(`../json`))
}
