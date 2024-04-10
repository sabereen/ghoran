<script setup lang="ts">
import { loadText } from '@ghoran/text'
import { computed, ref, watch, watchSyncEffect } from 'vue'

const mode = ref<'word' | 'alphabet'>('word')
const autofix = ref(false)

const [hafsText, imlaText] = await Promise.all([
  loadText('hafs'),
  loadText('imla'),
])

const wordStrategy = {
  splitHafs: (ayah: string): string[] => ayah.split(' '),
  splitImla: (ayah: string): string[] => ayah.split(' '),
  match(hafsItem: string, imlaItem: string) {
    return (
      alphabetStrategy.splitHafs(hafsItem).length ===
      alphabetStrategy.splitImla(imlaItem).length
    )
  },
  test(textsToUse: { hafs: string[]; imla: string[] }) {
    const hafsWordCounts = textsToUse.hafs.map(wordStrategy.splitHafs)
    const imlaWordCounts = textsToUse.imla.map(wordStrategy.splitImla)
    const errors = []
    for (let i = 0; i < hafsWordCounts.length; i++) {
      if (hafsWordCounts[i].length !== imlaWordCounts[i].length) errors.push(i)
    }
    return errors
  },
  fixOneItem(index: number) {
    const nbsp = '\u00A0'
    const hafsToSplit = hafsText[index]
    const imlaToSplit = imlaText[index].replace(/ ۩/g, nbsp + '۩')
    const hafs = wordStrategy.splitHafs(hafsToSplit)
    const imla = wordStrategy.splitImla(imlaToSplit)
    const length = Math.max(hafs.length, imla.length)
    for (let i = 0; i < length; i++) {
      if (!hafs[i] || !imla[i]) continue
      if (!wordStrategy.match(hafs[i], imla[i])) {
        const hafsLength = alphabetStrategy.splitHafs(hafs[i]).length
        const imlaLength = alphabetStrategy.splitImla(imla[i]).length
        if (imlaLength < hafsLength) {
          // فاصله عادی را تبدیل به nbsp می‌کنیم
          imla[i] = imla[i] + nbsp + imla[i + 1]
          imla.splice(i + 1, 1)
        }
      }
    }

    return { hafs, imla }
  },
  fix() {
    const fixedImlaText = [...imlaText]
    const fixedHafsText = [...hafsText]
    const errors = wordStrategy.test({ hafs: hafsText, imla: imlaText })

    errors.forEach((index) => {
      const fixResult = wordStrategy.fixOneItem(index)
      fixedHafsText[index] = fixResult.hafs.join(' ')
      fixedImlaText[index] = fixResult.imla.join(' ')
    })

    console.log('fix word', { fixedImlaText, fixedHafsText })

    return {
      imla: fixedImlaText,
      hafs: fixedHafsText,
    }
  },
  getText() {
    console.log('text word')
    if (autofix.value) {
      return wordStrategy.fix()
    }
    return {
      hafs: hafsText,
      imla: imlaText,
    }
  },
}

const alphabetStrategy = {
  splitHafs: (ayah: string): string[] =>
    Array.from((ayah || '').match(/\p{L}/gu) || []).filter(
      (item) => !item.match(/[وـؤءإٱأائىیيۦ]/),
    ),
  splitImla: (ayah: string): string[] =>
    Array.from((ayah || '').match(/\p{L}/gu) || []).filter(
      (item) => !item.match(/[وـؤءإٱأائىیيۦ]/),
    ),
  match(hafsItem: string, imlaItem: string) {
    return hafsItem === imlaItem
  },
  test(textsToUse: { hafs: string[]; imla: string[] }) {
    const hafsWordCounts = textsToUse.hafs.map(alphabetStrategy.splitHafs)
    const imlaWordCounts = textsToUse.imla.map(alphabetStrategy.splitImla)
    const errors = []
    for (let i = 0; i < hafsWordCounts.length; i++) {
      if (hafsWordCounts[i].length !== imlaWordCounts[i].length) {
        errors.push(i)
      }
    }
    return errors
  },
  fix() {
    return alphabetStrategy.getText()
  },
  getText() {
    return {
      hafs: hafsText,
      imla: imlaText,
    }
  },
}

const getStrategy = () =>
  mode.value === 'word' ? wordStrategy : alphabetStrategy

const texts = computed(() => getStrategy().getText())

const affectiveCountTestResult = computed(() => getStrategy().test(texts.value))

const expandCompare = ref({
  hafs: [] as string[],
  imla: [] as string[],
  index: -1,
})

function expand(i: number) {
  expandCompare.value = {
    hafs: getStrategy().splitHafs(texts.value.hafs[i]),
    imla: getStrategy().splitImla(texts.value.imla[i]),
    index: i,
  }
  previewAutofix(i)
}

function isItemError(i: number) {
  return !getStrategy().match(
    expandCompare.value.hafs[i] || '',
    expandCompare.value.imla[i] || '',
  )
}

const autofixPreviewCompare = ref({
  hafs: [] as string[],
  imla: [] as string[],
  index: -1,
})
function previewAutofix(index: number) {
  const strategy = getStrategy()
  if (strategy === alphabetStrategy) {
    autofixPreviewCompare.value = {
      hafs: [] as string[],
      imla: [] as string[],
      index: -1,
    }
    return
  }

  const { hafs, imla } = wordStrategy.fixOneItem(index)

  autofixPreviewCompare.value = { hafs, imla, index }
}
</script>

<template>
  <div>
    <div class="my-4">
      <label class="mr-3">
        <input type="radio" v-model="mode" value="word" />
        تفکیک واژه
      </label>
      <label>
        <input type="radio" v-model="mode" value="alphabet" />
        تفکیک حروف الفبا
      </label>
    </div>
    <div>
      <label>
        <input type="checkbox" v-model="autofix" />
        تلاش برای رفع اشکالات
      </label>
    </div>
    <div>تعداد آیات متفاوت: {{ affectiveCountTestResult.length }}</div>
    <div>
      <table>
        <thead>
          <th>عثمان‌طه</th>
          <th>رسم الاملاء</th>
        </thead>
        <tbody>
          <template v-for="index in affectiveCountTestResult">
            <tr @click="expand(index)">
              <td>{{ texts.hafs[index] }}</td>
              <td>{{ texts.imla[index] }}</td>
            </tr>
            <tr v-if="expandCompare.index === index">
              <td colspan="2" class="h-40 relative">
                <table class="absolute inset-0">
                  <tr>
                    <td
                      v-for="(item, i) in expandCompare.hafs"
                      :class="{ 'bg-red-500/15!': isItemError(i) }"
                    >
                      {{ item }}
                    </td>
                  </tr>
                  <tr>
                    <td
                      v-for="(item, i) in expandCompare.imla"
                      :class="{ 'bg-red-500/15!': isItemError(i) }"
                    >
                      {{ item }}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr v-if="autofixPreviewCompare.index === index">
              <td colspan="2" class="h-40 relative">
                <table class="absolute inset-0">
                  <tr>
                    <td
                      v-for="(item, i) in autofixPreviewCompare.hafs"
                      :class="{ 'bg-red-500/15!': false }"
                    >
                      {{ item }}
                    </td>
                  </tr>
                  <tr>
                    <td
                      v-for="(item, i) in autofixPreviewCompare.imla"
                      :class="{ 'bg-red-500/15!': false }"
                    >
                      {{ item }}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
