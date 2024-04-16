import fs from 'fs-extra'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

import { copyQuranTexts as readQuranText } from './copy-text'
import { extractHafsV13 } from './extract-hafs-v13'
import { extractHafsV22 } from './extract-hafs-v22'
import { extractTanzilText } from './extract-tanzil'
import { QuranTextType } from '../src/types'

const dirname = fileURLToPath(new URL('./', import.meta.url))

const r = (path: string) => resolve(dirname, path)

const texts: Record<QuranTextType, string[]> = {
  'hafs-v13': await extractHafsV13(),
  hafs: await extractHafsV22(),
  'tanzil-simple-clean': extractTanzilText('simple-clean'),
  'tanzil-simple-min': extractTanzilText('simple-min'),
  imla: readQuranText('quran-text-emla'),
}

for (let key in texts) {
  const finalPath = r(`../json/quran-text-${key}.json`)
  fs.writeJSONSync(finalPath, texts[key as QuranTextType], { spaces: 2 })
}

// extractTanzilText('simple')
// extractTanzilText('simple-plain')
