<script setup lang="ts">
import { loadText } from '@ghoran/text'
import '@ghoran/text/fonts/uthmanic-hafs/style.css'

const ayat = await loadText('hafs')
</script>

<template>
  <div class="text-uthmanic-hafs">{{ ayat[124] }}</div>
</template>
