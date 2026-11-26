const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const players = new Map();
const VALID_BETS = [50, 100, 250, 500];

const NICKNAMES = [
  'BajaShark', 'SolisVIP', 'MareaAlta', 'Tijuana Ace',
  'Rosarito99', 'DoradoSpin', 'CaboHigh', 'NorteKing'
];

function randomNick() {
  return NICKNAMES[Math.floor(Math.random() * NICKNAMES.length)];
}

function broadcastWin(entry) {
  io.emit('liveWin', {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    player: entry.player,
    game: entry.game,
    amount: entry.amount,
    detail: entry.detail
  });
}

// Seed a couple initial live feed items so the lobby feels alive immediately
setTimeout(() => {
  broadcastWin({ player: 'DoradoSpin', game: 'Roulette 3D', amount: 1400, detail: '0 GREEN 14x' });
  broadcastWin({ player: 'MareaAlta', game: 'Rising Rockets', amount: 1250, detail: '5.00x Boost' });
}, 600);

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

  // Free reload / daily bonus (every 60s for testing/playability)
  socket.on('claimBonus', () => {
    const p = players.get(socket.id);
    if (!p) return;
    const now = Date.now();
    const cooldown = 60 * 1000;
    if (now - p.lastBonusAt < cooldown) {
      const waitSec = Math.ceil((cooldown - (now - p.lastBonusAt)) / 1000);
      socket.emit('bonusStatus', { ok: false, message: `Reload ready in ${waitSec}s` });
      return;
    }
    p.lastBonusAt = now;
    const reward = p.chips < 200 ? 1000 : 500;
    p.chips += reward;
    socket.emit('balanceUpdate', p.chips);
    socket.emit('bonusStatus', { ok: true, message: `+${reward} VIP Bonus added!` });
  });

  // 1. Roulette 3D
  socket.on('spinRoulette', ({ betAmount = 100, choice }) => {
    const p = players.get(socket.id);
    if (!p || !VALID_BETS.includes(betAmount) || betAmount > p.chips) return;

    p.chips -= betAmount;
    const outcomeNumber = Math.floor(Math.random() * 15);
    const outcomeColor =
      outcomeNumber === 0 ? 'green' : outcomeNumber <= 7 ? 'red' : 'black';

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

  // 2. Interactive Rising Rockets (Start -> Live Climb -> Cash Out or Crash)
  socket.on('startRocket', ({ betAmount = 100 }) => {
    const p = players.get(socket.id);
    if (!p || !VALID_BETS.includes(betAmount) || betAmount > p.chips || p.activeRocket) return;

    p.chips -= betAmount;
    socket.emit('balanceUpdate', p.chips);

    const r = Math.random();
    let crashPoint = 1.0 + Math.pow(-Math.log(Math.max(0.0001, r)), 1.12) * 1.55;
    const prizeBoost = Math.random() < 0.22;
    if (prizeBoost) crashPoint *= 1.35;
    crashPoint = Number(Math.min(25, Math.max(1.05, crashPoint)).toFixed(2));
    const bigBang = crashPoint <= 1.25;

    const startTime = Date.now();
    const rocketSession = {
      betAmount,
      crashPoint,
      prizeBoost,
      bigBang,
      startTime,
      cashedOut: false,
      timer: null
    };
    p.activeRocket = rocketSession;

    // Server enforces crash when elapsed multiplier reaches crashPoint
    const msToCrash = Math.min(14000, Math.max(600, (crashPoint - 1) * 1800));
    rocketSession.timer = setTimeout(() => {
      if (!p.activeRocket || p.activeRocket !== rocketSession || rocketSession.cashedOut) return;
      p.activeRocket = null;
      socket.emit('rocketCrashed', {
        crashPoint,
        prizeBoost,
        bigBang,
        newBalance: p.chips
      });
    }, msToCrash);

    socket.emit('rocketStarted', {
      betAmount,
      prizeBoost,
      bigBang
    });
  });

  socket.on('cashoutRocket', () => {
    const p = players.get(socket.id);
    if (!p || !p.activeRocket || p.activeRocket.cashedOut) return;

    const session = p.activeRocket;
    const elapsedSec = (Date.now() - session.startTime) / 1000;
    const currentMult = Number(Math.min(session.crashPoint, 1 + elapsedSec * 0.55).toFixed(2));
    const finalMult = Math.max(1.05, currentMult);

    session.cashedOut = true;
    clearTimeout(session.timer);
    p.activeRocket = null;

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

  // 3. 3D Mega Slots
  socket.on('spinSlots', ({ betAmount = 100 }) => {
    const p = players.get(socket.id);
    if (!p || !VALID_BETS.includes(betAmount) || betAmount > p.chips) return;

    p.chips -= betAmount;
    const symbols = ['7', 'DIAMOND', 'BELL', 'CHERRY', 'STAR'];
    const weights = [0.12, 0.18, 0.22, 0.26, 0.22];

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
    if (p && p.activeRocket && p.activeRocket.timer) {
      clearTimeout(p.activeRocket.timer);
    }
    players.delete(socket.id);
    io.emit('onlineCount', io.engine.clientsCount);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Baja Casino Pro Lobby server running on port ${PORT}`);
});
