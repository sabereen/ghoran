import fs from 'node:fs'
import { resolvePath } from './utils'
import { Ayah } from '../../../entity/dist/index.mjs'

export function extractQPCTextV2(name: string) {
  const path = resolvePath(`raw-text/qpc-v2-word-by-word.json`)
  const text = fs.readFileSync(path).toString()
  const wordsArray = JSON.parse(text)

  let ayat: string[] = []
  for (let i = 0; i < 6236; i++) {
    const ayah = Ayah.get(i)
    ayat[i] = ''
    for (let j = 1; true; j++) {
      const key = ayah.key + ':' + j
      if (wordsArray[key]) {
        ayat[i] += wordsArray[key].text
      } else break
    }
  }

  return ayat
}
