<template>
  <main id="gamePage" :class="{ 'easy-game': isEasy, 'classic-game': isClassic, 'has-reserve': reserveBlocksVal.length > 0 }" :style="{ '--board-units': boardUnits }" :data-game-status="gameStatus" :data-busy="busy" :inert="resultOpen ? '' : undefined">
    <svg class="pasture-marks" viewBox="0 0 390 844" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <path id="grass-crown" d="M2 17C-5 7 2 3 8 12 5-6 15-5 15 10 20-8 28-2 23 12 33 1 36 9 30 17" />
        <path id="grass-stems" d="M3 20C-5-8 8-7 9 18 7 3 17 6 15 21m4-9 2 9" />
      </defs>
      <g fill="none" stroke="#78a94a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <use href="#grass-crown" x="72" y="86" transform="rotate(-9 88 97)" />
        <use href="#grass-crown" x="286" y="43" />
        <use href="#grass-crown" x="246" y="143" transform="scale(.92)" />
        <use href="#grass-crown" x="49" y="245" transform="scale(.9)" />
        <use href="#grass-stems" x="24" y="195" />
        <use href="#grass-stems" x="46" y="498" />
        <use href="#grass-stems" x="353" y="507" />
      </g>
    </svg>
    <button v-if="settingsOpen" class="settings-scrim" tabindex="-1" aria-label="关闭设置" @click="settingsOpen = false"></button>
    <header class="game-toolbar">
      <button class="settings-toggle" aria-label="游戏设置" :aria-expanded="settingsOpen" @click="settingsOpen = !settingsOpen"><UiIcon name="settings" /></button>
      <span class="mode-label" :class="{ 'visually-hidden': isEasy }">{{ modeName }}</span>
      <nav v-if="settingsOpen" class="settings-panel paper-panel" aria-label="游戏设置菜单" @keydown.esc="settingsOpen = false">
        <button class="settings-action" @click="router.push('/')"><UiIcon name="back" />返回首页</button>
        <button class="settings-action" :aria-pressed="soundOn" @click="toggleSound"><UiIcon name="sound" :muted="!soundOn" />{{ soundOn ? '关闭音效' : '开启音效' }}</button>
        <button class="settings-action" @click="restart(); settingsOpen = false"><UiIcon name="restart" />重新开始</button>
        <button class="settings-action" :aria-expanded="showExtra" @click="showExtra = !showExtra"><UiIcon name="more" />更多道具</button>
        <div v-if="showExtra" class="extra-tools">
          <button class="settings-action" :disabled="busy || gameStatus !== 1" @click="breakGroup"><UiIcon name="spark" />消除一组</button>
          <button class="settings-action" :aria-pressed="isHolyLight" :disabled="busy || gameStatus !== 1" @click="doHolyLight(); settingsOpen = false; notify('下一张可以选择任意牌')"><UiIcon name="spark" />圣光</button>
          <button class="settings-action" :aria-pressed="canSeeRandom" :disabled="busy || gameStatus !== 1" @click="doSeeRandom()"><UiIcon name="eye" />透视</button>
        </div>
      </nav>
    </header>
    <h1 class="visually-hidden">{{ modeName }} · 叠牌消除</h1>
    <div class="visually-hidden" role="progressbar" :aria-valuenow="clearBlockNum" :aria-valuemax="totalBlockNum" aria-valuemin="0" aria-label="消除进度">{{ clearBlockNum }} / {{ totalBlockNum }}</div>
    <section class="playfield" aria-label="叠牌区域">
      <div class="level-board" :class="{ 'holy-field': isHolyLight }">
        <button v-for="block in visibleBlocks" :key="block.id" class="tile level-tile" :class="{ covered: isCovered(block), queued: queuedIds.includes(block.id) }"
          :data-source-id="block.id" :data-type="block.type" :aria-label="`${tileName(block.type)}${isCovered(block) ? '，被遮挡' : ''}`"
          :disabled="isCovered(block) || queuedIds.includes(block.id) || gameStatus !== 1"
          :style="{ left: `${block.x / boardUnits * 100}%`, top: `${block.y / boardUnits * 100}%`, zIndex: block.level + 1 }" @click="enqueue(block)"><TileIcon :type="block.type" /></button>
      </div>
      <div v-if="randomBlocksVal.some(pile => pile.length)" class="random-board" aria-label="备用牌堆">
        <div v-for="(pile, index) in randomBlocksVal" :key="index" class="random-pile">
          <span v-for="n in Math.min(Math.max(pile.length - 1, 0), 9)" :key="n" class="tile pile-back" :style="{ top: `calc(${n * -1} * var(--pile-step))`, zIndex: 10 - n }" aria-hidden="true"><TileIcon v-if="canSeeRandom && pile[n]" :type="pile[n].type" /></span>
          <button v-if="pile[0]" class="tile pile-top" :data-source-id="pile[0].id" :data-type="pile[0].type" :aria-label="`备用牌：${tileName(pile[0].type)}`" :disabled="queuedIds.includes(pile[0].id) || gameStatus !== 1" @click="enqueue(pile[0], index)"><TileIcon :type="pile[0].type" /></button>
          <span v-if="pile.length" class="visually-hidden">剩余 {{ pile.length }} 张</span>
        </div>
      </div>
    </section>
    <div class="bottom-ui">
      <div class="reserve-area" :class="{ empty: !reserveBlocksVal.length }" aria-label="移出暂存区">
        <span v-if="reserveBlocksVal.length" class="reserve-label">暂存</span>
        <button v-for="block in reserveBlocksVal" :key="block.id" class="tile reserve-tile" :data-source-id="block.id" :data-type="block.type" :aria-label="`暂存牌：${tileName(block.type)}`" :disabled="busy || gameStatus !== 1" @click="enqueue(block)"><TileIcon :type="block.type" /></button>
        <span v-if="!reserveBlocksVal.length" class="visually-hidden">凑齐三个相同图案，即可消除</span>
      </div>
      <section class="rack-section" aria-label="收集卡槽">
        <div class="rack" :class="{ danger: currSlotNum >= slotCount - 1, 'rack-failed': gameStatus === 2 }">
          <div class="rack-grid" :style="{ '--slots': slotCount }">
            <div v-for="(block, index) in displaySlots" :key="block.id" class="tile rack-tile" :data-slot-id="block.id" :data-type="block.type" :data-matching="matchingIds.includes(block.id)" :style="{ left: `${index / slotCount * 100}%`, visibility: hiddenIds.includes(block.id) ? 'hidden' : 'visible' }"><TileIcon :type="block.type" /></div>
          </div>
        </div>
        <div class="visually-hidden" role="status">{{ currSlotNum >= slotCount - 1 ? '卡槽快满了' : '收集卡槽' }}，{{ currSlotNum }} / {{ slotCount }}</div>
      </section>
      <nav class="tools" aria-label="游戏道具">
        <button class="tool-button" aria-label="移出" :disabled="busy || gameStatus === 3 || !currSlotNum" @click="removeTiles"><UiIcon name="remove" /><span class="tool-label">移出</span><span class="tool-plus" aria-hidden="true">+</span></button>
        <button class="tool-button" aria-label="撤回" :disabled="busy || !canUndo || gameStatus === 3" @click="undo"><UiIcon name="undo" /><span class="tool-label">撤回</span><span class="tool-plus" aria-hidden="true">+</span></button>
        <button class="tool-button" aria-label="洗牌" :disabled="busy || gameStatus !== 1" @click="shuffle"><UiIcon name="shuffle" /><span class="tool-label">洗牌</span><span class="tool-plus" aria-hidden="true">+</span></button>
      </nav>
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
const isEasy = computed(() => store.gameConfig.boardLayout === 'classic-easy');
const isClassic = computed(() => !!store.gameConfig.boardLayout);
const boardUnits = computed(() => isClassic.value ? 21 : 24);
const modeName = computed(() => isEasy.value ? '第 1 关 · 简单' : store.gameConfig.boardLayout === 'classic-normal' ? '第 2 关 · 正常' : ({ 8: '轻松牧场', 10: '进阶牧场', 12: '困难牧场', 14: '地狱挑战', 16: '天狱挑战', 18: '羊群挑战' }[store.gameConfig.typeNum] || '自定义牧场'));
const settingsOpen = ref(false);
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
#gamePage { position: relative; isolation: isolate; container-type: inline-size; width: 100%; height: 100svh; min-height: 174cqw; margin: 0 auto; color: #344322; --tile-depth: clamp(4px, 1.15cqw, 7px); --board-size: 84cqw; --tile-size: calc(var(--board-size) * 3 / var(--board-units)); --pile-step: clamp(3px, .95cqw, 6px); }
.visually-hidden { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip-path: inset(50%) !important; white-space: nowrap !important; border: 0 !important; }
.pasture-marks { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: -1; }
.game-toolbar { position: absolute; z-index: 600; top: 4.7%; left: 2%; right: 2%; height: 11cqw; pointer-events: none; }
.settings-toggle { display: grid; place-items: center; width: 10.6cqw; height: 10.6cqw; padding: 1.1cqw; border: clamp(2px, .7cqw, 4px) solid #192111; border-radius: 1.5cqw; background: #0aaaf4; color: #fff; box-shadow: inset 0 2px 0 #7bdcff, 0 3px 0 #526b35; cursor: pointer; pointer-events: auto; }
.settings-toggle:active { transform: translateY(2px); }
.mode-label { position: absolute; left: 50%; top: 2.5cqw; transform: translateX(-50%); padding: 5px 12px; border-radius: 5px; color: #fffde9; background: #17230e; font-size: clamp(12px, 3.2cqw, 19px); font-weight: 700; line-height: 1.15; white-space: nowrap; }
.settings-scrim { position: fixed; z-index: 500; inset: 0; border: 0; padding: 0; background: #2d49231f; }
.settings-panel { position: absolute; top: calc(100% + 14px); left: 0; width: 188px; padding: 8px; pointer-events: auto; box-shadow: 0 5px 0 #719c43; }
.settings-action { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; border: 0; border-radius: 7px; color: #35472a; background: transparent; font-size: 14px; font-weight: 700; cursor: pointer; text-align: left; }
.settings-action:hover { background: #e2edb3; }
.settings-action svg { flex: 0 0 22px; width: 22px; height: 22px; }
.extra-tools { margin-top: 5px; padding-top: 5px; border-top: 1px solid #bccc80; }
.playfield { position: absolute; top: 18%; left: 0; width: 100%; }
.classic-game .playfield { top: min(20%, calc(100% - 146cqw)); }
.has-reserve { min-height: 205cqw !important; }
.easy-game .playfield { top: 15.75%; }
.level-board { position: relative; width: 84%; aspect-ratio: 1; margin: 0 auto; isolation: isolate; }
.tile { display: flex; align-items: center; justify-content: center; padding: 1px 1px calc(var(--tile-depth, 5px) + 1px); border: clamp(1.4px, .35cqw, 2px) solid #3f4c2b; border-radius: clamp(4px, .9cqw, 6px); background: #f5fac5; box-shadow: inset 0 calc(-1 * var(--tile-depth, 5px)) 0 #82ab25, inset 0 calc(-1 * var(--tile-depth, 5px) - 2px) 0 #c5df72, inset 0 1px 0 #ffffe2, 0 1px 0 #3e5424; color: #35472a; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
button.tile { cursor: pointer; touch-action: manipulation; }
button.tile:focus-visible { outline: 3px solid #1676c7; outline-offset: 2px; }
.level-tile { position: absolute; width: calc(300% / var(--board-units)); height: calc(300% / var(--board-units) + var(--tile-depth)); transition: filter .12s, opacity .1s; }
.tile.covered { filter: brightness(.64) saturate(.63); cursor: default; }
.tile:disabled { opacity: 1; }
.tile.queued { filter: brightness(1.07); }
.holy-field .tile { outline: 1px solid #ffffd3; }
.random-board { position: absolute; top: calc(100% + 1cqw); left: 50%; transform: translateX(-50%); display: grid; grid-template-columns: repeat(2, var(--tile-size)); gap: calc(9 * var(--pile-step) + 8px) 1px; }
.random-pile { position: relative; isolation: isolate; width: var(--tile-size); height: calc(var(--tile-size) + var(--tile-depth)); }
.random-pile .tile { position: absolute; left: 0; width: 100%; height: 100%; }
.pile-back { background: #929d75; box-shadow: inset 0 -3px 0 #728052; pointer-events: none; }
.pile-top { z-index: 12; top: 0; }
.bottom-ui { position: absolute; bottom: max(2.2cqw, env(safe-area-inset-bottom)); left: 3.4%; width: 93.2%; }
.reserve-area { position: absolute; bottom: calc(100% + 18px); left: 0; right: 0; display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap; }
.reserve-area.empty { display: none; }
.reserve-tile { width: var(--tile-size); height: calc(var(--tile-size) + var(--tile-depth)); }
.reserve-label { font-size: 11px; margin-right: 5px; color: #46652b; }
.rack { padding: 1.45cqw; border: clamp(1.6px, .4cqw, 2.4px) solid #3d661a; border-radius: 2.5cqw; background: #8bd42b; box-shadow: inset 0 2px 0 #bfec71, inset 0 -3px 0 #69af1c, 0 4px 0 #467720, 0 6px 0 #a3cd6d; }
.rack-grid { position: relative; height: 13.3cqw; border-radius: 1.6cqw; background: #54a119; box-shadow: inset 0 5px 0 #468c14, inset 0 -1px 0 #72ba28; }
.rack-tile { position: absolute; top: 0; width: calc(100% / var(--slots) - 1px); height: 100%; transition: left .18s cubic-bezier(.22,.65,.35,1); }
.rack.danger { border-color: #946019; background: #e2bf42; }
.rack.danger .rack-grid { background: #9c8225; box-shadow: inset 0 5px 0 #836e1f; }
.rack-failed { animation: rack-shake .3s; }
.tools { display: flex; justify-content: space-between; gap: 9cqw; margin: 8cqw 6cqw 0; }
.tool-button { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; flex: 0 0 19.4cqw; height: 15.5cqw; padding: .8cqw .8cqw .5cqw; border: clamp(1.6px, .4cqw, 2.4px) solid #385a54; border-radius: 1.7cqw; background: #1da7ef; box-shadow: inset 0 2px 0 #97e1fa, inset 0 -3px 0 #1488ce, 0 4px 0 #496d5c, 0 6px 0 #8fa967; color: white; cursor: pointer; }
.tool-button > svg { position: absolute; top: .3cqw; left: 50%; transform: translateX(-50%); width: 9cqw; height: 9cqw; }
.tool-label { position: relative; font-size: clamp(16px, 4.5cqw, 27px); font-weight: 950; line-height: 1.15; -webkit-text-stroke: clamp(2px, .65cqw, 4px) #27352a; paint-order: stroke fill; text-shadow: 0 2px 0 #27352a; letter-spacing: .1cqw; }
.tool-plus { position: absolute; top: -1.2cqw; right: -2cqw; display: grid; place-items: center; width: 5.5cqw; height: 5.5cqw; border-radius: 50%; background: #070b04; color: white; font: 900 clamp(18px, 5cqw, 30px)/1 system-ui, sans-serif; }
.tool-button:active:not(:disabled) { transform: translateY(3px); box-shadow: inset 0 2px 0 #97e1fa, inset 0 -2px 0 #1488ce, 0 1px 0 #496d5c, 0 3px 0 #8fa967; }
.tool-button:disabled { cursor: default; opacity: 1; }
.text-button { color: #526d35; border: 0; background: transparent; padding: 6px; cursor: pointer; font: inherit; }
.text-button:focus-visible { outline: 2px solid #3c6c38; border-radius: 3px; }
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
@media (max-height: 700px) and (max-width: 480px) { .easy-game .playfield { top: 15%; } }
@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration: .001ms !important; transition-duration: .001ms !important; } .match-burst { display: none; } }
</style>
