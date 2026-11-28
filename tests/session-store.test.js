import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSessionStore } from "../src/session-store.js";

test("persists balances and an active blackjack hand when the database is reopened", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "lucky-lounge-db-"));
  const databasePath = path.join(directory, "casino.db");
  const hand = {
    bet: 25,
    deck: [{ rank: "A", suit: "spades" }],
    player: [{ rank: "10", suit: "hearts" }, { rank: "8", suit: "clubs" }],
    dealer: [{ rank: "9", suit: "diamonds" }, { rank: "7", suit: "spades" }],
    status: "playing",
    outcome: null,
    payout: 0,
  };
  const poker = {
    bet: 10,
    deck: [{ rank: "A", suit: "spades" }],
    cards: [{ rank: "10", suit: "hearts" }],
    status: "draw",
  };

  try {
    const firstStore = createSessionStore(new Database(databasePath));
    firstStore.create("test-session", 975, 1234);
    firstStore.update("test-session", { balance: 975, blackjack: hand, poker });
    firstStore.close();

    const reopenedStore = createSessionStore(new Database(databasePath));
    const persistedSession = reopenedStore.get("test-session");
    reopenedStore.close();
    assert.deepEqual(persistedSession, {
      id: "test-session",
      userId: null,
      balance: 975,
      createdAt: 1234,
      blackjack: hand,
      poker,
      account: null,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("migrates a legacy SQLite schema with active sessions and accounts", () => {
  const database = new Database(":memory:");
  database.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      balance INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      blackjack_state TEXT
    );
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      balance INTEGER NOT NULL,
      best_balance INTEGER NOT NULL DEFAULT 1000,
      games_played INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      slots_played INTEGER NOT NULL DEFAULT 0,
      blackjack_played INTEGER NOT NULL DEFAULT 0,
      roulette_played INTEGER NOT NULL DEFAULT 0,
      coin_played INTEGER NOT NULL DEFAULT 0,
      blackjack_state TEXT,
      leaderboard_opt_in INTEGER NOT NULL DEFAULT 0,
      last_daily_reward_day TEXT,
      created_at INTEGER NOT NULL
    );
    INSERT INTO sessions (id, balance, created_at)
    VALUES ('legacy-session', 725, 1234);
  `);

  const store = createSessionStore(database);
  try {
    const sessionColumns = new Set(database.pragma("table_info(sessions)").map(({ name }) => name));
    const userColumns = new Set(database.pragma("table_info(users)").map(({ name }) => name));
    assert.ok(sessionColumns.has("user_id"));
    assert.ok(sessionColumns.has("poker_state"));
    assert.ok(userColumns.has("poker_played"));
    assert.ok(userColumns.has("dice_played"));
    assert.ok(userColumns.has("poker_state"));
    assert.equal(store.get("legacy-session").balance, 725);
    assert.equal(store.get("legacy-session").poker, null);
    assert.deepEqual(
      database.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'game_receipts'").get(),
      { count: 1 },
    );
  } finally {
    store.close();
  }
});

test("database health reports malformed persisted state without breaking session reads", () => {
  const database = new Database(":memory:");
  const store = createSessionStore(database);
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    store.create("damaged-state", 1000, 1234);
    database.prepare("UPDATE sessions SET blackjack_state = ?, poker_state = ? WHERE id = ?")
      .run("{broken", "{also-broken", "damaged-state");

    const session = store.get("damaged-state");
    const health = store.databaseHealth();

    assert.equal(session.blackjack, null);
    assert.equal(session.poker, null);
    assert.equal(health.ok, false);
    assert.equal(health.malformedState, 1);
    assert.equal(warnings.length, 2);
  } finally {
    console.warn = originalWarn;
    store.close();
  }
});

test("enables foreign key enforcement for session stores", () => {
  const store = createSessionStore(new Database(":memory:"));
  try {
    assert.equal(store.databaseHealth().foreignKeysEnabled, true);
  } finally {
    store.close();
  }
});

test("admin credit adjustments update the account and record an audit entry", () => {
  const database = new Database(":memory:");
  const store = createSessionStore(database);
  try {
    store.create("credit-guest", 1000, 1234);
    store.register({
      anonymousSessionId: "credit-guest",
      sessionId: "credit-session",
      userId: "credit-user",
      email: "credit@example.test",
      passwordSalt: "salt",
      passwordHash: "hash",
      displayName: "Credit User",
      leaderboardOptIn: false,
      createdAt: 1235,
    });

    const adjustment = store.adminAddUserCredits({
      email: "credit@example.test",
      amount: 250,
      note: "Support adjustment",
    });
    assert.deepEqual(adjustment, {
      email: "credit@example.test",
      displayName: "Credit User",
      balanceBefore: 1000,
      amount: 250,
      balanceAfter: 1250,
    });
    assert.equal(store.get("credit-session").balance, 1250);
    assert.deepEqual(
      database.prepare(`
        SELECT amount, balance_before AS balanceBefore, balance_after AS balanceAfter, note
        FROM admin_credit_adjustments
        WHERE user_id = ?
      `).get("credit-user"),
      { amount: 250, balanceBefore: 1000, balanceAfter: 1250, note: "Support adjustment" },
    );
    assert.deepEqual(store.adminAddUserCredits({
      email: "missing@example.test",
      amount: 10,
    }), { error: "No user account matches that email." });
  } finally {
    store.close();
  }
});

test("rolls back wallet and hand changes when a transaction fails", () => {
  const store = createSessionStore(new Database(":memory:"));
  try {
    store.create("rollback-session", 1000, 1234);
    assert.throws(() => store.transaction(() => {
      store.update("rollback-session", { balance: 900, blackjack: null });
      throw new Error("force rollback");
    }), /force rollback/);
    assert.equal(store.get("rollback-session").balance, 1000);
  } finally {
    store.close();
  }
});

test("simulated wallet balance and history roll back together when recording fails", () => {
  const database = new Database(":memory:");
  const store = createSessionStore(database);
  try {
    store.create("wallet-guest", 1000, 1234);
    store.register({
      anonymousSessionId: "wallet-guest", sessionId: "wallet-session", userId: "wallet-user",
      email: "wallet@example.test", passwordSalt: "salt", passwordHash: "hash",
      displayName: "Wallet User", leaderboardOptIn: false, createdAt: 1235,
    });
    database.exec("CREATE TRIGGER reject_wallet_entry BEFORE INSERT ON demo_wallet_transactions BEGIN SELECT RAISE(ABORT, 'record failed'); END");
    assert.throws(() => store.demoWalletTransfer("wallet-session", {
      requestId: "rollback", kind: "deposit", method: "paypal", amount: 100,
    }), /record failed/);
    assert.equal(store.get("wallet-session").balance, 1000);
    assert.deepEqual(store.demoWalletHistory("wallet-session"), []);
  } finally {
    store.close();
  }
});

test("unlocks the Slots pattern badge without requiring a wager milestone", () => {
  const store = createSessionStore(new Database(":memory:"));
  try {
    store.create("pattern-guest", 1000, 1234);
    store.register({
      anonymousSessionId: "pattern-guest",
      sessionId: "pattern-account-session",
      userId: "pattern-player",
      email: "pattern@example.test",
      passwordSalt: "salt",
      passwordHash: "hash",
      displayName: "Pattern Player",
      leaderboardOptIn: false,
      createdAt: 1235,
    });

    const result = store.recordGame("pattern-account-session", {
      balance: 990,
      gameResult: { game: "slots", won: false, patternBonus: true },
    });
    assert.ok(result.newAchievements.includes("pattern-finder"));
    assert.ok(result.session.account.achievements.includes("pattern-finder"));

    const repeated = store.recordGame("pattern-account-session", {
      balance: 980,
      gameResult: { game: "slots", won: false, patternBonus: true },
    });
    assert.equal(repeated.newAchievements.includes("pattern-finder"), false);
  } finally {
    store.close();
  }
});

test("records Dice Roll progress and includes it in three-game achievements", () => {
  const store = createSessionStore(new Database(":memory:"));
  try {
    store.create("dice-guest", 1000, 1234);
    store.register({
      anonymousSessionId: "dice-guest",
      sessionId: "dice-account-session",
      userId: "dice-player",
      email: "dice@example.test",
      passwordSalt: "salt",
      passwordHash: "hash",
      displayName: "Dice Player",
      leaderboardOptIn: false,
      createdAt: 1235,
    });

    store.recordGame("dice-account-session", {
      balance: 999,
      gameResult: { game: "coin", won: false },
    });
    store.recordGame("dice-account-session", {
      balance: 998,
      gameResult: { game: "roulette", won: false },
    });
    const dice = store.recordGame("dice-account-session", {
      balance: 997,
      gameResult: { game: "dice", won: false },
    });

    assert.equal(dice.session.account.games.dice, 1);
    assert.equal(dice.session.account.gamesPlayed, 3);
    assert.ok(dice.session.account.achievements.includes("game-explorer"));
  } finally {
    store.close();
  }
});

test("game receipt persistence rolls back with the balance mutation", () => {
  const database = new Database(":memory:");
  const store = createSessionStore(database);
  try {
    store.create("receipt-session", 1000, 1234);
    database.exec("CREATE TRIGGER reject_receipt BEFORE INSERT ON game_receipts BEGIN SELECT RAISE(ABORT, 'receipt failed'); END");
    assert.throws(() => store.transaction(() => {
      store.update("receipt-session", { balance: 990 });
      store.saveGameReceipt({
        scopeId: "session:receipt-session",
        requestId: "receipt-rollback",
        commandType: "instant-game:coin",
        payloadHash: "hash",
        response: { balance: 990, payout: 0 },
        createdAt: 1235,
      });
    }), /receipt failed/);
    assert.equal(store.get("receipt-session").balance, 1000);
    assert.equal(store.getGameReceipt("session:receipt-session", "receipt-rollback"), null);
  } finally {
    store.close();
  }
});
