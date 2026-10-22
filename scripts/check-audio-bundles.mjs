import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { build } from 'vite'

/** Build real installed npm tarballs: no source aliases or workspace resolution. */
export async function verifyAudioBundles(consumer) {
  const cases = [
    [
      'named-two-sources',
      `import { parhizgar, ansarian, createAudioNormalizer } from '@ghoran/audio-analysis';
      export const audio = createAudioNormalizer({ sources: [parhizgar, ansarian] });`,
      ['parhizgar', 'ansarian'],
    ],
    [
      'subpath-two-sources',
      `import parhizgar from '@ghoran/audio-analysis/sources/parhizgar';
      import ansarian from '@ghoran/audio-analysis/sources/ansarian';
      export const profiles = [parhizgar, ansarian];`,
      ['parhizgar', 'ansarian'],
    ],
    [
      'math-only',
      `export { dbToLinearGain } from '@ghoran/audio-analysis';`,
      [],
    ],
    [
      'single-alternative-target',
      `export { default as profile } from '@ghoran/audio-analysis/targets/-23/parhizgar';`,
      ['parhizgar'],
    ],
  ]
  const allSources = [
    'parhizgar',
    'ghamadi',
    'husary',
    'minshawy-murattal',
    'minshawy-mujawwad',
    'motaz',
    'abdulbasit',
    'almuiqly',
    'jafarpour',
    'ansarian',
    'maleki',
    'makarem-kabiri',
    'fooladvand-hedayatfar',
  ]
  const sizes = {}
  for (const [name, code, included] of cases) {
    const entry = join(consumer, `audio-${name}.mjs`)
    await writeFile(entry, code)
    const result = await build({
      root: consumer,
      configFile: false,
      logLevel: 'error',
      build: { write: false, minify: true, lib: { entry, formats: ['es'] } },
    })
    const chunks = (Array.isArray(result) ? result : [result])
      .flatMap((result) => result.output)
      .filter((output) => output.type === 'chunk')
    const combined = chunks.map((chunk) => chunk.code).join('\n')
    assert.equal(
      chunks.length,
      1,
      `${name}: static imports must emit no hidden async data chunks`,
    )
    for (const source of allSources) {
      assert.equal(
        combined.includes(`"${source}"`),
        included.includes(source),
        `${name}: unexpected source ${source}`,
      )
    }
    assert(
      !/\.jsonl|original-file SHA-256 manifest|import\(/.test(combined),
      `${name}: research/hash/loader data leaked`,
    )
    assert(
      combined.length < (name === 'math-only' ? 1000 : 15000),
      `${name}: runtime size budget exceeded`,
    )
    sizes[name] = {
      bytes: Buffer.byteLength(combined),
      gzipBytes: gzipSync(combined).length,
    }
  }
  console.log(
    'Audio packed-consumer tree shaking verified:',
    JSON.stringify(sizes),
  )
}
