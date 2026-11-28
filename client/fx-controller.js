(() => {
  const TAU = Math.PI * 2;

  function create({ getEffectScale, isSoundEnabled, getAudioGraph, isReducedMotion }) {
    const canvas = document.createElement("canvas");
    canvas.id = "takeover-fx";
    canvas.className = "takeover-fx";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    const context = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles = [];
    let events = [];
    let frameId;
    let startedAt = 0;
    let duration = 0;
    let active = false;
    let seed = 1;
    let audioBus;
    let analyser;
    let spectrum;
    let activeVoices = 0;
    let lastFrame = 0;
    let lastPaint = 0;
    let detailScale = 1;

    function random() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    function resize() {
      detailScale = Math.max(0.2, Math.min(1, getEffectScale()));
      dpr = Math.min(window.devicePixelRatio || 1, detailScale < 0.5 ? 1 : 1.75);
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function getAudioBus() {
      if (!isSoundEnabled()) return null;
      const graph = getAudioGraph();
      if (!graph?.context || !graph.destination) return null;
      if (audioBus?.context !== graph.context || audioBus?.destination !== graph.destination) {
        const bus = graph.context.createGain();
        analyser = graph.context.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.72;
        spectrum = new Uint8Array(analyser.frequencyBinCount);
        bus.connect(analyser);
        analyser.connect(graph.destination);
        audioBus = { context: graph.context, destination: graph.destination, bus };
      }
      return audioBus;
    }

    function playRocket() {
      const graph = getAudioBus();
      if (!graph || activeVoices >= 5) return;
      const { context: audioContext, bus } = graph;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(180, now);
      oscillator.frequency.exponentialRampToValueAtTime(1800, now + 0.65);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.035, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.68);
      oscillator.connect(gain);
      gain.connect(bus);
      activeVoices += 1;
      oscillator.onended = () => { activeVoices -= 1; oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(now);
      oscillator.stop(now + 0.7);
    }

    function playExplosion(power = 1) {
      const graph = getAudioBus();
      if (!graph || activeVoices >= 7) return;
      const { context: audioContext, bus } = graph;
      const now = audioContext.currentTime;
      const length = Math.ceil(audioContext.sampleRate * 0.55);
      const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) {
        samples[index] = (random() * 2 - 1) * (1 - index / length);
      }
      const source = audioContext.createBufferSource();
      const filter = audioContext.createBiquadFilter();
      const gain = audioContext.createGain();
      const bass = audioContext.createOscillator();
      const bassGain = audioContext.createGain();
      source.buffer = buffer;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2800, now);
      filter.frequency.exponentialRampToValueAtTime(170, now + 0.5);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.16 * power, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      bass.type = "sine";
      bass.frequency.setValueAtTime(82, now);
      bass.frequency.exponentialRampToValueAtTime(34, now + 0.24);
      bassGain.gain.setValueAtTime(0.0001, now);
      bassGain.gain.exponentialRampToValueAtTime(0.18 * power, now + 0.004);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(bus);
      bass.connect(bassGain);
      bassGain.connect(bus);
      activeVoices += 1;
      source.onended = () => {
        activeVoices -= 1;
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
        bass.disconnect();
        bassGain.disconnect();
      };
      source.start(now);
      source.stop(now + 0.56);
      bass.start(now);
      bass.stop(now + 0.3);
    }

    function addParticle(particle) {
      const cap = Math.round(320 + 420 * Math.max(0.2, Math.min(1, getEffectScale())));
      if (particles.length < cap) particles.push(particle);
    }

    function colors() {
      return ["#6ffff0", "#ffd978", "#ff67b7", "#8fa9ff", "#fff5d3"];
    }

    function burst(x, y, amount, palette = colors(), power = 1) {
      for (let index = 0; index < amount; index += 1) {
        const angle = random() * TAU;
        const velocity = (70 + random() * 310) * power;
        addParticle({
          kind: "spark",
          x, y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          gravity: 190,
          drag: 0.986,
          life: 0.75 + random() * 1.05,
          maxLife: 1.8,
          size: 1.3 + random() * 2.7,
          color: palette[Math.floor(random() * palette.length)],
          trail: [],
        });
      }
      addParticle({ kind: "ring", x, y, life: 0.65, maxLife: 0.65, size: 10, color: "#fff1a8", radius: 5, growth: 460 });
    }

    function comet(fromLeft = true, meteor = false) {
      const x = fromLeft ? -60 : width + 60;
      const y = height * (0.06 + random() * 0.32);
      const velocity = meteor ? 720 : 560;
      addParticle({
        kind: meteor ? "meteor" : "comet",
        x, y,
        vx: (fromLeft ? 1 : -1) * velocity * (0.75 + random() * 0.25),
        vy: velocity * (0.42 + random() * 0.28),
        gravity: meteor ? 95 : 20,
        drag: 1,
        life: meteor ? 1.7 : 1.3,
        maxLife: meteor ? 1.7 : 1.3,
        size: meteor ? 9 : 5,
        color: meteor ? "#ff9b3d" : "#a9fff4",
        trail: [],
        impact: 0,
      });
      playRocket();
    }

    function firework() {
      burst(width * (0.12 + random() * 0.76), height * (0.15 + random() * 0.45),
        Math.round(42 + random() * 28), colors(), 0.8 + random() * 0.35);
      playExplosion(0.72);
    }

    function schedule(time, callback) {
      events.push({ time, callback, fired: false });
    }

    function triggerTakeover({ preset = "win", intensity = 1, durationMs, seed: requestedSeed } = {}) {
      const scale = Math.max(0, Math.min(1, getEffectScale())) * Math.max(0.2, Math.min(1.5, intensity));
      if (scale <= 0 || isReducedMotion()) return false;
      stop();
      seed = Number.isFinite(requestedSeed) ? requestedSeed >>> 0 : (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
      resize();
      duration = Math.max(1800, Math.min(6000, durationMs ?? (preset === "bonus" ? 4800 : 3200)));
      startedAt = performance.now();
      lastFrame = startedAt;
      active = true;
      canvas.classList.remove("ending");
      canvas.classList.add("active");
      canvas.dataset.preset = preset;

      if (preset === "bonus") {
        schedule(100, () => comet(true, false));
        schedule(430, () => comet(false, true));
        schedule(900, () => firework());
        schedule(1320, () => comet(true, true));
        schedule(1900, () => firework());
        schedule(2400, () => firework());
        schedule(3000, () => {
          firework();
          burst(width / 2, height * 0.68, 110, ["#ffef9b", "#ffffff", "#ff5fbc"], 1.25);
          playExplosion(1);
        });
      } else {
        schedule(80, () => comet(random() > 0.5));
        schedule(650, () => firework());
        schedule(1350, () => firework());
        if (preset === "jackpot") schedule(2000, () => {
          firework();
          burst(width / 2, height * 0.4, 130, colors(), 1.35);
        });
      }
      frameId = requestAnimationFrame(frame);
      return true;
    }

    function audioEnergy() {
      if (!analyser || !spectrum) return 0;
      analyser.getByteFrequencyData(spectrum);
      let total = 0;
      for (const value of spectrum) total += value;
      return total / spectrum.length / 255;
    }

    function frame(now) {
      if (!active) return;
      const minimumFrameTime = detailScale < 0.5 ? 30 : 0;
      if (minimumFrameTime && now - lastPaint < minimumFrameTime) {
        frameId = requestAnimationFrame(frame);
        return;
      }
      lastPaint = now;
      const elapsed = now - startedAt;
      const dt = Math.min(0.035, Math.max(0, (now - lastFrame) / 1000));
      lastFrame = now;
      for (const event of events) {
        if (!event.fired && elapsed >= event.time) {
          event.fired = true;
          event.callback();
        }
      }
      context.clearRect(0, 0, width, height);
      context.save();
      context.globalCompositeOperation = "lighter";
      const energy = audioEnergy();
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        particle.life -= dt;
        if (particle.life <= 0) {
          particles.splice(index, 1);
          continue;
        }
        if (particle.kind !== "ring") {
          particle.vx *= Math.pow(particle.drag ?? 1, dt * 60);
          particle.vy = particle.vy * Math.pow(particle.drag ?? 1, dt * 60) + (particle.gravity || 0) * dt;
          particle.trail.push({ x: particle.x, y: particle.y });
          if (particle.trail.length > (particle.kind === "meteor" ? 18 : 9)) particle.trail.shift();
          particle.x += particle.vx * dt;
          particle.y += particle.vy * dt;
          if (particle.kind === "meteor" && !particle.impact && particle.y > height * 0.82) {
            particle.impact = 1;
            burst(particle.x, height * 0.84, 32, ["#ffb34f", "#ff5f39", "#fff0ac"], 1);
            playExplosion(0.85);
          }
        } else {
          particle.radius += particle.growth * dt;
        }
        const alpha = Math.min(1, particle.life / Math.min(particle.maxLife, 0.45));
        context.globalAlpha = alpha;
        if (particle.kind === "ring") {
          context.strokeStyle = particle.color;
          context.lineWidth = 3 * (1 - energy * 0.35);
          context.beginPath();
          context.arc(particle.x, particle.y, particle.radius, 0, TAU);
          context.stroke();
        } else {
          if (particle.trail.length > 1) {
            context.strokeStyle = particle.color;
            context.lineWidth = Math.max(1, particle.size * (particle.kind === "meteor" ? 2.1 : 1.1));
            context.globalAlpha = alpha * 0.7;
            context.beginPath();
            context.moveTo(particle.trail[0].x, particle.trail[0].y);
            for (const point of particle.trail) context.lineTo(point.x, point.y);
            context.stroke();
          }
          context.globalAlpha = alpha;
          context.fillStyle = particle.color;
          context.shadowColor = particle.color;
          context.shadowBlur = detailScale < 0.5
            ? 0
            : particle.size * (5 + energy * 10);
          context.beginPath();
          context.arc(particle.x, particle.y, particle.size * (1 + energy * 0.45), 0, TAU);
          context.fill();
          context.shadowBlur = 0;
        }
      }
      context.restore();
      if (elapsed >= duration && particles.length === 0) {
        stop();
        return;
      }
      if (elapsed >= duration) canvas.classList.add("ending");
      frameId = requestAnimationFrame(frame);
    }

    function stop() {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = undefined;
      active = false;
      particles = [];
      events = [];
      context.clearRect(0, 0, width, height);
      canvas.classList.remove("active", "ending");
      canvas.dataset.preset = "";
    }

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") stop();
    });
    resize();

    return {
      triggerTakeover,
      stop,
      isActive: () => active,
    };
  }

  window.LuckyTakeoverFX = { create };
})();
