import { copy } from 'fs-extra/esm'
import { fileURLToPath } from 'node:url'

// Reuse the published dataset unchanged instead of fetching Tanzil on every build.
// The npm alias is pinned in package.json and verified by the workspace lockfile.
const source = new URL(
  '../json/',
  import.meta.resolve('@ghoran/translation-source'),
)
const destination = new URL('../json/', import.meta.url)

await copy(fileURLToPath(source), fileURLToPath(destination), {
  overwrite: false,
})
