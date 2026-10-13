import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const work = join(root, 'work')
await mkdir(work, { recursive: true })
const temporary = await mkdtemp(join(work, 'check-packages-'))

function run(command, args, cwd = root) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    })
  } catch (error) {
    console.error(error.stdout?.toString().slice(-4000))
    console.error(error.stderr?.toString().slice(-4000))
    throw error
  }
}

try {
  const tarballs = join(temporary, 'tarballs')
  run('pnpm', [
    '-r',
    '--filter=./packages/*',
    'pack',
    '--pack-destination',
    tarballs,
  ])
  const dependencies = {}
  for (const directory of await readdir(join(root, 'packages'))) {
    const path = join(root, 'packages', directory, 'package.json')
    let pkg
    try {
      pkg = JSON.parse(await readFile(path, 'utf8'))
    } catch (error) {
      if (error.code === 'ENOENT') continue
      throw error
    }
    dependencies[pkg.name] =
      `file:${join(tarballs, `${pkg.name.replace(/^@/, '').replace('/', '-')}-${pkg.version}.tgz`)}`
  }
  assert.equal(Object.keys(dependencies).length, 6)
  const consumer = join(temporary, 'consumer')
  await mkdir(consumer)
  await writeFile(
    join(consumer, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies,
    }),
  )
  await writeFile(
    join(consumer, 'pnpm-workspace.yaml'),
    JSON.stringify({
      packages: [],
      overrides: dependencies,
    }),
  )
  // Install actual tarballs, with no workspace links, source aliases, or network.
  run(
    'pnpm',
    [
      'install',
      '--offline',
      '--ignore-scripts',
      '--store-dir',
      join(temporary, 'store'),
    ],
    consumer,
  )
  await writeFile(
    join(consumer, 'check.mjs'),
    `
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { Ayah, Surah } from '@ghoran/entity'
import { surahList } from '@ghoran/metadata'
import { COUNT_OF_AYAHS } from '@ghoran/metadata/constants'
import { loadText } from '@ghoran/text'
import { searchBinaryForAyah } from '@ghoran/utils'
import '@ghoran/font-page'
import '@ghoran/translation'

assert.equal(COUNT_OF_AYAHS, 6236)
assert.equal(Surah.getAll().length, 114)
assert.equal(surahList.length, 114)
assert.equal(Ayah.get(7).key, '2:1')
assert.equal(Ayah.get(7).surah, Ayah.get(7).surah)
assert.equal(Ayah.get(7).page.number, 2)
assert.equal(searchBinaryForAyah([0, 7, 293], 8), 1)
for (const type of ['hafs', 'hafs-v13', 'hafs-v3', 'imla', 'tanzil-simple-clean', 'tanzil-simple-min', 'qpc-v1', 'qpc-v2']) {
  const text = await loadText(type)
  assert.equal(text.length, 6236, type)
  assert(text.every(ayah => typeof ayah === 'string' && ayah.length > 0), type)
}
for (const path of [
  '@ghoran/text/fonts/uthmanic-hafs-v3/style.css',
  '@ghoran/text/fonts/uthmanic-hafs-v3/uthmanic-hafs-v3.woff2',
  '@ghoran/text/fonts/uthmanic-hafs/style.css',
  '@ghoran/font-page/fonts/qpc-v1/woff2/p1.woff2',
  '@ghoran/font-page/fonts/qpc-v2/woff2/p604.woff2',
]) await access(new URL(import.meta.resolve(path)))
const rawText = JSON.parse(await readFile(new URL(import.meta.resolve('@ghoran/text/json/quran-text-hafs-v3.json')), 'utf8'))
assert.equal(rawText.length, 6236)
const translation = JSON.parse(await readFile(new URL(import.meta.resolve('@ghoran/translation/json/fa/tanzil-fooladvand.json')), 'utf8'))
assert.equal(translation.length, 6236)
assert(translation.every(ayah => typeof ayah === 'string' && ayah.length > 0))
`,
  )
  run(process.execPath, ['check.mjs'], consumer)
  await writeFile(
    join(consumer, 'check.ts'),
    `
import { Ayah } from '@ghoran/entity'
import { surahList, type SurahTuple } from '@ghoran/metadata'
import { COUNT_OF_AYAHS } from '@ghoran/metadata/constants'
import { loadText, type QuranTextType } from '@ghoran/text'
import { searchBinaryForAyah } from '@ghoran/utils'
import type { Language, Translators } from '@ghoran/translation'
import '@ghoran/font-page'
const key: string = Ayah.get(0).key
const surah: SurahTuple = surahList[0]
const count: number = COUNT_OF_AYAHS
const edition: QuranTextType = 'hafs-v3'
const text: Promise<string[]> = loadText(edition)
const index: number = searchBinaryForAyah([0, 7], 1)
const language: Language = 'fa'
const translator: Translators<'fa'> = 'tanzil-fooladvand'
`,
  )
  await writeFile(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        types: [],
        lib: ['ES2022', 'DOM'],
      },
      include: ['check.ts'],
    }),
  )
  run(process.execPath, [
    join(root, 'node_modules/typescript/bin/tsc'),
    '-p',
    consumer,
  ])
  console.log(
    'All 6 packed packages passed ESM, declarations, lazy text, translation, and font checks.',
  )
} finally {
  await rm(temporary, { recursive: true, force: true })
}
