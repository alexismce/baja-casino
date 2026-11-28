import { randomInt } from "node:crypto";

let SYMBOL_WEIGHTS = {
  SEVEN: 1,
  WATERMELON: 2,
  GRAPES: 3,
  ORANGE: 4,
  CHERRY: 5,
};

const PAYTABLE = Object.freeze({
  SEVEN: Object.freeze({ 3: 1, 4: 2, 5: 3 }),
  WATERMELON: Object.freeze({ 3: 1, 4: 2, 5: 3 }),
  GRAPES: Object.freeze({ 3: 1, 4: 2, 5: 3 }),
  ORANGE: Object.freeze({ 3: 1, 4: 2, 5: 3 }),
  CHERRY: Object.freeze({ 3: 1, 4: 2, 5: 3 }),
});

const PAYLINES = Object.freeze([
  Object.freeze([1, 1, 1, 1, 1]),
  Object.freeze([0, 0, 0, 0, 0]),
  Object.freeze([2, 2, 2, 2, 2]),
  Object.freeze([0, 1, 2, 1, 0]),
  Object.freeze([2, 1, 0, 1, 2]),
  Object.freeze([0, 0, 1, 2, 2]),
  Object.freeze([2, 2, 1, 0, 0]),
  Object.freeze([1, 0, 0, 0, 1]),
  Object.freeze([1, 2, 2, 2, 1]),
  Object.freeze([0, 1, 1, 1, 0]),
]);

const SLOT_COUNT = 5;
const ROW_COUNT = 3;
const BONUS_SIZE = 3;
export const FORTUNE_WHEEL_MULTIPLIERS = Object.freeze([1, 2, 3, 5, 8, 10]);
const FORTUNE_TRIGGER_OUTCOMES = 20;

function createReelStrip(weights) {
  return Object.entries(weights).flatMap(([symbol, weight]) => Array(weight).fill(symbol));
}

function symbolProbabilities(weights) {
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  return Object.values(weights).map((weight) => weight / totalWeight);
}

function calculateTheoreticalRtp(weights) {
  const probabilities = symbolProbabilities(weights);
  const tripleProbability = probabilities.reduce((sum, probability) => sum + probability ** 3, 0);
  const lineRtp = probabilities.reduce((sum, probability) => (
    sum
      + probability ** 3 * (1 - probability)
      + 2 * probability ** 4 * (1 - probability)
      + 3 * probability ** 5
  ), 0);
  const paylineRtp = lineRtp;
  const patternBonusRtp = (BONUS_SIZE * 2 * tripleProbability) / PAYLINES.length;
  return paylineRtp + patternBonusRtp;
}

export function getSlotConfiguration() {
  return {
    weights: { ...SYMBOL_WEIGHTS },
    paytable: Object.fromEntries(
      Object.entries(PAYTABLE).map(([symbol, payouts]) => [symbol, { ...payouts }]),
    ),
    columns: SLOT_COUNT,
    rows: ROW_COUNT,
    paylineCount: PAYLINES.length,
    patternBonus: {
      rows: BONUS_SIZE,
      columns: BONUS_SIZE,
      payoutPerMatch: 1,
    },
    theoreticalRtp: calculateTheoreticalRtp(SYMBOL_WEIGHTS),
    fortuneTheoreticalRtp: calculateTheoreticalRtp(SYMBOL_WEIGHTS)
      + FORTUNE_WHEEL_MULTIPLIERS.reduce((sum, multiplier) => sum + multiplier, 0)
        / FORTUNE_WHEEL_MULTIPLIERS.length / FORTUNE_TRIGGER_OUTCOMES / PAYLINES.length,
  };
}

export function updateSlotWeights(weights) {
  const symbols = Object.keys(SYMBOL_WEIGHTS);
  if (
    !weights
    || typeof weights !== "object"
    || Array.isArray(weights)
    || Object.keys(weights).length !== symbols.length
    || symbols.some((symbol) => !Number.isSafeInteger(weights[symbol]) || weights[symbol] < 1 || weights[symbol] > 100)
  ) {
    throw new TypeError("Provide a whole-number weight from 1 to 100 for every slot symbol.");
  }

  SYMBOL_WEIGHTS = Object.fromEntries(symbols.map((symbol) => [symbol, weights[symbol]]));
  return getSlotConfiguration();
}

function pickSymbol(strip, nextRandomInt) {
  return strip[nextRandomInt(strip.length)];
}

function createGrid(strip, rows, columns, nextRandomInt) {
  return Array.from({ length: rows }, () => (
    Array.from({ length: columns }, () => pickSymbol(strip, nextRandomInt))
  ));
}

function evaluatePaylines(grid, lineBet) {
  const wins = [];
  let payout = 0;

  PAYLINES.forEach((line, index) => {
    const symbol = grid[line[0]][0];
    let matchingCount = 1;
    while (
      matchingCount < SLOT_COUNT
      && grid[line[matchingCount]][matchingCount] === symbol
    ) {
      matchingCount += 1;
    }

    if (matchingCount < 3) return;
    const multiplier = PAYTABLE[symbol][matchingCount];
    const linePayout = multiplier * lineBet;
    payout += linePayout;
    wins.push({
      line: index + 1,
      symbol,
      symbols: matchingCount,
      multiplier,
      payout: linePayout,
      rows: [...line],
    });
  });

  return { wins, payout };
}

function evaluatePatternBonus(grid, lineBet) {
  const matches = [];

  for (let row = 0; row < BONUS_SIZE; row += 1) {
    if (grid[row].every((symbol) => symbol === grid[row][0])) {
      matches.push(`row-${row + 1}`);
    }
  }
  for (let column = 0; column < BONUS_SIZE; column += 1) {
    const symbol = grid[0][column];
    if (grid.every((row) => row[column] === symbol)) {
      matches.push(`column-${column + 1}`);
    }
  }

  return { matches, payout: matches.length * lineBet };
}

export function spinReels(lineBet, nextRandomInt = randomInt) {
  if (!Number.isSafeInteger(lineBet) || lineBet < 1) {
    throw new RangeError("Slot line bet must be a positive whole number.");
  }

  const strip = createReelStrip(SYMBOL_WEIGHTS);
  const grid = createGrid(strip, ROW_COUNT, SLOT_COUNT, nextRandomInt);
  const bonusGrid = createGrid(strip, BONUS_SIZE, BONUS_SIZE, nextRandomInt);
  const paylines = evaluatePaylines(grid, lineBet);
  const patternBonus = evaluatePatternBonus(bonusGrid, lineBet);
  const payout = paylines.payout + patternBonus.payout;
  const messages = [];

  if (paylines.wins.length) {
    messages.push(
      `Payline${paylines.wins.length === 1 ? "" : "s"} ${paylines.wins.map((win) => win.line).join(", ")} paid ${paylines.payout} credits.`,
    );
  }
  if (patternBonus.matches.length) {
    messages.push(
      `Pattern bonus (${patternBonus.matches.join(", ")}): ${patternBonus.payout} credits.`,
    );
  }

  return {
    payout,
    result: {
      reels: Array.from({ length: SLOT_COUNT }, (_, column) => (
        Array.from({ length: ROW_COUNT }, (_, row) => grid[row][column])
      )),
      paylines: paylines.wins,
      linePayout: paylines.payout,
      bonusGrid,
      bonusLines: patternBonus.matches,
      bonusPayout: patternBonus.payout,
      message: messages.join(" ") || "No lines matched. Try another round whenever you like.",
    },
  };
}

export function spinFortuneReels(lineBet, nextRandomInt = randomInt) {
  const spin = spinReels(lineBet, nextRandomInt);
  const triggered = nextRandomInt(FORTUNE_TRIGGER_OUTCOMES) === 0;
  const index = triggered ? nextRandomInt(FORTUNE_WHEEL_MULTIPLIERS.length) : null;
  const multiplier = index === null ? 0 : FORTUNE_WHEEL_MULTIPLIERS[index];
  const payout = multiplier * lineBet;
  return {
    payout: spin.payout + payout,
    result: {
      ...spin.result,
      fortuneWheel: { triggered, index, multiplier, payout },
      message: triggered
        ? `${spin.result.paylines.length || spin.result.bonusLines.length ? spin.result.message : "No paylines or pattern bonus matched."} Fortune Wheel: ${multiplier}× line bet pays ${payout} credits.`
        : spin.result.message,
    },
  };
}
