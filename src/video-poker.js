import { createShuffledDeck } from "./blackjack.js";

const RANK_VALUE = new Map([
  ["2", 2], ["3", 3], ["4", 4], ["5", 5], ["6", 6], ["7", 7], ["8", 8],
  ["9", 9], ["10", 10], ["J", 11], ["Q", 12], ["K", 13], ["A", 14],
]);
const PAYOUTS = {
  "Royal Flush": 250,
  "Straight Flush": 50,
  "Four of a Kind": 25,
  "Full House": 9,
  Flush: 6,
  Straight: 4,
  "Three of a Kind": 3,
  "Two Pair": 2,
  "Jacks or Better": 1,
  "No Win": 0,
};

function handRank(cards) {
  const values = cards.map(({ rank }) => RANK_VALUE.get(rank)).sort((left, right) => left - right);
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const groups = [...counts.values()].sort((left, right) => right - left);
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const normalStraight = values.every((value, index) => index === 0 || value === values[index - 1] + 1);
  const wheelStraight = values.join(",") === "2,3,4,5,14";
  const straight = normalStraight || wheelStraight;
  const royal = flush && values.join(",") === "10,11,12,13,14";

  if (royal) return "Royal Flush";
  if (flush && straight) return "Straight Flush";
  if (groups[0] === 4) return "Four of a Kind";
  if (groups[0] === 3 && groups[1] === 2) return "Full House";
  if (flush) return "Flush";
  if (straight) return "Straight";
  if (groups[0] === 3) return "Three of a Kind";
  if (groups[0] === 2 && groups[1] === 2) return "Two Pair";
  if ([11, 12, 13, 14].some((value) => counts.get(value) === 2)) return "Jacks or Better";
  return "No Win";
}

export function startVideoPoker(bet, randomInt) {
  const deck = createShuffledDeck(randomInt);
  return {
    bet,
    deck,
    cards: Array.from({ length: 5 }, () => deck.pop()),
    status: "draw",
  };
}

export function drawVideoPoker(hand, holds) {
  if (!hand || hand.status !== "draw") throw new Error("There is no active video poker hand.");
  if (!Array.isArray(holds) || holds.some((index) => !Number.isInteger(index) || index < 0 || index > 4)
    || new Set(holds).size !== holds.length) {
    throw new Error("Choose which cards to hold.");
  }

  const held = new Set(holds);
  hand.cards = hand.cards.map((card, index) => held.has(index) ? card : hand.deck.pop());
  if (hand.cards.some((card) => !card)) throw new Error("The video poker deck is empty.");
  const outcome = handRank(hand.cards);
  hand.status = "finished";
  return {
    hand,
    outcome,
    multiplier: PAYOUTS[outcome],
    payout: hand.bet * PAYOUTS[outcome],
  };
}

export function publicVideoPokerState(hand) {
  if (!hand) return null;
  return {
    bet: hand.bet,
    cards: hand.cards.map(({ rank, suit }, index) => ({ rank, suit, index })),
    status: hand.status,
  };
}
