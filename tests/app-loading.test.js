import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = (
  await readFile(new URL("../client/app.js", import.meta.url), "utf8")
).replaceAll("\r\n", "\n");
const loaderStart = source.indexOf("function updateAppLoader(");
const loaderEnd = source.indexOf("\nfunction failAppLoading(", loaderStart);
const sceneStart = source.indexOf("class LoungeScene extends Phaser.Scene {");
const sceneEnd = source.indexOf("\n}\n", sceneStart) + 2;

function environment(slot3dLoading = false) {
  const timers = [];
  const classes = new Set();
  const graphic = {
    fillStyle() {},
    fillCircle() {},
    lineStyle() {},
    strokeCircle() {},
    generateTexture() {},
    destroy() {},
  };
  const context = {
    Phaser: { Scene: class {} },
    gameRoomConnected: false,
    appLoadingFinishing: false,
    loungeScene: undefined,
    appLoader: {
      classList: {
        contains: (name) => classes.has(name),
        add: (name) => classes.add(name),
      },
      remove() {},
    },
    appLoaderStatus: {},
    appLoaderProgress: { style: {} },
    document: { body: { classList: { add() {} } } },
    window: {
      setTimeout: (callback) => {
        timers.push(callback);
      },
    },
    socket: { connected: true },
    syncGameModeUI() {},
    updateConnection() {},
  };
  vm.createContext(context);
  vm.runInContext(source.slice(loaderStart, loaderEnd), context);
  const Scene = vm.runInContext(
    `${source.slice(sceneStart, sceneEnd)}; LoungeScene`,
    context,
  );
  const scene = Object.create(Scene.prototype);
  Object.assign(scene, {
    add: { graphics: () => graphic },
    make: { graphics: () => graphic },
    drawMode() {
      this.slot3dLoading = slot3dLoading;
    },
  });
  return { context, scene, timers };
}

test("loading completes once regardless of socket and Phaser scene readiness order", () => {
  for (const socketFirst of [true, false]) {
    const { context, scene, timers } = environment();
    if (socketFirst) {
      context.gameRoomConnected = true;
      context.maybeFinishAppLoading();
      assert.equal(timers.length, 0);
    }
    scene.create();
    if (!socketFirst) {
      assert.equal(timers.length, 0);
      context.gameRoomConnected = true;
      context.maybeFinishAppLoading();
    }
    context.maybeFinishAppLoading();
    assert.equal(timers.length, 1);
    assert.equal(context.appLoaderProgress.style.width, "100%");
  }
});

test("loading waits until the optional 3D presentation finishes", () => {
  const { context, scene, timers } = environment(true);
  context.gameRoomConnected = true;
  scene.create();
  assert.equal(timers.length, 0);
  scene.slot3dLoading = false;
  context.maybeFinishAppLoading();
  assert.equal(timers.length, 1);
});
