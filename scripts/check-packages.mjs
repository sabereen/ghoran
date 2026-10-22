import assert from 'node:assert/strict'
import { verifySearchBrowser } from './check-search-browser.mjs'
import { verifyAudioBundles } from './check-audio-bundles.mjs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
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
// Keep live tarballs/install fixtures away from workspace synchronizers. Only
// closed package contents should be consumed by the real offline installation.
const temporary = await mkdtemp(join(tmpdir(), 'ghoran-check-packages-'))

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
  assert(dependencies['@ghoran/search'], 'search package must be packed')
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
import { createQuranSearch, normalizeArabic, getHighlightSegments } from '@ghoran/search'
import { parhizgar, ansarian, createAudioNormalizer, dbToLinearGain } from '@ghoran/audio-analysis'
import directParhizgar from '@ghoran/audio-analysis/sources/parhizgar'
import broadcastParhizgar from '@ghoran/audio-analysis/targets/-23/parhizgar'
import { audioSources } from '@ghoran/audio-analysis/catalog'
import { loadAudioSource, loadAudioContentManifest } from '@ghoran/audio-analysis/load'
import { getVerifiedAudioGain } from '@ghoran/audio-analysis/verify'
import { datasetCoverage, createGainLookup } from '@ghoran/audio-analysis/legacy'
assert.equal(audioSources.length, 13)
assert.equal(datasetCoverage.expected_total, 81068)
assert.equal(dbToLinearGain(0), 1)
assert.equal(directParhizgar, parhizgar)
assert.equal(broadcastParhizgar.targetLufs, -23)
assert.equal(await loadAudioSource('parhizgar'), parhizgar)
const normalizer = createAudioNormalizer({ sources: [parhizgar, ansarian] })
assert.equal(normalizer.getGain('parhizgar', '1:1'), parhizgar.getGain({ surah: 1, ayah: 1 }))
assert.equal(parhizgar.getGain('39:71'), null)
assert.equal(ansarian.getGainDb(166), -3.55)
const audioHashes = await loadAudioContentManifest('parhizgar')
const audioHash = audioHashes.getHash('1:1')
assert.equal(getVerifiedAudioGain(parhizgar, audioHashes, '1:1', audioHash), parhizgar.getGain('1:1'))
assert.equal(getVerifiedAudioGain(parhizgar, audioHashes, '1:1', '0'.repeat(64)), null)
for (const source of audioSources) {
  const hashes = await loadAudioContentManifest(source.id)
  assert.equal(hashes.getHash(1).length, 64)
  for (const targetLufs of [-23, -20, -18, -16]) {
    const profile = await loadAudioSource(source.id, { targetLufs })
    assert.equal(profile.id, source.id)
    assert.equal(profile.targetLufs, targetLufs)
    assert(profile.getGain(1) > 0)
  }
}
assert.equal(createGainLookup({ schema_version: '1.0.0', source_id: 'fixture', target_playback_lufs: -20,
 provisional: false, fields: ['ordinal','gain_db','content_sha256'], values: [[1, 0, audioHash]] }).get(1, audioHash).gainLinear, 1)
await assert.rejects(access(new URL('../data', import.meta.resolve('@ghoran/audio-analysis'))))
import { createBrowserQuranSearch } from '@ghoran/search/browser'
assert.equal(normalizeArabic('ٱلرَّحِيمِ'), 'الرحيم')
const search = await createQuranSearch()
const result = await search.search('الرحمن الرحيم', { scope: { surahs: [1] } })
assert.deepEqual(result.hits.map(hit => hit.key), ['1:1', '1:3'])
const display = (await loadText('hafs-v3'))[0]
const segments = getHighlightSegments(display, result.hits[0])
assert.equal(segments.map(segment => segment.text).join(''), display)
assert.equal(segments.filter(segment => segment.highlighted).map(segment => segment.text).join(''), 'ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ')
const direct = await createBrowserQuranSearch({ corpus: ['الله'] })
assert.equal(direct.execution, 'direct')
direct.dispose(); search.dispose()
await access(new URL(import.meta.resolve('@ghoran/search/worker')))
const { Worker } = await import('node:worker_threads')
for (const withoutSegmenter of [false, true]) {
const thread = new Worker(new URL('./thread.mjs', import.meta.url), { type: 'module', workerData: { withoutSegmenter } })
const listeners = new Map()
const wrapper = {
  postMessage: message => thread.postMessage(message),
  terminate: () => { void thread.terminate() },
  addEventListener(type, listener) {
    const callback = type === 'message' ? data => listener({ data }) : error => listener({ message: error.message })
    listeners.set(type, callback); thread.on(type, callback)
  },
  removeEventListener(type, listener) { thread.off(type, listeners.get(type)); listeners.delete(type) },
}
const remote = await createBrowserQuranSearch({ workerFactory: () => wrapper })
try {
  assert.deepEqual(await remote.search('الرحمن الرحيم', { scope: { surahs: [1] } }), result)
  const partial = (await remote.search('سم', { mode: 'substring', scope: { ayahIndices: [0] } })).hits[0]
  assert.equal(partial.sourceText.slice(partial.matches[0].sourceStart, partial.matches[0].sourceEnd), withoutSegmenter ? 'بسم' : 'سم')
}
finally { remote.dispose() }
}

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
  await writeFile(
    join(consumer, 'thread.mjs'),
    `
import { parentPort, workerData } from 'node:worker_threads'
if (workerData?.withoutSegmenter) Intl.Segmenter = undefined
globalThis.postMessage = message => parentPort.postMessage(message)
globalThis.addEventListener = (_, listener) => parentPort.on('message', data => listener({ data }))
await import('@ghoran/search/worker')
`,
  )
  run(process.execPath, ['check.mjs'], consumer)
  await writeFile(
    join(consumer, 'check.ts'),
    `
import { parhizgar, ansarian, createAudioNormalizer, type AudioSourceProfile } from '@ghoran/audio-analysis'
import { getVerifiedAudioGain } from '@ghoran/audio-analysis/verify'
const audio = createAudioNormalizer({ sources: [parhizgar, ansarian] })
const profile: AudioSourceProfile<'parhizgar'> = parhizgar
const gain: number | null = audio.getGain('parhizgar', '2:255')
// @ts-expect-error Unregistered sources must not type-check.
audio.getGain('husary', 1)
import { Ayah } from '@ghoran/entity'
import { surahList, type SurahTuple } from '@ghoran/metadata'
import { COUNT_OF_AYAHS } from '@ghoran/metadata/constants'
import { loadText, type QuranTextType } from '@ghoran/text'
import { searchBinaryForAyah } from '@ghoran/utils'
import { createQuranSearch, normalizeArabic, getHighlightSegments, type SearchHit, type SearchResponse } from '@ghoran/search'
import { createBrowserQuranSearch, type WorkerTransport } from '@ghoran/search/browser'
const engine = await createQuranSearch()
const response: SearchResponse = await engine.search(normalizeArabic('ٱللَّهُ'))
const hit: SearchHit = response.hits[0]
getHighlightSegments(hit.sourceText, hit)
const browser = await createBrowserQuranSearch({ workerFactory: () => new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' }) })
engine.dispose(); browser.dispose()
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
  // Check that importing the core needs no DOM ambient types.
  await writeFile(
    join(consumer, 'check-node.ts'),
    `
import { parhizgar, type AudioRecommendation } from '@ghoran/audio-analysis'
import { loadAudioSource } from '@ghoran/audio-analysis/load'
const gain: number | null = parhizgar.getGain('1:1')
const recommendation: AudioRecommendation = (await loadAudioSource('ansarian')).getRecommendation(1)
import { createQuranSearch, normalizeArabic, getHighlightSegments } from '@ghoran/search'
const search = await createQuranSearch()
const result = await search.search(normalizeArabic('ٱللَّهُ'))
getHighlightSegments(result.hits[0].sourceText, result.hits[0])
search.dispose()
`,
  )
  await writeFile(
    join(consumer, 'tsconfig.node.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        types: [],
        lib: ['ES2022'],
      },
      include: ['check-node.ts'],
    }),
  )
  run(process.execPath, [
    join(root, 'node_modules/typescript/bin/tsc'),
    '-p',
    join(consumer, 'tsconfig.node.json'),
  ])
  await verifyAudioBundles(consumer)
  await verifySearchBrowser(consumer, process.argv.includes('--browser'))
  console.log(
    `All ${Object.keys(dependencies).length} packed packages passed ESM, declarations, lazy text, search, worker, translation, and font checks.`,
  )
} finally {
  await rm(temporary, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  })
}
