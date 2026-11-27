import test from "node:test";
import assert from "node:assert/strict";
import { drawVideoPoker, publicVideoPokerState, startVideoPoker } from "../src/video-poker.js";

const card = (rank, suit = "hearts") => ({ rank, suit });

test("video poker deals five unique cards from a shuffled deck", () => {
  const hand = startVideoPoker(10, () => 0);
  assert.equal(hand.cards.length, 5);
  assert.equal(hand.deck.length, 47);
  assert.equal(new Set([...hand.cards, ...hand.deck].map(({ rank, suit }) => `${rank}-${suit}`)).size, 52);
  assert.equal(publicVideoPokerState(hand).status, "draw");
});

test("holding a royal flush returns the configured payout and completes the hand", () => {
  const hand = {
    bet: 2,
    deck: [],
    cards: [card("10"), card("J"), card("Q"), card("K"), card("A")],
    status: "draw",
  };
  const result = drawVideoPoker(hand, [0, 1, 2, 3, 4]);
  assert.equal(result.outcome, "Royal Flush");
  assert.equal(result.multiplier, 250);
  assert.equal(result.payout, 500);
  assert.equal(hand.status, "finished");
  assert.throws(() => drawVideoPoker(hand, []), /no active video poker hand/);
});

test("video poker rejects invalid or duplicate hold positions", () => {
  const hand = { bet: 5, deck: [], cards: Array(5).fill(card("2")), status: "draw" };
  assert.throws(() => drawVideoPoker(hand, [1, 1]), /Choose which cards to hold/);
  assert.throws(() => drawVideoPoker(hand, [5]), /Choose which cards to hold/);
});
