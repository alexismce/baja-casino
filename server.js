const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const players = new Map();

io.on('connection', (socket) => {
  players.set(socket.id, { chips: 1000 });
  socket.emit('balanceUpdate', 1000);

  // 1. Pro 3D Roulette
  socket.on('spinRoulette', ({ betAmount = 100, choice }) => {
    const player = players.get(socket.id);
    const validBets = [50, 100, 250, 500];
    if (!player || !validBets.includes(betAmount) || betAmount > player.chips) return;

    player.chips -= betAmount;

    const outcomeNumber = Math.floor(Math.random() * 15);
    const outcomeColor =
      outcomeNumber === 0 ? 'green' : outcomeNumber <= 7 ? 'red' : 'black';

    let winAmount = 0;
    if (choice === outcomeColor) {
      winAmount = choice === 'green' ? betAmount * 14 : betAmount * 2;
      player.chips += winAmount;
    }

    socket.emit('rouletteResult', {
      outcomeNumber,
      outcomeColor,
      winAmount,
      newBalance: player.chips
    });
  });

  // 2. Pro 3D Rising Rockets (with Prize Boost & Big Bang)
  socket.on('launchRocket', ({ betAmount = 100, cashoutAt = 2.0 }) => {
    const player = players.get(socket.id);
    const validBets = [50, 100, 250, 500];
    const targetMult = Math.max(1.1, Math.min(25, Number(cashoutAt) || 2.0));
    if (!player || !validBets.includes(betAmount) || betAmount > player.chips) return;

    player.chips -= betAmount;

    const r = Math.random();
    let crashPoint = 1.0 + Math.pow(-Math.log(Math.max(0.0001, r)), 1.15) * 1.45;
    const prizeBoost = Math.random() < 0.18;
    if (prizeBoost) crashPoint *= 1.35;
    crashPoint = Number(Math.min(20, crashPoint).toFixed(2));

    const bigBang = crashPoint <= 1.25;
    const won = targetMult <= crashPoint;
    const winAmount = won ? Math.floor(betAmount * targetMult) : 0;
    if (won) player.chips += winAmount;

    socket.emit('rocketResult', {
      crashPoint,
      targetMult,
      prizeBoost,
      bigBang,
      won,
      winAmount,
      newBalance: player.chips
    });
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Baja Casino Pro server running on port ${PORT}`);
});
