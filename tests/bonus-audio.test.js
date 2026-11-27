import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../client/bonus-audio.js", import.meta.url), "utf8");

function setup(voices = [{ localService: true, lang: "en-US" }]) {
  const window = {};
  vm.runInNewContext(source, { window, console });
  const cues = [];
  const spoken = [];
  let cancelled = 0;
  let enabled = true;
  let volume = 0.6;
  const statuses = [];
  const synth = {
    getVoices: () => voices,
    speak: (utterance) => spoken.push(utterance),
    cancel: () => { cancelled += 1; },
  };
  class Utterance { constructor(text) { this.text = text; } }
  const audio = window.LuckyBonusAudio.create({
    synth, Utterance, playCue: (cue) => cues.push(cue),
    isSoundEnabled: () => enabled, getVolume: () => volume, onVoiceStatus: (status) => statuses.push(status),
  });
  return {
    audio, cues, spoken, statuses,
    cancelled: () => cancelled,
    setSound: (value) => { enabled = value; },
    setVolume: (value) => { volume = value; },
  };
}

test("only confirmed bonuses play a fanfare; voice is optional and uses the selected volume", () => {
  const player = setup();
  player.audio.announce({ bonusPayout: 0 });
  assert.deepEqual(player.cues, []);
  player.audio.announce({ bonusPayout: 1 });
  assert.deepEqual(player.cues, ["bonus"]);
  assert.equal(player.spoken.length, 0);
  player.audio.setVoiceEnabled(true);
  player.audio.announce({ bonusPayout: 0, fortuneWheel: { triggered: true } });
  assert.equal(player.spoken[0].text, "Fortune wheel bonus!");
  assert.equal(player.spoken[0].volume, 0.6);
  assert.equal(player.spoken[0].rate, 0.82);
  assert.equal(player.spoken[0].pitch, 1.48);
  player.audio.announce({ bonusPayout: 2, fortuneWheel: { triggered: true } });
  assert.equal(player.spoken[1].text, "Puzzle bonus and fortune wheel bonus!");
  assert.equal(player.cancelled(), 1);
  player.audio.setVoiceEnabled(false);
  assert.equal(player.cancelled(), 2);
});

test("muted sound and zero volume suppress bonus audio; remote voices are not used", () => {
  const player = setup([{ localService: false, lang: "en-US" }]);
  player.audio.setVoiceEnabled(true);
  player.setSound(false);
  player.audio.announce({ bonusPayout: 1 });
  player.setSound(true);
  player.setVolume(0);
  player.audio.announce({ bonusPayout: 1 });
  assert.deepEqual(player.cues, []);
  player.setVolume(0.5);
  player.audio.announce({ bonusPayout: 1 });
  assert.deepEqual(player.cues, ["bonus"]);
  assert.equal(player.spoken.length, 0);
  assert.equal(player.statuses.at(-1), "No on-device English voice available.");
});

test("only a revealed 2× wheel award gets a double announcement and quieter repeat", () => {
  const player = setup();
  player.audio.setVoiceEnabled(true);
  player.audio.announceAward({ triggered: true, multiplier: 3, payout: 6 });
  assert.equal(player.spoken[0].text, "3 times the line bet!");
  player.spoken[0].onend();
  assert.equal(player.spoken.length, 1);
  player.audio.announceAward({ triggered: true, multiplier: 2, payout: 4 });
  assert.match(player.spoken[1].text, /Dooouble/);
  assert.equal(player.spoken[1].rate, 0.72);
  assert.equal(player.spoken[1].pitch, 1.72);
  player.spoken[1].onend();
  assert.equal(player.spoken[2].text, "Double!");
  assert.equal(player.spoken[2].volume, 0.6 * 0.35);
  assert.equal(player.spoken[2].rate, 0.72);
  assert.equal(player.spoken[2].pitch, 0.72);
  player.audio.stopVoice();
  assert.equal(player.cancelled(), 1);
});

test("muting before the voice finishes prevents its repeat", () => {
  const player = setup();
  player.audio.setVoiceEnabled(true);
  player.audio.announceAward({ triggered: true, multiplier: 2, payout: 2 });
  player.setSound(false);
  player.audio.stopVoice();
  player.spoken[0].onend();
  assert.equal(player.spoken.length, 1);
});

test("completed game rounds use original exaggerated arcade announcements", () => {
  const player = setup();
  player.audio.setVoiceEnabled(true);
  player.audio.announceOutcome({
    game: "blackjack",
    outcome: "blackjack",
    net: 15,
    payout: 30,
  });
  assert.equal(player.spoken[0].text, "Blaaackjack! Dealer defeated!");
  assert.equal(player.spoken[0].rate, 0.72);
  assert.equal(player.spoken[0].pitch, 1.75);

  player.audio.announceOutcome({
    game: "poker",
    outcome: "Royal Flush",
    net: 250,
    payout: 250,
  });
  assert.equal(player.spoken[1].text, "Royal Flush! Power hand! 250 credits!");

  player.setSound(false);
  player.audio.announceOutcome({ game: "dice", outcome: "win", net: 25, payout: 30 });
  assert.equal(player.spoken.length, 2);
});
