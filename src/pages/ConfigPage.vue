<template>
  <main id="customConfigPage" class="config-page">
    <header class="config-header">
      <button class="icon-button" aria-label="返回首页" @click="router.push('/')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
      </button>
      <div><h1>自定义牧场</h1><p>布置你自己的消除挑战</p></div>
      <span class="header-spacer" aria-hidden="true"></span>
    </header>
    <form class="paper-panel config-form" @submit.prevent="handleFinish">
      <fieldset>
        <legend><span>01</span> 消除规则</legend>
        <div class="form-row">
          <label for="slotNum">槽位容量<small>最多可以暂存的牌数</small></label>
          <input id="slotNum" v-model.number="config.slotNum" type="number" min="3" max="12" step="1" required />
        </div>
        <div class="form-row">
          <label for="composeNum">合成数量<small>几个相同图案可以消除</small></label>
          <input id="composeNum" v-model.number="config.composeNum" type="number" min="2" max="6" step="1" required />
        </div>
        <div class="form-row">
          <label for="typeNum">图案种类<small>默认 {{ defaultGameConfig.animals.length }} 种牧场手绘图案</small></label>
          <input id="typeNum" v-model.number="config.typeNum" type="number" min="1" :max="patternCount" step="1" required />
        </div>
        <div class="pattern-field">
          <label for="animalStr">自定义图案 <span>选填</span></label>
          <input id="animalStr" v-model="config.animalStr" type="text" maxlength="100" placeholder="例如：🍎🍌🍇🍓🍒🍑" aria-describedby="pattern-help" />
          <p id="pattern-help">留空使用牧场图案；也可以输入喜欢的文字或表情。{{ config.animalStr.trim() ? `当前可用 ${patternCount} 种图案。` : '' }}</p>
        </div>
      </fieldset>
      <fieldset>
        <legend><span>02</span> 牌堆布局</legend>
        <div class="form-row">
          <label for="levelNum">总层数<small>层数越多，遮挡越丰富</small></label>
          <input id="levelNum" v-model.number="config.levelNum" type="number" min="2" max="20" step="1" required />
        </div>
        <div class="form-row">
          <label for="levelBlockNum">每层块数<small>每层大致生成的牌数</small></label>
          <input id="levelBlockNum" v-model.number="config.levelBlockNum" type="number" min="1" max="40" step="1" required />
        </div>
        <div class="form-row">
          <label for="borderStep">边界收缩<small>每层向内收缩的步长</small></label>
          <input id="borderStep" v-model.number="config.borderStep" type="number" min="0" max="3" step="1" required />
        </div>
        <div class="form-row">
          <label for="randomAreaNum">备用牌堆数<small>棋盘两侧的备用牌堆</small></label>
          <input id="randomAreaNum" v-model.number="config.randomAreaNum" type="number" min="0" max="4" step="1" required />
        </div>
        <div class="form-row last-row">
          <label for="randomBlockNum">每堆块数<small>每个备用牌堆的牌数</small></label>
          <input id="randomBlockNum" v-model.number="config.randomBlockNum" type="number" min="0" max="24" step="1" required />
        </div>
      </fieldset>
      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
      <button class="farm-button config-start" type="submit">开始挑战 <span aria-hidden="true">›</span></button>
      <div class="config-reset-actions">
        <button type="button" @click="resetForm">重置修改</button>
        <span aria-hidden="true">·</span>
        <button type="button" @click="resetConfig">恢复默认</button>
      </div>
    </form>
    <p class="config-tip">小提示：先从少量图案开始，再慢慢增加难度。</p>
  </main>
</template>
<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useGlobalStore } from "../core/globalStore";
import { defaultGameConfig } from "../core/gameConfig";

interface CustomFormConfig {
  slotNum: number;
  composeNum: number;
  typeNum: number;
  levelNum: number;
  levelBlockNum: number;
  borderStep: number;
  randomAreaNum: number;
  randomBlockNum: number;
  animalStr: string;
}

const router = useRouter();
const store = useGlobalStore();
const saved = store.customConfig as GameConfigType & Partial<CustomFormConfig>;
const toForm = (source: GameConfigType & Partial<CustomFormConfig>): CustomFormConfig => ({
  slotNum: source.slotNum,
  composeNum: source.composeNum,
  typeNum: source.typeNum,
  levelNum: source.levelNum,
  levelBlockNum: source.levelBlockNum,
  borderStep: source.borderStep,
  randomAreaNum: source.randomBlocks.length,
  randomBlockNum: source.randomBlocks[0] ?? 8,
  // Only an explicitly supplied string is custom artwork. Internal farm keys stay intact.
  animalStr: typeof source.animalStr === "string" && !source.animalStr.includes("farm:") ? source.animalStr : "",
});
const initialConfig = toForm(saved);
const config = reactive<CustomFormConfig>({ ...initialConfig });
const errorMessage = ref("");
const resolvedAnimals = computed(() => config.animalStr.trim()
  ? [...new Set(Array.from(config.animalStr.trim()).filter((icon) => icon.trim()))]
  : [...defaultGameConfig.animals]);
const patternCount = computed(() => resolvedAnimals.value.length);

const handleFinish = () => {
  errorMessage.value = "";
  const ranges: [keyof CustomFormConfig, number, number][] = [
    ["slotNum", 3, 12], ["composeNum", 2, 6], ["typeNum", 1, patternCount.value],
    ["levelNum", 2, 20], ["levelBlockNum", 1, 40], ["borderStep", 0, 3],
    ["randomAreaNum", 0, 4], ["randomBlockNum", 0, 24],
  ];
  if (ranges.some(([key, min, max]) => !Number.isInteger(config[key]) || Number(config[key]) < min || Number(config[key]) > max)) {
    errorMessage.value = "请填写范围内的整数，图案种类不能超过可用图案数量。";
    return;
  }
  if (config.composeNum > config.slotNum) {
    errorMessage.value = "槽位容量需要大于或等于合成数量。";
    return;
  }
  const nextConfig = {
    ...config,
    animals: resolvedAnimals.value,
    randomBlocks: Array.from({ length: config.randomAreaNum }, () => config.randomBlockNum),
  };
  store.setGameConfig(nextConfig);
  store.setCustomConfig(nextConfig);
  router.push("/game");
};
const resetForm = () => {
  Object.assign(config, initialConfig);
  errorMessage.value = "";
};
const resetConfig = () => {
  store.reset();
  Object.assign(initialConfig, toForm(defaultGameConfig));
  Object.assign(config, initialConfig);
  errorMessage.value = "";
};
</script>
<style scoped>
.config-page { padding: 8px 5px 0; }
.config-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; text-align: center; }
.config-header h1 { margin: 0 0 3px; color: #35412b; font-size: 24px; font-weight: 900; letter-spacing: 2px; }
.config-header p { margin: 0; color: #6b8749; font-size: 11px; letter-spacing: 1px; }
.header-spacer { width: 43px; }
.config-form { padding: 23px 23px 15px; }
fieldset { padding: 0; margin: 0; border: 0; min-width: 0; }
fieldset + fieldset { margin-top: 24px; }
legend { display: flex; align-items: center; width: 100%; gap: 8px; margin: 0 0 10px; padding: 0; color: #35412b; font-size: 16px; font-weight: 850; letter-spacing: 1px; }
legend span { display: inline-flex; align-items: center; justify-content: center; width: 25px; height: 25px; color: #6d8148; background: #e6eebd; border-radius: 8px; font-size: 11px; letter-spacing: 0; }
.form-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px dashed #d9dfac; }
.form-row label { display: block; font-size: 14px; font-weight: 750; }
.form-row small { display: block; margin-top: 3px; color: #8b9469; font-size: 10px; font-weight: 400; }
.form-row input { width: 73px; height: 40px; padding: 6px 4px 6px 10px; color: #4c5836; background: #f0f3ce; border: 2px solid #a3b17c; border-radius: 8px; font-size: 16px; font-weight: 750; }
.form-row input:focus, .pattern-field input:focus { border-color: #577b42; }
.last-row { border-bottom: 0; }
.pattern-field { margin-top: 18px; }
.pattern-field label { font-size: 14px; font-weight: 750; }
.pattern-field label span { margin-left: 5px; font-size: 10px; font-weight: 400; color: #8b9469; }
.pattern-field input { display: block; width: 100%; height: 43px; margin-top: 9px; padding: 8px 11px; color: #35412b; background: #f6f6dd; border: 2px solid #b7c391; border-radius: 8px; font-size: 16px; letter-spacing: 2px; }
.pattern-field input::placeholder { color: #b2bb8f; font-size: 13px; }
.pattern-field p { margin: 7px 0 0; color: #8b9469; font-size: 10px; line-height: 1.8; }
.form-error { margin: 10px 0; padding: 10px; color: #9e5033; background: #ffedcc; border-radius: 7px; font-size: 12px; line-height: 1.7; }
.config-start { position: relative; width: 100%; min-height: 52px; margin: 22px 0 8px; background: #ffe574; font-size: 20px; letter-spacing: 3px; }
.config-start span { position: absolute; right: 20px; top: 4px; font-size: 32px; }
.config-reset-actions { display: flex; align-items: center; justify-content: center; gap: 20px; margin-top: 16px; color: #a5af80; }
.config-reset-actions button { padding: 7px 0; border: 0; color: #7e8b5d; background: transparent; font-size: 11px; cursor: pointer; }
.config-tip { margin: 18px 0 0; color: #718b52; text-align: center; font-size: 10px; line-height: 1.8; }
@media (max-width: 360px) { .config-page { padding-inline: 0; } .config-form { padding-inline: 17px; } .config-header h1 { font-size: 22px; } }
</style>
