import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const dirname = fileURLToPath(new URL('./', import.meta.url))

// مسیری را می‌گیرد و یک مسیر مطلق از پوشه روت همین پکیج (پکیج متن) بر می‌گرداند
export const resolvePath = (path: string) => resolve(dirname, '../..', path)
