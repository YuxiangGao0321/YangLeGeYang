const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRequire } = require("node:module");
const test = require("node:test");
const ts = require("typescript");

// Load Vue's Node runtime before installing the storage-only window shim.
const { isReactive, isRef } = require("vue");
const { createPinia, setActivePinia } = require("pinia");
const storage = new Map();
global.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
  },
};

const root = path.resolve(__dirname, "..");
const projectRequire = createRequire(path.join(root, "package.json"));
const sourceNames = ["gameConfig", "globalStore", "game"];
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "yulegeyu-core-test-"));
let configs;
let useGlobalStore;
let useGame;

try {
  for (const name of sourceNames) {
    const source = fs.readFileSync(path.join(root, "src", "core", `${name}.ts`), "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
      fileName: `${name}.ts`,
    });
    fs.writeFileSync(path.join(temporaryDirectory, `${name}.cjs`), outputText);
  }

  // Evaluate only the local, freshly transpiled modules. Package imports use
  // this project's real dependencies rather than copied or mocked reactivity.
  const modules = new Map();
  const load = (name) => {
    if (modules.has(name)) return modules.get(name).exports;
    if (!sourceNames.includes(name)) throw new Error(`Unexpected test import: ${name}`);
    const filename = path.join(temporaryDirectory, `${name}.cjs`);
    const localModule = { exports: {} };
    modules.set(name, localModule);
    const localRequire = (specifier) => specifier.startsWith("./")
      ? load(specifier.slice(2))
      : projectRequire(specifier);
    const execute = new Function("require", "module", "exports", "__filename", "__dirname", fs.readFileSync(filename, "utf8"));
    execute(localRequire, localModule, localModule.exports, filename, temporaryDirectory);
    return localModule.exports;
  };
  configs = load("gameConfig");
  ({ useGlobalStore } = load("globalStore"));
  useGame = load("game").default;
} finally {
  // Known files only: no build output or generated test files enter the repo.
  for (const name of sourceNames) {
    const filename = path.join(temporaryDirectory, `${name}.cjs`);
    if (fs.existsSync(filename)) fs.unlinkSync(filename);
  }
  fs.rmdirSync(temporaryDirectory);
}

const seededRandom = (name) => {
  let state = [...name].reduce((seed, character) =>
    (Math.imul(seed, 31) + character.codePointAt(0)) >>> 0, 2166136261);
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const check = (name, body) => test(name, () => {
  const originalRandom = Math.random;
  Math.random = seededRandom(name);
  setActivePinia(createPinia());
  storage.clear();
  try { body(); } finally { Math.random = originalRandom; }
});

const start = (changes = {}) => {
  const store = useGlobalStore();
  store.setGameConfig({ ...configs.defaultGameConfig, ...changes });
  const game = useGame();
  game.doStart();
  return game;
};
const slots = (game) => game.slotAreaVal.value.filter(Boolean);
const board = (game) => game.levelBlocksVal.value;
const sources = (game) => [
  ...board(game).filter((block) => block.status === 0),
  ...game.randomBlocksVal.value.flat(),
  ...game.reserveBlocksVal.value,
  ...slots(game),
];
const groups = (game) => {
  const result = new Map();
  for (const block of board(game).filter((entry) => entry.status === 0)) {
    if (!result.has(block.type)) result.set(block.type, []);
    result.get(block.type).push(block);
  }
  return [...result.values()];
};
const forcePick = (game, block) => assert.equal(game.doClickBlock(block, -1, true), true);
const conserved = (game) => {
  const active = sources(game);
  assert.equal(new Set(active.map((block) => block.id)).size, active.length, "each remaining tile has exactly one source");
  assert.equal(active.length + game.clearBlockNum.value, game.totalBlockNum.value, "remaining + cleared equals the initial tile count");
  assert.equal(slots(game).length, game.currSlotNum.value);
  const unselected = active.filter((block) => block.status === 0);
  const lowerIds = new Map(unselected.map((block) =>
    [block.id, new Set(block.higherThanBlocks.map((lower) => lower.id))]));
  assert(unselected.every((block) => block.lowerThanBlocks.every((higher) =>
    higher.status === 0 && lowerIds.get(higher.id)?.has(block.id))), "covering relations stay reciprocal and active");
};

check("three matching tiles remain visible until explicit settlement", () => {
  const game = start({ typeNum: 1, levelNum: 2, levelBlockNum: 3, randomBlocks: [] });
  assert(isRef(game.slotAreaVal));
  assert(isReactive(board(game)[0]));
  board(game).slice(0, 3).forEach((block) => forcePick(game, block));
  assert.equal(game.pendingMatchIds.value.length, 3);
  assert.equal(game.currSlotNum.value, 3);
  assert.equal(game.clearBlockNum.value, 0);
  assert.equal(game.gameStatus.value, 1);
  assert.equal(game.doClickBlock(board(game)[3], -1, true), false);
  assert.equal(game.doRevert(), false);
  assert.equal(game.doRemove(), false);
  assert.equal(game.settleMatch(), true);
  assert.equal(game.currSlotNum.value, 0);
  assert.equal(game.clearBlockNum.value, 3);
  assert.equal(game.canUndo.value, false);
  assert.equal(game.settleMatch(), false, "a second settlement cannot count tiles twice");
  conserved(game);
  board(game).filter((block) => block.status === 0).forEach((block) => forcePick(game, block));
  assert(game.settleMatch());
  assert.equal(game.gameStatus.value, 3);
  assert.equal(game.clearBlockNum.value, game.totalBlockNum.value);
  conserved(game);
});

check("the seventh tray tile can complete a match without a false loss", () => {
  const game = start({ typeNum: 5, levelNum: 1, levelBlockNum: 15, randomBlocks: [] });
  const [a, b, c, d] = groups(game);
  [a[0], a[1], b[0], b[1], c[0], d[0]].forEach((block) => forcePick(game, block));
  assert.equal(game.currSlotNum.value, 6);
  assert.deepEqual(game.findMatchBlocks().map((block) => block.id), [a[2].id], "the group helper can complete a match with one free slot");
  forcePick(game, a[2]);
  assert.equal(game.currSlotNum.value, 7);
  assert.equal(game.gameStatus.value, 1);
  assert.equal(game.pendingMatchIds.value.length, 3);
  assert(game.settleMatch());
  assert.equal(game.currSlotNum.value, 4);
  assert.equal(game.gameStatus.value, 1);
  conserved(game);
});

check("a genuinely full tray loses and undo restores the playing state", () => {
  const game = start({ typeNum: 4, levelNum: 1, levelBlockNum: 12, randomBlocks: [] });
  const [a, b, c, d] = groups(game);
  [a[0], a[1], b[0], b[1], c[0], c[1], d[0]].forEach((block) => forcePick(game, block));
  assert.equal(game.pendingMatchIds.value.length, 0);
  assert.equal(game.gameStatus.value, 2);
  assert(game.canUndo.value);
  assert(game.doRevert());
  assert.equal(game.gameStatus.value, 1);
  assert.equal(game.currSlotNum.value, 6);
  assert.equal(d[0].status, 0);
  conserved(game);
});

check("board undo removes the last selected id after grouping and restores coverage", () => {
  const game = start({ typeNum: 3, levelNum: 2, levelBlockNum: 9, randomBlocks: [] });
  const blocked = board(game).find((block) => block.lowerThanBlocks.length > 0);
  assert(blocked);
  assert.equal(game.doClickBlock(blocked), false);
  const snapshot = () => board(game).map((block) => [block.id, block.lowerThanBlocks.map((higher) => higher.id)]);
  const before = snapshot();
  const top = board(game).find((block) => block.lowerThanBlocks.length === 0);
  assert(game.doClickBlock(top));
  assert.equal(game.doClickBlock(top), false, "the same tile cannot be selected twice");
  assert(game.doRevert());
  assert.deepEqual(snapshot(), before);
  const [a, b] = groups(game);
  [a[0], b[0], a[1]].forEach((block) => forcePick(game, block));
  assert.deepEqual(slots(game).map((block) => block.id), [a[0].id, a[1].id, b[0].id]);
  assert(game.doRevert());
  assert.deepEqual(slots(game).map((block) => block.id), [a[0].id, b[0].id]);
  assert.equal(a[1].status, 0);
  conserved(game);
});

check("random-stack undo restores its original head rather than the prior board tile", () => {
  const game = start({ typeNum: 3, levelNum: 2, levelBlockNum: 9, randomBlocks: [3, 3] });
  const random = game.randomBlocksVal.value[0][0];
  const stackIds = game.randomBlocksVal.value[0].map((block) => block.id);
  const selectedBoard = board(game).find((block) => block.type !== random.type);
  forcePick(game, selectedBoard);
  assert(game.doClickBlock(random, 0));
  assert(game.doRevert());
  assert.deepEqual(game.randomBlocksVal.value[0].map((block) => block.id), stackIds);
  assert.equal(random.status, 0);
  assert.equal(selectedBoard.status, 1);
  assert.equal(game.currSlotNum.value, 1);
  assert(game.doRevert());
  assert.equal(selectedBoard.status, 0);
  assert.equal(game.currSlotNum.value, 0);
  conserved(game);
});

check("moved tiles stay selectable and reserve undo restores their position", () => {
  const game = start({ typeNum: 4, levelNum: 1, levelBlockNum: 12, randomBlocks: [] });
  groups(game).slice(0, 3).forEach((group) => forcePick(game, group[0]));
  assert(game.doRemove());
  assert.equal(game.currSlotNum.value, 0);
  assert.equal(game.reserveBlocksVal.value.length, 3);
  assert.equal(game.canUndo.value, false);
  const originalIds = game.reserveBlocksVal.value.map((block) => block.id);
  const selected = game.reserveBlocksVal.value[1];
  assert(game.doClickBlock(selected));
  assert(game.doRevert());
  assert.deepEqual(game.reserveBlocksVal.value.map((block) => block.id), originalIds);
  assert.equal(game.currSlotNum.value, 0);
  assert.equal(game.totalBlockNum.value, 12);
  conserved(game);
});

check("restarting clears matches, history, reserve, counters, and stale tile references", () => {
  const game = start({ typeNum: 4, levelNum: 2, levelBlockNum: 12, randomBlocks: [2] });
  const total = game.totalBlockNum.value;
  groups(game).slice(0, 3).forEach((group) => forcePick(game, group[0]));
  assert(game.doRemove());
  assert(game.doBroke());
  assert(game.settleMatch());
  assert.equal(game.clearBlockNum.value, 3);
  assert(game.doBroke());
  assert.equal(game.pendingMatchIds.value.length, 3);
  game.doSeeRandom();
  const oldTile = sources(game)[0];
  for (let restart = 0; restart < 3; restart++) {
    game.doStart();
    assert.equal(game.totalBlockNum.value, total);
    assert.equal(game.clearBlockNum.value, 0);
    assert.equal(game.currSlotNum.value, 0);
    assert.equal(game.reserveBlocksVal.value.length, 0);
    assert.equal(game.pendingMatchIds.value.length, 0);
    assert.equal(game.opHistory.value.length, 0);
    assert.equal(game.canUndo.value, false);
    assert.equal(game.canSeeRandom.value, false);
    assert.equal(game.isHolyLight.value, false);
    assert.equal(game.gameStatus.value, 1);
    assert.equal(game.randomBlocksVal.value[0].length, 2);
    conserved(game);
  }
  assert.equal(game.doClickBlock(oldTile, -1, true), false);
});

check("all difficulties and extreme contraction keep grid coordinates inside the board", () => {
  const presets = [...Object.values(configs), {
    ...configs.yangGameConfig, levelNum: 24, levelBlockNum: 40, borderStep: 100,
  }];
  for (const preset of presets) {
    const game = start(preset);
    assert(board(game).every((block) => Number.isFinite(block.x) && Number.isFinite(block.y) &&
      block.x >= 0 && block.x <= 21 && block.y >= 0 && block.y <= 21));
    if (!preset.boardLayout) {
      assert(board(game).every((block) => Number.isInteger(block.x) && Number.isInteger(block.y) &&
        [0, 1].includes(block.x % 3) && [0, 1].includes(block.y % 3)));
    } else {
      assert(board(game).every((block) => block.x + 3 <= 21));
    }
    const counts = new Map();
    for (const block of sources(game)) counts.set(block.type, (counts.get(block.type) || 0) + 1);
    assert([...counts.values()].every((count) => count % preset.composeNum === 0));
    conserved(game);
  }
});

check("reference layouts preserve geometric coverage including half-tile offsets", () => {
  for (const preset of [configs.easyGameConfig, configs.middleGameConfig]) {
    const game = start(preset);
    const blocks = board(game);
    blocks.forEach((block, index) => {
      const covers = blocks.slice(0, index).filter((lower) =>
        Math.abs(lower.x - block.x) < 3 && Math.abs(lower.y - block.y) < 3);
      assert.deepEqual(block.higherThanBlocks.map((lower) => lower.id), covers.map((lower) => lower.id));
      if (block.lowerThanBlocks.length) assert.equal(game.doClickBlock(block), false);
    });
    const exposed = blocks.filter((block) => !block.lowerThanBlocks.length);
    assert(exposed.length >= 7);
    assert(game.doClickBlock(exposed[0]));
    assert(game.doRevert());
    conserved(game);
  }
});

check("the 18-tile tutorial exposes seven faces and can be cleared without tools", () => {
  const game = start(configs.easyGameConfig);
  assert.equal(game.totalBlockNum.value, 18);
  assert.equal(game.randomBlocksVal.value.length, 0);
  assert.equal(board(game).filter((block) => !block.lowerThanBlocks.length).length, 7);
  for (let move = 0; move < 18; move++) {
    const available = board(game).filter((block) => block.status === 0 && !block.lowerThanBlocks.length);
    const selected = available.find((block) => slots(game).some((tile) => tile.type === block.type)) || available[0];
    assert(selected);
    assert(game.doClickBlock(selected));
    if (game.pendingMatchIds.value.length) assert(game.settleMatch());
    conserved(game);
  }
  assert.equal(game.gameStatus.value, 3);
  assert.equal(game.clearBlockNum.value, 18);
});

check("shuffle preserves types and mixed actions conserve every tile", () => {
  const game = start(configs.yangGameConfig);
  const originalTypes = sources(game).map((block) => block.type).sort();
  assert(game.doShuffle());
  assert.deepEqual(sources(game).map((block) => block.type).sort(), originalTypes);
  for (let step = 0; step < 180; step++) {
    if (game.pendingMatchIds.value.length) game.settleMatch();
    else if (game.gameStatus.value === 2) game.doRemove();
    else if (step % 17 === 0) game.doShuffle();
    else if (step % 13 === 0 && game.canUndo.value) game.doRevert();
    else {
      const candidates = [
        ...board(game).filter((block) => block.status === 0 && block.lowerThanBlocks.length === 0),
        ...game.randomBlocksVal.value.flatMap((stack) => stack[0] ? [stack[0]] : []),
        ...game.reserveBlocksVal.value,
      ];
      if (candidates.length) assert(game.doClickBlock(candidates[Math.floor(Math.random() * candidates.length)]));
    }
    conserved(game);
  }
});

check("only the exact legacy default emoji deck migrates; custom decks still work", () => {
  const legacy = ["🐔", "🐟", "🦆", "🐶", "🐱", "🐴", "🐑", "🐦", "🐧", "🐊", "🐺", "🐒", "🐳", "🐬", "🐢", "🦖", "🦒", "🦁", "🐍", "🐭", "🐂"];
  const migrated = start({ animals: [...legacy], typeNum: 3, levelNum: 1, levelBlockNum: 9, randomBlocks: [] });
  assert(sources(migrated).every((block) => configs.defaultGameConfig.animals.slice(0, 3).includes(block.type)));
  for (const animals of [["⭐", "🍉"], legacy.slice(0, 2), [...legacy].reverse()]) {
    const game = start({ animals, typeNum: 2, composeNum: 4, slotNum: 8, levelNum: 1, levelBlockNum: 8, randomBlocks: [] });
    assert.deepEqual([...new Set(sources(game).map((block) => block.type))].sort(), animals.slice(0, 2).sort());
    const match = game.findMatchBlocks();
    assert.equal(match.length, 4);
    match.forEach((block) => forcePick(game, block));
    assert.equal(game.pendingMatchIds.value.length, 4);
    assert(game.settleMatch());
    assert.equal(game.clearBlockNum.value, 4);
    conserved(game);
  }
});
