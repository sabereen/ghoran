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
      `import { parhizgar, ansarian, createAudioNormalizer } from '@ghoran/audio';
      export const audio = createAudioNormalizer({ sources: [parhizgar, ansarian] });`,
      ['parhizgar', 'ansarian'],
    ],
    [
      'subpath-two-sources',
      `import parhizgar from '@ghoran/audio/sources/parhizgar';
      import ansarian from '@ghoran/audio/sources/ansarian';
      export const profiles = [parhizgar, ansarian];`,
      ['parhizgar', 'ansarian'],
    ],
    [
      'single-source-with-url',
      `import parhizgar from '@ghoran/audio/sources/parhizgar';
      import { getAudioUrl } from '@ghoran/audio/url';
      export const profile = parhizgar;
      export const url = index => getAudioUrl(parhizgar, index);`,
      ['parhizgar'],
      true,
    ],
    ['math-only', `export { dbToLinearGain } from '@ghoran/audio';`, []],
    [
      'single-alternative-target',
      `export { default as profile } from '@ghoran/audio/targets/-23/parhizgar';`,
      ['parhizgar'],
    ],
    [
      'paired-two-sources',
      `import motaz from '@ghoran/audio/paired/motaz';
      import maleki from '@ghoran/audio/paired/maleki';
      import { createAudioPair } from '@ghoran/audio/pair';
      export const audio = createAudioPair({recitation:motaz,translation:maleki});`,
      ['motaz', 'maleki'],
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
  for (const [name, code, included, includesUrl = false] of cases) {
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
      combined.length <
        (name === 'math-only'
          ? 1000
          : name === 'paired-two-sources'
            ? 60000
            : 15000),
      `${name}: runtime size budget exceeded`,
    )
    // Assert actual emitted code, not source imports: object methods may otherwise
    // retain address parsing even when the application never calls them.
    assert.equal(
      /\[\s*7,\s*286,\s*200,\s*176,/.test(combined),
      includesUrl,
      `${name}: optional surah table leaked or URL addressing was lost`,
    )
    assert.equal(
      combined.includes('padStart'),
      includesUrl,
      `${name}: optional file-name conversion leaked or was lost`,
    )
    assert(
      !/surah:ayah|Audio verse ordinal|toAudioVerseOrdinal/.test(combined),
      `${name}: removed address overloads leaked`,
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
