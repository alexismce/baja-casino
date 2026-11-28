import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultDatabasePath = fileURLToPath(new URL("../data/casino.db", import.meta.url));

function openDatabase() {
  const databasePath = path.resolve(process.env.DATABASE_PATH ?? defaultDatabasePath);
  mkdirSync(path.dirname(databasePath), { recursive: true });
  return new Database(databasePath);
}

export function createSessionStore(database = openDatabase()) {
  database.pragma("journal_mode = WAL");
  database.pragma("busy_timeout = 5000");
  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      balance INTEGER NOT NULL CHECK (balance >= 0),
      created_at INTEGER NOT NULL,
      blackjack_state TEXT
    )
  `);
  const sessionColumns = new Set(database.pragma("table_info(sessions)").map((column) => column.name));
  if (!sessionColumns.has("user_id")) {
    database.exec("ALTER TABLE sessions ADD COLUMN user_id TEXT REFERENCES users(id)");
  }
  if (!sessionColumns.has("poker_state")) database.exec("ALTER TABLE sessions ADD COLUMN poker_state TEXT");
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      balance INTEGER NOT NULL CHECK (balance >= 0),
      best_balance INTEGER NOT NULL DEFAULT 1000,
      games_played INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      slots_played INTEGER NOT NULL DEFAULT 0,
      blackjack_played INTEGER NOT NULL DEFAULT 0,
      roulette_played INTEGER NOT NULL DEFAULT 0,
      coin_played INTEGER NOT NULL DEFAULT 0,
      dice_played INTEGER NOT NULL DEFAULT 0,
      blackjack_state TEXT,
      poker_played INTEGER NOT NULL DEFAULT 0,
      poker_state TEXT,
      leaderboard_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (leaderboard_opt_in IN (0, 1)),
      last_daily_reward_day TEXT,
      created_at INTEGER NOT NULL
    )
  `);
  const userColumns = new Set(database.pragma("table_info(users)").map((column) => column.name));
  if (!userColumns.has("poker_played")) database.exec("ALTER TABLE users ADD COLUMN poker_played INTEGER NOT NULL DEFAULT 0");
  if (!userColumns.has("dice_played")) database.exec("ALTER TABLE users ADD COLUMN dice_played INTEGER NOT NULL DEFAULT 0");
  if (!userColumns.has("poker_state")) database.exec("ALTER TABLE users ADD COLUMN poker_state TEXT");
  database.exec("CREATE INDEX IF NOT EXISTS users_leaderboard_idx ON users (leaderboard_opt_in, best_balance DESC)");
  database.exec(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_id TEXT NOT NULL,
      unlocked_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, achievement_id)
    )
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS demo_wallet_transactions (
      id INTEGER PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      request_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('deposit', 'withdrawal')),
      method TEXT NOT NULL CHECK (method IN ('paypal', 'bank')),
      amount INTEGER NOT NULL CHECK (amount BETWEEN 1 AND 10000),
      balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
      created_at INTEGER NOT NULL,
      UNIQUE (user_id, request_id)
    )
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS game_receipts (
      id INTEGER PRIMARY KEY,
      scope_id TEXT NOT NULL,
      request_id TEXT NOT NULL,
      command_type TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      response_json TEXT NOT NULL CHECK (json_valid(response_json)),
      balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
      created_at INTEGER NOT NULL,
      UNIQUE (scope_id, request_id)
    )
  `);
  database.exec("CREATE INDEX IF NOT EXISTS game_receipts_created_idx ON game_receipts (created_at)");
  database.exec(`
    CREATE TABLE IF NOT EXISTS admin_credit_adjustments (
      id INTEGER PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      amount INTEGER NOT NULL CHECK (amount BETWEEN 1 AND 100000),
      balance_before INTEGER NOT NULL CHECK (balance_before >= 0),
      balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
      note TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  const selectSession = database.prepare(`
    SELECT
      s.id,
      s.balance AS session_balance,
      s.created_at AS session_created_at,
      s.blackjack_state AS session_blackjack_state,
      s.poker_state AS session_poker_state,
      s.user_id,
      u.email,
      u.display_name,
      u.balance AS user_balance,
      u.best_balance,
      u.games_played,
      u.wins,
      u.slots_played,
      u.blackjack_played,
      u.roulette_played,
      u.coin_played,
      u.dice_played,
      u.blackjack_state AS user_blackjack_state,
      u.poker_played,
      u.poker_state AS user_poker_state,
      u.leaderboard_opt_in,
      u.last_daily_reward_day
    FROM sessions s
    LEFT JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `);
  const insertSession = database.prepare(`
    INSERT INTO sessions (id, balance, created_at, blackjack_state, user_id, poker_state)
    VALUES (?, ?, ?, NULL, NULL, NULL)
  `);
  const insertAccountSession = database.prepare(`
    INSERT INTO sessions (id, balance, created_at, blackjack_state, user_id, poker_state)
    VALUES (?, 0, ?, NULL, ?, NULL)
  `);
  const deleteSession = database.prepare("DELETE FROM sessions WHERE id = ?");
  const getUserByEmail = database.prepare(`
    SELECT id, email, password_salt, password_hash
    FROM users
    WHERE email = ?
  `);
  const insertUser = database.prepare(`
    INSERT INTO users (id, email, password_salt, password_hash, display_name, balance, best_balance, leaderboard_opt_in, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertDemoAdmin = database.prepare(`
    INSERT OR IGNORE INTO users (
      id, email, password_salt, password_hash, display_name,
      balance, best_balance, leaderboard_opt_in, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertDemoAdmin.run(
    "demo-admin-user",
    "admin@luckylounge.demo",
    "24d226fc4de24dbcc6e954e4a9f01463",
    "46fb472b7d416fc99c83c928c4b55a66e194affb108c3c5fecc9c927750f9f4ea43f566ad871da4dc2e634125d1017d950a4e5ba1e1792d2345af8c4d3a69d23",
    "Demo Admin",
    10000,
    10000,
    0,
    Date.now(),
  );
  const updateGuest = database.prepare(`
    UPDATE sessions
    SET balance = ?, blackjack_state = ?, poker_state = ?
    WHERE id = ? AND user_id IS NULL
  `);
  const updateUser = database.prepare(`
    UPDATE users SET
      balance = ?,
      blackjack_state = ?,
      poker_state = ?,
      best_balance = MAX(best_balance, ?),
      games_played = games_played + ?,
      wins = wins + ?,
      slots_played = slots_played + ?,
      blackjack_played = blackjack_played + ?,
      roulette_played = roulette_played + ?,
      coin_played = coin_played + ?,
      dice_played = dice_played + ?,
      poker_played = poker_played + ?
    WHERE id = ?
  `);
  const addAchievement = database.prepare(`
    INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at)
    VALUES (?, ?, ?)
  `);
  const selectAchievements = database.prepare(`
    SELECT achievement_id
    FROM user_achievements
    WHERE user_id = ?
    ORDER BY unlocked_at, achievement_id
  `);
  const selectLeaderboard = database.prepare(`
    SELECT display_name AS displayName, best_balance AS bestBalance
    FROM users
    WHERE leaderboard_opt_in = 1
    ORDER BY best_balance DESC, display_name COLLATE NOCASE ASC
    LIMIT ?
  `);
  const updateProfileStatement = database.prepare(`
    UPDATE users SET display_name = ?, leaderboard_opt_in = ?
    WHERE id = ?
  `);
  const claimDailyRewardStatement = database.prepare(`
    UPDATE users
    SET balance = balance + ?, best_balance = MAX(best_balance, balance + ?), last_daily_reward_day = ?
    WHERE id = ? AND (last_daily_reward_day IS NULL OR last_daily_reward_day <> ?)
  `);
  const selectWalletTransaction = database.prepare(`
    SELECT kind, method, amount, balance_after AS balanceAfter, created_at AS createdAt
    FROM demo_wallet_transactions WHERE user_id = ? AND request_id = ?
  `);
  const selectWalletHistory = database.prepare(`
    SELECT kind, method, amount, balance_after AS balanceAfter, created_at AS createdAt
    FROM demo_wallet_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 20
  `);
  const insertWalletTransaction = database.prepare(`
    INSERT INTO demo_wallet_transactions (user_id, request_id, kind, method, amount, balance_after, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const aggregateWalletCredits = database.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN user_id IS NULL THEN balance ELSE 0 END), 0)
      + COALESCE((SELECT SUM(balance) FROM users), 0) AS total
    FROM sessions
  `);
  const guestExposureRows = database.prepare(`
    SELECT balance, blackjack_state, poker_state
    FROM sessions
    WHERE user_id IS NULL
  `);
  const accountExposureRows = database.prepare(`
    SELECT balance, blackjack_state, poker_state
    FROM users
  `);
  const adminListUsers = database.prepare(`
    SELECT id, email, display_name AS displayName, balance, best_balance AS bestBalance, created_at AS createdAt
    FROM users
    WHERE email LIKE ? OR display_name LIKE ?
    ORDER BY display_name COLLATE NOCASE ASC
    LIMIT 50
  `);
  const adminFindUser = database.prepare(`
    SELECT id, email, display_name AS displayName, balance
    FROM users
    WHERE email = ?
  `);
  const adminAddCredits = database.prepare(`
    UPDATE users
    SET balance = ?, best_balance = MAX(best_balance, ?)
    WHERE id = ?
  `);
  const insertAdminCreditAdjustment = database.prepare(`
    INSERT INTO admin_credit_adjustments (
      user_id, amount, balance_before, balance_after, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const selectGameReceipt = database.prepare(`
    SELECT command_type AS commandType, payload_hash AS payloadHash, response_json AS responseJson,
      balance_after AS balanceAfter, created_at AS createdAt
    FROM game_receipts
    WHERE scope_id = ? AND request_id = ?
  `);
  const insertGameReceipt = database.prepare(`
    INSERT INTO game_receipts (
      scope_id, request_id, command_type, payload_hash, response_json, balance_after, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  function parseStoredState(serialized, owner, field) {
    if (!serialized) return null;
    try {
      return JSON.parse(serialized);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      console.warn(`Ignoring invalid persisted ${field} for ${owner}.`);
      return null;
    }
  }

  function get(id) {
    if (!id) return undefined;
    const row = selectSession.get(id);
    if (!row) return undefined;

    return {
      id: row.id,
      userId: row.user_id ?? null,
      balance: row.user_id ? row.user_balance : row.session_balance,
      createdAt: row.session_created_at,
      blackjack: parseStoredState(
        row.user_id ? row.user_blackjack_state : row.session_blackjack_state,
        row.user_id ? `user ${row.user_id}` : `session ${row.id}`,
        "blackjack state",
      ),
      poker: parseStoredState(
        row.user_id ? row.user_poker_state : row.session_poker_state,
        row.user_id ? `user ${row.user_id}` : `session ${row.id}`,
        "video poker state",
      ),
      account: row.user_id ? {
        email: row.email,
        displayName: row.display_name,
        bestBalance: row.best_balance,
        gamesPlayed: row.games_played,
        wins: row.wins,
        games: {
          slots: row.slots_played,
          blackjack: row.blackjack_played,
          roulette: row.roulette_played,
          coin: row.coin_played,
          dice: row.dice_played,
          poker: row.poker_played,
        },
        leaderboardOptIn: Boolean(row.leaderboard_opt_in),
        lastDailyRewardDay: row.last_daily_reward_day,
        achievements: selectAchievements.all(row.user_id).map((achievement) => achievement.achievement_id),
      } : null,
    };
  }

  function getByEmail(email) {
    return getUserByEmail.get(email);
  }

  function persist(session, changes) {
    const { balance, gameResult } = changes;
    const blackjack = Object.hasOwn(changes, "blackjack") ? changes.blackjack : session.blackjack;
    const poker = Object.hasOwn(changes, "poker") ? changes.poker : session.poker;
    const serializedHand = blackjack ? JSON.stringify(blackjack) : null;
    const serializedPokerHand = poker ? JSON.stringify(poker) : null;
    if (!session.userId) {
      const result = updateGuest.run(balance, serializedHand, serializedPokerHand, session.id);
      if (result.changes !== 1) throw new Error("Cannot update a missing guest session.");
      return { session: get(session.id), newAchievements: [] };
    }

    const completed = gameResult ? 1 : 0;
    const result = updateUser.run(
      balance,
      serializedHand,
      serializedPokerHand,
      balance,
      completed,
      gameResult?.won ? 1 : 0,
      ["slots", "fortune-slots"].includes(gameResult?.game) ? 1 : 0,
      gameResult?.game === "blackjack" ? 1 : 0,
      gameResult?.game === "roulette" ? 1 : 0,
      gameResult?.game === "coin" ? 1 : 0,
      gameResult?.game === "dice" ? 1 : 0,
      gameResult?.game === "poker" ? 1 : 0,
      session.userId,
    );
    if (result.changes !== 1) throw new Error("Cannot update a missing player account.");

    const user = selectSession.get(session.id);
    const unlocked = [];
    if (gameResult) {
      const gameTypesPlayed = ["slots_played", "blackjack_played", "roulette_played", "coin_played", "dice_played", "poker_played"]
        .filter((column) => user[column] > 0).length;
      const candidates = [
        [user.games_played >= 1, "first-game"],
        [user.games_played >= 10, "ten-games"],
        [user.wins >= 1, "first-win"],
        [gameTypesPlayed >= 3, "game-explorer"],
        [gameResult.patternBonus === true, "pattern-finder"],
      ];
      for (const [eligible, achievementId] of candidates) {
        if (eligible && addAchievement.run(session.userId, achievementId, Date.now()).changes === 1) {
          unlocked.push(achievementId);
        }
      }
    }

    return { session: get(session.id), newAchievements: unlocked };
  }

  return {
    get,
    getByEmail,
    create(id, balance, createdAt) {
      insertSession.run(id, balance, createdAt);
      return get(id);
    },
    register({ anonymousSessionId, sessionId, userId, email, passwordSalt, passwordHash, displayName, leaderboardOptIn, createdAt }) {
      return database.transaction(() => {
        const anonymous = get(anonymousSessionId);
        if (!anonymous || anonymous.userId) throw new Error("A guest session is required to create an account.");
        insertUser.run(userId, email, passwordSalt, passwordHash, displayName, anonymous.balance, anonymous.balance, leaderboardOptIn ? 1 : 0, createdAt);
        insertAccountSession.run(sessionId, createdAt, userId);
        deleteSession.run(anonymousSessionId);
        return get(sessionId);
      })();
    },
    createLoginSession({ currentSessionId, sessionId, userId, createdAt }) {
      return database.transaction(() => {
        const current = get(currentSessionId);
        insertAccountSession.run(sessionId, createdAt, userId);
        if (current && !current.userId) deleteSession.run(currentSessionId);
        return get(sessionId);
      })();
    },
    createGuestAfterLogout({ currentSessionId, sessionId, balance, createdAt }) {
      return database.transaction(() => {
        deleteSession.run(currentSessionId);
        insertSession.run(sessionId, balance, createdAt);
        return get(sessionId);
      })();
    },
    update(id, changes) {
      const session = get(id);
      if (!session) throw new Error("Cannot update a missing player session.");
      return persist(session, changes).session;
    },
    recordGame(id, changes) {
      const session = get(id);
      if (!session) throw new Error("Cannot update a missing player session.");
      return persist(session, changes);
    },
    getGameReceipt(scopeId, requestId) {
      const receipt = selectGameReceipt.get(scopeId, requestId);
      return receipt ? {
        ...receipt,
        response: JSON.parse(receipt.responseJson),
      } : null;
    },
    saveGameReceipt({ scopeId, requestId, commandType, payloadHash, response, createdAt }) {
      insertGameReceipt.run(
        scopeId,
        requestId,
        commandType,
        payloadHash,
        JSON.stringify(response),
        response.balance,
        createdAt,
      );
    },
    updateProfile(id, { displayName, leaderboardOptIn }) {
      const session = get(id);
      if (!session?.userId) throw new Error("An account is required to update a profile.");
      const result = updateProfileStatement.run(displayName, leaderboardOptIn ? 1 : 0, session.userId);
      if (result.changes !== 1) throw new Error("Cannot update this account profile.");
      return get(id);
    },
    claimDailyReward(id, { amount, day }) {
      const session = get(id);
      if (!session?.userId) return { error: "Sign in to claim the daily demo-credit grant." };
      return database.transaction(() => {
        const result = claimDailyRewardStatement.run(amount, amount, day, session.userId, day);
        if (result.changes !== 1) return { error: "Today's demo-credit grant has already been claimed." };
        return { session: get(id), amount };
      })();
    },
    demoWalletHistory(id) {
      const session = get(id);
      if (!session?.userId) throw new Error("Sign in to view the demo wallet.");
      return selectWalletHistory.all(session.userId);
    },
    demoWalletTransfer(id, { requestId, kind, method, amount }) {
      return database.transaction(() => {
        const session = get(id);
        if (!session?.userId) return { error: "Sign in to use the demo wallet." };
        const previous = selectWalletTransaction.get(session.userId, requestId);
        if (previous) {
          if (previous.kind !== kind || previous.method !== method || previous.amount !== amount) {
            return { error: "This request ID was already used for a different simulation." };
          }
          return { balance: session.balance, transaction: previous, duplicate: true };
        }
        if (kind === "withdrawal" && amount > session.balance) {
          return { error: "The simulated withdrawal exceeds your available demo credits." };
        }
        const balance = session.balance + (kind === "deposit" ? amount : -amount);
        if (!Number.isSafeInteger(balance)) return { error: "The demo balance is too large." };
        persist(session, { balance });
        insertWalletTransaction.run(session.userId, requestId, kind, method, amount, balance, Date.now());
        return { balance, transaction: selectWalletTransaction.get(session.userId, requestId), duplicate: false };
      })();
    },
    leaderboard(limit = 10) {
      return selectLeaderboard.all(limit);
    },
    adminUsers(search = "") {
      const normalized = String(search).trim().replaceAll("%", "\\%").replaceAll("_", "\\_");
      const pattern = `%${normalized}%`;
      return adminListUsers.all(pattern, pattern);
    },
    adminAddUserCredits({ email, amount, note = null }) {
      return database.transaction(() => {
        const user = adminFindUser.get(email);
        if (!user) return { error: "No user account matches that email." };
        const balanceAfter = user.balance + amount;
        if (!Number.isSafeInteger(balanceAfter) || balanceAfter > 9_000_000_000_000_000) {
          return { error: "The resulting balance is too large." };
        }
        const updated = adminAddCredits.run(balanceAfter, balanceAfter, user.id);
        if (updated.changes !== 1) throw new Error("Cannot update the selected user.");
        insertAdminCreditAdjustment.run(user.id, amount, user.balance, balanceAfter, note, Date.now());
        return {
          email: user.email,
          displayName: user.displayName,
          balanceBefore: user.balance,
          amount,
          balanceAfter,
        };
      })();
    },
    aggregateWalletCredits() {
      return aggregateWalletCredits.get().total;
    },
    databaseHealth() {
      const integrity = database.pragma("quick_check", { simple: true });
      const foreignKeyViolations = database.pragma("foreign_key_check");
      const malformedState = database.prepare(`
        SELECT
          (SELECT COUNT(*) FROM sessions
            WHERE (blackjack_state IS NOT NULL AND NOT json_valid(blackjack_state))
              OR (poker_state IS NOT NULL AND NOT json_valid(poker_state)))
          + (SELECT COUNT(*) FROM users
            WHERE (blackjack_state IS NOT NULL AND NOT json_valid(blackjack_state))
              OR (poker_state IS NOT NULL AND NOT json_valid(poker_state))) AS count
      `).get().count;
      return {
        ok: integrity === "ok" && foreignKeyViolations.length === 0 && malformedState === 0,
        integrity,
        journalMode: database.pragma("journal_mode", { simple: true }),
        foreignKeysEnabled: database.pragma("foreign_keys", { simple: true }) === 1,
        foreignKeyViolations: foreignKeyViolations.length,
        malformedState,
      };
    },
    aggregateGameExposure() {
      const guests = guestExposureRows.all();
      const accounts = accountExposureRows.all();
      const exposures = [...guests, ...accounts];
      let blackjackPayoutExposure = 0;
      let videoPokerPayoutExposure = 0;
      for (const row of exposures) {
        if (row.blackjack_state) {
          const hand = parseStoredState(row.blackjack_state, "aggregate exposure", "blackjack state");
          if (!hand) continue;
          const stakes = Array.isArray(hand.hands)
            ? hand.hands.reduce((total, playerHand) => total + (playerHand.status === "playing" || playerHand.status === "stood" ? playerHand.bet : 0), 0)
            : hand.status === "playing" ? hand.bet : 0;
          blackjackPayoutExposure += stakes * 2;
        }
        if (row.poker_state) {
          const poker = parseStoredState(row.poker_state, "aggregate exposure", "video poker state");
          if (poker?.status === "draw") videoPokerPayoutExposure += poker.bet * 250;
        }
      }
      return {
        walletCredits: aggregateWalletCredits.get().total,
        blackjackPayoutExposure,
        videoPokerPayoutExposure,
        maximumUnsettledPayout: blackjackPayoutExposure + videoPokerPayoutExposure,
      };
    },
    transaction(callback) {
      return database.transaction(callback)();
    },
    close() {
      if (database.open) database.close();
    },
  };
}

export const sessionStore = createSessionStore();
