import test from "node:test";
import assert from "node:assert/strict";
import {
  doubleDownBlackjack,
  hitBlackjack,
  publicBlackjackState,
  splitBlackjack,
  standBlackjack,
  startBlackjack,
} from "../src/blackjack.js";

const card = (rank, suit = "clubs") => ({ rank, suit });

test("blackjack deals a shuffled 52-card deck", () => {
  const hand = startBlackjack(10, () => 0);
  assert.equal(hand.deck.length + hand.player.length + hand.dealer.length, 52);
  const allCards = [...hand.deck, ...hand.player, ...hand.dealer];
  assert.equal(new Set(allCards.map(({ rank, suit }) => `${rank}-${suit}`)).size, 52);
});

test("the dealer hole card stays hidden until the hand is finished", () => {
  const hand = {
    bet: 10,
    deck: [card("K")],
    player: [card("10"), card("8")],
    dealer: [card("10"), card("6")],
    status: "playing",
    outcome: null,
    payout: 0,
  };
  assert.deepEqual(publicBlackjackState(hand).dealer[1], { hidden: true });
  standBlackjack(hand);
  assert.equal(publicBlackjackState(hand).dealer[1].rank, "6");
});

test("a hit that busts is resolved by the server", () => {
  const hand = {
    bet: 10,
    deck: [card("5")],
    player: [card("K"), card("8")],
    dealer: [card("9"), card("7")],
    status: "playing",
    outcome: null,
    payout: 0,
  };
  hitBlackjack(hand);
  assert.equal(hand.status, "finished");
  assert.equal(hand.outcome, "bust");
  assert.equal(hand.payout, 0);
  assert.equal(publicBlackjackState(hand).dealer[1].rank, "7");
});

test("stand makes the dealer draw and awards a server-calculated win", () => {
  const hand = {
    bet: 10,
    deck: [card("K")],
    player: [card("K"), card("8")],
    dealer: [card("10"), card("6")],
    status: "playing",
    outcome: null,
    payout: 0,
  };
  standBlackjack(hand);
  assert.equal(hand.status, "finished");
  assert.equal(hand.outcome, "win");
  assert.equal(hand.payout, 20);
  assert.equal(publicBlackjackState(hand).dealer.length, 3);
});

test("push returns only the original bet and cannot be played again", () => {
  const hand = {
    bet: 10,
    deck: [],
    player: [card("10"), card("8")],
    dealer: [card("10"), card("8")],
    status: "playing",
    outcome: null,
    payout: 0,
  };
  standBlackjack(hand);
  assert.equal(hand.outcome, "push");
  assert.equal(hand.payout, 10);
  assert.throws(() => hitBlackjack(hand), /no active blackjack hand/);
});

test("splitting a pair creates two server-managed hands and settles both", () => {
  const hand = {
    bet: 10,
    deck: [card("6"), card("4"), card("3")],
    player: [card("8", "hearts"), card("8", "spades")],
    dealer: [card("10"), card("6")],
    status: "playing",
    outcome: null,
    payout: 0,
  };
  splitBlackjack(hand);
  assert.equal(hand.hands.length, 2);
  assert.equal(publicBlackjackState(hand, 0).legalActions.includes("split"), false);
  standBlackjack(hand);
  assert.equal(hand.status, "playing");
  standBlackjack(hand);
  assert.equal(hand.status, "finished");
  assert.equal(hand.payout, 40);
  assert.deepEqual(hand.hands.map(({ outcome }) => outcome), ["win", "win"]);
});

test("double down doubles the stake, draws one card, and stands automatically", () => {
  const hand = {
    bet: 10,
    deck: [card("K"), card("5")],
    player: [card("10"), card("6")],
    dealer: [card("10"), card("6")],
    status: "playing",
    outcome: null,
    payout: 0,
  };
  doubleDownBlackjack(hand);
  assert.equal(hand.status, "finished");
  assert.equal(hand.hands[0].bet, 20);
  assert.equal(hand.hands[0].cards.length, 3);
  assert.equal(hand.payout, 40);
});
