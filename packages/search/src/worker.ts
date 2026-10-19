import { createWorkerHandler } from './worker-handler'
import type { Request, Response } from './protocol'

// This entrypoint is a real published module worker asset, not a main-thread API.
// Avoid DOM types in declarations so Node consumers need no DOM ambient library.
const scope = globalThis as unknown as {
  postMessage(message: Response): void
  addEventListener(
    type: 'message',
    listener: (event: { data: Request }) => void,
  ): void
}
const handle = createWorkerHandler((response) => scope.postMessage(response))
scope.addEventListener('message', (event) => {
  void handle(event.data)
})
