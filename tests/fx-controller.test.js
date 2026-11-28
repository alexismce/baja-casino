import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../client/fx-controller.js", import.meta.url), "utf8");

function setup({ reduced = false, scale = 1 } = {}) {
  const canvas = {
    id: "",
    className: "",
    dataset: {},
    style: {},
    classList: {
      values: new Set(),
      add(...names) { names.forEach((name) => this.values.add(name)); },
      remove(...names) { names.forEach((name) => this.values.delete(name)); },
    },
    setAttribute() {},
    getContext: () => ({
      setTransform() {},
      clearRect() {},
      save() {},
      restore() {},
      beginPath() {},
      arc() {},
      fill() {},
      stroke() {},
      lineTo() {},
      moveTo() {},
    }),
  };
  const frames = [];
  const listeners = new Map();
  const window = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 2,
    addEventListener: (name, handler) => listeners.set(name, handler),
    LuckyTakeoverFX: undefined,
  };
  vm.runInNewContext(source, {
    window,
    document: { createElement: () => canvas, body: { appendChild() {} } },
    performance: { now: () => 0 },
    requestAnimationFrame: (callback) => { frames.push(callback); return frames.length; },
    cancelAnimationFrame() {},
  });
  const controller = window.LuckyTakeoverFX.create({
    getEffectScale: () => scale,
    isSoundEnabled: () => false,
    getAudioGraph: () => null,
    isReducedMotion: () => reduced,
  });
  return { controller, canvas, frames, listeners };
}

test("takeover activates for full-screen presets and cleans up on stop", () => {
  const { controller, canvas, frames } = setup();
  assert.equal(controller.triggerTakeover({ preset: "bonus", seed: 7 }), true);
  assert.equal(controller.isActive(), true);
  assert.ok(canvas.classList.values.has("active"));
  assert.equal(frames.length, 1);
  frames[0](100);
  controller.stop();
  assert.equal(controller.isActive(), false);
  assert.ok(!canvas.classList.values.has("active"));
});

test("reduced motion and zero intensity suppress takeovers", () => {
  const reduced = setup({ reduced: true });
  assert.equal(reduced.controller.triggerTakeover({ preset: "bonus" }), false);
  const quiet = setup({ scale: 0 });
  assert.equal(quiet.controller.triggerTakeover({ preset: "win" }), false);
});

test("Escape cancels an active takeover", () => {
  const player = setup();
  player.controller.triggerTakeover({ preset: "win" });
  player.listeners.get("keydown")({ key: "Escape" });
  assert.equal(player.controller.isActive(), false);
});
