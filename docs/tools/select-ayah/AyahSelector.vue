<script lang="ts" setup>
import { computed, ref, shallowRef, watch } from 'vue'
import { loadText, textMetaData, QuranTextType } from '@ghoran/text'
import { pageList } from '@ghoran/metadata'
import { Ayah } from '@ghoran/entity'

const pageNumber = ref(1)

const rasmolkhat = ref<QuranTextType>('tanzil-simple-min')

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
    <div class="mb-6 text-lg flex items-center">
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
    <div v-if="isValidPageNumber">
      <div v-for="(ayah, i) in pageText" class="mb-6">
        <div v-if="pageAyat[i].isFirstOfSurah" class="mb-3">
          سوره {{ pageAyat[i].surah.name }}
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
              ({{ pageAyat[i].ayahNumber }}&nbsp;{{ pageAyat[i].surah.name }})
            </span>
          </div>
          <div>
            <span
              v-for="(word, offset) in ayah"
              class="group border-1 text-lg group border-gray-500 border-solid relative mx-1 rounded inline-block px-1.5 mb-1.5 py-0.5"
            >
              {{ word }}
              <span
                class="absolute font-bold bg-white dark:bg-black border group-hover:scale-200 border-gray-500 border-solid transition-transform text-10px w-4 h-4 leading-4 rounded-full flex items-center justify-center left-0 top-0 transform -translate-y-1/2 translate-x-1/2"
              >
                {{ offset }}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
    <div v-else>شماره صفحه نامعتبر است</div>
  </div>
</template>
