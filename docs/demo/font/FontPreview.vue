<script setup lang="ts">
import { loadText } from '@ghoran/text'
import '@ghoran/text/fonts/uthmanic-hafs/style.css'
import { ref } from 'vue'

const ayat = ref<string[]>()
loadText('hafs').then((result) => {
  ayat.value = result
})
</script>

<template>
  <div v-if="ayat" class="text-uthmanic-hafs">{{ ayat[124] }}</div>
  <div v-else>در حال بارگذاری</div>
</template>
