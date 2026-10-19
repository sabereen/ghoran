import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
mkdirSync(join(root, 'work'), { recursive: true })
const temporary = mkdtempSync(join(root, 'work', 'release-test-'))
const bin = join(temporary, 'bin')
mkdirSync(bin)
writeFileSync(join(bin, 'package.json'), JSON.stringify({ type: 'commonjs' }))
const log = join(temporary, 'calls.jsonl')
const manifest = [
  'font-page',
  'metadata',
  'text',
  'translation',
  'utils',
  'entity',
  'search',
].map((directory) => {
  const pkg = JSON.parse(
    readFileSync(join(root, 'packages', directory, 'package.json'), 'utf8'),
  )
  return {
    name: pkg.name,
    version: pkg.version,
    file: `ghoran-${directory}-${pkg.version}.tgz`,
  }
})
writeFileSync(join(temporary, 'manifest.json'), JSON.stringify(manifest))

// A fake npm executable ensures these regression tests can never publish.
const npm = join(bin, 'npm')
writeFileSync(
  npm,
  `#!/usr/bin/env node
const fs = require('node:fs')
const args = process.argv.slice(2)
fs.appendFileSync(process.env.RELEASE_TEST_LOG, JSON.stringify(args) + '\\n')
if (args[0] === 'view') {
  if (process.env.RELEASE_TEST_MODE === 'network-error') {
    console.error('E503 Registry unavailable'); process.exit(1)
  }
  if (args[1].startsWith('@ghoran/font-page@')) {
    console.log(JSON.stringify(args[1].split('@').at(-1))); process.exit(0)
  }
  console.error('E404 Version not found'); process.exit(1)
}
if (args[0] !== 'publish' || !args.includes('--ignore-scripts')) process.exit(2)
console.log('{}')
`,
)
chmodSync(npm, 0o755)
afterAll(() => rmSync(temporary, { recursive: true, force: true }))

function run(mode: string, scenario = '') {
  writeFileSync(log, '')
  const result = spawnSync(
    process.execPath,
    [join(root, 'scripts/release.mjs'), mode, temporary],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: bin + delimiter + process.env.PATH,
        GITHUB_ACTIONS: 'true',
        RELEASE_TEST_LOG: log,
        RELEASE_TEST_MODE: scenario,
      },
    },
  )
  const calls: string[][] = readFileSync(log, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
  return { result, calls }
}

describe.skipIf(process.platform === 'win32')('npm release', () => {
  test('dry-run validates every package without registry lookups or real publication', () => {
    const { result, calls } = run('dry-run')
    expect(result.status, result.stderr).toBe(0)
    expect(calls).toHaveLength(manifest.length)
    expect(
      calls.every(
        (args) => args[0] === 'publish' && args.includes('--dry-run'),
      ),
    ).toBe(true)
  })

  test('retry skips published versions and publishes dependencies before entity', () => {
    const { result, calls } = run('publish')
    expect(result.status, result.stderr).toBe(0)
    const published = calls.filter((args) => args[0] === 'publish')
    expect(published).toHaveLength(manifest.length - 1)
    expect(published.some((args) => args[1].includes('font-page'))).toBe(false)
    for (const consumer of ['entity', 'search']) {
      const position = published.findIndex((args) =>
        args[1].includes(`ghoran-${consumer}-`),
      )
      for (const dependency of ['metadata', 'text']) {
        expect(
          published.findIndex((args) =>
            args[1].includes(`ghoran-${dependency}-`),
          ),
        ).toBeLessThan(position)
      }
    }
    expect(
      published.every(
        (args) => args.includes('--provenance') && !args.includes('--dry-run'),
      ),
    ).toBe(true)
  })

  test('registry errors stop the release before publishing any package', () => {
    const { result, calls } = run('publish', 'network-error')
    expect(result.status).not.toBe(0)
    expect(calls.filter((args) => args[0] === 'publish')).toHaveLength(0)
  })
})
