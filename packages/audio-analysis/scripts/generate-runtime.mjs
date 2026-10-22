/** Deterministic, offline compiler: measured evidence -> small player metadata.
 * Never downloads/decodes audio. Heavy research files stay out of npm.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gunzipSync, gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const data = join(root, 'data')
const output = join(root, 'src/generated')
const check = process.argv.includes('--check')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const manifestBytes = await readFile(join(data, 'manifest.sha256.json'))
const manifest = JSON.parse(manifestBytes).files
async function input(name, compressed = false) {
  const bytes = await readFile(join(data, name))
  assert.equal(
    sha(bytes),
    manifest[name],
    `Consumer manifest mismatch: ${name}`,
  )
  return JSON.parse((compressed ? gunzipSync(bytes) : bytes).toString())
}
const sources = (await input('sources.json')).sources
const profiles = (await input('profiles.json')).profiles
const coverage = await input('coverage.json')
const verses = await input('verses.json.gz', true)
const config = JSON.parse(
  await readFile(join(root, 'analysis/config.json'), 'utf8'),
)
assert.equal(verses.length, 6236)
assert.equal(sources.length, 13)
const lengths = Array(114).fill(0)
for (const [index, verse] of verses.entries()) {
  assert.equal(verse.ordinal, index + 1)
  assert.equal(verse.ayah, ++lengths[verse.surah - 1])
}
const targets = [-23, -20, -18, -16]
const settings = {
  truePeakCeilingDbtp: config.recommendation.true_peak_ceiling_dbtp,
  truePeakMarginDb: 0.15,
  maximumBoostDb: config.recommendation.maximum_boost_db,
  maximumCutDb: config.recommendation.maximum_cut_db,
}
const policies = Object.fromEntries(
  targets.map((target) => [target, { targetLufs: target, sources: {} }]),
)
const generated = new Map()
const catalog = []
const summary = {
  schemaVersion: '1.0.0',
  compilerVersion: '1.0.0',
  inputManifestSha256: sha(manifestBytes),
  settings,
  sources: [],
  targets: {},
}
const floorGain = (value) => Math.floor(value * 100 + 1e-9)

for (const source of sources) {
  const sid = source.id
  const path = `measurements/${sid}.jsonl.gz`
  const bytes = await readFile(join(data, path))
  assert.equal(
    sha(bytes),
    manifest[path],
    `Consumer manifest mismatch: ${path}`,
  )
  const records = gunzipSync(bytes)
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(JSON.parse)
  assert.equal(
    records.length,
    coverage.coverage.find((row) => row.source_id === sid).expected -
      coverage.coverage.find((row) => row.source_id === sid).unprocessed,
    `Incomplete measurement export: ${sid}`,
  )
  assert(
    records.every(
      (record) =>
        Number.isInteger(record.ordinal) &&
        record.ordinal >= 1 &&
        record.ordinal <= 6236,
    ),
  )
  const byOrdinal = new Map(records.map((record) => [record.ordinal, record]))
  assert.equal(byOrdinal.size, records.length, `Duplicate ordinals in ${sid}`)
  const hashes = []
  const revision = []
  for (let ordinal = 1; ordinal <= 6236; ordinal++) {
    const record = byOrdinal.get(ordinal)
    if (record) {
      assert.equal(record.source_id, sid)
      assert.equal(record.verse_id, verses[ordinal - 1].verse_id)
    }
    const hash = record?.measured?.sha256 ?? record?.download_sha256 ?? null
    assert(hash === null || /^[0-9a-f]{64}$/.test(hash))
    hashes.push(hash ?? '0'.repeat(64))
    revision.push([ordinal, record?.status ?? 'unprocessed', hash])
  }
  const contentRevision = sha(JSON.stringify(revision))
  catalog.push({
    id: sid,
    nameFa: source.name_fa,
    kind: source.kind,
    urlTemplate: source.url_template,
    baselinePlaybackLufs: profiles[sid].baseline_playback_lufs,
    contentRevision,
    measuredFiles: profiles[sid].n_success,
    inventoryComplete: profiles[sid].inventory_complete,
  })
  generated.set(
    `hashes/${sid}.ts`,
    '// Generated; do not edit. Exact original-file SHA-256, ordinal order.\n' +
      `const hashes: string = ${JSON.stringify(hashes.join(''))}\nexport default hashes\n`,
  )

  const sourceSummary = { sourceId: sid, contentRevision, targets: {} }
  for (const target of targets) {
    const reference = await input(`recommendations/${target}/${sid}.json`)
    const recommendations = new Map(
      reference.values.map(([ordinal, gain, hash]) => [
        ordinal,
        { gain, hash },
      ]),
    )
    const baseline = profiles[sid].baseline_playback_lufs
    const requested = baseline === null ? null : target - baseline
    const base =
      requested === null
        ? null
        : Math.max(
            -settings.maximumCutDb,
            Math.min(settings.maximumBoostDb, requested),
          )
    const entry = {
      base: base === null ? null : floorGain(base),
      overrides: [],
      unavailable: [],
    }
    let ready = 0,
      peakLimited = 0
    for (let ordinal = 1; ordinal <= 6236; ordinal++) {
      const record = byOrdinal.get(ordinal)
      const m = record?.measured
      let reason = null
      if (!record) reason = 'unprocessed'
      else if (record.status !== 'success')
        reason =
          record.status === 'invalid'
            ? 'invalid-audio'
            : record.status === 'missing'
              ? 'missing-audio'
              : 'download-error'
      else if (
        base === null ||
        m.loudness.integrated_lufs === null ||
        m.loudness.true_peak_dbtp === null ||
        m.activity.near_silent
      )
        reason = 'unmeasurable'
      const ref = recommendations.get(ordinal)
      if (!reason) {
        const cap =
          settings.truePeakCeilingDbtp -
          settings.truePeakMarginDb -
          m.loudness.true_peak_dbtp
        const gain = floorGain(Math.min(base, cap))
        if (gain < -settings.maximumCutDb * 100)
          reason = 'peak-limit-unreachable'
        else {
          // These exports deliberately implement source baseline + peak guard only.
          // Fail instead of silently incorporating an inferred per-file correction.
          assert(
            ref && ref.gain !== null,
            `Missing usable recommendation: ${sid}/${ordinal}`,
          )
          assert.equal(ref.hash, m.sha256)
          assert(
            Math.abs(ref.gain - Math.min(base, cap)) <= 0.000501,
            `Research policy differs from baseline-only runtime policy: ${sid}/${ordinal}/${target}`,
          )
          assert(
            gain / 100 + m.loudness.true_peak_dbtp <=
              settings.truePeakCeilingDbtp - settings.truePeakMarginDb + 1e-8,
          )
          assert(
            gain / 100 >= -settings.maximumCutDb &&
              gain / 100 <= settings.maximumBoostDb,
          )
          assert(Math.min(base, cap) - gain / 100 < 0.01000001)
          const limited = cap < base
          if (gain !== entry.base || limited)
            entry.overrides.push([ordinal, gain, limited])
          ready++
          peakLimited += Number(limited)
        }
      }
      if (reason) {
        entry.unavailable.push([ordinal, reason])
        assert(
          !ref || ref.gain === null,
          `Excluded reference unexpectedly has a gain: ${sid}/${ordinal}`,
        )
      }
    }
    policies[target].sources[sid] = entry
    sourceSummary.targets[target] = {
      ready,
      peakLimited,
      unavailable: entry.unavailable.length,
    }
  }
  summary.sources.push(sourceSummary)
}

const snapshotId = sha(
  JSON.stringify({
    compilerVersion: summary.compilerVersion,
    inputManifestSha256: summary.inputManifestSha256,
    settings,
    revisions: catalog.map((source) => [source.id, source.contentRevision]),
  }),
)
const snapshotInfo = {
  schemaVersion: '1.0.0',
  snapshotId,
  measuredAt: coverage.updated_at,
  expectedFiles: 81068,
  attemptedFiles: coverage.attempted_unique,
  completeInventory: coverage.complete_inventory,
  monoPlaybackConvention: 'equal-amplitude-duplicate-to-two-channels',
  ...settings,
}
generated.set(
  'dataset.ts',
  '// Generated by scripts/generate-runtime.mjs; do not edit.\n' +
    `export const surahLengths: readonly number[] = ${JSON.stringify(lengths)}\n` +
    `export const snapshotInfo = ${JSON.stringify(snapshotInfo)} as const\n`,
)
const symbols = Object.fromEntries(
  sources.map((source) => [
    source.id,
    source.id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
  ]),
)
for (const metadata of catalog) {
  const sid = metadata.id,
    symbol = symbols[sid]
  generated.set(
    `metadata/${sid}.ts`,
    '// Generated; reference source metadata.\n' +
      "import type { AudioSource } from '../../types'\n" +
      `const metadata: AudioSource & { readonly id: ${JSON.stringify(sid)} } = ${JSON.stringify(metadata)}\nexport default metadata\n`,
  )
  for (const target of targets) {
    const value = { targetLufs: target, ...policies[target].sources[sid] }
    generated.set(
      `policies/target${target}/${sid}.ts`,
      '// Generated; source baseline + peak guard only.\n' +
        "import type { AudioSourcePolicyData } from '../../../types'\n" +
        `const policy: AudioSourcePolicyData = ${JSON.stringify(value)}\nexport default policy\n`,
    )
    const prefix = target === -20 ? '..' : '../..'
    const entryPath =
      target === -20 ? `../sources/${sid}.ts` : `../targets/${target}/${sid}.ts`
    generated.set(
      entryPath,
      '// Generated; isolated entry point. The factory is pure for tree shaking.\n' +
        `import metadata from '${prefix}/generated/metadata/${sid}'\n` +
        `import policy from '${prefix}/generated/policies/target${target}/${sid}'\n` +
        `import { createAudioSource } from '${prefix}/playback'\n` +
        `const ${symbol} = /* @__PURE__ */ createAudioSource(metadata, policy)\n` +
        `export { ${symbol} }\nexport default ${symbol}\n`,
    )
  }
  generated.set(
    `../hashes/${sid}.ts`,
    '// Generated; optional exact-content checks, isolated by source.\n' +
      `import hashes from '../generated/hashes/${sid}'\n` +
      `import metadata from '../generated/metadata/${sid}'\n` +
      "import { createAudioContentManifest } from '../verify'\n" +
      'const manifest = /* @__PURE__ */ createAudioContentManifest(metadata.id, metadata.contentRevision, hashes)\nexport default manifest\n',
  )
}
for (const target of targets) {
  const payload = JSON.stringify(policies[target])
  summary.targets[target] = {
    jsonBytes: Buffer.byteLength(payload),
    gzipBytes: gzipSync(payload).length,
    ready: summary.sources.reduce(
      (n, source) => n + source.targets[target].ready,
      0,
    ),
    peakLimited: summary.sources.reduce(
      (n, source) => n + source.targets[target].peakLimited,
      0,
    ),
  }
}
generated.set(
  'source-exports.ts',
  '// Generated; re-exports are statically tree-shakable.\n' +
    sources
      .map(
        (source) =>
          `export { default as ${symbols[source.id]} } from '../sources/${source.id}'`,
      )
      .join('\n') +
    '\n',
)
generated.set(
  'loaders.ts',
  '// Generated; included only by the explicit /load entry.\n' +
    'export const sourceLoaders = {\n' +
    targets
      .map(
        (target) =>
          `${JSON.stringify(String(target))}: {\n` +
          sources
            .map(
              (source) =>
                `${JSON.stringify(source.id)}: () => import('${target === -20 ? '../sources' : '../targets/' + target}/${source.id}'),`,
            )
            .join('\n') +
          '\n},',
      )
      .join('\n') +
    '\n}\n' +
    'export const hashLoaders = {\n' +
    sources
      .map(
        (source) =>
          `${JSON.stringify(source.id)}: () => import('../hashes/${source.id}'),`,
      )
      .join('\n') +
    '\n}\n',
)
generated.set(
  '../catalog.ts',
  '// Generated; optional catalog metadata for source selectors.\n' +
    "import type { AudioSource } from './types'\n" +
    catalog
      .map(
        (metadata, index) =>
          `import source${index} from './generated/metadata/${metadata.id}'`,
      )
      .join('\n') +
    '\n' +
    'export const audioSources: readonly AudioSource[] = /* @__PURE__ */ Object.freeze([' +
    catalog
      .map((_, index) => `/* @__PURE__ */ Object.freeze(source${index})`)
      .join(',') +
    '])\n',
)
summary.snapshotId = snapshotId
generated.set('runtime-summary.json', JSON.stringify(summary, null, 2) + '\n')
for (const [relative, content] of generated) {
  const destination = join(output, relative)
  if (check)
    assert.equal(
      await readFile(destination, 'utf8'),
      content,
      `Stale runtime output: ${relative}`,
    )
  else {
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, content)
  }
}
console.log(
  JSON.stringify({
    checked: check,
    snapshotId,
    generatedFiles: generated.size,
    targets: summary.targets,
  }),
)
