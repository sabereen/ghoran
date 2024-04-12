<script setup lang="ts">
import { Surah } from '@ghoran/entity'

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
        <span v-if="surah.isMedinan" class="text-xs">مدنی</span>
        <span v-else class="text-xs">مکی</span>
      </div>
      تعداد آیات: {{ surah.ayahCount }} <br />
      جزء {{ surah.firstAyah.juzNumber }}، صفحه {{ surah.firstAyah.pageNumber }}
    </div>
  </div>
</template>
