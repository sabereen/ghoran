<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import type { HighlightSegment, QuranSearch } from '@ghoran/search'
import '@ghoran/text/fonts/uthmanic-hafs-v3/style.css'

const query = ref('الرحمن الرحيم')
const status = ref('Enter a phrase and select Search. Text loads on first use.')
const busy = ref(false)
const rows = shallowRef<{ key: string; segments: HighlightSegment[] }[]>([])
let engine: Promise<QuranSearch> | undefined
let controller: AbortController | undefined
let generation = 0

async function run() {
  controller?.abort()
  controller = new AbortController()
  const current = ++generation
  const signal = controller.signal
  busy.value = true
  status.value = 'Searching…'
  try {
    const { createBrowserQuranSearch } = await import('@ghoran/search/browser')
    engine ??= createBrowserQuranSearch({
      workerFactory: () =>
        new Worker(new URL('./search.worker.ts', import.meta.url), {
          type: 'module',
        }),
    }).catch((error) => {
      engine = undefined
      throw error
    })
    const [{ getHighlightSegments }, { importText }, search] =
      await Promise.all([
        import('@ghoran/search'),
        import('@ghoran/text'),
        engine,
      ])
    const [response, display] = await Promise.all([
      search.search(query.value, { limit: 10, signal }),
      importText('hafs-v3'),
    ])
    if (current !== generation) return
    rows.value = response.hits.map((hit) => ({
      key: hit.key,
      segments: getHighlightSegments(display.default[hit.ayahIndex], hit),
    }))
    status.value = `${response.total} verses. Showing ${response.hits.length}.`
  } catch (error) {
    if (current === generation && (error as Error).name !== 'AbortError') {
      rows.value = []
      status.value = `Search failed: ${(error as Error).message}`
    }
  } finally {
    if (current === generation) busy.value = false
  }
}
onBeforeUnmount(() => {
  generation++
  controller?.abort()
  void engine?.then((search) => search.dispose()).catch(() => {})
})
</script>

<template>
  <section class="quran-search-demo" dir="ltr" aria-label="Quran search demo">
    <form @submit.prevent="run">
      <label for="quran-search-query">Arabic phrase</label>
      <div class="query-controls">
        <input
          id="quran-search-query"
          v-model="query"
          dir="auto"
          type="search"
          autocomplete="off"
        />
        <button type="submit">Search</button>
      </div>
    </form>
    <p role="status" aria-live="polite">{{ status }}</p>
    <ol :aria-busy="busy">
      <li v-for="row in rows" :key="row.key">
        <span class="verse-key">{{ row.key }}</span>
        <p dir="rtl" lang="ar" class="text-uthmanic-hafs-v3">
          <template v-for="(segment, index) in row.segments" :key="index"
            ><mark v-if="segment.highlighted">{{ segment.text }}</mark
            ><span v-else>{{ segment.text }}</span></template
          >
        </p>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.quran-search-demo {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 1rem;
}
.query-controls {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--vp-c-divider);
  padding: 0.5rem;
  border-radius: 4px;
}
button {
  border-radius: 4px;
  background: var(--vp-c-brand-1);
  color: var(--vp-c-white);
  padding: 0.5rem 1rem;
}
input:focus-visible,
button:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}
ol {
  padding: 0;
  list-style: none;
}
li {
  border-top: 1px solid var(--vp-c-divider);
  padding-top: 0.5rem;
}
.verse-key {
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}
li p {
  font-size: 1.7rem;
  line-height: 2.2;
  margin: 0.25rem 0 1rem;
}
mark {
  background: #ffe28a;
  color: #292115;
  border-radius: 3px;
}
@media (max-width: 400px) {
  .query-controls {
    flex-direction: column;
  }
}
</style>
