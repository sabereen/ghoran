import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = fileURLToPath(new URL('.', import.meta.url))

function r(p: string) {
  return resolve(dirname, p)
}

export const alias: Record<string, string> = {
  '@ghoran/text/fonts': r('./packages/text/dist/fonts'),
  '@ghoran/text': r('./packages/text/src/'),
  '@ghoran/metadata': r('./packages/metadata/src/'),
  '@ghoran/entity': r('./packages/entity/src/'),
  '@ghoran/utils': r('./packages/utils/src/'),
}
