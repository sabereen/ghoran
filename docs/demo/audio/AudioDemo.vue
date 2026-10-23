<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useData } from 'vitepress'
import { audioSources } from '@ghoran/audio/catalog'
import type { AudioSourceId } from '@ghoran/audio'
import { AudioDemoPlayer, type DemoState, type DemoTrack } from './player'

const { lang } = useData()
const t = (fa: string, en: string) => (lang.value.startsWith('fa') ? fa : en)
const reciters = audioSources.filter((source) => source.kind !== 'translation')
const translations = audioSources.filter(
  (source) => source.kind === 'translation',
)
const reciter = ref<AudioSourceId>('parhizgar')
const translation = ref<AudioSourceId>('ansarian')
const sampleIndex = ref(0)
const enabled = ref(true)
const volume = ref(35)
const samples = [
  { index: 0, key: '1:1', text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' },
  { index: 1, key: '1:2', text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ' },
  { index: 2, key: '1:3', text: 'الرَّحْمَٰنِ الرَّحِيمِ' },
  {
    index: 261,
    key: '2:255',
    text: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ…',
  },
  { index: 6221, key: '112:1', text: 'قُلْ هُوَ اللَّهُ أَحَدٌ' },
  { index: 6222, key: '112:2', text: 'اللَّهُ الصَّمَدُ' },
]
const state = shallowRef<DemoState>({
  phase: 'idle',
  track: null,
  gainDb: null,
  message: '',
})
let player: AudioDemoPlayer | undefined
const busy = computed(
  () => state.value.phase === 'playing' || state.value.phase === 'loading',
)
const status = computed(() => {
  if (state.value.phase === 'error')
    return state.value.message === 'CONTENT_MISMATCH'
      ? t(
          'نسخهٔ این صوت با مرجع اندازه‌گیری یکسان نیست؛ برای مقایسه نمونهٔ دیگری انتخاب کنید.',
          'This recording differs from the measured reference. Choose another sample.',
        )
      : t(
          'پخش ممکن نشد. اتصال اینترنت یا منبع صوت را بررسی و دوباره تلاش کنید.',
          'Playback failed. Check your connection or choose another source, then retry.',
        )
  if (state.value.phase === 'loading')
    return t('در حال آماده‌سازی ', 'Preparing ') + state.value.track?.label
  if (state.value.phase === 'playing')
    return t('در حال پخش ', 'Playing ') + state.value.track?.label
  return t(
    'یک نمونه انتخاب کنید و پخش را بزنید.',
    'Choose a sample and press play.',
  )
})
const gainLabel = computed(() => {
  if (!enabled.value) return '0 dB'
  if (state.value.gainDb === null) return '—'
  return `${state.value.gainDb > 0 ? '+' : ''}${state.value.gainDb.toFixed(2)} dB`
})
function tracks(index: number): DemoTrack[] {
  const sample = samples[index]
  return [reciter.value, translation.value].map((sourceId) => ({
    sourceId,
    ayahIndex: sample.index,
    label: `${audioSources.find((source) => source.id === sourceId)!.nameFa} · ${sample.key}`,
  }))
}
function play(all = false) {
  player ??= new AudioDemoPlayer((value) => {
    state.value = value
  })
  player.setEnabled(enabled.value)
  player.setVolume(volume.value / 100)
  void player.play(
    all
      ? samples.slice(0, 3).flatMap((_, index) => tracks(index))
      : tracks(sampleIndex.value),
  )
}
watch(enabled, (value) => player?.setEnabled(value))
watch(volume, (value) => player?.setVolume(value / 100))
watch([reciter, translation, sampleIndex], () => player?.stop())
onBeforeUnmount(() => player?.dispose())
</script>

<template>
  <section
    class="audio-demo"
    :aria-label="t('مقایسهٔ شنیداری بلندی صوت', 'Audio loudness comparison')"
  >
    <div class="demo-heading">
      <span class="demo-eyebrow" dir="ltr">@ghoran/audio</span>
      <h2>{{ t('تفاوت را بشنوید', 'Hear the difference') }}</h2>
      <p>
        {{
          t(
            'یک آیه، دو صدا؛ با کنترل بلندی و بدون آن.',
            'One ayah, two voices. Compare with and without gain matching.',
          )
        }}
      </p>
    </div>
    <div class="source-grid">
      <label
        >{{ t('قاری', 'Reciter') }}
        <select v-model="reciter">
          <option
            v-for="source in reciters"
            :key="source.id"
            :value="source.id"
          >
            {{ source.nameFa }}
          </option>
        </select>
      </label>
      <label
        >{{ t('ترجمهٔ صوتی', 'Spoken translation') }}
        <select v-model="translation">
          <option
            v-for="source in translations"
            :key="source.id"
            :value="source.id"
          >
            {{ source.nameFa }}
          </option>
        </select>
      </label>
    </div>
    <label class="sample-select"
      >{{ t('نمونهٔ آیه', 'Ayah sample') }}
      <select v-model.number="sampleIndex">
        <option
          v-for="(sample, index) in samples"
          :key="sample.index"
          :value="index"
        >
          {{ sample.key }} — {{ sample.text }}
        </option>
      </select>
    </label>
    <p class="sample-text" lang="ar" dir="rtl">
      {{ samples[sampleIndex].text }}
    </p>
    <div
      class="comparison"
      role="group"
      :aria-label="t('روش پخش', 'Playback mode')"
    >
      <button type="button" :aria-pressed="!enabled" @click="enabled = false">
        {{ t('صدای اصلی', 'Original')
        }}<small>{{ t('بدون تنظیم Gain', 'No gain matching') }}</small>
      </button>
      <button type="button" :aria-pressed="enabled" @click="enabled = true">
        {{ t('با کتابخانه', 'With library')
        }}<small>{{
          t('Gain پایه + حفاظت Peak', 'Source gain + peak protection')
        }}</small>
      </button>
    </div>
    <p class="switch-hint">
      {{
        t(
          'هنگام پخش بین دو حالت جابه‌جا شوید؛ موقعیت صوت تغییر نمی‌کند.',
          'Switch modes during playback; the audio position stays the same.',
        )
      }}
    </p>
    <div class="playback-actions">
      <button class="primary" type="button" @click="play()">
        {{ t('پخش آیه و ترجمه', 'Play ayah + translation') }}
      </button>
      <button type="button" @click="play(true)">
        {{
          t(
            'پخش سه آیهٔ اول، پشت‌سرهم',
            'Play the first three ayahs in sequence',
          )
        }}
      </button>
      <button type="button" :disabled="!busy" @click="player?.stop()">
        {{ t('توقف', 'Stop') }}
      </button>
    </div>
    <div class="monitor-row">
      <label
        >{{ t('بلندی شنیدن', 'Listening volume') }}
        <input v-model.number="volume" type="range" min="0" max="70" step="1"
      /></label>
      <output dir="ltr">{{ volume }}%</output>
      <span class="gain-readout"
        >{{ t('Gain فعلی', 'Current gain') }}
        <b dir="ltr">{{ gainLabel }}</b></span
      >
    </div>
    <p
      class="playback-status"
      :class="{ error: state.phase === 'error' }"
      role="status"
      aria-live="polite"
    >
      {{ status }}
    </p>
    <p class="demo-note">
      {{
        t(
          'در هر دو حالت، بلندی شنیدن یکسان است. این تنظیم فقط اختلاف سطح مجموعه‌ها را کاهش می‌دهد؛ فراز و فرود طبیعی آیه حفظ می‌شود.',
          'Listening volume is identical in both modes. Source matching reduces collection-level differences while preserving expression within each ayah.',
        )
      }}
    </p>
  </section>
</template>

<style scoped>
.audio-demo {
  margin: 2rem 0;
  padding: clamp(1.1rem, 4vw, 2rem);
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  background: var(--vp-c-bg-soft);
}
.demo-eyebrow {
  color: var(--vp-c-brand-1);
  font: 600 0.85rem var(--vp-font-family-mono);
}
.demo-heading h2 {
  margin: 0.5rem 0;
  padding: 0;
  border: 0;
  font-size: 1.65rem;
}
.demo-heading p,
.switch-hint,
.demo-note {
  color: var(--vp-c-text-2);
}
.source-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1.5rem;
}
label {
  display: grid;
  gap: 0.4rem;
  font-size: 0.9rem;
  font-weight: 600;
}
select {
  width: 100%;
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 9px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font: inherit;
}
.sample-select {
  margin-top: 1rem;
}
.sample-text {
  min-height: 3rem;
  margin: 1.5rem 0;
  text-align: center;
  font: 1.5rem/2 serif;
}
.comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}
button {
  min-height: 44px;
  padding: 0.65rem 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font: inherit;
  cursor: pointer;
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
button:focus-visible,
select:focus-visible,
input:focus-visible {
  outline: 3px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}
button[aria-pressed='true'] {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  box-shadow: inset 0 0 0 1px var(--vp-c-brand-1);
}
small {
  display: block;
  margin-top: 0.2rem;
  color: var(--vp-c-text-2);
  font-size: 0.75rem;
}
.switch-hint,
.demo-note {
  font-size: 0.82rem;
  line-height: 1.8;
}
.playback-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1.25rem 0;
}
.primary {
  background: var(--vp-c-brand-3);
  color: var(--vp-c-white);
  border-color: transparent;
}
.monitor-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding-top: 1rem;
  border-top: 1px solid var(--vp-c-divider);
}
.monitor-row label {
  flex: 1;
  min-width: 130px;
}
input[type='range'] {
  width: 100%;
  accent-color: var(--vp-c-brand-1);
  min-height: 28px;
}
.gain-readout {
  margin-inline-start: auto;
  font-size: 0.85rem;
}
.gain-readout b {
  display: inline-block;
  min-width: 5rem;
  font-family: var(--vp-font-family-mono);
  text-align: center;
}
.playback-status {
  min-height: 2rem;
  font-size: 0.9rem;
}
.error {
  color: var(--vp-c-danger-1);
}
@media (max-width: 480px) {
  .source-grid {
    grid-template-columns: 1fr;
  }
  .playback-actions button {
    flex: 1 1 100%;
  }
  .comparison button {
    padding: 0.65rem 0.3rem;
  }
}
</style>
