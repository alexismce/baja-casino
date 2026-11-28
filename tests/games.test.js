import test from "node:test";
import assert from "node:assert/strict";
import { playGame, scoreHand } from "../src/games.js";
import { getSecureRandomNumber } from "../src/rng/fairness.js";
import { getSlotConfiguration } from "../src/rng/slots.js";

function sequenceRandom(values) {
  let index = 0;
  return (max) => values[index++] % max;
}

test("slots render a 5 by 3 grid and award each matching payline", () => {
  const game = playGame({ game: "slots", bet: 10 }, sequenceRandom(Array(24).fill(0)));
  assert.equal(game.result.reels.length, 5);
  assert.ok(game.result.reels.every((reel) => reel.length === 3 && reel.every((symbol) => symbol === "SEVEN")));
  assert.equal(game.result.paylines.length, 10);
  assert.equal(game.result.linePayout, 300);
  assert.deepEqual(game.result.bonusGrid, Array.from({ length: 3 }, () => Array(3).fill("SEVEN")));
  assert.deepEqual(game.result.bonusLines, [
    "row-1", "row-2", "row-3", "column-1", "column-2", "column-3",
  ]);
  assert.equal(game.result.bonusPayout, 60);
  assert.equal(game.payout, 360);
});

test("slots report the configured line wager, crossword matches, and theoretical RTP", () => {
  const configuration = getSlotConfiguration();
  assert.equal(configuration.columns, 5);
  assert.equal(configuration.rows, 3);
  assert.equal(configuration.paylineCount, 10);
  assert.deepEqual(configuration.paytable.SEVEN, { 3: 1, 4: 2, 5: 3 });
  assert.deepEqual(configuration.patternBonus, { rows: 3, columns: 3, payoutPerMatch: 1 });
  assert.ok(Math.abs(configuration.theoreticalRtp - 0.1318320987654321) < 1e-12);
  assert.ok(Math.abs(configuration.fortuneTheoreticalRtp - 0.15599876543209877) < 1e-12);
});

test("Fortune Slots settles a server-selected wheel prize only when triggered", () => {
  const noBonus = playGame({ game: "fortune-slots", bet: 2 }, sequenceRandom([...Array(24).fill(0), 1]));
  assert.deepEqual(noBonus.result.fortuneWheel, { triggered: false, index: null, multiplier: 0, payout: 0 });
  assert.equal(noBonus.payout, 72);

  for (const [index, multiplier] of [1, 2, 3, 5, 8, 10].entries()) {
    const game = playGame({ game: "fortune-slots", bet: 2 }, sequenceRandom([...Array(24).fill(0), 0, index]));
    assert.deepEqual(game.result.fortuneWheel, { triggered: true, index, multiplier, payout: multiplier * 2 });
    assert.equal(game.payout, 72 + multiplier * 2);
  }
});

test("blackjack scoring treats aces as eleven or one to avoid busting", () => {
  assert.equal(scoreHand([{ rank: "A" }, { rank: "9" }]), 20);
  assert.equal(scoreHand([{ rank: "A" }, { rank: "9" }, { rank: "5" }]), 15);
});

test("roulette pays 36 times the bet for an exact number", () => {
  const game = playGame({ game: "roulette", bet: 7, choice: 0 }, sequenceRandom([0]));
  assert.equal(game.result.number, 0);
  assert.equal(game.result.color, "green");
  assert.equal(game.payout, 252);
});

test("coin toss returns twice the bet for the correct call", () => {
  const game = playGame({ game: "coin", bet: 5, choice: "heads" }, sequenceRandom([0]));
  assert.equal(game.result.result, "heads");
  assert.equal(game.payout, 10);
});

test("dice roll pays five times the bet for an exact server-selected face", () => {
  const game = playGame({ game: "dice", bet: 10, choice: 4 }, sequenceRandom([3]));
  assert.equal(game.result.number, 4);
  assert.equal(game.result.choice, 4);
  assert.equal(game.payout, 50);
  assert.match(game.result.message, /5× your bet/);
});

test("dice roll returns no payout for a different face", () => {
  const game = playGame({ game: "dice", bet: 10, choice: 4 }, sequenceRandom([2]));
  assert.equal(game.result.number, 3);
  assert.equal(game.payout, 0);
});

test("secure random number helper includes both bounds", () => {
  for (let index = 0; index < 100; index += 1) {
    const number = getSecureRandomNumber(4, 8);
    assert.ok(number >= 4 && number <= 8);
  }
  assert.equal(getSecureRandomNumber(5, 5), 5);
  assert.throws(() => getSecureRandomNumber(2, 1), RangeError);
});
