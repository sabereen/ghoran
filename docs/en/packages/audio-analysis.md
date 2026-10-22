# Quran audio analysis

`@ghoran/audio-analysis` provides independently importable, tree-shakable source profiles. It applies no player effects and never fetches, decodes, or analyzes audio at runtime.

```ts
import {
  parhizgar,
  ansarian,
  createAudioNormalizer,
} from '@ghoran/audio-analysis'

const audio = createAudioNormalizer({ sources: [parhizgar, ansarian] })
const gain = audio.getGain('parhizgar', '2:255') // linear amplitude or null
const url = audio.getUrl('parhizgar', '2:255')
```

Named imports or explicit `/sources/parhizgar` entry points eliminate unused sources. Real installed-tarball Vite builds check that other sources, targets, and checksum manifests do not leak into static consumers. Import an alternative target through `/targets/-23/parhizgar`. `/load` supports dynamic source selection and may emit deferred chunks for every selectable option; static imports eliminate these assets entirely. `/catalog` is an optional source-selector catalog.

The default -20 LUFS policy uses a fixed source baseline with per-file true-peak safeguards, preserving natural expression. Inferred recording-session and local-outlier corrections are disabled. Gains are conservatively quantized downward in 0.01 dB steps. The native/dual-mono comparison assumes equal-amplitude mono duplication into two playback channels.

Verse inputs accept `'2:255'`, `{ surah: 2, ayah: 255 }`, or a **one-based ordinal**. Use `index + 1` for a text-array index, or pass `Ayah.key`. Unavailable measurements return `null`; they never fall back to a baseline gain.

Reference lookup does not validate the currently playing bytes. For strict content binding, explicitly import `/hashes/parhizgar` and `getVerifiedAudioGain` from `/verify`, then provide the SHA-256 of the original downloaded file. Changed bytes, source revisions, and unavailable gains return `null`.

Measured, inferred and recommended research datasets remain in Git and the independent archive, outside the npm runtime payload. See the [package README](https://github.com/sabereen/ghoran/tree/main/packages/audio-analysis) for all entry points, generation, and limitations.
