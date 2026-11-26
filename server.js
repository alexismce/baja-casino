const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// In-memory player session balances (ready to expand with SQLite later)
const players = new Map();

io.on('connection', (socket) => {
  players.set(socket.id, { chips: 1000 });
  socket.emit('balanceUpdate', 1000);

  socket.on('spinRoulette', ({ betAmount, choice }) => {
    const player = players.get(socket.id);
    if (!player || betAmount <= 0 || betAmount > player.chips) return;

    player.chips -= betAmount;

    // 0 = Green (14x), 1-7 = Red (2x), 8-14 = Black (2x)
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

  socket.on('disconnect', () => {
    players.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Baja Casino server running on port ${PORT}`);
});
