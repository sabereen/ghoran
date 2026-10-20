import { performance } from 'node:perf_hooks'
import { cpus, platform, arch } from 'node:os'
import { execFileSync } from 'node:child_process'
import { Worker } from 'node:worker_threads'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { createQuranSearch } from '../dist/index.mjs'
import { createBrowserQuranSearch } from '../dist/browser.mjs'

const directory = new URL('../dist/', import.meta.url)
const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const summary = (values) => ({
  medianMs: +median(values).toFixed(3),
  p95Ms: +[...values]
    .sort((a, b) => a - b)
    [Math.floor(values.length * 0.95)].toFixed(3),
})
const cold = Array.from({ length: 5 }, () =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
const start = performance.now()
const { createQuranSearch } = await import(${JSON.stringify(new URL('../dist/index.mjs', import.meta.url).href)})
const search = await createQuranSearch()
console.log(JSON.stringify(performance.now() - start))
search.dispose()
`,
      ],
      { encoding: 'utf8' },
    ),
  ),
)
const warm = []
for (let i = 0; i < 5; i++) {
  const start = performance.now()
  const engine = await createQuranSearch()
  warm.push(performance.now() - start)
  engine.dispose()
}
globalThis.gc?.()
const before = process.memoryUsage().heapUsed
const start = performance.now()
const engine = await createQuranSearch()
const initializationMs = performance.now() - start
globalThis.gc?.()
const heapMiB = (process.memoryUsage().heapUsed - before) / 1024 ** 2
const cases = [
  ['common word', 'الله', {}],
  ['phrase', 'الرحمن الرحيم', {}],
  ['allWords', 'الله رحيم', { mode: 'allWords' }],
  ['anyWord', 'الله رحيم غفور', { mode: 'anyWord' }],
  ['many results', 'من', { limit: 100 }],
  ['single surah', 'الله', { scope: { surahs: [2] } }],
  ['substring', 'رحم', { mode: 'substring' }],
]
async function measure(search, query, options, count = 100) {
  for (let i = 0; i < 10; i++) await search.search(query, options)
  const times = []
  for (let i = 0; i < count; i++) {
    const start = performance.now()
    await search.search(query, options)
    times.push(performance.now() - start)
  }
  return {
    ...summary(times),
    total: (await search.search(query, options)).total,
  }
}
const searches = {}
for (const [name, query, options] of cases)
  searches[name] = await measure(engine, query, options)

// Run the exact published browser worker in a real thread, with a minimal
// worker_threads transport shim. This measures CPU/clone overhead, not browser
// asset downloads, bundler startup, or any Android device's performance.
const workerSource = `
import { parentPort } from 'node:worker_threads'
globalThis.postMessage = data => parentPort.postMessage(data)
globalThis.addEventListener = (_, listener) => parentPort.on('message', data => listener({ data }))
await import(${JSON.stringify(new URL('../dist/worker.mjs', import.meta.url).href)})
`
const workerStart = performance.now()
const worker = await createBrowserQuranSearch({
  workerFactory: () => {
    const thread = new Worker(
      new URL(`data:text/javascript,${encodeURIComponent(workerSource)}`),
    )
    const listeners = new Map()
    return {
      postMessage: (message) => thread.postMessage(message),
      terminate: () => {
        void thread.terminate()
      },
      addEventListener(type, listener) {
        const callback =
          type === 'message'
            ? (data) => listener({ data })
            : (error) => listener({ message: error.message })
        listeners.set(type, callback)
        thread.on(type, callback)
      },
      removeEventListener(type, listener) {
        thread.off(type, listeners.get(type))
        listeners.delete(type)
      },
    }
  },
})
const workerInitializationMs = performance.now() - workerStart
const workerSearches = {
  emptyRoundTrip: await measure(worker, '', {}),
  commonWord: await measure(worker, 'الله', {}),
}
worker.dispose()
engine.dispose()
const bundles = []
for (const name of await readdir(directory))
  if (name.endsWith('.mjs')) {
    const content = await readFile(new URL(name, directory))
    bundles.push({
      name,
      bytes: content.length,
      gzipBytes: gzipSync(content).length,
    })
  }
const results = {
  measuredAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: platform(),
    arch: arch(),
    cpu: cpus()[0].model,
    iterations: 100,
    initializationSamples: 5,
    clock: 'performance.now',
    gc: !!globalThis.gc,
  },
  initialization: {
    cold: summary(cold),
    warm: summary(warm),
    measuredMs: +initializationMs.toFixed(3),
    heapMiB: +heapMiB.toFixed(2),
  },
  searches,
  worker: {
    initializationMs: +workerInitializationMs.toFixed(3),
    searches: workerSearches,
  },
  bundles,
}
console.log(JSON.stringify(results, null, 2))
if (process.argv.includes('--write'))
  await writeFile(
    new URL('results.json', import.meta.url),
    JSON.stringify(results, null, 2) + '\n',
  )
