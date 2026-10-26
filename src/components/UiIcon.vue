<template>
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-if="name === 'back'" d="m29 12-12 12 12 12" />
    <g v-else-if="name === 'remove'" fill="#ffe07a" stroke="#66522c"><path d="m12 21-5 17 26 5 7-23-9-2"/><path d="m22 29 4-17-7 3 9-11 7 14-6-3-3 15"/></g>
    <path v-else-if="name === 'undo'" d="M15 16h14a13 13 0 1 1-12 20M16 6 7 16l10 9" stroke="#ffe07a" stroke-width="6" />
    <g v-else-if="name === 'shuffle'" stroke="#ffe07a" stroke-width="5"><path d="m10 8 27 32m-8-1 10 3 1-11M10 40 37 8M28 8l11-2 1 10"/></g>
    <g v-else-if="name === 'sound'"><path d="m8 20 9-1 10-9v29l-10-9H8Z"/><path d="M34 15c6 5 6 13 0 18"/><path v-if="muted" d="m6 5 36 38" stroke="#b74b3c"/></g>
    <g v-else-if="name === 'restart'"><path d="M9 17a17 17 0 1 1 0 16M9 7v12h12"/></g>
    <g v-else-if="name === 'spark'"><path d="m24 4 4 13 14 7-14 4-4 15-5-15-14-4 14-7Z" fill="#ffe37e"/></g>
    <g v-else-if="name === 'eye'"><path d="M3 24s8-13 21-13 21 13 21 13-8 13-21 13S3 24 3 24Z"/><circle cx="24" cy="24" r="7"/></g>
    <g v-else-if="name === 'more'"><circle cx="10" cy="24" r="2" fill="currentColor"/><circle cx="24" cy="24" r="2" fill="currentColor"/><circle cx="38" cy="24" r="2" fill="currentColor"/></g>
    <g v-else-if="name === 'close'"><path d="m12 12 24 24m0-24L12 36"/></g>
    <path v-else d="m11 35 6-23 22 5-6 23Z" />
  </svg>
</template>
<script setup lang="ts">
defineProps<{ name: string; muted?: boolean }>();
</script>
<style scoped>svg { width: 100%; height: 100%; display: block; }</style>
