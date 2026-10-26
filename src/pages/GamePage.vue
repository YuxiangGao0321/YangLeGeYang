<template>
  <main id="gamePage" :data-game-status="gameStatus" :data-busy="busy" :inert="resultOpen ? '' : undefined">
    <header class="game-toolbar">
      <button class="icon-button" aria-label="返回首页" @click="router.push('/')"><UiIcon name="back" /></button>
      <span class="mode-label">{{ modeName }}</span>
      <div class="toolbar-actions">
        <button class="icon-button" :aria-label="soundOn ? '关闭音效' : '开启音效'" :aria-pressed="soundOn" @click="toggleSound"><UiIcon name="sound" :muted="!soundOn" /></button>
        <button class="icon-button" aria-label="重新开始" @click="restart"><UiIcon name="restart" /></button>
      </div>
    </header>
    <div class="game-heading"><i></i><h1>牧场挑战</h1><i></i></div>
    <div class="progress-area">
      <div class="progress-track" role="progressbar" :aria-valuenow="clearBlockNum" :aria-valuemax="totalBlockNum" aria-valuemin="0" aria-label="消除进度"><span :style="{ width: `${progress}%` }"></span></div>
      <span class="progress-count">{{ clearBlockNum }} / {{ totalBlockNum }}</span>
    </div>
    <section class="playfield" aria-label="叠牌区域">
      <svg class="field-grass grass-one" viewBox="0 0 40 26" aria-hidden="true"><path d="M6 23C-3 5 9 6 14 20c-4-30 9-25 9-1 8-24 21-16 9 5" /></svg>
      <svg class="field-grass grass-two" viewBox="0 0 40 26" aria-hidden="true"><path d="M6 23C-3 5 9 6 14 20c-4-30 9-25 9-1 8-24 21-16 9 5" /></svg>
      <div class="level-board" :class="{ 'holy-field': isHolyLight }">
        <button v-for="block in visibleBlocks" :key="block.id" class="tile level-tile" :class="{ covered: isCovered(block), queued: queuedIds.includes(block.id) }"
          :data-source-id="block.id" :data-type="block.type" :aria-label="`${tileName(block.type)}${isCovered(block) ? '，被遮挡' : ''}`"
          :disabled="isCovered(block) || queuedIds.includes(block.id) || gameStatus !== 1"
          :style="{ left: `${block.x / 24 * 100}%`, top: `${block.y / 24 * 100}%`, zIndex: block.level + 1 }" @click="enqueue(block)"><TileIcon :type="block.type" /></button>
      </div>
      <div class="random-board" aria-label="备用牌堆">
        <div v-for="(pile, index) in randomBlocksVal" :key="index" class="random-pile">
          <span v-for="n in Math.min(Math.max(pile.length - 1, 0), 7)" :key="n" class="tile pile-back" :style="{ left: `${(7 - n) * 4}px`, top: `${-n * 2}px` }" aria-hidden="true"><TileIcon v-if="canSeeRandom && pile[n]" :type="pile[n].type" /></span>
          <button v-if="pile[0]" class="tile pile-top" :data-source-id="pile[0].id" :data-type="pile[0].type" :aria-label="`备用牌：${tileName(pile[0].type)}`" :disabled="queuedIds.includes(pile[0].id) || gameStatus !== 1" @click="enqueue(pile[0], index)"><TileIcon :type="pile[0].type" /></button>
          <span v-if="pile.length" class="pile-count">{{ pile.length }}</span>
        </div>
      </div>
    </section>
    <div class="reserve-area" :class="{ empty: !reserveBlocksVal.length }" aria-label="移出暂存区">
      <span v-if="reserveBlocksVal.length" class="reserve-label">暂存</span>
      <button v-for="block in reserveBlocksVal" :key="block.id" class="tile reserve-tile" :data-source-id="block.id" :data-type="block.type" :aria-label="`暂存牌：${tileName(block.type)}`" :disabled="busy || gameStatus !== 1" @click="enqueue(block)"><TileIcon :type="block.type" /></button>
      <span v-if="!reserveBlocksVal.length" class="play-hint">{{ isHolyLight ? '圣光已开启 · 下一张任意选' : '凑齐三个相同图案，即可消除' }}</span>
    </div>
    <section class="rack-section" aria-label="收集卡槽">
      <div class="rack" :class="{ danger: currSlotNum >= slotCount - 1, 'rack-failed': gameStatus === 2 }">
        <div class="rack-grid" :style="{ '--slots': slotCount }">
          <span v-for="n in slotCount" :key="n" class="slot-guide" :style="{ left: `${(n - 1) / slotCount * 100}%` }" aria-hidden="true"></span>
          <div v-for="(block, index) in displaySlots" :key="block.id" class="tile rack-tile" :data-slot-id="block.id" :data-type="block.type" :data-matching="matchingIds.includes(block.id)" :style="{ left: `${index / slotCount * 100}%`, visibility: hiddenIds.includes(block.id) ? 'hidden' : 'visible' }"><TileIcon :type="block.type" /></div>
        </div>
      </div>
      <div class="rack-caption"><span>{{ currSlotNum >= slotCount - 1 ? '快满啦，找找能消除的牌！' : '小心别让卡槽装满哦' }}</span><span>{{ currSlotNum }} / {{ slotCount }}</span></div>
    </section>
    <nav class="tools" aria-label="游戏道具">
      <button class="tool-button" :disabled="busy || gameStatus === 3 || !currSlotNum" @click="removeTiles"><span class="tool-face"><UiIcon name="remove" /><span class="tool-plus">+</span></span><span>移出</span></button>
      <button class="tool-button" :disabled="busy || !canUndo || gameStatus === 3" @click="undo"><span class="tool-face"><UiIcon name="undo" /><span class="tool-plus">+</span></span><span>撤回</span></button>
      <button class="tool-button" :disabled="busy || gameStatus !== 1" @click="shuffle"><span class="tool-face"><UiIcon name="shuffle" /><span class="tool-plus">+</span></span><span>洗牌</span></button>
    </nav>
    <div class="extra-tools-row"><span>道具不限次数</span><button class="text-button" :aria-expanded="showExtra" @click="showExtra = !showExtra">{{ showExtra ? '收起' : '更多道具' }} <span aria-hidden="true">{{ showExtra ? '−' : '+' }}</span></button></div>
    <div v-if="showExtra" class="extra-tools">
      <button class="farm-button" :disabled="busy || gameStatus !== 1" @click="breakGroup"><UiIcon name="spark" />消除一组</button>
      <button class="farm-button" :class="{ selected: isHolyLight }" :disabled="busy || gameStatus !== 1" @click="doHolyLight(); notify('下一张可以选择任意牌')"><UiIcon name="spark" />圣光</button>
      <button class="farm-button" :aria-pressed="canSeeRandom" :disabled="busy || gameStatus !== 1" @click="doSeeRandom()"><UiIcon name="eye" />透视</button>
    </div>
    <Transition name="toast"><div v-if="toast" class="game-toast" role="status">{{ toast }}</div></Transition>
    <Teleport to="body">
      <div class="animation-layer" aria-hidden="true">
        <div v-for="flight in flights" :key="flight.key" :data-flight="flight.key" class="tile flying-tile" :style="{ left: `${flight.from.left}px`, top: `${flight.from.top}px`, width: `${flight.from.width}px`, height: `${flight.from.height}px` }"><TileIcon :type="flight.type" /></div>
        <div v-for="burst in bursts" :key="burst.id" class="match-burst" :style="{ left: `${burst.x}px`, top: `${burst.y}px` }"><i v-for="n in 10" :key="n" :style="{ '--dx': `${Math.cos(n * Math.PI / 5) * (28 + n % 3 * 12)}px`, '--dy': `${Math.sin(n * Math.PI / 5) * (28 + n % 3 * 12)}px`, '--r': `${n * 37}deg` }"></i></div>
      </div>
      <div v-if="resultOpen" class="result-backdrop" @keydown.esc="gameStatus === 2 && removeTiles()">
        <section class="result-panel" role="dialog" aria-modal="true" :aria-label="gameStatus === 3 ? '挑战成功' : '卡槽已满'">
          <div class="result-sheep" aria-hidden="true"><svg viewBox="0 0 120 100"><g stroke="#41482c" stroke-width="3.5" stroke-linejoin="round"><path d="m37 70-3 22m50-22 4 22"/><path d="M28 38C12 24 25 9 39 20 42 1 63 5 66 19 84 3 100 20 89 32c22 2 24 25 6 29 6 23-18 30-29 16-13 18-34 7-31-7-24 7-33-18-17-26Z" fill="#fffce7"/><path d="M44 35c0-15 35-15 35 1l5 22c2 22-43 23-43 0Z" fill="#777b65"/><ellipse cx="53" cy="39" rx="9" ry="12" fill="white"/><ellipse cx="71" cy="39" rx="9" ry="12" fill="white"/><path d="M53 59q10 14 19 0Z" fill="#ff8a79"/><path d="M53 40h.1m18-1h.1" stroke-width="5"/></g></svg></div>
          <span class="result-eyebrow">{{ gameStatus === 3 ? '咩！好厉害' : '就差一点点' }}</span>
          <h2>{{ gameStatus === 3 ? '你也是领头羊！' : '卡槽装满啦' }}</h2>
          <p>{{ gameStatus === 3 ? `成功消除了 ${totalBlockNum} 张牌，再挑战一次吧。` : '移出三张牌，还有机会翻盘。' }}</p>
          <button v-if="gameStatus === 2" autofocus class="farm-button result-primary" @click="removeTiles">移出三张，继续挑战</button>
          <button :autofocus="gameStatus === 3" class="farm-button" :class="{ 'result-primary': gameStatus === 3 }" @click="restart">再来一次</button>
          <button class="text-button" @click="router.push('/')">返回牧场</button>
        </section>
      </div>
    </Teleport>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import useGame from "../core/game";
import { useGlobalStore } from "../core/globalStore";
import TileIcon from "../components/TileIcon.vue";
import UiIcon from "../components/UiIcon.vue";
const router = useRouter();
const store = useGlobalStore();
const { gameStatus, levelBlocksVal, randomBlocksVal, reserveBlocksVal, slotAreaVal, currSlotNum, totalBlockNum, clearBlockNum, pendingMatchIds, canUndo, isHolyLight, canSeeRandom, doClickBlock, settleMatch, doStart, doShuffle, doRemove, doRevert, doHolyLight, doSeeRandom, findMatchBlocks } = useGame();
const slotCount = computed(() => store.gameConfig.slotNum);
const modeName = computed(() => ({ 8: '轻松牧场', 10: '进阶牧场', 12: '困难牧场', 14: '地狱挑战', 16: '天狱挑战', 18: '羊群挑战' }[store.gameConfig.typeNum] || '自定义牧场'));
const progress = computed(() => totalBlockNum.value ? clearBlockNum.value / totalBlockNum.value * 100 : 0);
const visibleBlocks = computed(() => levelBlocksVal.value.filter(b => b.status === 0));
const busy = ref(false), displaySlots = ref<BlockType[]>([]), hiddenIds = ref<number[]>([]), matchingIds = ref<number[]>([]), queuedIds = ref<number[]>([]), showExtra = ref(false);
const resultOpen = computed(() => gameStatus.value > 1 && !busy.value);
const soundOn = ref(localStorage.getItem('pasture-sound') !== 'off');
const toast = ref('');
const flights = ref<{ key: number; type: string; from: DOMRect }[]>([]);
const bursts = ref<{ id: number; x: number; y: number }[]>([]);
const queue: { block: BlockType; randomIdx: number; force: boolean }[] = [];
const animations = new Set<Animation>();
const timers = new Set<ReturnType<typeof setTimeout>>();
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let epoch = 0, sequence = 0, disposed = false, draining = false;
let audio: AudioContext | undefined;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
const names = ['青草', '胡萝卜', '玉米', '木桩', '草叉', '白菜', '羊毛团', '刷子', '剪刀', '奶瓶', '水桶', '手套', '铃铛', '篝火', '毛线球', '干草捆', '苹果', '蘑菇', '三叶草', '鸡蛋', '向日葵'];
const tileName = (type: string) => type.startsWith('farm:') ? names[Number(type.slice(5)) - 1] || type : type;
const isCovered = (block: BlockType) => !isHolyLight.value && block.lowerThanBlocks.length > 0;
const syncSlots = () => { displaySlots.value = slotAreaVal.value.filter((b): b is BlockType => !!b); };
const later = (fn: () => void, duration: number) => {
  const timer = setTimeout(() => { timers.delete(timer); if (!disposed) fn(); }, duration);
  timers.add(timer); return timer;
};
const notify = (message: string) => {
  if (toastTimer) { clearTimeout(toastTimer); timers.delete(toastTimer); }
  toast.value = message; toastTimer = later(() => { toast.value = ''; }, 1700);
};
const ensureAudio = () => {
  if (!soundOn.value) return;
  try { audio ||= new AudioContext(); if (audio.state === 'suspended') void audio.resume().catch(() => {}); } catch { /* Optional sound. */ }
};
const tone = (match = false) => {
  if (!soundOn.value || !audio || audio.state !== 'running') return;
  const ctx = audio;
  (match ? [660, 880, 1100] : [420]).forEach((frequency, index) => {
    const oscillator = ctx.createOscillator(), gain = ctx.createGain(), start = ctx.currentTime + index * .055;
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, start); oscillator.frequency.exponentialRampToValueAtTime(frequency * .7, start + .075);
    gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(.055, start + .005); gain.gain.exponentialRampToValueAtTime(.0001, start + .11);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(start); oscillator.stop(start + .12);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
};
const toggleSound = () => { soundOn.value = !soundOn.value; localStorage.setItem('pasture-sound', soundOn.value ? 'on' : 'off'); ensureAudio(); tone(); };
const animate = async (element: Element | null, frames: Keyframe[], options: KeyframeAnimationOptions) => {
  if (!element || disposed) return;
  const duration = motionPreference.matches ? 1 : Number(options.duration || 0);
  const animation = element.animate(frames, { ...options, duration });
  animations.add(animation);
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  // Occluded mobile/background tabs can suspend animation-finished events.
  // The rule transaction must still finish without leaving the input queue locked.
  const deadline = new Promise<void>(resolve => {
    watchdog = setTimeout(resolve, duration + 150);
    timers.add(watchdog);
  });
  try { await Promise.race([animation.finished, deadline]); } catch { /* Navigation/restart cancels visuals. */ }
  finally {
    if (watchdog) { clearTimeout(watchdog); timers.delete(watchdog); }
    animations.delete(animation); animation.cancel();
  }
};
const fly = async (type: string, from: DOMRect, to: DOMRect, token: number) => {
  const key = sequence++;
  flights.value.push({ key, type, from }); await nextTick();
  if (token !== epoch || disposed) return;
  const dx = to.left - from.left, dy = to.top - from.top;
  await animate(document.querySelector(`[data-flight="${key}"]`), [
    { transform: 'translate(0,0) scale(1)', offset: 0 },
    { transform: 'translate(0,-4px) scale(.91)', offset: .14 },
    { transform: `translate(${dx * .58}px,${dy * .42 - 14}px) scale(1.06)`, offset: .58 },
    { transform: `translate(${dx}px,${dy}px) scale(${to.width / from.width},${to.height / from.height})`, offset: 1 },
  ], { duration: 235, easing: 'cubic-bezier(.22,.65,.35,1)', fill: 'forwards' });
  flights.value = flights.value.filter(f => f.key !== key);
};
const pick = async (block: BlockType, randomIdx: number, force: boolean, token: number) => {
  const from = document.querySelector(`[data-source-id="${block.id}"]`)?.getBoundingClientRect();
  if (!from || !doClickBlock(block, randomIdx, force)) return;
  hiddenIds.value.push(block.id); syncSlots(); tone(); await nextTick();
  const target = document.querySelector(`[data-slot-id="${block.id}"]`);
  if (target) await fly(block.type, from, target.getBoundingClientRect(), token);
  if (token !== epoch || disposed) return;
  hiddenIds.value = hiddenIds.value.filter(id => id !== block.id);
  await animate(target, [{ transform: 'translateY(-3px) scale(1.04)' }, { transform: 'translateY(1px) scale(.97,1.02)' }, { transform: 'none' }], { duration: 95, easing: 'ease-out' });
  if (token !== epoch || disposed) return;
  if (pendingMatchIds.value.length) {
    matchingIds.value = [...pendingMatchIds.value];
    const elements = matchingIds.value.map(id => document.querySelector(`[data-slot-id="${id}"]`)).filter((e): e is Element => !!e);
    const rects = elements.map(e => e.getBoundingClientRect());
    const center = rects.reduce((sum, r) => sum + r.left + r.width / 2, 0) / rects.length;
    if (rects.length && !motionPreference.matches) {
      const id = sequence++;
      bursts.value.push({ id, x: center, y: rects[0].top + rects[0].height / 2 });
      later(() => { bursts.value = bursts.value.filter(b => b.id !== id); }, 500);
    }
    tone(true);
    await Promise.all(elements.map((element, index) => {
      const dx = (center - rects[index].left - rects[index].width / 2) * .15;
      return animate(element, [
        { transform: 'scale(1)', opacity: 1, filter: 'brightness(1)' },
        { transform: `translate(${dx}px,-4px) scale(1.1)`, opacity: 1, filter: 'brightness(1.35)', offset: .36 },
        { transform: `translate(${dx * 2}px,0) scale(.2)`, opacity: 0, filter: 'brightness(1.7)' },
      ], { duration: 255, easing: 'cubic-bezier(.3,0,.4,1)', fill: 'forwards' });
    }));
    if (token !== epoch || disposed) return;
    settleMatch(); matchingIds.value = []; syncSlots();
  }
};
const drainQueue = async () => {
  if (busy.value) return;
  busy.value = true; draining = true; const token = epoch;
  try {
    while (queue.length && gameStatus.value === 1 && token === epoch && !disposed) {
      const next = queue.shift()!;
      await pick(next.block, next.randomIdx, next.force, token);
      if (token !== epoch || disposed) break;
      queuedIds.value = queuedIds.value.filter(id => id !== next.block.id);
    }
  } finally {
    if (token === epoch) { queue.length = 0; queuedIds.value = []; busy.value = false; draining = false; }
  }
};
const enqueue = (block: BlockType, randomIdx = -1, force = false) => {
  if ((busy.value && !draining) || block.status !== 0 || queuedIds.value.includes(block.id) || gameStatus.value !== 1 || (!force && isCovered(block))) return;
  ensureAudio(); queue.push({ block, randomIdx, force }); queuedIds.value.push(block.id); void drainQueue();
};
const undo = async () => {
  if (busy.value || !canUndo.value) return;
  const before = displaySlots.value.map(block => ({ block, rect: document.querySelector(`[data-slot-id="${block.id}"]`)?.getBoundingClientRect() }));
  busy.value = true; const token = epoch;
  doRevert(); syncSlots(); await nextTick();
  const restored = before.find(item => item.block.status === 0);
  if (restored?.rect) {
    const target = document.querySelector(`[data-source-id="${restored.block.id}"]`);
    if (target) { (target as HTMLElement).style.visibility = 'hidden'; await fly(restored.block.type, restored.rect, target.getBoundingClientRect(), token); (target as HTMLElement).style.visibility = ''; }
  }
  if (token === epoch) { busy.value = false; notify('已撤回上一步'); }
};
const removeTiles = async () => {
  if (busy.value || !currSlotNum.value) return;
  const before = displaySlots.value.slice(0, 3).map(block => ({ block, rect: document.querySelector(`[data-slot-id="${block.id}"]`)?.getBoundingClientRect() }));
  const token = epoch; busy.value = true;
  doRemove(); syncSlots(); await nextTick();
  await Promise.all(before.map(async ({ block, rect }) => {
    const target = document.querySelector(`[data-source-id="${block.id}"]`);
    if (!rect || !target) return;
    (target as HTMLElement).style.visibility = 'hidden'; await fly(block.type, rect, target.getBoundingClientRect(), token); (target as HTMLElement).style.visibility = '';
  }));
  if (token === epoch) { busy.value = false; notify('已移到暂存区，点击可放回'); }
};
const shuffle = async () => {
  if (busy.value || gameStatus.value !== 1) return;
  const token = epoch; busy.value = true;
  const elements = Array.from(document.querySelectorAll('.level-tile, .pile-top'));
  await Promise.all(elements.map((element, index) => animate(element, [{ transform: 'none' }, { transform: `rotate(${index % 2 ? 7 : -7}deg) scale(.84)` }], { duration: 130, fill: 'forwards' })));
  if (token !== epoch || disposed) return;
  doShuffle(); await nextTick();
  await Promise.all(elements.map(element => animate(element, [{ transform: 'scale(.84)' }, { transform: 'none' }], { duration: 160, easing: 'ease-out' })));
  if (token === epoch) { busy.value = false; notify('牌面已打乱'); }
};
const breakGroup = () => {
  if (busy.value || gameStatus.value !== 1) return;
  const blocks = findMatchBlocks();
  if (!blocks.length) { notify('当前没有可直接消除的一组'); return; }
  if (currSlotNum.value + blocks.length > slotCount.value) { notify('先移出几张牌，再使用这个道具'); return; }
  ensureAudio();
  blocks.forEach(block => { queue.push({ block, randomIdx: randomBlocksVal.value.findIndex(p => p[0]?.id === block.id), force: true }); queuedIds.value.push(block.id); });
  void drainQueue();
};
const cancelVisuals = () => {
  epoch++; queue.length = 0; draining = false;
  animations.forEach(animation => animation.cancel()); animations.clear(); timers.forEach(timer => clearTimeout(timer)); timers.clear();
  flights.value = []; bursts.value = []; hiddenIds.value = []; matchingIds.value = []; queuedIds.value = []; toast.value = ''; busy.value = false;
};
const restart = () => { cancelVisuals(); doStart(); syncSlots(); };
onMounted(restart);
onUnmounted(() => { disposed = true; cancelVisuals(); if (audio) void audio.close().catch(() => {}); });
</script>

<style scoped>
#gamePage { padding: 14px 12px 24px; color: #41482c; max-width: 420px; margin: 0 auto; }
.game-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.toolbar-actions { display: flex; gap: 8px; }
.game-toolbar .icon-button { width: 36px; height: 36px; padding: 7px; border-radius: 9px; }
.mode-label { margin-right: auto; font-size: 13px; font-weight: 700; color: #566b37; }
.game-heading { display: flex; justify-content: center; align-items: center; gap: 16px; margin: 20px 0 11px; }
.game-heading h1 { font-size: 27px; font-weight: 950; letter-spacing: 5px; margin: 0; color: #35492d; }
.game-heading i { width: 25px; height: 3px; border-radius: 2px; background: #4e6534; }
.progress-area { display: flex; gap: 10px; align-items: center; width: 79%; margin: 0 auto; }
.progress-track { height: 11px; flex: 1; border: 2px solid #617d36; border-radius: 7px; overflow: hidden; background: #a4cc6b; box-shadow: inset 0 2px 0 #92b95c; }
.progress-track span { display: block; height: 100%; background: #fff4a6; border-radius: 5px; transition: width .35s ease; }
.progress-count { min-width: 54px; font: 700 11px/1.4 ui-rounded, system-ui, sans-serif; }
.playfield { position: relative; max-width: 348px; margin: 23px auto 0; }
.level-board { position: relative; width: 100%; aspect-ratio: 1; isolation: isolate; }
.field-grass { width: 27px; position: absolute; fill: none; stroke: #83b74a; stroke-width: 2.6; stroke-linecap: round; pointer-events: none; }
.grass-one { left: -8px; top: 48%; transform: rotate(-14deg); }
.grass-two { right: 6px; top: -15px; transform: scale(.8); }
.tile { display: flex; align-items: center; justify-content: center; padding: 1px; border: 2px solid #53652d; border-radius: 5px; background: #fff9d9; box-shadow: inset 0 -5px 0 #becb74, inset 0 2px 0 #fffef0, 0 2px 0 #47582c; color: #3b4825; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
button.tile { cursor: pointer; touch-action: manipulation; }
button.tile:focus-visible { outline: 3px solid #246ccb; outline-offset: 2px; }
.level-tile { position: absolute; width: 12.5%; height: 12.5%; transition: filter .17s, opacity .1s; }
.tile.covered { filter: brightness(.62) saturate(.75); cursor: default; }
.tile:disabled { opacity: 1; }
.tile.queued { filter: brightness(1.12); }
.holy-field .tile { box-shadow: inset 0 -5px 0 #becb74, 0 0 8px #fff9ad; }
.random-board { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; min-height: 52px; margin: 11px 14px 0; gap: 14px 18px; }
.random-pile { position: relative; width: 70px; height: 46px; }
.random-pile:nth-child(even) { justify-self: end; }
.random-pile .tile { width: 44px; height: 44px; position: absolute; }
.pile-back { background: #abb975; pointer-events: none; }
.pile-top { z-index: 10; left: 27px; top: 0; }
.pile-count { position: absolute; right: -10px; top: 16px; font-size: 10px; color: #5d733f; }
.reserve-area { display: flex; align-items: center; justify-content: center; min-height: 47px; gap: 5px; margin: 1px auto 9px; flex-wrap: wrap; }
.reserve-area.empty { min-height: 30px; margin-bottom: 8px; }
.reserve-tile { width: 39px; height: 39px; }
.reserve-label { font-size: 11px; margin-right: 3px; color: #667c43; }
.play-hint { font-size: 12px; color: #627b3f; letter-spacing: 1px; }
.rack { padding: 8px; border: 3px solid #3d6224; border-radius: 10px; background: #8fbc40; box-shadow: inset 0 2px 0 #d6ec82, 0 5px 0 #527d26, 0 7px 0 #35531d; }
.rack-grid { position: relative; height: clamp(32px, 10.5vw, 48px); background: #568f21; border-radius: 5px; box-shadow: inset 0 3px 0 #497c1e; }
.slot-guide { position: absolute; width: calc(100% / var(--slots)); height: 100%; border-right: 1px solid #7caf3866; }
.slot-guide:last-of-type { border-right: 0; }
.rack-tile { position: absolute; top: 0; width: calc(100% / var(--slots) - 2px); height: 100%; transition: left .18s cubic-bezier(.22,.65,.35,1); }
.rack-caption { display: flex; justify-content: space-between; color: #647d3c; font-size: 10px; margin: 14px 3px 0; letter-spacing: .3px; }
.rack.danger { border-color: #8d6028; background: #d2af50; }
.rack-failed { animation: rack-shake .3s; }
.tools { display: flex; justify-content: space-around; gap: 20px; padding: 20px 15px 0; }
.tool-button { display: flex; flex-direction: column; align-items: center; gap: 8px; background: none; border: 0; padding: 0; font-size: 14px; font-weight: 800; color: #3f552b; cursor: pointer; }
.tool-face { position: relative; width: 79px; height: 59px; padding: 7px 17px; border: 2px solid #365e51; border-radius: 8px; background: #17a9ed; box-shadow: inset 0 3px 0 #8adffe, inset 0 -4px 0 #1681cc, 0 4px 0 #366b62; }
.tool-face > svg { filter: drop-shadow(0 1px 0 #5f5436); }
.tool-plus { position: absolute; top: -9px; right: -9px; width: 23px; height: 23px; border-radius: 50%; background: #35462b; color: #fffce5; font: 800 21px/21px system-ui; }
.tool-button:active .tool-face { transform: translateY(3px); box-shadow: inset 0 3px 0 #8adffe, inset 0 -2px 0 #1681cc, 0 1px 0 #366b62; }
.tool-button:disabled { cursor: default; opacity: .5; }
.extra-tools-row { display: flex; justify-content: center; gap: 12px; align-items: center; margin-top: 20px; font-size: 10px; color: #6c8547; }
.text-button { color: #526d35; border: 0; background: transparent; padding: 6px; cursor: pointer; font: inherit; }
.text-button:focus-visible { outline: 2px solid #3c6c38; border-radius: 3px; }
.extra-tools { display: flex; gap: 7px; padding-top: 12px; }
.extra-tools .farm-button { flex: 1; font-size: 11px; min-height: 38px; padding: 5px; display: flex; align-items: center; justify-content: center; gap: 3px; }
.extra-tools svg { width: 18px; height: 18px; }
.extra-tools .selected { background: #ffdc73; }
.game-toast { position: fixed; z-index: 1500; bottom: 29%; left: 50%; transform: translateX(-50%); background: #35482ce8; color: #fff9d9; padding: 10px 18px; border-radius: 22px; font-size: 12px; white-space: nowrap; pointer-events: none; }
.toast-enter-active,.toast-leave-active { transition: opacity .15s, margin-bottom .15s; }
.toast-enter-from,.toast-leave-to { opacity: 0; margin-bottom: -8px; }
.animation-layer { position: fixed; inset: 0; pointer-events: none; z-index: 2000; }
.flying-tile { position: absolute; transform-origin: top left; will-change: transform; }
.match-burst { position: absolute; width: 0; height: 0; }
.match-burst i { position: absolute; width: 9px; height: 9px; background: #fff9b1; clip-path: polygon(50% 0,65% 35%,100% 50%,65% 65%,50% 100%,35% 65%,0 50%,35% 35%); animation: sparkle .47s ease-out both; }
.match-burst i:nth-child(3n) { background: #f4c642; width: 6px; height: 6px; }
.result-backdrop { position: fixed; inset: 0; background: #25432970; z-index: 1800; display: grid; place-items: center; padding: 24px; backdrop-filter: blur(3px); }
.result-panel { max-width: 340px; width: 100%; padding: 18px 24px 23px; border: 3px solid #47562c; border-radius: 18px; background: #fff9db; box-shadow: 0 8px 0 #3f562c; text-align: center; animation: result-in .3s ease-out; color: #41482c; }
.result-sheep { width: 116px; margin: -50px auto 3px; filter: drop-shadow(0 4px 0 #71834d33); }
.result-eyebrow { color: #87974c; letter-spacing: 3px; font-size: 12px; }
.result-panel h2 { color: #3c4e2b; font-size: 25px; font-weight: 900; margin: 9px 0; }
.result-panel p { font-size: 12px; color: #7d835d; margin: 0 0 23px; }
.result-panel .farm-button { display: block; width: 100%; margin-bottom: 13px; }
.result-panel .result-primary { background: #ffdb63; }
.result-panel .text-button { font-size: 12px; }
@keyframes sparkle { 0% { opacity: 0; transform: scale(.1); } 23% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--dx),var(--dy)) rotate(var(--r)) scale(.3); } }
@keyframes rack-shake { 25%,75% { transform: translateX(-4px); } 50% { transform: translateX(4px); } }
@keyframes result-in { from { opacity: 0; transform: translateY(12px) scale(.94); } to { opacity: 1; transform: none; } }
@media (max-width: 360px) { #gamePage { padding: 12px 9px 20px; } .game-heading { margin-top: 16px; } .playfield { margin-top: 18px; } .tools { gap: 14px; padding-left: 5px; padding-right: 5px; } .tool-face { width: 69px; height: 54px; padding: 7px 14px; } .random-board { margin-top: 5px; } }
@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration: .001ms !important; transition-duration: .001ms !important; } .match-burst { display: none; } }
</style>
