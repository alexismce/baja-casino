import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../public/soundtracks.js", import.meta.url), "utf8");

function setup(initialValue) {
  const saved = new Map(initialValue === undefined ? [] : [["lucky-lounge-soundtrack", initialValue]]);
  const window = {
    localStorage: {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
    },
  };
  vm.runInNewContext(source, { window, console });
  let handler;
  const select = {
    value: "",
    addEventListener: (event, callback) => {
      assert.equal(event, "change");
      handler = callback;
    },
  };
  let changes = 0;
  const getTrack = window.LuckySoundtracks.bind(select, () => { changes += 1; });
  return { saved, select, getTrack, soundtracks: window.LuckySoundtracks, change: () => handler(), changes: () => changes };
}

test("soundtracks restore a valid selection and save changes for the other page", () => {
  const player = setup("velvet");
  assert.equal(player.select.value, "velvet");
  assert.equal(player.getTrack().interval, 660);
  player.select.value = "midnight";
  player.change();
  assert.equal(player.saved.get("lucky-lounge-soundtrack"), "midnight");
  assert.equal(player.getTrack().interval, 450);
  assert.equal(player.changes(), 1);
});

test("arrangements change with game and state, adding bass and rhythm", () => {
  const player = setup("arcade");
  const track = player.getTrack();
  const { getStep } = player.soundtracks;
  const idle = getStep(track, 2, "slots", "idle");
  const active = getStep(track, 2, "slots", "active");
  const table = getStep(track, 2, "blackjack", "idle");
  const bonus = getStep(track, 3, "slots", "bonus");
  assert.notEqual(idle[0].frequency, table[0].frequency);
  assert.ok(active.some((voice) => voice.frequency < 200));
  assert.ok(active.length > idle.length);
  assert.ok(bonus.some((voice) => voice.frequency === 1046.5));
});

test("unknown stored or selected soundtracks do not become active", () => {
  const player = setup("missing");
  assert.equal(player.select.value, "lounge");
  player.select.value = "missing";
  player.change();
  assert.equal(player.select.value, "lounge");
  assert.equal(player.getTrack().interval, 540);
  assert.equal(player.changes(), 0);
});

test("arcade soundtracks are selectable and persist across pages", () => {
  const player = setup();
  for (const [name, wave] of [["arcade", "square"], ["neon", "triangle"]]) {
    player.select.value = name;
    player.change();
    assert.equal(player.saved.get("lucky-lounge-soundtrack"), name);
    assert.equal(player.getTrack().wave, wave);
    assert.ok(player.getTrack().notes.length > 0);
    assert.equal(setup(name).select.value, name);
  }
});
