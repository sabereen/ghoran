<script lang="ts" setup>
import { computed, ref, shallowRef, watch } from 'vue'
import { loadText, textMetaData, QuranTextType } from '@ghoran/text'
import { pageList } from '@ghoran/metadata'
import { Ayah } from '@ghoran/entity'

const pageNumber = ref(1)

const rasmolkhat = ref<QuranTextType>('tanzil-simple-min')

const range = ref({
  fromAyah: 6,
  fromOffset: 1,
  toAyah: 6,
  toOffset: 4,
})

function fixRange() {
  const r = range.value
  if (
    r.toAyah < r.fromAyah ||
    (r.toAyah === r.fromAyah && r.toOffset < r.fromOffset)
  ) {
    range.value = {
      fromAyah: r.toAyah,
      fromOffset: r.toOffset - 1,
      toAyah: r.fromAyah,
      toOffset: r.fromOffset + 1,
    }
  }
}

const isValidPageNumber = computed(
  () =>
    typeof pageNumber.value === 'number' &&
    pageNumber.value >= 1 &&
    pageNumber.value <= 604,
)

const text = shallowRef(await loadText(rasmolkhat.value))
const startIndex = computed(() => pageList[pageNumber.value - 1])
const endIndex = computed(() => pageList[pageNumber.value] || text.value.length)

const pageText = computed(() =>
  text.value
    .slice(startIndex.value, endIndex.value)
    .map((ayah) => ayah.split(' ')),
)

const pageAyat = computed(() =>
  pageText.value.map((ayah, i) => Ayah.get(startIndex.value + i)),
)

declare const window: any
function copy(text: string | number) {
  window.navigator.clipboard.writeText(text)
  window.alert('کپی شد.')
}

watch(rasmolkhat, async (rasmolkhat) => {
  text.value = await loadText(rasmolkhat)
})

function isInRange(ayahIndex: number, offset: number) {
  if (ayahIndex < range.value.fromAyah) return false
  if (ayahIndex > range.value.toAyah) return false
  if (ayahIndex === range.value.fromAyah && offset < range.value.fromOffset) {
    return false
  }
  if (ayahIndex === range.value.toAyah && offset >= range.value.toOffset) {
    return false
  }
  return true
}

const mode = ref<'idle' | 'select-start' | 'select-end'>('idle')

function select(ayahIndex: number, offset: number) {
  if (mode.value === 'idle') {
    mode.value = 'select-start'
  }
  if (mode.value === 'select-start') {
    range.value.fromAyah = ayahIndex
    range.value.fromOffset = offset
    mode.value = 'select-end'
  } else if (mode.value === 'select-end') {
    range.value.toAyah = ayahIndex
    range.value.toOffset = offset + 1
    mode.value = 'idle'
    fixRange()
  }
}
</script>

<template>
  <div>
    <!-- انتخاب رسم الخط -->
    <div class="mb-3">
      <span>
        <i class="i-solar:text-square-line-duotone w-5 h-5"></i>
        رسم الخط:
      </span>
      <select
        v-model="rasmolkhat"
        dir="ltr"
        class="border border-solid border-gray-500 rounded px-2"
      >
        <option v-for="rasmolkhat in textMetaData" :value="rasmolkhat.name">
          {{ rasmolkhat.name }}
        </option>
      </select>
    </div>
    <!-- انتخاب صفحه -->
    <div class="mb-3 text-lg flex items-center">
      <button
        class="i-solar:alt-arrow-right-outline w-5 h-5 p-2"
        @click="pageNumber--"
      />
      <span class="mx-1">
        صفحه‌ی
        <input
          type="number"
          min="1"
          max="604"
          dir="ltr"
          v-model.number="pageNumber"
          class="border-gray-500 border-solid border-px px-1 rounded"
        />
      </span>
      <button
        class="i-solar:alt-arrow-left-outline w-5 h-5 p-2"
        @click="pageNumber++"
      />
    </div>
    <!-- بازه -->
    <div class="mb-6 border border-dashed border-gray-500 p-2">
      <div>از: اندیس {{ range.fromAyah }} و آفست {{ range.fromOffset }}</div>
      <div>تا: اندیس {{ range.toAyah }} و آفست {{ range.toOffset }}</div>
    </div>

    <div v-if="isValidPageNumber">
      <div v-for="(ayah, i) in pageText" class="mb-6">
        <div v-if="pageAyat[i].isFirstOfSurah" class="mb-3">
          سوره {{ pageAyat[i].surah.name }}
          <div v-if="pageAyat[i].surah.hasBasmalah" class="mt-2">
            {{ text[0] }}
          </div>
        </div>

        <div class="flex items-center">
          <div class="mr-3 flex flex-col">
            <span class="flex flex-col">
              <span class="text-xs">اندیس:</span>
              <button
                class="flex items-center hover:opacity-75"
                @click="copy(pageAyat[i].index)"
              >
                <i class="i-solar:copy-line-duotone w-4 h-4"></i>
                <span class="font-bold ml-1">{{ pageAyat[i].index }}</span>
              </button>
            </span>
            <span class="text-xs">
              {{ pageAyat[i].surah.name }}/{{ pageAyat[i].ayahNumber }}
            </span>
          </div>
          <div>
            <button
              v-for="(word, offset) in ayah"
              class="group border-1 text-lg group border-gray-500 border-solid relative mx-1 rounded inline-block px-1.5 mb-1.5 py-0.5"
              :class="{
                'bg-lightblue-200 dark:bg-lightblue-900':
                  mode === 'select-end' &&
                  pageAyat[i].index === range.fromAyah &&
                  offset === range.fromOffset,
                'border-lightblue-500 border-dashed dark:hover:bg-lightblue-900 hover:bg-lightblue-200':
                  mode === 'select-start' || mode === 'select-end',
                'bg-green-300 dark:bg-green-900':
                  mode === 'idle' && isInRange(pageAyat[i].index, offset),
              }"
              @click="select(pageAyat[i].index, offset)"
            >
              {{ word }}
              <span
                class="absolute font-bold bg-white dark:bg-black border group-hover:scale-200 border-gray-500 border-solid transition-transform text-10px w-4 h-4 leading-4 rounded-full flex items-center justify-center left-0 top-0 transform -translate-y-1/2 translate-x-1/2"
                :class="{ 'scale-150': mode !== 'idle' }"
              >
                {{ offset }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-else>شماره صفحه نامعتبر است</div>
  </div>
</template>
