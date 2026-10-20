import type { QuranSearchOptions, SearchOptions, SearchResponse } from './types'

export type Request =
  | { id: number; type: 'init'; options: QuranSearchOptions }
  | {
      id: number
      type: 'search'
      query: string
      options: Omit<SearchOptions, 'signal'>
    }
export type Response = { id: number } & (
  | { ok: true; result?: SearchResponse }
  | { ok: false; error: { name: string; message: string } }
)
/** Structural transport type: browser Worker and worker_threads adapters fit. */
export interface WorkerTransport {
  postMessage(message: unknown): void
  addEventListener(
    type: 'message' | 'error' | 'messageerror',
    listener: (event: any) => void,
  ): void
  removeEventListener(
    type: 'message' | 'error' | 'messageerror',
    listener: (event: any) => void,
  ): void
  terminate(): void
}
