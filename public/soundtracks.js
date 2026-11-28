(() => {
  const tracks = {
    lounge: {
      interval: 540,
      notes: [392, 0, 493.88, 587.33, 523.25, 0, 493.88, 392, 440, 0, 523.25, 659.25, 587.33, 0, 493.88, 440, 349.23, 0, 440, 523.25, 493.88, 0, 440, 349.23, 392, 0, 493.88, 587.33, 523.25, 0, 440, 392],
    },
    velvet: {
      interval: 660,
      notes: [329.63, 392, 0, 523.25, 493.88, 392, 0, 329.63, 349.23, 440, 0, 523.25, 440, 392, 0, 329.63],
    },
    midnight: {
      interval: 450,
      notes: [523.25, 0, 587.33, 659.25, 0, 783.99, 659.25, 587.33, 523.25, 0, 493.88, 440, 0, 392, 440, 493.88],
    },
    arcade: {
      interval: 250,
      wave: "square",
      notes: [523.25, 659.25, 783.99, 0, 659.25, 523.25, 392, 0, 440, 523.25, 659.25, 0, 587.33, 493.88, 392, 0],
    },
    neon: {
      interval: 300,
      wave: "triangle",
      notes: [440, 523.25, 659.25, 783.99, 659.25, 523.25, 0, 392, 440, 587.33, 698.46, 880, 698.46, 587.33, 523.25, 0],
    },
  };
  const key = "lucky-lounge-soundtrack";

  function getStep(track, step, mode = "lobby", state = "idle") {
    const table = mode === "blackjack" || mode === "poker";
    const quick = mode === "dice" || mode === "coin";
    const active = state === "active" || state === "bonus";
    const index = (table ? step * 3 : step) % track.notes.length;
    const frequency = track.notes[index];
    const transpose = quick ? 1.12246 : mode === "roulette" ? 0.8909 : 1;
    const voices = [];
    if (frequency) {
      voices.push({ frequency: frequency * transpose, wave: track.wave ?? "sine", level: track.wave === "square" ? 0.12 : 0.22, duration: Math.min(0.3, track.interval / 1000 * 0.8) });
      if (active && step % 2 === 0) {
        voices.push({ frequency: frequency * transpose * 1.5, wave: "triangle", level: 0.055, duration: 0.12 });
      }
    }
    if (step % (active ? 2 : 4) === 0) {
      const root = track.notes[Math.floor(step / 4) * 4 % track.notes.length] || track.notes.find(Boolean);
      voices.push({ frequency: root * transpose / 4, wave: "triangle", level: 0.22, duration: 0.18 });
      voices.push({ frequency: 130, endFrequency: 55, wave: "sine", level: 0.28, duration: 0.09 });
    }
    if (step % 4 === (table ? 3 : 2) || (active && step % 2 === 1)) {
      voices.push({ frequency: state === "bonus" ? 1550 : 1100, endFrequency: 700, wave: "square", level: 0.035, duration: 0.035 });
    }
    if (state === "bonus" && step % 2 === 1) {
      voices.push({ frequency: 1046.5, wave: "triangle", level: 0.08, duration: 0.14 });
    }
    return voices;
  }

  function playStep(context, destination, track, step, mode, state) {
    const now = context.currentTime;
    for (const voice of getStep(track, step, mode, state)) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = voice.wave;
      oscillator.frequency.setValueAtTime(voice.frequency, now);
      if (voice.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(voice.endFrequency, now + voice.duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(voice.level, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + voice.duration);
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.addEventListener("ended", () => { oscillator.disconnect(); gain.disconnect(); }, { once: true });
      oscillator.start(now);
      oscillator.stop(now + voice.duration + 0.01);
    }
  }

  function bind(select, onChange) {
    let selected = "lounge";
    try {
      const saved = window.localStorage.getItem(key);
      if (Object.hasOwn(tracks, saved)) selected = saved;
    } catch (error) {
      console.warn("Could not read the saved soundtrack preference:", error);
    }
    select.value = selected;
    select.addEventListener("change", () => {
      if (!Object.hasOwn(tracks, select.value)) {
        console.warn("Unknown soundtrack selection:", select.value);
        select.value = selected;
        return;
      }
      selected = select.value;
      try {
        window.localStorage.setItem(key, selected);
      } catch (error) {
        console.warn("Could not save the soundtrack preference:", error);
      }
      onChange();
    });
    return () => tracks[selected];
  }

  window.LuckySoundtracks = { bind, getStep, playStep };
})();
