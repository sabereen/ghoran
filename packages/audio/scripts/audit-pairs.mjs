/** Validate predictions against unquantized measured evidence, not runtime data itself.
 * Usage after build: node scripts/audit-pairs.mjs <archived-data-directory>
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadAudioPairSource } from '../dist/load.mjs'
import { createAudioPair } from '../dist/pair.mjs'
import { getAudioUrl } from '../dist/url.mjs'

assert(process.argv[2], 'Pass archived data directory')
const root = fileURLToPath(new URL('../', import.meta.url))
const snapshot = JSON.parse(await readFile(join(root, 'data/snapshot.json')))
const manifest = JSON.parse(
  await readFile(join(process.argv[2], 'manifest.sha256.json')),
).files
const measurements = new Map()
for (const id of snapshot.sourceIds) {
  const path = `measurements/${id}.jsonl.gz`
  const bytes = await readFile(join(process.argv[2], path))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest[path])
  measurements.set(
    id,
    new Map(
      gunzipSync(bytes)
        .toString()
        .trim()
        .split('\n')
        .map((line) => {
          const record = JSON.parse(line)
          return [record.ordinal - 1, record.measured]
        }),
    ),
  )
}
const sources = await Promise.all(snapshot.sourceIds.map(loadAudioPairSource))
const stats = (values) => {
  values.sort((a, b) => a - b)
  return {
    count: values.length,
    p50: values[Math.floor(values.length * 0.5)],
    p95: values[Math.floor(values.length * 0.95)],
    max: values.at(-1),
    over3: values.filter((x) => x > 3).length,
  }
}
const matrix = [],
  limitedPairs = [],
  renderPlan = []
for (const r of sources.filter(
  (s) => s.profile.metadata.kind !== 'translation',
)) {
  for (const t of sources.filter(
    (s) => s.profile.metadata.kind === 'translation',
  )) {
    const pair = createAudioPair({ recitation: r, translation: t })
    const before = [],
      after = []
    let unavailable = 0,
      cutLimited = 0
    for (let index = 0; index < 6236; index++) {
      const result = pair.getRecommendation(index)
      if (result.status !== 'ready') {
        unavailable++
        continue
      }
      const rm = measurements.get(r.profile.id).get(index)
      const tm = measurements.get(t.profile.id).get(index)
      for (const [gain, source, measured] of [
        [result.recitation, r, rm],
        [result.translation, t, tm],
      ]) {
        assert(gain.gainDb <= source.profile.getGainDb(index) + 1e-9)
        assert(gain.gainDb >= -18)
        assert(gain.gainDb + measured.loudness.true_peak_dbtp <= -1.15 + 1e-8)
        assert(
          Math.abs(
            source.getPlaybackLoudness(index) - measured.dualmono_playback_lufs,
          ) <= 0.050000001,
        )
      }
      const oldDifference =
        tm.dualmono_playback_lufs +
        t.profile.getGainDb(index) -
        rm.dualmono_playback_lufs -
        r.profile.getGainDb(index)
      const difference =
        tm.dualmono_playback_lufs +
        result.translation.gainDb -
        rm.dualmono_playback_lufs -
        result.recitation.gainDb
      before.push(Math.abs(oldDifference))
      after.push(Math.abs(difference))
      assert(Math.abs(difference) <= Math.abs(oldDifference) + 0.100001)
      if (!result.cutLimited) assert(Math.abs(difference) <= 1.100001)
      else {
        cutLimited++
        limitedPairs.push({
          recitation: r.profile.id,
          translation: t.profile.id,
          ayahIndex: index,
          differenceLu: difference,
        })
      }
      if (
        r.profile.id === 'motaz' &&
        t.profile.id === 'maleki' &&
        [0, 1, 2, 261, 6221, 6222, 40, 777, 1800, 3500, 5100, 6235].includes(
          index,
        )
      ) {
        for (const [gain, source, measured] of [
          [result.recitation, r, rm],
          [result.translation, t, tm],
        ])
          renderPlan.push({
            sourceId: source.profile.id,
            ayahIndex: index,
            url: getAudioUrl(source.profile, index),
            sha256: measured.sha256,
            channels: measured.media.channels,
            baseGainDb: source.profile.getGainDb(index),
            gainDb: gain.gainDb,
            measuredPlaybackLufs: measured.dualmono_playback_lufs,
            predictedLufs: measured.dualmono_playback_lufs + gain.gainDb,
          })
      }
    }
    matrix.push({
      recitation: r.profile.id,
      translation: t.profile.id,
      before: stats(before),
      after: stats(after),
      cutLimited,
      unavailable,
    })
  }
}
const report = {
  schemaVersion: '1.0.0',
  algorithm: 'quieter-clip-anchor-v1',
  snapshotId: snapshot.snapshotInfo.snapshotId,
  classification: 'recommended-policy-validated-against-measured-reference',
  toleranceLu: 1,
  levelQuantizationLu: 0.1,
  maximumPredictionErrorLu: 0.1,
  matrix,
  limitedPairs,
  renderPlan,
}
await mkdir(join(root, 'reports'), { recursive: true })
await writeFile(
  join(root, 'reports/pair-validation.json'),
  JSON.stringify(report, null, 2) + '\n',
)
console.log(
  JSON.stringify({
    pairs: 36 * 6236,
    cutLimited: limitedPairs.length,
    motazMaleki: matrix.find(
      (x) => x.recitation === 'motaz' && x.translation === 'maleki',
    ),
  }),
)
