import fs from 'fs-extra/esm'
import { resolvePath } from './extract/utils'
import { fixedTexts } from './homogenization-word-offset'
import { QuranTextType } from '../src/types'

for (let key in fixedTexts) {
  const finalPath = resolvePath(`json/quran-text-${key}.json`)
  fs.writeJSONSync(finalPath, fixedTexts[key as QuranTextType], { spaces: 2 })
}
