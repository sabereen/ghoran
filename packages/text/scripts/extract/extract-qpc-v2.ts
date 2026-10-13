import fs from 'node:fs'
import { resolvePath } from './utils'
import { surahList } from '../../../metadata/src/surah'

export function extractQPCTextV2(name: string) {
  const path = resolvePath(`raw-text/qpc-v2-word-by-word.json`)
  const text = fs.readFileSync(path).toString()
  const wordsArray = JSON.parse(text)

  let ayat: string[] = []
  for (const [surahIndex, [start, count]] of surahList.entries()) {
    for (let number = 1; number <= count; number++) {
      const index = start + number - 1
      ayat[index] = ''
      for (let word = 1; true; word++) {
        const key = `${surahIndex + 1}:${number}:${word}`
        if (!wordsArray[key]) break
        ayat[index] += wordsArray[key].text
      }
    }
  }

  return ayat
}
