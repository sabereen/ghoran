<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { HighlightSegment, QuranSearch, SearchMode } from '@ghoran/search'
import '@ghoran/text/fonts/uthmanic-hafs-v3/style.css'

const query = ref('الرحمن الرحيم')
const mode = ref<SearchMode>('phrase')
const status = ref('عبارت مورد نظر را بنویسید؛ نتیجه‌ها خودکار به‌روز می‌شوند.')
const busy = ref(false)
const rows = shallowRef<{ key: string; segments: HighlightSegment[] }[]>([])
let engine: Promise<QuranSearch> | undefined
let controller: AbortController | undefined
let generation = 0
let debounce: ReturnType<typeof setTimeout> | undefined

function schedule() {
  // Invalidate immediately, before the debounce, so a previous query cannot
  // replace the results while the visitor is typing a new one.
  generation++
  controller?.abort()
  clearTimeout(debounce)
  if (!query.value.trim()) {
    rows.value = []
    busy.value = false
    status.value = 'عبارت مورد نظر را بنویسید.'
    return
  }
  busy.value = true
  status.value = 'در حال جستجو…'
  debounce = setTimeout(run, 250)
}

watch([query, mode], schedule)
onMounted(run)

async function run() {
  clearTimeout(debounce)
  if (!query.value.trim()) {
    schedule()
    return
  }
  const currentQuery = query.value
  const currentMode = mode.value
  controller?.abort()
  controller = new AbortController()
  const current = ++generation
  const signal = controller.signal
  busy.value = true
  status.value = 'در حال جستجو…'
  try {
    const { createBrowserQuranSearch } = await import('@ghoran/search/browser')
    engine ??= createBrowserQuranSearch({
      workerFactory:
        typeof Worker === 'undefined'
          ? undefined
          : () =>
              new Worker(new URL('./search.worker.ts', import.meta.url), {
                type: 'module',
              }),
      fallback: 'direct',
      onFallback(error) {
        console.warn(
          'Quran search demo: worker initialization failed; using direct execution.',
          error,
        )
      },
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
      search.search(currentQuery, { mode: currentMode, limit: 10, signal }),
      importText('hafs-v3'),
    ])
    if (current !== generation) return
    rows.value = response.hits.map((hit) => ({
      key: hit.key,
      segments: getHighlightSegments(display.default[hit.ayahIndex], hit),
    }))
    status.value = response.total
      ? `${response.total} آیه پیدا شد؛ ${response.hits.length} نتیجه نمایش داده می‌شود.`
      : 'آیه‌ای با این عبارت پیدا نشد.'
  } catch (error) {
    if (current === generation && (error as Error).name !== 'AbortError') {
      rows.value = []
      status.value = `جستجو انجام نشد: ${(error as Error).message}`
    }
  } finally {
    if (current === generation) busy.value = false
  }
}
onBeforeUnmount(() => {
  clearTimeout(debounce)
  generation++
  controller?.abort()
  void engine?.then((search) => search.dispose()).catch(() => {})
})
</script>

<template>
  <section class="quran-search-demo" dir="rtl" aria-label="دموی جستجوی قرآن">
    <form @submit.prevent="run">
      <label for="quran-search-query">عبارت جستجو</label>
      <div class="query-controls">
        <input
          id="quran-search-query"
          v-model="query"
          dir="auto"
          type="search"
          autocomplete="off"
        />
        <button type="submit">جستجو</button>
      </div>
      <div class="mode-control">
        <label for="quran-search-mode">نوع جستجو</label>
        <select id="quran-search-mode" v-model="mode">
          <option value="phrase">عبارت به ترتیب</option>
          <option value="allWords">همهٔ کلمه‌ها</option>
          <option value="anyWord">حداقل یک کلمه</option>
          <option value="substring">بخشی از کلمه</option>
        </select>
      </div>
    </form>
    <p role="status" aria-live="polite">{{ status }}</p>
    <ol :aria-busy="busy">
      <li v-for="row in rows" :key="row.key">
        <span class="verse-key" dir="ltr">{{ row.key }}</span>
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
input,
select {
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
select:focus-visible,
button:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}
.mode-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
.mode-control select {
  flex: 0 1 auto;
  min-width: 0;
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
  display: inline-block;
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
