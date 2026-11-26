import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { sound } from './audio.js';

const socket = io();

let currentChips = 1000;
let selectedBet = 100;
let currentView = 'lobby';
let isBusy = false;
let rocketActive = false;
let rocketStartTime = 0;
let rocketGrowthRate = 0.55;
let rocketPrizeBoost = false;
let cameraShake = 0;

const BANNERS = [
  {
    badge: 'VIP HIGH-ROLLER EVENT',
    title: 'RISING ROCKETS: PRIZE BOOST',
    desc: 'Climb live multipliers in 3D, catch Prize Boosts, and hit CASH OUT before Big Bang.',
    cta: 'LAUNCH ROCKET →',
    target: 'rocket'
  },
  {
    badge: '14x ZERO PAYOUT',
    title: 'ROULETTE 3D VIP LOUNGE',
    desc: 'Golden rim, orbiting 3D ball, neon stage lighting, and instant payouts.',
    cta: 'PLAY ROULETTE →',
    target: 'roulette'
  },
  {
    badge: '25x TRIPLE 7 JACKPOT',
    title: '3D MEGA SLOTS RESORT',
    desc: 'Three 3D drums with sequential reel locks, bloom glow, and combo wins.',
    cta: 'SPIN SLOTS →',
    target: 'slots'
  }
];
let bannerIndex = 0;

function renderBanner(idx) {
  bannerIndex = (idx + BANNERS.length) % BANNERS.length;
  const b = BANNERS[bannerIndex];
  document.getElementById('heroBadge').textContent = b.badge;
  document.getElementById('heroTitle').textContent = b.title;
  document.getElementById('heroDesc').textContent = b.desc;
  const ctaBtn = document.getElementById('heroCta');
  ctaBtn.textContent = b.cta;
  ctaBtn.onclick = () => openTable(b.target);
  document.querySelectorAll('.hero-dots .dot').forEach((d, i) => {
    d.classList.toggle('active', i === bannerIndex);
  });
}

window.setBanner = (idx) => {
  sound.chipClink();
  renderBanner(idx);
};

setInterval(() => {
  if (currentView === 'lobby') renderBanner(bannerIndex + 1);
}, 5500);

let jackpotVal = 25000;
setInterval(() => {
  jackpotVal += Math.floor(Math.random() * 19) + 3;
  const el = document.getElementById('grandJackpot');
  if (el) el.textContent = jackpotVal.toLocaleString();
}, 2400);

const container = document.getElementById('stageContainer');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060c);
scene.fog = new THREE.FogExp2(0x05060c, 0.028);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 120);
const camPosTarget = new THREE.Vector3(0, 8.2, 13.5);
const camLookTarget = new THREE.Vector3(0, 0.4, -1);
const camLookCurrent = new THREE.Vector3(0, 0.4, -1);
camera.position.copy(camPosTarget);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.52,
  0.38,
  0.78
);
composer.addPass(bloomPass);

scene.add(new THREE.AmbientLight(0x8fa8ff, 0.45));

const goldSpot = new THREE.SpotLight(0xffd700, 95, 40, Math.PI / 4, 0.45, 1.2);
goldSpot.position.set(0, 12, 3);
scene.add(goldSpot);

const cyanLight = new THREE.PointLight(0x00f0ff, 35, 22);
cyanLight.position.set(-6, 3.5, -3);
scene.add(cyanLight);

const magentaLight = new THREE.PointLight(0xff1e8a, 35, 22);
magentaLight.position.set(6, 3.5, -3);
scene.add(magentaLight);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(24, 64),
  new THREE.MeshStandardMaterial({ color: 0x080a14, metalness: 0.35, roughness: 0.6 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.7;
scene.add(floor);

const outerNeon = new THREE.Mesh(
  new THREE.TorusGeometry(6.4, 0.05, 12, 80),
  new THREE.MeshBasicMaterial({ color: 0x00f0ff })
);
outerNeon.rotation.x = Math.PI / 2;
outerNeon.position.y = -0.65;
scene.add(outerNeon);

const rouletteGroup = new THREE.Group();
scene.add(rouletteGroup);

const felt = new THREE.Mesh(
  new THREE.CylinderGeometry(4.8, 5.1, 0.36, 48),
  new THREE.MeshStandardMaterial({ color: 0x093822, roughness: 0.78, metalness: 0.05 })
);
felt.position.y = -0.35;
rouletteGroup.add(felt);

const wheelSpinner = new THREE.Group();
rouletteGroup.add(wheelSpinner);

const goldRim = new THREE.Mesh(
  new THREE.TorusGeometry(2.55, 0.22, 20, 64),
  new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.92, roughness: 0.16 })
);
goldRim.rotation.x = Math.PI / 2;
wheelSpinner.add(goldRim);

const sliceAngle = (Math.PI * 2) / 15;
for (let i = 0; i < 15; i++) {
  const color = i === 0 ? 0x16e076 : i <= 7 ? 0xff2942 : 0x181c2b;
  const seg = new THREE.Mesh(
    new THREE.CylinderGeometry(2.42, 2.42, 0.26, 16, 1, false, i * sliceAngle, sliceAngle * 0.93),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.15 })
  );
  wheelSpinner.add(seg);
}

const pointer = new THREE.Mesh(
  new THREE.ConeGeometry(0.26, 0.65, 20),
  new THREE.MeshStandardMaterial({ color: 0xffe066, metalness: 0.95, roughness: 0.12 })
);
pointer.position.set(0, 0.52, 2.72);
pointer.rotation.x = -Math.PI / 2;
rouletteGroup.add(pointer);

const rouletteBall = new THREE.Mesh(
  new THREE.SphereGeometry(0.14, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.85, roughness: 0.1 })
);
rouletteBall.position.set(0, 0.25, 2.15);
rouletteGroup.add(rouletteBall);

const rocketGroup = new THREE.Group();
rocketGroup.position.set(-7.5, 0, -2);
scene.add(rocketGroup);

const pad = new THREE.Mesh(
  new THREE.CylinderGeometry(2.2, 2.6, 0.35, 32),
  new THREE.MeshStandardMaterial({ color: 0x1a2035, metalness: 0.75, roughness: 0.28 })
);
pad.position.y = -0.35;
rocketGroup.add(pad);

const rocketMesh = new THREE.Group();
const rBody = new THREE.Mesh(
  new THREE.CylinderGeometry(0.3, 0.36, 1.45, 24),
  new THREE.MeshStandardMaterial({ color: 0xf5f8ff, metalness: 0.65, roughness: 0.24 })
);
const rNose = new THREE.Mesh(
  new THREE.ConeGeometry(0.3, 0.72, 24),
  new THREE.MeshStandardMaterial({ color: 0xff2965, metalness: 0.5, roughness: 0.3 })
);
rNose.position.y = 1.08;
const rFlame = new THREE.Mesh(
  new THREE.ConeGeometry(0.26, 0.9, 16),
  new THREE.MeshBasicMaterial({ color: 0xff9d00 })
);
rFlame.position.y = -1.12;
rFlame.rotation.x = Math.PI;
const boostAura = new THREE.Mesh(
  new THREE.TorusGeometry(0.68, 0.04, 10, 32),
  new THREE.MeshBasicMaterial({ color: 0xffd700 })
);
boostAura.visible = false;
rocketMesh.add(rBody, rNose, rFlame, boostAura);
rocketMesh.position.set(0, 0.8, 0);
rocketGroup.add(rocketMesh);

const slotsGroup = new THREE.Group();
slotsGroup.position.set(7.5, 0.4, -2);
scene.add(slotsGroup);

const cabinetFrame = new THREE.Mesh(
  new THREE.BoxGeometry(4.4, 2.5, 1.1),
  new THREE.MeshStandardMaterial({ color: 0x171b2e, metalness: 0.75, roughness: 0.25 })
);
slotsGroup.add(cabinetFrame);

const topCrown = new THREE.Mesh(
  new THREE.BoxGeometry(4.6, 0.25, 1.2),
  new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.18 })
);
topCrown.position.y = 1.35;
slotsGroup.add(topCrown);

const reelMeshes = [];
const symbolColorMap = {
  '7': 0xffd700,
  DIAMOND: 0x00f0ff,
  BELL: 0xff9500,
  CHERRY: 0xff2b47,
  STAR: 0x19e67c
};

for (let r = 0; r < 3; r++) {
  const reel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.68, 1.5, 20),
    new THREE.MeshStandardMaterial({
      color: 0x2a314d,
      metalness: 0.45,
      roughness: 0.28
    })
  );
  reel.rotation.z = Math.PI / 2;
  reel.position.set((r - 1) * 1.25, 0, 0.35);
  slotsGroup.add(reel);
  reelMeshes.push(reel);
}

const sparkCount = 70;
const sparkGeo = new THREE.BufferGeometry();
const sparkPos = new Float32Array(sparkCount * 3);
const sparkVel = [];
for (let i = 0; i < sparkCount; i++) {
  sparkPos[i * 3 + 1] = -99;
  sparkVel.push(new THREE.Vector3());
}
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
const sparks = new THREE.Points(
  sparkGeo,
  new THREE.PointsMaterial({ color: 0xffd700, size: 0.2, transparent: true, opacity: 0.95 })
);
scene.add(sparks);
let sparkLife = 0;

function burstSparks(posVec, colorHex = 0xffd700, shakeAmt = 0) {
  sparks.material.color.setHex(colorHex);
  const arr = sparkGeo.attributes.position.array;
  for (let i = 0; i < sparkCount; i++) {
    arr[i * 3] = posVec.x;
    arr[i * 3 + 1] = posVec.y;
    arr[i * 3 + 2] = posVec.z;
    sparkVel[i].set(
      (Math.random() - 0.5) * 0.26,
      Math.random() * 0.24 + 0.05,
      (Math.random() - 0.5) * 0.26
    );
  }
  sparkGeo.attributes.position.needsUpdate = true;
  sparkLife = 1.0;
  if (shakeAmt > 0) cameraShake = shakeAmt;
}

function setStatus(msg) {
  const el = document.getElementById('statusBanner');
  if (el) el.textContent = msg;
}

window.openTable = (game) => {
  if (isBusy || rocketActive) return;
  sound.chipClink();
  currentView = game;
  document.body.classList.remove('lobby-mode');
  document.body.classList.add('table-mode');

  document.getElementById('lobbyView').classList.add('hidden');
  document.getElementById('tableHud').classList.remove('hidden');

  document.getElementById('rouletteDeck').classList.toggle('hidden', game !== 'roulette');
  document.getElementById('rocketDeck').classList.toggle('hidden', game !== 'rocket');
  document.getElementById('slotsDeck').classList.toggle('hidden', game !== 'slots');
  document.getElementById('liveMult').classList.toggle('hidden', game !== 'rocket');

  if (game === 'roulette') {
    document.getElementById('activeTableName').textContent = 'ROULETTE 3D VIP';
    setStatus(`Bet ${selectedBet} chips on RED, ZERO, or BLACK`);
    camPosTarget.set(0, 6.2, 7.6);
    camLookTarget.set(0, 0.2, 0);
  } else if (game === 'rocket') {
    document.getElementById('activeTableName').textContent = 'RISING ROCKETS 3D';
    setStatus(`Bet ${selectedBet} chips & cash out before Big Bang`);
    const multEl = document.getElementById('liveMult');
    multEl.textContent = '1.00x';
    multEl.classList.remove('boosted');
    camPosTarget.set(-7.5, 3.6, 7.8);
    camLookTarget.set(-7.5, 1.8, -2);
  } else if (game === 'slots') {
    document.getElementById('activeTableName').textContent = '3D MEGA SLOTS';
    setStatus(`Bet ${selectedBet} chips for Triple 7 Jackpot`);
    camPosTarget.set(7.5, 2.2, 6.8);
    camLookTarget.set(7.5, 0.4, -2);
  }
};

window.goLobby = () => {
  if (isBusy || rocketActive) return;
  socket.emit('cancelRocketPreview');
  sound.chipClink();
  currentView = 'lobby';
  document.body.classList.remove('table-mode');
  document.body.classList.add('lobby-mode');

  document.getElementById('lobbyView').classList.remove('hidden');
  document.getElementById('tableHud').classList.add('hidden');
  document.getElementById('liveMult').classList.add('hidden');
  camPosTarget.set(0, 8.2, 13.5);
  camLookTarget.set(0, 0.4, -1);
};

window.selectChip = (amount, btn) => {
  if (isBusy || rocketActive) return;
  sound.chipClink();
  selectedBet = amount;
  document.querySelectorAll('.chip-opt').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
};

window.claimBonus = () => {
  sound.chipClink();
  socket.emit('claimBonus');
};

function lockControls(locked) {
  document.querySelectorAll('.act-btn, .chip-opt, .back-btn').forEach((el) => {
    el.disabled = locked;
  });
}

let wheelSpeed = 0.012;
let ballAngle = 0;
let ballSpeed = 0.04;
let ballRadius = 2.15;

window.betRoulette = (choice) => {
  if (isBusy) return;
  if (currentChips < selectedBet) {
    setStatus('⚠️ Low chips! Tap + RELOAD at top right.');
    return;
  }
  isBusy = true;
  lockControls(true);
  wheelSpeed = 0.36;
  ballSpeed = -0.32;
  ballRadius = 2.38;
  sound.tick(880);
  setStatus(`Spinning ${selectedBet} on ${choice.toUpperCase()}...`);
  socket.emit('spinRoulette', { betAmount: selectedBet, choice });
};

let rocketAlt = 0.8;
window.startRocketRun = () => {
  if (isBusy || rocketActive) return;
  if (currentChips < selectedBet) {
    setStatus('⚠️ Low chips! Tap + RELOAD at top right.');
    return;
  }
  isBusy = true;
  lockControls(true);
  sound.rocketWhoosh();
  setStatus('Launching rocket... hit CASH OUT!');
  socket.emit('startRocket', { betAmount: selectedBet });
};

window.cashoutRocketRun = () => {
  if (!rocketActive) return;
  sound.chipClink();
  socket.emit('cashoutRocket');
};

const reelSpinning = [false, false, false];
window.spinMegaSlots = () => {
  if (isBusy) return;
  if (currentChips < selectedBet) {
    setStatus('⚠️ Low chips! Tap + RELOAD at top right.');
    return;
  }
  isBusy = true;
  lockControls(true);
  reelSpinning[0] = true;
  reelSpinning[1] = true;
  reelSpinning[2] = true;
  sound.tick(640);
  setStatus(`Spinning 3D reels for ${selectedBet} chips...`);
  socket.emit('spinSlots', { betAmount: selectedBet });
};

socket.on('connect', () => {
  if (currentView !== 'lobby') {
    setStatus('Connected to Baja Casino VIP');
  }
});

socket.on('disconnect', () => {
  isBusy = false;
  rocketActive = false;
  boostAura.visible = false;
  lockControls(false);
  setStatus('⚠️ Reconnecting to server...');
});

socket.on('actionError', (msg) => {
  isBusy = false;
  lockControls(false);
  setStatus(`⚠️ ${msg}`);
});

socket.on('initState', ({ chips, onlineCount }) => {
  currentChips = chips;
  document.getElementById('chips').textContent = chips;
  document.getElementById('onlineCount').textContent = onlineCount;
});

socket.on('onlineCount', (count) => {
  document.getElementById('onlineCount').textContent = count;
});

socket.on('balanceUpdate', (chips) => {
  currentChips = chips;
  document.getElementById('chips').textContent = chips;
});

socket.on('bonusStatus', ({ message }) => {
  const ticker = document.getElementById('tickerText');
  if (ticker) ticker.textContent = message;
  if (currentView !== 'lobby') setStatus(message);
});

socket.on('liveWin', (entry) => {
  const ticker = document.getElementById('tickerText');
  if (ticker) {
    ticker.textContent = `🔥 ${entry.player} won ${entry.amount.toLocaleString()} on ${entry.game} (${entry.detail})`;
  }
});

socket.on('rouletteResult', ({ outcomeNumber, outcomeColor, winAmount, newBalance }) => {
  setTimeout(() => {
    wheelSpeed = 0.012;
    ballSpeed = 0.04;
    ballRadius = 1.95;
    isBusy = false;
    lockControls(false);
    currentChips = newBalance;
    document.getElementById('chips').textContent = newBalance;

    if (winAmount > 0) {
      sound.winFanfare();
      burstSparks(new THREE.Vector3(0, 0.7, 2.1), outcomeColor === 'green' ? 0x16e076 : 0xffd700, 0.14);
      setStatus(`✨ ${outcomeNumber} (${outcomeColor.toUpperCase()}) • +${winAmount} Chips!`);
    } else {
      sound.tick(260);
      setStatus(`Landed ${outcomeNumber} (${outcomeColor.toUpperCase()}) • Try again`);
    }
  }, 1900);
});

socket.on('rocketStarted', ({ prizeBoost, growthPerSec }) => {
  isBusy = false;
  rocketActive = true;
  rocketPrizeBoost = Boolean(prizeBoost);
  rocketGrowthRate = Number(growthPerSec) || 0.55;
  rocketStartTime = performance.now();
  boostAura.visible = rocketPrizeBoost;

  const multEl = document.getElementById('liveMult');
  multEl.classList.toggle('boosted', rocketPrizeBoost);

  document.getElementById('rocketLaunchBtn').classList.add('hidden');
  const cashBtn = document.getElementById('rocketCashoutBtn');
  cashBtn.classList.remove('hidden');
  cashBtn.disabled = false;

  setStatus(rocketPrizeBoost
    ? '⚡ PRIZE BOOST ACTIVE! Cash out high!'
    : '🚀 Climbing... tap CASH OUT anytime!');
});

socket.on('rocketCashed', ({ multiplier, prizeBoost, winAmount, newBalance }) => {
  rocketActive = false;
  boostAura.visible = false;
  rocketAlt = 0.8;
  rocketMesh.position.y = 0.8;
  currentChips = newBalance;
  document.getElementById('chips').textContent = newBalance;

  document.getElementById('rocketCashoutBtn').classList.add('hidden');
  document.getElementById('rocketLaunchBtn').classList.remove('hidden');
  lockControls(false);

  sound.winFanfare();
  burstSparks(new THREE.Vector3(-7.5, 2.2, -2), 0x19e67c, 0.15);
  setStatus(`💰 Cashed out at ${multiplier.toFixed(2)}x${prizeBoost ? ' [BOOST]' : ''} • +${winAmount} Chips!`);
});

socket.on('rocketCrashed', ({ crashPoint, bigBang, newBalance }) => {
  rocketActive = false;
  boostAura.visible = false;
  currentChips = newBalance;
  document.getElementById('chips').textContent = newBalance;

  const boomPos = new THREE.Vector3(-7.5, rocketAlt, -2);
  rocketAlt = 0.8;
  rocketMesh.position.y = 0.8;

  document.getElementById('rocketCashoutBtn').classList.add('hidden');
  document.getElementById('rocketLaunchBtn').classList.remove('hidden');
  lockControls(false);

  sound.explosion();
  burstSparks(boomPos, bigBang ? 0xff1e8a : 0xff5500, bigBang ? 0.36 : 0.22);
  document.getElementById('liveMult').textContent = `${crashPoint.toFixed(2)}x`;
  setStatus(bigBang
    ? `💥 BIG BANG at ${crashPoint.toFixed(2)}x!`
    : `💥 Crashed at ${crashPoint.toFixed(2)}x`);
});

socket.on('slotsResult', ({ reels, mult, winAmount, newBalance }) => {
  setTimeout(() => {
    reelSpinning[0] = false;
    reelMeshes[0].material.color.setHex(symbolColorMap[reels[0]] || 0xffd700);
    sound.tick(520);
  }, 550);

  setTimeout(() => {
    reelSpinning[1] = false;
    reelMeshes[1].material.color.setHex(symbolColorMap[reels[1]] || 0x00f0ff);
    sound.tick(620);
  }, 1000);

  setTimeout(() => {
    reelSpinning[2] = false;
    reelMeshes[2].material.color.setHex(symbolColorMap[reels[2]] || 0xff1e8a);
    sound.tick(740);

    isBusy = false;
    lockControls(false);
    currentChips = newBalance;
    document.getElementById('chips').textContent = newBalance;

    if (winAmount > 0) {
      sound.winFanfare();
      burstSparks(new THREE.Vector3(7.5, 0.8, -1.2), 0x00f0ff, 0.18);
      setStatus(`🎰 [${reels.join(' • ')}] ${mult}x • +${winAmount} Chips!`);
    } else {
      sound.tick(240);
      setStatus(`🎰 [${reels.join(' • ')}] No match • Spin again`);
    }
  }, 1450);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  camera.position.lerp(camPosTarget, 0.07);
  camLookCurrent.lerp(camLookTarget, 0.08);
  camera.lookAt(camLookCurrent);

  if (cameraShake > 0.005) {
    camera.position.x += (Math.random() - 0.5) * cameraShake;
    camera.position.y += (Math.random() - 0.5) * cameraShake;
    cameraShake *= 0.85;
  }

  cyanLight.intensity = 32 + Math.sin(t * 2.1) * 8;
  magentaLight.intensity = 32 + Math.cos(t * 2.1) * 8;

  wheelSpinner.rotation.y += wheelSpeed;
  ballAngle += ballSpeed;
  rouletteBall.position.x = Math.cos(ballAngle) * ballRadius;
  rouletteBall.position.z = Math.sin(ballAngle) * ballRadius;

  if (rocketActive) {
    const elapsedSec = Math.max(0, (performance.now() - rocketStartTime) / 1000);
    const displayMult = 1 + elapsedSec * rocketGrowthRate;
    const multEl = document.getElementById('liveMult');
    if (multEl) multEl.textContent = `${displayMult.toFixed(2)}x`;

    rocketAlt = Math.min(5.2, 0.8 + elapsedSec * 0.75);
    rocketMesh.position.y = rocketAlt;
    rocketMesh.position.x = (Math.random() - 0.5) * 0.04;
    rFlame.scale.setScalar(1.1 + Math.sin(t * 40) * 0.3);

    if (rocketPrizeBoost) {
      boostAura.rotation.z = t * 4.5;
      boostAura.scale.setScalar(1 + Math.sin(t * 8) * 0.12);
    }
  } else {
    rocketMesh.position.x = 0;
    rocketMesh.position.y = 0.8 + Math.sin(t * 2.4) * 0.07;
    rFlame.scale.setScalar(0.85 + Math.sin(t * 14) * 0.1);
  }

  reelMeshes.forEach((rm, idx) => {
    if (reelSpinning[idx]) {
      rm.rotation.x += 0.52 * (1 + idx * 0.1);
    }
  });

  if (sparkLife > 0) {
    sparkLife -= 0.024;
    const arr = sparkGeo.attributes.position.array;
    for (let i = 0; i < sparkCount; i++) {
      arr[i * 3] += sparkVel[i].x;
      arr[i * 3 + 1] += sparkVel[i].y;
      arr[i * 3 + 2] += sparkVel[i].z;
      sparkVel[i].y -= 0.006;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparks.material.opacity = Math.max(0, sparkLife);
  }

  composer.render();
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
});
