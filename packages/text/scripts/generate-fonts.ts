/**
 * @packageDocumentation
 * در این فایل ابتدا فونت‌ها را به پوشه دیست کپی می‌کنیم
 * سپس فایل‌های woff2 متناظرشان را نیز تولید می‌کنیم.
 */
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { compress } from 'wawoff2'
import { ensureDir, ensureFile, copy, emptyDir } from 'fs-extra/esm'

const dirname = fileURLToPath(new URL('.', import.meta.url))

const r = (path: string) => resolve(dirname, path)

const fontsDirectoryDist = r('../dist/fonts')

// #region copy fonts to dist
await ensureDir(fontsDirectoryDist)
await emptyDir(fontsDirectoryDist)
await copy(r('../fonts'), fontsDirectoryDist, { overwrite: true })
// #endregion

// #region convert ttf fonts to woff2
await convertToWoff2('uthmanic-hafs/uthmanic-hafs-v22.ttf')
await convertToWoff2('uthmanic-hafs-v13/uthmanic-hafs-v13.ttf')
await convertToWoff2('uthmanic-hafs-v13/uthmanic-hafs-v13-bold.ttf')
// #endregion

async function convertToWoff2(
  ttfPath: string,
  woff2Path = ttfPath.replace(/ttf$/, 'woff2'),
) {
  const ttfFullPath = resolve(fontsDirectoryDist, ttfPath)
  const woff2FullPath = resolve(fontsDirectoryDist, woff2Path)
  const ttf = await readFile(ttfFullPath)
  const woff2 = await compress(ttf)
  await ensureFile(woff2FullPath)
  await writeFile(woff2FullPath, woff2)
}
