import { getSecureRandomNumber } from "./rng/fairness.js";
import { spinFortuneReels, spinReels } from "./rng/slots.js";

const ROULETTE_RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function cardValue(rank) {
  if (rank === "A") return 11;
  if (["K", "Q", "J"].includes(rank)) return 10;
  return Number(rank);
}

export function scoreHand(cards) {
  let total = cards.reduce((sum, card) => sum + cardValue(card.rank), 0);
  let aces = cards.filter((card) => card.rank === "A").length;

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function playSlots(randomInt, bet) {
  return spinReels(bet, randomInt);
}

function playRoulette(randomInt, bet, choice) {
  const number = randomInt(37);
  const won = number === choice;

  return {
    payout: won ? bet * 36 : 0,
    result: {
      number,
      color: number === 0 ? "green" : ROULETTE_RED_NUMBERS.has(number) ? "red" : "black",
      choice,
      message: won ? `Exact hit! Number ${number} pays 35:1.` : `The ball landed on ${number}.`,
    },
  };
}

function playCoinFlip(randomInt, bet, choice) {
  const result = randomInt(2) === 0 ? "heads" : "tails";
  const won = result === choice;

  return {
    payout: won ? bet * 2 : 0,
    result: {
      result,
      choice,
      message: won ? `It's ${result} — you win!` : `It's ${result} this time.`,
    },
  };
}

function playDiceRoll(randomInt, bet, choice) {
  const number = randomInt(6) + 1;
  const won = number === choice;

  return {
    payout: won ? bet * 5 : 0,
    result: {
      number,
      choice,
      message: won
        ? `Exact hit! A ${number} returns 5× your bet, including the stake.`
        : `The die landed on ${number}. You picked ${choice}.`,
    },
  };
}

export function playGame({ game, bet, choice }, randomInt = (max) => getSecureRandomNumber(0, max - 1)) {
  switch (game) {
    case "slots":
      return playSlots(randomInt, bet);
    case "fortune-slots":
      return spinFortuneReels(bet, randomInt);
    case "roulette":
      return playRoulette(randomInt, bet, choice);
    case "coin":
      return playCoinFlip(randomInt, bet, choice);
    case "dice":
      return playDiceRoll(randomInt, bet, choice);
    default:
      throw new Error("Unsupported game.");
  }
}
