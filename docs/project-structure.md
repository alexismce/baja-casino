# Baja Casino Project Structure

```text
baja-casino/
├── public/
│   ├── index.html          # Main casino lobby
│   ├── css/
│   │   └── casino.css      # Lobby and table presentation
│   ├── js/
│   │   ├── app.js          # Lobby controller and localization
│   │   ├── audio.js        # Shared audio helpers
│   │   ├── engine3d.js     # Roulette, rocket, and 3D slots engine
│   │   └── main3d.js       # Alternate 3D entry point
│   └── games/
│       ├── cosmic-slots.html
│       └── multi-theme-slots.html
├── docs/
│   ├── baja-casino-improvement-schedule.md
│   ├── github-actions-metadata-reference.md
│   └── project-structure.md
├── server.js               # Express and Socket.IO server
├── package.json            # Node dependencies and start script
└── railway.json            # Railway build and deployment configuration
```

## Ownership rules

- `public/index.html` owns the lobby markup and public navigation.
- `public/css/` contains styles shared by the lobby.
- `public/js/app.js` owns lobby localization, audio controls, and catalog behavior.
- `public/js/engine3d.js` owns the existing 3D casino tables.
- `public/games/` contains standalone HTML games that can be opened without the lobby 3D engine.
- `server.js` serves static files and real-time game events.
- `docs/` contains repository documentation and implementation schedules.

## Adding a game

1. Place a standalone page in `public/games/`.
2. Add its lobby card to `public/index.html`.
3. Give the card a stable route under `/games/<game-name>.html`.
4. Keep shared lobby and table assets in `public/css/` and `public/js/`.
5. Use virtual-credit messaging and avoid real-money wagering labels.
