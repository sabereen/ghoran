<script setup lang="ts">
import SearchDemo from '../../../demo/search/SearchDemo.vue'
</script>

# Live Quran search

Enter an Arabic query or change the search mode. Results update automatically after a short pause in typing. Use the Search button or Enter to run the search immediately.

Search uses Tanzil text and displays results in Hafs version 3 with matching passages highlighted. The demo shows the total matching verse count and at most ten results.

<ClientOnly>
  <SearchDemo />
</ClientOnly>

Try `الرحمن الرحيم` or `قل هو الله أحد`. To find `رحم` inside words, select Substring mode.

::: details Component source

<<< ../../../demo/search/SearchDemo.vue

:::

::: details Worker entry

<<< ../../../demo/search/search.worker.ts

:::

Search also works without `Intl.Segmenter`; highlights may expand to whole words. No polyfill is required.

[Complete search package guide and API](/en/packages/search)
