# Quran audio

The current reference snapshot has 81,068 measurable files and no unavailable gains after adopting 11 user-accepted replacements. Their publication at the canonical URLs is still unverified: `audioDataset.pendingPublicationFiles` is 11, and each profile exposes its own `metadata.pendingPublicationFiles`. Old cached audio is not covered by the new reference hash; strict `/verify` lookup rejects it. Statistical quality flags remain separate from decode validity.

`@ghoran/audio` provides independently importable, tree-shakable source profiles. It applies no player effects and never fetches, decodes, or analyzes audio at runtime.


## Match each recitation/translation pair (0.3)

A source baseline does not match individual pairs: the previous policy left Maleki about **11.3 LU louder than Motaz at 1:1**. For sequential playback use the optional pair API:

```ts
import motaz from '@ghoran/audio/paired/motaz'
import maleki from '@ghoran/audio/paired/maleki'
import { createAudioPair } from '@ghoran/audio/pair'
const audio = createAudioPair({ recitation: motaz, translation: maleki })
const result = audio.getRecommendation(ayahIndex)
if (result.status === 'ready') {
  recitationGainNode.gain.value = result.recitation.gainLinear
  translationGainNode.gain.value = result.translation.gainLinear
}
```

The policy starts with peak-protected source gains, then attenuates only the louder clip toward a 1-LU difference. The quieter clip sets the achievable level; quiet pairs can remain quiet. It adds no boost, limiter, compressor or live audio analysis. Constant gain preserves dynamics **within** a file; dynamics **between** files change. This is an explicit playback policy, not an automatic repair of statistical anomalies.

`toleranceLu` defaults to 1; `maximumAdditionalCutDb` defaults to 18 and also respects the profile's absolute cut limit. `matched: false` and `cutLimited: true` report an unattainable match. Unmeasurable references return `status: 'unavailable'` with null tracks, without neighbor imputation.

`/sources/*` remains a baseline plus sparse peak exceptions. Only `/paired/*` adds 6,236 measured playback levels at 0.1-LU resolution: 12,472 binary bytes per source, approximately 8 KB gzip in its published module. These are measurements, not per-file gains. Static imports exclude all other sources, hashes and address tables. Quantization adds at most 0.1 LU of pair prediction error. Similar integrated LUFS does not guarantee identical perceived loudness or timbre.

All **224,496 reference pairs** were checked. 130 cannot fully match within the cut budget. For Motaz–Maleki the 95th-percentile absolute difference falls from 5.25 to 1.06 LU; the maximum falls from 11.50 to 1.10 LU. These are predictions from reference measurements, not listening-test results. See the [reproducibility guide](https://github.com/sabereen/ghoran/blob/main/packages/audio/RESEARCH.md).

`contentVerified` remains false: verify both original files against their optional hash manifests when strict byte binding is needed. Whole-ayah levels do not necessarily describe cropped excerpts.

```ts
import { parhizgar, ansarian, createAudioNormalizer } from '@ghoran/audio'

const audio = createAudioNormalizer({ sources: [parhizgar, ansarian] })
const gain = audio.getGain('parhizgar', 261) // linear amplitude or null
```

Named imports or explicit `/sources/parhizgar` entry points eliminate unused sources. Real installed-tarball Vite builds check that other sources, targets, and checksum manifests do not leak into static consumers. Import an alternative target through `/targets/-23/parhizgar`. `/load` supports dynamic source selection and may emit deferred chunks for every selectable option; static imports eliminate these assets entirely. `/catalog` is an optional source-selector catalog.

The default -20 LUFS policy uses a fixed source baseline with per-file true-peak safeguards, preserving natural expression. Inferred recording-session and local-outlier corrections are disabled. Gains are conservatively quantized downward in 0.01 dB steps. The native/dual-mono comparison assumes equal-amplitude mono duplication into two playback channels.

Every ayah API takes a **zero-based `ayahIndex` (0–6235)**, identical to text/translation array indices and `Ayah.index`. Index 0 is 1:1, 261 is 2:255, and 6235 is 114:6. String/object addresses are not accepted. Invalid indices throw `RangeError`. Unavailable measurements return `null` without a baseline fallback. Recommendation objects return `ayahIndex`, with no address conversion.

URL generation is an explicit optional import. Gain profiles do not have a `getUrl` method and never import the surah table or filename conversion code:

```ts
import { getAudioUrl } from '@ghoran/audio/url'
const url = getAudioUrl(parhizgar, 261) // .../002255.mp3
```

Runtime metadata stays sparse: one source baseline plus indexed exceptions, not 6,236 gains per source. The obsolete `/legacy` adapter and address overloads are removed before first publication.

Reference lookup does not validate the currently playing bytes. For strict content binding, explicitly import `/hashes/parhizgar` and `getVerifiedAudioGain` from `/verify`, then provide the SHA-256 of the original downloaded file. Changed bytes, source revisions, and unavailable gains return `null`.

[Try the listening demo](/en/demo/audio/): select any of the nine reciters and four spoken translations, play an ayah followed by its translation, and toggle gain matching during the same playback.

Only compact playback inputs and optional hashes are kept in main. Full measured/inferred/recommended datasets and scientific methods are preserved in the [fixed research archive](https://github.com/sabereen/ghoran/tree/fbd55d0fe9c3cf5559a0af9e0b6ca1e9da37d365/packages/audio). The [reproducibility guide](https://github.com/sabereen/ghoran/blob/main/packages/audio/RESEARCH.md) explains how to regenerate the compact snapshot. Daily builds use offline Node only.
