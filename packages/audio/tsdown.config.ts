import { readdirSync } from 'node:fs'
import { defineConfig } from 'tsdown'
import { libraryConfig } from '../../tsdown.shared.ts'

const entry: Record<string, string> = Object.fromEntries(
  ['index', 'catalog', 'load', 'verify', 'url'].map((name) => [
    name,
    `src/${name}.ts`,
  ]),
)
for (const directory of ['sources', 'hashes']) {
  for (const file of readdirSync(`src/${directory}`).filter((file) =>
    file.endsWith('.ts'),
  ))
    entry[`${directory}/${file.slice(0, -3)}`] = `src/${directory}/${file}`
}
for (const target of [-23, -18, -16]) {
  for (const file of readdirSync(`src/targets/${target}`).filter((file) =>
    file.endsWith('.ts'),
  ))
    entry[`targets/${target}/${file.slice(0, -3)}`] =
      `src/targets/${target}/${file}`
}
export default defineConfig({ ...libraryConfig, entry })
