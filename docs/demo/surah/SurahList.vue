<script setup lang="ts">
import { useData } from 'vitepress'
import { Surah } from '@ghoran/entity'

const { lang } = useData()
const t = (fa: string, en: string) => (lang.value.startsWith('fa') ? fa : en)

const surahList = Surah.getAll()
</script>

<template>
  <div class="grid grid-gap-2 grid-cols-2 sm:grid-cols-3">
    <div
      v-for="surah in surahList"
      class="rounded shadow-sm bg-green-500/10 p-3"
    >
      <div class="text-2xl font-bold">
        {{ surah.number }}.
        {{ surah.name }}
        <span v-if="surah.isMedinan" class="text-xs">{{
          t('مدنی', 'Medinan')
        }}</span>
        <span v-else class="text-xs">{{ t('مکی', 'Meccan') }}</span>
      </div>
      {{ t('تعداد آیات:', 'Verses:') }} {{ surah.ayahCount }} <br />
      {{ t('جزء', 'Juz') }} {{ surah.firstAyah.juzNumber
      }}{{ t('، صفحه', ' — Page') }} {{ surah.firstAyah.pageNumber }}
    </div>
  </div>
</template>
