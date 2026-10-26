<template>
  <main id="indexPage" class="home-page">
    <div class="home-eyebrow"><span></span> 牧场消除挑战 <span></span></div>
    <h1 class="home-title">羊了个羊</h1>
    <p class="home-subtitle">一起加入羊群，看看你能过几关</p>
    <svg class="pasture-art" viewBox="0 0 440 232" role="img" aria-label="三只小羊站在草地和栅栏前">
      <defs>
        <g id="pasture-sheep" stroke="#35412b" stroke-width="3.7" stroke-linecap="round" stroke-linejoin="round">
          <ellipse cx="0" cy="54" rx="53" ry="10" fill="#a1d865" stroke="none" />
          <path d="M-32 28v23q4 7 12 0V29m34 0v22q4 7 12 0V28" fill="#8b7760" />
          <path d="M-39 11c-12-5-13-20-1-25-6-12 3-25 16-23 3-14 19-18 29-8 12-10 27-3 29 8 15-1 23 11 17 23 13 8 8 23-3 26 1 15-13 22-23 16-9 12-25 9-30-1-14 9-29 0-29-12Z" fill="#fffbed" />
          <path d="M-21-1q-20-10-24 2 2 13 22 10M21-1q20-10 24 2-2 13-22 10" fill="#827462" />
          <path d="M-22-2q22-12 44 0l-3 30q-19 17-38 0Z" fill="#827462" />
          <path d="M-21-9q8-12 15-4 8-10 15-1 10-8 14 6-3 12-14 7-8 7-15 0-10 5-15-8Z" fill="#fffbed" />
          <path d="M-10 12v4m20-4v4" fill="none" />
          <path d="m-3 23 3 3 3-3" fill="none" stroke-width="2.5" />
          <ellipse cx="-14" cy="22" rx="4" ry="2.5" fill="#d8a38a" stroke="none" />
          <ellipse cx="14" cy="22" rx="4" ry="2.5" fill="#d8a38a" stroke="none" />
        </g>
      </defs>
      <g fill="none" stroke="#7eb44d" stroke-width="2.4" stroke-linecap="round">
        <path d="m41 73 5-9 4 9m311-29 4-8 5 8m-238 6 3-6 4 6M393 161l5-8 4 8M67 186l4-7 4 7" />
      </g>
      <g fill="#f9efc9" stroke="#6c6544" stroke-width="3" stroke-linejoin="round">
        <path d="M25 117h390v12H25Zm0 27h390v12H25Z" />
        <path d="m42 105 8-8 8 8v62H42Zm82 0 8-8 8 8v62h-16Zm176 0 8-8 8 8v62h-16Zm82 0 8-8 8 8v62h-16Z" />
      </g>
      <ellipse cx="221" cy="195" rx="179" ry="20" fill="#b2e57d" />
      <use href="#pasture-sheep" transform="translate(104 126) scale(.78) rotate(-8)" />
      <use href="#pasture-sheep" transform="translate(330 126) scale(.78) rotate(8)" />
      <use href="#pasture-sheep" transform="translate(220 141) scale(1.12)" />
      <g fill="#83bd50" stroke="#476c37" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="m31 198-5-12 10 6 2-15 7 15 9-6-3 12Zm352 0-5-12 10 6 2-15 7 15 9-6-3 12Z" />
      </g>
      <g fill="#fff8d5" stroke="#7cae4c" stroke-width="1.8">
        <path d="M77 215q-8-7-4-10 4-3 7 4 3-8 7-4 4 3-4 10Z" />
        <path d="M354 216q-8-7-4-10 4-3 7 4 3-8 7-4 4 3-4 10Z" />
      </g>
    </svg>
    <button class="farm-button start-button" @click="startGame">开始挑战 <span aria-hidden="true">›</span></button>
    <p class="challenge-note">三个相同就消除 · 槽位满了就失败</p>
    <section class="difficulty-panel paper-panel" aria-labelledby="difficulty-title">
      <h2 id="difficulty-title"><span class="tiny-grass" aria-hidden="true"></span>选择挑战难度</h2>
      <div class="difficulty-grid" role="group" aria-label="难度选择">
        <button v-for="(difficulty, index) in difficulties" :key="difficulty.label"
          class="difficulty-button" :class="{ selected: selectedDifficulty === index }"
          :aria-pressed="selectedDifficulty === index" @click="selectedDifficulty = index">
          <span>{{ difficulty.label }}</span><small>{{ difficulty.hint }}</small>
        </button>
      </div>
    </section>
    <button class="custom-entry" @click="router.push('/config')">自定义牧场 <span aria-hidden="true">→</span></button>
    <footer class="home-footer">基于 <a href="https://github.com/liyupi/yulegeyu" target="_blank" rel="noopener noreferrer">鱼皮 · 鱼了个鱼</a> 开源项目改造<br />非官方练习项目 · 轻松玩一局</footer>
  </main>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { easyGameConfig, middleGameConfig, hardGameConfig, lunaticGameConfig, skyGameConfig, yangGameConfig } from "../core/gameConfig";
import { useGlobalStore } from "../core/globalStore";
const router = useRouter();
const { setGameConfig } = useGlobalStore();
const selectedDifficulty = ref(1);
const difficulties = [
  { label: "简单", hint: "热身一下", config: easyGameConfig },
  { label: "中等", hint: "刚刚好", config: middleGameConfig },
  { label: "困难", hint: "动动脑筋", config: hardGameConfig },
  { label: "地狱", hint: "高手进阶", config: lunaticGameConfig },
  { label: "天狱", hint: "极限挑战", config: skyGameConfig },
  { label: "羊了个羊", hint: "不服再来", config: yangGameConfig },
];
const startGame = () => {
  setGameConfig(difficulties[selectedDifficulty.value].config);
  router.push("/game");
};
</script>
<style scoped>
.home-page { text-align: center; padding: 25px 9px 0; }
.home-eyebrow { display: flex; justify-content: center; align-items: center; gap: 9px; color: #5c7c40; font-size: 12px; font-weight: 800; letter-spacing: 3px; }
.home-eyebrow span { width: 19px; height: 2px; background: #71984b; border-radius: 2px; }
.home-title { color: #fff9d9; font-family: "STKaiti", "KaiTi", "Microsoft YaHei", sans-serif; font-size: clamp(54px, 15vw, 77px); font-weight: 1000; line-height: 1.24; letter-spacing: 3px; margin: 12px -5px 5px; -webkit-text-stroke: 6px #35482c; paint-order: stroke fill; text-shadow: 0 6px 0 #6f984d; transform: rotate(-3deg); }
.home-subtitle { margin: 13px 0 0; color: #4f6d37; font-size: 13px; font-weight: 700; }
.pasture-art { display: block; width: calc(100% + 22px); margin: 1px -11px -2px; overflow: visible; }
.start-button { width: 83%; max-width: 312px; min-height: 62px; font-size: 25px; letter-spacing: 3px; background: #ffe574; position: relative; }
.start-button span { position: absolute; right: 22px; top: 7px; font-size: 36px; line-height: 1; }
.challenge-note { margin: 17px 0 23px; color: #607b43; font-size: 12px; letter-spacing: 1px; }
.difficulty-panel { padding: 18px 15px 16px; background: #e1f4b1; }
.difficulty-panel h2 { display: flex; justify-content: center; align-items: center; gap: 7px; margin: 0 0 14px; font-size: 15px; font-weight: 850; letter-spacing: 2px; color: #3c4e2d; }
.tiny-grass { width: 13px; height: 13px; border-left: 3px solid #6d933a; border-bottom: 3px solid #6d933a; transform: rotate(-45deg); border-radius: 0 0 0 5px; }
.difficulty-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.difficulty-button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 59px; padding: 6px 2px; background: #f5f8d7; border: 2px solid #94ac63; border-radius: 9px; color: #4c6137; box-shadow: 0 3px 0 #b1c480; cursor: pointer; transition: transform .12s, background .12s; }
.difficulty-button span { font-size: 15px; font-weight: 850; }
.difficulty-button small { font-size: 10px; color: #81915c; letter-spacing: 1px; }
.difficulty-button.selected { background: #ffed99; border-color: #53613b; box-shadow: 0 3px 0 #8e9d50; color: #3b4929; }
.difficulty-button.selected small { color: #8a7a40; }
.difficulty-button:active { transform: translateY(2px); }
.custom-entry { display: inline-flex; gap: 28px; align-items: center; margin: 19px 0 18px; border: 0; background: transparent; color: #4d6936; font-size: 14px; font-weight: 800; cursor: pointer; }
.custom-entry span { font-size: 19px; }
.home-footer { margin: 0 0 18px; color: #718c54; font-size: 10px; line-height: 1.9; }
.home-footer a { color: #5a7741; text-decoration: underline; text-underline-offset: 2px; }
@media (max-width: 360px) { .home-page { padding-top: 15px; } .home-title { -webkit-text-stroke-width: 5px; } .difficulty-panel { padding: 14px 10px; } .difficulty-grid { gap: 8px; } .challenge-note { font-size: 10px; } }
</style>
