<template>
  <div class="site">
    <NavBar />
    <main class="site-main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.site { min-height: 100vh; }
.site-main { padding: 0; }
</style>
