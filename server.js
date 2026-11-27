const express = require('express');
const http = require('node:http');
const { Server } = require('socket.io');
const path = require('node:path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'baja-casino', uptime: process.uptime() });
});

const players = new Map();
const VALID_BETS = new Set([50, 100, 250, 500]);
const ROCKET_GROWTH_PER_SEC = 0.55;

const NICKNAMES = [
  'BajaShark', 'SolisVIP', 'MareaAlta', 'TijuanaAce',
  'Rosarito99', 'DoradoSpin', 'CaboHigh', 'NorteKing'
];

function randomNick() {
  return NICKNAMES[Math.floor(Math.random() * NICKNAMES.length)];
}

function broadcastWin(entry) {
  io.emit('liveWin', {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    player: entry.player,
    game: entry.game,
    amount: entry.amount,
    detail: entry.detail
  });
}

function clearRocketSession(player) {
  if (player?.activeRocket) {
    if (player.activeRocket.timer) {
      clearTimeout(player.activeRocket.timer);
    }
    player.activeRocket = null;
  }
}

setTimeout(() => {
  broadcastWin({ player: 'DoradoSpin', game: 'Roulette 3D', amount: 1400, detail: '0 GREEN 14x' });
  broadcastWin({ player: 'MareaAlta', game: 'Rising Rockets', amount: 1250, detail: '5.00x BOOST' });
}, 800);

io.on('connection', (socket) => {
  const nick = randomNick();
  players.set(socket.id, {
    chips: 1000,
    nick,
    lastBonusAt: 0,
    activeRocket: null
  });

  socket.emit('initState', {
    chips: 1000,
    nick,
    onlineCount: io.engine.clientsCount
  });
  io.emit('onlineCount', io.engine.clientsCount);

  socket.on('claimBonus', () => {
    const p = players.get(socket.id);
    if (!p) return;

    const now = Date.now();
    const cooldownMs = 30 * 1000;
    if (now - p.lastBonusAt < cooldownMs) {
      const waitSec = Math.ceil((cooldownMs - (now - p.lastBonusAt)) / 1000);
      socket.emit('bonusStatus', { ok: false, message: `⏳ VIP Reload ready in ${waitSec}s` });
      return;
    }

    p.lastBonusAt = now;
    const reward = p.chips < 250 ? 1000 : 500;
    p.chips += reward;
    socket.emit('balanceUpdate', p.chips);
    socket.emit('bonusStatus', { ok: true, message: `🎁 +${reward} VIP Chips credited!` });
  });

  socket.on('spinRoulette', (payload = {}) => {
    const p = players.get(socket.id);
    const betAmount = Number(payload.betAmount);
    const choice = payload.choice;
    if (!p || !VALID_BETS.has(betAmount) || !['red', 'green', 'black'].includes(choice)) {
      socket.emit('actionError', 'Invalid bet selection.');
      return;
    }
    if (betAmount > p.chips) {
      socket.emit('actionError', 'Not enough chips! Tap + RELOAD for free chips.');
      return;
    }

    p.chips -= betAmount;
    socket.emit('balanceUpdate', p.chips);

    const outcomeNumber = Math.floor(Math.random() * 15);
    let outcomeColor;
    if (outcomeNumber === 0) {
      outcomeColor = 'green';
    } else if (outcomeNumber <= 7) {
      outcomeColor = 'red';
    } else {
      outcomeColor = 'black';
    }

    let winAmount = 0;
    if (choice === outcomeColor) {
      winAmount = choice === 'green' ? betAmount * 14 : betAmount * 2;
      p.chips += winAmount;
    }

    socket.emit('rouletteResult', {
      outcomeNumber,
      outcomeColor,
      winAmount,
      newBalance: p.chips
    });

    if (winAmount >= 500) {
      broadcastWin({
        player: p.nick,
        game: 'Roulette 3D',
        amount: winAmount,
        detail: `${outcomeNumber} ${outcomeColor.toUpperCase()}`
      });
    }
  });

  socket.on('startRocket', (payload = {}) => {
    const p = players.get(socket.id);
    const betAmount = Number(payload.betAmount);
    if (!p || !VALID_BETS.has(betAmount)) {
      socket.emit('actionError', 'Invalid bet amount.');
      return;
    }
    if (p.activeRocket) {
      socket.emit('actionError', 'Rocket already in flight!');
      return;
    }
    if (betAmount > p.chips) {
      socket.emit('actionError', 'Not enough chips! Tap + RELOAD for free chips.');
      return;
    }

    p.chips -= betAmount;
    socket.emit('balanceUpdate', p.chips);

    const r = Math.random();
    let crashPoint = 1.05 + Math.pow(-Math.log(Math.max(0.0005, r)), 1.1) * 1.4;
    const prizeBoost = Math.random() < 0.24;
    if (prizeBoost) crashPoint *= 1.35;
    crashPoint = Number(Math.min(25, Math.max(1.1, crashPoint)).toFixed(2));
    const bigBang = crashPoint <= 1.28;

    const startTime = Date.now();
    const msToCrash = Math.min(15000, Math.max(500, ((crashPoint - 1) / ROCKET_GROWTH_PER_SEC) * 1000));

    const session = {
      betAmount,
      crashPoint,
      prizeBoost,
      bigBang,
      startTime,
      settled: false,
      timer: null
    };

    session.timer = setTimeout(() => {
      if (!p.activeRocket || p.activeRocket !== session || session.settled) return;
      session.settled = true;
      p.activeRocket = null;
      socket.emit('rocketCrashed', {
        crashPoint,
        prizeBoost,
        bigBang,
        newBalance: p.chips
      });
    }, msToCrash);

    p.activeRocket = session;

    socket.emit('rocketStarted', {
      betAmount,
      prizeBoost,
      bigBang,
      growthPerSec: ROCKET_GROWTH_PER_SEC
    });
  });

  socket.on('cashoutRocket', () => {
    const p = players.get(socket.id);
    if (!p?.activeRocket || p.activeRocket.settled) return;

    const session = p.activeRocket;
    const elapsedSec = Math.max(0, (Date.now() - session.startTime) / 1000);
    const liveMult = 1 + elapsedSec * ROCKET_GROWTH_PER_SEC;

    if (liveMult >= session.crashPoint) {
      session.settled = true;
      clearTimeout(session.timer);
      p.activeRocket = null;
      socket.emit('rocketCrashed', {
        crashPoint: session.crashPoint,
        prizeBoost: session.prizeBoost,
        bigBang: session.bigBang,
        newBalance: p.chips
      });
      return;
    }

    session.settled = true;
    clearTimeout(session.timer);
    p.activeRocket = null;

    const finalMult = Number(Math.max(1.05, liveMult).toFixed(2));
    const winAmount = Math.floor(session.betAmount * finalMult);
    p.chips += winAmount;

    socket.emit('rocketCashed', {
      multiplier: finalMult,
      crashPoint: session.crashPoint,
      prizeBoost: session.prizeBoost,
      winAmount,
      newBalance: p.chips
    });

    if (winAmount >= 300) {
      broadcastWin({
        player: p.nick,
        game: 'Rising Rockets',
        amount: winAmount,
        detail: `${finalMult.toFixed(2)}x${session.prizeBoost ? ' BOOST' : ''}`
      });
    }
  });

  socket.on('cancelRocketPreview', () => {
    const p = players.get(socket.id);
    if (p?.activeRocket?.settled) {
      clearRocketSession(p);
    }
  });

  socket.on('spinSlots', (payload = {}) => {
    const p = players.get(socket.id);
    const betAmount = Number(payload.betAmount);
    if (!p || !VALID_BETS.has(betAmount)) {
      socket.emit('actionError', 'Invalid bet amount.');
      return;
    }
    if (betAmount > p.chips) {
      socket.emit('actionError', 'Not enough chips! Tap + RELOAD for free chips.');
      return;
    }

    p.chips -= betAmount;
    socket.emit('balanceUpdate', p.chips);

    const symbols = ['7', 'DIAMOND', 'BELL', 'CHERRY', 'STAR'];
    const weights = [0.14, 0.18, 0.22, 0.24, 0.22];

    function pickSymbol() {
      let roll = Math.random();
      for (let i = 0; i < symbols.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return symbols[i];
      }
      return 'CHERRY';
    }

    const reels = [pickSymbol(), pickSymbol(), pickSymbol()];
    let mult = 0;
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      const tripleMap = { '7': 25, DIAMOND: 12, STAR: 8, BELL: 6, CHERRY: 4 };
      mult = tripleMap[reels[0]] || 4;
    } else if (reels[0] === reels[1] || reels[1] === reels[2]) {
      mult = 1.5;
    }

    const winAmount = Math.floor(betAmount * mult);
    p.chips += winAmount;

    socket.emit('slotsResult', {
      reels,
      mult,
      winAmount,
      newBalance: p.chips
    });

    if (winAmount >= 500) {
      broadcastWin({
        player: p.nick,
        game: '3D Mega Slots',
        amount: winAmount,
        detail: `${reels[0]} ${reels[1]} ${reels[2]}`
      });
    }
  });

  socket.on('disconnect', () => {
    const p = players.get(socket.id);
    clearRocketSession(p);
    players.delete(socket.id);
    io.emit('onlineCount', io.engine.clientsCount);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Baja Casino Pro Lobby server running on port ${PORT}`);
});

function shutdown(signal) {
  console.log(`Received ${signal}, closing server cleanly...`);
  for (const p of players.values()) {
    clearRocketSession(p);
  }
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 2000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
