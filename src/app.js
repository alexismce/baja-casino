import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  commandScope,
  hashInstantGameCommand,
} from "./application/game-idempotency.js";
import {
  hashPassword,
  normalizeEmail,
  validateCredentials,
  verifyPassword,
} from "./auth.js";
import {
  doubleDownBlackjack,
  hitBlackjack,
  publicBlackjackState,
  splitBlackjack,
  startBlackjack,
  standBlackjack,
} from "./blackjack.js";
import { playGame } from "./games.js";
import { getSlotConfiguration, updateSlotWeights } from "./rng/slots.js";
import { sessionStore } from "./session-store.js";
import {
  drawVideoPoker,
  publicVideoPokerState,
  startVideoPoker,
} from "./video-poker.js";

const SESSION_COOKIE = "lucky_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const STARTING_BALANCE = 1000;
const MAX_BET = 100;
const RATE_WINDOW_MS = 10_000;
const RATE_LIMIT = 20;
const rateLimits = new Map();
const loginAttempts = new Map();
const DAILY_REWARD = 100;
let activeSocketCount = 0;
const ACHIEVEMENTS = {
  "first-game": { title: "First Play", description: "Play your first game." },
  "ten-games": { title: "Game Explorer", description: "Complete 10 games." },
  "first-win": { title: "First Win", description: "Win a game." },
  "game-explorer": {
    title: "Try Three",
    description: "Play three different games.",
  },
  "pattern-finder": {
    title: "Pattern Finder",
    description: "Complete a row or column in the Slots bonus puzzle.",
  },
};
const staticFiles = new Map([
  ["/favicon.ico", ["../public/favicon.svg", "image/svg+xml"]],
  ["/favicon.svg", ["../public/favicon.svg", "image/svg+xml"]],
  ["/", ["../public/index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["../public/styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["../public/app.js", "text/javascript; charset=utf-8"]],
  [
    "/soundtracks.js",
    ["../public/soundtracks.js", "text/javascript; charset=utf-8"],
  ],
  ["/loading.css", ["../public/loading.css", "text/css; charset=utf-8"]],
  [
    "/assets/casino-entrance.jpg",
    ["../public/assets/casino-entrance.jpg", "image/jpeg"],
  ],
  ["/admin", ["../public/admin.html", "text/html; charset=utf-8"]],
  ["/admin/", ["../public/admin.html", "text/html; charset=utf-8"]],
  ["/admin.css", ["../public/admin.css", "text/css; charset=utf-8"]],
  ["/admin.js", ["../public/admin.js", "text/javascript; charset=utf-8"]],
  ["/client", ["../client/index.html", "text/html; charset=utf-8"]],
  ["/client/", ["../client/index.html", "text/html; charset=utf-8"]],
  ["/client/styles.css", ["../client/styles.css", "text/css; charset=utf-8"]],
  ["/client/app.js", ["../client/app.js", "text/javascript; charset=utf-8"]],
  [
    "/client/bonus-audio.js",
    ["../client/bonus-audio.js", "text/javascript; charset=utf-8"],
  ],
  [
    "/client/fx-controller.js",
    ["../client/fx-controller.js", "text/javascript; charset=utf-8"],
  ],
  [
    "/client/slots-3d.js",
    ["../client/slots-3d.js", "text/javascript; charset=utf-8"],
  ],
  [
    "/client/slot-presentation.js",
    ["../client/slot-presentation.js", "text/javascript; charset=utf-8"],
  ],
  [
    "/client/babylon.js",
    ["../node_modules/babylonjs/babylon.js", "text/javascript; charset=utf-8"],
  ],
  [
    "/client/phaser.min.js",
    [
      "../node_modules/phaser/dist/phaser.min.js",
      "text/javascript; charset=utf-8",
    ],
  ],
  [
    "/client/assets/slots/question.svg",
    ["../client/assets/slots/question.svg", "image/svg+xml"],
  ],
  [
    "/client/assets/slots/seven.svg",
    ["../client/assets/slots/seven.svg", "image/svg+xml"],
  ],
  [
    "/client/assets/slots/cherry.svg",
    ["../client/assets/slots/cherry.svg", "image/svg+xml"],
  ],
  [
    "/client/assets/slots/orange.svg",
    ["../client/assets/slots/orange.svg", "image/svg+xml"],
  ],
  [
    "/client/assets/slots/watermelon.svg",
    ["../client/assets/slots/watermelon.svg", "image/svg+xml"],
  ],
  [
    "/client/assets/slots/grapes.svg",
    ["../client/assets/slots/grapes.svg", "image/svg+xml"],
  ],
]);

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}

function validAdminToken(request) {
  const expected = process.env.ADMIN_TOKEN;
  const supplied = request.headers["x-admin-token"];
  if (!expected || expected.length < 32 || typeof supplied !== "string")
    return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

function setSecurityHeaders(response) {
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data: blob:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  );
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
}

function cookieValue(request, name) {
  const cookieHeader = request.headers.cookie ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return cookie?.slice(name.length + 1);
}

function setSessionCookie(request, response, sessionId) {
  const forwardedProto = String(request.headers["x-forwarded-proto"] ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const secure =
    request.socket.encrypted || forwardedProto === "https" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`,
  );
}

function getOrCreateSession(request, response, store) {
  const existingId = cookieValue(request, SESSION_COOKIE);
  const existingSession = existingId ? store.get(existingId) : undefined;
  if (existingSession) return existingSession;

  const id = randomBytes(32).toString("base64url");
  const session = store.create(id, STARTING_BALANCE, Date.now());
  setSessionCookie(request, response, id);
  return session;
}

function checkRateLimit(key) {
  const now = Date.now();
  if (rateLimits.size >= 500) {
    for (const [trackedKey, requests] of rateLimits) {
      if (!requests.some((time) => now - time < RATE_WINDOW_MS))
        rateLimits.delete(trackedKey);
    }
  }
  const requests = (rateLimits.get(key) ?? []).filter(
    (time) => now - time < RATE_WINDOW_MS,
  );
  if (requests.length >= RATE_LIMIT) {
    rateLimits.set(key, requests);
    return false;
  }
  requests.push(now);
  rateLimits.set(key, requests);
  return true;
}

async function readJson(request) {
  if (
    !request.headers["content-type"]
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    throw Object.assign(new Error("Content-Type must be application/json."), {
      status: 415,
    });
  }

  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > 1024) {
      throw Object.assign(new Error("Request body is too large."), {
        status: 413,
      });
    }
  }

  try {
    return JSON.parse(body);
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), {
      status: 400,
    });
  }
}

function validatePlayRequest(input, balance) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return "Provide a valid game request.";
  }

  if (input.game === "blackjack") {
    return "Blackjack uses the persistent deal/action flow; do not use /api/play or place_bet.";
  }

  if (
    !["slots", "fortune-slots", "roulette", "coin", "dice"].includes(input.game)
  ) {
    return "Choose a supported game.";
  }

  const isSlots = input.game === "slots" || input.game === "fortune-slots";
  const maximumBet = isSlots ? 10 : MAX_BET;
  if (
    !Number.isSafeInteger(input.bet) ||
    input.bet < 1 ||
    input.bet > maximumBet
  ) {
    return isSlots
      ? "Slot line bet must be a whole number from 1 to 10 credits."
      : `Bet must be a whole number from 1 to ${MAX_BET}.`;
  }

  const totalBet = isSlots
    ? input.bet * getSlotConfiguration().paylineCount
    : input.bet;
  if (totalBet > balance) {
    return isSlots
      ? "Your total slot wager across 10 paylines cannot exceed your balance."
      : "Your bet cannot exceed your balance.";
  }
  if (
    input.game === "roulette" &&
    (!Number.isInteger(input.choice) || input.choice < 0 || input.choice > 36)
  ) {
    return "Choose a roulette number from 0 to 36.";
  }
  if (input.game === "coin" && !["heads", "tails"].includes(input.choice)) {
    return "Choose heads or tails.";
  }
  if (
    input.game === "dice" &&
    (!Number.isInteger(input.choice) || input.choice < 1 || input.choice > 6)
  ) {
    return "Choose a die face from 1 to 6.";
  }
  if (!requestIdFrom(input))
    return "Provide a valid requestId for this game command.";

  return null;
}

function playForSession(store, sessionId, input) {
  return store.transaction(() => {
    const session = store.get(sessionId);
    if (!session)
      return {
        error: "Game session is invalid. Reload the page to start a new one.",
      };
    if (input?.game === "blackjack") {
      return {
        error:
          "Blackjack uses the persistent deal/action flow; do not use /api/play or place_bet.",
        code: "use_blackjack_flow",
        status: 409,
      };
    }
    const requestId = requestIdFrom(input);
    const scopeId = commandScope(session);
    const commandType = `instant-game:${input?.game ?? "invalid"}`;
    const payloadHash = hashInstantGameCommand(input);
    if (requestId) {
      const receipt = store.getGameReceipt(scopeId, requestId);
      if (receipt) {
        if (
          receipt.commandType !== commandType ||
          receipt.payloadHash !== payloadHash
        ) {
          return {
            error:
              "This requestId was already used for a different game command.",
            code: "request_conflict",
            status: 409,
          };
        }
        const replay = { ...receipt.response };
        Object.defineProperty(replay, "replayed", {
          value: true,
          enumerable: false,
        });
        return replay;
      }
    }
    if (session.blackjack)
      return { error: "Finish your current blackjack hand first." };
    if (session.poker)
      return { error: "Finish your current video poker hand first." };

    const validationError = validatePlayRequest(input, session.balance);
    if (validationError) return { error: validationError };

    const { payout, result } = playGame(input);
    const isSlots = input.game === "slots" || input.game === "fortune-slots";
    const totalBet = isSlots
      ? input.bet * getSlotConfiguration().paylineCount
      : input.bet;
    const balance = session.balance - totalBet + payout;
    const updated = store.recordGame(sessionId, {
      balance,
      blackjack: null,
      gameResult: {
        game: input.game,
        won: payout > totalBet,
        patternBonus: isSlots && result.bonusLines.length > 0,
      },
    });
    const response = {
      balance,
      bet: totalBet,
      lineBet: isSlots ? input.bet : null,
      payout,
      net: payout - totalBet,
      result,
      newAchievements: achievementLabels(updated.newAchievements),
    };
    store.saveGameReceipt({
      scopeId,
      requestId,
      commandType,
      payloadHash,
      response,
      createdAt: Date.now(),
    });
    return response;
  });
}

function publicAccount(session) {
  if (!session?.account) return null;
  return {
    displayName: session.account.displayName,
    email: session.account.email,
    bestBalance: session.account.bestBalance,
    gamesPlayed: session.account.gamesPlayed,
    wins: session.account.wins,
    games: session.account.games,
    leaderboardOptIn: session.account.leaderboardOptIn,
    lastDailyRewardDay: session.account.lastDailyRewardDay,
    achievements: session.account.achievements.map((id) => ({
      id,
      ...ACHIEVEMENTS[id],
    })),
  };
}

function safeUserError(error) {
  if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
    return "That email or display name is already in use.";
  }
  throw error;
}

function loginRateLimitKey(request) {
  return `login:${request.socket.remoteAddress ?? "unknown"}`;
}

function validDisplayName(value) {
  return (
    typeof value === "string" &&
    value.trim().length >= 3 &&
    value.trim().length <= 20 &&
    /^[A-Za-z0-9 _-]+$/.test(value.trim())
  );
}

function achievementLabels(ids = []) {
  return ids
    .filter((id) => ACHIEVEMENTS[id])
    .map((id) => ACHIEVEMENTS[id].title);
}

export function isSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;

  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

function requestIdFrom(input) {
  return typeof input?.requestId === "string" &&
    /^[\w-]{1,64}$/.test(input.requestId)
    ? input.requestId
    : null;
}

function blackjackResponse(store, sessionId, action, input) {
  return store.transaction(() => {
    const session = store.get(sessionId);
    if (!session)
      return {
        error: "Game session is invalid. Reload the page to start a new one.",
      };

    if (action === "deal") {
      if (
        !input ||
        !Number.isSafeInteger(input.bet) ||
        input.bet < 1 ||
        input.bet > MAX_BET
      ) {
        return { error: `Bet must be a whole number from 1 to ${MAX_BET}.` };
      }
      if (session.blackjack)
        return { error: "Finish your current blackjack hand first." };
      if (session.poker)
        return { error: "Finish your current video poker hand first." };
      if (input.bet > session.balance)
        return { error: "Your bet cannot exceed your balance." };

      const hand = startBlackjack(input.bet);
      const finished = hand.status === "finished";
      const balance =
        session.balance - input.bet + (finished ? hand.payout : 0);
      const saved = finished
        ? store.recordGame(sessionId, {
            balance,
            blackjack: null,
            gameResult: { game: "blackjack", won: hand.payout > input.bet },
          })
        : {
            session: store.update(sessionId, { balance, blackjack: hand }),
            newAchievements: [],
          };
      return {
        event: finished ? "blackjack_over" : "blackjack_start",
        payload: {
          state: publicBlackjackState(hand, saved.session.balance),
          bet: hand.bet,
          payout: finished ? hand.payout : 0,
          balance: saved.session.balance,
          newAchievements: achievementLabels(saved.newAchievements),
        },
      };
    }

    if (!session.blackjack || session.blackjack.status !== "playing") {
      return { error: "There is no active blackjack hand." };
    }
    const actions = publicBlackjackState(
      session.blackjack,
      session.balance,
    ).legalActions;
    if (
      !input ||
      !["hit", "stand", "split", "double"].includes(input.action) ||
      !actions.includes(input.action)
    ) {
      return {
        error: "That action is not available for this hand or balance.",
      };
    }

    let balance = session.balance;
    let hand;
    if (input.action === "split") {
      balance -= session.blackjack.hands[session.blackjack.activeHandIndex].bet;
      hand = splitBlackjack(session.blackjack);
    } else if (input.action === "double") {
      balance -= session.blackjack.hands[session.blackjack.activeHandIndex].bet;
      hand = doubleDownBlackjack(session.blackjack);
    } else {
      hand =
        input.action === "hit"
          ? hitBlackjack(session.blackjack)
          : standBlackjack(session.blackjack);
    }
    const finished = hand.status === "finished";
    balance += finished ? hand.payout : 0;
    const saved = finished
      ? store.recordGame(sessionId, {
          balance,
          blackjack: null,
          gameResult: { game: "blackjack", won: hand.payout > hand.bet },
        })
      : {
          session: store.update(sessionId, { balance, blackjack: hand }),
          newAchievements: [],
        };
    return {
      event: finished ? "blackjack_over" : "blackjack_update",
      payload: {
        state: publicBlackjackState(hand, balance),
        bet: hand.hands.reduce(
          (total, playerHand) => total + playerHand.bet,
          0,
        ),
        payout: finished ? hand.payout : 0,
        balance: saved.session.balance,
        newAchievements: achievementLabels(saved.newAchievements),
      },
    };
  });
}

function videoPokerResponse(store, sessionId, action, input) {
  return store.transaction(() => {
    const session = store.get(sessionId);
    if (!session)
      return {
        error: "Game session is invalid. Reload the page to start a new one.",
      };

    if (action === "deal") {
      if (
        !input ||
        !Number.isSafeInteger(input.bet) ||
        input.bet < 1 ||
        input.bet > MAX_BET
      ) {
        return { error: `Bet must be a whole number from 1 to ${MAX_BET}.` };
      }
      if (session.blackjack)
        return { error: "Finish your current blackjack hand first." };
      if (session.poker)
        return { error: "Finish your current video poker hand first." };
      if (input.bet > session.balance)
        return { error: "Your bet cannot exceed your balance." };

      const hand = startVideoPoker(input.bet);
      const balance = session.balance - input.bet;
      const saved = store.update(sessionId, {
        balance,
        blackjack: null,
        poker: hand,
      });
      return {
        event: "video_poker_start",
        payload: { state: publicVideoPokerState(hand), balance: saved.balance },
      };
    }

    if (!session.poker || session.poker.status !== "draw") {
      return { error: "There is no active video poker hand." };
    }
    const settled = drawVideoPoker(session.poker, input?.holds);
    const balance = session.balance + settled.payout;
    const saved = store.recordGame(sessionId, {
      balance,
      blackjack: null,
      poker: null,
      gameResult: { game: "poker", won: settled.payout > settled.hand.bet },
    });
    return {
      event: "video_poker_result",
      payload: {
        state: publicVideoPokerState(settled.hand),
        outcome: settled.outcome,
        multiplier: settled.multiplier,
        bet: settled.hand.bet,
        payout: settled.payout,
        net: settled.payout - settled.hand.bet,
        balance: saved.session.balance,
        newAchievements: achievementLabels(saved.newAchievements),
      },
    };
  });
}

export function attachRealtime(io, store = sessionStore) {
  io.use((socket, next) => {
    const request = socket.request;
    if (!isSameOrigin(request)) {
      next(new Error("Cross-origin connections are not allowed."));
      return;
    }

    const sessionId = cookieValue(request, SESSION_COOKIE);
    if (!store.get(sessionId)) {
      next(
        new Error(
          "Game session is missing or invalid. Refresh the page to reconnect.",
        ),
      );
      return;
    }

    socket.data.sessionId = sessionId;
    next();
  });

  io.on("connection", (socket) => {
    activeSocketCount += 1;
    socket.once("disconnect", () => {
      activeSocketCount -= 1;
    });
    const { sessionId } = socket.data;
    const session = store.get(sessionId);
    if (!session) {
      socket.disconnect(true);
      return;
    }
    socket.emit("balance_update", session.balance);

    const rejectGameRequest = (requestId, failure) => {
      const details =
        typeof failure === "string" ? { error: failure } : failure;
      socket.emit("game_error", {
        requestId,
        error: details.error,
        ...(details.code ? { code: details.code } : {}),
      });
    };

    socket.on("video_poker_resume", () => {
      const current = store.get(sessionId);
      if (current?.poker) {
        socket.emit("video_poker_start", {
          requestId: null,
          state: publicVideoPokerState(current.poker),
          balance: current.balance,
          resumed: true,
        });
      }
    });

    socket.on("video_poker_deal", (input) => {
      const requestId = requestIdFrom(input);
      if (!checkRateLimit(sessionId)) {
        rejectGameRequest(
          requestId,
          "Too many requests. Please wait a moment.",
        );
        return;
      }
      try {
        const response = videoPokerResponse(store, sessionId, "deal", input);
        if (response.error) {
          rejectGameRequest(requestId, response.error);
          return;
        }
        socket.emit("balance_update", response.payload.balance);
        socket.emit(response.event, { ...response.payload, requestId });
      } catch (error) {
        console.error("Video poker deal failed:", error);
        rejectGameRequest(
          requestId,
          "The video poker hand could not be dealt. No credits were deducted.",
        );
      }
    });

    socket.on("video_poker_draw", (input) => {
      const requestId = requestIdFrom(input);
      if (!checkRateLimit(sessionId)) {
        rejectGameRequest(
          requestId,
          "Too many requests. Please wait a moment.",
        );
        return;
      }
      try {
        const response = videoPokerResponse(store, sessionId, "draw", input);
        if (response.error) {
          rejectGameRequest(requestId, response.error);
          return;
        }
        socket.emit("balance_update", response.payload.balance);
        socket.emit(response.event, { ...response.payload, requestId });
      } catch (error) {
        console.error("Video poker draw failed:", error);
        rejectGameRequest(
          requestId,
          "The video poker draw could not be completed.",
        );
      }
    });

    socket.on("place_bet", (input) => {
      const requestId = requestIdFrom(input);
      if (!checkRateLimit(sessionId)) {
        rejectGameRequest(
          requestId,
          "Too many requests. Please wait a moment.",
        );
        return;
      }

      try {
        const response = playForSession(store, sessionId, input);
        if (response.error) {
          rejectGameRequest(requestId, response);
          return;
        }

        if (!response.replayed) socket.emit("balance_update", response.balance);
        socket.emit("spin_result", {
          ...response,
          game: input.game,
          requestId,
        });
      } catch (error) {
        console.error("Realtime game request failed:", error);
        rejectGameRequest(requestId, "An unexpected game error occurred.");
      }
    });

    socket.on("blackjack_resume", () => {
      const activeSession = store.get(sessionId);
      if (!activeSession?.blackjack) return;
      socket.emit("blackjack_start", {
        requestId: null,
        state: publicBlackjackState(
          activeSession.blackjack,
          activeSession.balance,
        ),
        bet: activeSession.blackjack.bet,
        payout: 0,
        balance: activeSession.balance,
        resumed: true,
      });
    });

    socket.on("blackjack_deal", (input) => {
      const requestId = requestIdFrom(input);
      if (!checkRateLimit(sessionId)) {
        rejectGameRequest(
          requestId,
          "Too many requests. Please wait a moment.",
        );
        return;
      }

      try {
        const response = blackjackResponse(store, sessionId, "deal", input);
        if (response.error) {
          rejectGameRequest(requestId, response.error);
          return;
        }
        socket.emit("balance_update", response.payload.balance);
        socket.emit(response.event, { ...response.payload, requestId });
      } catch (error) {
        console.error("Blackjack deal failed:", error);
        rejectGameRequest(
          requestId,
          "The hand could not be dealt. No credits were deducted.",
        );
      }
    });

    socket.on("blackjack_action", (input) => {
      const requestId = requestIdFrom(input);
      if (!checkRateLimit(sessionId)) {
        rejectGameRequest(
          requestId,
          "Too many requests. Please wait a moment.",
        );
        return;
      }

      try {
        const response = blackjackResponse(store, sessionId, "action", input);
        if (response.error) {
          rejectGameRequest(requestId, response.error);
          return;
        }
        socket.emit("balance_update", response.payload.balance);
        socket.emit(response.event, { ...response.payload, requestId });
      } catch (error) {
        console.error("Blackjack action failed:", error);
        rejectGameRequest(
          requestId,
          "The blackjack action could not be completed.",
        );
      }
    });
  });
}

async function serveStatic(pathname, response) {
  const file = staticFiles.get(pathname);
  if (!file) return false;

  const [filename, contentType] = file;
  const content = await readFile(new URL(filename, import.meta.url));
  response.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-cache",
  });
  response.end(content);
  return true;
}

export function createApp(store = sessionStore) {
  return async (request, response) => {
    setSecurityHeaders(response);

    try {
      const url = new URL(
        request.url,
        `http://${request.headers.host ?? "localhost"}`,
      );
      if (url.pathname.startsWith("/api/")) {
        response.setHeader("Cache-Control", "no-store");
        if (!isSameOrigin(request)) {
          sendJson(response, 403, {
            error: "Cross-origin requests are not allowed.",
          });
          return;
        }

        if (url.pathname.startsWith("/api/admin/")) {
          if (!process.env.ADMIN_TOKEN || process.env.ADMIN_TOKEN.length < 32) {
            sendJson(response, 503, {
              error:
                "Admin controls are disabled. Configure an ADMIN_TOKEN of at least 32 characters.",
            });
            return;
          }
          if (!validAdminToken(request)) {
            sendJson(response, 401, {
              error: "Admin token is missing or invalid.",
            });
            return;
          }
          if (
            !checkRateLimit(
              `admin:${request.socket.remoteAddress ?? "unknown"}`,
            )
          ) {
            sendJson(response, 429, {
              error: "Too many admin requests. Please wait a moment.",
            });
            return;
          }
          if (
            request.method === "GET" &&
            url.pathname === "/api/admin/metrics"
          ) {
            sendJson(response, 200, {
              activeSockets: activeSocketCount,
              ...store.aggregateGameExposure(),
              slots: getSlotConfiguration(),
              capturedAt: new Date().toISOString(),
            });
            return;
          }
          if (
            request.method === "GET" &&
            url.pathname === "/api/admin/health"
          ) {
            const memory = process.memoryUsage();
            const database = store.databaseHealth();
            sendJson(response, 200, {
              ok: database.ok,
              database,
              server: {
                uptimeSeconds: Math.floor(process.uptime()),
                nodeVersion: process.version,
                activeSockets: activeSocketCount,
                rssBytes: memory.rss,
                heapUsedBytes: memory.heapUsed,
              },
              capturedAt: new Date().toISOString(),
            });
            return;
          }
          if (request.method === "GET" && url.pathname === "/api/admin/users") {
            sendJson(response, 200, {
              users: store.adminUsers(url.searchParams.get("search") ?? ""),
            });
            return;
          }
          if (
            request.method === "POST" &&
            url.pathname === "/api/admin/credits"
          ) {
            const input = await readJson(request);
            const note =
              typeof input?.note === "string" ? input.note.trim() : "";
            if (
              typeof input?.email !== "string" ||
              !normalizeEmail(input.email) ||
              !Number.isSafeInteger(input?.amount) ||
              input.amount < 1 ||
              input.amount > 100000 ||
              note.length > 120
            ) {
              sendJson(response, 400, {
                error:
                  "Provide a valid account email, 1–100,000 whole credits, and an optional note of up to 120 characters.",
              });
              return;
            }
            const result = store.adminAddUserCredits({
              email: normalizeEmail(input.email),
              amount: input.amount,
              note: note || null,
            });
            if (result.error) {
              sendJson(response, 404, { error: result.error });
              return;
            }
            sendJson(response, 200, { adjustment: result });
            return;
          }
          if (
            request.method === "PUT" &&
            url.pathname === "/api/admin/slot-weights"
          ) {
            const input = await readJson(request);
            try {
              sendJson(response, 200, {
                slots: updateSlotWeights(input?.weights),
              });
            } catch (error) {
              sendJson(response, 400, { error: error.message });
            }
            return;
          }
          sendJson(response, 404, { error: "Admin API route not found." });
          return;
        }

        if (request.method === "GET" && url.pathname === "/api/health") {
          const database = store.databaseHealth();
          sendJson(response, database.ok ? 200 : 503, {
            ok: database.ok,
            database,
          });
          return;
        }

        if (request.method === "GET" && url.pathname === "/api/leaderboard") {
          if (
            !checkRateLimit(
              `leaderboard:${request.socket.remoteAddress ?? "unknown"}`,
            )
          ) {
            sendJson(response, 429, {
              error: "Too many requests. Please wait a moment.",
            });
            return;
          }
          sendJson(response, 200, { entries: store.leaderboard(10) });
          return;
        }

        if (request.method === "GET" && url.pathname === "/api/state") {
          const session = getOrCreateSession(request, response, store);
          if (!checkRateLimit(session.id)) {
            sendJson(response, 429, {
              error: "Too many requests. Please wait a moment.",
            });
            return;
          }
          sendJson(response, 200, {
            balance: session.balance,
            maxBet: MAX_BET,
            authenticated: Boolean(session.account),
          });
          return;
        }

        if (request.method === "GET" && url.pathname === "/api/account") {
          const session = store.get(cookieValue(request, SESSION_COOKIE));
          if (!session) {
            sendJson(response, 200, { authenticated: false });
            return;
          }
          sendJson(response, 200, {
            authenticated: Boolean(session.account),
            account: publicAccount(session),
            balance: session.balance,
            dailyRewardAvailable:
              Boolean(session.account) &&
              session.account.lastDailyRewardDay !==
                new Date().toISOString().slice(0, 10),
          });
          return;
        }

        if (
          url.pathname === "/api/demo-wallet" &&
          ["GET", "POST"].includes(request.method)
        ) {
          const session = store.get(cookieValue(request, SESSION_COOKIE));
          if (!session?.account) {
            sendJson(response, 401, {
              error: "Sign in to use the demo wallet.",
            });
            return;
          }
          if (!checkRateLimit(`demo-wallet:${session.id}`)) {
            sendJson(response, 429, {
              error: "Too many demo wallet requests. Please wait a moment.",
            });
            return;
          }
          if (request.method === "GET") {
            sendJson(response, 200, {
              balance: session.balance,
              transactions: store.demoWalletHistory(session.id),
            });
            return;
          }
          const input = await readJson(request);
          if (
            !input ||
            !["deposit", "withdrawal"].includes(input.kind) ||
            !["paypal", "bank"].includes(input.method) ||
            !Number.isSafeInteger(input.amount) ||
            input.amount < 1 ||
            input.amount > 10000 ||
            !requestIdFrom(input)
          ) {
            sendJson(response, 400, {
              error:
                "Choose a simulated operation and method, 1–10,000 whole credits, and a valid request ID.",
            });
            return;
          }
          const result = store.demoWalletTransfer(session.id, input);
          if (result.error) {
            sendJson(response, 409, { error: result.error });
            return;
          }
          sendJson(response, 200, result);
          return;
        }

        if (
          request.method === "POST" &&
          url.pathname === "/api/auth/register"
        ) {
          if (!checkRateLimit(loginRateLimitKey(request))) {
            sendJson(response, 429, {
              error: "Too many account requests. Please wait a moment.",
            });
            return;
          }
          const input = await readJson(request);
          const validationError = validateCredentials(input ?? {});
          if (validationError) {
            sendJson(response, 400, { error: validationError });
            return;
          }
          if (!validDisplayName(input.displayName)) {
            sendJson(response, 400, {
              error: "Choose a display name between 3 and 20 characters.",
            });
            return;
          }
          const anonymousSession = getOrCreateSession(request, response, store);
          if (anonymousSession.account) {
            sendJson(response, 409, { error: "You are already signed in." });
            return;
          }

          const password = await hashPassword(input.password);
          const sessionId = randomBytes(32).toString("base64url");
          let session;
          try {
            session = store.register({
              anonymousSessionId: anonymousSession.id,
              sessionId,
              userId: randomBytes(16).toString("hex"),
              email: normalizeEmail(input.email),
              passwordSalt: password.salt,
              passwordHash: password.hash,
              displayName: input.displayName.trim(),
              leaderboardOptIn: input.leaderboardOptIn === true,
              createdAt: Date.now(),
            });
          } catch (error) {
            const message = safeUserError(error);
            sendJson(response, 409, { error: message });
            return;
          }
          setSessionCookie(request, response, sessionId);
          sendJson(response, 201, {
            authenticated: true,
            account: publicAccount(session),
            balance: session.balance,
            dailyRewardAvailable: true,
            emailVerified: false,
          });
          return;
        }

        if (request.method === "POST" && url.pathname === "/api/auth/login") {
          const rateKey = loginRateLimitKey(request);
          if (!checkRateLimit(rateKey)) {
            sendJson(response, 429, {
              error: "Too many account requests. Please wait a moment.",
            });
            return;
          }
          const input = await readJson(request);
          if (
            !input ||
            typeof input.email !== "string" ||
            typeof input.password !== "string" ||
            input.password.length > 128 ||
            !normalizeEmail(input.email)
          ) {
            sendJson(response, 400, {
              error: "Enter your email and password.",
            });
            return;
          }
          const user = store.getByEmail(normalizeEmail(input.email));
          if (
            !user ||
            !(await verifyPassword(
              input.password,
              user.password_salt,
              user.password_hash,
            ))
          ) {
            sendJson(response, 401, {
              error: "Email or password is incorrect.",
            });
            return;
          }

          const currentSession = getOrCreateSession(request, response, store);
          const sessionId = randomBytes(32).toString("base64url");
          const session = store.createLoginSession({
            currentSessionId: currentSession.id,
            sessionId,
            userId: user.id,
            createdAt: Date.now(),
          });
          setSessionCookie(request, response, sessionId);
          sendJson(response, 200, {
            authenticated: true,
            account: publicAccount(session),
            balance: session.balance,
            dailyRewardAvailable:
              session.account.lastDailyRewardDay !==
              new Date().toISOString().slice(0, 10),
            emailVerified: false,
          });
          return;
        }

        if (request.method === "POST" && url.pathname === "/api/auth/logout") {
          const currentSession = store.get(
            cookieValue(request, SESSION_COOKIE),
          );
          if (!currentSession) {
            sendJson(response, 200, { authenticated: false });
            return;
          }
          const sessionId = randomBytes(32).toString("base64url");
          const guest = store.createGuestAfterLogout({
            currentSessionId: currentSession.id,
            sessionId,
            balance: STARTING_BALANCE,
            createdAt: Date.now(),
          });
          setSessionCookie(request, response, sessionId);
          sendJson(response, 200, {
            authenticated: false,
            balance: guest.balance,
          });
          return;
        }

        if (
          request.method === "POST" &&
          url.pathname === "/api/account/profile"
        ) {
          const currentSession = store.get(
            cookieValue(request, SESSION_COOKIE),
          );
          if (!currentSession?.account) {
            sendJson(response, 401, {
              error: "Sign in to update your profile.",
            });
            return;
          }
          const input = await readJson(request);
          if (
            !validDisplayName(input?.displayName) ||
            typeof input?.leaderboardOptIn !== "boolean"
          ) {
            sendJson(response, 400, {
              error: "Provide a valid display name and leaderboard preference.",
            });
            return;
          }
          try {
            const updated = store.updateProfile(currentSession.id, {
              displayName: input.displayName.trim(),
              leaderboardOptIn: input.leaderboardOptIn,
            });
            sendJson(response, 200, { account: publicAccount(updated) });
          } catch (error) {
            const message = safeUserError(error);
            sendJson(response, 409, { error: message });
          }
          return;
        }

        if (
          request.method === "POST" &&
          url.pathname === "/api/rewards/daily"
        ) {
          const currentSession = store.get(
            cookieValue(request, SESSION_COOKIE),
          );
          if (!currentSession?.account) {
            sendJson(response, 401, {
              error: "Sign in to claim the daily demo-credit grant.",
            });
            return;
          }
          const reward = store.claimDailyReward(currentSession.id, {
            amount: DAILY_REWARD,
            day: new Date().toISOString().slice(0, 10),
          });
          if (reward.error) {
            sendJson(response, 409, { error: reward.error });
            return;
          }
          sendJson(response, 200, {
            amount: reward.amount,
            balance: reward.session.balance,
            account: publicAccount(reward.session),
            dailyRewardAvailable: false,
          });
          return;
        }

        if (request.method === "POST" && url.pathname === "/api/play") {
          const session = getOrCreateSession(request, response, store);
          if (!checkRateLimit(session.id)) {
            sendJson(response, 429, {
              error: "Too many requests. Please wait a moment.",
            });
            return;
          }
          const input = await readJson(request);
          const gameResponse = playForSession(store, session.id, input);
          if (gameResponse.error) {
            sendJson(response, gameResponse.status ?? 400, {
              error: gameResponse.error,
              ...(gameResponse.code ? { code: gameResponse.code } : {}),
            });
            return;
          }
          sendJson(response, 200, gameResponse);
          return;
        }

        sendJson(response, 404, { error: "API route not found." });
        return;
      }

      if (request.method !== "GET") {
        sendJson(response, 405, { error: "Method not allowed." });
        return;
      }

      if (await serveStatic(url.pathname, response)) return;
      sendJson(response, 404, { error: "Page not found." });
    } catch (error) {
      if (error.status) {
        sendJson(response, error.status, { error: error.message });
        return;
      }

      console.error("Request failed:", error);
      if (!response.headersSent) {
        sendJson(response, 500, {
          error: "An unexpected server error occurred.",
        });
      } else {
        response.end();
      }
    }
  };
}

setInterval(() => {
  const expiry = Date.now() - RATE_WINDOW_MS;
  for (const [id, requests] of rateLimits) {
    const recentRequests = requests.filter((time) => time >= expiry);
    if (recentRequests.length) rateLimits.set(id, recentRequests);
    else rateLimits.delete(id);
  }
}, RATE_WINDOW_MS).unref();
