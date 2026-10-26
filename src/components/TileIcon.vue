<template>
  <img v-if="number > 0 && number <= 16" class="tile-art" :src="`/art/tiles/block-${String(number).padStart(2, '0')}.svg`" alt="" draggable="false" />
  <svg v-else-if="number > 16" class="tile-art" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="#514b2b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <g v-if="number === 17">
      <path d="M33 20c-17-13-27 3-20 21 6 18 13 13 19 13s14 4 20-14c6-19-7-31-19-20Z" fill="#f57759" />
      <path d="M32 23 35 9m-1 6c9 1 13-5 14-9-10-1-14 3-14 9Z" fill="#8cbc42" />
      <path d="M20 29c-3 4-3 8-1 11" stroke="#ffb994" />
    </g>
    <g v-else-if="number === 18">
      <path d="m24 32-3 23h22l-4-23" fill="#fff3c4" />
      <path d="M8 33c1-30 47-30 48 0-10 6-36 6-48 0Z" fill="#e96b50" />
      <path d="M20 22h1m12-6h1m10 10h1" stroke="#fff3d8" stroke-width="7" />
    </g>
    <g v-else-if="number === 19">
      <path d="M32 34C8 33 9 11 23 12c8-1 10 10 9 18 3-23 25-20 22-6-1 11-17 12-20 10 21 5 14 24 2 19-8-3-7-14-4-19Z" fill="#82b544" />
      <path d="m31 35-8 21" />
    </g>
    <g v-else-if="number === 20">
      <path d="M49 37c2 25-36 25-34 0C16 25 27 8 32 8S48 25 49 37Z" fill="#fff6de" />
      <path d="M22 37c0-7 5-15 8-17" stroke="#e4d4aa" />
    </g>
    <g v-else>
      <path d="M32 35v23m0-9C16 50 13 39 15 37c11-1 15 8 17 12Zm1-7c12 2 18-6 16-9-10-2-15 5-16 9Z" fill="#80b345" />
      <path d="M24 15C13 1 4 19 18 24 1 34 20 45 27 31c7 17 23 5 13-6 18-2 9-22-3-12 0-17-20-13-13 2Z" fill="#f9d25b" />
      <circle cx="29" cy="23" r="8" fill="#b77a36" />
    </g>
  </svg>
  <span v-else class="custom-art">{{ type }}</span>
</template>

<script setup lang="ts">
import { computed } from "vue";
const props = defineProps<{ type: string }>();
const number = computed(() => /^farm:\d{2}$/.test(props.type) ? Number(props.type.slice(5)) : 0);
</script>

<style scoped>
.tile-art { width: 92%; height: 92%; display: block; margin: auto; pointer-events: none; user-select: none; }
.custom-art { font-size: 30px; line-height: 1; }
</style>
