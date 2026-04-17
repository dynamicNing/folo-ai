<template>
  <div>
    <NuxtPage v-if="hasPages" />
    <main v-else style="padding:2rem;font-family:system-ui">
      <h1>folo-ai — Nuxt 3 scaffold</h1>
      <p>PR1 OK. pages/ 还没迁入，PR2 再补。</p>
    </main>
  </div>
</template>

<script setup lang="ts">
const hasPages = false
</script>
