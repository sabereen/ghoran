import { createQuranSearch } from './engine'
import type { QuranSearch } from './types'
import type { Request, Response } from './protocol'

/** Shared by the published browser worker and transport tests. */
export function createWorkerHandler(
  send: (response: Response) => void,
): (request: Request) => Promise<void> {
  let engine: Promise<QuranSearch> | undefined
  return async (request) => {
    try {
      if (request.type === 'init') {
        if (engine) throw new Error('Worker already initialized')
        engine = createQuranSearch(request.options)
        await engine
        send({ id: request.id, ok: true })
      } else if (request.type === 'search') {
        if (!engine) throw new Error('Worker is not initialized')
        const result = await (
          await engine
        ).search(request.query, request.options)
        send({ id: request.id, ok: true, result })
      } else throw new Error('Unknown worker request')
    } catch (error) {
      send({
        id: request.id,
        ok: false,
        error: {
          name: error instanceof Error ? error.name : 'Error',
          message: error instanceof Error ? error.message : String(error),
        },
      })
    }
  }
}
