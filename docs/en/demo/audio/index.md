<script setup lang="ts">
import AudioDemo from '../../../demo/audio/AudioDemo.vue'
</script>

# Audio loudness comparison

Choose a reciter, spoken translation and ayah. Each playback pairs the recitation with its translation. The sequence button plays the first three ayahs of Al-Fatihah in that order, making collection-level differences easier to hear.

<ClientOnly>
  <AudioDemo />
</ClientOnly>

Switch between **Original** and **With library** during playback. The recording and playback position stay the same; only gain changes. Listening volume is identical in both modes. This uses the default −20 LUFS source-baseline policy and preserves natural expression within each ayah.

Audio is fetched from the original hosts only after pressing play. The demo checks its SHA-256 against the measured reference before playback and rejects changed content. It hosts no audio and performs no re-encoding. The in-memory cache holds at most eight clips; an internet connection is required.

::: details Playback integration

<<< ../../../demo/audio/player.ts

:::

[Audio package API](/en/packages/audio)
