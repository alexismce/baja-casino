# Lucky Lounge

A small, local casino-style game room for learning and play. It includes weighted slots, server-authoritative Blackjack with hit/stand/split/double-down actions, single-number roulette, Video Poker, coin toss, and an exact-face Dice Roll. All play uses virtual credits with no cash value. Game play uses same-origin Socket.IO events; the HTTP API initializes the browser session.

## Requirements

- Node.js v22.0.0 or newer
- Node dependencies are installed with `npm install`

## Run locally

The official desktop launcher is the Lucky Lounge tray. It starts and owns the
local Node.js server, presents live status, and opens the lounge or admin panel:

```powershell
npm start
```

Use `npm run server` only when you need to run the Node server directly without
the tray, or `npm run dev` to run it with automatic restart during development.

### Railway staging checklist

This is a local virtual-credit demo, **not approved for public deployment**.
The existing Railway production service tracks `main`, which contains a different
application. Do not merge the review branch or deploy it to that service until
the following have been reviewed and explicitly approved:

- Inventory the existing service and its accounts, balances, and database; take
  and verify a restorable backup before planning any migration. Never delete or
  overwrite existing data as part of this preparation.
- Use a separate, isolated staging service with a supported Node version of 22
  or newer. The existing Railway service reports Node 20.20.2, which does not
  satisfy this project's `engines.node` or its SQLite dependency. Verify the
  effective Railpack Node version and a clean Linux `npm ci` build.
- Configure the staging service's start command as `npm run start:headless`,
  not `npm start` (which launches the Windows tray). Set `HOST=0.0.0.0` only
  in that isolated service and let Railway provide `PORT`; its public proxy
  must target the actual listening port (currently shown as 8080). The default
  for a directly run local server remains `127.0.0.1:3000`.
- Set `DATABASE_PATH` inside a persistent staging volume and use only one
  replica with SQLite. Containers without a volume lose their data on redeploy.
  Plan tested SQLite-consistent backups, including WAL state, and a rollback;
  mounting an empty volume is not a migration from the current service.
- Use `/api/health` for a readiness check; it returns 200 only when the SQLite
  integrity checks pass. Confirm the health check and WebSocket traffic in
  staging. Admin APIs are disabled unless an `ADMIN_TOKEN` of at least 32
  characters is configured securely; never commit or share the token.
- Before any public exposure, independently review authentication and the
  known demo account, proxy trust, rate limiting, session security, monitoring,
  recovery, and applicable compliance. A working health check is not a security
  approval. Public deployment and production changes require separate consent.

### Windows tray launcher

Use `npm start`, `start-lounge-tray.cmd`, or:

```powershell
npm run tray
```

The tray launcher creates or validates the local `ADMIN_TOKEN`, checks Node.js v22+, npm, installed dependencies, the SQLite database, port 3000, and the current Lucky Lounge process before starting. It then monitors server health, connected WebSocket sessions, wallet credits, unsettled exposure, and whether the admin token is accepted. The managed server listens on the local network, and the live status window shows the LAN IP and URL for devices connected to the same router. It also checks Windows Firewall for an inbound TCP rule and offers to create a rule limited to the local subnet when access is missing. Right-click the tray icon to start or stop the server it owns, copy the LAN URL or admin token, open the lounge or admin panel, check the port and firewall, view a live status window, or open logs. It never stops an unrelated process that happens to occupy the port.

Logs are stored under `%LOCALAPPDATA%\LuckyLounge\logs`. The tray auto-starts the server, so do not run a second `npm start` while the tray says it is online.

### Windows installer and desktop launcher

The `installer` folder can compile a versioned Win32 launcher and install a
desktop copy under `%LOCALAPPDATA%\Programs\Lucky Lounge`. Build the launcher and
run the installer with:

```powershell
npm run build:installer
.\installer\Install-Lucky-Lounge.cmd
```

The launcher embeds the version from `package.json`, uses the generated
`lucky-lounge.ico`, and delegates startup to the official tray. The installer
creates `Lucky Lounge.lnk` on the desktop, writes `install-version.json`, keeps
the SQLite data directory, and copies the validated runtime dependency bundle
from this checkout. This avoids requiring Visual Studio or a Windows SDK for the
native SQLite module. The installed manifest records the Node major used to
build the bundle; if dependencies are not bundled, it falls back to
`npm ci --omit=dev`.

During development, `npm run dev` restarts the server when watched files change.
Use `npm run server` for a normal headless server without watch mode, including
CI or VPS service managers. Open [http://127.0.0.1:3000](http://127.0.0.1:3000)
for the responsive lounge lobby. Its six game cards link directly to their modes in the game room at `/client?game=<name>`. Browse with the **All games**, **Slots**, **Tables**, and **Quick play** filters, or search game names and descriptions. Press `/` to focus search unless focus is already in a text, number, or select field. The catalog updates its visible game count, announces results for assistive technology, and shows an empty state when no games match. Selecting a game's Play button opens that game directly; the game tabs also let players switch modes. Switching tabs updates the current URL so it can be bookmarked or shared; an unfinished Blackjack or Video Poker hand still takes priority when the session is restored.

Quick bet presets adapt to the selected game. Slots use a per-line bet of 1–10 credits across 10 fixed paylines (10–100 credits total per spin); other games accept 1–100 credits per play. Coin Toss is also available in the game room. Dice Roll lets players choose a face from 1 to 6; an exact hit returns five times the bet, including the stake. Blackjack allows one split per hand and double down on a two-card hand when the balance can cover the additional stake; split Aces receive one card each. Video Poker deals five server-shuffled cards, lets players hold any cards, then draws replacements and settles against its published paytable. Roulette's wheel is visual only: the server selects the result, then the wheel animates to that number. Phaser is installed locally and served by the app; no external CDN is needed. New browser sessions receive 1,000 virtual credits. Balances and active Blackjack and Video Poker hands persist in SQLite across server restarts. The tray-managed server binds to `0.0.0.0` for local-network play; a directly
run server binds to `127.0.0.1` by default. Set `HOST` or `PORT` when running the
server directly and an explicit configuration is needed. The LAN URL is
intended for trusted devices on the same router and is not a public-internet
configuration.

The database is created at `data/casino.db` on first launch. To use a different file, set `DATABASE_PATH` before starting the server. Anonymous balances are tied to the browser's HttpOnly cookie; clearing that cookie or using another browser creates a new balance. Back up the database file (and do not commit it) to preserve local demo data.

**Reminder:** Add `data/casino.db` to your `.gitignore` file to prevent accidental commits of the database.

Serve the client through the app at `/client`; do not open `client/index.html` as a `file://` page. The client must share the backend origin so the session cookie and same-origin Socket.IO checks work.

Instant games require a unique `requestId` on both `/api/play` and Socket.IO
`place_bet` commands. The server hashes the normalized game payload and stores
the public response in `game_receipts` in the same SQLite transaction as the
wallet update. Replaying the same command returns the original result without
moving the balance again; reusing its ID with a different command is rejected as
a conflict. Blackjack does not use this instant-game route: it remains on the
stateful `blackjack_deal` and `blackjack_action` flow.

### Unified Slots

Choose **Slots** and the same machine automatically changes presentation with its line bet: modern reels for 1–3 credits, classic reels for 4–7, and Babylon.js WebGL 3D reels for 8–10. All three presentations use the same paylines, server-selected outcomes, payouts, and optional **Fortune Wheel** setting. The wheel changes the server-side game rules and RTP; changing reel presentation does not. The wheel triggers on 1 in 20 spins and its award is selected by the server. Legacy links `/client?game=fortune-slots`, `/client?game=mechanical-slots`, and `/client?game=slots-3d` still open their corresponding starting presentation; shareable links use the unified Slots route and can combine it with `wheel=1`. Babylon.js loads only for the high-bet 3D presentation; if WebGL is unavailable, the same game remains playable with Phaser 2D reels.

## Accounts and player progress

The landing page presents an original, responsive game catalog with CSS-drawn game-specific cover artwork, category filters, and a search field. Search matches each card's visible name and description; `/` focuses the field when the player is not already typing in a form control. Category and search filters can be combined. The catalog reports the current number of matching cards and provides an empty state when there are no matches. The lobby also supports local email/password accounts, sign-in, and sign-out. Creating an account transfers the current anonymous demo-credit balance to that account; signing into an existing account loads its saved balance and active Blackjack hand. Accounts, progress, and achievements are stored in the same SQLite database.
Account progress includes every supported mode—Slots, Blackjack, Roulette, Coin Toss, Dice Roll, and Video Poker—so all completed rounds contribute consistently to play counts and the three-game exploration achievement.
Email is only used as a sign-in identifier. Passwords are securely hashed before being stored in the database; no plain-text passwords are saved. There is no email verification, password reset, or email delivery, so use a unique password and do not expose this demo to the public internet. The leaderboard only lists players who opted in, and displays their chosen name and best virtual-credit balance. The daily reward adds 100 virtual credits once per UTC day; it has no streak or wagering requirements. Achievements track play milestones and completing the Slots pattern puzzle, not wager volume. The puzzle's fixed demo-credit bonus is awarded only for a complete row or column. Sharing uses the browser's native share sheet when available, otherwise it copies a link.

### Local demo account

- Email: `admin@luckylounge.demo`
- Password: `DemoAdmin!2026`
- Display name: `Demo Admin`

This seeded account is a normal local player account with 10,000 virtual credits. It is provided for testing and **does not grant access to the operator console**. Operator access still requires the separately configured `ADMIN_TOKEN`.

Email is only used as a sign-in identifier. There is no email verification, password reset, or email delivery, so use a unique password and do not expose this demo to the public internet. The leaderboard only lists players who opted in, and displays their chosen name and best virtual-credit balance. The daily reward adds 100 virtual credits once per UTC day; it has no streak or wagering requirements. Achievements track play milestones and completing the Slots pattern puzzle, not wager volume. The puzzle's fixed demo-credit bonus is awarded only for a complete row or column. Sharing uses the browser's native share sheet when available, otherwise it copies a link.

## Demo wallet integration

The signed-in wallet API remains available for controlled purchase-flow simulations, but it is intentionally not exposed in the lobby or player profile. It can add or remove 1–10,000 virtual credits through PayPal and bank transfer labels; no provider is contacted, no payment information is collected, no money changes hands, and credits cannot be redeemed. Removing credits simulates a withdrawal; it does not pay winnings. The last 20 simulations are persisted per account in SQLite, and replaying the same request ID does not apply an operation twice. Reload any separately open game-room tab to refresh its displayed balance. This is not a real payment integration or a foundation approved for real-money play.

## Client feedback and sound

The client uses a contemporary lounge style, with a cyan-accented five-reel cabinet, felt table surfaces and a dedicated roulette layout. Slots display a 5×3 symbol grid, 10 fixed paylines and a 3×3 crossword-style bonus puzzle. The cabinet has a prize-light top box and a three-control panel. **CRÉDITO** increases the per-line stake by one virtual credit up to the 10-credit limit; **APUESTA MÁXIMA** selects 10 credits per line (100 credits total); neither control adds credits to the wallet. **GIRAR / SPIN** starts the spin. Controls give a brief visual press response, and the interface cue follows the saved sound preference. Reels begin in a short left-to-right cascade and keep moving until each stops, left to right in 300ms increments, with a short physical bounce and synthesized tick. A failed request cancels the animation; only server-reported symbols are shown as outcomes. Winning paylines and the top-box lights pulse gently for a few beats. The per-line wager and total 10-line cost are shown before each spin. Classic and cinematic reels are alternate Phaser presentations of Lucky Slots, not separate games. Fortune Wheel is an optional server-selected bonus for any reel presentation. The landing page has restrained brass-foil and glint accents and an accessible catalog with original CSS-drawn cover compositions. Catalog search and category filters can be combined and work without external assets. Other in-game feedback includes staggered Blackjack card deals and a dealer-card reveal, an orbiting roulette ball with speed-responsive pocket clicks, bouncing dice and coin animations, and a restrained, short coin-and-spark burst on wins. Motion follows the browser's reduced-motion preference; when reduced motion is requested, game outcomes are displayed without decorative reel or roulette motion, camera shake, or particles.

The game room also includes a cinematic presentation layer with animated auroras, light beams, whole-page bonus impacts, falling neon sparks and coins, and an expanding depth-styled win halo. The high-bet reel presentation uses Babylon.js physically based materials, lighting, clear-coat frame surfaces and neon glow around winning lines. All symbol artwork is local. Bonus fanfares combine low-frequency impact, ascending synthesized tones, coin-like highlights, and optional dramatic voice without external audio files.

Full-screen takeovers run in a dedicated fixed canvas above every game rather than inside Phaser or Babylon. A central controller sequences comets, descending fire meteors, radial fireworks, shockwaves, trails and impact sparks, while an AnalyserNode makes visual glow respond to synthesized rocket whistles and filtered-noise explosions. Effects use adaptive device-pixel-ratio and particle caps, clean up automatically, respect Experience Lab intensity/music controls and reduced-motion preference, never block controls, and can be skipped with Escape.

The in-room **Experience Lab** adds three saved visual themes, an effect-intensity control, separate music and sound-effect switches, optional device haptics, high-contrast mode, and stereo audio panning. A local-session dashboard tracks rounds, wins, best payout, and session RTP, while a 5,000-credit showcase meter visualizes net wins only; neither feature changes bets, odds, or payouts. The meter and statistics reset with the browser session. A keyboard-accessible quick tour explains the unified machine, while the bonus vault provides a staged server-confirmed reveal without new randomness or player choices that could affect the server payout.

Sound is enabled by default unless the player previously turned it off; browsers require a user gesture before audio can start. The landing page and game room offer five original, locally synthesized tracks: Gold Lounge, Velvet Night, Midnight Keys, Arcade Lights, and Neon Nights. Tracks add rhythmic bass and percussion; in the game room the arrangement changes with the selected game, active play, and bonus reveals. The selected track and adjustable volume are shared and saved locally. The game room adds distinct cues for card deals and reveal, slot reels, roulette pockets, dice bounces, coin flips, wins, losses, and pushes. Confirmed puzzle and Fortune Wheel bonuses trigger a bass-and-coin fanfare alongside a brief neon-accented result panel. A wheel award is announced only when revealed; a 2× award means twice the line bet, not necessarily a net win. The game room's **Arcade voice** switch optionally adds an original, exaggerated on-device announcer for slot bonuses, Blackjack confrontations, Video Poker results, roulette hits, dice rolls, and coin tosses. It is off by default, saved locally, requires sound to be on, and selects only an on-device English browser voice. The 2× announcement includes a quieter spoken repeat as an echo-style effect; the browser's voice itself is not processed through an audio echo. If no local voice is available, the fanfare and visual result still work. Muting or setting volume to zero stops an active announcement; volume changes otherwise apply to the next announcement. Disabling sound fades out the ambience and stops its oscillators. Synthesized music and effects require no external audio files. Game feedback remains visible when sound is off, and reduced motion removes the decorative panel animation. These effects are presentation only: results and payouts continue to come from the server. The game uses virtual credits only and does not add real-money wagering or pressure-based play mechanics.

## Operator console

The operator console is available at `/admin`. Configure `ADMIN_TOKEN` with a unique secret of at least 32 characters before using the protected APIs; without it, admin operations remain disabled. The token is entered into the dashboard and sent only in the `X-Admin-Token` header. Do not commit or share the token. An obscure route is not an access control; all admin API requests validate the token server-side.

The console shows connected Socket.IO clients, current wallet credits, and estimated maximum unsettled Blackjack and Video Poker payouts. These are virtual-credit exposure metrics, not real-money liabilities. It can change slot reel weights from 1 to 100 per symbol for both slot games; changes take effect immediately but are in-memory and reset when the server restarts. Each payline pays 1×, 2×, or 3× the per-line stake for a left-to-right match of three, four, or five symbols. A complete row or column in the bonus grid pays one additional per-line stake for that match. Fortune Wheel Slots additionally triggers an independent wheel on 1 in 20 spins; its six equally likely awards are 1×, 2×, 3×, 5×, 8× and 10× the line bet. The server selects and settles the award once with the spin. With default weights, theoretical RTP is about 13.18% for Lucky Slots and 15.60% for Fortune Wheel Slots, assuming independent symbols. The dashboard updates both estimates when weights change; they are not guarantees of results.

## Test

```powershell
npm test
```

The automated suite checks static routes and game links, API validation and authorization, Socket.IO game flows, game rules and payouts, SQLite persistence and legacy-schema migrations, and transaction rollback behavior.

## Visual style guide

The shared UI palette, typography, spacing, icon, motion, and sound conventions are documented in [STYLE-GUIDE.md](./STYLE-GUIDE.md). Apply the same tokens to the main lounge, Phaser client, and operator console when adding interface elements.

## Security and scope

- Game outcomes are calculated on the server with Node's cryptographically secure, unbiased `crypto.randomInt`; client code cannot choose outcomes. The `src/rng/fairness.js` helper is a secure RNG, not a verifiable "provably fair" protocol (i.e., players cannot independently audit or verify the fairness of each outcome after the fact, as is possible with some cryptographic fairness systems).
- Blackjack cards are dealt from a shuffled 52-card server-side deck. The dealer hole card stays hidden until the hand resolves; hand totals, bust checks, dealer draws, and payouts remain server-side.
- Slots use a weighted server-side symbol strip, 10 fixed paylines, and an independent 3×3 row/column pattern bonus in `src/rng/slots.js`. The browser only renders the returned 5×3 grid and bonus results. The server caps each slot line bet at 10 credits, limiting the total stake to 100 credits per spin.
- Dice Roll selects one of six outcomes with the server's secure RNG; the browser animation only displays the server response.
- Phaser 4 handles table presentation, while Babylon.js 9 handles the optional WebGL 3D reel presentation. Neither renderer chooses results, calculates hand totals or payouts, or manages credits; server responses determine displayed outcomes and balances. Roulette outcome generation and payouts remain in the existing server game engine.
- The client uses CSS effects, Phaser tweens and restrained particles, plus optional synthesized lounge music, interface/game cues, and room tone via the browser Web Audio API. Audio starts after a browser-permitted user gesture; turning sound off fades out the ambience and stops its melody scheduler and oscillators. Reduced-motion preferences disable decorative animation. There are no external audio, image, video, or CDN assets.
- The server validates game names, bet sizes, and game-specific choices. Bets are whole virtual credits; non-slot plays are capped at 100 credits and slot line bets at 10 credits across 10 lines.
- Sessions use a random, one-year HttpOnly, SameSite cookie. Socket connections require an active database session and same-origin handshake; the app applies restrictive browser security headers, request-size limits, and a per-session rate limit.
- **This project is intended for local demo use only. Do not expose it to the public internet, as it lacks the security, authentication, and operational controls required for production environments.**
- SQLite transactions persist wallet changes and active Blackjack state atomically. Production wallets still need authenticated accounts, operational backups, and appropriate security and compliance controls.
- This is a local demo, not a production gambling or payments platform. It has no deposits, cash-outs, or real-money wagering. Accounts and balances are local to this database; do not expose it to the public internet as-is.
- Blackjack supports deal, hit, stand, one split, and double down. The dealer draws to 17; split Aces receive one card each, and re-splitting is not implemented.
- Video Poker uses a shuffled 52-card deck and a server-side hold/draw and payout flow. The maximum royal-flush payout is 250x the bet.
- Admin controls are disabled unless `ADMIN_TOKEN` is configured. Slot weights are runtime-only; protect the token and do not expose this local demo to the public internet.
