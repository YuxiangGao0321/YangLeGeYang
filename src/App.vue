<template>
  <div class="app-shell">
    <div class="content">
      <router-view />
    </div>
  </div>
</template>
<script setup lang="ts"></script>
<style scoped>
.app-shell {
  background: #c1ef87;
  padding: 16px 16px max(22px, env(safe-area-inset-bottom));
  min-height: 100vh;
  min-height: 100dvh;
}

.content {
  max-width: 480px;
  margin: 0 auto;
}
@media (max-width: 360px) {
  .app-shell { padding-left: 10px; padding-right: 10px; }
}
</style>
