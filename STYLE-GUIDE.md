# Lucky Lounge Style Guide

## 1. Core aesthetic

**Theme:** A contemporary dark lounge with quiet green-black surfaces, warm gold accents, deep green felt for card tables, cream type, and restrained ruby accents. Let the game artwork provide color rather than adding decorative borders and lights to every control. Avoid flashing effects, pressure-driven gambling language, or imagery that suggests real-money play.

## 2. Typography

- **Display:** `"Segoe UI"`, `system-ui`, `-apple-system`, sans-serif for game titles, balances, and major headings. Apply `.font-display` where needed.
- **Interface:** `"Segoe UI"`, `system-ui`, `-apple-system`, sans-serif for body copy, controls, forms, and operator data.
- Keep typography local-first; do not add remote font dependencies.

## 3. Color palette

| Role | Value | Use |
| --- | --- | --- |
| Page background | `#0C1211` | Lobby and game room canvas |
| Surface | `#151F1D` | Lobby and game room cards and panels |
| Raised surface | `#1B2926` | Elevated lounge surfaces |
| Deep felt | `#17352C` | Card tables and felt areas |
| Brass | `#D8B66D` | Game room actions, active states, and highlights |
| Bright brass | `#F3D996` | Hover and prominent brass accents |
| Ruby | `#B9565D` | Errors and restrained game accents |
| Success | `#4C8B62` | Positive state indicators |
| Bright success | `#9BD1A9` | Positive text and status accents |
| Cream | `#F4F1E8` | Primary text |
| Muted text | `#B7C5BD` | Secondary text and labels |
| Divider | `#34443E` | Borders and separators |

Use gold and dark surfaces across the lobby, game room, and operator console. Phaser text uses `"Segoe UI, system-ui, sans-serif"`. Do not rely on color alone to communicate status.

## 4. Interaction and accessibility

- Interactive elements use a 2px gold focus outline with a 2px offset.
- Use `0.2s ease-in-out` transitions for hover and focus feedback. Avoid transitions that delay input or obscure state changes.
- Respect `prefers-reduced-motion`: disable CSS animation/transition effects, Phaser tweens, roulette/reel motion, and particle bursts.
- Sound is enabled by default unless previously disabled and starts after a browser-permitted user gesture. The sound toggle controls short interface/game cues, selectable synthesized tracks, and the room tone; the track and master volume preferences are shared between the lobby and game room. Keep the music and cues non-intrusive, fade ambience in and out, and stop audio scheduling and oscillators after sound is disabled. Keep all game feedback available as visible text.
- Preserve semantic headings, accessible control labels, live status messages, and a visible keyboard focus indicator.
- Keep transient achievement and connection feedback in polite live regions. Use restrained glass depth and borders in normal mode, then strengthen borders and focus contrast when `prefers-contrast: more` is active.

## 5. Layout and components

- Use a centered, responsive content column with clear hierarchy and consistent card padding.
- Use consistent spacing, 8–12px radii for controls, and softer 16–24px radii for cards and primary panels.
- Primary buttons use brass with page-background text; hover uses bright brass. Secondary actions use restrained surfaces and clear brass borders.
- Use restrained gold accents and soft surface contrast for emphasis. Avoid VIP/status badges or copy that implies account benefits a player does not have.
- Collapse multi-column content on narrow screens. Keep controls comfortably tappable and avoid horizontal overflow.
- Keep game tabs and primary control labels at readable sizes (about 14px or larger on desktop, with touch targets around 44px tall); use strong text/background contrast and preserve legibility on narrow screens.
- Provide quick-select values for common numeric inputs when helpful, while keeping the underlying field editable and validating it through the same rules as before.
- The home lobby catalog includes six game cards in **All games**, **Slots**, **Tables**, and **Quick play** categories. Keep category filters and search combinable; update the result count, announce result changes politely, and show a useful empty state.
- Support `/` as a search shortcut only when focus is not in an input, textarea, select, or editable element. Keep a visible, labeled search control for pointer, touch, and keyboard users.
- Keep the virtual-credit disclaimer near play controls. Avoid copy suggesting deposits, cash value, streak pressure, or guaranteed wins.
- The Slots game room uses a responsive wide cabinet with a 5×3 server-determined grid, 10 fixed paylines, a 3×3 row/column pattern puzzle, and a 1–10 credit per-line bet (10–100 credits total). Show both the per-line stake and total cost before play.
- The unified Slots interface offers modern and classic Phaser presentations plus a Babylon.js WebGL 3D presentation and an independent optional Fortune Wheel bonus. State its server-selected terms without implying a guaranteed win; presentation must not change odds or payouts.
- Use a dark indigo cabinet with restrained cyan accents and clear interactive feedback; keep the rest of the lounge palette consistent.

## 6. Icons, imagery, and sound

- Prefer the existing CSS-drawn game illustrations, card suits, and simple symbols. Keep images and icons local and palette-consistent; do not add remote asset dependencies.
- Present the home game list as a browsable catalog: original game-specific cover art, clear category filters, a labeled search field, and responsive cards. Do not copy third-party casino branding, screenshots, or game artwork.
- Build cover art from local CSS gradients and the game's existing symbols/cards; give each mode a distinct palette and a readable title/caption overlay. Keep decorative art hidden from assistive technology when the same game information is present as text.
- Use a three-column catalog on wide displays, two columns at medium widths, and a single column on narrow phones. Keep search and filter controls usable on touch screens and avoid external image dependencies.
- Use game-specific table surfaces in Phaser: a framed slot cabinet, green felt tables for cards and quick games, and a distinct roulette table layout. Keep markings low contrast behind game pieces so outcomes and controls remain easy to read.
- Give the Slots cabinet a layered dark enclosure, restrained cyan trim, and a prominent tactile spin control. The cabinet and controls must remain responsive and preserve focus/disabled states.
- Keep slot options compact on phones, use the available width for the reels, and keep cabinet lighting steady except for brief game feedback.
- Keep the Slots deck to three primary controls: **CRÉDITO** increases the per-line stake by one virtual credit, **APUESTA MÁXIMA** selects the ten-credit-per-line cap, and **GIRAR / SPIN** submits the spin. The credit control changes the wager only; it must never add to the wallet balance. Keep the current line stake and total ten-line cost visible.
- Whole-page effects may use slow ambient auroras, restrained light beams, short win particles, and one brief bonus impact. Keep the game readable, avoid continuous strobing, and suppress particles, perspective impacts, and camera motion under reduced-motion preferences.
- 3D presentation should use local image-based symbols with physically based frames, metallic or clear-coat highlights, readable neon winning states, and graceful fallback to 2D when WebGL or assets fail.
- Full-screen takeovers must live in a dedicated fixed overlay outside the game canvas, use `pointer-events: none`, cap particles by effect intensity and screen density, stop on Escape or reduced motion, and clean every timer/audio/particle resource after the preset.
- Home-page game illustrations may use slow, subtle floating or rotation effects. Avoid fast blinking, high-contrast flashing, or decorative LEDs on controls. Disable decorative animation for reduced-motion preferences.
- Keep the favicon and in-product marks on the felt/brass/ruby palette.
- Keep sound cues short and non-intrusive. The optional soundtrack may use restrained synthesized melodies over a warm room-tone bed, with tactile cues for cards, reels, roulette, dice, coins, wins, losses, pushes, and interface actions. Sound follows the saved preference and master volume is user-controlled; respect browser autoplay restrictions and avoid remote dependencies. Avoid flashing or long-running decorative motion.
- Confirmed slot bonuses use a short bass-and-coin fanfare and a non-looping neon result panel at the selected master volume. Announce wheel multipliers only when revealed and never describe a bonus as a net win. The optional on-device English arcade announcer is off by default and may add original, exaggerated delivery to bonuses and completed game rounds; it stops on mute, avoids copied catchphrases, and leaves visual results available without speech.
- Soundtrack arrangements may respond to the game mode and active or bonus state without influencing outcomes. Keep percussion restrained and stop the scheduler when sound is disabled.

## 7. Motion and tactile feedback

- Use short, deliberate physical cues: cards deal with a staggered snap and reveal, slot reels stretch and illuminate as they settle left-to-right, the roulette ball travels around its wheel with restrained speed-responsive pocket clicks, dice bounce and settle, coins flip over a moving shadow, and buttons depress slightly when pressed.
- Slot reel stops may use a brief, low-intensity cabinet shake. Keep win particles and the warm felt vignette restrained; never use rapid flashes or persistent decorative motion.
- Reveal the five slot reels left-to-right, highlight only server-reported winning paylines, and mark completed bonus rows or columns. In reduced-motion mode, render the full server result immediately.
- Use a clear stagger between reel stops and a brief settle bounce with a short reel tick when sound is enabled. Keep the animation tied to the server response; do not use independent timers to determine or announce wins.
- Use the cabinet top-box lights and a gentle, short pulse on server-reported winning paylines as a win celebration. Provide only a brief visual press response for the touch controls; do not depend on device vibration or ignore reduced-motion preferences.
- Roulette may play a short, soft, per-pocket click synchronized with the visible wheel rotation. Keep the click volume restrained and only play it when the player has enabled sound.
- Credit increases may use a brief success-colored balance pulse. Keep tabular numerals on balances and other changing numeric values.
- Apply decorative CSS animations only under `prefers-reduced-motion: no-preference`. Check the reduced-motion preference in Phaser before running tweens, roulette/reel motion, camera shake, or particles. In reduced-motion mode, display the server-selected result immediately.
- Modern ambient effects should use slow lighting, shallow depth, and short entrance feedback. Keep them subordinate to game outcomes and suppress them for reduced-motion users.
- Sound is enabled by default unless previously disabled and starts after a browser-permitted user gesture. The sound toggles enable synthesized lounge music and interface/game cues; a shared bounded master volume applies to both the lobby and game room. Fade the ambience in and out, stop the melody scheduler, and disconnect audio nodes after it is disabled.
- Keep all motion and audio strictly presentational. The server remains authoritative for outcomes, payouts, and balances.
- Keep the experience recreational and transparent: use virtual credits, visible outcomes, and no urgency, loss-chasing, or real-money pressure mechanics.
