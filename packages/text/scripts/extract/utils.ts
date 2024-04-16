import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const dirname = fileURLToPath(new URL('./', import.meta.url))

export const resolvePath = (path: string) => resolve(dirname, '../..', path)
