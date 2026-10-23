<script setup lang="ts">
import AudioDemo from '../../../demo/audio/AudioDemo.vue'
</script>

# Audio loudness comparison

Choose a reciter, spoken translation and ayah. Each playback pairs the recitation with its translation. The sequence button plays the first three ayahs of Al-Fatihah in that order, making collection-level differences easier to hear.

<ClientOnly>
  <AudioDemo />
</ClientOnly>

Switch between **Original** and **With library** during playback. The recording and playback position stay the same; only gain changes. Listening volume is identical in both modes. The new default is pair matching: after source gains, it attenuates only the louder clip toward a 1-LU predicted difference. Source-baseline-only mode remains available for comparison. Within-file dynamics are preserved; between-file dynamics change and quiet pairs may remain quiet. Identical perceived loudness is not guaranteed.

Audio is fetched from the original hosts only after pressing play. The demo checks its SHA-256 against the measured reference before playback and rejects changed content. It hosts no audio and performs no re-encoding. The in-memory cache holds at most eight clips; an internet connection is required.

::: details Playback integration

<<< ../../../demo/audio/player.ts

:::

[Audio package API](/en/packages/audio)
