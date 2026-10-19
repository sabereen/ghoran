import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { writeFile, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { build, createServer, preview } from 'vite'

/** Exercise npm exports through Vite, without any monorepo source aliases. */
export async function verifySearchBrowser(consumer, browser = false) {
  await writeFile(
    join(consumer, 'index.html'),
    '<!doctype html><html><body><main id="result">PENDING</main><script type="module" src="/main.ts"></script></body></html>',
  )
  await writeFile(
    join(consumer, 'quran.worker.ts'),
    "import '@ghoran/search/worker'\n",
  )
  await writeFile(
    join(consumer, 'quran-legacy.worker.ts'),
    "import '@ghoran/search/worker'\nObject.defineProperty(Intl, 'Segmenter', { value: undefined, configurable: true })\n",
  )
  await writeFile(
    join(consumer, 'main.ts'),
    `
import { createQuranSearch, getHighlightSegments, getHighlightRanges } from '@ghoran/search'
import { createBrowserQuranSearch } from '@ghoran/search/browser'
import { importText } from '@ghoran/text'
async function verify() {
  const direct = await createQuranSearch()
  const worker = await createBrowserQuranSearch({
    workerFactory: () => new Worker(new URL('./quran.worker.ts', import.meta.url), { type: 'module' }),
    timeoutMs: 15000,
  })
  try {
    const expected = await direct.search('الرحمن الرحيم', { scope: { surahs: [1] } })
    const actual = await worker.search('الرحمن الرحيم', { scope: { surahs: [1] } })
    if (worker.execution !== 'worker' || JSON.stringify(expected) !== JSON.stringify(actual)) throw Error('Worker parity failed')
    const display = (await importText('hafs-v3')).default[0]
    const segments = getHighlightSegments(display, actual.hits[0])
    if (segments.map(s => s.text).join('') !== display || !segments.some(s => s.highlighted)) throw Error('Highlight failed')
    const aborted = new AbortController(); aborted.abort()
    try { await worker.search('الله', { signal: aborted.signal }); throw Error('Cancellation failed') }
    catch (error) { if (error.name !== 'AbortError') throw error }
    const legacyWorker = await createBrowserQuranSearch({
      corpus: ['بِاللَّهِ'],
      workerFactory: () => new Worker(new URL('./quran-legacy.worker.ts', import.meta.url), { type: 'module' }),
      timeoutMs: 15000,
    })
    const nativeSegmenter = Intl.Segmenter
    let legacyDirect
    try {
      Intl.Segmenter = undefined
      legacyDirect = await createQuranSearch({ corpus: ['بِاللَّهِ'] })
      const old = await legacyWorker.search('الله', { mode: 'substring' })
      const local = await legacyDirect.search('الله', { mode: 'substring' })
      if (JSON.stringify(old) !== JSON.stringify(local)) throw Error('Legacy worker parity failed')
      const mapped = getHighlightRanges('بِٱللَّهِ', old.hits[0])
      if (mapped.ranges.length !== 1 || mapped.ranges[0].accuracy !== 'word') throw Error('Legacy word fallback failed')
      const parts = getHighlightSegments('بِٱللَّهِ', old.hits[0])
      if (parts.map(s => s.text).join('') !== 'بِٱللَّهِ' || parts.filter(s => s.highlighted).map(s => s.text).join('') !== 'بِٱللَّهِ') throw Error('Legacy reconstruction failed')
    } finally { Intl.Segmenter = nativeSegmenter; legacyDirect?.dispose(); legacyWorker.dispose() }
    document.querySelector('#result').textContent = 'PASS: worker, Quran loading, parity, highlights, cancellation, optional Segmenter'
  } finally { worker.dispose(); direct.dispose() }
}
verify().catch(error => { document.querySelector('#result').textContent = 'FAIL: ' + error.stack })
`,
  )
  const config = {
    root: consumer,
    configFile: false,
    logLevel: 'error',
    worker: { format: 'es' },
    server: { host: '127.0.0.1', port: 0 },
    build: { outDir: 'vite-dist' },
  }
  await build(config)
  const assets = await readdir(join(consumer, 'vite-dist/assets'))
  assert(
    assets.some(
      (name) => name.startsWith('quran.worker-') && name.endsWith('.js'),
    ),
    'Vite must emit a real worker asset',
  )
  // Its imports must be bundled/resolvable, with no remaining package specifiers.
  const worker = await readFile(
    join(
      consumer,
      'vite-dist/assets',
      assets.find((name) => name.startsWith('quran.worker-')),
    ),
    'utf8',
  )
  assert(!worker.includes('from"@ghoran/'))
  for (const production of [false, true]) {
    const server = production
      ? await preview({ ...config, preview: { host: '127.0.0.1', port: 0 } })
      : await createServer(config)
    if (!production) await server.listen()
    try {
      const address = server.httpServer.address()
      const url = `http://127.0.0.1:${address.port}`
      assert.equal((await fetch(url)).status, 200)
      if (!production) {
        assert.equal((await fetch(`${url}/main.ts`)).status, 200)
        assert.equal(
          (await fetch(`${url}/quran.worker.ts?worker_file&type=module`))
            .status,
          200,
        )
      }
      if (browser) {
        await verifyChromium(
          url,
          join(
            consumer,
            production ? 'chrome-production' : 'chrome-development',
          ),
        )
      }
    } finally {
      await server.close()
    }
  }
  console.log(
    `Packed search passed Vite development and production${browser ? ' in Chromium' : ' resolution/build checks'}.`,
  )
}

// Use real wall-clock completion through CDP: virtual-time dump-dom can finish
// before an asynchronously loading module worker receives CPU time.
async function verifyChromium(url, profile) {
  const chrome = spawn(
    process.env.CHROME_BIN || 'chromium',
    [
      '--headless',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--remote-debugging-port=0',
      '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  )
  let diagnostic = '',
    socket,
    spawnError
  chrome.stderr.on('data', (data) => {
    diagnostic += data
  })
  chrome.on('error', (error) => {
    spawnError = error
  })
  const pause = () => new Promise((resolve) => setTimeout(resolve, 100))
  try {
    const deadline = Date.now() + 30_000
    let port
    while (
      !(port = diagnostic.match(
        /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/,
      )?.[1])
    ) {
      if (spawnError) throw spawnError
      if (chrome.exitCode !== null || Date.now() > deadline)
        throw new Error(`Chromium did not start: ${diagnostic}`)
      await pause()
    }
    const page = await (
      await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
        method: 'PUT',
      })
    ).json()
    socket = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true })
      socket.addEventListener('error', reject, { once: true })
    })
    let id = 0
    const pending = new Map()
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      const resolve = pending.get(message.id)
      if (resolve) {
        pending.delete(message.id)
        resolve(message)
      }
    })
    const command = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const requestId = ++id
        const timer = setTimeout(() => {
          pending.delete(requestId)
          reject(new Error('Chromium command timeout'))
        }, 10_000)
        pending.set(requestId, (message) => {
          clearTimeout(timer)
          resolve(message)
        })
        socket.send(JSON.stringify({ id: requestId, method, params }))
      })
    await command('Page.navigate', { url })
    let result = 'PENDING'
    while (Date.now() < deadline) {
      const response = await command('Runtime.evaluate', {
        expression: "document.querySelector('#result')?.textContent",
        returnByValue: true,
      })
      result = response.result?.result?.value ?? 'PENDING'
      if (result.startsWith('PASS:')) return
      assert(!result.startsWith('FAIL:'), result)
      await pause()
    }
    throw new Error(`Chromium verification timed out: ${result} ${diagnostic}`)
  } finally {
    socket?.close()
    if (chrome.pid && chrome.exitCode === null && chrome.signalCode === null) {
      const stopped = new Promise((resolve) => chrome.once('close', resolve))
      chrome.kill('SIGTERM')
      const kill = setTimeout(() => chrome.kill('SIGKILL'), 1000)
      await stopped
      clearTimeout(kill)
    }
  }
}
