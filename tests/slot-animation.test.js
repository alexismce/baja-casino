import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = (
  await readFile(new URL("../client/app.js", import.meta.url), "utf8")
).replaceAll("\r\n", "\n");
const presentationSource = await readFile(
  new URL("../client/slot-presentation.js", import.meta.url),
  "utf8",
);
const presentationWindow = {};
vm.runInNewContext(presentationSource, { window: presentationWindow });
const slotPresentation = presentationWindow.LuckySlotPresentation;
const start = source.indexOf("class LoungeScene extends Phaser.Scene {");
const end = source.indexOf("\n}\n", start) + 2;
const context = {
  Phaser: { Scene: class {} },
  SLOT_THEME: { glow: 1, trim: 2 },
  SLOT_SYMBOL_TEXTURES: { CHERRY: "cherry", ORANGE: "orange" },
  REDUCE_MOTION: false,
  playCue: async () => {},
  presentBonus() {},
  presentFortuneAward() {},
};
const Scene = vm.runInNewContext(
  `${source.slice(start, end)}; LoungeScene`,
  context,
);

function object() {
  return {
    y: 0,
    setTexture(value) {
      this.texture = value;
      return this;
    },
    setAlpha() {
      return this;
    },
    setScale() {
      return this;
    },
    setFillStyle() {
      return this;
    },
    setStrokeStyle() {
      return this;
    },
    setDisplaySize() {
      return this;
    },
    setText() {
      return this;
    },
  };
}

function timer(callback) {
  return {
    callback,
    removed: false,
    remove() {
      this.removed = true;
    },
  };
}

test("reels keep moving until their own server-result reveal and then stop", () => {
  const scene = Object.create(Scene.prototype);
  Object.assign(scene, {
    reelSpinTimers: [],
    stopTimers: [],
    reelTexts: Array.from({ length: 15 }, object),
    slotFrames: Array.from({ length: 15 }, object),
    slotWinLights: [],
    bonusCellTexts: Array.from({ length: 9 }, object),
    bonusCellFrames: Array.from({ length: 9 }, object),
    slotLineGraphics: { clear() {} },
    slotMascotStatus: object(),
    time: {
      delayedCall: (_delay, callback) => timer(callback),
      addEvent: ({ callback }) => timer(callback),
    },
    tweens: {
      killTweensOf() {},
      add() {},
      addCounter: ({ onComplete }) => onComplete(),
    },
  });
  scene.startSpin();
  scene.reelSpinTimers.forEach((column) => column[0].callback());
  const spinning = scene.reelSpinTimers.map((column) => column[1]);
  const reels = Array.from({ length: 5 }, (_, column) =>
    Array.from({ length: 3 }, () => (column % 2 ? "ORANGE" : "CHERRY")),
  );
  let completed = false;
  scene.showResult(
    {
      reels,
      bonusGrid: Array.from({ length: 3 }, () => [
        "CHERRY",
        "CHERRY",
        "CHERRY",
      ]),
      bonusLines: [],
      bonusPayout: 0,
      paylines: [],
    },
    () => {
      completed = true;
    },
  );
  assert.ok(spinning.every((timer) => !timer.removed));
  scene.stopTimers[0].callback();
  assert.equal(spinning[0].removed, true);
  assert.ok(spinning.slice(1).every((timer) => !timer.removed));
  spinning[1].callback();
  assert.deepEqual(
    scene.reelTexts.slice(0, 3).map((text) => text.texture),
    ["cherry", "cherry", "cherry"],
  );
  scene.stopTimers.slice(1).forEach((timer) => timer.callback());
  assert.ok(spinning.every((timer) => timer.removed));
  assert.deepEqual(
    scene.reelTexts.map((text) => text.texture),
    reels.flat().map((symbol) => symbol.toLowerCase()),
  );
  assert.equal(completed, true);
});

test("confirmed bonuses are announced once after reels settle, including reduced motion", () => {
  for (const reducedMotion of [false, true]) {
    context.REDUCE_MOTION = reducedMotion;
    const announced = [];
    context.presentBonus = (result) => announced.push(result);
    const scene = Object.create(Scene.prototype);
    Object.assign(scene, {
      reelSpinTimers: [],
      stopTimers: [],
      reelTexts: Array.from({ length: 15 }, object),
      slotFrames: Array.from({ length: 15 }, object),
      slotWinLights: [],
      bonusCellTexts: Array.from({ length: 9 }, object),
      bonusCellFrames: Array.from({ length: 9 }, object),
      slotLineGraphics: { clear() {} },
      slotMascotStatus: object(),
      time: { delayedCall: (_delay, callback) => timer(callback) },
      tweens: {
        killTweensOf() {},
        add() {},
        addCounter: ({ onComplete }) => onComplete(),
      },
      cameras: { main: { shake() {}, flash() {} } },
      showFortuneWheel: (_wheel, complete) => complete(),
    });

    const result = {
      reels: Array.from({ length: 5 }, () => ["CHERRY", "CHERRY", "CHERRY"]),
      bonusGrid: Array.from({ length: 3 }, () => [
        "CHERRY",
        "CHERRY",
        "CHERRY",
      ]),
      bonusLines: ["row-1"],
      bonusPayout: 1,
      paylines: [],
      fortuneWheel: { triggered: true },
    };
    let completed = false;
    scene.showResult(result, () => {
      completed = true;
    });
    if (!reducedMotion) {
      assert.equal(announced.length, 0);
      scene.stopTimers.forEach((item) => item.callback());
    }
    assert.deepEqual(announced, [result]);
    assert.equal(completed, true);
  }
  context.REDUCE_MOTION = false;
});

test("cinematic reels reveal through the same Phaser scene as every other game", () => {
  const scene = Object.create(Scene.prototype);
  Object.assign(scene, {
    mode: "slots-3d",
    reelSpinTimers: [],
    stopTimers: [],
    reelTexts: Array.from({ length: 15 }, object),
    slotFrames: Array.from({ length: 15 }, object),
    slotWinLights: [],
    bonusCellTexts: Array.from({ length: 9 }, object),
    bonusCellFrames: Array.from({ length: 9 }, object),
    slotLineGraphics: { clear() {}, lineStyle() {}, lineBetween() {} },
    slotMascotStatus: object(),
    time: { delayedCall: (_delay, callback) => timer(callback) },
    tweens: {
      killTweensOf() {},
      add() {},
      addCounter: ({ onComplete }) => onComplete(),
    },
    showFortuneWheel: (_wheel, complete) => complete(),
  });
  const reels = Array.from({ length: 5 }, (_, i) => [
    i % 2 ? "ORANGE" : "CHERRY",
    "CHERRY",
    "ORANGE",
  ]);
  const result = {
    reels,
    bonusGrid: Array.from({ length: 3 }, () => ["CHERRY", "CHERRY", "CHERRY"]),
    bonusLines: [],
    bonusPayout: 0,
    paylines: [],
  };
  scene.showResult(result, () => {});
  assert.ok(scene.reelTexts.every((symbol) => symbol.texture === undefined));
  scene.stopTimers.forEach((item) => item.callback());
  assert.deepEqual(
    scene.reelTexts.map((text) => text.texture),
    reels.flat().map((symbol) => symbol.toLowerCase()),
  );
});

test("3D loading failure keeps the Phaser reels playable", async () => {
  const scene = Object.create(Scene.prototype);
  const visibility = [];
  Object.assign(scene, {
    mode: "slots-3d",
    slot3dGeneration: 1,
    reelTexts: [{ setVisible: (visible) => visibility.push(visible) }],
  });
  const status = { textContent: "" };
  const errors = [];
  Object.assign(context, {
    window: {
      LuckySlots3D: {
        loadBabylon: () => Promise.reject(new Error("WebGL unavailable")),
      },
    },
    slots3dStatus: status,
    socket: { connected: true },
    updateConnection() {},
    console: { error: (...args) => errors.push(args) },
  });
  await scene.loadSlots3D(1);
  assert.deepEqual(visibility, [true]);
  assert.match(status.textContent, /Phaser 2D reels/);
  assert.equal(scene.slot3dLoading, false);
  assert.equal(errors.length, 1);
});

test("a late 3D load cannot mount after changing games", async () => {
  const scene = Object.create(Scene.prototype);
  Object.assign(scene, {
    mode: "slots-3d",
    slot3dGeneration: 1,
    reelTexts: [],
  });
  let resolveLoad;
  let constructed = false;
  Object.assign(context, {
    window: {
      LuckySlots3D: {
        loadBabylon: () =>
          new Promise((resolve) => {
            resolveLoad = resolve;
          }),
        Slots3D: class {
          constructor() {
            constructed = true;
          }
        },
      },
    },
    slots3dStatus: { textContent: "" },
    socket: { connected: true },
    updateConnection() {},
  });
  const loading = scene.loadSlots3D(1);
  scene.mode = "roulette";
  scene.slot3dGeneration = 2;
  resolveLoad();
  await loading;
  assert.equal(constructed, false);
});

test("wheel award is announced at reveal, not at the start of the wheel", () => {
  const wheel = { triggered: true, index: 1, multiplier: 2, payout: 4 };
  for (const reducedMotion of [false, true]) {
    context.REDUCE_MOTION = reducedMotion;
    const announced = [];
    context.presentFortuneAward = (result) => announced.push(result);
    let tween;
    let completed = false;
    const container = { add() {}, addAt() {}, destroy() {} };
    const graphics = {
      fillStyle() {},
      slice() {},
      fillPath() {},
      lineStyle() {},
      strokePath() {},
      strokeCircle() {},
      fillTriangle() {},
    };
    const scene = Object.create(Scene.prototype);
    Object.assign(scene, {
      add: {
        container: () => container,
        rectangle: () => ({}),
        graphics: () => graphics,
      },
      addText: () => ({
        setOrigin() {
          return this;
        },
        setText() {},
      }),
      tweens: {
        add: (value) => {
          tween = value;
        },
      },
      time: { delayedCall: (_delay, callback) => callback() },
    });
    scene.showFortuneWheel(wheel, () => {
      completed = true;
    });
    if (!reducedMotion) {
      assert.equal(announced.length, 0);
      tween.onComplete();
    }
    assert.deepEqual(announced, [wheel]);
    assert.equal(completed, true);
  }
  context.REDUCE_MOTION = false;
});

test("switching games updates the shareable URL only when the switch succeeds", () => {
  const start = source.indexOf("function setMode(mode) {");
  const end = source.indexOf("\nfunction requestBlackjackAction", start);
  const updatedUrls = [];
  const routeContext = {
    URL,
    GAME_MODES: ["slots", "roulette", "poker"],
    pendingRequestId: undefined,
    blackjackActive: false,
    pokerActive: false,
    currentMode: "slots",
    lastSlotMode: "slots",
    slotWheelEnabled: true,
    isSlotMode: (mode) => mode === "slots" || mode === "slots-3d",
    loungeScene: { setMode() {} },
    bonusDisplay: { hidden: false },
    bonusMusicUntil: 0,
    betInput: { disabled: true },
    syncGameModeUI() {},
    updateConnection() {},
    socket: { connected: true },
    window: {
      location: {
        href: "http://localhost:3000/client?game=slots&view=compact#table",
      },
      history: {
        state: { existing: true },
        replaceState: (state, _title, url) =>
          updatedUrls.push({ state, url: url.href }),
      },
    },
  };
  const setMode = vm.runInNewContext(
    `(function() { ${source.slice(start, end)}; return setMode; })()`,
    routeContext,
  );
  setMode("roulette");
  assert.equal(
    updatedUrls[0].url,
    "http://localhost:3000/client?game=roulette&view=compact#table",
  );
  assert.deepEqual(updatedUrls[0].state, { existing: true });
  routeContext.pokerActive = true;
  setMode("poker");
  setMode("invalid");
  assert.equal(updatedUrls.length, 1);
  routeContext.pokerActive = false;
  setMode("slots");
  assert.equal(
    updatedUrls[1].url,
    "http://localhost:3000/client?game=slots&view=compact&wheel=1#table",
  );
});

test("legacy slot links restore the right presentation and wheel setting", () => {
  const start = source.indexOf("const GAME_MODES =");
  const end = source.indexOf("const gameTabs =", start);
  for (const [search, expected] of [
    ["?game=fortune-slots", ["slots", true]],
    ["?game=mechanical-slots", ["mechanical-slots", false]],
    ["?game=slots-3d&wheel=1", ["slots-3d", true]],
    ["?game=roulette&wheel=1", ["roulette", false]],
  ]) {
    const result = vm.runInNewContext(
      `let currentMode = "slots"; ${source.slice(start, end)}; [currentMode, slotWheelEnabled]`,
      { URLSearchParams, window: { location: { search } } },
    );
    assert.deepEqual(Array.from(result), expected);
  }
});

test("one unified slot machine selects presentation from the line bet", () => {
  const getPresentation = slotPresentation.getSlotPresentationForBet;
  for (const bet of [1, 2, 3]) assert.equal(getPresentation(bet), "slots");
  for (const bet of [4, 5, 6, 7])
    assert.equal(getPresentation(bet), "mechanical-slots");
  for (const bet of [8, 9, 10]) assert.equal(getPresentation(bet), "slots-3d");
  for (const [bet, expected] of [
    [3.999, "slots"],
    [4, "mechanical-slots"],
    [7.999, "mechanical-slots"],
    [8, "slots-3d"],
    [" 4 ", "mechanical-slots"],
    ["8", "slots-3d"],
    ["", "slots"],
    [null, "slots"],
    [undefined, "slots"],
    ["invalid", "slots"],
    [NaN, "slots"],
    [-1, "slots"],
    [Infinity, "slots-3d"],
    [11, "slots-3d"],
  ])
    assert.equal(getPresentation(bet), expected, `bet ${String(bet)}`);

  let conversions = 0;
  assert.equal(
    getPresentation({ valueOf: () => (++conversions === 1 ? 3 : 4) }),
    "mechanical-slots",
  );
  assert.equal(conversions, 2);
  assert.throws(() => getPresentation(Symbol("bet")), /Cannot convert/);
});

test("bet presentation changes only when the game is ready for a switch", () => {
  const start = source.indexOf("function updateSlotPresentationForBet() {");
  const end = source.indexOf("\nfunction updateBetAndPresentation()", start);
  const changes = [];
  const state = {
    window: { LuckySlotPresentation: slotPresentation },
    isSlotMode: (mode) =>
      ["slots", "mechanical-slots", "slots-3d"].includes(mode),
    currentMode: "slots",
    pendingRequestId: undefined,
    blackjackActive: false,
    pokerActive: false,
    loungeScene: {},
    betInput: { value: "4" },
    setMode: (mode) => changes.push(mode),
  };
  const update = vm.runInNewContext(
    `${source.slice(start, end)}; updateSlotPresentationForBet`,
    state,
  );
  update();
  assert.deepEqual(changes, ["mechanical-slots"]);
  state.currentMode = "mechanical-slots";
  update();
  assert.equal(changes.length, 1);
  state.betInput.value = "8";
  for (const [key, value] of [
    ["currentMode", "roulette"],
    ["pendingRequestId", "pending"],
    ["blackjackActive", true],
    ["pokerActive", true],
    ["loungeScene", undefined],
  ]) {
    const previous = state[key];
    state[key] = value;
    update();
    assert.equal(changes.length, 1, `${key} should block switching`);
    state[key] = previous;
  }
  update();
  assert.deepEqual(changes, ["mechanical-slots", "slots-3d"]);
});

test("each reel style submits the selected server game and blocks duplicate requests", () => {
  const start = source.indexOf(
    'document.querySelector("#play-form").addEventListener("submit"',
  );
  const end = source.indexOf("\nslotsTab.addEventListener", start);
  for (const mode of ["slots", "mechanical-slots", "slots-3d"]) {
    for (const wheel of [false, true]) {
      let submit;
      const emitted = [];
      const state = {
        document: {
          querySelector: () => ({
            addEventListener: (_event, handler) => {
              submit = handler;
            },
          }),
        },
        socket: { connected: true, emit: (...args) => emitted.push(args) },
        loungeScene: { startSpin() {} },
        pendingRequestId: undefined,
        betInput: { value: "2" },
        currentMode: mode,
        slotWheelEnabled: wheel,
        isSlotMode: (value) =>
          ["slots", "mechanical-slots", "slots-3d"].includes(value),
        crypto: { randomUUID: () => "request-id" },
        bonusDisplay: {},
        bonusMusicUntil: 0,
        spinButton: {},
        resultDisplay: {},
        updateConnection() {},
      };
      vm.runInNewContext(source.slice(start, end), state);
      submit({ preventDefault() {} });
      submit({ preventDefault() {} });
      assert.equal(emitted.length, 1);
      assert.equal(emitted[0][0], "place_bet");
      assert.equal(emitted[0][1].game, wheel ? "fortune-slots" : "slots");
      assert.equal(emitted[0][1].bet, 2);
    }
  }
});

test("slot options cannot change while a spin is pending", () => {
  const start = source.indexOf('slotsTab.addEventListener("click"');
  const end = source.indexOf("\nblackjackTab.addEventListener", start);
  const listeners = {};
  const control = (name, value) => ({
    ...value,
    addEventListener: (_event, handler) => {
      listeners[name] = handler;
    },
  });
  let changed = false;
  const state = {
    slotsTab: control("slots"),
    slotStyle: control("style", { value: "slots-3d" }),
    slotWheel: control("wheel", { checked: true }),
    currentMode: "slots",
    lastSlotMode: "slots",
    slotWheelEnabled: false,
    pendingRequestId: "pending",
    blackjackActive: false,
    pokerActive: false,
    isSlotMode: () => true,
    setMode() {
      changed = true;
    },
    updateGameUrl() {
      changed = true;
    },
    playCue() {},
  };
  vm.runInNewContext(source.slice(start, end), state);
  listeners.style();
  listeners.wheel();
  assert.equal(state.slotStyle.value, "slots");
  assert.equal(state.slotWheel.checked, false);
  assert.equal(changed, false);
});

test("slot tab selects the presentation matching the current bet", () => {
  const start = source.indexOf('slotsTab.addEventListener("click"');
  const end = source.indexOf("\nslotStyle.addEventListener", start);
  let click;
  const modes = [];
  const state = {
    slotsTab: {
      addEventListener: (_event, handler) => {
        click = handler;
      },
    },
    window: { LuckySlotPresentation: slotPresentation },
    betInput: { value: "8" },
    setMode: (mode) => modes.push(mode),
  };
  vm.runInNewContext(source.slice(start, end), state);
  click();
  assert.deepEqual(modes, ["slots-3d"]);
});

test("changing the bet plays one cue regardless of the number of presets", () => {
  const start = source.indexOf("betPresetButtons.forEach((button) => {");
  const end = source.indexOf("\n\nrouletteNumber.replaceChildren", start);
  const listeners = [];
  let cues = 0;
  const betInput = {
    addEventListener: (event, handler) => {
      if (event === "change") listeners.push(handler);
    },
  };
  vm.runInNewContext(source.slice(start, end), {
    betPresetButtons: Array.from({ length: 4 }, () => ({
      addEventListener() {},
    })),
    betInput,
    playCue: () => {
      cues++;
    },
  });
  listeners.forEach((listener) => listener());
  assert.equal(cues, 1);
});

const slots3dSource = await readFile(
  new URL("../client/slots-3d.js", import.meta.url),
  "utf8",
);

function slots3dEnvironment({
  supported = true,
  failEngine = false,
  failScene = false,
} = {}) {
  const calls = {
    scripts: [],
    canvases: [],
    engines: [],
    scenes: [],
    observers: [],
    pipelines: [],
  };
  const parent = {
    children: [],
    appendChild(canvas) {
      this.children.push(canvas);
      canvas.parent = this;
    },
  };
  const document = {
    head: {
      appendChild(script) {
        calls.scripts.push(script);
      },
    },
    createElement(tag) {
      if (tag === "script") return {};
      assert.equal(tag, "canvas");
      const listeners = new Map();
      const canvas = {
        listeners,
        setAttribute(name, value) {
          this[name] = value;
        },
        addEventListener(name, callback) {
          listeners.set(name, callback);
        },
        removeEventListener(name, callback) {
          if (listeners.get(name) === callback) listeners.delete(name);
        },
        remove() {
          this.removeCount = (this.removeCount ?? 0) + 1;
          if (this.parent)
            this.parent.children = this.parent.children.filter(
              (child) => child !== this,
            );
        },
      };
      calls.canvases.push(canvas);
      return canvas;
    },
  };
  class Engine {
    static isSupported() {
      return supported;
    }
    constructor(canvas) {
      if (failEngine) throw new Error("engine failed");
      this.canvas = canvas;
      this.stops = 0;
      this.disposals = 0;
      this.resizes = 0;
      calls.engines.push(this);
    }
    setHardwareScalingLevel() {}
    stopRenderLoop() {
      this.stops++;
    }
    runRenderLoop() {}
    dispose() {
      this.disposals++;
    }
    resize() {
      this.resizes++;
    }
    getDeltaTime() {
      return 16;
    }
  }
  class Scene3D {
    constructor() {
      if (failScene) throw new Error("scene failed");
      this.disposals = 0;
      this.renders = 0;
      this.onBeforeRenderObservable = { add() {} };
      calls.scenes.push(this);
    }
    executeWhenReady(callback) {
      callback();
    }
    render() {
      this.renders++;
    }
    dispose() {
      this.disposals++;
    }
  }
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
      Object.assign(this, { x, y, z });
    }
    static Zero() {
      return new Vector3();
    }
  }
  class Color3 {
    static Black() {
      return new Color3();
    }
  }
  class Material {
    constructor() {
      this.clearCoat = {};
    }
  }
  class Pipeline {
    constructor() {
      this.disposals = 0;
      calls.pipelines.push(this);
    }
    dispose() {
      this.disposals++;
    }
  }
  const B = {
    Engine,
    Scene: Scene3D,
    Vector3,
    Color3,
    Color4: class {},
    ArcRotateCamera: class {
      constructor() {
        this.inputs = { clear() {} };
      }
    },
    Camera: { ORTHOGRAPHIC_CAMERA: 1 },
    HemisphericLight: class {},
    DirectionalLight: class {},
    PointLight: class {},
    DefaultRenderingPipeline: Pipeline,
    PBRMaterial: Material,
    Texture: class {},
    MeshBuilder: {
      CreateBox: () => ({ rotation: { set() {} } }),
      CreatePlane: () => ({ position: {} }),
    },
  };
  class ResizeObserver {
    constructor(callback) {
      this.callback = callback;
      this.disconnects = 0;
      calls.observers.push(this);
    }
    observe(canvas) {
      this.canvas = canvas;
    }
    disconnect() {
      this.disconnects++;
    }
  }
  const window = {};
  vm.runInNewContext(slots3dSource, {
    window,
    document,
    navigator: {},
    ResizeObserver,
  });
  return { window, B, parent, calls };
}

test("Babylon lazy loading shares one concurrent request and reuses the loaded global", async () => {
  const { window, B, calls } = slots3dEnvironment();
  const first = window.LuckySlots3D.loadBabylon();
  const second = window.LuckySlots3D.loadBabylon();
  assert.equal(first, second);
  assert.equal(calls.scripts.length, 1);
  assert.equal(calls.scripts[0].src, "/client/babylon.js");
  let resolved = false;
  first.then(() => {
    resolved = true;
  });
  await Promise.resolve();
  assert.equal(resolved, false);
  window.BABYLON = B;
  calls.scripts[0].onload();
  await Promise.all([first, second]);
  await window.LuckySlots3D.loadBabylon();
  assert.equal(calls.scripts.length, 1);
});

test("Babylon loading failures reject all callers and permit a successful retry", async () => {
  for (const failure of ["error", "missing-global"]) {
    const { window, B, calls } = slots3dEnvironment();
    const first = window.LuckySlots3D.loadBabylon();
    const second = window.LuckySlots3D.loadBabylon();
    const rejected = Promise.allSettled([first, second]);
    if (failure === "error") calls.scripts[0].onerror();
    else calls.scripts[0].onload();
    const results = await rejected;
    assert.ok(results.every((result) => result.status === "rejected"));
    assert.match(
      results[0].reason.message,
      failure === "error" ? /Could not load/ : /did not initialize/,
    );
    assert.equal(results[0].reason, results[1].reason);
    const retry = window.LuckySlots3D.loadBabylon();
    assert.equal(calls.scripts.length, 2);
    window.BABYLON = B;
    calls.scripts[1].onload();
    await retry;
    await window.LuckySlots3D.loadBabylon();
    assert.equal(calls.scripts.length, 2);
  }
});

test("unsupported WebGL rejects before adding a canvas or creating an engine", () => {
  const { window, B, parent, calls } = slots3dEnvironment({ supported: false });
  window.BABYLON = B;
  assert.throws(
    () => new window.LuckySlots3D.Slots3D(parent, false, 1, () => {}),
    /WebGL is not available/,
  );
  assert.equal(calls.canvases.length, 0);
  assert.equal(calls.engines.length, 0);
  assert.equal(parent.children.length, 0);
});

test("failed Babylon construction removes the canvas and releases any created engine", () => {
  for (const options of [{ failEngine: true }, { failScene: true }]) {
    const { window, B, parent, calls } = slots3dEnvironment(options);
    window.BABYLON = B;
    assert.throws(
      () => new window.LuckySlots3D.Slots3D(parent, false, 1, () => {}),
      /failed/,
    );
    assert.equal(parent.children.length, 0);
    assert.equal(calls.canvases[0].removeCount, 1);
    if (options.failScene) {
      assert.equal(calls.engines[0].stops, 1);
      assert.equal(calls.engines[0].disposals, 1);
    }
  }
});

test("WebGL context loss restores Phaser reels and cleans up the Babylon instance", async () => {
  const { window, B, parent, calls } = slots3dEnvironment();
  window.BABYLON = B;
  const scene = Object.create(Scene.prototype);
  const visibility = [];
  Object.assign(scene, {
    mode: "slots-3d",
    slot3dGeneration: 1,
    reelTexts: [{ setVisible: (visible) => visibility.push(visible) }],
  });
  const status = { textContent: "" };
  const errors = [];
  Object.assign(context, {
    window,
    gameContainer: parent,
    effectsLevel: 1,
    REDUCE_MOTION: false,
    slots3dStatus: status,
    socket: { connected: true },
    updateConnection() {},
    console: { error: (...args) => errors.push(args) },
  });
  await scene.loadSlots3D(1);
  const instance = scene.slots3d;
  assert.ok(instance);
  assert.deepEqual(visibility, [false]);
  const lost = instance.canvas.listeners.get("webglcontextlost");
  assert.equal(typeof lost, "function");
  lost();
  assert.equal(scene.slots3d, undefined);
  assert.deepEqual(visibility, [false, true]);
  assert.match(status.textContent, /Phaser 2D reels/);
  assert.match(errors[0][1].message, /context was lost/);
  assert.equal(parent.children.length, 0);
  assert.equal(instance.canvas.listeners.has("webglcontextlost"), false);
  assert.equal(calls.observers[0].disconnects, 1);
  assert.equal(calls.pipelines[0].disposals, 1);
  assert.equal(calls.scenes[0].disposals, 1);
  assert.equal(calls.engines[0].disposals, 1);
  const renders = calls.scenes[0].renders;
  calls.observers[0].callback();
  instance.render();
  assert.equal(calls.engines[0].resizes, 0);
  assert.equal(calls.scenes[0].renders, renders);
});

test("destroy is idempotent and disposes resources exactly once", () => {
  const { window, B, parent, calls } = slots3dEnvironment();
  window.BABYLON = B;
  const instance = new window.LuckySlots3D.Slots3D(parent, false, 1, () => {});
  instance.destroy();
  instance.destroy();
  assert.equal(parent.children.length, 0);
  assert.equal(instance.canvas.removeCount, 1);
  assert.equal(instance.canvas.listeners.size, 0);
  assert.equal(calls.observers[0].disconnects, 1);
  assert.equal(calls.engines[0].stops, 1);
  assert.equal(calls.pipelines[0].disposals, 1);
  assert.equal(calls.scenes[0].disposals, 1);
  assert.equal(calls.engines[0].disposals, 1);
});
