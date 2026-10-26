<template>
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-if="name === 'back'" d="m29 12-12 12 12 12" />
    <g v-else-if="name === 'remove'" fill="#ffdf35" stroke="#35341d" stroke-width="3.6"><path d="m9 15 15 4-7 25-14-4Z" fill="#e9bc28"/><path d="m27 16 15 7-6 22-15-5Z" fill="#ffe04a"/><path d="m27 3 14 15-8-1-4 20-13-3 4-18-8 1Z" fill="#ffe34d"/></g>
    <path v-else-if="name === 'undo'" d="m8 3-4 20 20-5-8-4c14-4 25 8 17 25l8 3C53 16 30 3 16 9Z" fill="#ffdf35" stroke="#35341d" stroke-width="3.6" />
    <g v-else-if="name === 'shuffle'" fill="#ffdf35" stroke="#35341d" stroke-width="3.6"><path d="m10 4-7 13 7 1c0 12 8 23 17 26l4-8C22 32 18 24 19 17l7 1-6-14Z"/><path d="m39 16 6 17-9-1-4 9-7-8 5-8-5-5Z"/></g>
    <g v-else-if="name === 'settings'" fill="currentColor" stroke="none"><path d="m20 3 8 0 2 7 5-3 6 6-3 5 7 2v8l-7 2 3 5-6 6-5-3-2 7h-8l-2-7-5 3-6-6 3-5-7-2v-8l7-2-3-5 6-6 5 3Z"/><circle cx="24" cy="24" r="8" fill="#0aaaf4"/></g>
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
