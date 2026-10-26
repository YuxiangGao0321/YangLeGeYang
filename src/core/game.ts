/**
 * Tile-matching rules. Animation timing belongs to the page: a selected match
 * remains in the tray until settleMatch() commits its removal.
 *
 * Original game by yupi https://github.com/liyupi
 */
import { computed, ref } from "vue";
import { defaultGameConfig } from "./gameConfig";
import { useGlobalStore } from "./globalStore";

type MoveSource = "board" | "random" | "reserve";

interface MoveRecord {
  block: BlockType;
  source: MoveSource;
  sourceIndex: number;
  randomIndex: number;
}

const shuffled = <T>(values: T[]): T[] => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const other = Math.floor(Math.random() * (i + 1));
    [result[i], result[other]] = [result[other], result[i]];
  }
  return result;
};

const integer = (value: number, fallback: number, minimum = 0) =>
  Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : fallback;

// Only the exact original default deck is migrated. A custom emoji deck,
// including a reordered or shortened version of this list, remains untouched.
const legacyDefaultAnimals = [
  "🐔", "🐟", "🦆", "🐶", "🐱", "🐴", "🐑", "🐦", "🐧", "🐊", "🐺",
  "🐒", "🐳", "🐬", "🐢", "🦖", "🦒", "🦁", "🐍", "🐭", "🐂",
];

const useGame = () => {
  const store = useGlobalStore();
  let config: GameConfigType = { ...defaultGameConfig };

  // 0: initializing, 1: playing, 2: full tray, 3: cleared.
  const gameStatus = ref(1);
  const levelBlocksVal = ref<BlockType[]>([]);
  const randomBlocksVal = ref<BlockType[][]>([]);
  const reserveBlocksVal = ref<BlockType[]>([]);
  const slotAreaVal = ref<SlotBlockType[]>([]);
  const pendingMatchIds = ref<number[]>([]);
  const totalBlockNum = ref(0);
  const clearBlockNum = ref(0);
  const isHolyLight = ref(false);
  const canSeeRandom = ref(false);

  const allBlocks = ref<BlockType[]>([]);
  const history = ref<MoveRecord[]>([]);
  const widthUnit = 14;
  const heightUnit = 14;
  const boxWidthNum = 24;
  const boxHeightNum = 24;
  const blockSize = 3;

  const occupiedSlots = computed(() =>
    slotAreaVal.value.filter((block): block is BlockType => block !== null)
  );
  const currSlotNum = computed(() => occupiedSlots.value.length);
  const canUndo = computed(
    () =>
      history.value.length > 0 &&
      pendingMatchIds.value.length === 0 &&
      gameStatus.value !== 3
  );
  // Kept as a reactive view for callers that used the old public history.
  const opHistory = computed(() => history.value.map((move) => move.block));

  const setSlots = (blocks: BlockType[]) => {
    slotAreaVal.value = [
      ...blocks,
      ...new Array(Math.max(0, config.slotNum - blocks.length)).fill(null),
    ];
  };

  const updateGameStatus = () => {
    if (totalBlockNum.value > 0 && clearBlockNum.value >= totalBlockNum.value) {
      gameStatus.value = 3;
    } else if (
      pendingMatchIds.value.length === 0 &&
      currSlotNum.value >= config.slotNum
    ) {
      gameStatus.value = 2;
    } else {
      gameStatus.value = 1;
    }
  };

  const overlap = (
    first: Pick<BlockType, "x" | "y">,
    second: Pick<BlockType, "x" | "y">
  ) =>
    Math.abs(first.x - second.x) < blockSize &&
    Math.abs(first.y - second.y) < blockSize;

  /** Rebuild only when restoring a tile; array order is the drawing order. */
  const rebuildRelations = () => {
    const activeBlocks = levelBlocksVal.value.filter(
      (block) => block.status === 0
    );
    // Build with plain coordinates/arrays, then publish once per tile. Reading
    // Vue proxies inside every overlap comparison makes large boards stutter.
    const positions = activeBlocks.map((block) => ({ x: block.x, y: block.y }));
    const graph = activeBlocks.map(() => ({
      higherThanBlocks: [] as BlockType[],
      lowerThanBlocks: [] as BlockType[],
      level: 1,
    }));
    activeBlocks.forEach((block, index) => {
      for (let lowerIndex = 0; lowerIndex < index; lowerIndex++) {
        const lower = activeBlocks[lowerIndex];
        if (!overlap(positions[index], positions[lowerIndex])) continue;
        graph[index].higherThanBlocks.push(lower);
        graph[lowerIndex].lowerThanBlocks.push(block);
        graph[index].level = Math.max(graph[index].level, graph[lowerIndex].level + 1);
      }
    });
    const indices = new Map(activeBlocks.map((block, index) => [block.id, index]));
    allBlocks.value.forEach((block) => {
      const index = indices.get(block.id);
      block.higherThanBlocks = index === undefined ? [] : graph[index].higherThanBlocks;
      block.lowerThanBlocks = index === undefined ? [] : graph[index].lowerThanBlocks;
      block.level = index === undefined ? 0 : graph[index].level;
    });
  };

  const detachRelations = (block: BlockType) => {
    block.higherThanBlocks.forEach((lower) => {
      lower.lowerThanBlocks = lower.lowerThanBlocks.filter(
        (higher) => higher.id !== block.id
      );
    });
    block.lowerThanBlocks.forEach((higher) => {
      higher.higherThanBlocks = higher.higherThanBlocks.filter(
        (lower) => lower.id !== block.id
      );
    });
    block.higherThanBlocks = [];
    block.lowerThanBlocks = [];
  };

  const normalizedConfig = (): GameConfigType => {
    const source = store.gameConfig;
    const isLegacyDefault =
      Array.isArray(source.animals) &&
      source.animals.length === legacyDefaultAnimals.length &&
      source.animals.every((animal, index) => animal === legacyDefaultAnimals[index]);
    const animals = isLegacyDefault
      ? defaultGameConfig.animals
      : Array.isArray(source.animals)
      ? source.animals.filter((animal) => typeof animal === "string" && animal)
      : [];
    const validAnimals = animals.length ? animals : defaultGameConfig.animals;
    return {
      boardLayout: source.boardLayout,
      slotNum: integer(source.slotNum, 7, 1),
      composeNum: integer(source.composeNum, 3, 1),
      typeNum: Math.min(integer(source.typeNum, 12, 1), validAnimals.length),
      levelBlockNum: integer(source.levelBlockNum, 24, 1),
      borderStep: integer(source.borderStep, 1),
      levelNum: integer(source.levelNum, 6, 1),
      randomBlocks: Array.isArray(source.randomBlocks)
        ? source.randomBlocks.map((count) => integer(count, 0))
        : [...defaultGameConfig.randomBlocks],
      animals: [...validAnimals],
    };
  };

  /** Face coordinates use the same three-unit tile as the coverage graph. */
  const placeClassicBoard = (blocks: BlockType[]) => {
    if (config.boardLayout === "classic-easy" && blocks.length === 18 && config.typeNum === 3) {
      const positions = [
        [3, 0], [6, 0], [3, 3], [6, 3],
        [12, 0], [15, 0], [12, 3], [15, 3],
        [6, 9], [9, 9], [12, 9],
        [3, 1.5], [6, 1.5], [12, 1.5], [15, 1.5],
        [6, 9.4], [9, 9.4], [12, 9.4],
      ];
      // Six of each pattern, including the seven exposed faces in the reference.
      const pattern = [1, 3, 2, 3, 3, 3, 1, 1, 1, 2, 2, 2, 3, 1, 2, 3, 1, 2];
      blocks.forEach((block, index) => {
        [block.x, block.y] = positions[index];
        block.type = config.animals[pattern[index] - 1];
      });
    } else if (config.boardLayout === "classic-normal") {
      // Four open corners and a central gap leave the silhouette legible.
      const foundation = [
        [0, 0], [3, 0], [9, 0], [15, 0], [18, 0],
        [0, 3], [3, 3], [6, 3], [9, 3], [12, 3], [15, 3], [18, 3],
        [0, 6], [3, 6], [6, 6], [12, 6], [15, 6], [18, 6],
        [1.5, 9], [4.5, 9], [7.5, 9], [10.5, 9], [13.5, 9], [16.5, 9],
        [1.5, 12], [4.5, 12], [7.5, 12], [10.5, 12], [13.5, 12], [16.5, 12],
        [0, 13.5], [3, 13.5], [15, 13.5], [18, 13.5],
        [0, 16.5], [3, 16.5], [15, 16.5], [18, 16.5],
        [0, 19.5], [3, 19.5], [15, 19.5], [18, 19.5],
      ];
      const exposed = [
        [3, 3], [9, 0], [15, 3], [3, 9], [7.5, 7.5], [10.5, 7.5], [15, 9],
        [6, 12], [12, 12], [1.5, 15], [6, 15], [9, 15], [12, 15], [16.5, 15],
        [1.5, 18], [16.5, 18],
      ];
      const underCount = Math.max(0, blocks.length - exposed.length);
      blocks.forEach((block, index) => {
        const point = index < underCount
          ? foundation[index % foundation.length]
          : exposed[index - underCount];
        [block.x, block.y] = point;
      });
    } else return false;
    levelBlocksVal.value = blocks;
    return true;
  };

  /**
   * Grid-aligned tiles with an alternating one-unit offset. When a custom
   * batch exceeds its available cells, another finite pass forms a new layer.
   */
  const placeBatch = (
    blocks: BlockType[],
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    batchIndex: number
  ) => {
    let placed = 0;
    let pass = 0;
    while (placed < blocks.length) {
      const offset = (batchIndex + pass) % 2;
      const positions: { x: number; y: number }[] = [];
      for (let x = minX; x <= maxX; x++) {
        if ((x - offset + blockSize) % blockSize !== 0) continue;
        for (let y = minY; y <= maxY; y++) {
          if ((y - offset + blockSize) % blockSize === 0) {
            positions.push({ x, y });
          }
        }
      }
      // Also covers very narrow custom bounds without a retry loop.
      if (positions.length === 0) {
        positions.push({ x: minX, y: minY });
      }
      for (const position of shuffled(positions)) {
        const block = blocks[placed++];
        block.x = position.x;
        block.y = position.y;
        if (placed >= blocks.length) break;
      }
      pass++;
    }
  };

  const doStart = () => {
    config = normalizedConfig();
    gameStatus.value = 1;
    history.value = [];
    pendingMatchIds.value = [];
    clearBlockNum.value = 0;
    isHolyLight.value = false;
    canSeeRandom.value = false;
    reserveBlocksVal.value = [];
    levelBlocksVal.value = [];
    randomBlocksVal.value = [];
    allBlocks.value = [];
    setSlots([]);

    const randomCount = config.randomBlocks.reduce((sum, count) => sum + count, 0);
    const blockUnit = config.composeNum * config.typeNum;
    const minimum = config.levelNum * config.levelBlockNum + randomCount;
    totalBlockNum.value = Math.ceil(minimum / blockUnit) * blockUnit;
    const animals = config.animals.slice(0, config.typeNum);
    const types = shuffled(
      Array.from({ length: totalBlockNum.value }, (_, index) =>
        animals[index % animals.length]
      )
    );
    allBlocks.value = types.map((type, id) => ({
      id,
      x: 0,
      y: 0,
      status: 0,
      level: 0,
      type,
      higherThanBlocks: [],
      lowerThanBlocks: [],
    }));

    let position = 0;
    randomBlocksVal.value = config.randomBlocks.map((count) => {
      const stack = allBlocks.value.slice(position, position + count);
      position += count;
      return stack;
    });
    if (placeClassicBoard(allBlocks.value.slice(position))) {
      rebuildRelations();
      return;
    }
    let remaining = totalBlockNum.value - randomCount;
    let minX = 0;
    let minY = 0;
    let maxX = boxWidthNum - blockSize;
    let maxY = boxHeightNum - blockSize;
    // A small central field remains available even at the highest difficulty.
    const minimumSpan = 9;
    for (let layer = 0; layer < config.levelNum && remaining > 0; layer++) {
      if (layer > 0 && config.borderStep > 0) {
        const step = config.borderStep;
        switch (layer % 4) {
          case 0:
            minX = Math.min(minX + step, maxX - minimumSpan);
            break;
          case 1:
            maxY = Math.max(maxY - step, minY + minimumSpan);
            break;
          case 2:
            minY = Math.min(minY + step, maxY - minimumSpan);
            break;
          default:
            maxX = Math.max(maxX - step, minX + minimumSpan);
        }
      }
      const count =
        layer === config.levelNum - 1
          ? remaining
          : Math.min(config.levelBlockNum, remaining);
      const blocks = allBlocks.value.slice(position, position + count);
      placeBatch(blocks, minX, minY, maxX, maxY, layer);
      levelBlocksVal.value.push(...blocks);
      position += count;
      remaining -= count;
    }
    rebuildRelations();
  };

  /** Select one tile; the page calls settleMatch after its match animation. */
  const doClickBlock = (
    block: BlockType,
    randomIdx = -1,
    force = false
  ): boolean => {
    if (
      gameStatus.value !== 1 ||
      pendingMatchIds.value.length > 0 ||
      currSlotNum.value >= config.slotNum ||
      block.status !== 0 ||
      allBlocks.value[block.id] !== block
    ) {
      return false;
    }

    let source: MoveSource = "board";
    let sourceIndex = reserveBlocksVal.value.findIndex(
      (entry) => entry.id === block.id
    );
    let randomIndex = randomIdx;
    if (sourceIndex >= 0) {
      source = "reserve";
    } else {
      if (randomIndex < 0) {
        randomIndex = randomBlocksVal.value.findIndex(
          (stack) => stack[0]?.id === block.id
        );
      }
      if (randomIndex >= 0) {
        if (randomBlocksVal.value[randomIndex]?.[0]?.id !== block.id) return false;
        source = "random";
        sourceIndex = 0;
      } else {
        sourceIndex = levelBlocksVal.value.findIndex(
          (entry) => entry.id === block.id
        );
        if (
          sourceIndex < 0 ||
          (block.lowerThanBlocks.length > 0 && !force && !isHolyLight.value)
        ) {
          return false;
        }
      }
    }

    history.value.push({ block, source, sourceIndex, randomIndex });
    if (source === "random") {
      randomBlocksVal.value[randomIndex].shift();
    } else if (source === "reserve") {
      reserveBlocksVal.value.splice(sourceIndex, 1);
    } else {
      detachRelations(block);
    }
    isHolyLight.value = false;
    block.status = 1;

    const slots = [...occupiedSlots.value];
    let insertIndex = slots.length;
    for (let index = slots.length - 1; index >= 0; index--) {
      if (slots[index].type === block.type) {
        insertIndex = index + 1;
        break;
      }
    }
    slots.splice(insertIndex, 0, block);
    setSlots(slots);
    const matching = slots.filter((entry) => entry.type === block.type);
    if (matching.length >= config.composeNum) {
      pendingMatchIds.value = matching
        .slice(0, config.composeNum)
        .map((entry) => entry.id);
    }
    updateGameStatus();
    return true;
  };

  const settleMatch = (): boolean => {
    if (pendingMatchIds.value.length === 0) return false;
    const matched = new Set(pendingMatchIds.value);
    let removed = 0;
    const remaining = occupiedSlots.value.filter((block) => {
      if (!matched.has(block.id)) return true;
      block.status = 2;
      removed++;
      return false;
    });
    clearBlockNum.value += removed;
    pendingMatchIds.value = [];
    history.value = [];
    setSlots(remaining);
    updateGameStatus();
    return removed > 0;
  };

  const doRevert = (): boolean => {
    if (!canUndo.value) return false;
    const move = history.value[history.value.length - 1];
    if (!occupiedSlots.value.some((block) => block.id === move.block.id)) {
      return false;
    }
    history.value.pop();
    setSlots(occupiedSlots.value.filter((block) => block.id !== move.block.id));
    move.block.status = 0;
    if (move.source === "random") {
      randomBlocksVal.value[move.randomIndex].splice(
        move.sourceIndex,
        0,
        move.block
      );
    } else if (move.source === "reserve") {
      reserveBlocksVal.value.splice(move.sourceIndex, 0, move.block);
    } else if (!levelBlocksVal.value.some((block) => block.id === move.block.id)) {
      levelBlocksVal.value.splice(move.sourceIndex, 0, move.block);
    }
    rebuildRelations();
    updateGameStatus();
    return true;
  };

  /** Move up to three leftmost tray tiles into a clickable temporary area. */
  const doRemove = (count = 3): boolean => {
    if (pendingMatchIds.value.length > 0 || gameStatus.value === 3) return false;
    const slots = [...occupiedSlots.value];
    const removed = slots.splice(0, integer(count, 3));
    if (removed.length === 0) return false;
    const removedIds = new Set(removed.map((block) => block.id));
    levelBlocksVal.value = levelBlocksVal.value.filter(
      (block) => !removedIds.has(block.id)
    );
    removed.forEach((block) => {
      block.status = 0;
      block.level = 0;
      block.higherThanBlocks = [];
      block.lowerThanBlocks = [];
    });
    reserveBlocksVal.value.push(...removed);
    history.value = [];
    setSlots(slots);
    updateGameStatus();
    return true;
  };

  const doShuffle = (): boolean => {
    if (gameStatus.value !== 1 || pendingMatchIds.value.length > 0) return false;
    const available = allBlocks.value.filter((block) => block.status === 0);
    if (available.length < 2) return false;
    const oldTypes = available.map((block) => block.type);
    const types = shuffled(oldTypes);
    if (types.every((type, index) => type === oldTypes[index])) {
      const different = types.findIndex((type) => type !== types[0]);
      if (different < 0) return false;
      [types[0], types[different]] = [types[different], types[0]];
    }
    available.forEach((block, index) => {
      block.type = types[index];
    });
    return true;
  };

  /**
   * A page can select these one at a time with force=true, using its normal
   * animation path. Prefer a type already in the tray when one can be completed.
   */
  const findMatchBlocks = (): BlockType[] => {
    if (gameStatus.value !== 1 || pendingMatchIds.value.length > 0) return [];
    const candidates = [
      ...levelBlocksVal.value.filter((block) => block.status === 0),
      ...reserveBlocksVal.value,
      ...randomBlocksVal.value.flatMap((stack) => (stack[0] ? [stack[0]] : [])),
    ];
    const groups = new Map<string, BlockType[]>();
    candidates.forEach((block) => {
      const group = groups.get(block.type) || [];
      group.push(block);
      groups.set(block.type, group);
    });
    const trayTypes = occupiedSlots.value.map((block) => block.type);
    const types = [...new Set([...trayTypes, ...groups.keys()])];
    for (const type of types) {
      const needed =
        config.composeNum - trayTypes.filter((entry) => entry === type).length;
      const group = groups.get(type) || [];
      if (
        needed > 0 &&
        needed <= config.slotNum - currSlotNum.value &&
        group.length >= needed
      ) {
        return group.slice(0, needed);
      }
    }
    return [];
  };

  const doBroke = (): boolean => {
    const blocks = findMatchBlocks();
    if (blocks.length === 0) return false;
    return blocks.every((block) => doClickBlock(block, -1, true));
  };

  const doHolyLight = (): boolean => {
    if (gameStatus.value !== 1 || pendingMatchIds.value.length > 0) return false;
    isHolyLight.value = true;
    return true;
  };

  const doSeeRandom = () => {
    canSeeRandom.value = !canSeeRandom.value;
  };

  return {
    gameStatus,
    levelBlocksVal,
    randomBlocksVal,
    reserveBlocksVal,
    slotAreaVal,
    pendingMatchIds,
    widthUnit,
    heightUnit,
    currSlotNum,
    canUndo,
    opHistory,
    totalBlockNum,
    clearBlockNum,
    isHolyLight,
    canSeeRandom,
    doClickBlock,
    settleMatch,
    doStart,
    doShuffle,
    findMatchBlocks,
    doBroke,
    doRemove,
    doRevert,
    doHolyLight,
    doSeeRandom,
  };
};

export default useGame;
