import { createBrowserQuranSearch } from '../src/browser'
import type { WorkerTransport } from '../src/browser'
import { createQuranSearch } from '../src/index'
import { createWorkerHandler } from '../src/worker-handler'
import type { Request, Response } from '../src/protocol'

class LoopbackWorker implements WorkerTransport {
  listeners = new Map<string, Set<(event: any) => void>>()
  terminated = false
  requests: Request[] = []
  delayed = false
  queued: Response[] = []
  handler = createWorkerHandler((response) => {
    if (this.delayed && response.ok && response.result)
      this.queued.push(response)
    else
      queueMicrotask(() =>
        this.emit('message', { data: structuredClone(response) }),
      )
  })
  emit(type: string, event: any) {
    this.listeners.get(type)?.forEach((listener) => listener(event))
  }
  postMessage(message: Request) {
    this.requests.push(structuredClone(message))
    void this.handler(structuredClone(message))
  }
  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(listener)
  }
  removeEventListener(type: string, listener: (event: any) => void) {
    this.listeners.get(type)?.delete(listener)
  }
  terminate() {
    this.terminated = true
  }
  flush() {
    for (const response of this.queued.splice(0).reverse())
      this.emit('message', { data: response })
  }
}
const corpus = ['الله الله', 'قل هو الله أحد', 'الرحمن الرحيم']
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('optional worker adapter', () => {
  test('SSR-safe import and explicit direct execution without a workerFactory', async () => {
    expect('Worker' in globalThis).toBe(false)
    const engine = await createBrowserQuranSearch({ corpus })
    expect(engine.execution).toBe('direct')
    expect((await engine.search('الله')).total).toBe(2)
    engine.dispose()
  })
  test('initializes once and uses identical direct/worker search semantics', async () => {
    const worker = new LoopbackWorker()
    const engine = await createBrowserQuranSearch({
      corpus,
      workerFactory: () => worker,
    })
    const direct = await createQuranSearch({ corpus })
    expect(engine.execution).toBe('worker')
    for (const mode of [
      'phrase',
      'allWords',
      'anyWord',
      'substring',
    ] as const) {
      expect(await engine.search('الله', { mode })).toEqual(
        await direct.search('الله', { mode }),
      )
    }
    expect(worker.requests.filter((r) => r.type === 'init')).toHaveLength(1)
    engine.dispose()
    direct.dispose()
    expect(worker.terminated).toBe(true)
  })
  test('concurrent out-of-order replies resolve only their own request', async () => {
    const worker = new LoopbackWorker()
    const engine = await createBrowserQuranSearch({
      corpus,
      workerFactory: () => worker,
    })
    worker.delayed = true
    const one = engine.search('الله'),
      two = engine.search('الرحمن')
    await tick()
    expect(worker.queued).toHaveLength(2)
    worker.flush()
    expect((await one).total).toBe(2)
    expect((await two).total).toBe(1)
    engine.dispose()
  })
  test('aborting ignores the stale response and leaves other requests usable', async () => {
    const worker = new LoopbackWorker()
    const engine = await createBrowserQuranSearch({
      corpus,
      workerFactory: () => worker,
    })
    worker.delayed = true
    const controller = new AbortController()
    const stale = engine.search('الله', { signal: controller.signal })
    const rejected = expect(stale).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejected
    await tick()
    worker.flush()
    worker.delayed = false
    expect((await engine.search('الرحمن')).total).toBe(1)
    await expect(
      engine.search('الله', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    engine.dispose()
  })
  test('disposal rejects pending requests, removes listeners, and is idempotent', async () => {
    const worker = new LoopbackWorker()
    const engine = await createBrowserQuranSearch({
      corpus,
      workerFactory: () => worker,
    })
    worker.delayed = true
    const outstanding = expect(engine.search('الله')).rejects.toThrow(
      'disposed',
    )
    engine.dispose()
    engine.dispose()
    await outstanding
    expect([...worker.listeners.values()].every((set) => set.size === 0)).toBe(
      true,
    )
    await expect(engine.search('الله')).rejects.toThrow('disposed')
  })
  test('execution errors propagate and permit later valid searches', async () => {
    const engine = await createBrowserQuranSearch({
      corpus,
      workerFactory: () => new LoopbackWorker(),
    })
    await expect(engine.search(null as never)).rejects.toMatchObject({
      name: 'TypeError',
    })
    await expect(
      engine.search('الله', { scope: { surahs: [0] } }),
    ).rejects.toMatchObject({ name: 'RangeError' })
    expect((await engine.search('الله')).total).toBe(2)
    engine.dispose()
  })
  test.each(['error', 'messageerror'])(
    '%s terminates transport and rejects all pending requests',
    async (type) => {
      const worker = new LoopbackWorker()
      const engine = await createBrowserQuranSearch({
        corpus,
        workerFactory: () => worker,
      })
      worker.delayed = true
      const outstanding = expect(engine.search('الله')).rejects.toThrow(
        'transport failed',
      )
      worker.emit(type, {})
      await outstanding
      expect(worker.terminated).toBe(true)
      await expect(engine.search('الله')).rejects.toThrow('failed')
    },
  )
  test('factory/initialization failures reject unless direct fallback is explicitly reported', async () => {
    const workerFactory = () => {
      throw new Error('CSP blocked worker')
    }
    await expect(
      createBrowserQuranSearch({ corpus, workerFactory }),
    ).rejects.toThrow('CSP blocked')
    await expect(
      createBrowserQuranSearch({ corpus, workerFactory, fallback: 'direct' }),
    ).rejects.toThrow('requires onFallback')
    const onFallback = vi.fn()
    const engine = await createBrowserQuranSearch({
      corpus,
      workerFactory,
      fallback: 'direct',
      onFallback,
    })
    expect(engine.execution).toBe('direct')
    expect(onFallback).toHaveBeenCalledOnce()
    engine.dispose()
    const worker = new LoopbackWorker()
    await expect(
      createBrowserQuranSearch({
        corpus: [null] as never,
        workerFactory: () => worker,
      }),
    ).rejects.toThrow('corpus')
    expect(worker.terminated).toBe(true)
  })
  test('request/initialization timeouts clean up the worker', async () => {
    const worker = new LoopbackWorker()
    worker.postMessage = () => {}
    await expect(
      createBrowserQuranSearch({
        corpus,
        workerFactory: () => worker,
        timeoutMs: 5,
      }),
    ).rejects.toThrow('timed out')
    expect(worker.terminated).toBe(true)
    const active = new LoopbackWorker()
    const engine = await createBrowserQuranSearch({
      corpus,
      workerFactory: () => active,
      timeoutMs: 5,
    })
    active.postMessage = () => {}
    await expect(engine.search('الله')).rejects.toThrow('timed out')
    expect(active.terminated).toBe(true)
    engine.dispose()
  })
  test('structured clone errors do not leak a pending request', async () => {
    const worker = new LoopbackWorker()
    const engine = await createBrowserQuranSearch({
      corpus,
      workerFactory: () => worker,
    })
    worker.postMessage = () => {
      throw new Error('DataCloneError')
    }
    await expect(engine.search('الله')).rejects.toThrow('DataCloneError')
    engine.dispose()
  })
  test('worker configuration rejects functions and invalid timeouts', async () => {
    await expect(
      createBrowserQuranSearch({
        workerFactory: () => new LoopbackWorker(),
        normalizer: (s) => s,
      }),
    ).rejects.toThrow('Functions')
    await expect(
      createBrowserQuranSearch({
        workerFactory: () => new LoopbackWorker(),
        timeoutMs: 0,
      }),
    ).rejects.toThrow('positive')
  })
  test('handler rejects use before initialization and duplicate initialization', async () => {
    const responses: Response[] = []
    const handler = createWorkerHandler((response) => responses.push(response))
    await handler({ id: 1, type: 'search', query: 'الله', options: {} })
    await handler({ id: 2, type: 'init', options: { corpus } })
    await handler({ id: 3, type: 'init', options: { corpus } })
    expect(responses).toMatchObject([
      { id: 1, ok: false, error: { message: 'Worker is not initialized' } },
      { id: 2, ok: true },
      { id: 3, ok: false, error: { message: 'Worker already initialized' } },
    ])
  })
})
