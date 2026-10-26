<template>
  <div class="app-shell" :class="{ 'is-game': route.path === '/game' }">
    <div class="content">
      <router-view />
    </div>
  </div>
</template>
<script setup lang="ts">
import { useRoute } from "vue-router";
const route = useRoute();
</script>
<style scoped>
.app-shell {
  background: var(--farm-green);
  padding: 16px 16px max(22px, env(safe-area-inset-bottom));
  min-height: 100vh;
  min-height: 100dvh;
}

.content {
  max-width: 480px;
  margin: 0 auto;
}
.app-shell.is-game { padding: 0; }
.is-game .content { max-width: 588px; width: min(100%, max(320px, 57.47svh)); container-type: inline-size; }
@media (max-width: 360px) {
  .app-shell { padding-left: 10px; padding-right: 10px; }
}
</style>
