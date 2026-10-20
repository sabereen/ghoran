import { defineConfig } from 'tsdown'
import { libraryConfig } from '../../tsdown.shared.ts'

export default defineConfig({
  ...libraryConfig,
  entry: ['src/index.ts', 'src/browser.ts', 'src/worker.ts'],
})
