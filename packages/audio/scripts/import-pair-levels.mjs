/** Derive optional pair metadata from measured records; never alter baseline gains. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

assert(
  process.argv[2],
  'Usage: node scripts/import-pair-levels.mjs <archived-data-directory>',
)
const archive = resolve(process.argv[2])
const data = fileURLToPath(new URL('../data/', import.meta.url))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const archivedManifestBytes = await readFile(
  join(archive, 'manifest.sha256.json'),
)
const archivedManifest = JSON.parse(archivedManifestBytes).files
const manifest = JSON.parse(await readFile(join(data, 'manifest.sha256.json')))
const snapshot = JSON.parse(await readFile(join(data, 'snapshot.json')))
await mkdir(join(data, 'levels'), { recursive: true })
const digests = {}
for (const id of snapshot.sourceIds) {
  const name = `measurements/${id}.jsonl.gz`
  const bytes = await readFile(join(archive, name))
  assert.equal(sha(bytes), archivedManifest[name], `Archive hash: ${name}`)
  const hashes = await readFile(join(data, `hashes/${id}.bin`))
  const levels = Buffer.alloc(6236 * 2)
  for (let i = 0; i < 6236; i++) levels.writeInt16LE(-32768, i * 2)
  const seen = new Set()
  for (const line of gunzipSync(bytes).toString().trim().split('\n')) {
    const record = JSON.parse(line)
    const index = record.ordinal - 1
    assert(index >= 0 && index < 6236 && !seen.has(index))
    seen.add(index)
    if (record.status !== 'success') continue
    const measured = record.measured
    assert.equal(
      measured.sha256,
      hashes.subarray(index * 32, (index + 1) * 32).toString('hex'),
    )
    const level = measured.dualmono_playback_lufs
    if (
      level === null ||
      !Number.isFinite(level) ||
      measured.activity.near_silent
    )
      continue
    assert(Math.abs(level * 10) < 32767)
    levels.writeInt16LE(Math.round(level * 10), index * 2)
  }
  const path = `levels/${id}.bin`
  await writeFile(join(data, path), levels)
  manifest.files[path] = digests[id] = sha(levels)
}
const evidence = {
  schemaVersion: '1.0.0',
  algorithm: 'quieter-clip-anchor-v1',
  inputManifestSha256: sha(archivedManifestBytes),
  quantizationLu: 0.1,
  monoPlaybackConvention: snapshot.snapshotInfo.monoPlaybackConvention,
  digests,
}
await writeFile(
  join(data, 'pair-evidence.json'),
  JSON.stringify(evidence, null, 2) + '\n',
)
manifest.files['pair-evidence.json'] = sha(
  await readFile(join(data, 'pair-evidence.json')),
)
await writeFile(
  join(data, 'manifest.sha256.json'),
  JSON.stringify(manifest, null, 2) + '\n',
)
console.log(
  'Imported hash-bound measured levels for 13 sources (81,068 records).',
)
