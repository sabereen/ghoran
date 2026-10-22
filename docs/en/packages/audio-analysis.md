# Quran audio analysis

`@ghoran/audio-analysis` separates measured file metadata, statistical inferences and policy-dependent gain recommendations. Its Python/FFmpeg pipeline is independent of any application. Original audio is never trimmed, normalized or re-encoded.

```ts
import {
  sources,
  datasetCoverage,
  createGainLookup,
} from '@ghoran/audio-analysis'
```

Coverage is explicit and an incomplete dataset is never presented as a whole-Quran result. Consumer files are loaded separately by source and target. Gain lookup requires the exact content hash and uses a **one-based ordinal**, unlike the zero-based text array.

See the [package README](https://github.com/sabereen/ghoran/tree/main/packages/audio-analysis) for measurement definitions, reproducible analysis, schemas, compressed data and player integration.
