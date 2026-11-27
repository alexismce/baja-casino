import { getSecureRandomNumber } from "./rng/fairness.js";
import { scoreHand } from "./games.js";

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["clubs", "diamonds", "hearts", "spades"];

export function createShuffledDeck(randomInt = (max) => getSecureRandomNumber(0, max - 1)) {
  const deck = SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })));
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

function drawCard(hand) {
  const card = hand.deck.pop();
  if (!card) throw new Error("Blackjack deck is empty.");
  return card;
}

function settle(hand, outcome, payout) {
  hand.status = "finished";
  hand.outcome = outcome;
  hand.payout = payout;
  for (const playerHand of hand.hands ?? []) {
    playerHand.status = "finished";
    playerHand.outcome = outcome;
    playerHand.payout = payout;
  }
  return hand;
}

function playerHands(hand) {
  if (!Array.isArray(hand.hands)) {
    hand.hands = [{
      cards: hand.player,
      bet: hand.bet,
      status: hand.status,
      outcome: hand.outcome,
      payout: hand.payout,
      fromSplit: false,
    }];
    hand.activeHandIndex = 0;
  }
  return hand.hands;
}

function finishIfComplete(hand) {
  const hands = playerHands(hand);
  const activeHandIndex = hands.findIndex((playerHand) => playerHand.status === "playing");
  if (activeHandIndex !== -1) {
    hand.activeHandIndex = activeHandIndex;
    hand.player = hands[activeHandIndex].cards;
    hand.bet = hands[activeHandIndex].bet;
    return false;
  }

  if (hands.some((playerHand) => playerHand.status === "stood")) {
    while (scoreHand(hand.dealer) < 17) hand.dealer.push(drawCard(hand));
  }
  for (const playerHand of hands) {
    if (playerHand.status === "bust") {
      playerHand.outcome = "bust";
      playerHand.payout = 0;
      continue;
    }
    const playerTotal = scoreHand(playerHand.cards);
    const dealerTotal = scoreHand(hand.dealer);
    if (dealerTotal > 21 || playerTotal > dealerTotal) {
      playerHand.outcome = "win";
      playerHand.payout = playerHand.bet * 2;
    } else if (playerTotal === dealerTotal) {
      playerHand.outcome = "push";
      playerHand.payout = playerHand.bet;
    } else {
      playerHand.outcome = "lose";
      playerHand.payout = 0;
    }
    playerHand.status = "finished";
  }

  hand.status = "finished";
  hand.payout = hands.reduce((total, playerHand) => total + playerHand.payout, 0);
  hand.outcome = hands.length === 1 ? hands[0].outcome : "multiple";
  hand.player = hands[0].cards;
  hand.bet = hands.reduce((total, playerHand) => total + playerHand.bet, 0);
  return true;
}

function settleDealer(hand) {
  const playerHand = playerHands(hand)[hand.activeHandIndex ?? 0];
  playerHand.status = "stood";
  finishIfComplete(hand);
  return hand;
}

export function startBlackjack(bet, randomInt = (max) => getSecureRandomNumber(0, max - 1)) {
  const hand = {
    bet,
    deck: createShuffledDeck(randomInt),
    player: [],
    hands: [],
    activeHandIndex: 0,
    split: false,
    dealer: [],
    status: "playing",
    outcome: null,
    payout: 0,
  };

  hand.player.push(drawCard(hand), drawCard(hand));
  hand.hands = [{
    cards: hand.player,
    bet,
    status: "playing",
    outcome: null,
    payout: 0,
    fromSplit: false,
  }];
  hand.dealer.push(drawCard(hand), drawCard(hand));

  const playerNatural = scoreHand(hand.player) === 21;
  const dealerNatural = scoreHand(hand.dealer) === 21;
  if (playerNatural && dealerNatural) return settle(hand, "push", bet);
  if (playerNatural) return settle(hand, "blackjack", Math.floor(bet * 2.5));
  if (dealerNatural) return settle(hand, "lose", 0);
  return hand;
}

export function hitBlackjack(hand) {
  if (hand.status !== "playing") throw new Error("There is no active blackjack hand.");
  const playerHand = playerHands(hand)[hand.activeHandIndex ?? 0];
  if (playerHand?.status !== "playing") throw new Error("There is no active blackjack hand.");
  playerHand.cards.push(drawCard(hand));
  hand.player = playerHand.cards;
  if (scoreHand(playerHand.cards) > 21) {
    playerHand.status = "bust";
    finishIfComplete(hand);
  }
  return hand;
}

export function standBlackjack(hand) {
  if (hand.status !== "playing") throw new Error("There is no active blackjack hand.");
  return settleDealer(hand);
}

export function splitBlackjack(hand) {
  if (hand.status !== "playing") throw new Error("There is no active blackjack hand.");
  const hands = playerHands(hand);
  const playerHand = hands[hand.activeHandIndex ?? 0];
  if (hand.split || hands.length !== 1 || playerHand.cards.length !== 2
    || playerHand.cards[0].rank !== playerHand.cards[1].rank) {
    throw new Error("You can split only an unsplit pair.");
  }

  const [first, second] = playerHand.cards;
  const firstHand = { cards: [first], bet: playerHand.bet, status: "playing", outcome: null, payout: 0, fromSplit: true };
  const secondHand = { cards: [second], bet: playerHand.bet, status: "playing", outcome: null, payout: 0, fromSplit: true };
  firstHand.cards.push(drawCard(hand));
  secondHand.cards.push(drawCard(hand));
  if (first.rank === "A") {
    firstHand.status = "stood";
    secondHand.status = "stood";
  }
  hand.hands = [firstHand, secondHand];
  hand.split = true;
  hand.activeHandIndex = firstHand.status === "playing" ? 0 : 1;
  hand.player = hand.hands[hand.activeHandIndex].cards;
  finishIfComplete(hand);
  return hand;
}

export function doubleDownBlackjack(hand) {
  if (hand.status !== "playing") throw new Error("There is no active blackjack hand.");
  const playerHand = playerHands(hand)[hand.activeHandIndex ?? 0];
  if (!playerHand || playerHand.status !== "playing" || playerHand.cards.length !== 2) {
    throw new Error("Double down is available only on your first two cards.");
  }
  playerHand.bet *= 2;
  playerHand.cards.push(drawCard(hand));
  hand.player = playerHand.cards;
  playerHand.status = scoreHand(playerHand.cards) > 21 ? "bust" : "stood";
  finishIfComplete(hand);
  return hand;
}

export function publicBlackjackState(hand, balance = 0) {
  const finished = hand.status === "finished";
  const hands = playerHands(hand);
  const activeHandIndex = hand.activeHandIndex ?? 0;
  const activeHand = hands[activeHandIndex];
  const legalActions = [];
  if (!finished && activeHand?.status === "playing") {
    legalActions.push("hit", "stand");
    if (!hand.split && hands.length === 1 && activeHand.cards.length === 2
      && activeHand.cards[0].rank === activeHand.cards[1].rank && balance >= activeHand.bet) {
      legalActions.push("split");
    }
    if (activeHand.cards.length === 2 && balance >= activeHand.bet) legalActions.push("double");
  }
  return {
    player: (activeHand?.cards ?? hand.player).map(({ rank, suit }) => ({ rank, suit })),
    hands: hands.map((playerHand) => ({
      cards: playerHand.cards.map(({ rank, suit }) => ({ rank, suit })),
      bet: playerHand.bet,
      status: playerHand.status,
      outcome: playerHand.outcome,
      total: scoreHand(playerHand.cards),
    })),
    activeHandIndex,
    legalActions,
    dealer: hand.dealer.map(({ rank, suit }, index) => (
      finished || index !== 1 ? { rank, suit } : { hidden: true }
    )),
    status: hand.status,
    outcome: hand.outcome,
    payout: hand.payout,
  };
}
