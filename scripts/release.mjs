import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const [mode, output = 'work/npm-release'] = process.argv.slice(2)
assert(
  ['pack', 'dry-run', 'publish'].includes(mode),
  'Use pack, dry-run, or publish',
)
const directory = resolve(root, output)
const registry = 'https://registry.npmjs.org/'

// Publish dependencies before their consumers. A retry skips versions already live.
const packages = []
for (const name of await readdir(join(root, 'packages'))) {
  try {
    const pkg = JSON.parse(
      await readFile(join(root, 'packages', name, 'package.json'), 'utf8'),
    )
    if (!pkg.private) packages.push(pkg)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}
const pending = new Map(packages.map((pkg) => [pkg.name, pkg]))
const ordered = []
while (pending.size) {
  const ready = [...pending.values()].filter((pkg) =>
    Object.keys(pkg.dependencies || {}).every((name) => !pending.has(name)),
  )
  assert(ready.length, 'Circular dependency between published packages')
  for (const pkg of ready) {
    ordered.push(pkg)
    pending.delete(pkg.name)
  }
}
const expected = ordered.map((pkg) => ({
  name: pkg.name,
  version: pkg.version,
  file: `${pkg.name.replace(/^@/, '').replace('/', '-')}-${pkg.version}.tgz`,
}))

if (mode === 'pack') {
  assert(
    directory.startsWith(join(root, 'work') + '/'),
    'Pack output must be inside work/',
  )
  await rm(directory, { recursive: true, force: true })
  await mkdir(directory, { recursive: true })
  execFileSync(
    'pnpm',
    ['-r', '--filter=./packages/*', 'pack', '--pack-destination', directory],
    {
      cwd: root,
      stdio: 'pipe',
      maxBuffer: 8 * 1024 * 1024,
    },
  )
  await writeFile(
    join(directory, 'manifest.json'),
    JSON.stringify(expected, null, 2) + '\n',
  )
  console.log(`Packed ${expected.length} packages into ${directory}`)
} else {
  const manifest = JSON.parse(
    await readFile(join(directory, 'manifest.json'), 'utf8'),
  )
  assert.deepEqual(
    manifest,
    expected,
    'Artifacts must match the checked-out release versions',
  )
  const excluded = new Set((process.env.NPM_RELEASE_EXCLUDE || '').split(',').filter(Boolean))
  assert(
    [...excluded].every((name) => manifest.some((pkg) => pkg.name === name)),
    'NPM_RELEASE_EXCLUDE contains an unknown package',
  )
  for (const pkg of manifest) {
    assert.equal(basename(pkg.file), pkg.file)
    if (mode === 'publish' && excluded.has(pkg.name)) {
      console.log(`Deferred by NPM_RELEASE_EXCLUDE: ${pkg.name}@${pkg.version}`)
      continue
    }
    if (mode === 'publish') {
      const result = spawnSync(
        'npm',
        [
          'view',
          `${pkg.name}@${pkg.version}`,
          'version',
          '--json',
          '--registry',
          registry,
        ],
        { encoding: 'utf8' },
      )
      if (result.error) throw result.error
      if (result.status === 0) {
        assert.equal(JSON.parse(result.stdout), pkg.version)
        console.log(`Already published: ${pkg.name}@${pkg.version}`)
        continue
      }
      assert(
        /\bE404\b/.test(result.stderr),
        `Registry lookup failed: ${result.stderr}`,
      )
    }
    const args = [
      'publish',
      join(directory, pkg.file),
      '--access',
      'public',
      '--tag',
      'latest',
      '--registry',
      registry,
      '--ignore-scripts',
      '--json',
    ]
    if (mode === 'dry-run') args.push('--dry-run')
    else if (process.env.GITHUB_ACTIONS === 'true') args.push('--provenance')
    execFileSync('npm', args, {
      cwd: root,
      stdio: 'pipe',
      maxBuffer: 8 * 1024 * 1024,
    })
    console.log(
      `${mode === 'dry-run' ? 'Validated' : 'Published'}: ${pkg.name}@${pkg.version}`,
    )
  }
}
