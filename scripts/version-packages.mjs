import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const [bump] = process.argv.slice(2)
assert(['patch', 'minor', 'major'].includes(bump), 'Use patch, minor, or major')
for (const directory of await readdir(join(root, 'packages'))) {
  const path = join(root, 'packages', directory, 'package.json')
  let pkg
  try {
    pkg = JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') continue
    throw error
  }
  if (pkg.private) continue
  assert(
    /^\d+\.\d+\.\d+$/.test(pkg.version),
    'Expected a stable semver version',
  )
  const [major, minor, patch] = pkg.version.split('.').map(Number)
  pkg.version =
    bump === 'major'
      ? `${major + 1}.0.0`
      : bump === 'minor'
        ? `${major}.${minor + 1}.0`
        : `${major}.${minor}.${patch + 1}`
  await writeFile(path, JSON.stringify(pkg, null, 2) + '\n')
  console.log(`${pkg.name}: ${pkg.version}`)
}
execFileSync('pnpm', ['install', '--lockfile-only'], {
  cwd: root,
  stdio: 'inherit',
})
