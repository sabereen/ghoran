<script setup lang="ts">
import { loadText } from '@ghoran/text'
import { computed, ref } from 'vue'

const mode = ref<'word' | 'alphabet'>('word')

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
  test() {
    const hafsWordCounts = hafsText.map(wordStrategy.splitHafs)
    const imlaWordCounts = imlaText.map(wordStrategy.splitImla)
    const errors = []
    for (let i = 0; i < hafsWordCounts.length; i++) {
      if (hafsWordCounts[i].length !== imlaWordCounts[i].length) errors.push(i)
    }
    return errors
  },
}

const alphabetStrategy = {
  // اگر یک فتحه و الف مقصوره پشت سر هم دیده شد یک حرف به حساب بیاید
  splitHafs: (ayah: string): string[] =>
    Array.from(ayah.match(/(\p{L}|\u064e\u0670)/gu) || []),
  // الف مقصوره در رسم املاء پایه‌هایی همچون «ی» و «و» و «ا» دارد
  // ضمن اینکه برای لفظ جلاله «الله» هم تشدبد قبل الف مقصوره است
  // که در اینجا نباید آن را یک حرف مستقل به حساب آوریم
  splitImla: (ayah: string): string[] =>
    ayah.match(/(\p{L}|(?<![اّو])\u0670(?=ی))/gu) || [],
  match(hafsItem: string, imlaItem: string) {
    return hafsItem === imlaItem
  },
  test() {
    const hafsWordCounts = hafsText.map(alphabetStrategy.splitHafs)
    const imlaWordCounts = imlaText.map(alphabetStrategy.splitImla)
    const errors = []
    for (let i = 0; i < hafsWordCounts.length; i++) {
      if (hafsWordCounts[i].length !== imlaWordCounts[i].length) {
        console.log('error', hafsWordCounts[i], imlaWordCounts[i])
        errors.push(i)
      }
    }
    return errors
  },
}

const getStrategy = () =>
  mode.value === 'word' ? wordStrategy : alphabetStrategy

const affectiveCountTestResult = computed(() => getStrategy().test())

const expandCompare = ref({
  hafs: [] as string[],
  imla: [] as string[],
  index: -1,
})

function expand(i: number) {
  expandCompare.value = {
    hafs: getStrategy().splitHafs(hafsText[i]),
    imla: getStrategy().splitImla(imlaText[i]),
    index: i,
  }
}

function isItemError(i: number) {
  return !getStrategy().match(
    expandCompare.value.hafs[i] || '',
    expandCompare.value.imla[i] || '',
  )
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
              <td>{{ hafsText[index] }}</td>
              <td>{{ imlaText[index] }}</td>
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
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
