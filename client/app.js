const balanceDisplay = document.querySelector("#balance");
const appLoader = document.querySelector("#app-loader");
const appLoaderStatus = document.querySelector("#app-loader-status");
const appLoaderProgress = document.querySelector("#app-loader-progress");
const appLoaderRetry = document.querySelector("#app-loader-retry");
const resultDisplay = document.querySelector("#result");
const achievementToast = document.querySelector("#achievement-toast");
const spinButton = document.querySelector("#spin");
const spinLabel = document.querySelector("#spin-label");
const slotButtonPanel = document.querySelector("#slot-button-panel");
const slotCreditButton = document.querySelector("#slot-credit-button");
const slotCreditValue = document.querySelector("#slot-credit-value");
const slotSpinButton = document.querySelector("#slot-spin-button");
const slotMaxButton = document.querySelector("#slot-max-button");
const betInput = document.querySelector("#bet");
const betPresetButtons = [...document.querySelectorAll("[data-bet-preset]")];
const betPresets = document.querySelector(".bet-presets");
const connectionStatus = document.querySelector("#connection-status");
const connectionDot = document.querySelector("#connection-dot");
const slotsTab = document.querySelector("#slots-tab");
const slotOptions = document.querySelector("#slot-options");
const slotStyle = document.querySelector("#slot-style");
const slotWheel = document.querySelector("#slot-wheel");
const blackjackTab = document.querySelector("#blackjack-tab");
const rouletteTab = document.querySelector("#roulette-tab");
const pokerTab = document.querySelector("#poker-tab");
const diceTab = document.querySelector("#dice-tab");
const coinTab = document.querySelector("#coin-tab");
const rouletteNumber = document.querySelector("#roulette-number");
const rouletteNumberLabel = document.querySelector("#roulette-number-control");
const diceNumber = document.querySelector("#dice-number");
const diceNumberLabel = document.querySelector("#dice-number-control");
const coinChoice = document.querySelector("#coin-choice");
const coinChoiceLabel = document.querySelector("#coin-choice-control");
const soundToggle = document.querySelector("#sound-toggle");
const bonusVoiceToggle = document.querySelector("#bonus-voice-toggle");
const bonusVoiceStatus = document.querySelector("#bonus-voice-status");
const soundVolume = document.querySelector("#sound-volume");
const soundVolumeValue = document.querySelector("#sound-volume-value");
const slotRulesNote = document.querySelector("#slot-rules-note");
const fortuneRulesNote = document.querySelector("#fortune-rules-note");
const mechanicalRulesNote = document.querySelector("#mechanical-rules-note");
const slots3dRulesNote = document.querySelector("#slots-3d-rules-note");
const slots3dStatus = document.querySelector("#slots-3d-status");
const betLabel = document.querySelector("#bet-label");
const betSummary = document.querySelector("#bet-summary");
const gameContainer = document.querySelector("#game-container");
const bonusDisplay = document.querySelector("#bonus-display");
const bonusTitle = document.querySelector("#bonus-title");
const bonusDetail = document.querySelector("#bonus-detail");
const pageCelebration = document.querySelector("#page-celebration");
const experienceOpen = document.querySelector("#experience-open");
const experiencePanel = document.querySelector("#experience-panel");
const loungeTheme = document.querySelector("#lounge-theme");
const effectsIntensity = document.querySelector("#effects-intensity");
const effectsValue = document.querySelector("#effects-value");
const musicEnabled = document.querySelector("#music-enabled");
const effectsEnabled = document.querySelector("#effects-enabled");
const hapticsEnabled = document.querySelector("#haptics-enabled");
const highContrast = document.querySelector("#high-contrast");
const tutorialOpen = document.querySelector("#tutorial-open");
const tutorialDialog = document.querySelector("#tutorial-dialog");
const tutorialClose = document.querySelector("#tutorial-close");
const tutorialStart = document.querySelector("#tutorial-start");
const gameFullscreenButton = document.querySelector("#game-fullscreen");
const gameMarquee = document.querySelector("#game-marquee");
const jackpotValue = document.querySelector("#jackpot-value");
const jackpotFill = document.querySelector("#jackpot-fill");
const statsRounds = document.querySelector("#stats-rounds");
const statsWins = document.querySelector("#stats-wins");
const statsBest = document.querySelector("#stats-best");
const statsRtp = document.querySelector("#stats-rtp");
const blackjackActions = document.querySelector("#blackjack-actions");
const blackjackActionButtons = [
  ...blackjackActions.querySelectorAll("[data-blackjack-action]"),
];
const pokerActions = document.querySelector("#poker-actions");
const pokerCardControls = document.querySelector("#poker-card-controls");
const pokerDrawButton = document.querySelector("#poker-draw");
const gameAccessibleStatus = document.querySelector("#game-accessible-status");
const socket = window.io({
  autoConnect: false,
  transports: ["websocket", "polling"],
});
let pendingRequestId;
let loungeScene;
let currentMode = "slots";
let blackjackActive = false;
let pokerActive = false;
let storedSoundPreference = "on";
try {
  storedSoundPreference =
    window.localStorage.getItem("lucky-lounge-sound") ?? "on";
} catch (error) {
  console.warn("Could not read the saved game sound preference:", error);
}
let soundEnabled = storedSoundPreference !== "off";
let audioContext;
let masterGainNode;
let spatialPanner;
let soundVolumeLevel;
let ambientNodes;
let ambienceStopTimer;
let ambientMusicTimer;
let ambientMusicStep = 0;
let bonusMusicUntil = 0;
let achievementToastTimer;
let soundToggleSequence = 0;
let gameRoomConnected = false;
let appLoadingFinishing = false;

function updateAppLoader(status, progress) {
  if (!appLoader || appLoader.classList.contains("is-ready")) return;
  appLoaderStatus.textContent = status;
  appLoaderProgress.style.width = `${Math.max(0, Math.min(100, progress))}%`;
}

function maybeFinishAppLoading() {
  if (
    appLoadingFinishing ||
    !gameRoomConnected ||
    !loungeScene ||
    loungeScene.slot3dLoading
  )
    return;
  appLoadingFinishing = true;
  updateAppLoader("Your table is ready", 100);
  window.setTimeout(() => {
    appLoader.classList.add("is-ready");
    document.body.classList.add("app-ready");
    window.setTimeout(() => appLoader.remove(), 650);
  }, 260);
}

function failAppLoading(error) {
  appLoader.classList.add("is-error");
  appLoaderStatus.textContent =
    "The game room could not connect to the local server.";
  appLoaderProgress.style.width = "100%";
  appLoaderRetry.hidden = false;
  console.error("Could not initialize game session:", error);
}

appLoaderRetry.addEventListener("click", () => window.location.reload());
updateAppLoader("Starting Phaser 4 and the local artwork…", 18);
let legalBlackjackActions = [];
const GAME_MODES = [
  "slots",
  "mechanical-slots",
  "slots-3d",
  "blackjack",
  "roulette",
  "poker",
  "dice",
  "coin",
];
const isSlotMode = (mode) =>
  ["slots", "mechanical-slots", "slots-3d"].includes(mode);
const requestedParams = new URLSearchParams(window.location.search);
const requestedMode = requestedParams.get("game");
let slotWheelEnabled =
  requestedMode === "fortune-slots" ||
  (isSlotMode(requestedMode) && requestedParams.get("wheel") === "1");
if (GAME_MODES.includes(requestedMode)) currentMode = requestedMode;
let lastSlotMode = isSlotMode(currentMode) ? currentMode : "slots";
const gameTabs = [
  slotsTab,
  blackjackTab,
  rouletteTab,
  pokerTab,
  diceTab,
  coinTab,
];
const gameCard = document.querySelector(".game-card");

const ROULETTE_SEQUENCE = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const ROULETTE_RED = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);
const REDUCE_MOTION = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
const LOW_POWER_RENDERING =
  REDUCE_MOTION ||
  navigator.connection?.saveData === true ||
  (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
  (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
const RENDER_RESOLUTION = LOW_POWER_RENDERING
  ? 1
  : Math.min(window.devicePixelRatio || 1, 1.75);
const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
let displayedBalance;
let rouletteNoiseBuffer;
const SLOT_THEME = {
  label: "Neon Studio",
  backdrop: 0x080c1a,
  cabinet: 0x274159,
  display: 0x101a2d,
  trim: 0x6fdad4,
  glow: 0xa2fff1,
  symbol: 0xf1fffc,
  accent: 0xf178c9,
  reelTone: 210,
  reelWave: "triangle",
  spinFilter: [440, 1500],
  chords: [130.81, 196, 246.94],
  winNotes: [523.25, 659.25, 783.99, 1046.5],
  bonusNotes: [659.25, 880],
};
const getSoundtrack = window.LuckySoundtracks.bind(
  document.querySelector("#music-track"),
  () => {
    if (soundEnabled && audioContext?.state === "running" && ambientNodes)
      startLoungeMelody();
  },
);

function readStoredPreference(key, fallback) {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch (error) {
    console.warn(`Could not read the saved ${key} preference:`, error);
    return fallback;
  }
}

let effectsLevel = Math.min(
  1,
  Math.max(
    0,
    Number(readStoredPreference("lucky-lounge-effects", "100")) / 100,
  ),
);
effectsIntensity.value = String(Math.round(effectsLevel * 100));
effectsValue.value = `${effectsIntensity.value}%`;
const applyStoredCheck = (control, key, fallback) => {
  control.checked = readStoredPreference(key, fallback) === "on";
};
applyStoredCheck(musicEnabled, "lucky-lounge-music", "on");
applyStoredCheck(effectsEnabled, "lucky-lounge-effects-audio", "on");
applyStoredCheck(hapticsEnabled, "lucky-lounge-haptics", "off");
applyStoredCheck(highContrast, "lucky-lounge-contrast", "off");
const selectedTheme = readStoredPreference("lucky-lounge-theme", "neon");
if ([...loungeTheme.options].some((option) => option.value === selectedTheme))
  loungeTheme.value = selectedTheme;
document.body.dataset.theme = loungeTheme.value;
document.body.classList.toggle("high-contrast", highContrast.checked);
document.documentElement.style.setProperty(
  "--effect-scale",
  String(effectsLevel),
);

let sessionStats;
try {
  sessionStats = JSON.parse(
    window.sessionStorage.getItem("lucky-lounge-session-stats") ?? "{}",
  );
} catch (error) {
  sessionStats = {};
  console.warn("Could not read local session statistics:", error);
}
sessionStats = {
  rounds: Number(sessionStats.rounds) || 0,
  wins: Number(sessionStats.wins) || 0,
  best: Number(sessionStats.best) || 0,
  wagered: Number(sessionStats.wagered) || 0,
  paid: Number(sessionStats.paid) || 0,
  showcase: Number(sessionStats.showcase) || 0,
};

function renderSessionStats() {
  statsRounds.textContent = sessionStats.rounds.toLocaleString();
  statsWins.textContent = sessionStats.wins.toLocaleString();
  statsBest.textContent = sessionStats.best.toLocaleString();
  statsRtp.textContent =
    sessionStats.wagered > 0
      ? `${Math.round((sessionStats.paid / sessionStats.wagered) * 100)}%`
      : "—";
  const progress = Math.min(5000, sessionStats.showcase);
  jackpotValue.textContent = `${progress.toLocaleString()} / 5,000`;
  jackpotFill.style.width = `${progress / 50}%`;
}

function recordSessionOutcome(response) {
  sessionStats.rounds += 1;
  sessionStats.wins += Number(response.payout) > Number(response.bet) ? 1 : 0;
  sessionStats.best = Math.max(sessionStats.best, Number(response.payout) || 0);
  sessionStats.wagered += Number(response.bet) || 0;
  sessionStats.paid += Number(response.payout) || 0;
  sessionStats.showcase =
    (sessionStats.showcase + Math.max(0, Number(response.net) || 0)) % 5000;
  try {
    window.sessionStorage.setItem(
      "lucky-lounge-session-stats",
      JSON.stringify(sessionStats),
    );
  } catch (error) {
    console.warn("Could not save local session statistics:", error);
  }
  renderSessionStats();
}

function showAchievementToast(achievements = []) {
  window.clearTimeout(achievementToastTimer);
  if (!achievements.length) return;
  achievementToast.textContent = `Achievement${achievements.length === 1 ? "" : "s"} unlocked: ${achievements.join(", ")}`;
  achievementToast.hidden = false;
  achievementToast.classList.remove("achievement-toast-show");
  void achievementToast.offsetWidth;
  achievementToast.classList.add("achievement-toast-show");
  achievementToastTimer = window.setTimeout(() => {
    achievementToast.hidden = true;
    achievementToast.classList.remove("achievement-toast-show");
  }, 5200);
}

function haptic(pattern) {
  if (hapticsEnabled.checked && navigator.vibrate) navigator.vibrate(pattern);
}

renderSessionStats();

experienceOpen.addEventListener("click", () => {
  const open = experiencePanel.hidden;
  experiencePanel.hidden = !open;
  experienceOpen.setAttribute("aria-expanded", String(open));
  if (open) loungeTheme.focus();
});

loungeTheme.addEventListener("change", () => {
  document.body.dataset.theme = loungeTheme.value;
  try {
    window.localStorage.setItem("lucky-lounge-theme", loungeTheme.value);
  } catch (error) {
    console.warn("Could not save the lounge theme:", error);
  }
  void playCue("ui");
});

effectsIntensity.addEventListener("input", () => {
  effectsLevel = Number(effectsIntensity.value) / 100;
  effectsValue.value = `${effectsIntensity.value}%`;
  document.documentElement.style.setProperty(
    "--effect-scale",
    String(effectsLevel),
  );
  try {
    window.localStorage.setItem("lucky-lounge-effects", effectsIntensity.value);
  } catch (error) {
    console.warn("Could not save effect intensity:", error);
  }
});

[
  [musicEnabled, "lucky-lounge-music"],
  [effectsEnabled, "lucky-lounge-effects-audio"],
  [hapticsEnabled, "lucky-lounge-haptics"],
  [highContrast, "lucky-lounge-contrast"],
].forEach(([control, key]) => {
  control.addEventListener("change", () => {
    try {
      window.localStorage.setItem(key, control.checked ? "on" : "off");
    } catch (error) {
      console.warn(`Could not save the ${key} preference:`, error);
    }
    if (control === highContrast)
      document.body.classList.toggle("high-contrast", control.checked);
    if (
      control === musicEnabled &&
      audioContext?.state === "running" &&
      ambientNodes
    ) {
      rampAmbienceGain(
        ambientNodes.gainNode,
        musicEnabled.checked ? 0.008 : 0.0001,
        0.25,
      );
      rampAmbienceGain(
        ambientNodes.musicGainNode,
        musicEnabled.checked ? 0.085 : 0.0001,
        0.25,
      );
      startLoungeMelody();
    }
    if (control === hapticsEnabled) haptic(20);
  });
});

if (typeof tutorialDialog.showModal === "function") {
  tutorialOpen.addEventListener("click", () => tutorialDialog.showModal());
  tutorialClose.addEventListener("click", () => tutorialDialog.close());
  tutorialStart.addEventListener("click", () => {
    tutorialDialog.close();
    slotSpinButton.focus();
  });
} else {
  tutorialOpen.hidden = true;
}

if (!document.fullscreenEnabled) {
  gameFullscreenButton.hidden = true;
} else {
  gameFullscreenButton.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await gameCard.requestFullscreen();
    } catch (error) {
      console.error("Could not change full-screen game mode:", error);
      resultDisplay.textContent =
        "Full-screen mode is not available in this browser.";
    }
  });
  document.addEventListener("fullscreenchange", () => {
    const active = document.fullscreenElement === gameCard;
    gameFullscreenButton.textContent = active
      ? "Exit full screen"
      : "Full screen";
    gameFullscreenButton.setAttribute(
      "aria-label",
      active ? "Exit full-screen game mode" : "Enter full-screen game mode",
    );
    document.body.classList.toggle("game-fullscreen", active);
    window.setTimeout(() => loungeScene?.scale.refresh(), 50);
  });
}

function updateSlotPresentationForBet() {
  if (
    !isSlotMode(currentMode) ||
    pendingRequestId ||
    blackjackActive ||
    pokerActive ||
    !loungeScene
  )
    return;
  const presentation = window.LuckySlotPresentation.getSlotPresentationForBet(
    betInput.value,
  );
  if (presentation !== currentMode) setMode(presentation);
}

function updateBetAndPresentation() {
  updateBetPresets();
  updateSlotPresentationForBet();
}

const storedVolume = Number(readStoredPreference("lucky-lounge-volume", "70"));
soundVolumeLevel = Number.isFinite(storedVolume)
  ? Math.min(1, Math.max(0, storedVolume / 100))
  : 0.7;
soundVolume.value = String(Math.round(soundVolumeLevel * 100));
soundVolumeValue.value = `${soundVolume.value}%`;
const bonusAudio = window.LuckyBonusAudio.create({
  synth: window.speechSynthesis,
  Utterance: window.SpeechSynthesisUtterance,
  playCue: (cue) => void playCue(cue),
  isSoundEnabled: () => soundEnabled,
  getVolume: () => soundVolumeLevel,
  onVoiceStatus: (message) => {
    bonusVoiceStatus.textContent = message;
  },
});
let bonusVoiceEnabled =
  readStoredPreference("lucky-lounge-bonus-voice", "off") === "on";
if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
  bonusVoiceEnabled = false;
  bonusVoiceToggle.disabled = true;
  bonusVoiceToggle.textContent = "Arcade voice unavailable";
  bonusVoiceToggle.title = "This browser does not support on-device speech.";
} else {
  bonusAudio.setVoiceEnabled(bonusVoiceEnabled);
  bonusVoiceToggle.textContent = `Arcade voice: ${bonusVoiceEnabled ? "on" : "off"}`;
  bonusVoiceToggle.setAttribute("aria-pressed", String(bonusVoiceEnabled));
}
bonusVoiceToggle.addEventListener("click", () => {
  bonusVoiceEnabled = !bonusVoiceEnabled;
  bonusAudio.setVoiceEnabled(bonusVoiceEnabled);
  bonusVoiceToggle.textContent = `Arcade voice: ${bonusVoiceEnabled ? "on" : "off"}`;
  bonusVoiceToggle.setAttribute("aria-pressed", String(bonusVoiceEnabled));
  try {
    window.localStorage.setItem(
      "lucky-lounge-bonus-voice",
      bonusVoiceEnabled ? "on" : "off",
    );
  } catch (error) {
    console.warn("Could not save the bonus voice preference:", error);
  }
});

const takeoverFx = window.LuckyTakeoverFX.create({
  getEffectScale: () => effectsLevel,
  isSoundEnabled: () => soundEnabled && effectsEnabled.checked,
  isReducedMotion: () => REDUCE_MOTION,
  getAudioGraph: () =>
    audioContext?.state === "running"
      ? { context: audioContext, destination: getMasterGainNode() }
      : null,
});

function updateBalanceDisplay(balance) {
  const nextBalance = `${balance.toLocaleString()} credits`;
  if (balanceDisplay.textContent === nextBalance) return;
  balanceDisplay.textContent = nextBalance;
  const isCreditIncrease =
    displayedBalance !== undefined && balance > displayedBalance;
  displayedBalance = balance;
  if (isCreditIncrease && !REDUCE_MOTION) {
    balanceDisplay.classList.remove("balance-update");
    void balanceDisplay.offsetWidth;
    balanceDisplay.classList.add("balance-update");
  }
}

function updateBetPresets() {
  const isSlots = isSlotMode(currentMode);
  const maximumBet = isSlots ? 10 : 100;
  const presets = isSlots ? [1, 2, 5, 10] : [10, 25, 50, 100];
  betInput.max = String(maximumBet);
  if (Number(betInput.value) > maximumBet) betInput.value = String(maximumBet);
  betPresets.hidden = isSlots;
  const selectedBet = Number(betInput.value);
  slotCreditValue.textContent = `${selectedBet} / LINE`;
  slotCreditButton.disabled =
    Boolean(pendingRequestId) || betInput.disabled || selectedBet >= maximumBet;
  slotMaxButton.disabled =
    Boolean(pendingRequestId) ||
    betInput.disabled ||
    selectedBet === maximumBet;
  betLabel.querySelector("span").textContent = isSlots
    ? "(per line · 10 lines · max 100 total)"
    : "(1–100 credits)";
  betSummary.hidden = !isSlots;
  if (isSlots) {
    const lineBet = selectedBet;
    betSummary.textContent =
      Number.isSafeInteger(lineBet) && lineBet >= 1 && lineBet <= 10
        ? `Total demo wager: ${lineBet * 10} credits (10 paylines × ${lineBet}).`
        : "Enter a whole-number line bet from 1 to 10 credits.";
  }

  for (const [index, button] of betPresetButtons.entries()) {
    button.dataset.betPreset = String(presets[index]);
    button.textContent = String(presets[index]);
    const preset = Number(button.dataset.betPreset);
    button.setAttribute("aria-pressed", String(selectedBet === preset));
    button.disabled = Boolean(pendingRequestId) || betInput.disabled;
  }
}

function pulseSlotControl(button) {
  button.classList.remove("slot-tactile-pulse");
  void button.offsetWidth;
  button.classList.add("slot-tactile-pulse");
}

function getMasterGainNode() {
  if (!masterGainNode) {
    masterGainNode = audioContext.createGain();
    masterGainNode.gain.value = soundEnabled ? soundVolumeLevel : 0;
    spatialPanner =
      typeof audioContext.createStereoPanner === "function"
        ? audioContext.createStereoPanner()
        : undefined;
    if (spatialPanner) {
      masterGainNode.connect(spatialPanner);
      spatialPanner.connect(audioContext.destination);
    } else {
      masterGainNode.connect(audioContext.destination);
    }
  }
  return masterGainNode;
}

function setSpatialPan(value) {
  if (!spatialPanner) return;
  spatialPanner.pan.cancelScheduledValues(audioContext.currentTime);
  spatialPanner.pan.setTargetAtTime(
    Math.min(1, Math.max(-1, value)),
    audioContext.currentTime,
    0.02,
  );
}

function setSoundVolume(value) {
  const percentage = Math.min(100, Math.max(0, Number(value)));
  if (!Number.isFinite(percentage)) return;
  soundVolumeLevel = percentage / 100;
  if (soundVolumeLevel === 0) bonusAudio.stopVoice();
  soundVolume.value = String(percentage);
  soundVolumeValue.value = `${percentage}%`;
  if (masterGainNode && audioContext) {
    masterGainNode.gain.setTargetAtTime(
      soundEnabled ? soundVolumeLevel : 0,
      audioContext.currentTime,
      0.025,
    );
  }
  try {
    window.localStorage.setItem("lucky-lounge-volume", String(percentage));
  } catch (error) {
    console.warn("Could not save the game sound volume preference:", error);
  }
}

betInput.addEventListener("input", updateBetAndPresentation);
soundVolume.addEventListener("input", () => setSoundVolume(soundVolume.value));
slotCreditButton.addEventListener("click", () => {
  if (pendingRequestId || betInput.disabled) return;
  pulseSlotControl(slotCreditButton);
  void playCue("ui");
  betInput.value = String(Math.min(10, Number(betInput.value) + 1));
  updateBetAndPresentation();
  gameAccessibleStatus.textContent = `Line bet increased to ${betInput.value} virtual credit${betInput.value === "1" ? "" : "s"} per line; total spin cost ${Number(betInput.value) * 10} credits.`;
});
slotMaxButton.addEventListener("click", () => {
  if (pendingRequestId || betInput.disabled) return;
  pulseSlotControl(slotMaxButton);
  void playCue("ui");
  betInput.value = "10";
  updateBetAndPresentation();
  gameAccessibleStatus.textContent =
    "Maximum slot bet selected: 10 virtual credits per line, 100 credits total across 10 paylines.";
});
slotSpinButton.addEventListener("click", () =>
  pulseSlotControl(slotSpinButton),
);
betPresetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (pendingRequestId || betInput.disabled) return;
    void playCue("ui");
    betInput.value = button.dataset.betPreset;
    updateBetAndPresentation();
    betInput.focus();
  });
});
betInput.addEventListener("change", () => void playCue("ui"));

rouletteNumber.replaceChildren(
  ...Array.from({ length: 37 }, (_, number) => {
    const option = document.createElement("option");
    option.value = String(number);
    option.textContent = String(number);
    return option;
  }),
);
diceNumber.replaceChildren(
  ...Array.from({ length: 6 }, (_, index) => {
    const face = index + 1;
    const option = document.createElement("option");
    option.value = String(face);
    option.textContent = String(face);
    return option;
  }),
);

async function playCue(cue, options = {}) {
  if (!soundEnabled || !effectsEnabled.checked || !AudioContextClass) return;

  try {
    audioContext ??= new AudioContextClass();
    if (audioContext.state === "suspended") await audioContext.resume();
    if (!soundEnabled || audioContext.state !== "running") return;
    setSpatialPan(
      cue === "bonus"
        ? 0
        : cue === "reel-tick"
          ? -0.25 + Math.random() * 0.5
          : Math.sin(performance.now() / 1000) * 0.2,
    );
    if (cue === "bonus") {
      const now = audioContext.currentTime;
      const tones = [
        {
          frequency: 125,
          end: 38,
          time: 0,
          duration: 0.42,
          level: 0.24,
          wave: "sine",
        },
        {
          frequency: 392,
          end: 784,
          time: 0.02,
          duration: 0.34,
          level: 0.055,
          wave: "sawtooth",
        },
        ...[783.99, 987.77, 1174.66, 1567.98, 2093].map((frequency, index) => ({
          frequency,
          end: frequency * 1.25,
          time: 0.18 + index * 0.085,
          duration: 0.17,
          level: 0.095,
          wave: "triangle",
        })),
        ...[0.7, 0.88, 1.06].map((time, index) => ({
          frequency: 1567.98,
          end: 2400,
          time,
          duration: 0.15,
          level: 0.05 / (index + 1),
          wave: "sine",
        })),
      ];
      for (const tone of tones) {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const start = now + tone.time;
        oscillator.type = tone.wave;
        oscillator.frequency.setValueAtTime(tone.frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(
          tone.end,
          start + tone.duration,
        );
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(tone.level, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
        oscillator.connect(gain);
        gain.connect(getMasterGainNode());
        oscillator.start(start);
        oscillator.stop(start + tone.duration + 0.01);
      }
      return;
    }
    if (cue === "deal" || cue === "dice-roll") {
      const count =
        cue === "deal" ? Math.min(5, Math.max(1, options.count ?? 1)) : 7;
      const now = audioContext.currentTime;
      const sampleCount = Math.ceil(audioContext.sampleRate * 0.045);
      const buffer = audioContext.createBuffer(
        1,
        sampleCount,
        audioContext.sampleRate,
      );
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < sampleCount; index += 1) {
        samples[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
      }
      for (let index = 0; index < count; index += 1) {
        const time =
          now +
          (cue === "deal" ? index * 0.07 : index * (0.055 + index * 0.009));
        const source = audioContext.createBufferSource();
        const filter = audioContext.createBiquadFilter();
        const gain = audioContext.createGain();
        source.buffer = buffer;
        filter.type = cue === "deal" ? "lowpass" : "bandpass";
        filter.frequency.setValueAtTime(
          cue === "deal" ? 1700 : 1200 + index * 120,
          time,
        );
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(
          cue === "deal" ? 0.07 : 0.045,
          time + 0.003,
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(getMasterGainNode());
        source.start(time);
        source.stop(time + 0.05);
      }
      return;
    }
    if (cue === "coin-spin") {
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(420, now);
      oscillator.frequency.exponentialRampToValueAtTime(1050, now + 0.18);
      oscillator.frequency.exponentialRampToValueAtTime(620, now + 0.42);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      oscillator.connect(gain);
      gain.connect(getMasterGainNode());
      oscillator.start(now);
      oscillator.stop(now + 0.46);
      return;
    }
    if (cue === "coin-flip") {
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(1150 * (options.pitch ?? 1), now);
      oscillator.frequency.exponentialRampToValueAtTime(720, now + 0.075);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.035, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      oscillator.connect(gain);
      gain.connect(getMasterGainNode());
      oscillator.start(now);
      oscillator.stop(now + 0.1);
      return;
    }
    if (cue === "dice-land") {
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(190, now);
      oscillator.frequency.exponentialRampToValueAtTime(82, now + 0.09);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      oscillator.connect(gain);
      gain.connect(getMasterGainNode());
      oscillator.start(now);
      oscillator.stop(now + 0.13);
      return;
    }
    if (cue === "reel-tick") {
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(930 * (options.pitch ?? 1), now);
      oscillator.frequency.exponentialRampToValueAtTime(210, now + 0.065);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.09, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
      oscillator.connect(gain);
      gain.connect(getMasterGainNode());
      oscillator.start(now);
      oscillator.stop(now + 0.08);
      return;
    }
    if (cue === "clack") {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;
      const reelSound = SLOT_THEME;
      oscillator.type = isSlotMode(currentMode)
        ? reelSound.reelWave
        : "triangle";
      oscillator.frequency.setValueAtTime(
        (isSlotMode(currentMode) ? reelSound.reelTone : 135) * options.pitch,
        now,
      );
      oscillator.frequency.exponentialRampToValueAtTime(
        isSlotMode(currentMode) ? reelSound.reelTone * 0.28 : 38,
        now + 0.045,
      );
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.16, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
      oscillator.connect(gain);
      gain.connect(getMasterGainNode());
      oscillator.start(now);
      oscillator.stop(now + 0.06);
      return;
    }
    if (cue === "spin") {
      const now = audioContext.currentTime;
      const sampleCount = Math.ceil(audioContext.sampleRate * 0.18);
      const buffer = audioContext.createBuffer(
        1,
        sampleCount,
        audioContext.sampleRate,
      );
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < sampleCount; index += 1) {
        samples[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
      }
      const source = audioContext.createBufferSource();
      const filter = audioContext.createBiquadFilter();
      const gain = audioContext.createGain();
      const spinFilter = isSlotMode(currentMode)
        ? SLOT_THEME.spinFilter
        : [420, 1500];
      source.buffer = buffer;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(spinFilter[0], now);
      filter.frequency.exponentialRampToValueAtTime(spinFilter[1], now + 0.1);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.035, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(getMasterGainNode());
      source.start(now);
      source.stop(now + 0.19);
      return;
    }
    if (cue === "card") {
      const now = audioContext.currentTime;
      const sampleCount = Math.ceil(audioContext.sampleRate * 0.035);
      const buffer = audioContext.createBuffer(
        1,
        sampleCount,
        audioContext.sampleRate,
      );
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < sampleCount; index += 1) {
        samples[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
      }
      const source = audioContext.createBufferSource();
      const filter = audioContext.createBiquadFilter();
      const gain = audioContext.createGain();
      source.buffer = buffer;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1900, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(getMasterGainNode());
      source.start(now);
      source.stop(now + 0.09);
      return;
    }
    const soundTheme = SLOT_THEME;
    const cueNotes = {
      ui: {
        notes: [740],
        step: 0.035,
        wave: "sine",
        level: 0.035,
        length: 0.075,
      },
      win: {
        notes: soundTheme.winNotes,
        step: 0.105,
        wave: "sine",
        level: 0.075,
        length: 0.24,
      },
      lose: {
        notes: [293.66, 220],
        step: 0.15,
        wave: "triangle",
        level: 0.035,
        length: 0.2,
      },
      push: {
        notes: [392, 440],
        step: 0.08,
        wave: "sine",
        level: 0.035,
        length: 0.13,
      },
      "card-reveal": {
        notes: soundTheme.bonusNotes,
        step: 0.045,
        wave: "sine",
        level: 0.045,
        length: 0.12,
      },
      "coin-land": {
        notes: [880, 1174.66],
        step: 0.055,
        wave: "sine",
        level: 0.06,
        length: 0.16,
      },
    };
    const { notes, step, wave, level, length } = cueNotes[cue] ?? {
      notes: [330, 440, 550],
      step: 0.09,
      wave: "triangle",
      level: 0.06,
      length: 0.15,
    };
    const start = audioContext.currentTime;
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const time = start + index * step;
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(frequency, time);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(level, time + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
      oscillator.connect(gain);
      gain.connect(getMasterGainNode());
      oscillator.start(time);
      oscillator.stop(time + length + 0.01);
    });
  } catch (error) {
    console.error("Could not play the optional sound effect:", error);
  }
}

function playRouletteTick(speed = 1) {
  if (
    !soundEnabled ||
    !audioContext ||
    audioContext.state !== "running" ||
    !AudioContextClass
  )
    return;
  try {
    if (!rouletteNoiseBuffer) {
      const sampleCount = Math.ceil(audioContext.sampleRate * 0.025);
      rouletteNoiseBuffer = audioContext.createBuffer(
        1,
        sampleCount,
        audioContext.sampleRate,
      );
      const samples = rouletteNoiseBuffer.getChannelData(0);
      for (let index = 0; index < sampleCount; index += 1) {
        samples[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
      }
    }

    const now = audioContext.currentTime;
    const click = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    click.buffer = rouletteNoiseBuffer;
    filter.type = "bandpass";
    const intensity = Math.min(1.7, Math.max(0.25, speed));
    filter.frequency.setValueAtTime(1500 + intensity * 400, now);
    filter.Q.setValueAtTime(0.8, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.03 * intensity, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
    click.connect(filter);
    filter.connect(gain);
    gain.connect(getMasterGainNode());
    click.start(now);
    click.stop(now + 0.03);
    const body = audioContext.createOscillator();
    const bodyGain = audioContext.createGain();
    body.type = "triangle";
    body.frequency.setValueAtTime(780 * intensity, now);
    body.frequency.exponentialRampToValueAtTime(115, now + 0.045);
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.018 * intensity, now + 0.002);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    body.connect(bodyGain);
    bodyGain.connect(getMasterGainNode());
    body.start(now);
    body.stop(now + 0.055);
  } catch (error) {
    console.error("Could not play the roulette wheel tick:", error);
  }
}

function rampAmbienceGain(gainNode, value, duration) {
  const now = audioContext.currentTime;
  if (typeof gainNode.gain.cancelAndHoldAtTime === "function") {
    gainNode.gain.cancelAndHoldAtTime(now);
  } else {
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  }
  gainNode.gain.linearRampToValueAtTime(value, now + duration);
}

function showBonusMessage(title, detail) {
  bonusTitle.textContent = title;
  bonusDetail.textContent = detail;
  bonusDisplay.hidden = false;
  bonusDisplay.classList.remove("bonus-reveal");
  void bonusDisplay.offsetWidth;
  bonusDisplay.classList.add("bonus-reveal");
  bonusMusicUntil = performance.now() + 2200;
  triggerPageCelebration(true);
  takeoverFx.triggerTakeover({
    preset: "bonus",
    intensity: 1.15,
    durationMs: 4800,
  });
  haptic([35, 45, 80]);
  document.querySelector("#bonus-vault")?.classList.remove("revealed");
  void bonusDisplay.offsetWidth;
  document.querySelector("#bonus-vault")?.classList.add("revealed");
}

function triggerPageCelebration(isBonus = false) {
  if (REDUCE_MOTION || effectsLevel <= 0 || !pageCelebration) return;
  pageCelebration.replaceChildren();
  const count = Math.max(4, Math.round((isBonus ? 42 : 28) * effectsLevel));
  for (let index = 0; index < count; index += 1) {
    const particle = document.createElement("span");
    particle.className = `page-particle ${index % 5 === 0 ? "coin" : index % 3 === 0 ? "star" : "spark"}`;
    particle.style.setProperty("--particle-x", `${10 + Math.random() * 80}vw`);
    particle.style.setProperty(
      "--particle-drift",
      `${-120 + Math.random() * 240}px`,
    );
    particle.style.setProperty("--particle-delay", `${Math.random() * 0.35}s`);
    particle.style.setProperty(
      "--particle-size",
      `${5 + Math.random() * 10}px`,
    );
    pageCelebration.appendChild(particle);
  }
  document.body.classList.remove("celebrating", "bonus-celebrating");
  void document.body.offsetWidth;
  document.body.classList.add(
    "celebrating",
    ...(isBonus ? ["bonus-celebrating"] : []),
  );
  window.setTimeout(
    () => document.body.classList.remove("celebrating", "bonus-celebrating"),
    isBonus ? 1800 : 1200,
  );
}

function presentBonus(result) {
  const puzzle = result.bonusPayout > 0;
  const wheel = result.fortuneWheel?.triggered === true;
  if (!puzzle && !wheel) return;
  showBonusMessage(
    puzzle && wheel
      ? "PATTERN + WHEEL BONUS"
      : puzzle
        ? "PATTERN BONUS"
        : "FORTUNE WHEEL BONUS",
    puzzle
      ? `Pattern award: ${result.bonusPayout.toLocaleString()} demo credits.${wheel ? " Wheel award follows." : ""}`
      : "Wheel award is being revealed.",
  );
  if (!(REDUCE_MOTION && wheel)) bonusAudio.announce(result);
}

function presentFortuneAward(wheel) {
  showBonusMessage(
    wheel.multiplier === 2 ? "DOUBLE BONUS" : "WHEEL BONUS",
    `${wheel.multiplier}× line bet · ${wheel.payout.toLocaleString()} demo credits`,
  );
  bonusAudio.announceAward(wheel);
}

function playAmbientMelodyNote() {
  if (
    !soundEnabled ||
    !musicEnabled.checked ||
    !audioContext ||
    !ambientNodes ||
    audioContext.state !== "running"
  )
    return;
  const track = getSoundtrack();
  try {
    const state =
      performance.now() < bonusMusicUntil
        ? "bonus"
        : pendingRequestId || blackjackActive || pokerActive
          ? "active"
          : "idle";
    window.LuckySoundtracks.playStep(
      audioContext,
      ambientNodes.musicGainNode,
      track,
      ambientMusicStep,
      currentMode,
      state,
    );
    ambientMusicStep = (ambientMusicStep + 1) % (track.notes.length * 4);
  } catch (error) {
    console.error("Could not play the lounge melody:", error);
  }
}

function startLoungeMelody() {
  window.clearInterval(ambientMusicTimer);
  ambientMusicStep = 0;
  playAmbientMelodyNote();
  ambientMusicTimer = window.setInterval(
    playAmbientMelodyNote,
    getSoundtrack().interval,
  );
}

function toggleCasinoAmbience(enabled) {
  if (!audioContext) return;

  if (!enabled) {
    window.clearInterval(ambientMusicTimer);
    ambientMusicTimer = undefined;
    if (!ambientNodes) return;
    const nodes = ambientNodes;
    rampAmbienceGain(nodes.gainNode, 0.0001, 0.5);
    rampAmbienceGain(nodes.musicGainNode, 0.0001, 0.5);
    window.clearTimeout(ambienceStopTimer);
    ambienceStopTimer = window.setTimeout(() => {
      if (soundEnabled || ambientNodes !== nodes) return;
      nodes.osc1.stop();
      nodes.osc2.stop();
      nodes.osc1.disconnect();
      nodes.osc2.disconnect();
      nodes.filter.disconnect();
      nodes.gainNode.disconnect();
      nodes.musicOscillators.forEach((oscillator) => {
        oscillator.stop();
        oscillator.disconnect();
      });
      nodes.musicGainNode.disconnect();
      ambientNodes = undefined;
      ambienceStopTimer = undefined;
    }, 550);
    return;
  }

  window.clearTimeout(ambienceStopTimer);
  ambienceStopTimer = undefined;
  if (ambientNodes) {
    rampAmbienceGain(
      ambientNodes.gainNode,
      musicEnabled.checked ? 0.008 : 0.0001,
      1.5,
    );
    rampAmbienceGain(
      ambientNodes.musicGainNode,
      musicEnabled.checked ? 0.085 : 0.0001,
      1.5,
    );
    startLoungeMelody();
    return;
  }

  const now = audioContext.currentTime;
  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.linearRampToValueAtTime(
    musicEnabled.checked ? 0.008 : 0.0001,
    now + 1.5,
  );
  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(160, now);
  const osc1 = audioContext.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(55, now);
  const osc2 = audioContext.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(56.8, now);
  const musicGainNode = audioContext.createGain();
  musicGainNode.gain.setValueAtTime(0.0001, now);
  musicGainNode.gain.linearRampToValueAtTime(
    musicEnabled.checked ? 0.085 : 0.0001,
    now + 1.8,
  );
  const musicOscillators = SLOT_THEME.chords.map((frequency) => {
    const oscillator = audioContext.createOscillator();
    const noteGain = audioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, now);
    noteGain.gain.setValueAtTime(0.05, now);
    oscillator.connect(noteGain);
    noteGain.connect(musicGainNode);
    oscillator.start(now);
    return oscillator;
  });
  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(getMasterGainNode());
  musicGainNode.connect(getMasterGainNode());
  ambientNodes = {
    osc1,
    osc2,
    filter,
    gainNode,
    musicGainNode,
    musicOscillators,
  };
  osc1.start(now);
  osc2.start(now);
  startLoungeMelody();
}

function updateConnection(connected) {
  connectionStatus.textContent = connected
    ? "CONNECTED TO GAME SERVER"
    : "RECONNECTING…";
  connectionDot.classList.toggle("offline", !connected);
  const playDisabled =
    !connected ||
    !loungeScene ||
    Boolean(pendingRequestId) ||
    loungeScene.slot3dLoading ||
    (currentMode === "blackjack" && blackjackActive);
  spinButton.disabled = playDisabled;
  slotSpinButton.disabled = playDisabled;
  for (const tab of gameTabs) {
    tab.disabled =
      Boolean(pendingRequestId) ||
      (blackjackActive && currentMode !== tab.id.replace("-tab", "")) ||
      (pokerActive && currentMode !== tab.id.replace("-tab", ""));
  }
  slotStyle.disabled = true;
  slotWheel.disabled =
    Boolean(pendingRequestId) || !loungeScene || blackjackActive || pokerActive;
  blackjackActions.hidden = currentMode !== "blackjack" || !blackjackActive;
  for (const button of blackjackActionButtons) {
    button.disabled =
      !connected ||
      Boolean(pendingRequestId) ||
      !legalBlackjackActions.includes(button.dataset.blackjackAction);
  }
  pokerActions.hidden = currentMode !== "poker" || !pokerActive;
  pokerCardControls.querySelectorAll("button").forEach((button) => {
    button.disabled = Boolean(pendingRequestId);
  });
  pokerDrawButton.disabled =
    !connected || Boolean(pendingRequestId) || !pokerActive;
  updateBetPresets();
}

function syncGameModeUI(mode) {
  const tabsByMode = {
    slots: slotsTab,
    "mechanical-slots": slotsTab,
    "slots-3d": slotsTab,
    blackjack: blackjackTab,
    roulette: rouletteTab,
    poker: pokerTab,
    dice: diceTab,
    coin: coinTab,
  };
  gameTabs.forEach((tab) => {
    const active = tab === tabsByMode[mode];
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-pressed", String(active));
  });
  gameContainer.setAttribute(
    "aria-label",
    {
      slots: "Lucky Slots game reels",
      "mechanical-slots": "Classic Reels alternate slot presentation",
      "slots-3d": "3D WebGL Slots alternate presentation",
      blackjack: "Blackjack table",
      roulette: "European roulette wheel",
      poker: "Video Poker draw table",
      dice: "Dice Roll table",
      coin: "Coin Toss table",
    }[mode],
  );
  rouletteNumber.hidden = mode !== "roulette";
  rouletteNumberLabel.hidden = mode !== "roulette";
  diceNumber.hidden = mode !== "dice";
  diceNumberLabel.hidden = mode !== "dice";
  coinChoice.hidden = mode !== "coin";
  coinChoiceLabel.hidden = mode !== "coin";
  slotButtonPanel.hidden = !isSlotMode(mode);
  slotOptions.hidden = !isSlotMode(mode);
  gameMarquee.hidden = !isSlotMode(mode);
  if (isSlotMode(mode)) {
    slotStyle.value = mode;
    slotStyle.setAttribute(
      "aria-label",
      `Automatic reel presentation: ${
        {
          slots: "modern reels for line bets from 1 to 3",
          "mechanical-slots": "classic reels for line bets from 4 to 7",
          "slots-3d": "3D WebGL reels for line bets from 8 to 10",
        }[mode]
      }`,
    );
  }
  slotWheel.checked = slotWheelEnabled;
  spinButton.hidden = isSlotMode(mode);
  slotRulesNote.hidden = !isSlotMode(mode);
  fortuneRulesNote.hidden = !isSlotMode(mode) || !slotWheelEnabled;
  mechanicalRulesNote.hidden = mode !== "mechanical-slots";
  slots3dRulesNote.hidden = mode !== "slots-3d";
  slots3dStatus.hidden = mode !== "slots-3d";
  updateBetPresets();
  if (isSlotMode(mode)) {
    gameAccessibleStatus.textContent = `Lucky Slots: five columns by three rows, ten fixed paylines, and a 3 by 3 row-or-column bonus puzzle. Bet ${betInput.value} credits per line, ${Number(betInput.value) * 10} credits total.`;
  } else {
    gameAccessibleStatus.textContent = "";
  }
  spinLabel.textContent =
    mode === "blackjack" || mode === "poker"
      ? "Deal"
      : mode === "dice"
        ? "Roll die"
        : mode === "coin"
          ? "Toss coin"
          : "Spin";
  resultDisplay.className = "result";
  resultDisplay.textContent = {
    slots: "Choose your line bet with CREDIT or MAX BET, then spin.",
    "mechanical-slots":
      "Classic Reels uses the same rules as Lucky Slots. Choose a line bet, then spin.",
    "slots-3d":
      "3D Slots uses Babylon.js WebGL with the same rules as Lucky Slots. Choose a line bet, then spin.",
    blackjack: "Choose your bet, then deal.",
    roulette: "Choose a number, then spin.",
    poker: "Choose your bet, then deal five cards.",
    dice: "Pick a die face, then roll.",
    coin: "Call heads or tails, then toss.",
  }[mode];
}

function describeCards(cards) {
  const suitNames = {
    hearts: "hearts",
    diamonds: "diamonds",
    clubs: "clubs",
    spades: "spades",
  };
  return cards
    .map((card) =>
      card.hidden
        ? "hidden card"
        : `${card.rank} of ${suitNames[card.suit] ?? "unknown suit"}`,
    )
    .join(", ");
}

const SLOT_SYMBOL_TEXTURES = {
  CHERRY: "slot-symbol-cherry",
  ORANGE: "slot-symbol-orange",
  WATERMELON: "slot-symbol-watermelon",
  GRAPES: "slot-symbol-grapes",
  SEVEN: "slot-symbol-seven",
};

const SUIT_SYMBOLS = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };
const RED_SUITS = new Set(["hearts", "diamonds"]);

class LoungeScene extends Phaser.Scene {
  constructor() {
    super({ key: "LoungeScene" });
    this.reelTexts = [];
    this.slots3d = undefined;
    this.slot3dGeneration = 0;
    this.slot3dLoading = false;
    this.fortuneOverlay = undefined;
    this.slotFrames = [];
    this.bonusCellTexts = [];
    this.bonusCellFrames = [];
    this.slotLineGraphics = undefined;
    this.slotMascotHalo = undefined;
    this.slotMascotStatus = undefined;
    this.slotWinLights = [];
    this.spinTimer = undefined;
    this.reelSpinTimers = [];
    this.stopTimers = [];
    this.reelSymbolIndexes = [];
    this.mode = currentMode;
    this.cardObjects = [];
    this.blackjackState = undefined;
    this.blackjackButtons = [];
    this.pokerCards = [];
    this.heldPokerCards = new Set();
    this.pokerDrawButton = undefined;
    this.rouletteWheel = undefined;
    this.rouletteSpinTween = undefined;
    this.rouletteBall = undefined;
    this.rouletteBallTween = undefined;
    this.rouletteBallMotion = undefined;
    this.diceFaceGraphics = undefined;
    this.diceStatus = undefined;
    this.diceContainer = undefined;
    this.diceRollTween = undefined;
    this.diceBounceTween = undefined;
    this.coinContainer = undefined;
    this.coinShadow = undefined;
    this.coinFace = undefined;
    this.coinStatus = undefined;
    this.coinTossTween = undefined;
    this.coinTossTimer = undefined;
    this.lastRouletteTick = undefined;
    this.lastRouletteRotation = undefined;
  }

  preload() {
    for (const [symbol, file] of Object.entries({
      question: "question",
      seven: "seven",
      cherry: "cherry",
      orange: "orange",
      watermelon: "watermelon",
      grapes: "grapes",
    })) {
      this.load.svg(
        `slot-symbol-${symbol}`,
        `/client/assets/slots/${file}.svg`,
        { width: 128, height: 128 },
      );
    }
  }

  create() {
    const particle = this.add.graphics();
    particle.fillStyle(0xffffff, 1);
    particle.fillCircle(8, 8, 8);
    particle.generateTexture("win-spark", 16, 16);
    particle.destroy();
    const coin = this.make.graphics({ x: 0, y: 0, add: false });
    coin.fillStyle(0x9b7425, 1);
    coin.fillCircle(12, 12, 11);
    coin.fillStyle(0xe6c77e, 1);
    coin.fillCircle(12, 12, 8);
    coin.lineStyle(1, 0x8c6720, 1);
    coin.strokeCircle(12, 12, 5);
    coin.generateTexture("win-coin", 24, 24);
    coin.destroy();
    loungeScene = this;
    updateAppLoader("Canvas ready. Connecting to the live server…", 60);
    this.drawMode();
    syncGameModeUI(this.mode);
    updateConnection(socket.connected);
    maybeFinishAppLoading();
  }

  addText(x, y, text, style = {}) {
    return this.add.text(x, y, text, {
      ...style,
      fontFamily: "Segoe UI, system-ui, sans-serif",
    });
  }

  drawTableBackdrop(kind) {
    const backdrop = this.add.graphics();
    const theme = SLOT_THEME;
    const width = kind === "slots" ? 720 : 360;
    backdrop.fillStyle(kind === "slots" ? theme.backdrop : 0x101914, 1);
    backdrop.fillRoundedRect(0, 0, width, 440, 18);

    if (kind === "slots") {
      backdrop.fillStyle(0x020712, 0.8);
      backdrop.fillRoundedRect(7, 11, 706, 423, 24);
      backdrop.fillStyle(theme.cabinet, 1);
      backdrop.fillRoundedRect(9, 7, 702, 426, 22);
      backdrop.fillStyle(0x0d1426, 1);
      backdrop.fillRoundedRect(14, 12, 692, 416, 18);
      backdrop.fillGradientStyle(0x173b4a, 0x392745, 0x0d1426, 0x0d1426, 0.55);
      backdrop.fillRoundedRect(19, 17, 682, 54, 12);
      backdrop.lineStyle(1, theme.trim, 0.75);
      backdrop.strokeRoundedRect(16, 14, 688, 412, 17);
      backdrop.fillStyle(0x263953, 1);
      backdrop.fillRoundedRect(27, 73, 666, 242, 14);
      backdrop.fillStyle(theme.display, 1);
      backdrop.fillRoundedRect(31, 77, 658, 234, 11);
      backdrop.lineStyle(1, theme.trim, 0.7);
      backdrop.strokeRoundedRect(31, 77, 658, 234, 11);
      backdrop.fillStyle(0x141c30, 1);
      backdrop.fillRoundedRect(35, 319, 650, 96, 14);
      backdrop.lineStyle(1, theme.trim, 0.62);
      backdrop.strokeRoundedRect(35, 319, 650, 96, 14);
      return;
    }

    backdrop.fillStyle(0x17130f, 1);
    backdrop.fillRoundedRect(0, 0, width, 440, 16);
    backdrop.fillStyle(0x29231b, 1);
    backdrop.fillRoundedRect(9, 9, 342, 422, 20);
    backdrop.fillStyle(kind === "roulette" ? 0x141917 : 0x17352c, 1);
    backdrop.fillRoundedRect(13, 13, 334, 414, 16);
    backdrop.lineStyle(1, 0xd8b66d, 0.6);
    backdrop.strokeRoundedRect(13, 13, 334, 414, 16);
    backdrop.lineStyle(1, 0xf3d996, 0.12);
    backdrop.strokeRoundedRect(19, 19, 322, 402, 12);

    if (kind === "blackjack") {
      backdrop.fillStyle(0x0c261e, 0.9);
      backdrop.fillRoundedRect(25, 50, 310, 315, 20);
      backdrop.fillStyle(0x1d493a, 0.48);
      backdrop.fillEllipse(180, 197, 288, 290);
      backdrop.lineStyle(1, 0xd8b66d, 0.38);
      backdrop.strokeRoundedRect(25, 50, 310, 315, 20);
      backdrop.lineStyle(1, 0xe6c77e, 0.22);
      backdrop.strokeEllipse(180, 206, 262, 265);
      backdrop.lineBetween(48, 239, 312, 239);
      backdrop.fillStyle(0x0b1915, 0.78);
      backdrop.fillRoundedRect(63, 202, 234, 32, 8);
      backdrop.lineStyle(1, 0xd8b66d, 0.3);
      backdrop.strokeRoundedRect(63, 202, 234, 32, 8);
      return;
    }

    if (kind === "poker") {
      backdrop.lineStyle(1, 0xd6c6ff, 0.1);
      for (let index = 0; index < 9; index += 1) {
        const offset = 32 + index * 38;
        backdrop.lineBetween(35, offset, 325, offset + 12);
      }
      backdrop.fillStyle(0x101914, 0.18);
      backdrop.fillEllipse(180, 228, 280, 330);
    }

    if (kind === "dice" || kind === "coin") {
      backdrop.lineStyle(1, 0xf3d996, 0.12);
      backdrop.strokeEllipse(180, 215, 255, 285);
      backdrop.lineStyle(1, 0xf4f1e8, 0.08);
      backdrop.strokeEllipse(180, 215, 225, 255);
      backdrop.fillStyle(0x101914, 0.16);
      backdrop.fillEllipse(180, 315, 230, 55);
    }

    if (kind === "roulette") {
      backdrop.fillStyle(0x000000, 0.45);
      backdrop.fillEllipse(180, 249, 315, 310);
      backdrop.fillStyle(0x273128, 0.3);
      backdrop.fillEllipse(180, 222, 310, 310);
      return;
    }

    backdrop.lineStyle(2, 0xe6c77e, 0.2);
    backdrop.strokeEllipse(180, 228, 306, 340);
    backdrop.lineStyle(1, 0xf4f1e8, 0.12);
    backdrop.strokeEllipse(180, 228, 292, 326);
    backdrop.lineBetween(42, 226, 318, 226);
    backdrop.fillStyle(0x101914, 0.24);
    backdrop.fillEllipse(180, 228, 280, 318);
  }

  setMode(mode) {
    this.spinTimer?.remove();
    this.spinTimer = undefined;
    this.stopSlotSpinTimers();
    this.stopTimers.forEach((timer) => timer.remove());
    this.rouletteSpinTween?.stop();
    this.rouletteBallTween?.stop();
    this.diceRollTween?.stop();
    this.diceBounceTween?.stop();
    this.coinTossTween?.stop();
    this.coinTossTimer?.remove();
    this.mode = mode;
    this.drawMode();
  }

  drawMode() {
    this.slot3dGeneration += 1;
    this.slot3dLoading = false;
    this.slots3d?.destroy();
    this.slots3d = undefined;
    this.fortuneOverlay = undefined;
    this.children.removeAll(true);
    this.reelTexts = [];
    this.slotFrames = [];
    this.bonusCellTexts = [];
    this.bonusCellFrames = [];
    this.slotLineGraphics = undefined;
    this.slotMascotHalo = undefined;
    this.slotMascotStatus = undefined;
    this.slotWinLights = [];
    this.cardObjects = [];
    this.blackjackState = undefined;
    this.blackjackButtons = [];
    this.pokerCards = [];
    this.heldPokerCards.clear();
    this.pokerDrawButton = undefined;
    this.rouletteWheel = undefined;
    this.rouletteSpinTween = undefined;
    this.rouletteBall = undefined;
    this.rouletteBallTween = undefined;
    this.rouletteBallMotion = undefined;
    this.coinContainer = undefined;
    this.coinFace = undefined;
    this.coinStatus = undefined;
    this.coinTossTween = undefined;
    this.coinTossTimer = undefined;
    this.coinShadow = undefined;
    this.lastRouletteTick = undefined;
    this.lastRouletteRotation = undefined;
    if (isSlotMode(this.mode)) this.drawSlots();
    else if (this.mode === "blackjack") this.drawBlackjack();
    else if (this.mode === "roulette") this.drawRoulette();
    else if (this.mode === "poker") this.drawVideoPoker();
    else if (this.mode === "dice") this.drawDice();
    else this.drawCoin();
    const isSlots = isSlotMode(this.mode);
    gameContainer.classList.toggle("slot-mode", isSlots);
    gameContainer.classList.toggle("casino-cabinet", isSlots);
    document
      .querySelector(".game-card")
      .classList.toggle("slots-active", isSlots);
    slotButtonPanel.classList.toggle("casino-deck", isSlots);
    document
      .querySelector(".controls")
      .classList.toggle("casino-deck", isSlots);
    slotSpinButton.classList.toggle("spin-button-giant", isSlots);
    this.scale.resize(isSlots ? 720 : 360, 440);
  }

  drawSlots() {
    this.drawTableBackdrop("slots");
    const theme = SLOT_THEME;
    this.addText(
      315,
      43,
      `LUCKY LOUNGE  •  ${theme.label.toUpperCase()}  •  FIVE REEL SLOTS`,
      {
        color: Phaser.Display.Color.IntegerToColor(theme.trim).rgba,
        fontSize: "14px",
        fontStyle: "bold",
        letterSpacing: 3,
      },
    ).setOrigin(0.5);
    this.addText(360, 63, "3 ROWS  ·  10 FIXED PAYLINES  ·  PATTERN BONUS", {
      color: "#c5d0c4",
      fontSize: "10px",
      fontStyle: "bold",
      letterSpacing: 1.5,
    }).setOrigin(0.5);

    this.add
      .rectangle(655, 56, 88, 52, 0x172b3b)
      .setStrokeStyle(2, theme.trim, 0.88);
    this.addText(655, 38, "TOP BOX", {
      color: Phaser.Display.Color.IntegerToColor(theme.trim).rgba,
      fontSize: "8px",
      fontStyle: "bold",
      letterSpacing: 1.4,
    }).setOrigin(0.5);
    this.slotWinLights = [633, 655, 677].map((x, index) => {
      const light = this.add
        .circle(x, 58, 6, theme.glow, 0.18)
        .setStrokeStyle(1, theme.trim, 0.82);
      this.add.circle(
        x,
        58,
        2.2,
        index === 1 ? theme.accent : theme.trim,
        0.48,
      );
      return light;
    });
    this.addText(655, 77, "PRIZE LIGHTS", {
      color: "#c5d0c4",
      fontSize: "6px",
      fontStyle: "bold",
      letterSpacing: 0.8,
    }).setOrigin(0.5);

    const columns = [130, 245, 360, 475, 590];
    const rows = [137, 204, 271];
    columns.forEach((x, column) => {
      const reelPanel = this.add.graphics();
      reelPanel.fillStyle(0x0a1222, 0.95);
      reelPanel.fillRoundedRect(x - 53, 101, 106, 202, 7);
      reelPanel.fillGradientStyle(0x4a8092, 0x18394a, 0x101c32, 0x101c32, 0.28);
      reelPanel.fillRoundedRect(x - 50, 104, 100, 196, 5);
      reelPanel.lineStyle(1, theme.trim, 0.34);
      reelPanel.strokeRoundedRect(x - 53, 101, 106, 202, 7);
      this.addText(x, 91, `REEL ${column + 1}`, {
        color: "#c5d0c4",
        fontSize: "9px",
        fontStyle: "bold",
        letterSpacing: 1.2,
      }).setOrigin(0.5);
      rows.forEach((y, row) => {
        const frame = this.add
          .rectangle(
            x,
            y,
            100,
            58,
            this.mode === "mechanical-slots" ? 0x211b17 : 0x202c44,
          )
          .setStrokeStyle(1, theme.trim, row === 1 ? 0.55 : 0.18);
        this.slotFrames.push(frame);
        this.add.rectangle(x, y - 25, 94, 1, theme.glow, 0.13);
        const symbol = this.add
          .image(x, y, "slot-symbol-question")
          .setDisplaySize(52, 52);
        if (this.mode === "mechanical-slots") symbol.setTint(0xffe0a3);
        if (this.mode === "slots-3d")
          symbol.setDisplaySize(58, 52).setTint(0xe8fbff);
        this.reelTexts.push(symbol);
      });
    });
    this.slotLineGraphics = this.add.graphics();
    this.addText(360, 337, "CROSSWORD BONUS  ·  MATCH A FULL ROW OR COLUMN", {
      color: Phaser.Display.Color.IntegerToColor(theme.glow).rgba,
      fontSize: "10px",
      fontStyle: "bold",
      letterSpacing: 1.2,
    }).setOrigin(0.5);
    this.addText(145, 375, "10 LINES", {
      color: Phaser.Display.Color.IntegerToColor(theme.trim).rgba,
      fontSize: "12px",
      fontStyle: "bold",
      letterSpacing: 2,
    }).setOrigin(0.5);
    this.addText(145, 397, "3→1×  4→2×  5→3×", {
      color: "#c5d0c4",
      fontSize: "9px",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.addText(575, 375, "BONUS × 1", {
      color: Phaser.Display.Color.IntegerToColor(theme.trim).rgba,
      fontSize: "12px",
      fontStyle: "bold",
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.slotMascotHalo = this.add
      .circle(655, 371, 22, theme.glow, 0.09)
      .setStrokeStyle(1, theme.trim, 0.72);
    const mascot = this.add.graphics();
    mascot.fillStyle(theme.trim, 1);
    mascot.fillCircle(655, 371, 16);
    mascot.fillStyle(theme.display, 1);
    mascot.fillCircle(655, 371, 13);
    mascot.lineStyle(1, theme.trim, 0.9);
    mascot.strokeCircle(655, 371, 10);
    this.addText(655, 371, "L", {
      color: "#f6dda0",
      fontSize: "15px",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.slotMascotStatus = this.addText(655, 399, "READY", {
      color: Phaser.Display.Color.IntegerToColor(theme.glow).rgba,
      fontSize: "8px",
      fontStyle: "bold",
      letterSpacing: 1,
    }).setOrigin(0.5);
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        const x = 336 + column * 24;
        const y = 374 + row * 20;
        const frame = this.add
          .rectangle(x, y, 21, 17, 0x243650)
          .setStrokeStyle(1, theme.trim, 0.68);
        this.bonusCellFrames.push(frame);
        this.bonusCellTexts.push(
          this.add.image(x, y, "slot-symbol-question").setDisplaySize(13, 13),
        );
      }
    }
    if (this.mode === "slots-3d") void this.loadSlots3D(this.slot3dGeneration);
  }

  async loadSlots3D(generation) {
    this.slot3dLoading = true;
    slots3dStatus.textContent = "Loading the Babylon.js WebGL presentation…";
    updateConnection(socket.connected);
    const active = () =>
      this.mode === "slots-3d" && generation === this.slot3dGeneration;
    const fallback = (error) => {
      if (!active()) return;
      console.error("Could not display 3D Slots:", error);
      this.slots3d?.destroy();
      this.slots3d = undefined;
      this.reelTexts.forEach((symbol) => symbol.setVisible(true));
      slots3dStatus.textContent =
        "3D is unavailable. Showing the Phaser 2D reels instead.";
    };
    try {
      await window.LuckySlots3D.loadBabylon();
      if (!active()) return;
      this.slots3d = new window.LuckySlots3D.Slots3D(
        gameContainer,
        REDUCE_MOTION,
        effectsLevel,
        fallback,
      );
      this.reelTexts.forEach((symbol) => symbol.setVisible(false));
      slots3dStatus.textContent =
        "Babylon.js WebGL presentation · Server-selected results · Virtual credits only.";
    } catch (error) {
      fallback(error);
    } finally {
      if (active()) {
        this.slot3dLoading = false;
        updateConnection(socket.connected);
        if (typeof maybeFinishAppLoading === "function")
          maybeFinishAppLoading();
      }
    }
  }

  drawBlackjack() {
    this.drawTableBackdrop("blackjack");
    this.addText(180, 25, "BLACKJACK", {
      color: "#e6c77e",
      fontSize: "13px",
      fontStyle: "bold",
      letterSpacing: 3,
    }).setOrigin(0.5);
    this.addText(180, 67, "DEALER", {
      color: "#f4f1e8",
      fontSize: "12px",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.addText(180, 260, "PLAYER", {
      color: "#f4f1e8",
      fontSize: "12px",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.statusText = this.addText(180, 218, "Place a bet, then deal.", {
      color: "#f3d996",
      fontSize: "13px",
      align: "center",
      wordWrap: { width: 310 },
    }).setOrigin(0.5);
    this.hitButton = this.createButton(
      55,
      393,
      "HIT",
      () => requestBlackjackAction("hit"),
      72,
    );
    this.standButton = this.createButton(
      140,
      393,
      "STAND",
      () => requestBlackjackAction("stand"),
      78,
    );
    this.splitButton = this.createButton(
      224,
      393,
      "SPLIT",
      () => requestBlackjackAction("split"),
      74,
    );
    this.doubleButton = this.createButton(
      307,
      393,
      "DOUBLE",
      () => requestBlackjackAction("double"),
      78,
    );
    this.setActionButtons([]);
  }

  drawRoulette() {
    this.drawTableBackdrop("roulette");
    this.addText(180, 23, "EUROPEAN ROULETTE", {
      color: "#e6c77e",
      fontSize: "12px",
      fontStyle: "bold",
      letterSpacing: 2,
    }).setOrigin(0.5);
    this.rouletteWheel = this.add.container(180, 235);
    const graphics = this.add.graphics();
    const radius = 138;
    const slice = (Math.PI * 2) / ROULETTE_SEQUENCE.length;

    graphics.fillStyle(0x080908, 1);
    graphics.fillCircle(0, 3, 145);
    graphics.fillStyle(0x72572f, 1);
    graphics.fillCircle(0, 0, 143);
    graphics.fillStyle(0xd0ad6b, 1);
    graphics.fillCircle(0, 0, 140);
    graphics.fillStyle(0x251d16, 1);
    graphics.fillCircle(0, 0, radius);
    graphics.lineStyle(2, 0xf3d996, 0.55);
    graphics.strokeCircle(0, 0, 135);
    graphics.lineStyle(7, 0x5e482d, 1);
    graphics.strokeCircle(0, 0, 130);
    graphics.fillStyle(0x100e0c, 1);
    graphics.fillCircle(0, 0, 124);
    ROULETTE_SEQUENCE.forEach((number, index) => {
      const centerAngle = -Math.PI / 2 + index * slice;
      const color =
        number === 0
          ? 0x276d52
          : ROULETTE_RED.has(number)
            ? 0x9c3438
            : 0x181a19;
      graphics.fillStyle(color, 1);
      graphics.lineStyle(1, 0xd8b66d, 0.45);
      graphics.slice(
        0,
        0,
        122,
        centerAngle - slice / 2,
        centerAngle + slice / 2,
        false,
      );
      graphics.fillPath();
      graphics.strokePath();

      const textRadius = 113;
      const label = this.addText(
        Math.cos(centerAngle) * textRadius,
        Math.sin(centerAngle) * textRadius,
        String(number),
        { color: "#fff8e9", fontSize: "9px", fontStyle: "bold" },
      ).setOrigin(0.5);
      label.setRotation(centerAngle + Math.PI / 2);
      this.rouletteWheel.add(label);
    });

    graphics.fillStyle(0x99713e, 1);
    graphics.fillCircle(0, 0, 96);
    graphics.fillStyle(0x2d2117, 1);
    graphics.fillCircle(0, 0, 93);
    graphics.fillStyle(0x4b3321, 1);
    graphics.fillCircle(0, 0, 87);
    graphics.lineStyle(1, 0xe6c77e, 0.35);
    graphics.strokeCircle(0, 0, 83);
    graphics.fillStyle(0x251b15, 1);
    graphics.fillCircle(0, 0, 72);
    graphics.lineStyle(2, 0xd8b66d, 0.75);
    graphics.strokeCircle(0, 0, 72);
    graphics.fillStyle(0x624b2b, 1);
    graphics.fillCircle(0, 0, 20);
    graphics.fillStyle(0xd8b66d, 1);
    graphics.fillCircle(-2, -3, 14);
    graphics.fillStyle(0xffe7ac, 0.65);
    graphics.fillCircle(-6, -7, 4);
    graphics.lineStyle(3, 0xb99155, 0.85);
    graphics.lineBetween(-55, 0, 55, 0);
    graphics.lineBetween(0, -55, 0, 55);
    graphics.fillStyle(0xf3d996, 1);
    graphics.fillCircle(0, 0, 6);
    this.rouletteWheel.addAt(graphics, 0);
    this.rouletteBall = this.add
      .circle(180, 105, 6, 0xf4f1e8)
      .setStrokeStyle(2, 0xe6c77e);
    this.rouletteBallMotion = { angle: -Math.PI / 2, radius: 130 };

    const pointer = this.add.graphics();
    pointer.fillStyle(0xe6c77e, 1);
    pointer.fillTriangle(180, 74, 168, 54, 192, 54);
    pointer.lineStyle(2, 0xffffff, 0.8);
    pointer.strokeTriangle(180, 74, 168, 54, 192, 54);

    this.rouletteStatus = this.addText(
      180,
      408,
      "Choose a number, then spin.",
      {
        color: "#a7b3a9",
        fontSize: "12px",
      },
    ).setOrigin(0.5);
  }

  drawVideoPoker() {
    this.drawTableBackdrop("poker");
    this.addText(180, 30, "VIDEO POKER", {
      color: "#e6c77e",
      fontSize: "13px",
      fontStyle: "bold",
      letterSpacing: 3,
    }).setOrigin(0.5);
    this.pokerStatus = this.addText(
      180,
      85,
      "Deal five cards, then choose which to hold.",
      {
        color: "#a7b3a9",
        fontSize: "12px",
        align: "center",
        wordWrap: { width: 310 },
      },
    ).setOrigin(0.5);
    this.pokerDrawButton = this.createButton(
      180,
      385,
      "DRAW",
      requestVideoPokerDraw,
      112,
    );
    this.setPokerControls(false);
  }

  drawDice() {
    this.drawTableBackdrop("dice");
    this.addText(180, 30, "DICE ROLL", {
      color: "#e6c77e",
      fontSize: "13px",
      fontStyle: "bold",
      letterSpacing: 3,
    }).setOrigin(0.5);
    this.diceContainer = this.add.container(180, 205);
    this.diceFaceGraphics = this.add.graphics();
    this.diceContainer.add(this.diceFaceGraphics);
    this.drawDieFace(1);
    this.diceStatus = this.addText(180, 310, "Pick a face, then roll.", {
      color: "#a7b3a9",
      fontSize: "12px",
      align: "center",
      wordWrap: { width: 310 },
    }).setOrigin(0.5);
    this.addText(
      180,
      350,
      "Exact hit returns 5× the bet, including the stake.",
      {
        color: "#a7b3a9",
        fontSize: "10px",
        align: "center",
        wordWrap: { width: 300 },
      },
    ).setOrigin(0.5);
  }

  drawCoin() {
    this.drawTableBackdrop("coin");
    this.addText(180, 30, "COIN TOSS", {
      color: "#e6c77e",
      fontSize: "13px",
      fontStyle: "bold",
      letterSpacing: 3,
    }).setOrigin(0.5);
    this.coinShadow = this.add.ellipse(180, 300, 112, 22, 0x101914, 0.35);
    this.coinContainer = this.add.container(180, 205);
    const coin = this.add.graphics();
    coin.fillStyle(0xaa8c2c, 1);
    coin.fillCircle(0, 0, 78);
    coin.fillStyle(0xe6c77e, 1);
    coin.fillCircle(0, 0, 69);
    coin.lineStyle(3, 0x173b30, 0.8);
    coin.strokeCircle(0, 0, 60);
    this.coinContainer.add(coin);
    this.coinFace = this.addText(0, 0, "L", {
      color: "#173b30",
      fontSize: "48px",
      fontStyle: "bold",
      fontFamily: "Georgia, Times New Roman, serif",
    }).setOrigin(0.5);
    this.coinContainer.add(this.coinFace);
    this.coinStatus = this.addText(
      180,
      320,
      "Call heads or tails, then toss.",
      {
        color: "#a7b3a9",
        fontSize: "12px",
        align: "center",
        wordWrap: { width: 310 },
      },
    ).setOrigin(0.5);
    this.addText(
      180,
      355,
      "A correct call returns 2× the demo bet, including the stake.",
      {
        color: "#a7b3a9",
        fontSize: "10px",
        align: "center",
        wordWrap: { width: 300 },
      },
    ).setOrigin(0.5);
  }

  drawDieFace(face) {
    const graphics = this.diceFaceGraphics;
    if (!graphics) return;
    const pipPositions = [
      [-42, -42],
      [0, -42],
      [42, -42],
      [-42, 0],
      [0, 0],
      [42, 0],
      [-42, 42],
      [0, 42],
      [42, 42],
    ];
    const visiblePips = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 3, 6, 2, 5, 8],
    }[face];

    graphics.clear();
    graphics.fillStyle(0xf4f1e8, 1);
    graphics.fillRoundedRect(-68, -68, 136, 136, 18);
    graphics.lineStyle(3, 0xe6c77e, 1);
    graphics.strokeRoundedRect(-68, -68, 136, 136, 18);
    graphics.fillStyle(0x173b30, 1);
    visiblePips.forEach((position) => {
      const [x, y] = pipPositions[position];
      graphics.fillCircle(x, y, 9);
    });
  }

  startDiceRoll() {
    this.spinTimer?.remove();
    this.spinTimer = undefined;
    this.diceRollTween?.stop();
    this.diceStatus.setText("The server is rolling the die…");
    void playCue("dice-roll");
    if (REDUCE_MOTION) return;
    let face = 0;
    this.spinTimer = this.time.addEvent({
      delay: 90,
      loop: true,
      callback: () => {
        face = (face % 6) + 1;
        this.drawDieFace(face);
      },
    });
    this.diceRollTween = this.tweens.add({
      targets: this.diceContainer,
      rotation: this.diceContainer.rotation + Math.PI * 4,
      duration: 1050,
      ease: "Cubic.easeOut",
    });
    this.diceBounceTween = this.tweens.add({
      targets: this.diceContainer,
      y: 145,
      duration: 210,
      ease: "Quad.easeOut",
      yoyo: true,
      repeat: 3,
      onYoyo: () => void playCue("clack", { pitch: 1.1 }),
      onUpdate: () => {
        const height = Math.max(0, 205 - this.diceContainer.y);
        this.diceContainer.setScale(1 + height / 260, 1 - height / 320);
      },
      onComplete: () => this.diceContainer.setScale(1),
    });
  }

  showDiceResult(number, complete) {
    this.spinTimer?.remove();
    this.spinTimer = undefined;
    this.diceRollTween?.stop();
    this.diceBounceTween?.stop();
    this.diceContainer.rotation = 0;
    this.diceContainer.y = 205;
    this.diceContainer.setScale(1);
    this.drawDieFace(number);
    this.diceStatus.setText(`The die landed on ${number}.`);
    gameAccessibleStatus.textContent = `The die landed on ${number}. Your selected face is ${diceNumber.value}.`;
    void playCue("dice-land");
    if (!REDUCE_MOTION) {
      this.tweens.add({
        targets: this.diceContainer,
        scaleX: { from: 0.88, to: 1 },
        scaleY: { from: 0.88, to: 1 },
        duration: 220,
        ease: "Back.Out",
        onComplete: complete,
      });
    } else {
      complete();
    }
  }

  startCoinToss() {
    this.coinTossTween?.stop();
    this.coinTossTimer?.remove();
    this.coinStatus.setText("The server is tossing the coin…");
    void playCue("coin-spin");
    if (REDUCE_MOTION) return;
    let face = false;
    this.coinTossTimer = this.time.addEvent({
      delay: 145,
      loop: true,
      callback: () => {
        face = !face;
        this.coinFace.setText(face ? "H" : "T");
        void playCue("coin-flip", { pitch: face ? 1 : 1.12 });
      },
    });
    this.coinTossTween = this.tweens.add({
      targets: this.coinContainer,
      scaleX: 0.08,
      y: 130,
      duration: 115,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      onUpdate: (tween) => {
        this.coinShadow?.setScale(1.5 - tween.progress * 0.5, 1);
        this.coinShadow?.setAlpha(0.35 - tween.progress * 0.17);
      },
    });
  }

  showCoinResult(result, complete) {
    this.coinTossTimer?.remove();
    this.coinTossTimer = undefined;
    this.coinTossTween?.stop();
    this.coinTossTween = undefined;
    this.coinContainer.rotation = 0;
    this.coinContainer.y = 205;
    this.coinContainer.scaleX = 1;
    this.coinContainer.scaleY = 1;
    this.coinShadow?.setScale(1);
    this.coinShadow?.setAlpha(0.35);
    this.coinFace.setText(result === "heads" ? "H" : "T");
    this.coinStatus.setText(`The coin landed ${result}.`);
    gameAccessibleStatus.textContent = `The coin landed ${result}. Your call was ${coinChoice.value}.`;
    if (REDUCE_MOTION) {
      void playCue("coin-land");
      complete();
      return;
    }
    let face = false;
    let flipCount = 0;
    this.coinTossTimer = this.time.addEvent({
      delay: 145,
      loop: true,
      callback: () => {
        face = !face;
        this.coinFace.setText(face ? "H" : "T");
        flipCount += 1;
        if (flipCount <= 8)
          void playCue("coin-flip", { pitch: face ? 1 : 1.12 });
      },
    });
    this.tweens.add({
      targets: this.coinContainer,
      scaleX: 0.08,
      y: 130,
      duration: 115,
      yoyo: true,
      repeat: 7,
      ease: "Sine.easeInOut",
      onUpdate: (tween) => {
        const progress = tween.progress;
        this.coinShadow?.setScale(1.5 - progress * 0.5, 1);
        this.coinShadow?.setAlpha(0.35 - progress * 0.17);
      },
      onComplete: () => {
        this.coinTossTimer?.remove();
        this.coinTossTimer = undefined;
        this.coinFace.setText(result === "heads" ? "H" : "T");
        this.coinContainer.y = 205;
        this.tweens.add({
          targets: this.coinContainer,
          scaleX: 1,
          scaleY: 1.04,
          y: 195,
          duration: 220,
          ease: "Back.Out",
          onUpdate: () => {
            const height = 205 - this.coinContainer.y;
            this.coinShadow?.setScale(1.5 - height / 150, 1);
            this.coinShadow?.setAlpha(0.35 - height / 440);
          },
          onComplete: () => {
            this.coinContainer.y = 205;
            this.coinContainer.setScale(1);
            this.coinShadow?.setScale(1);
            this.coinShadow?.setAlpha(0.35);
            void playCue("coin-land");
            complete();
          },
        });
      },
    });
  }

  createButton(x, y, label, callback, width = 112) {
    const background = this.add
      .rectangle(x, y, width, 42, 0x17231d)
      .setStrokeStyle(1, 0xe6c77e, 0.7)
      .setInteractive({ useHandCursor: true });
    const led = this.add
      .circle(x + width / 2 - 9, y - 14, 2.5, 0x9bd1a9)
      .setAlpha(0.35);
    const text = this.addText(x, y, label, {
      color: "#e6c77e",
      fontSize: "13px",
      fontStyle: "bold",
    }).setOrigin(0.5);

    background.on("pointerdown", () => {
      if (!background.input?.enabled) return;
      void playCue("ui");
      this.tweens.add({
        targets: [background, text],
        scale: 0.96,
        duration: 70,
        yoyo: true,
        ease: "Sine.easeOut",
      });
      callback();
    });
    background.on("pointerover", () => {
      background.setFillStyle(0xf3d996);
      text.setColor("#101914");
    });
    background.on("pointerout", () => {
      background.setFillStyle(0x17231d);
      text.setColor("#e6c77e");
    });
    return { background, text, led };
  }

  setActionButtons(enabled) {
    const actions = Array.isArray(enabled)
      ? enabled
      : enabled
        ? ["hit", "stand"]
        : [];
    this.lastLegalActions = actions;
    legalBlackjackActions = actions;
    for (const [action, button] of [
      ["hit", this.hitButton],
      ["stand", this.standButton],
      ["split", this.splitButton],
      ["double", this.doubleButton],
    ]) {
      if (!button) continue;
      const active = actions.includes(action);
      button.background.input.enabled = active;
      button.background.setAlpha(active ? 1 : 0.45);
      button.text.setAlpha(active ? 1 : 0.45);
      this.tweens.killTweensOf(button.led);
      button.led.setAlpha(active ? 0.85 : 0.25);
      if (active && !REDUCE_MOTION) {
        this.tweens.add({
          targets: button.led,
          alpha: 0.45,
          yoyo: true,
          repeat: -1,
          duration: 1300,
          ease: "Sine.easeInOut",
        });
      }
    }
  }

  showBlackjackState(state, finished) {
    const previousState = this.blackjackState;
    const previousHands =
      previousState?.hands ??
      (previousState ? [{ cards: previousState.player }] : []);
    const dealerRevealIndex = finished
      ? (previousState?.dealer?.findIndex((card) => card.hidden === true) ?? -1)
      : -1;
    this.cardObjects.forEach((card) => card.destroy(true));
    this.cardObjects = [];
    this.dealSequence = 0;
    this.drawHand(state.dealer, 135, 180, {
      animateFromIndex: previousState ? previousState.dealer.length : 0,
      revealIndex: dealerRevealIndex,
    });
    const hands = state.hands ?? [{ cards: state.player }];
    if (hands.length === 1) {
      this.drawHand(hands[0].cards, 325, 180, {
        animateFromIndex: previousHands[0]?.cards.length ?? 0,
      });
    } else {
      hands.forEach((hand, index) => {
        this.drawHand(hand.cards, 325, index === 0 ? 95 : 265, {
          animateFromIndex: previousHands[index]?.cards.length ?? 0,
        });
        const label = this.addText(
          index === 0 ? 95 : 265,
          280,
          `HAND ${index + 1}${index === state.activeHandIndex && !finished ? " · PLAYING" : ""}`,
          {
            color:
              index === state.activeHandIndex && !finished
                ? "#9bd1a9"
                : "#c5d0c4",
            fontSize: "9px",
            fontStyle: "bold",
          },
        ).setOrigin(0.5);
        this.cardObjects.push(label);
      });
    }
    this.blackjackState = state;
    blackjackActive = !finished;
    if (finished) {
      const outcomes = {
        blackjack: "Blackjack! You win 3:2.",
        win: "You win!",
        lose: "Dealer wins this hand.",
        bust: "Bust — dealer wins.",
        push: "Push — your bet is returned.",
      };
      this.statusText.setText(outcomes[state.outcome] ?? "Hand complete.");
      this.setActionButtons(false);
    } else {
      this.statusText.setText(
        hands.length > 1
          ? `Hand ${state.activeHandIndex + 1} of ${hands.length} — choose an action.`
          : "Your move — hit, stand, split, or double.",
      );
      this.setActionButtons(state.legalActions ?? ["hit", "stand"]);
    }
    gameAccessibleStatus.textContent = `Dealer: ${describeCards(state.dealer)}. Player: ${hands.map((hand) => describeCards(hand.cards)).join("; ")}. ${finished ? this.statusText.text : "Choose an available action."}`;
    updateConnection(socket.connected);
  }

  drawHand(
    cards,
    y,
    centerX = 180,
    { animateFromIndex = 0, revealIndex = -1 } = {},
  ) {
    const spacing =
      cards.length > 1 ? Math.min(58, 148 / (cards.length - 1)) : 0;
    const startX = centerX - ((cards.length - 1) * spacing) / 2;
    cards.forEach((card, index) => {
      const x = startX + index * spacing;
      const container = this.add.container(x, y);
      const hidden = card.hidden === true;
      const isRed = RED_SUITS.has(card.suit);
      const color = isRed ? "#a83d48" : "#17231d";
      container.add(this.add.rectangle(3, 6, 62, 82, 0x07100c, 0.7));
      const background = this.add
        .rectangle(0, 0, 62, 82, hidden ? 0x173b30 : 0xf8f5e9)
        .setStrokeStyle(2, 0xe6c77e, hidden ? 0.88 : 1);
      container.add(background);
      container.add(
        this.add
          .rectangle(
            0,
            0,
            54,
            74,
            hidden ? 0x173b30 : 0xffffff,
            hidden ? 0 : 0.16,
          )
          .setStrokeStyle(1, hidden ? 0xe6c77e : 0xb5ad98, hidden ? 0.38 : 0.5),
      );
      if (!hidden) {
        container.add(
          this.addText(-23, -31, card.rank, {
            color,
            fontSize: "15px",
            fontStyle: "bold",
          }).setOrigin(0.5),
        );
        container.add(
          this.addText(0, 2, SUIT_SYMBOLS[card.suit] ?? "?", {
            color,
            fontSize: "31px",
          }).setOrigin(0.5),
        );
        container.add(
          this.addText(22, 28, SUIT_SYMBOLS[card.suit] ?? "?", {
            color,
            fontSize: "13px",
          })
            .setOrigin(0.5)
            .setAngle(180),
        );
      } else {
        const monogram = this.addText(0, 0, "LU", {
          color: "#e6c77e",
          fontSize: "18px",
          fontStyle: "bold",
          letterSpacing: 2,
        }).setOrigin(0.5);
        container.add(monogram);
        container.add(this.add.circle(-14, -20, 2, 0xe6c77e, 0.65));
        container.add(this.add.circle(14, 20, 2, 0xe6c77e, 0.65));
      }
      this.cardObjects.push(container);
      const animateCard = index >= animateFromIndex || index === revealIndex;
      if (!REDUCE_MOTION && animateCard) {
        const reveal = index === revealIndex;
        container.setAlpha(0);
        container.setScale(reveal ? 0.04 : 0.72, 1.04);
        this.tweens.add({
          targets: container,
          alpha: 1,
          y: y + 5,
          scaleX: 1,
          scaleY: 1,
          duration: 350,
          delay: this.dealSequence * 110,
          ease: "Back.Out",
          easeParams: [1.2],
          onStart: () => void playCue(reveal ? "card-reveal" : "card"),
        });
        this.dealSequence += 1;
      }
    });
  }

  setPokerControls(enabled) {
    if (!this.pokerDrawButton) return;
    this.pokerDrawButton.background.input.enabled = enabled;
    this.pokerDrawButton.background.setAlpha(enabled ? 1 : 0.45);
    this.pokerDrawButton.text.setAlpha(enabled ? 1 : 0.45);
    this.tweens.killTweensOf(this.pokerDrawButton.led);
    this.pokerDrawButton.led.setAlpha(enabled ? 0.85 : 0.25);
    if (enabled && !REDUCE_MOTION) {
      this.tweens.add({
        targets: this.pokerDrawButton.led,
        alpha: 0.45,
        yoyo: true,
        repeat: -1,
        duration: 1300,
        ease: "Sine.easeInOut",
      });
    }
  }

  togglePokerCard(index) {
    if (!pokerActive || pendingRequestId) return;
    if (this.heldPokerCards.has(index)) this.heldPokerCards.delete(index);
    else this.heldPokerCards.add(index);
    const held = this.heldPokerCards.has(index);
    const container = this.pokerCards[index];
    container?.list[0]?.setStrokeStyle(
      held ? 3 : 2,
      held ? 0x4c8b62 : 0xe6c77e,
    );
    container?.list[3]?.setText(held ? "HELD" : "");
    if (!REDUCE_MOTION && container) {
      this.tweens.add({
        targets: container,
        y: held ? 235 : 245,
        duration: 130,
        ease: "Sine.easeOut",
      });
    } else if (container) {
      container.y = held ? 235 : 245;
    }
    const accessibleButton = pokerCardControls.querySelector(
      `[data-card-index="${index}"]`,
    );
    accessibleButton?.setAttribute("aria-pressed", String(held));
  }

  showVideoPokerState(state) {
    this.pokerCards.forEach((card) => card.destroy(true));
    this.pokerCards = [];
    this.heldPokerCards.clear();
    const cards = state.cards ?? [];
    const startX = 180 - ((cards.length - 1) * 63) / 2;
    cards.forEach((card, index) => {
      const x = startX + index * 63;
      const container = this.add
        .container(x, 245)
        .setSize(54, 82)
        .setInteractive({ useHandCursor: true });
      const background = this.add
        .rectangle(0, 0, 52, 76, 0xf4f1e8)
        .setStrokeStyle(2, 0xe6c77e);
      const rank = this.addText(-18, -30, card.rank, {
        color: RED_SUITS.has(card.suit) ? "#b9565d" : "#202b25",
        fontSize: "13px",
        fontStyle: "bold",
      });
      const suit = this.addText(0, 2, SUIT_SYMBOLS[card.suit] ?? "?", {
        color: RED_SUITS.has(card.suit) ? "#b9565d" : "#202b25",
        fontSize: "27px",
      }).setOrigin(0.5);
      const hold = this.addText(0, 54, "", {
        color: "#4c8b62",
        fontSize: "9px",
        fontStyle: "bold",
      }).setOrigin(0.5);
      container.add([background, rank, suit, hold]);
      container.on("pointerdown", () => {
        this.togglePokerCard(index);
      });
      this.pokerCards.push(container);
      if (!REDUCE_MOTION) {
        container.setAlpha(0);
        this.tweens.add({
          targets: container,
          alpha: 1,
          duration: 200,
          delay: index * 55,
          ease: "Back.Out",
        });
      }
    });
    const canDraw = state.status === "draw";
    pokerCardControls.replaceChildren(
      ...cards.map((card, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.cardIndex = String(index);
        button.textContent = `Hold ${index + 1}: ${card.rank} ${SUIT_SYMBOLS[card.suit] ?? ""}`;
        button.setAttribute(
          "aria-label",
          `Hold card ${index + 1}, ${describeCards([card])}`,
        );
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", () => this.togglePokerCard(index));
        return button;
      }),
    );
    this.pokerStatus.setText(
      canDraw ? "Tap cards to hold, then draw replacements." : "Hand complete.",
    );
    this.setPokerControls(canDraw);
    gameAccessibleStatus.textContent = cards.length
      ? `Video Poker hand: ${describeCards(cards)}. ${canDraw ? "Choose cards to hold, then draw." : "Hand complete."}`
      : "Video Poker is ready to deal.";
    updateConnection(socket.connected);
  }

  stopSlotSpinTimers(column) {
    const columns =
      column === undefined ? this.reelSpinTimers.keys() : [column];
    for (const index of columns) {
      this.reelSpinTimers[index]?.forEach((timer) => timer.remove());
      this.reelSpinTimers[index] = [];
      this.reelTexts
        .slice(index * 3, index * 3 + 3)
        .forEach((symbol) => this.tweens.killTweensOf(symbol));
    }
  }

  startSpin() {
    this.stopSlotSpinTimers();
    this.stopTimers.forEach((timer) => timer.remove());
    this.stopTimers = [];
    this.reelSymbolIndexes = Array.from({ length: 5 }, () => 0);
    this.reelSpinTimers = Array.from({ length: 5 }, () => []);
    this.slotWinLights.forEach((light) => {
      this.tweens.killTweensOf(light);
      light.setAlpha(1).setScale(1).setFillStyle(SLOT_THEME.glow, 0.18);
    });
    this.slotLineGraphics?.clear();
    this.bonusCellTexts.forEach((symbol) =>
      symbol.setTexture("slot-symbol-question"),
    );
    this.bonusCellFrames.forEach((frame) =>
      frame.setStrokeStyle(1, SLOT_THEME.trim, 0.68),
    );
    this.slotMascotStatus?.setText("SPINNING");
    this.slots3d?.start();
    void playCue("spin");
    if (REDUCE_MOTION) return;
    this.slotFrames.forEach((frame, index) => {
      this.tweens.killTweensOf(frame);
      frame.setScale(1);
      frame.setStrokeStyle(2, 0xf3d996, 0.9);
      this.tweens.add({
        targets: frame,
        alpha: 0.65,
        yoyo: true,
        repeat: -1,
        duration: 180 + Math.floor(index / 3) * 55,
        ease: "Sine.easeInOut",
      });
    });
    const symbols = Object.keys(SLOT_SYMBOL_TEXTURES);
    for (let column = 0; column < 5; column += 1) {
      const startTimer = this.time.delayedCall(column * 72, () => {
        const reelTimer = this.time.addEvent({
          delay: 110 + column * 8,
          loop: true,
          callback: () => {
            const symbolIndex =
              (this.reelSymbolIndexes[column] + 1) % symbols.length;
            this.reelSymbolIndexes[column] = symbolIndex;
            this.reelTexts
              .slice(column * 3, column * 3 + 3)
              .forEach((text, row) => {
                const baseY = [137, 204, 271][row];
                const symbol =
                  symbols[(symbolIndex + column * 2 + row) % symbols.length];
                this.tweens.killTweensOf(text);
                text.setTexture(
                  SLOT_SYMBOL_TEXTURES[symbol] ?? "slot-symbol-question",
                );
                text.setAlpha(0.62 + column * 0.07);
                text.setDisplaySize(this.mode === "slots-3d" ? 58 : 52, 56);
                text.angle = this.mode === "slots-3d" ? (row - 1) * 2 : 0;
                text.y = baseY - 12;
                this.tweens.add({
                  targets: text,
                  y: baseY + 12,
                  duration: 110 + column * 8,
                  ease: "Linear",
                });
              });
          },
        });
        this.reelSpinTimers[column].push(reelTimer);
      });
      this.reelSpinTimers[column].push(startTimer);
    }
  }

  showResult(result, complete, isNetWin = false) {
    this.stopTimers.forEach((timer) => timer.remove());
    this.slotLineGraphics?.clear();
    const revealColumn = (column) => {
      this.stopSlotSpinTimers(column);
      this.slots3d?.settle(column, result.reels[column]);
      result.reels[column].forEach((symbol, row) => {
        const index = column * 3 + row;
        this.reelTexts[index].setTexture(
          SLOT_SYMBOL_TEXTURES[symbol] ?? "slot-symbol-question",
        );
        this.reelTexts[index].setAlpha(1);
        this.reelTexts[index].setDisplaySize(
          this.mode === "slots-3d" ? 58 : 52,
          52,
        );
        this.reelTexts[index].angle =
          this.mode === "slots-3d" ? (row - 1) * 2 : 0;
        this.reelTexts[index].y = [137, 204, 271][row];
      });
      this.slotFrames.slice(column * 3, column * 3 + 3).forEach((frame) => {
        this.tweens.killTweensOf(frame);
        frame.setAlpha(1).setStrokeStyle(2, SLOT_THEME.trim, 0.86);
        if (!REDUCE_MOTION) {
          this.tweens.add({
            targets: frame,
            alpha: { from: 0.45, to: 1 },
            duration: 130,
            ease: "Sine.easeOut",
          });
        }
      });
      void playCue("reel-tick", {
        pitch: column === 4 ? 0.82 : 1 + column * 0.08,
      });
    };
    const bounceColumn = (column, completeBounce) => {
      const targets = this.reelTexts.slice(column * 3, column * 3 + 3);
      const basePositions = targets.map((text) => text.y);
      const animateOffset = (offset, duration, ease, onComplete) => {
        this.tweens.addCounter({
          from: 0,
          to: offset,
          duration,
          ease,
          onUpdate: (tween) => {
            const shift = tween.getValue();
            targets.forEach((text, row) => {
              text.y = basePositions[row] + shift;
            });
          },
          onComplete,
        });
      };
      animateOffset(12, 100, "Sine.easeOut", () => {
        animateOffset(-6, 90, "Back.easeOut", () => {
          animateOffset(0, 155, "Back.easeOut", completeBounce);
        });
      });
    };

    result.bonusGrid.forEach((row, rowIndex) =>
      row.forEach((symbol, columnIndex) => {
        const index = rowIndex * 3 + columnIndex;
        const completed =
          result.bonusLines.includes(`row-${rowIndex + 1}`) ||
          result.bonusLines.includes(`column-${columnIndex + 1}`);
        this.bonusCellTexts[index].setTexture(
          SLOT_SYMBOL_TEXTURES[symbol] ?? "slot-symbol-question",
        );
        this.bonusCellTexts[index].setAlpha(completed ? 1 : 0.72);
        this.bonusCellTexts[index].setDisplaySize(
          completed ? 16 : 13,
          completed ? 16 : 13,
        );
        this.bonusCellFrames[index].setStrokeStyle(
          completed ? 2 : 1,
          completed ? SLOT_THEME.glow : SLOT_THEME.trim,
          completed ? 1 : 0.68,
        );
      }),
    );

    const drawWinningPaylines = () => {
      this.slots3d?.highlight(result.paylines);
      const graphics = this.slotLineGraphics;
      const theme = SLOT_THEME;
      const winningFrames = new Set();
      result.paylines.forEach((win) => {
        graphics.lineStyle(3, theme.glow, 0.95);
        for (let column = 0; column < win.symbols - 1; column += 1) {
          winningFrames.add(column * 3 + win.rows[column]);
          winningFrames.add((column + 1) * 3 + win.rows[column + 1]);
          graphics.lineBetween(
            130 + column * 115,
            137 + win.rows[column] * 67,
            130 + (column + 1) * 115,
            137 + win.rows[column + 1] * 67,
          );
        }
      });
      if (
        !REDUCE_MOTION &&
        (result.paylines.length || result.bonusPayout > 0)
      ) {
        const lights = this.slotWinLights;
        lights.forEach((light) => light.setFillStyle(theme.glow, 0.82));
        this.tweens.add({
          targets: [
            ...lights,
            ...[...winningFrames].map((index) => this.slotFrames[index]),
          ],
          alpha: { from: 0.42, to: 1 },
          scale: { from: 0.92, to: 1.12 },
          duration: 360,
          yoyo: true,
          repeat: 2,
          ease: "Sine.easeInOut",
          onComplete: () => {
            lights.forEach((light) =>
              light.setAlpha(1).setScale(1).setFillStyle(theme.glow, 0.18),
            );
            winningFrames.forEach((index) =>
              this.slotFrames[index].setAlpha(1).setScale(1),
            );
          },
        });
      }
    };
    const updateMascot = () => {
      this.slotMascotStatus?.setText(
        result.bonusLines.length
          ? "PUZZLE!"
          : isNetWin
            ? "GREAT HIT!"
            : "THANKS!",
      );
      if (!REDUCE_MOTION && (isNetWin || result.bonusPayout > 0)) {
        this.tweens.add({
          targets: this.slotMascotHalo,
          scale: 1.16,
          yoyo: true,
          duration: 180,
          repeat: 1,
        });
      }
    };

    if (REDUCE_MOTION) {
      result.reels.forEach((_, column) => revealColumn(column));
      drawWinningPaylines();
      if (isNetWin)
        this.emitWinEffects(
          !(result.bonusPayout > 0 || result.fortuneWheel?.triggered),
        );
      presentBonus(result);
      updateMascot();
      this.showFortuneWheel(result.fortuneWheel, complete);
      return;
    }
    this.stopTimers = result.reels.map((_, column) =>
      this.time.delayedCall(650 + column * 300, () => {
        revealColumn(column);
        const finish = () => {
          if (column !== result.reels.length - 1) return;
          drawWinningPaylines();
          if (isNetWin || result.bonusPayout > 0) {
            const renderEffects =
              typeof effectsLevel === "number" ? effectsLevel : 1;
            if (!REDUCE_MOTION && renderEffects > 0) {
              this.cameras.main.shake(
                180,
                (isNetWin ? 0.003 : 0.0018) * Math.max(0.35, renderEffects),
                true,
              );
              this.cameras.main.flash(110, 240, 218, 150, false);
            }
          }
          if (isNetWin)
            this.emitWinEffects(
              !(result.bonusPayout > 0 || result.fortuneWheel?.triggered),
            );
          presentBonus(result);
          updateMascot();
          this.showFortuneWheel(result.fortuneWheel, complete);
        };
        bounceColumn(column, finish);
        this.slotFrames
          .slice(column * 3, column * 3 + 3)
          .forEach((frame) => frame.setStrokeStyle(3, SLOT_THEME.glow, 1));
      }),
    );
  }

  showFortuneWheel(wheelResult, complete) {
    if (!wheelResult?.triggered) {
      complete();
      return;
    }
    if (REDUCE_MOTION) {
      presentFortuneAward(wheelResult);
      complete();
      return;
    }
    const values = [1, 2, 3, 5, 8, 10];
    const overlay = this.add.container(360, 220);
    this.fortuneOverlay = overlay;
    const backdrop = this.add.rectangle(0, 0, 720, 440, 0x080705, 0.94);
    const title = this.addText(0, -184, "FORTUNE WHEEL BONUS", {
      color: "#f6dda0",
      fontSize: "19px",
      fontStyle: "bold",
    }).setOrigin(0.5);
    const label = this.addText(0, 173, "Revealing the server-selected award…", {
      color: "#f6dda0",
      fontSize: "13px",
    }).setOrigin(0.5);
    const wheel = this.add.container(0, -4);
    const graphics = this.add.graphics();
    const slice = Math.PI / 3;
    values.forEach((value, index) => {
      const angle = -Math.PI / 2 + index * slice;
      graphics.fillStyle(index % 2 ? 0x6a4621 : 0xb28b4b, 1);
      graphics.slice(0, 0, 132, angle - slice / 2, angle + slice / 2, false);
      graphics.fillPath();
      graphics.lineStyle(2, 0xf6dda0, 0.7);
      graphics.strokePath();
      const text = this.addText(
        Math.cos(angle) * 92,
        Math.sin(angle) * 92,
        `${value}×`,
        {
          color: "#fff5d5",
          fontSize: "18px",
          fontStyle: "bold",
        },
      ).setOrigin(0.5);
      wheel.add(text);
    });
    graphics.lineStyle(5, 0xf6dda0, 1);
    graphics.strokeCircle(0, 0, 132);
    wheel.addAt(graphics, 0);
    const pointer = this.add.graphics();
    pointer.fillStyle(0xffe6a4, 1);
    pointer.fillTriangle(0, -124, -13, -154, 13, -154);
    overlay.add([backdrop, title, wheel, pointer, label]);
    this.tweens.add({
      targets: wheel,
      rotation: Math.PI * 6 - wheelResult.index * slice,
      duration: 2300,
      ease: "Cubic.easeOut",
      onComplete: () => {
        label.setText(
          `${wheelResult.multiplier}× line bet · ${wheelResult.payout} credits`,
        );
        presentFortuneAward(wheelResult);
        this.time.delayedCall(1200, () => {
          overlay.destroy();
          this.fortuneOverlay = undefined;
          complete();
        });
      },
    });
  }

  emitWinEffects(playSound = true) {
    const renderEffects = typeof effectsLevel === "number" ? effectsLevel : 1;
    if (playSound) void playCue("win");
    triggerPageCelebration();
    takeoverFx.triggerTakeover({
      preset: "win",
      intensity: 0.9,
      durationMs: 3200,
    });
    if (REDUCE_MOTION || renderEffects <= 0) return;
    gameContainer.classList.remove("win-vignette");
    void gameContainer.offsetWidth;
    gameContainer.classList.add("win-vignette");
    gameContainer.addEventListener(
      "animationend",
      () => {
        gameContainer.classList.remove("win-vignette");
      },
      { once: true },
    );
    const center = isSlotMode(this.mode)
      ? { x: 360, y: 220 }
      : { x: 180, y: 220 };
    const particles = this.add.particles(center.x, center.y, "win-spark", {
      speed: { min: 60, max: 150 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xaa8c2c, 0xe6c77e, 0x4c8b62, 0xf4f1e8],
      lifespan: 850,
      gravityY: 80,
      emitting: false,
    });
    particles.explode(Math.max(6, Math.round(10 + 12 * renderEffects)));
    const coins = this.add.particles(
      this.scale.width / 2,
      this.scale.height - 14,
      "win-coin",
      {
        speed: { min: 110, max: 230 },
        angle: { min: 245, max: 295 },
        gravityY: 420,
        scale: { start: 0.62, end: 0.2 },
        alpha: { start: 0.95, end: 0 },
        rotate: { start: 0, end: 540 },
        lifespan: 1100,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      },
    );
    coins.explode(Math.max(3, Math.round(4 + 7 * renderEffects)));
    const halo = this.add.circle(center.x, center.y, 22, SLOT_THEME.glow, 0.35);
    halo.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: halo,
      scale: 8,
      alpha: 0,
      duration: 650,
      ease: "Cubic.easeOut",
      onComplete: () => halo.destroy(),
    });
    this.time.delayedCall(1250, () => {
      particles.destroy();
      coins.destroy();
    });
  }

  startRouletteSpin() {
    this.rouletteSpinTween?.stop();
    this.rouletteBallTween?.stop();
    this.rouletteStatus.setText("The server is spinning the wheel…");
    void playCue("spin");
    if (REDUCE_MOTION) return;
    this.lastRouletteTick = undefined;
    this.lastRouletteRotation = undefined;
    this.rouletteBallMotion.angle = -Math.PI / 2;
    this.rouletteBallMotion.radius = 130;
    this.rouletteBall.setPosition(180, 105);
    if (!REDUCE_MOTION) {
      this.rouletteBallTween = this.tweens.add({
        targets: this.rouletteBallMotion,
        angle: (Math.PI * 3) / 2,
        duration: 1050,
        repeat: -1,
        onUpdate: () => this.updateRouletteBall(),
      });
    }
    this.rouletteSpinTween = this.tweens.add({
      targets: this.rouletteWheel,
      rotation: this.rouletteWheel.rotation + Math.PI * 2,
      duration: 2400,
      ease: "Cubic.easeInOut",
      repeat: -1,
      onUpdate: (tween) => this.playRouletteTicks(tween.targets[0].rotation),
    });
  }

  playRouletteTicks(rotation) {
    const pocketAngle = (Math.PI * 2) / ROULETTE_SEQUENCE.length;
    const pocket = Math.floor(rotation / pocketAngle);
    const previousRotation = this.lastRouletteRotation;
    this.lastRouletteRotation = rotation;
    if (this.lastRouletteTick === undefined || pocket < this.lastRouletteTick) {
      this.lastRouletteTick = pocket;
      return;
    }
    const crossedPockets = pocket - this.lastRouletteTick;
    if (crossedPockets > 0) {
      const angularSpeed =
        previousRotation === undefined
          ? 1
          : (Math.abs(rotation - previousRotation) / pocketAngle) * 4;
      for (let tick = 0; tick < Math.min(crossedPockets, 2); tick += 1)
        playRouletteTick(angularSpeed);
      this.lastRouletteTick = pocket;
    }
  }

  updateRouletteBall() {
    const { angle, radius } = this.rouletteBallMotion;
    this.rouletteBall.setPosition(
      180 + Math.cos(angle) * radius,
      235 + Math.sin(angle) * radius,
    );
  }

  showRouletteResult(number, complete) {
    this.rouletteSpinTween?.stop();
    this.rouletteBallTween?.stop();
    const slice = (Math.PI * 2) / ROULETTE_SEQUENCE.length;
    const index = ROULETTE_SEQUENCE.indexOf(number);
    const desiredRotation = -index * slice;
    const currentRotation = this.rouletteWheel.rotation;
    const delta = (desiredRotation - currentRotation) % (Math.PI * 2);
    const clockwiseDelta = (delta + Math.PI * 2) % (Math.PI * 2);
    const targetRotation = currentRotation + Math.PI * 2 + clockwiseDelta;

    if (REDUCE_MOTION) {
      this.rouletteWheel.rotation = desiredRotation;
      this.rouletteBallMotion.angle = -Math.PI / 2;
      this.rouletteBallMotion.radius = 130;
      this.updateRouletteBall();
      this.rouletteStatus.setText(`Winning number: ${number}`);
      complete();
      return;
    }

    this.rouletteSpinTween = this.tweens.add({
      targets: this.rouletteWheel,
      rotation: targetRotation,
      duration: 3600,
      ease: "Cubic.easeOut",
      onUpdate: (tween) => this.playRouletteTicks(tween.targets[0].rotation),
      onComplete: () => {
        this.rouletteWheel.rotation = desiredRotation;
        this.rouletteStatus.setText(`Winning number: ${number}`);
        complete();
      },
    });
    const startAngle = this.rouletteBallMotion.angle;
    this.rouletteBallTween = this.tweens.add({
      targets: this.rouletteBallMotion,
      angle: startAngle + Math.PI * 4,
      radius: 112,
      duration: 3600,
      ease: "Cubic.easeOut",
      onUpdate: () => this.updateRouletteBall(),
      onComplete: () => {
        this.rouletteBallMotion.angle = -Math.PI / 2;
        this.rouletteBallMotion.radius = 112;
        this.updateRouletteBall();
      },
    });
  }

  celebrateRouletteWin() {
    this.emitWinEffects();
    this.rouletteWheel.setAlpha(1);
  }
}

function finishPendingRequest() {
  pendingRequestId = undefined;
  updateConnection(socket.connected);
}

function setMode(mode) {
  if (
    !GAME_MODES.includes(mode) ||
    pendingRequestId ||
    blackjackActive ||
    pokerActive ||
    mode === currentMode ||
    !loungeScene
  )
    return;
  currentMode = mode;
  if (isSlotMode(mode)) lastSlotMode = mode;
  bonusDisplay.hidden = true;
  bonusMusicUntil = 0;
  syncGameModeUI(mode);
  betInput.disabled = false;
  loungeScene.setMode(mode);
  updateConnection(socket.connected);
  updateGameUrl();
}

function updateGameUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("game", isSlotMode(currentMode) ? "slots" : currentMode);
  if (isSlotMode(currentMode) && slotWheelEnabled)
    url.searchParams.set("wheel", "1");
  else url.searchParams.delete("wheel");
  window.history.replaceState(window.history.state, "", url);
}

function requestBlackjackAction(action) {
  if (!socket.connected || pendingRequestId || !blackjackActive) return;
  pendingRequestId = crypto.randomUUID();
  loungeScene.setActionButtons(false);
  updateConnection(true);
  resultDisplay.className = "result";
  resultDisplay.textContent =
    action === "hit"
      ? "The server is dealing a card…"
      : "The server is playing the dealer hand…";
  socket.emit("blackjack_action", { action, requestId: pendingRequestId });
}

function requestVideoPokerDraw() {
  if (!socket.connected || pendingRequestId || !pokerActive) return;
  pendingRequestId = crypto.randomUUID();
  loungeScene.setPokerControls(false);
  updateConnection(true);
  resultDisplay.className = "result";
  resultDisplay.textContent = "The server is drawing your replacement cards…";
  socket.emit("video_poker_draw", {
    holds: [...loungeScene.heldPokerCards],
    requestId: pendingRequestId,
  });
}

function applyVideoPokerStart(response) {
  if (response.requestId && response.requestId !== pendingRequestId) return;
  pendingRequestId = undefined;
  if (!pokerActive && currentMode !== "poker") setMode("poker");
  pokerActive = true;
  loungeScene.showVideoPokerState(response.state);
  void playCue("deal", { count: 5 });
  resultDisplay.className = "result";
  resultDisplay.textContent = "Choose cards to hold, then draw.";
  spinLabel.textContent = "Draw";
  betInput.disabled = true;
  updateConnection(socket.connected);
}

function applyVideoPokerResult(response) {
  if (response.requestId !== pendingRequestId) return;
  pendingRequestId = undefined;
  pokerActive = false;
  loungeScene.showVideoPokerState(response.state);
  resultDisplay.className = response.net > 0 ? "result win" : "result";
  const achievements = response.newAchievements?.length
    ? ` Achievement unlocked: ${response.newAchievements.join(", ")}.`
    : "";
  resultDisplay.textContent = `${response.outcome} · ${response.multiplier}:1 · Payout ${response.payout.toLocaleString()} credits.${achievements}`;
  showAchievementToast(response.newAchievements);
  if (response.net > 0) loungeScene.emitWinEffects();
  else void playCue("lose");
  bonusAudio.announceOutcome({
    game: "poker",
    outcome: response.outcome,
    net: response.net,
    payout: response.payout,
  });
  recordSessionOutcome(response);
  spinLabel.textContent = "Deal";
  betInput.disabled = false;
  updateConnection(socket.connected);
}

function applyBlackjackResponse(response, finished) {
  if (response.requestId && response.requestId !== pendingRequestId) return;
  if (currentMode !== "blackjack") setMode("blackjack");
  pendingRequestId = undefined;
  blackjackActive = !finished;
  loungeScene.showBlackjackState(response.state, finished);
  if (finished) {
    const messages = {
      blackjack: "Blackjack! You win 3:2.",
      win: "You beat the dealer!",
      lose: "Dealer wins this hand.",
      bust: "Bust — dealer wins.",
      push: "Push — your bet is returned.",
    };
    resultDisplay.className =
      response.state.outcome === "win" || response.state.outcome === "blackjack"
        ? "result win"
        : "result";
    const achievements = response.newAchievements?.length
      ? ` Achievement unlocked: ${response.newAchievements.join(", ")}.`
      : "";
    resultDisplay.textContent = `${messages[response.state.outcome] ?? "Hand complete."} Payout: ${response.payout.toLocaleString()} credits.${achievements}`;
    showAchievementToast(response.newAchievements);
    const outcomeCue =
      response.state.outcome === "push"
        ? "push"
        : response.state.outcome === "win" ||
            response.state.outcome === "blackjack"
          ? "win"
          : "lose";
    void playCue(outcomeCue);
    bonusAudio.announceOutcome({
      game: "blackjack",
      outcome: response.state.outcome,
      net: response.net,
      payout: response.payout,
    });
    recordSessionOutcome({ ...response, net: response.payout - response.bet });
    spinLabel.textContent = "Deal";
    betInput.disabled = false;
  } else {
    resultDisplay.className = "result";
    resultDisplay.textContent = "Your turn. Choose an available action.";
    spinLabel.textContent = "Hand in play";
    betInput.disabled = true;
  }
  updateConnection(socket.connected);
}

new Phaser.Game({
  type: LOW_POWER_RENDERING ? Phaser.CANVAS : Phaser.AUTO,
  width: isSlotMode(currentMode) ? 720 : 360,
  height: 440,
  parent: "game-container",
  backgroundColor: 0x173b30,
  scene: LoungeScene,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
  },
  render: {
    antialias: !LOW_POWER_RENDERING,
    pixelArt: false,
    powerPreference: LOW_POWER_RENDERING ? "low-power" : "high-performance",
    resolution: RENDER_RESOLUTION,
    roundPixels: true,
  },
});

document.querySelector("#play-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (
    !socket.connected ||
    !loungeScene ||
    loungeScene.slot3dLoading ||
    pendingRequestId
  )
    return;

  const bet = Number(betInput.value);
  const maximumBet = isSlotMode(currentMode) ? 10 : 100;
  if (!Number.isSafeInteger(bet) || bet < 1 || bet > maximumBet) {
    resultDisplay.className = "result loss";
    resultDisplay.textContent = isSlotMode(currentMode)
      ? "Enter a whole-number line bet from 1 to 10 credits."
      : "Enter a whole-number bet from 1 to 100 credits.";
    return;
  }

  if (currentMode === "poker" && pokerActive) {
    requestVideoPokerDraw();
    return;
  }

  pendingRequestId = crypto.randomUUID();
  bonusDisplay.hidden = true;
  bonusMusicUntil = 0;
  spinButton.disabled = true;
  updateConnection(socket.connected);
  resultDisplay.className = "result";
  if (isSlotMode(currentMode)) {
    resultDisplay.textContent = `The server is spinning 5 reels across 10 paylines. Total wager: ${bet * 10} credits…`;
    loungeScene.startSpin();
    socket.emit("place_bet", {
      game: slotWheelEnabled ? "fortune-slots" : "slots",
      bet,
      requestId: pendingRequestId,
    });
  } else if (currentMode === "blackjack") {
    resultDisplay.textContent = "The server is dealing your hand…";
    socket.emit("blackjack_deal", { bet, requestId: pendingRequestId });
  } else if (currentMode === "roulette") {
    resultDisplay.textContent = "The server is spinning the wheel…";
    loungeScene.startRouletteSpin();
    socket.emit("place_bet", {
      game: "roulette",
      bet,
      choice: Number(rouletteNumber.value),
      requestId: pendingRequestId,
    });
  } else if (currentMode === "poker") {
    resultDisplay.textContent = "The server is dealing five cards…";
    socket.emit("video_poker_deal", { bet, requestId: pendingRequestId });
  } else if (currentMode === "dice") {
    resultDisplay.textContent = "The server is rolling the die…";
    loungeScene.startDiceRoll();
    socket.emit("place_bet", {
      game: "dice",
      bet,
      choice: Number(diceNumber.value),
      requestId: pendingRequestId,
    });
  } else if (currentMode === "coin") {
    resultDisplay.textContent = "The server is tossing the coin…";
    loungeScene.startCoinToss();
    socket.emit("place_bet", {
      game: "coin",
      bet,
      choice: coinChoice.value,
      requestId: pendingRequestId,
    });
  }
});

slotsTab.addEventListener("click", () =>
  setMode(
    window.LuckySlotPresentation.getSlotPresentationForBet(betInput.value),
  ),
);
slotStyle.addEventListener("change", () => {
  slotStyle.value = isSlotMode(currentMode) ? currentMode : lastSlotMode;
});
slotWheel.addEventListener("change", () => {
  if (
    !isSlotMode(currentMode) ||
    pendingRequestId ||
    blackjackActive ||
    pokerActive
  ) {
    slotWheel.checked = slotWheelEnabled;
    return;
  }
  slotWheelEnabled = slotWheel.checked;
  fortuneRulesNote.hidden = !slotWheelEnabled;
  resultDisplay.className = "result";
  resultDisplay.textContent = slotWheelEnabled
    ? "Fortune Wheel enabled for the next spin. The server selects any wheel award."
    : "Fortune Wheel disabled. The next spin uses standard Lucky Slots rules.";
  updateGameUrl();
  void playCue("ui");
});
blackjackTab.addEventListener("click", () => setMode("blackjack"));
rouletteTab.addEventListener("click", () => setMode("roulette"));
pokerTab.addEventListener("click", () => setMode("poker"));
diceTab.addEventListener("click", () => setMode("dice"));
coinTab.addEventListener("click", () => setMode("coin"));
blackjackActionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    void playCue("ui");
    requestBlackjackAction(button.dataset.blackjackAction);
  });
});
pokerDrawButton.addEventListener("click", () => {
  void playCue("ui");
  requestVideoPokerDraw();
});
gameTabs.forEach((tab) =>
  tab.addEventListener("click", () => void playCue("ui")),
);
pokerCardControls.addEventListener("click", (event) => {
  if (event.target instanceof HTMLButtonElement) void playCue("ui");
});
[rouletteNumber, diceNumber, coinChoice].forEach((control) => {
  control.addEventListener("change", () => void playCue("ui"));
});
soundToggle.addEventListener("click", async () => {
  const sequence = ++soundToggleSequence;
  const enable = !soundEnabled;
  soundToggle.disabled = true;
  if (enable && AudioContextClass) {
    try {
      audioContext ??= new AudioContextClass();
      getMasterGainNode();
      await audioContext.resume();
      if (sequence !== soundToggleSequence) return;
      soundEnabled = true;
      getMasterGainNode().gain.setTargetAtTime(
        soundVolumeLevel,
        audioContext.currentTime,
        0.025,
      );
      toggleCasinoAmbience(true);
    } catch (error) {
      if (sequence !== soundToggleSequence) return;
      soundEnabled = false;
      console.error("Could not enable game sounds and lounge music:", error);
    }
  } else {
    soundEnabled = false;
    bonusAudio.stopVoice();
    if (masterGainNode && audioContext)
      masterGainNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.025);
    toggleCasinoAmbience(false);
  }
  soundToggle.textContent = soundEnabled
    ? "Sound on"
    : AudioContextClass
      ? "Sound off"
      : "Sound unavailable";
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
  soundToggle.setAttribute(
    "aria-label",
    soundEnabled
      ? "Disable game sounds and lounge music"
      : "Enable game sounds and lounge music",
  );
  soundToggle.title = soundEnabled
    ? "Disables game sounds and fades out the synthesized lounge music"
    : "Enables synthesized game sounds and lounge music";
  try {
    window.localStorage.setItem(
      "lucky-lounge-sound",
      soundEnabled ? "on" : "off",
    );
  } catch (error) {
    console.warn("Could not save the game sound preference:", error);
  }
  soundToggle.disabled = false;
});

if (!soundEnabled) {
  soundToggle.textContent = "Sound off";
  soundToggle.setAttribute("aria-pressed", "false");
  soundToggle.setAttribute("aria-label", "Enable game sounds and lounge music");
} else {
  soundToggle.textContent = "Sound on";
  soundToggle.setAttribute("aria-pressed", "true");
  soundToggle.setAttribute(
    "aria-label",
    "Disable game sounds and lounge music",
  );
}

if (soundEnabled && AudioContextClass) {
  const enableGameSoundOnGesture = async () => {
    try {
      audioContext ??= new AudioContextClass();
      getMasterGainNode();
      await audioContext.resume();
      if (!soundEnabled) return;
      toggleCasinoAmbience(true);
    } catch (error) {
      console.warn(
        "The browser blocked the first automatic game audio start:",
        error,
      );
    }
  };
  window.addEventListener("pointerdown", enableGameSoundOnGesture, {
    once: true,
  });
  window.addEventListener("keydown", enableGameSoundOnGesture, { once: true });
}

socket.on("connect", () => {
  gameRoomConnected = true;
  updateAppLoader("Server connected. Restoring your active hand…", 82);
  updateConnection(true);
  socket.emit("blackjack_resume");
  socket.emit("video_poker_resume");
  if (!pendingRequestId && !blackjackActive) {
    resultDisplay.className = "result";
    resultDisplay.textContent = "Connected. Choose your bet and spin.";
  }
  maybeFinishAppLoading();
});
socket.on("disconnect", () => updateConnection(false));
socket.on("connect_error", (error) => {
  updateConnection(false);
  console.error("Game server connection failed:", error.message);
});
socket.on("balance_update", (balance) => {
  updateBalanceDisplay(balance);
});
socket.on("spin_result", (response) => {
  if (response.requestId !== pendingRequestId) return;
  const finish = () => {
    finishPendingRequest();
    recordSessionOutcome(response);
    showAchievementToast(response.newAchievements);
    if (response.net > 0) {
      resultDisplay.className = "result win";
      resultDisplay.textContent = `${response.result.message} Total wager ${response.bet.toLocaleString()} credits; payout ${response.payout.toLocaleString()} credits.`;
      gameAccessibleStatus.textContent = resultDisplay.textContent;
      if (currentMode === "roulette") loungeScene.celebrateRouletteWin();
      else if (currentMode === "dice") loungeScene.emitWinEffects();
      else if (!isSlotMode(currentMode)) void playCue("win");
    } else if (response.net === 0) {
      resultDisplay.className = "result";
      resultDisplay.textContent = `${response.result.message} Total wager ${response.bet.toLocaleString()} credits; payout ${response.payout.toLocaleString()} credits.`;
      gameAccessibleStatus.textContent = resultDisplay.textContent;
    } else {
      resultDisplay.className = "result loss";
      resultDisplay.textContent = `${response.result.message} Total demo wager: ${response.bet.toLocaleString()} credits.`;
      gameAccessibleStatus.textContent = resultDisplay.textContent;
      void playCue("lose");
    }
    const hasSlotBonus =
      isSlotMode(currentMode) &&
      (response.result.bonusPayout > 0 ||
        response.result.fortuneWheel?.triggered === true);
    if (!hasSlotBonus) {
      bonusAudio.announceOutcome({
        game: isSlotMode(currentMode) ? "slots" : response.game,
        outcome:
          response.result.outcome ??
          response.result.result ??
          response.result.message,
        net: response.net,
        payout: response.payout,
      });
    }
  };
  if (response.game === "roulette") {
    loungeScene.showRouletteResult(response.result.number, finish);
  } else if (response.game === "dice") {
    loungeScene.showDiceResult(response.result.number, finish);
  } else if (response.game === "coin") {
    loungeScene.showCoinResult(response.result.result, finish);
  } else {
    loungeScene.showResult(response.result, finish, response.net > 0);
  }
});
socket.on("game_error", ({ requestId, error }) => {
  if (requestId !== pendingRequestId) return;
  loungeScene?.stopSlotSpinTimers();
  loungeScene?.spinTimer?.remove();
  if (loungeScene) {
    loungeScene.slots3d?.reset();
    loungeScene.spinTimer = undefined;
    loungeScene.stopTimers.forEach((timer) => timer.remove());
    loungeScene.stopTimers = [];
    loungeScene.slotFrames.forEach((frame) => {
      loungeScene.tweens.killTweensOf(frame);
      frame.setAlpha(1).setScale(1);
      frame.setStrokeStyle(2, SLOT_THEME.trim, 0.86);
    });
    loungeScene.reelTexts.forEach((text, index) => {
      loungeScene.tweens.killTweensOf(text);
      text.setTexture("slot-symbol-question");
      text.setAlpha(1);
      text.setDisplaySize(52, 52);
      text.y = [137, 204, 271][index % 3];
    });
    loungeScene.bonusCellTexts.forEach((symbol) => {
      symbol.setTexture("slot-symbol-question");
      symbol.setAlpha(1);
      symbol.setDisplaySize(13, 13);
    });
    loungeScene.slotMascotStatus?.setText("READY");
  }
  loungeScene?.rouletteSpinTween?.stop();
  loungeScene?.rouletteBallTween?.stop();
  loungeScene?.diceRollTween?.stop();
  loungeScene?.diceBounceTween?.stop();
  loungeScene?.coinTossTween?.stop();
  loungeScene?.coinTossTimer?.remove();
  if (loungeScene?.diceContainer) {
    loungeScene.diceContainer.rotation = 0;
    loungeScene.diceContainer.y = 205;
    loungeScene.diceContainer.setScale(1);
  }
  if (loungeScene?.coinContainer) {
    loungeScene.coinContainer.y = 205;
    loungeScene.coinContainer.setScale(1);
    loungeScene.coinShadow?.setScale(1);
    loungeScene.coinShadow?.setAlpha(0.35);
  }
  loungeScene?.slotFrames?.forEach((frame) => {
    loungeScene.tweens.killTweensOf(frame);
    frame.setAlpha(1);
    frame.setScale(1);
    frame.setStrokeStyle(2, 0xe6c77e, 1);
  });
  loungeScene?.slotWinLights?.forEach((light) => {
    loungeScene.tweens.killTweensOf(light);
    light.setAlpha(1);
    light.setScale(1);
    light.setFillStyle(SLOT_THEME.glow, 0.18);
  });
  finishPendingRequest();
  if (currentMode === "blackjack" && blackjackActive)
    loungeScene?.setActionButtons(
      loungeScene.lastLegalActions ?? ["hit", "stand"],
    );
  if (currentMode === "poker" && pokerActive)
    loungeScene?.setPokerControls(true);
  resultDisplay.className = "result loss";
  resultDisplay.textContent = error;
});
socket.on("blackjack_start", (response) =>
  applyBlackjackResponse(response, false),
);
socket.on("blackjack_update", (response) =>
  applyBlackjackResponse(response, false),
);
socket.on("blackjack_over", (response) =>
  applyBlackjackResponse(response, true),
);
socket.on("video_poker_start", applyVideoPokerStart);
socket.on("video_poker_result", applyVideoPokerResult);

fetch("/api/state")
  .then(async (response) => {
    const state = await response.json();
    if (!response.ok)
      throw new Error(state.error ?? "Could not initialize the game.");
    updateBalanceDisplay(state.balance);
    socket.connect();
  })
  .catch((error) => {
    balanceDisplay.textContent = "Unavailable";
    connectionStatus.textContent = "SERVER UNAVAILABLE";
    resultDisplay.className = "result loss";
    resultDisplay.textContent =
      "Could not start the game. Please reload to try again.";
    failAppLoading(error);
  });
