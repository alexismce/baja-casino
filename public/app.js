const balanceElement = document.querySelector("#balance");
const appLoader = document.querySelector("#app-loader");
const appLoaderStatus = document.querySelector("#app-loader-status");
const appLoaderProgress = document.querySelector("#app-loader-progress");
const appLoaderRetry = document.querySelector("#app-loader-retry");
const accountDialog = document.querySelector("#account-dialog");
const accountAuth = document.querySelector("#account-auth");
const accountProfile = document.querySelector("#account-profile");
const authForm = document.querySelector("#auth-form");
const authMessage = document.querySelector("#auth-message");
const profileMessage = document.querySelector("#profile-message");
const authNote = document.querySelector("#auth-note");
const displayNameField = document.querySelector("#display-name-field");
const leaderboardOptInField = document.querySelector("#leaderboard-opt-in-field");
const loginTab = document.querySelector("#login-tab");
const registerTab = document.querySelector("#register-tab");
const accountOpenButton = document.querySelector("#account-open");
const accountCreateButton = document.querySelector("#account-create");
const accountMenuButton = document.querySelector("#account-menu");
const dailyRewardButton = document.querySelector("#daily-reward");
const rewardStatus = document.querySelector("#reward-status");
const soundVolume = document.querySelector("#sound-volume");
const soundVolumeValue = document.querySelector("#sound-volume-value");
let authMode = "login";
let currentAccount = null;
let storedSoundPreference = "on";
try {
  storedSoundPreference = window.localStorage.getItem("lucky-lounge-sound") ?? "on";
} catch (error) {
  console.warn("Could not read the saved sound preference:", error);
}
let soundEnabled = storedSoundPreference !== "off";
let audioContext;
let masterGainNode;
let ambientNodes;
let ambienceStopTimer;
let ambientMusicTimer;
let ambientMusicStep = 0;
let soundToggleSequence = 0;
let displayedBalance;

function updateAppLoader(status, progress) {
  if (!appLoader || appLoader.classList.contains("is-ready")) return;
  appLoaderStatus.textContent = status;
  appLoaderProgress.style.width = `${Math.max(0, Math.min(100, progress))}%`;
}

function finishAppLoading() {
  updateAppLoader("Lucky Lounge is ready", 100);
  window.setTimeout(() => {
    appLoader.classList.add("is-ready");
    document.body.classList.add("app-ready");
    window.setTimeout(() => appLoader.remove(), 650);
  }, 280);
}

function failAppLoading(error) {
  appLoader.classList.add("is-error");
  appLoaderStatus.textContent = "The lounge could not start. Check that the tray server is online.";
  appLoaderProgress.style.width = "100%";
  appLoaderRetry.hidden = false;
  console.error("Could not initialize game session:", error);
}

appLoaderRetry.addEventListener("click", () => window.location.reload());
updateAppLoader("Connecting to the local game server…", 24);
const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
const getSoundtrack = window.LuckySoundtracks.bind(document.querySelector("#music-track"), () => {
  if (soundEnabled && audioContext?.state === "running" && ambientNodes) startLoungeMelody();
});
let soundVolumeLevel = 0.7;
try {
  const savedVolume = window.localStorage.getItem("lucky-lounge-volume");
  if (savedVolume !== null) {
    const savedPercentage = Number(savedVolume);
    if (Number.isFinite(savedPercentage)) soundVolumeLevel = Math.min(1, Math.max(0, savedPercentage / 100));
  }
} catch (error) {
  console.warn("Could not read the saved game sound volume preference:", error);
}
soundVolume.value = String(Math.round(soundVolumeLevel * 100));
soundVolumeValue.value = `${soundVolume.value}%`;
const connectionStatus = document.querySelector("#connection-status");
const connectionDot = document.querySelector("#connection-dot");
const socket = window.io({ autoConnect: false, transports: ["websocket", "polling"] });
const gameSearch = document.querySelector("#game-search");
const gameCards = [...document.querySelectorAll(".game-card[data-game-category]")];
const gameFilters = [...document.querySelectorAll("[data-game-filter]")];
const gameCount = document.querySelector(".table-count");
const gameEmptyState = document.querySelector("#game-empty-state");
const gameSearchStatus = document.querySelector("#game-search-status");
let activeGameFilter = "all";

function getMasterGainNode() {
  if (!masterGainNode) {
    masterGainNode = audioContext.createGain();
    masterGainNode.gain.value = soundVolumeLevel;
    masterGainNode.connect(audioContext.destination);
  }
  return masterGainNode;
}

function setSoundVolume(value) {
  const percentage = Math.min(100, Math.max(0, Number(value)));
  if (!Number.isFinite(percentage)) return;
  soundVolumeLevel = percentage / 100;
  soundVolume.value = String(percentage);
  soundVolumeValue.value = `${percentage}%`;
  if (masterGainNode && audioContext) {
    masterGainNode.gain.setTargetAtTime(soundVolumeLevel, audioContext.currentTime, 0.025);
  }
  try {
    window.localStorage.setItem("lucky-lounge-volume", String(percentage));
  } catch (error) {
    console.warn("Could not save the game sound volume preference:", error);
  }
}

soundVolume.addEventListener("input", () => setSoundVolume(soundVolume.value));

function filterGames() {
  const query = gameSearch.value.trim().toLocaleLowerCase();
  let visibleCount = 0;

  for (const card of gameCards) {
    const matchesCategory = activeGameFilter === "all" || card.dataset.gameCategory === activeGameFilter;
    const matchesSearch = !query || card.textContent.toLocaleLowerCase().includes(query);
    const visible = matchesCategory && matchesSearch;
    card.hidden = !visible;
    if (visible) visibleCount += 1;
  }

  gameCount.textContent = `${String(visibleCount).padStart(2, "0")} ${visibleCount === 1 ? "GAME" : "GAMES"} ${query || activeGameFilter !== "all" ? "FOUND" : "OPEN"}`;
  gameEmptyState.hidden = visibleCount > 0;
  gameSearchStatus.textContent = `${visibleCount} ${visibleCount === 1 ? "game" : "games"} found.`;
}

gameSearch.addEventListener("input", filterGames);
gameFilters.forEach((button) => {
  button.addEventListener("click", () => {
    activeGameFilter = button.dataset.gameFilter;
    gameFilters.forEach((filter) => {
      const active = filter === button;
      filter.classList.toggle("active", active);
      filter.setAttribute("aria-pressed", String(active));
    });
    filterGames();
  });
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "/" || event.altKey || event.ctrlKey || event.metaKey
    || event.target instanceof HTMLInputElement
    || event.target instanceof HTMLTextAreaElement
    || event.target instanceof HTMLSelectElement
    || event.target instanceof HTMLElement && event.target.isContentEditable) return;
  event.preventDefault();
  gameSearch.focus();
});
filterGames();

async function request(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options?.headers ?? {}), ...(options?.body ? { "Content-Type": "application/json" } : {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "The request failed.");
  return data;
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

function playAmbientMelodyNote() {
  if (!soundEnabled || !audioContext || !ambientNodes || audioContext.state !== "running") return;
  const track = getSoundtrack();
  try {
    window.LuckySoundtracks.playStep(audioContext, ambientNodes.musicGainNode, track, ambientMusicStep, "lobby", "idle");
    ambientMusicStep = (ambientMusicStep + 1) % (track.notes.length * 4);
  } catch (error) {
    console.error("Could not play the lounge melody:", error);
  }
}

function startLoungeMelody() {
  window.clearInterval(ambientMusicTimer);
  ambientMusicStep = 0;
  playAmbientMelodyNote();
  ambientMusicTimer = window.setInterval(playAmbientMelodyNote, getSoundtrack().interval);
}

function playInterfaceCue() {
  if (!soundEnabled || !audioContext || audioContext.state !== "running") return;
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    oscillator.connect(gain);
    gain.connect(getMasterGainNode());
    oscillator.start(now);
    oscillator.stop(now + 0.08);
  } catch (error) {
    console.error("Could not play the interface sound:", error);
  }
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
    rampAmbienceGain(ambientNodes.gainNode, 0.008, 1.5);
    rampAmbienceGain(ambientNodes.musicGainNode, 0.085, 1.5);
    startLoungeMelody();
    return;
  }

  const now = audioContext.currentTime;
  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.linearRampToValueAtTime(0.008, now + 1.5);
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
  musicGainNode.gain.linearRampToValueAtTime(0.085, now + 1.8);
  const musicOscillators = [130.81, 196, 246.94].map((frequency) => {
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
  ambientNodes = { osc1, osc2, filter, gainNode, musicGainNode, musicOscillators };
  osc1.start(now);
  osc2.start(now);
  startLoungeMelody();
}

document.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest("button, a")) playInterfaceCue();
});

function updateBalance(balance) {
  const nextBalance = `${balance.toLocaleString()} credits`;
  if (balanceElement.textContent === nextBalance) return;
  balanceElement.textContent = nextBalance;
  const isCreditIncrease = displayedBalance !== undefined && balance > displayedBalance;
  displayedBalance = balance;
  if (isCreditIncrease && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    balanceElement.classList.remove("balance-update");
    void balanceElement.offsetWidth;
    balanceElement.classList.add("balance-update");
  }
}

function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === "register";
  loginTab.classList.toggle("active", !registering);
  registerTab.classList.toggle("active", registering);
  loginTab.setAttribute("aria-selected", String(!registering));
  registerTab.setAttribute("aria-selected", String(registering));
  displayNameField.hidden = !registering;
  leaderboardOptInField.hidden = !registering;
  authForm.elements.displayName.disabled = !registering;
  authForm.elements.displayName.required = registering;
  authForm.elements.leaderboardOptIn.disabled = !registering;
  if (!registering) {
    authForm.elements.displayName.value = "";
    authForm.elements.leaderboardOptIn.checked = false;
  }
  authForm.elements.password.autocomplete = registering ? "new-password" : "current-password";
  document.querySelector("#account-dialog-title").textContent = registering ? "Create your account" : "Welcome back";
  document.querySelector("#auth-submit").textContent = registering ? "Create account" : "Sign in";
  authNote.textContent = "Local demo only: email is not verified, password reset is unavailable, and no email is sent. Use a unique password.";
  authMessage.textContent = "";
}

function renderAchievements(achievements = []) {
  const list = document.querySelector("#achievement-list");
  list.replaceChildren();
  if (!achievements.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "Play a game to earn your first badge.";
    list.append(empty);
    return;
  }
  for (const achievement of achievements) {
    const item = document.createElement("li");
    item.textContent = `${achievement.title} — ${achievement.description}`;
    list.append(item);
  }
}

function renderAccount(account, balance, dailyRewardAvailable) {
  currentAccount = account;
  document.body.classList.remove("auth-loading");
  const signedIn = Boolean(account);
  accountOpenButton.hidden = signedIn;
  accountCreateButton.hidden = signedIn;
  accountMenuButton.hidden = !signedIn;
  accountMenuButton.textContent = signedIn ? account.displayName : "My lounge";
  document.querySelector("#hero-signup").textContent = signedIn ? "Manage your profile →" : "Save your progress →";
  document.querySelector("#community-signup").textContent = signedIn ? "Open your profile →" : "Create a free account →";
  document.querySelector(".demo-credentials").hidden = signedIn;
  accountAuth.hidden = signedIn;
  accountProfile.hidden = !signedIn;
  if (!signedIn) {
    dailyRewardButton.disabled = true;
    dailyRewardButton.textContent = "Sign in to claim";
    rewardStatus.textContent = "Create a free account to collect a daily demo-credit grant.";
    return;
  }

  document.querySelector("#account-welcome").textContent = `Welcome, ${account.displayName}`;
  document.querySelector("#profile-best").textContent = account.bestBalance.toLocaleString();
  document.querySelector("#profile-games").textContent = account.gamesPlayed.toLocaleString();
  document.querySelector("#profile-wins").textContent = account.wins.toLocaleString();
  const profileForm = document.querySelector("#profile-form");
  profileForm.elements.displayName.value = account.displayName;
  profileForm.elements.leaderboardOptIn.checked = account.leaderboardOptIn;
  renderAchievements(account.achievements);
  dailyRewardButton.disabled = !dailyRewardAvailable;
  dailyRewardButton.textContent = dailyRewardAvailable ? "Claim 100 demo credits" : "Today's grant claimed";
  rewardStatus.textContent = dailyRewardAvailable
    ? "Once per UTC day. No streaks or wager requirements."
    : "Your credits are ready for whenever you want to play.";
  if (typeof balance === "number") updateBalance(balance);
}

async function loadAccount() {
  const data = await request("/api/account");
  renderAccount(data.account, data.balance, data.dailyRewardAvailable);
}

async function loadLeaderboard() {
  const { entries } = await request("/api/leaderboard");
  const list = document.querySelector("#leaderboard-list");
  list.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No players have opted in yet.";
    list.append(empty);
    return;
  }
  entries.forEach((entry, index) => {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = `${index + 1}. ${entry.displayName}`;
    const score = document.createElement("strong");
    score.textContent = `${entry.bestBalance.toLocaleString()} credits`;
    item.append(name, score);
    list.append(item);
  });
}

function showAccountDialog(mode = "login") {
  if (currentAccount) {
    accountAuth.hidden = true;
    accountProfile.hidden = false;
    document.querySelector("#account-dialog-title").textContent = "Your account";
    accountDialog.showModal();
    return;
  }
  accountAuth.hidden = false;
  accountProfile.hidden = true;
  setAuthMode(mode);
  accountDialog.showModal();
}

async function shareContent({ title, text, url = window.location.origin }) {
  if (navigator.share) {
    await navigator.share({ title, text, url });
    return "Shared.";
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return "Copied a share link to your clipboard.";
  }
  return "Sharing is unavailable in this browser.";
}

function setConnectionStatus(connected) {
  connectionStatus.textContent = connected ? "GAME SERVER CONNECTED" : "RECONNECTING TO GAME SERVER";
  connectionDot.classList.toggle("status-dot-offline", !connected);
}

socket.on("connect", () => setConnectionStatus(true));
socket.on("disconnect", () => setConnectionStatus(false));
socket.on("connect_error", (error) => {
  setConnectionStatus(false);
  console.error("Game server connection failed:", error.message);
});
socket.on("balance_update", updateBalance);
request("/api/state")
  .then(async (state) => {
    updateAppLoader("Session ready. Loading your account and game catalog…", 58);
    updateBalance(state.balance);
    socket.connect();
    await Promise.all([loadAccount(), loadLeaderboard()]);
    updateAppLoader("Live catalog synchronized…", 90);
    finishAppLoading();
  })
  .catch((error) => {
    document.body.classList.remove("auth-loading");
    balanceElement.textContent = "Unavailable";
    setConnectionStatus(false);
    failAppLoading(error);
  });

accountOpenButton.addEventListener("click", () => showAccountDialog("login"));
accountCreateButton.addEventListener("click", () => showAccountDialog("register"));
accountMenuButton.addEventListener("click", () => showAccountDialog());
document.querySelector("#hero-signup").addEventListener("click", () => showAccountDialog("register"));
document.querySelector("#community-signup").addEventListener("click", () => showAccountDialog("register"));
loginTab.addEventListener("click", () => setAuthMode("login"));
registerTab.addEventListener("click", () => setAuthMode("register"));
document.querySelector("#fill-demo-account").addEventListener("click", () => {
  setAuthMode("login");
  authForm.elements.email.value = "admin@luckylounge.demo";
  authForm.elements.password.value = "DemoAdmin!2026";
  authForm.elements.password.focus();
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = document.querySelector("#auth-submit");
  submitButton.disabled = true;
  authMessage.textContent = "";
  const formData = new FormData(authForm);
  const payload = {
    email: formData.get("email"),
    password: formData.get("password"),
  };
  if (authMode === "register") {
    payload.displayName = formData.get("displayName");
    payload.leaderboardOptIn = formData.has("leaderboardOptIn");
  }
  try {
    const data = await request(authMode === "register" ? "/api/auth/register" : "/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    updateBalance(data.balance);
    await loadAccount();
    await loadLeaderboard();
    socket.disconnect();
    socket.connect();
    accountDialog.close();
    authForm.reset();
  } catch (error) {
    authMessage.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector("button");
  submitButton.disabled = true;
  profileMessage.textContent = "";
  try {
    await request("/api/account/profile", {
      method: "POST",
      body: JSON.stringify({
        displayName: form.elements.displayName.value,
        leaderboardOptIn: form.elements.leaderboardOptIn.checked,
      }),
    });
    await Promise.all([loadAccount(), loadLeaderboard()]);
    profileMessage.textContent = "Profile saved.";
  } catch (error) {
    profileMessage.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

dailyRewardButton.addEventListener("click", async () => {
  dailyRewardButton.disabled = true;
  rewardStatus.textContent = "Claiming your daily demo grant…";
  try {
    const result = await request("/api/rewards/daily", { method: "POST", body: "{}" });
    renderAccount(result.account, result.balance, result.dailyRewardAvailable);
    rewardStatus.textContent = `Added ${result.amount} virtual credits. No streaks—come back whenever you like.`;
  } catch (error) {
    rewardStatus.textContent = error.message;
    await loadAccount();
  }
});

document.querySelector("#share-lounge").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  try {
    button.textContent = await shareContent({
      title: "Lucky Lounge",
      text: "Come try Lucky Lounge—free casino-style games with virtual credits only.",
    });
  } catch (error) {
    if (error.name !== "AbortError") console.error("Could not share the lounge:", error);
  }
});

document.querySelector("#share-achievements").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const badges = currentAccount?.achievements?.map((achievement) => achievement.title) ?? [];
  try {
    button.textContent = await shareContent({
      title: "Lucky Lounge achievements",
      text: `${currentAccount?.displayName ?? "A player"} earned ${badges.length ? badges.join(", ") : "their first Lucky Lounge badge"}.`,
    });
  } catch (error) {
    if (error.name !== "AbortError") console.error("Could not share achievements:", error);
  }
});

document.querySelector("#sign-out").addEventListener("click", async () => {
  try {
    const result = await request("/api/auth/logout", { method: "POST", body: "{}" });
    updateBalance(result.balance);
    currentAccount = null;
    await loadAccount();
    await loadLeaderboard();
    socket.disconnect();
    socket.connect();
    accountDialog.close();
  } catch (error) {
    profileMessage.textContent = error.message;
  }
});

document.querySelector("#sound-toggle").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const sequence = ++soundToggleSequence;
  const enable = !soundEnabled;
  button.disabled = true;
  if (enable && AudioContextClass) {
    try {
      audioContext ??= new AudioContextClass();
      getMasterGainNode();
      await audioContext.resume();
      if (sequence !== soundToggleSequence) return;
      soundEnabled = true;
      toggleCasinoAmbience(true);
    } catch (error) {
      if (sequence !== soundToggleSequence) return;
      soundEnabled = false;
      console.error("Could not enable interface sounds and lounge music:", error);
    }
  } else {
    soundEnabled = false;
    toggleCasinoAmbience(false);
  }
  button.textContent = `Sound: ${soundEnabled ? "on" : "off"}`;
  button.setAttribute("aria-pressed", String(soundEnabled));
  button.setAttribute("aria-label", soundEnabled
    ? "Disable interface sounds and lounge music"
    : "Enable interface sounds and lounge music");
  button.title = soundEnabled
    ? "Disables interface sounds and fades out the synthesized lounge music"
    : "Enables synthesized interface sounds and lounge music";
  try {
    window.localStorage.setItem("lucky-lounge-sound", soundEnabled ? "on" : "off");
  } catch (error) {
    console.warn("Could not save the sound preference:", error);
  }
  button.disabled = false;
});

const lobbySoundToggle = document.querySelector("#sound-toggle");
if (!soundEnabled) {
  lobbySoundToggle.textContent = "Sound: off";
  lobbySoundToggle.setAttribute("aria-pressed", "false");
  lobbySoundToggle.setAttribute("aria-label", "Enable interface sounds and lounge music");
}

if (soundEnabled && AudioContextClass) {
  const enableLobbySoundOnGesture = async () => {
    try {
      audioContext ??= new AudioContextClass();
      getMasterGainNode();
      await audioContext.resume();
      if (!soundEnabled) return;
      toggleCasinoAmbience(true);
    } catch (error) {
      console.warn("The browser blocked the first automatic audio start:", error);
    }
  };
  window.addEventListener("pointerdown", enableLobbySoundOnGesture, { once: true });
  window.addEventListener("keydown", enableLobbySoundOnGesture, { once: true });
}
