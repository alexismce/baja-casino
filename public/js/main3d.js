import * as THREE from 'three';

const socket = io();
let currentChips = 1000;
let isSpinning = false;
let wheelAngle = 0;
let targetSpinSpeed = 0.008;

// 1. Escena, Cámara y Renderer (WebGL 2 vía Three.js)
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07070d);
scene.fog = new THREE.FogExp2(0x07070d, 0.045);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 6.5, 7.5);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// 2. Iluminación Baja Casino (Oro y Neón)
const ambient = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambient);

const spotGold = new THREE.SpotLight(0xffd700, 65);
spotGold.position.set(0, 10, 2);
scene.add(spotGold);

const neonCyan = new THREE.PointLight(0x00e5ff, 25, 16);
neonCyan.position.set(-5, 3, -3);
scene.add(neonCyan);

const neonMagenta = new THREE.PointLight(0xff1e8a, 25, 16);
neonMagenta.position.set(5, 3, -3);
scene.add(neonMagenta);

// 3. Mesa y Rueda 3D de Baja Casino
const table = new THREE.Mesh(
  new THREE.CylinderGeometry(5.5, 5.5, 0.4, 48),
  new THREE.MeshStandardMaterial({ color: 0x0b3b24, roughness: 0.75 })
);
table.position.y = -0.3;
scene.add(table);

const wheelGroup = new THREE.Group();
scene.add(wheelGroup);

// Aro Dorado
const rim = new THREE.Mesh(
  new THREE.TorusGeometry(2.6, 0.22, 16, 48),
  new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.2 })
);
rim.rotation.x = Math.PI / 2;
wheelGroup.add(rim);

// 15 Casillas (0 = Verde 14x, 1-7 = Rojo 2x, 8-14 = Negro 2x)
const sliceAngle = (Math.PI * 2) / 15;
for (let i = 0; i < 15; i++) {
  const color = i === 0 ? 0x149e53 : i <= 7 ? 0xd92638 : 0x181a24;
  const segment = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.5, 0.25, 16, 1, false, i * sliceAngle, sliceAngle * 0.94),
    new THREE.MeshStandardMaterial({ color, roughness: 0.4 })
  );
  wheelGroup.add(segment);
}

// Indicador Superior
const pointer = new THREE.Mesh(
  new THREE.ConeGeometry(0.25, 0.6, 16),
  new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.1 })
);
pointer.position.set(0, 0.5, 2.7);
pointer.rotation.x = -Math.PI / 2;
scene.add(pointer);

// 4. Eventos Socket.IO y Controles
window.placeBet = (choice) => {
  if (isSpinning || currentChips < 100) return;
  isSpinning = true;
  setButtons(true);
  document.getElementById('status').textContent = `Apuesta de 100 al ${choice.toUpperCase()}... Girando!`;
  socket.emit('spinRoulette', { betAmount: 100, choice });
};

function setButtons(disabled) {
  document.querySelectorAll('#controls button').forEach((b) => {
    b.disabled = disabled;
  });
}

socket.on('balanceUpdate', (chips) => {
  currentChips = chips;
  document.getElementById('chips').textContent = chips;
});

socket.on('rouletteResult', ({ outcomeNumber, outcomeColor, winAmount, newBalance }) => {
  targetSpinSpeed = 0.35;
  setTimeout(() => {
    targetSpinSpeed = 0.008;
    isSpinning = false;
    setButtons(false);
    currentChips = newBalance;
    document.getElementById('chips').textContent = newBalance;
    document.getElementById('status').textContent =
      winAmount > 0
        ? `Cayó ${outcomeNumber} (${outcomeColor.toUpperCase()})! +${winAmount} Fichas`
        : `Cayó ${outcomeNumber} (${outcomeColor.toUpperCase()}). Intenta de nuevo`;
  }, 2200);
});

// 5. Loop de Renderizado y Ajuste de Pantalla
function animate() {
  requestAnimationFrame(animate);
  wheelAngle += targetSpinSpeed;
  wheelGroup.rotation.y = wheelAngle;
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
