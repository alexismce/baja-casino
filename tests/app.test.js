import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import Database from "better-sqlite3";
import { Server } from "socket.io";
import { io as createSocketClient } from "socket.io-client";
import { attachRealtime, createApp, isSameOrigin } from "../src/app.js";
import { createSessionStore } from "../src/session-store.js";

const store = createSessionStore(new Database(":memory:"));
const server = createServer(createApp(store));
const io = new Server(server, {
  serveClient: true,
  maxHttpBufferSize: 1024,
  allowRequest: (request, callback) => callback(null, isSameOrigin(request)),
});
attachRealtime(io, store);
let baseUrl;

function waitForSocketEvent(client, events) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${events.join(" or ")}.`));
    }, 5000);
    const handlers = new Map();
    const cleanup = () => {
      clearTimeout(timeout);
      for (const [event, handler] of handlers) client.off(event, handler);
    };

    for (const event of events) {
      const handler = (data) => {
        cleanup();
        resolve({ event, data });
      };
      handlers.set(event, handler);
      client.once(event, handler);
    }
  });
}

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => io.close(resolve));
  store.close();
});

test("serves the game room and creates a virtual-credit session", async () => {
  const page = await fetch(baseUrl);
  assert.equal(page.status, 200);
  assert.match(
    page.headers.get("content-security-policy"),
    /default-src 'self'/,
  );
  assert.match(
    page.headers.get("content-security-policy"),
    /img-src 'self' data: blob:/,
  );
  const landingHtml = await page.text();
  assert.match(landingHtml, /Virtual credits only/);
  assert.match(landingHtml, /class="premium-theme auth-loading"/);
  assert.match(landingHtml, /admin@luckylounge\.demo/);
  assert.match(landingHtml, /DemoAdmin!2026/);
  assert.match(landingHtml, /class="demo-badge">DEMO/);
  assert.doesNotMatch(
    landingHtml,
    /id="demo-wallet"|id="wallet-form"|href="#demo-wallet"/,
  );
  assert.doesNotMatch(landingHtml, /Demo wallet|Recent simulations/);
  assert.match(landingHtml, /5 × 3 · 10 LINES/);
  assert.match(landingHtml, /id="sound-volume"/);
  assert.match(landingHtml, /id="app-loader"/);
  assert.match(landingHtml, /casino-entrance\.jpg/);
  assert.match(landingHtml, /SPLIT &amp; DOUBLE/);
  assert.match(landingHtml, /including the stake/);
  assert.doesNotMatch(
    landingHtml,
    /cascading mega wins|VIP leaderboard|MULTI-LINE/,
  );
  for (const game of [
    "slots",
    "blackjack",
    "poker",
    "roulette",
    "coin",
    "dice",
  ]) {
    assert.match(landingHtml, new RegExp(`href="/client\\?game=${game}"`));
  }
  assert.match(landingHtml, /06 GAMES OPEN/);
  assert.equal(
    (landingHtml.match(/data-game-category="slots"/g) ?? []).length,
    1,
  );
  assert.match(landingHtml, /FIVE-CARD DRAW/);
  assert.match(landingHtml, /id="game-search"/);
  assert.match(landingHtml, /data-game-filter="slots"/);
  assert.match(landingHtml, /data-game-filter="tables"/);
  assert.match(landingHtml, /id="game-empty-state"/);
  assert.match(landingHtml, /class="art-title">Lucky<br>Slots/);
  assert.doesNotMatch(landingHtml, /id="game-dialog"/);
  const favicon = await fetch(`${baseUrl}/favicon.svg`);
  assert.equal(favicon.status, 200);
  assert.match(favicon.headers.get("content-type"), /image\/svg\+xml/);
  const adminPage = await fetch(`${baseUrl}/admin`);
  assert.equal(adminPage.status, 200);
  const adminHtml = await adminPage.text();
  assert.match(adminHtml, /id="message" role="status" aria-live="polite"/);
  assert.match(adminHtml, /id="unlock-dashboard"/);
  assert.match(adminHtml, /id="apply-weights"/);

  const socketClient = await fetch(`${baseUrl}/socket.io/socket.io.js`);
  assert.equal(socketClient.status, 200);
  assert.match(socketClient.headers.get("content-type"), /javascript/);

  const quickClient = await fetch(`${baseUrl}/client`);
  assert.equal(quickClient.status, 200);
  const quickClientHtml = await quickClient.text();
  assert.match(quickClientHtml, /Game Room/);
  assert.match(quickClientHtml, /Blackjack/);
  assert.match(quickClientHtml, /Dice Roll/);
  assert.match(quickClientHtml, /id="coin-tab"/);
  assert.match(quickClientHtml, /id="slot-style"/);
  assert.match(quickClientHtml, /id="slot-wheel"/);
  assert.doesNotMatch(quickClientHtml, /id="fortune-slots-tab"/);
  assert.doesNotMatch(quickClientHtml, /id="slot-theme"/);
  assert.match(quickClientHtml, /id="slot-rules-note"/);
  assert.match(quickClientHtml, /id="bet-summary"/);
  assert.match(quickClientHtml, /id="slot-button-panel"/);
  assert.match(quickClientHtml, /id="slot-credit-button"/);
  assert.match(quickClientHtml, /id="slot-spin-button"/);
  assert.match(quickClientHtml, /id="slot-max-button"/);
  assert.match(quickClientHtml, /CRÉDITO/);
  assert.match(quickClientHtml, /APUESTA MÁXIMA/);
  assert.match(quickClientHtml, /GIRAR/);
  assert.match(quickClientHtml, /id="sound-volume"/);
  assert.match(quickClientHtml, /id="bonus-voice-toggle"/);
  assert.match(quickClientHtml, /id="bonus-display"/);
  assert.match(quickClientHtml, /Automatic presentation/);
  assert.match(quickClientHtml, /3D WebGL reels · 8–10 per line/);
  assert.match(quickClientHtml, /id="page-celebration"/);
  assert.match(quickClientHtml, /id="experience-panel"/);
  assert.match(quickClientHtml, /id="session-insights-title"/);
  assert.match(quickClientHtml, /id="tutorial-dialog"/);
  assert.match(quickClientHtml, /id="app-loader"/);
  assert.match(quickClientHtml, /Phaser 4/);
  assert.match(quickClientHtml, /fx-controller\.js/);
  const scripts = [
    ...quickClientHtml.matchAll(/<script\s+src="([^"]+)"\s+defer><\/script>/g),
  ].map((match) => match[1]);
  assert.ok(scripts.includes("/client/slot-presentation.js"));
  assert.ok(
    scripts.indexOf("/client/slot-presentation.js") <
      scripts.indexOf("/client/app.js"),
  );
  const bonusAudioScript = await fetch(`${baseUrl}/client/bonus-audio.js`);
  assert.equal(bonusAudioScript.status, 200);
  assert.match(bonusAudioScript.headers.get("content-type"), /javascript/);
  const takeoverScript = await fetch(`${baseUrl}/client/fx-controller.js`);
  assert.equal(takeoverScript.status, 200);
  assert.match(await takeoverScript.text(), /triggerTakeover/);
  const coinClient = await fetch(`${baseUrl}/client?game=coin`);
  assert.equal(coinClient.status, 200);
  const quickClientScript = await fetch(`${baseUrl}/client/app.js`);
  assert.equal(quickClientScript.status, 200);
  assert.match(quickClientScript.headers.get("content-type"), /javascript/);
  const gameClientCode = await quickClientScript.text();
  assert.match(gameClientCode, /rouletteBallMotion/);
  assert.match(gameClientCode, /width: isSlotMode\(currentMode\) \? 720 : 360/);
  assert.match(gameClientCode, /card-reveal/);
  assert.match(gameClientCode, /diceBounceTween/);
  assert.match(gameClientCode, /coin-flip/);
  assert.match(gameClientCode, /win-coin/);
  assert.match(gameClientCode, /Phaser\.BlendModes\.ADD/);
  assert.match(gameClientCode, /prefers-reduced-motion/);
  assert.match(gameClientCode, /drawTableBackdrop\("roulette"\)/);
  assert.match(gameClientCode, /drawTableBackdrop\("slots"\)/);
  assert.match(gameClientCode, /FIVE REEL SLOTS/);
  assert.doesNotMatch(gameClientCode, /lucky-lounge-slot-theme/);
  assert.match(gameClientCode, /getMasterGainNode/);
  assert.match(gameClientCode, /650 \+ column \* 300/);
  assert.match(gameClientCode, /reel-tick/);
  assert.match(
    gameClientCode,
    /Math\.min\(10, Number\(betInput\.value\) \+ 1\)/,
  );
  assert.match(gameClientCode, /betInput\.value = "10"/);
  assert.match(gameClientCode, /this\.addText\(655, 38, "TOP BOX"/);
  assert.match(gameClientCode, /slotWinLights/);
  assert.match(gameClientCode, /reelSpinTimers/);
  assert.match(gameClientCode, /column \* 72/);
  assert.match(gameClientCode, /110 \+ column \* 8/);
  assert.match(
    gameClientCode,
    /reelTexts\[index\]\.setDisplaySize\(\s*this\.mode === "slots-3d" \? 58 : 52,\s*52,\s*\)/,
  );
  assert.match(
    gameClientCode,
    /text\.setDisplaySize\(\s*this\.mode === "slots-3d" \? 58 : 52,\s*56\s*\)/,
  );
  assert.match(gameClientCode, /stopSlotSpinTimers\(\)/);
  assert.match(
    gameClientCode,
    /document\s*\.querySelector\("\.controls"\)\s*\.classList\.toggle\("casino-deck", isSlots\)/,
  );
  const homeStyles = await fetch(`${baseUrl}/styles.css`);
  assert.equal(homeStyles.status, 200);
  const homeCss = await homeStyles.text();
  assert.match(homeCss, /@keyframes roulette-preview/);
  assert.match(homeCss, /@keyframes led-glow/);
  assert.match(homeCss, /\.gold-foil-text/);
  assert.match(homeCss, /@keyframes glint-sweep/);
  assert.match(homeCss, /\.game-filter\.active/);
  assert.match(homeCss, /\.roulette-art::before/);
  assert.match(homeCss, /\.game-empty-state\[hidden\]/);
  assert.match(
    await (await fetch(`${baseUrl}/app.js`)).text(),
    /function filterGames\(\)/,
  );
  const gameStyles = await fetch(`${baseUrl}/client/styles.css`);
  assert.equal(gameStyles.status, 200);
  const roomCss = await gameStyles.text();
  assert.doesNotMatch(roomCss, /action-led-glow/);
  assert.match(roomCss, /inset 0 1px rgba\(255, 255, 255, \.28\)/);
  assert.match(roomCss, /\.game-container\.casino-cabinet/);
  assert.match(roomCss, /\.slot-button-panel\.casino-deck/);
  assert.match(roomCss, /\.slot-spin-button/);
  assert.match(roomCss, /\.controls\.casino-deck > input/);
  assert.match(
    roomCss,
    /\.slot-button-panel \{\s*display: flex;\s*align-items: stretch;\s*width: min\(100%, 760px\);\s*gap: 6px/s,
  );
  assert.match(
    roomCss,
    /\.slot-deck-button span \{\s*color: #f8e2a5;\s*font-size: 15px/s,
  );
  assert.match(roomCss, /\.slot-spin-button span \{ font-size: 23px; \}/);
  assert.match(
    roomCss,
    /\.game-tab \{\s*min-height: 40px;[\s\S]*font-size: 14px;/,
  );
  assert.match(roomCss, /@keyframes slot-control-press/);
  assert.doesNotMatch(roomCss, /animation:\s*led-pulse/);
  assert.match(roomCss, /@media \(min-width: 521px\)/);
  assert.match(roomCss, /@media \(max-width: 520px\)/);
  assert.match(roomCss, /bet-preset\[aria-pressed="true"\]/);
  assert.match(quickClientHtml, /aria-label="Quick demo bet amounts"/);
  const phaserClient = await fetch(`${baseUrl}/client/phaser.min.js`);
  assert.equal(phaserClient.status, 200);
  assert.match(phaserClient.headers.get("content-type"), /javascript/);
  assert.match(quickClientHtml, /phaser\.min\.js/);
  const adminScript = await fetch(`${baseUrl}/admin.js`);
  assert.equal(adminScript.status, 200);
  const adminCode = await adminScript.text();
  assert.match(
    adminCode,
    /unreadable response \(HTTP \$\{response\.status\}\)/,
  );
  assert.match(adminCode, /Showing the last successful metrics/);
  assert.match(
    adminCode,
    /weights were updated, but the dashboard could not refresh/,
  );
  assert.match(adminCode, /aria-busy/);
  const adminStyles = await fetch(`${baseUrl}/admin.css`);
  assert.equal(adminStyles.status, 200);
  const adminCss = await adminStyles.text();
  assert.match(adminCss, /#message\[data-state="success"\]/);
  assert.match(adminCss, /#message\[data-state="error"\]/);

  const response = await fetch(`${baseUrl}/api/state`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).balance, 1000);
  assert.match(response.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
  assert.doesNotMatch(response.headers.get("set-cookie"), /;\sSecure/);

  const proxiedResponse = await fetch(`${baseUrl}/api/state`, {
    headers: { "X-Forwarded-Proto": "https" },
  });
  assert.equal(proxiedResponse.status, 200);
  assert.match(
    proxiedResponse.headers.get("set-cookie"),
    /HttpOnly; SameSite=Strict;[\s\S]*;\sSecure/,
  );
});

test("serves every registered static route and rejects unknown pages and methods", async () => {
  const routes = [
    ["/", /text\/html/],
    ["/favicon.ico", /image\/svg\+xml/],
    ["/favicon.svg", /image\/svg\+xml/],
    ["/styles.css", /text\/css/],
    ["/app.js", /javascript/],
    ["/soundtracks.js", /javascript/],
    ["/loading.css", /text\/css/],
    ["/assets/casino-entrance.jpg", /image\/jpeg/],
    ["/admin", /text\/html/],
    ["/admin/", /text\/html/],
    ["/admin.css", /text\/css/],
    ["/admin.js", /javascript/],
    ["/client", /text\/html/],
    ["/client/", /text\/html/],
    ["/client/styles.css", /text\/css/],
    ["/client/app.js", /javascript/],
    ["/client/bonus-audio.js", /javascript/],
    ["/client/slots-3d.js", /javascript/],
    ["/client/slot-presentation.js", /javascript/],
    ["/client/babylon.js", /javascript/],
    ["/client/phaser.min.js", /javascript/],
    ...["question", "seven", "cherry", "orange", "watermelon", "grapes"].map(
      (symbol) => [`/client/assets/slots/${symbol}.svg`, /image\/svg\+xml/],
    ),
  ];

  for (const [path, contentType] of routes) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200, `${path} should be served`);
    assert.match(
      response.headers.get("content-type"),
      contentType,
      `${path} should have the expected content type`,
    );
    assert.equal(
      response.headers.get("cache-control"),
      "no-cache",
      `${path} should be revalidated`,
    );
    assert.ok(
      (await response.arrayBuffer()).byteLength > 0,
      `${path} should not be empty`,
    );
  }

  for (const game of [
    "slots",
    "fortune-slots",
    "mechanical-slots",
    "slots-3d",
    "blackjack",
    "poker",
    "roulette",
    "coin",
    "dice",
  ]) {
    const response = await fetch(`${baseUrl}/client?game=${game}`);
    assert.equal(response.status, 200, `${game} game link should load`);
  }

  const missingPage = await fetch(`${baseUrl}/not-a-route`);
  assert.equal(missingPage.status, 404);
  const unsupportedMethod = await fetch(baseUrl, { method: "POST" });
  assert.equal(unsupportedMethod.status, 405);
  const missingApi = await fetch(`${baseUrl}/api/not-a-route`, {
    headers: { Origin: baseUrl },
  });
  assert.equal(missingApi.status, 404);
});

test("database health endpoint reports a healthy SQLite store", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.equal(health.ok, true);
  assert.equal(health.database.integrity, "ok");
  assert.equal(health.database.foreignKeysEnabled, true);
  assert.equal(health.database.malformedState, 0);
});

test("validates API content types, JSON bodies, and guest-only account actions", async () => {
  const stateResponse = await fetch(`${baseUrl}/api/state`);
  const cookie = stateResponse.headers.get("set-cookie").split(";")[0];
  const headers = {
    Cookie: cookie,
    Origin: baseUrl,
    "Content-Type": "application/json",
  };

  const account = await fetch(`${baseUrl}/api/account`);
  assert.deepEqual(await account.json(), { authenticated: false });

  const profile = await fetch(`${baseUrl}/api/account/profile`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      displayName: "Guest Player",
      leaderboardOptIn: false,
    }),
  });
  assert.equal(profile.status, 401);

  const reward = await fetch(`${baseUrl}/api/rewards/daily`, {
    method: "POST",
    headers,
    body: "{}",
  });
  assert.equal(reward.status, 401);

  const unsupportedContentType = await fetch(`${baseUrl}/api/play`, {
    method: "POST",
    headers: { Cookie: cookie, Origin: baseUrl, "Content-Type": "text/plain" },
    body: "{}",
  });
  assert.equal(unsupportedContentType.status, 415);

  const malformedJson = await fetch(`${baseUrl}/api/play`, {
    method: "POST",
    headers,
    body: "{invalid",
  });
  assert.equal(malformedJson.status, 400);
  assert.match((await malformedJson.json()).error, /valid JSON/i);

  const oversizedJson = await fetch(`${baseUrl}/api/play`, {
    method: "POST",
    headers,
    body: JSON.stringify({ unused: "x".repeat(1100) }),
  });
  assert.equal(oversizedJson.status, 413);
  assert.match((await oversizedJson.json()).error, /too large/i);
});

test("accounts transfer guest credits, claim one daily reward, and respect leaderboard opt-in", async () => {
  const stateResponse = await fetch(`${baseUrl}/api/state`);
  let cookie = stateResponse.headers.get("set-cookie").split(";")[0];
  const call = (path, body) =>
    fetch(`${baseUrl}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Cookie: cookie,
        Origin: baseUrl,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  const played = await call("/api/play", {
    game: "coin",
    bet: 10,
    choice: "heads",
    requestId: "registration-coin",
  });
  assert.equal(played.status, 200);
  const guestBalance = (await played.json()).balance;

  const email = `player-${Date.now()}@example.test`;
  const registration = await call("/api/auth/register", {
    email,
    password: "a-unique-password-123",
    displayName: "Progress Player",
    leaderboardOptIn: true,
  });
  assert.equal(registration.status, 201);
  const registered = await registration.json();
  assert.equal(registered.balance, guestBalance);
  assert.equal(registered.emailVerified, false);
  cookie = registration.headers.get("set-cookie").split(";")[0];

  const accountPlay = await call("/api/play", {
    game: "coin",
    bet: 1,
    choice: "heads",
    requestId: "account-coin",
  });
  assert.equal(accountPlay.status, 200);
  const playerAccount = await (await call("/api/account")).json();
  assert.equal(playerAccount.account.gamesPlayed, 1);
  assert.equal(playerAccount.account.games.coin, 1);
  assert.equal(playerAccount.account.games.dice, 0);
  assert.ok(
    playerAccount.account.achievements.some(
      (achievement) => achievement.title === "First Play",
    ),
  );
  const balanceBeforeReward = playerAccount.balance;

  const leaderboard = await (await call("/api/leaderboard")).json();
  assert.ok(
    leaderboard.entries.some(
      (entry) => entry.displayName === "Progress Player",
    ),
  );
  assert.equal(
    "email" in
      leaderboard.entries.find(
        (entry) => entry.displayName === "Progress Player",
      ),
    false,
  );

  const reward = await call("/api/rewards/daily", {});
  assert.equal(reward.status, 200);
  const rewarded = await reward.json();
  assert.equal(rewarded.balance, balanceBeforeReward + 100);
  assert.equal(rewarded.dailyRewardAvailable, false);
  assert.equal((await call("/api/rewards/daily", {})).status, 409);

  const optedOut = await call("/api/account/profile", {
    displayName: "Progress Player",
    leaderboardOptIn: false,
  });
  assert.equal(optedOut.status, 200);
  const optedOutLeaderboard = await (await call("/api/leaderboard")).json();
  assert.equal(
    optedOutLeaderboard.entries.some(
      (entry) => entry.displayName === "Progress Player",
    ),
    false,
  );

  const logout = await call("/api/auth/logout", {});
  assert.equal(logout.status, 200);
  cookie = logout.headers.get("set-cookie").split(";")[0];
  const login = await call("/api/auth/login", {
    email,
    password: "a-unique-password-123",
  });
  assert.equal(login.status, 200);
  assert.equal((await login.json()).balance, balanceBeforeReward + 100);
});

test("the local demo admin account can sign in without registration fields", async () => {
  const state = await fetch(`${baseUrl}/api/state`);
  const cookie = state.headers.get("set-cookie").split(";")[0];
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: baseUrl,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "admin@luckylounge.demo",
      password: "DemoAdmin!2026",
    }),
  });
  assert.equal(login.status, 200);
  const data = await login.json();
  assert.equal(data.authenticated, true);
  assert.equal(data.account.displayName, "Demo Admin");
  assert.equal(data.balance, 10000);
});

test("demo wallet simulates account-only transfers with idempotent retries and private history", async () => {
  const state = await fetch(`${baseUrl}/api/state`);
  let cookie = state.headers.get("set-cookie").split(";")[0];
  const call = (path, body, origin = baseUrl) =>
    fetch(`${baseUrl}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Cookie: cookie,
        Origin: origin,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  assert.equal((await call("/api/demo-wallet")).status, 401);
  assert.equal(
    (
      await call("/api/demo-wallet", {
        kind: "deposit",
        method: "paypal",
        amount: 100,
        requestId: "guest",
      })
    ).status,
    401,
  );
  const email = `wallet-${Date.now()}@example.test`;
  const registration = await call("/api/auth/register", {
    email,
    password: "a-unique-password-123",
    displayName: "Wallet Player",
    leaderboardOptIn: false,
  });
  assert.equal(registration.status, 201);
  cookie = registration.headers.get("set-cookie").split(";")[0];
  const deposit = {
    kind: "deposit",
    method: "paypal",
    amount: 150,
    requestId: "deposit-1",
  };
  assert.equal(
    (await call("/api/demo-wallet", deposit, "https://example.invalid")).status,
    403,
  );
  for (const invalid of [
    { ...deposit, amount: 0 },
    { ...deposit, amount: 10001 },
    { ...deposit, amount: 1.5 },
    { ...deposit, method: "real-provider" },
    { ...deposit, kind: "payment" },
    { ...deposit, requestId: "" },
  ])
    assert.equal((await call("/api/demo-wallet", invalid)).status, 400);
  const added = await (await call("/api/demo-wallet", deposit)).json();
  assert.equal(added.balance, 1150);
  assert.equal(added.transaction.balanceAfter, 1150);
  const removed = await (
    await call("/api/demo-wallet", {
      kind: "withdrawal",
      method: "bank",
      amount: 200,
      requestId: "withdraw-1",
    })
  ).json();
  assert.equal(removed.balance, 950);
  const duplicate = await (await call("/api/demo-wallet", deposit)).json();
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.balance, 950);
  assert.equal(
    (await call("/api/demo-wallet", { ...deposit, amount: 151 })).status,
    409,
  );
  assert.equal(
    (
      await call("/api/demo-wallet", {
        kind: "withdrawal",
        method: "paypal",
        amount: 951,
        requestId: "too-large",
      })
    ).status,
    409,
  );
  const history = await (await call("/api/demo-wallet")).json();
  assert.equal(history.balance, 950);
  assert.deepEqual(
    history.transactions.map(({ kind }) => kind),
    ["withdrawal", "deposit"],
  );
  const logout = await call("/api/auth/logout", {});
  cookie = logout.headers.get("set-cookie").split(";")[0];
  assert.equal((await call("/api/demo-wallet")).status, 401);
  const login = await call("/api/auth/login", {
    email,
    password: "a-unique-password-123",
  });
  cookie = login.headers.get("set-cookie").split(";")[0];
  const restored = await (await call("/api/demo-wallet")).json();
  assert.equal(restored.balance, 950);
  assert.equal(restored.transactions.length, 2);
  const secondLogout = await call("/api/auth/logout", {});
  cookie = secondLogout.headers.get("set-cookie").split(";")[0];
  const secondRegistration = await call("/api/auth/register", {
    email: `wallet-other-${Date.now()}@example.test`,
    password: "a-unique-password-123",
    displayName: "Wallet Other",
    leaderboardOptIn: false,
  });
  cookie = secondRegistration.headers.get("set-cookie").split(";")[0];
  const otherHistory = await (await call("/api/demo-wallet")).json();
  assert.equal(otherHistory.balance, 1000);
  assert.deepEqual(otherHistory.transactions, []);
});

test("rejects cross-origin play requests and invalid bet sizes", async () => {
  const stateResponse = await fetch(`${baseUrl}/api/state`);
  const cookie = stateResponse.headers.get("set-cookie").split(";")[0];
  const crossOrigin = await fetch(`${baseUrl}/api/play`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: "https://example.invalid",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ game: "coin", bet: 10, choice: "heads" }),
  });
  assert.equal(crossOrigin.status, 403);

  const invalidBet = await fetch(`${baseUrl}/api/play`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: baseUrl,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ game: "coin", bet: 101, choice: "heads" }),
  });
  assert.equal(invalidBet.status, 400);
});

test("validates Dice Roll choices and resolves the roll on the server", async () => {
  const stateResponse = await fetch(`${baseUrl}/api/state`);
  const cookie = stateResponse.headers.get("set-cookie").split(";")[0];
  const call = (choice) =>
    fetch(`${baseUrl}/api/play`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: baseUrl,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        game: "dice",
        bet: 10,
        choice,
        requestId: `dice-choice-${choice}`,
      }),
    });

  const invalid = await call(7);
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /die face from 1 to 6/);

  const response = await call(4);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(result.result.number >= 1 && result.result.number <= 6);
  assert.equal(result.result.choice, 4);
  assert.equal(result.payout, result.result.number === 4 ? 50 : 0);
  assert.equal(result.balance, 990 + result.payout);
});

test("plays through an authenticated same-origin socket and updates the session balance", async () => {
  const stateResponse = await fetch(`${baseUrl}/api/state`);
  const cookie = stateResponse.headers.get("set-cookie").split(";")[0];
  const client = createSocketClient(baseUrl, {
    transports: ["websocket"],
    extraHeaders: { Cookie: cookie, Origin: baseUrl },
    reconnection: false,
  });

  try {
    const connected = new Promise((resolve, reject) => {
      client.once("connect", resolve);
      client.once("connect_error", reject);
    });
    const initialBalance = new Promise((resolve) =>
      client.once("balance_update", resolve),
    );
    await connected;
    assert.equal(await initialBalance, 1000);

    const result = new Promise((resolve, reject) => {
      client.once("spin_result", resolve);
      client.once("game_error", (error) => reject(new Error(error.error)));
    });
    const updatedBalance = new Promise((resolve) =>
      client.once("balance_update", resolve),
    );
    client.emit("place_bet", {
      game: "coin",
      bet: 10,
      choice: "heads",
      requestId: "test-1",
    });
    const response = await result;
    assert.equal(response.requestId, "test-1");
    assert.ok([0, 20].includes(response.payout));
    assert.equal(response.balance, 990 + response.payout);
    assert.equal(await updatedBalance, response.balance);
  } finally {
    client.disconnect();
  }
});

test("instant game commands return the persisted receipt and reject requestId conflicts", async () => {
  const stateResponse = await fetch(`${baseUrl}/api/state`);
  const cookie = stateResponse.headers.get("set-cookie").split(";")[0];
  const headers = {
    Cookie: cookie,
    Origin: baseUrl,
    "Content-Type": "application/json",
  };
  const command = {
    game: "coin",
    bet: 10,
    choice: "heads",
    requestId: "idempotent-coin-http",
  };

  const firstResponse = await fetch(`${baseUrl}/api/play`, {
    method: "POST",
    headers,
    body: JSON.stringify(command),
  });
  assert.equal(firstResponse.status, 200);
  const first = await firstResponse.json();

  const replayResponse = await fetch(`${baseUrl}/api/play`, {
    method: "POST",
    headers,
    body: JSON.stringify(command),
  });
  assert.equal(replayResponse.status, 200);
  assert.deepEqual(await replayResponse.json(), first);

  const stateAfterReplay = await fetch(`${baseUrl}/api/state`, { headers });
  assert.equal((await stateAfterReplay.json()).balance, first.balance);

  const conflictResponse = await fetch(`${baseUrl}/api/play`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...command, choice: "tails" }),
  });
  assert.equal(conflictResponse.status, 409);
  const conflict = await conflictResponse.json();
  assert.equal(conflict.code, "request_conflict");
});

test("rejects Blackjack through the instant play endpoint and preserves its stateful flow", async () => {
  const stateResponse = await fetch(`${baseUrl}/api/state`);
  const cookie = stateResponse.headers.get("set-cookie").split(";")[0];
  const response = await fetch(`${baseUrl}/api/play`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: baseUrl,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      game: "blackjack",
      bet: 10,
      requestId: "legacy-blackjack",
    }),
  });
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /persistent deal\/action flow/);
});

test("Socket.IO replays the same instant command without changing the balance", async () => {
  const stateResponse = await fetch(`${baseUrl}/api/state`);
  const cookie = stateResponse.headers.get("set-cookie").split(";")[0];
  const client = createSocketClient(baseUrl, {
    transports: ["websocket"],
    extraHeaders: { Cookie: cookie, Origin: baseUrl },
    reconnection: false,
  });
  try {
    await new Promise((resolve, reject) => {
      client.once("connect", resolve);
      client.once("connect_error", reject);
    });
    const command = {
      game: "coin",
      bet: 15,
      choice: "tails",
      requestId: "idempotent-coin-socket",
    };
    const firstEvent = waitForSocketEvent(client, [
      "spin_result",
      "game_error",
    ]);
    client.emit("place_bet", command);
    const first = await firstEvent;
    assert.equal(first.event, "spin_result");

    const replayEvent = waitForSocketEvent(client, [
      "spin_result",
      "game_error",
    ]);
    client.emit("place_bet", command);
    const replay = await replayEvent;
    assert.equal(replay.event, "spin_result");
    assert.deepEqual(replay.data, first.data);

    const conflictEvent = waitForSocketEvent(client, [
      "spin_result",
      "game_error",
    ]);
    client.emit("place_bet", { ...command, choice: "heads" });
    const conflict = await conflictEvent;
    assert.equal(conflict.event, "game_error");
    assert.equal(conflict.data.code, "request_conflict");
  } finally {
    client.disconnect();
  }
});

test("rejects cross-origin socket handshakes", async () => {
  const stateResponse = await fetch(`${baseUrl}/api/state`);
  const cookie = stateResponse.headers.get("set-cookie").split(";")[0];
  const client = createSocketClient(baseUrl, {
    transports: ["websocket"],
    extraHeaders: { Cookie: cookie, Origin: "https://example.invalid" },
    reconnection: false,
    timeout: 2000,
  });

  try {
    const error = await new Promise((resolve, reject) => {
      client.once("connect", () =>
        reject(new Error("Cross-origin socket connected unexpectedly.")),
      );
      client.once("connect_error", resolve);
    });
    assert.match(
      error.message,
      /websocket error|xhr poll error|connection error/i,
    );
  } finally {
    client.disconnect();
  }
});

test("plays an authenticated blackjack hand through server-authoritative socket events", async () => {
  const stateResponse = await fetch(`${baseUrl}/api/state`);
  const cookie = stateResponse.headers.get("set-cookie").split(";")[0];
  const client = createSocketClient(baseUrl, {
    transports: ["websocket"],
    extraHeaders: { Cookie: cookie, Origin: baseUrl },
    reconnection: false,
  });

  try {
    const connected = new Promise((resolve, reject) => {
      client.once("connect", resolve);
      client.once("connect_error", reject);
    });
    await connected;

    let responseEvent = waitForSocketEvent(client, [
      "blackjack_start",
      "blackjack_over",
      "game_error",
    ]);
    client.emit("blackjack_deal", { bet: 10, requestId: "bj-deal-1" });
    let response = await responseEvent;
    assert.notEqual(response.event, "game_error", response.data?.error);
    assert.equal(response.data.requestId, "bj-deal-1");

    if (response.event === "blackjack_start") {
      assert.equal(response.data.state.status, "playing");
      assert.deepEqual(response.data.state.dealer[1], { hidden: true });

      responseEvent = waitForSocketEvent(client, ["game_error"]);
      client.emit("blackjack_deal", {
        bet: 10,
        requestId: "bj-deal-duplicate",
      });
      const duplicate = await responseEvent;
      assert.match(duplicate.data.error, /current blackjack hand/);

      responseEvent = waitForSocketEvent(client, [
        "blackjack_over",
        "game_error",
      ]);
      client.emit("blackjack_action", {
        action: "stand",
        requestId: "bj-stand-1",
      });
      response = await responseEvent;
      assert.equal(response.event, "blackjack_over", response.data?.error);
      assert.equal(response.data.requestId, "bj-stand-1");
    } else {
      assert.equal(response.data.state.status, "finished");
    }

    assert.equal(response.data.balance, 990 + response.data.payout);
    assert.equal(response.data.state.dealer[1].hidden, undefined);
  } finally {
    client.disconnect();
  }
});

test("supports a server-validated blackjack split and double down", async () => {
  const sessionResponse = await fetch(`${baseUrl}/api/state`);
  const cookie = sessionResponse.headers.get("set-cookie").split(";")[0];
  const sessionId = cookie.slice(cookie.indexOf("=") + 1);
  const firstHand = {
    bet: 10,
    deck: [
      { rank: "6", suit: "clubs" },
      { rank: "4", suit: "clubs" },
      { rank: "3", suit: "clubs" },
    ],
    player: [
      { rank: "8", suit: "hearts" },
      { rank: "8", suit: "spades" },
    ],
    dealer: [
      { rank: "10", suit: "clubs" },
      { rank: "6", suit: "diamonds" },
    ],
    status: "playing",
    outcome: null,
    payout: 0,
  };
  store.update(sessionId, { balance: 990, blackjack: firstHand, poker: null });
  const client = createSocketClient(baseUrl, {
    transports: ["websocket"],
    extraHeaders: { Cookie: cookie, Origin: baseUrl },
    reconnection: false,
  });

  try {
    await new Promise((resolve, reject) => {
      client.once("connect", resolve);
      client.once("connect_error", reject);
    });
    const splitResponse = waitForSocketEvent(client, [
      "blackjack_update",
      "game_error",
    ]);
    client.emit("blackjack_action", {
      action: "split",
      requestId: "bj-split-1",
    });
    const split = await splitResponse;
    assert.equal(split.event, "blackjack_update", split.data?.error);
    assert.equal(split.data.balance, 980);
    assert.equal(split.data.state.hands.length, 2);

    const nextSessionResponse = await fetch(`${baseUrl}/api/state`);
    const nextCookie = nextSessionResponse.headers
      .get("set-cookie")
      .split(";")[0];
    const nextSessionId = nextCookie.slice(nextCookie.indexOf("=") + 1);
    const doubleHand = {
      bet: 10,
      deck: [
        { rank: "K", suit: "clubs" },
        { rank: "5", suit: "clubs" },
      ],
      player: [
        { rank: "10", suit: "clubs" },
        { rank: "6", suit: "hearts" },
      ],
      dealer: [
        { rank: "10", suit: "diamonds" },
        { rank: "6", suit: "spades" },
      ],
      status: "playing",
      outcome: null,
      payout: 0,
    };
    store.update(nextSessionId, {
      balance: 990,
      blackjack: doubleHand,
      poker: null,
    });
    const doubleClient = createSocketClient(baseUrl, {
      transports: ["websocket"],
      extraHeaders: { Cookie: nextCookie, Origin: baseUrl },
      reconnection: false,
    });
    try {
      await new Promise((resolve, reject) => {
        doubleClient.once("connect", resolve);
        doubleClient.once("connect_error", reject);
      });
      const doubleResponse = waitForSocketEvent(doubleClient, [
        "blackjack_over",
        "game_error",
      ]);
      doubleClient.emit("blackjack_action", {
        action: "double",
        requestId: "bj-double-1",
      });
      const doubled = await doubleResponse;
      assert.equal(doubled.event, "blackjack_over", doubled.data?.error);
      assert.equal(doubled.data.balance, 1020);
      assert.equal(doubled.data.payout, 40);
    } finally {
      doubleClient.disconnect();
    }
  } finally {
    client.disconnect();
  }
});

test("plays video poker through server-authoritative deal and draw events", async () => {
  const stateResponse = await fetch(`${baseUrl}/api/state`);
  const cookie = stateResponse.headers.get("set-cookie").split(";")[0];
  const sessionId = cookie.slice(cookie.indexOf("=") + 1);
  const client = createSocketClient(baseUrl, {
    transports: ["websocket"],
    extraHeaders: { Cookie: cookie, Origin: baseUrl },
    reconnection: false,
  });
  try {
    await new Promise((resolve, reject) => {
      client.once("connect", resolve);
      client.once("connect_error", reject);
    });
    const dealResponse = waitForSocketEvent(client, [
      "video_poker_start",
      "game_error",
    ]);
    client.emit("video_poker_deal", { bet: 10, requestId: "poker-deal-1" });
    const dealt = await dealResponse;
    assert.equal(dealt.event, "video_poker_start", dealt.data?.error);
    assert.equal(dealt.data.balance, 990);
    assert.equal(dealt.data.state.cards.length, 5);
    assert.equal(store.get(sessionId).poker.status, "draw");

    const resultResponse = waitForSocketEvent(client, [
      "video_poker_result",
      "game_error",
    ]);
    client.emit("video_poker_draw", {
      holds: [0, 1, 2, 3, 4],
      requestId: "poker-draw-1",
    });
    const result = await resultResponse;
    assert.equal(result.event, "video_poker_result", result.data?.error);
    assert.equal(result.data.state.status, "finished");
    assert.ok(Number.isInteger(result.data.payout));
    assert.equal(result.data.balance, 990 + result.data.payout);
    assert.equal(store.get(sessionId).poker, null);
  } finally {
    client.disconnect();
  }
});

test("admin metrics and slot controls require a configured token", async () => {
  const priorToken = process.env.ADMIN_TOKEN;
  const token = "local-admin-token-that-is-at-least-32-characters";
  const endpoint = `${baseUrl}/api/admin/metrics`;
  try {
    delete process.env.ADMIN_TOKEN;
    const disabled = await fetch(endpoint, { headers: { Origin: baseUrl } });
    assert.equal(disabled.status, 503);

    process.env.ADMIN_TOKEN = token;
    const unauthorized = await fetch(endpoint, {
      headers: { Origin: baseUrl },
    });
    assert.equal(unauthorized.status, 401);

    const headers = { Origin: baseUrl, "X-Admin-Token": token };
    const metricsResponse = await fetch(endpoint, { headers });
    assert.equal(metricsResponse.status, 200);
    const metrics = await metricsResponse.json();
    assert.ok(Number.isInteger(metrics.activeSockets));
    assert.ok(metrics.walletCredits >= 0);
    assert.ok(metrics.maximumUnsettledPayout >= 0);

    const healthResponse = await fetch(`${baseUrl}/api/admin/health`, {
      headers,
    });
    assert.equal(healthResponse.status, 200);
    const health = await healthResponse.json();
    assert.equal(health.ok, true);
    assert.equal(health.database.integrity, "ok");

    const usersResponse = await fetch(
      `${baseUrl}/api/admin/users?search=admin@luckylounge.demo`,
      { headers },
    );
    assert.equal(usersResponse.status, 200);
    assert.equal(
      (await usersResponse.json()).users[0].email,
      "admin@luckylounge.demo",
    );

    const changedWeights = {
      SEVEN: 1,
      WATERMELON: 1,
      GRAPES: 1,
      ORANGE: 1,
      CHERRY: 1,
    };
    const update = await fetch(`${baseUrl}/api/admin/slot-weights`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ weights: changedWeights }),
    });
    assert.equal(update.status, 200);
    assert.deepEqual((await update.json()).slots.weights, changedWeights);

    const invalid = await fetch(`${baseUrl}/api/admin/slot-weights`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ weights: { SEVEN: 0 } }),
    });
    assert.equal(invalid.status, 400);

    const restore = await fetch(`${baseUrl}/api/admin/slot-weights`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ weights: metrics.slots.weights }),
    });
    assert.equal(restore.status, 200);

    const invalidCredit = await fetch(`${baseUrl}/api/admin/credits`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@luckylounge.demo", amount: 0 }),
    });
    assert.equal(invalidCredit.status, 400);
    const beforeCredit = await fetch(
      `${baseUrl}/api/admin/users?search=admin@luckylounge.demo`,
      { headers },
    );
    const beforeBalance = (await beforeCredit.json()).users[0].balance;
    const credit = await fetch(`${baseUrl}/api/admin/credits`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@luckylounge.demo",
        amount: 25,
        note: "Automated test",
      }),
    });
    assert.equal(credit.status, 200);
    const adjustment = (await credit.json()).adjustment;
    assert.equal(adjustment.balanceBefore, beforeBalance);
    assert.equal(adjustment.balanceAfter, beforeBalance + 25);
  } finally {
    if (priorToken === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = priorToken;
  }
});

test("resolves roulette spins on the server and returns the winning wheel number", async () => {
  const stateResponse = await fetch(`${baseUrl}/api/state`);
  const cookie = stateResponse.headers.get("set-cookie").split(";")[0];
  const client = createSocketClient(baseUrl, {
    transports: ["websocket"],
    extraHeaders: { Cookie: cookie, Origin: baseUrl },
    reconnection: false,
  });

  try {
    const connected = new Promise((resolve, reject) => {
      client.once("connect", resolve);
      client.once("connect_error", reject);
    });
    await connected;

    const responseEvent = waitForSocketEvent(client, [
      "spin_result",
      "game_error",
    ]);
    client.emit("place_bet", {
      game: "roulette",
      bet: 10,
      choice: 17,
      requestId: "roulette-1",
    });
    const { event, data } = await responseEvent;
    assert.equal(event, "spin_result", data?.error);
    assert.equal(data.requestId, "roulette-1");
    assert.equal(data.game, "roulette");
    assert.ok(data.result.number >= 0 && data.result.number <= 36);
    assert.equal(data.result.choice, 17);
    assert.equal(data.payout, data.result.number === 17 ? 360 : 0);
    assert.equal(data.balance, 990 + data.payout);
  } finally {
    client.disconnect();
  }
});

test("settles a 10-line slot wager once and rejects an over-limit line bet", async () => {
  const stateResponse = await fetch(`${baseUrl}/api/state`);
  const cookie = stateResponse.headers.get("set-cookie").split(";")[0];
  const request = (bet) =>
    fetch(`${baseUrl}/api/play`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: baseUrl,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        game: "slots",
        bet,
        requestId: `slot-line-bet-${bet}`,
      }),
    });

  const play = await request(3);
  assert.equal(play.status, 200);
  const response = await play.json();
  assert.equal(response.bet, 30);
  assert.equal(response.lineBet, 3);
  assert.equal(response.net, response.payout - 30);
  assert.equal(response.balance, 970 + response.payout);
  assert.equal(response.result.reels.length, 5);
  assert.ok(response.result.reels.every((reel) => reel.length === 3));
  assert.equal(response.result.bonusGrid.length, 3);

  const invalid = await request(11);
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /line bet.*1 to 10/i);
});

test("Fortune Slots settles the wheel and enforces the same ten-line wager limit", async () => {
  const stateResponse = await fetch(`${baseUrl}/api/state`);
  const cookie = stateResponse.headers.get("set-cookie").split(";")[0];
  const request = (bet) =>
    fetch(`${baseUrl}/api/play`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: baseUrl,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        game: "fortune-slots",
        bet,
        requestId: `fortune-line-bet-${bet}`,
      }),
    });
  const play = await request(3);
  assert.equal(play.status, 200);
  const response = await play.json();
  assert.equal(response.bet, 30);
  assert.equal(response.lineBet, 3);
  assert.equal(
    response.payout,
    response.result.linePayout +
      response.result.bonusPayout +
      response.result.fortuneWheel.payout,
  );
  assert.equal(response.balance, 970 + response.payout);
  assert.equal(response.net, response.payout - 30);
  assert.equal((await request(11)).status, 400);
});
