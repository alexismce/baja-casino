import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const socket = io();
let currentChips = 1000;
let selectedBet = 100;
let activeGame = 'roulette';
let isBusy = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05050a);
scene.fog = new THREE.FogExp2(0x05050a, 0.032);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 6.2, 8.2);
camera.lookAt(0, 0.3, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.55,
  0.4,
  0.78
);
composer.addPass(bloomPass);

scene.add(new THREE.AmbientLight(0x8fa8ff, 0.45));

const goldSpot = new THREE.SpotLight(0xffd700, 90, 35, Math.PI / 4, 0.5, 1.2);
goldSpot.position.set(0, 11, 2);
scene.add(goldSpot);

const cyanLight = new THREE.PointLight(0x00f0ff, 35, 18);
cyanLight.position.set(-5.5, 3.2, -3.5);
scene.add(cyanLight);

const magentaLight = new THREE.PointLight(0xff1e8a, 35, 18);
magentaLight.position.set(5.5, 3.2, -3.5);
scene.add(magentaLight);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(18, 64),
  new THREE.MeshStandardMaterial({ color: 0x090b14, metalness: 0.3, roughness: 0.65 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.55;
scene.add(floor);

const neonRing = new THREE.Mesh(
  new THREE.TorusGeometry(5.6, 0.05, 12, 72),
  new THREE.MeshBasicMaterial({ color: 0x00f0ff })
);
neonRing.rotation.x = Math.PI / 2;
neonRing.position.y = -0.5;
scene.add(neonRing);

const rouletteGroup = new THREE.Group();
scene.add(rouletteGroup);

const tableFelt = new THREE.Mesh(
  new THREE.CylinderGeometry(5.2, 5.4, 0.4, 48),
  new THREE.MeshStandardMaterial({ color: 0x093822, roughness: 0.78, metalness: 0.05 })
);
tableFelt.position.y = -0.32;
rouletteGroup.add(tableFelt);

const wheelSpinner = new THREE.Group();
rouletteGroup.add(wheelSpinner);

const goldRim = new THREE.Mesh(
  new THREE.TorusGeometry(2.65, 0.24, 20, 64),
  new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.92, roughness: 0.16 })
);
goldRim.rotation.x = Math.PI / 2;
wheelSpinner.add(goldRim);

const sliceAngle = (Math.PI * 2) / 15;
for (let i = 0; i < 15; i++) {
  const color = i === 0 ? 0x16e076 : i <= 7 ? 0xff2942 : 0x191d2b;
  const seg = new THREE.Mesh(
    new THREE.CylinderGeometry(2.52, 2.52, 0.28, 16, 1, false, i * sliceAngle, sliceAngle * 0.93),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.15 })
  );
  wheelSpinner.add(seg);
}

const pointer = new THREE.Mesh(
  new THREE.ConeGeometry(0.28, 0.68, 20),
  new THREE.MeshStandardMaterial({ color: 0xffe066, metalness: 0.95, roughness: 0.12 })
);
pointer.position.set(0, 0.55, 2.8);
pointer.rotation.x = -Math.PI / 2;
rouletteGroup.add(pointer);

const rocketGroup = new THREE.Group();
rocketGroup.visible = false;
scene.add(rocketGroup);

const launchPad = new THREE.Mesh(
  new THREE.CylinderGeometry(2.4, 2.8, 0.35, 32),
  new THREE.MeshStandardMaterial({ color: 0x1b2033, metalness: 0.7, roughness: 0.3 })
);
launchPad.position.y = -0.35;
rocketGroup.add(launchPad);

const rocketMesh = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.CylinderGeometry(0.32, 0.38, 1.5, 24),
  new THREE.MeshStandardMaterial({ color: 0xf4f7ff, metalness: 0.6, roughness: 0.25 })
);
const nose = new THREE.Mesh(
  new THREE.ConeGeometry(0.32, 0.75, 24),
  new THREE.MeshStandardMaterial({ color: 0xff2965, metalness: 0.5, roughness: 0.3 })
);
nose.position.y = 1.12;
const flame = new THREE.Mesh(
  new THREE.ConeGeometry(0.28, 0.95, 16),
  new THREE.MeshBasicMaterial({ color: 0xff9d00 })
);
flame.position.y = -1.15;
flame.rotation.x = Math.PI;
rocketMesh.add(body, nose, flame);
rocketMesh.position.set(0, 0.8, 0);
rocketGroup.add(rocketMesh);

const sparkCount = 60;
const sparkGeo = new THREE.BufferGeometry();
const sparkPositions = new Float32Array(sparkCount * 3);
const sparkVelocities = [];
for (let i = 0; i < sparkCount; i++) {
  sparkPositions[i * 3 + 1] = -99;
  sparkVelocities.push(new THREE.Vector3());
}
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
const sparks = new THREE.Points(
  sparkGeo,
  new THREE.PointsMaterial({ color: 0xffd700, size: 0.18, transparent: true, opacity: 0.95 })
);
scene.add(sparks);
let sparkTimer = 0;

function triggerSparks(origin, colorHex = 0xffd700) {
  sparks.material.color.setHex(colorHex);
  const pos = sparkGeo.attributes.position.array;
  for (let i = 0; i < sparkCount; i++) {
    pos[i * 3] = origin.x;
    pos[i * 3 + 1] = origin.y;
    pos[i * 3 + 2] = origin.z;
    sparkVelocities[i].set(
      (Math.random() - 0.5) * 0.24,
      Math.random() * 0.22 + 0.05,
      (Math.random() - 0.5) * 0.24
    );
  }
  sparkGeo.attributes.position.needsUpdate = true;
  sparkTimer = 1.0;
}

let wheelSpeed = 0.01;
let rocketAltitude = 0.8;
let rocketRising = false;

window.setBet = (amount, btnEl) => {
  if (isBusy) return;
  selectedBet = amount;
  document.querySelectorAll('.chip-btn').forEach((b) => b.classList.remove('active'));
  btnEl.classList.add('active');
};

window.switchGame = (mode) => {
  if (isBusy) return;
  activeGame = mode;
  document.getElementById('tabRoulette').classList.toggle('active', mode === 'roulette');
  document.getElementById('tabRocket').classList.toggle('active', mode === 'rocket');
  document.getElementById('rouletteControls').classList.toggle('hidden', mode !== 'roulette');
  document.getElementById('rocketControls').classList.toggle('hidden', mode !== 'rocket');
  rouletteGroup.visible = mode === 'roulette';
  rocketGroup.visible = mode === 'rocket';
  document.getElementById('status').textContent =
    mode === 'roulette'
      ? `Roulette ready • Bet ${selectedBet} chips`
      : `Rising Rockets ready • Bet ${selectedBet} chips`;
};

window.placeBet = (choice) => {
  if (isBusy || currentChips < selectedBet) return;
  isBusy = true;
  setButtonsDisabled(true);
  document.getElementById('status').textContent = `Spinning ${selectedBet} on ${choice.toUpperCase()}...`;
  socket.emit('spinRoulette', { betAmount: selectedBet, choice });
};

window.launchRocket = (cashoutAt) => {
  if (isBusy || currentChips < selectedBet) return;
  isBusy = true;
  rocketRising = true;
  setButtonsDisabled(true);
  document.getElementById('status').textContent = `🚀 Launching (${selectedBet} chips • Target ${cashoutAt}x)...`;
  socket.emit('launchRocket', { betAmount: selectedBet, cashoutAt });
};

function setButtonsDisabled(disabled) {
  document.querySelectorAll('.game-btn, .chip-btn, .mode-btn').forEach((b) => {
    b.disabled = disabled;
  });
}

socket.on('balanceUpdate', (chips) => {
  currentChips = chips;
  document.getElementById('chips').textContent = chips;
});

socket.on('rouletteResult', ({ outcomeNumber, outcomeColor, winAmount, newBalance }) => {
  wheelSpeed = 0.42;
  setTimeout(() => {
    wheelSpeed = 0.01;
    isBusy = false;
    setButtonsDisabled(false);
    currentChips = newBalance;
    document.getElementById('chips').textContent = newBalance;
    if (winAmount > 0) {
      triggerSparks(new THREE.Vector3(0, 0.6, 2.2), outcomeColor === 'green' ? 0x16e076 : 0xffd700);
      document.getElementById('status').textContent =
        `✨ ${outcomeNumber} (${outcomeColor.toUpperCase()}) • +${winAmount} Chips!`;
    } else {
      document.getElementById('status').textContent =
        `Landed ${outcomeNumber} (${outcomeColor.toUpperCase()}) • Try again`;
    }
  }, 2100);
});

socket.on('rocketResult', ({ crashPoint, targetMult, prizeBoost, bigBang, won, winAmount, newBalance }) => {
  setTimeout(() => {
    rocketRising = false;
    isBusy = false;
    setButtonsDisabled(false);
    currentChips = newBalance;
    document.getElementById('chips').textContent = newBalance;

    const crashPos = new THREE.Vector3(0, rocketAltitude, 0);
    triggerSparks(crashPos, won ? 0x16e076 : bigBang ? 0xff1e8a : 0xff5500);
    rocketAltitude = 0.8;
    rocketMesh.position.y = 0.8;

    const boostTag = prizeBoost ? ' [PRIZE BOOST]' : '';
    const bangTag = bigBang ? ' 💥 BIG BANG!' : '';
    document.getElementById('status').textContent = won
      ? `🚀 Cashed ${targetMult}x (Crash ${crashPoint}x)${boostTag} • +${winAmount} Chips!`
      : `💥 Crashed at ${crashPoint}x (Target ${targetMult}x)${boostTag}${bangTag}`;
  }, 1500);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  cyanLight.intensity = 32 + Math.sin(t * 2.2) * 8;
  magentaLight.intensity = 32 + Math.cos(t * 2.2) * 8;

  if (activeGame === 'roulette') {
    wheelSpinner.rotation.y += wheelSpeed;
  } else if (activeGame === 'rocket') {
    if (rocketRising) {
      rocketAltitude = Math.min(4.6, rocketAltitude + 0.055);
      rocketMesh.position.y = rocketAltitude;
      flame.scale.setScalar(1 + Math.sin(t * 35) * 0.25);
    } else {
      rocketMesh.position.y = 0.8 + Math.sin(t * 2.5) * 0.08;
      flame.scale.setScalar(0.85 + Math.sin(t * 15) * 0.1);
    }
  }

  if (sparkTimer > 0) {
    sparkTimer -= 0.025;
    const pos = sparkGeo.attributes.position.array;
    for (let i = 0; i < sparkCount; i++) {
      pos[i * 3] += sparkVelocities[i].x;
      pos[i * 3 + 1] += sparkVelocities[i].y;
      pos[i * 3 + 2] += sparkVelocities[i].z;
      sparkVelocities[i].y -= 0.006;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparks.material.opacity = Math.max(0, sparkTimer);
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
