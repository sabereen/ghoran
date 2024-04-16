/**
 * @packageDocumentation
 * این اسکریپت فایل‌های متن قرآن که نیازی به تغییر ندارند را در پوشه جیسون کپی می‌کند
 */
import fs from 'fs-extra'
import { resolvePath } from './utils'

export function copyQuranTexts(name: string) {
  const path = resolvePath(`raw-text/copy/${name}.json`)
  const ayat = fs.readJSONSync(path) as string[]
  return ayat
}
