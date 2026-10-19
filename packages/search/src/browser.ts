import { abortError, createQuranSearch, integer } from './engine'
import type {
  QuranSearch,
  QuranSearchOptions,
  SearchOptions,
  SearchResponse,
  SearchSignal,
} from './types'
import type { Request, Response, WorkerTransport } from './protocol'
export type { WorkerTransport } from './protocol'

export interface BrowserQuranSearchOptions extends QuranSearchOptions {
  /** Explicit bundler-owned worker. Omit for SSR/main-thread execution. */
  workerFactory?: () => WorkerTransport
  /** Factory/initialization failures reject by default. Runtime failures reject. */
  fallback?: 'error' | 'direct'
  onFallback?: (error: Error) => void
  /** Bounds initialization and lost-response waits. Default 30 seconds. */
  timeoutMs?: number
}

export async function createBrowserQuranSearch(
  options: BrowserQuranSearchOptions = {},
): Promise<QuranSearch> {
  const {
    workerFactory,
    fallback = 'error',
    onFallback,
    timeoutMs = 30_000,
    ...core
  } = options
  if (!workerFactory) return createQuranSearch(core)
  if (typeof core.normalizer === 'function')
    throw new TypeError(
      'Functions cannot be sent to a worker; use direct execution',
    )
  integer(timeoutMs, 'timeoutMs', 2_147_483_647)
  if (!timeoutMs) throw new RangeError('timeoutMs must be positive')
  let worker: WorkerTransport | undefined
  try {
    worker = workerFactory()
    const transport = worker
    let nextId = 0,
      closed = false
    interface Pending {
      resolve(value?: SearchResponse): void
      reject(error: Error): void
      cleanup(): void
    }
    const pending = new Map<number, Pending>()
    const stop = (error: Error) => {
      if (closed) return
      closed = true
      transport.removeEventListener('message', message)
      transport.removeEventListener('error', failed)
      transport.removeEventListener('messageerror', failed)
      transport.terminate()
      for (const item of pending.values()) {
        item.cleanup()
        item.reject(error)
      }
      pending.clear()
    }
    const message = (event: { data: Response }) => {
      const response = event.data
      const item = pending.get(response?.id)
      if (!item) return // Aborted requests and late/out-of-order replies are isolated.
      pending.delete(response.id)
      item.cleanup()
      if (response.ok) item.resolve(response.result)
      else {
        const error = new Error(response.error.message)
        error.name = response.error.name
        item.reject(error)
      }
    }
    const failed = (event: { message?: string }) =>
      stop(new Error(event.message ?? 'Worker transport failed'))
    transport.addEventListener('message', message)
    transport.addEventListener('error', failed)
    transport.addEventListener('messageerror', failed)
    const request = (
      payload:
        | Omit<Extract<Request, { type: 'init' }>, 'id'>
        | Omit<Extract<Request, { type: 'search' }>, 'id'>,
      signal?: SearchSignal,
    ) =>
      new Promise<SearchResponse | undefined>((resolve, reject) => {
        if (closed) {
          reject(new Error('Search disposed or worker failed'))
          return
        }
        if (signal?.aborted) {
          reject(abortError())
          return
        }
        const id = ++nextId
        const abort = () => {
          const item = pending.get(id)
          if (item) {
            pending.delete(id)
            item.cleanup()
            reject(abortError())
          }
        }
        const timer = setTimeout(
          () => stop(new Error('Worker request timed out')),
          timeoutMs,
        )
        const cleanup = () => {
          clearTimeout(timer)
          signal?.removeEventListener('abort', abort)
        }
        pending.set(id, { resolve, reject, cleanup })
        signal?.addEventListener('abort', abort, { once: true })
        try {
          transport.postMessage({ ...payload, id })
        } catch (error) {
          pending.delete(id)
          cleanup()
          reject(error)
        }
      })
    try {
      await request({ type: 'init', options: core })
    } catch (error) {
      stop(error instanceof Error ? error : new Error(String(error)))
      throw error
    }
    return {
      execution: 'worker',
      async search(query: string, searchOptions: SearchOptions = {}) {
        const { signal, ...serializable } = searchOptions
        const result = await request(
          { type: 'search', query, options: serializable },
          signal,
        )
        if (!result) throw new Error('Invalid worker search response')
        return result
      },
      dispose() {
        stop(new Error('Search disposed'))
      },
    }
  } catch (error) {
    worker?.terminate()
    if (fallback !== 'direct') throw error
    const reason = error instanceof Error ? error : new Error(String(error))
    if (!onFallback)
      throw new Error(
        'Explicit direct fallback requires onFallback to report initialization failure',
        { cause: reason },
      )
    onFallback(reason)
    return createQuranSearch(core)
  }
}
