/**
 * Baja Casino (baja-casino.com) — Lobby Controller
 * Handles ES-MX / EN localization, combinable catalog filtering & '/' search shortcut,
 * session hydration, local accounts, opt-in leaderboard, accessible <dialog> modals,
 * and a zero-dependency Web Audio API lounge synthesizer.
 */

(() => {
  'use strict';

  const STORAGE_KEYS = {
    locale: 'bajaCasino.locale',
    soundEnabled: 'bajaCasino.soundEnabled',
    track: 'bajaCasino.track',
    volume: 'bajaCasino.volume',
    // Legacy compatibility keys so /client stays synchronized
    legacySoundEnabled: 'luckyLounge.soundEnabled',
    legacyTrack: 'luckyLounge.track',
    legacyVolume: 'luckyLounge.volume',
  };

  const I18N = {
    'es-MX': {
      'skip.content': 'Saltar al contenido principal',
      'notice.virtual': 'Créditos virtuales únicamente · Sin apuestas, depósitos ni premios en dinero real.',
      'brand.subtitle': 'Sala Recreacional · baja-casino.com',
      'wallet.label': 'Créditos virtuales',
      'wallet.daily': '+100 Bono diario UTC',
      'wallet.dailyClaimed': 'Bono UTC reclamado',
      'wallet.share': 'Compartir sala',
      'audio.toggleOn': 'Sonido: Activado',
      'audio.toggleOff': 'Sonido: Desactivado',
      'audio.track': 'Pista ambiental',
      'audio.volume': 'Volumen',
      'hero.eyebrow': 'Entretenimiento digital con resultados validados en servidor',
      'hero.title': 'Sala de juegos clásica con estética lounge',
      'hero.description':
        'Explora seis modos de juego con créditos virtuales gratuitos. Cada sesión inicia con 1,000 créditos de práctica sin valor en efectivo, sin compras ni retiros monetarios.',
      'resume.text': 'Tienes una mano activa guardada en tu sesión.',
      'resume.cta': 'Continuar partida',
      'catalog.heading': 'Catálogo de juegos',
      'filter.all': 'All games',
      'filter.slots': 'Slots',
      'filter.tables': 'Tables',
      'filter.quick': 'Quick play',
      'search.label': 'Buscar juegos',
      'search.placeholder': 'Buscar juego (atajo: /)',
      'badge.slots': 'Slots',
      'badge.tables': 'Tables',
      'badge.quick': 'Quick play',
      'game.slots.desc':
        'Gabinete unificado 5×3 con 10 líneas fijas, bono de cuadrícula 3×3, opción Fortune Wheel y vista 2D o 3D según tu apuesta por línea.',
      'cta.play': 'Jugar Slots',
      'cta.slotsWheel': 'Con Fortune Wheel',
      'game.blackjack.desc':
        'Baraja de 52 cartas mezclada en servidor con pedir, plantarse, dividir una vez y doblar en manos de dos cartas.',
      'cta.playBlackjack': 'Jugar Blackjack',
      'game.roulette.desc':
        'Selección directa a número pleno con rueda animada sincronizada al resultado determinado por el servidor.',
      'cta.playRoulette': 'Jugar Roulette',
      'game.poker.desc':
        'Recibe cinco cartas, conserva tus mejores combinaciones y descarta el resto con tabla de pagos publicada hasta 250× por Escalera Real.',
      'cta.playPoker': 'Jugar Video Poker',
      'game.dice.desc':
        'Elige una cara exacta del 1 al 6; acertar el lanzamiento devuelve cinco veces tu apuesta virtual.',
      'cta.playDice': 'Jugar Dice Roll',
      'game.coin.desc':
        'Ronda rápida de cara o cruz resuelta al instante mediante generador criptográfico en servidor.',
      'cta.playCoin': 'Jugar Coin Toss',
      'empty.title': 'No encontramos juegos con ese filtro',
      'empty.desc':
        'Prueba con otro término de búsqueda o restablece las categorías para ver los 6 modos.',
      'empty.reset': 'Mostrar todos los juegos',
      'account.heading': 'Cuenta local y progreso',
      'account.desc':
        'Puedes jugar como invitado o crear una cuenta local para conservar tu saldo de créditos virtuales, logros y partidas activas.',
      'account.email': 'Correo electrónico',
      'account.password': 'Contraseña',
      'account.displayName': 'Nombre visible (para registro nuevo)',
      'account.login': 'Iniciar sesión',
      'account.register': 'Crear cuenta',
      'account.logout': 'Cerrar sesión',
      'stats.rounds': 'Rondas jugadas',
      'stats.achievements': 'Logros',
      'account.optIn': 'Mostrar mi nombre y mejor saldo virtual en la tabla pública',
      'lb.heading': 'Tabla de mejores saldos virtuales',
      'lb.desc':
        'Lista voluntaria de jugadores que eligieron compartir su mejor marca de créditos virtuales.',
      'lb.empty': 'Aún no hay jugadores inscritos en la tabla pública.',
      'footer.disclaimer':
        'Plataforma de entretenimiento recreacional con créditos virtuales sin valor monetario. No se aceptan apuestas con dinero real ni se realizan pagos en efectivo. Prohibido el acceso a menores de 18 años.',
      'footer.rules': 'Reglas y tablas de pago',
      'footer.privacy': 'Aviso de privacidad',
      'footer.terms': 'Términos de uso',
      'footer.responsible': 'Juego responsable',
      'footer.contact': 'Contacto',
      // Dynamic messages
      'msg.catalogCount': 'Mostrando {visible} de {total} juegos',
      'msg.shareCopied': 'Enlace de Baja Casino copiado al portapapeles.',
      'msg.shareTitle': 'Baja Casino — Sala Recreacional',
      'msg.shareText': 'Explora tragamonedas, blackjack, ruleta y video póker con créditos virtuales.',
      'msg.dailySuccess': '¡Bono diario UTC acreditado (+100 créditos virtuales)!',
      'msg.dailyAlready': 'El bono diario UTC ya fue reclamado hoy. Vuelve después de las 00:00 UTC.',
      'msg.dailyOffline': 'No se pudo conectar con el servidor para reclamar el bono.',
      'msg.authInvalidEmail': 'Ingresa un correo electrónico válido.',
      'msg.authInvalidPassword': 'La contraseña debe tener al menos 8 caracteres.',
      'msg.authSubmitting': 'Procesando solicitud...',
      'msg.authLoginOk': 'Sesión iniciada correctamente.',
      'msg.authRegisterOk': 'Cuenta local creada y saldo de invitado transferido.',
      'msg.authLogoutOk': 'Sesión cerrada. Continúas en modo invitado.',
      'msg.authError': 'No se pudo completar el acceso. Verifica tus datos.',
      'msg.optInUpdated': 'Preferencia de clasificación pública actualizada.',
      'msg.localeChanged': 'Idioma cambiado a Español (México).',
      'msg.creditsLabel': 'créditos',
    },
    en: {
      'skip.content': 'Skip to main content',
      'notice.virtual': 'Virtual credits only · No real-money wagering, deposits, or cash prizes.',
      'brand.subtitle': 'Recreational Lounge · baja-casino.com',
      'wallet.label': 'Virtual credits',
      'wallet.daily': '+100 Daily UTC Bonus',
      'wallet.dailyClaimed': 'UTC Bonus Claimed',
      'wallet.share': 'Share lounge',
      'audio.toggleOn': 'Sound: On',
      'audio.toggleOff': 'Sound: Off',
      'audio.track': 'Lounge track',
      'audio.volume': 'Volume',
      'hero.eyebrow': 'Digital entertainment with server-validated outcomes',
      'hero.title': 'Classic game room with contemporary lounge aesthetics',
      'hero.description':
        'Explore six game modes using free virtual credits. Every session starts with 1,000 practice credits carrying zero cash value, no purchases, and no monetary withdrawals.',
      'resume.text': 'You have an active hand saved in your session.',
      'resume.cta': 'Resume hand',
      'catalog.heading': 'Game catalog',
      'filter.all': 'All games',
      'filter.slots': 'Slots',
      'filter.tables': 'Tables',
      'filter.quick': 'Quick play',
      'search.label': 'Search games',
      'search.placeholder': 'Search games (shortcut: /)',
      'badge.slots': 'Slots',
      'badge.tables': 'Tables',
      'badge.quick': 'Quick play',
      'game.slots.desc':
        'Unified 5×3 cabinet with 10 fixed paylines, 3×3 pattern grid bonus, optional Fortune Wheel, and 2D or 3D reels based on your line bet.',
      'cta.play': 'Play Slots',
      'cta.slotsWheel': 'With Fortune Wheel',
      'game.blackjack.desc':
        'Server-shuffled 52-card deck with hit, stand, one split per hand, and double down on two-card hands.',
      'cta.playBlackjack': 'Play Blackjack',
      'game.roulette.desc':
        'Straight-up single-number selection with an animated wheel synchronized to the server-determined outcome.',
      'cta.playRoulette': 'Play Roulette',
      'game.poker.desc':
        'Receive five cards, hold your best combinations, and draw replacements against a published paytable up to 250× for a Royal Flush.',
      'cta.playPoker': 'Play Video Poker',
      'game.dice.desc':
        'Pick an exact face from 1 to 6; matching the server roll returns five times your virtual stake.',
      'cta.playDice': 'Play Dice Roll',
      'game.coin.desc':
        'Fast heads-or-tails round settled instantly via cryptographic server RNG.',
      'cta.playCoin': 'Play Coin Toss',
      'empty.title': 'No games match that filter',
      'empty.desc':
        'Try a different search term or reset categories to view all 6 game modes.',
      'empty.reset': 'Show all games',
      'account.heading': 'Local account & progress',
      'account.desc':
        'Play as a guest or create a local account to keep your virtual-credit balance, achievements, and active hands.',
      'account.email': 'Email address',
      'account.password': 'Password',
      'account.displayName': 'Display name (for new registration)',
      'account.login': 'Sign in',
      'account.register': 'Create account',
      'account.logout': 'Sign out',
      'stats.rounds': 'Rounds played',
      'stats.achievements': 'Achievements',
      'account.optIn': 'Show my display name and best virtual balance on the public leaderboard',
      'lb.heading': 'Top virtual balances leaderboard',
      'lb.desc':
        'Opt-in showcase of players who chose to share their highest virtual-credit milestone.',
      'lb.empty': 'No players have opted into the public leaderboard yet.',
      'footer.disclaimer':
        'Recreational entertainment platform using virtual credits with zero cash value. No real-money wagers are accepted and no cash payouts are made. Strictly 18+.',
      'footer.rules': 'Rules & paytables',
      'footer.privacy': 'Privacy notice',
      'footer.terms': 'Terms of use',
      'footer.responsible': 'Responsible play',
      'footer.contact': 'Contact',
      // Dynamic messages
      'msg.catalogCount': 'Showing {visible} of {total} games',
      'msg.shareCopied': 'Baja Casino link copied to clipboard.',
      'msg.shareTitle': 'Baja Casino — Recreational Lounge',
      'msg.shareText': 'Explore slots, blackjack, roulette, and video poker with virtual credits.',
      'msg.dailySuccess': 'Daily UTC bonus claimed (+100 virtual credits)!',
      'msg.dailyAlready': 'Today’s UTC bonus was already claimed. Check back after 00:00 UTC.',
      'msg.dailyOffline': 'Could not reach the server to claim the daily bonus.',
      'msg.authInvalidEmail': 'Please enter a valid email address.',
      'msg.authInvalidPassword': 'Password must be at least 8 characters long.',
      'msg.authSubmitting': 'Submitting request...',
      'msg.authLoginOk': 'Signed in successfully.',
      'msg.authRegisterOk': 'Local account created and guest balance transferred.',
      'msg.authLogoutOk': 'Signed out. Continuing in guest mode.',
      'msg.authError': 'Authentication failed. Please check your credentials.',
      'msg.optInUpdated': 'Public leaderboard preference updated.',
      'msg.localeChanged': 'Language switched to English.',
      'msg.creditsLabel': 'credits',
    },
  };

  /**
   * Procedural Web Audio API Lounge Synthesizer
   * Zero external audio files; respects user gestures, master volume, and clean oscillator teardown.
   */
  class LoungeAudioEngine {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.ambienceGain = null;
      this.roomToneOsc = null;
      this.roomToneFilter = null;
      this.schedulerTimer = null;
      this.stepIndex = 0;
      this.isPlayingAmbience = false;

      this.enabled = this._readBoolPref(STORAGE_KEYS.soundEnabled, STORAGE_KEYS.legacySoundEnabled, true);
      this.track = this._readStringPref(STORAGE_KEYS.track, STORAGE_KEYS.legacyTrack, 'gold-lounge');
      this.volume = this._readNumberPref(STORAGE_KEYS.volume, STORAGE_KEYS.legacyVolume, 0.7);

      this.tracks = {
        'gold-lounge': {
          tempoMs: 540,
          wave: 'sine',
          bassWave: 'triangle',
          notes: [261.63, 329.63, 392.0, 493.88, 440.0, 392.0, 329.63, 293.66],
          bass: [130.81, 130.81, 164.81, 164.81, 146.83, 146.83, 196.0, 196.0],
        },
        'velvet-night': {
          tempoMs: 620,
          wave: 'triangle',
          bassWave: 'sine',
          notes: [220.0, 261.63, 329.63, 392.0, 349.23, 329.63, 293.66, 246.94],
          bass: [110.0, 110.0, 130.81, 130.81, 146.83, 146.83, 164.81, 164.81],
        },
        'midnight-keys': {
          tempoMs: 580,
          wave: 'sine',
          bassWave: 'sine',
          notes: [293.66, 349.23, 440.0, 523.25, 493.88, 440.0, 392.0, 329.63],
          bass: [146.83, 146.83, 174.61, 174.61, 130.81, 130.81, 196.0, 164.81],
        },
        'arcade-lights': {
          tempoMs: 420,
          wave: 'triangle',
          bassWave: 'triangle',
          notes: [329.63, 392.0, 493.88, 659.25, 587.33, 493.88, 392.0, 440.0],
          bass: [164.81, 196.0, 130.81, 164.81, 146.83, 196.0, 130.81, 146.83],
        },
        'neon-nights': {
          tempoMs: 460,
          wave: 'sine',
          bassWave: 'triangle',
          notes: [246.94, 329.63, 369.99, 493.88, 440.0, 369.99, 329.63, 293.66],
          bass: [123.47, 123.47, 164.81, 164.81, 146.83, 146.83, 185.0, 185.0],
        },
      };
    }

    _readBoolPref(primaryKey, legacyKey, fallback) {
      const raw = localStorage.getItem(primaryKey) ?? localStorage.getItem(legacyKey);
      if (raw === null) return fallback;
      return raw === 'true' || raw === '1';
    }

    _readStringPref(primaryKey, legacyKey, fallback) {
      return localStorage.getItem(primaryKey) || localStorage.getItem(legacyKey) || fallback;
    }

    _readNumberPref(primaryKey, legacyKey, fallback) {
      const raw = localStorage.getItem(primaryKey) ?? localStorage.getItem(legacyKey);
      if (raw === null) return fallback;
      const parsed = Number.parseFloat(raw);
      if (!Number.isFinite(parsed)) return fallback;
      return parsed > 1 ? Math.min(1, Math.max(0, parsed / 100)) : Math.min(1, Math.max(0, parsed));
    }

    _savePrefs() {
      localStorage.setItem(STORAGE_KEYS.soundEnabled, String(this.enabled));
      localStorage.setItem(STORAGE_KEYS.legacySoundEnabled, String(this.enabled));
      localStorage.setItem(STORAGE_KEYS.track, this.track);
      localStorage.setItem(STORAGE_KEYS.legacyTrack, this.track);
      localStorage.setItem(STORAGE_KEYS.volume, String(this.volume));
      localStorage.setItem(STORAGE_KEYS.legacyVolume, String(this.volume));
    }

    _ensureContext() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return false;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return true;
    }

    unlockFromGesture() {
      if (!this.enabled) return;
      if (!this._ensureContext()) return;
      if (!this.isPlayingAmbience) {
        this.startAmbience();
      }
    }

    setEnabled(nextEnabled) {
      this.enabled = Boolean(nextEnabled);
      this._savePrefs();
      if (!this.enabled) {
        this.stopAmbience();
      } else if (this._ensureContext()) {
        this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.06);
        this.startAmbience();
      }
    }

    setTrack(trackId) {
      if (!this.tracks[trackId]) return;
      this.track = trackId;
      this.stepIndex = 0;
      this._savePrefs();
      if (this.enabled && this.isPlayingAmbience) {
        this._restartScheduler();
      }
    }

    setVolume(normalizedVolume) {
      this.volume = Math.min(1, Math.max(0, normalizedVolume));
      this._savePrefs();
      if (this.ctx && this.masterGain) {
        const target = this.enabled ? this.volume : 0;
        this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
      }
    }

    startAmbience() {
      if (!this.enabled || !this._ensureContext()) return;
      if (this.isPlayingAmbience) return;

      const now = this.ctx.currentTime;
      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.gain.setValueAtTime(0.0001, now);
      this.ambienceGain.gain.exponentialRampToValueAtTime(0.18, now + 0.65);
      this.ambienceGain.connect(this.masterGain);

      // Warm low room-tone bed
      this.roomToneOsc = this.ctx.createOscillator();
      this.roomToneFilter = this.ctx.createBiquadFilter();
      this.roomToneOsc.type = 'sine';
      this.roomToneOsc.frequency.setValueAtTime(65.41, now); // C2 warm hum
      this.roomToneFilter.type = 'lowpass';
      this.roomToneFilter.frequency.setValueAtTime(160, now);

      const bedGain = this.ctx.createGain();
      bedGain.gain.setValueAtTime(0.16, now);

      this.roomToneOsc.connect(this.roomToneFilter);
      this.roomToneFilter.connect(bedGain);
      bedGain.connect(this.ambienceGain);
      this.roomToneOsc.start(now);

      this.isPlayingAmbience = true;
      this._restartScheduler();
    }

    _restartScheduler() {
      if (this.schedulerTimer) {
        window.clearInterval(this.schedulerTimer);
        this.schedulerTimer = null;
      }
      if (!this.enabled || !this.isPlayingAmbience) return;
      const spec = this.tracks[this.track] || this.tracks['gold-lounge'];
      this._scheduleStep(spec);
      this.schedulerTimer = window.setInterval(() => {
        if (!this.enabled || document.hidden) return;
        this._scheduleStep(spec);
      }, spec.tempoMs);
    }

    _scheduleStep(spec) {
      if (!this.ctx || !this.ambienceGain || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const idx = this.stepIndex % spec.notes.length;
      const noteFreq = spec.notes[idx];
      const bassFreq = spec.bass[idx % spec.bass.length];

      // Restrained lounge lead note
      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();
      osc.type = spec.wave;
      osc.frequency.setValueAtTime(noteFreq, now);

      noteGain.gain.setValueAtTime(0.0001, now);
      noteGain.gain.linearRampToValueAtTime(0.11, now + 0.04);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

      osc.connect(noteGain);
      noteGain.connect(this.ambienceGain);
      osc.start(now);
      osc.stop(now + 0.45);
      osc.onended = () => {
        osc.disconnect();
        noteGain.disconnect();
      };

      // Soft rhythmic bass pulse on even steps
      if (idx % 2 === 0) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = spec.bassWave;
        bassOsc.frequency.setValueAtTime(bassFreq, now);

        bassGain.gain.setValueAtTime(0.0001, now);
        bassGain.gain.linearRampToValueAtTime(0.14, now + 0.03);
        bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);

        bassOsc.connect(bassGain);
        bassGain.connect(this.ambienceGain);
        bassOsc.start(now);
        bassOsc.stop(now + 0.5);
        bassOsc.onended = () => {
          bassOsc.disconnect();
          bassGain.disconnect();
        };
      }

      this.stepIndex += 1;
    }

    stopAmbience() {
      if (this.schedulerTimer) {
        window.clearInterval(this.schedulerTimer);
        this.schedulerTimer = null;
      }
      this.isPlayingAmbience = false;

      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      if (this.ambienceGain) {
        try {
          this.ambienceGain.gain.cancelScheduledValues(now);
          this.ambienceGain.gain.setValueAtTime(Math.max(0.0001, this.ambienceGain.gain.value), now);
          this.ambienceGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
        } catch (_) {
          // Ignore ramp edge cases on suspended contexts
        }
      }

      const oscRef = this.roomToneOsc;
      const filterRef = this.roomToneFilter;
      const gainRef = this.ambienceGain;
      this.roomToneOsc = null;
      this.roomToneFilter = null;
      this.ambienceGain = null;

      window.setTimeout(() => {
        try {
          if (oscRef) {
            oscRef.stop();
            oscRef.disconnect();
          }
          if (filterRef) filterRef.disconnect();
          if (gainRef) gainRef.disconnect();
        } catch (_) {
          // Already stopped/disconnected
        }
      }, 180);
    }

    playCue(kind = 'tap') {
      if (!this.enabled || this.volume <= 0) return;
      if (!this._ensureContext() || this.ctx.state !== 'running') return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      if (kind === 'reward') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.14, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.34);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(kind === 'modal' ? 440 : 587.33, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.07, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.1);
      }

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }
  }

  /**
   * Main Lobby Application State & DOM Controller
   */
  class BajaCasinoLobby {
    constructor() {
      this.locale = this._initLocale();
      this.activeFilter = 'all';
      this.searchQuery = '';
      this.lastDialogTrigger = null;
      this.audio = new LoungeAudioEngine();

      this.state = {
        balance: 1000,
        user: null,
        activeHand: null,
        dailyClaimed: false,
      };
    }

    _initLocale() {
      const saved = localStorage.getItem(STORAGE_KEYS.locale);
      if (saved === 'en' || saved === 'es-MX') return saved;
      const browserLang = (navigator.language || '').toLowerCase();
      return browserLang.startsWith('en') ? 'en' : 'es-MX';
    }

    t(key, vars = {}) {
      const dict = I18N[this.locale] || I18N['es-MX'];
      let template = dict[key] ?? I18N['es-MX'][key] ?? key;
      for (const [k, v] of Object.entries(vars)) {
        template = template.replace(`{${k}}`, String(v));
      }
      return template;
    }

    announce(message) {
      const region = document.getElementById('status-announcer');
      if (!region) return;
      region.textContent = '';
      window.requestAnimationFrame(() => {
        region.textContent = message;
      });
    }

    init() {
      this._bindAudioControls();
      this._bindLocaleSwitcher();
      this._bindCatalogControls();
      this._bindDialogs();
      this._bindWalletActions();
      this._bindAuthAndProfile();

      this.applyLocale(this.locale, false);
      this.filterCatalog(false);
      this.hydrateSession();
      this.loadLeaderboard();
    }

    /* ---------------- Localization ---------------- */

    _bindLocaleSwitcher() {
      const buttons = document.querySelectorAll('[data-set-locale]');
      buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const nextLocale = btn.getAttribute('data-set-locale');
          if (!nextLocale || (nextLocale !== 'es-MX' && nextLocale !== 'en')) return;
          this.audio.playCue('tap');
          this.applyLocale(nextLocale, true);
        });
      });
    }

    applyLocale(locale, shouldAnnounce = true) {
      this.locale = locale;
      localStorage.setItem(STORAGE_KEYS.locale, locale);
      document.documentElement.lang = locale;
      document.documentElement.setAttribute('data-locale', locale);

      document.querySelectorAll('[data-set-locale]').forEach((btn) => {
        const isCurrent = btn.getAttribute('data-set-locale') === locale;
        btn.classList.toggle('is-active', isCurrent);
        btn.setAttribute('aria-pressed', String(isCurrent));
      });

      document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (key) el.textContent = this.t(key);
      });

      document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) el.setAttribute('placeholder', this.t(key));
      });

      this._updateSoundButtonText();
      this._updateDailyButtonText();
      this._updateCatalogCount();

      if (shouldAnnounce) {
        this.announce(this.t('msg.localeChanged'));
      }
    }

    /* ---------------- Shared Audio Controls ---------------- */

    _bindAudioControls() {
      const soundBtn = document.getElementById('sound-toggle');
      const trackSelect = document.getElementById('track-select');
      const volumeSlider = document.getElementById('master-volume');

      if (trackSelect) {
        trackSelect.value = this.audio.track;
        trackSelect.addEventListener('change', () => {
          this.audio.unlockFromGesture();
          this.audio.setTrack(trackSelect.value);
          this.audio.playCue('tap');
        });
      }

      if (volumeSlider) {
        volumeSlider.value = String(Math.round(this.audio.volume * 100));
        volumeSlider.addEventListener('input', () => {
          const val = Number.parseInt(volumeSlider.value, 10) / 100;
          this.audio.setVolume(val);
        });
      }

      if (soundBtn) {
        this._updateSoundButtonText();
        soundBtn.addEventListener('click', () => {
          const next = !this.audio.enabled;
          this.audio.setEnabled(next);
          this._updateSoundButtonText();
          if (next) this.audio.playCue('tap');
        });
      }

      // First user gesture unlocks Web Audio if sound is enabled by default
      const unlockHandler = () => {
        this.audio.unlockFromGesture();
        window.removeEventListener('pointerdown', unlockHandler);
        window.removeEventListener('keydown', unlockHandler);
      };
      window.addEventListener('pointerdown', unlockHandler, { once: true });
      window.addEventListener('keydown', unlockHandler, { once: true });

      document.addEventListener('visibilitychange', () => {
        if (!this.audio.ctx) return;
        if (document.hidden && this.audio.ctx.state === 'running') {
          this.audio.ctx.suspend().catch(() => {});
        } else if (!document.hidden && this.audio.enabled && this.audio.ctx.state === 'suspended') {
          this.audio.ctx.resume().catch(() => {});
        }
      });
    }

    _updateSoundButtonText() {
      const soundBtn = document.getElementById('sound-toggle');
      if (!soundBtn) return;
      soundBtn.setAttribute('aria-pressed', String(this.audio.enabled));
      soundBtn.textContent = this.audio.enabled
        ? this.t('audio.toggleOn')
        : this.t('audio.toggleOff');
    }

    /* ---------------- Catalog Filtering & '/' Search ---------------- */

    _bindCatalogControls() {
      const filterButtons = document.querySelectorAll('.filter-btn[data-filter]');
      const searchInput = document.getElementById('catalog-search');
      const resetBtn = document.getElementById('catalog-reset-btn');

      filterButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const chosen = btn.getAttribute('data-filter') || 'all';
          this.activeFilter = chosen;
          filterButtons.forEach((b) => {
            const active = b === btn;
            b.classList.toggle('is-active', active);
            b.setAttribute('aria-pressed', String(active));
          });
          this.audio.playCue('tap');
          this.filterCatalog(true);
        });
      });

      if (searchInput) {
        searchInput.addEventListener('input', () => {
          this.searchQuery = searchInput.value;
          this.filterCatalog(false);
        });

        searchInput.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' && searchInput.value) {
            event.stopPropagation();
            searchInput.value = '';
            this.searchQuery = '';
            this.filterCatalog(true);
          }
        });
      }

      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.activeFilter = 'all';
          this.searchQuery = '';
          if (searchInput) searchInput.value = '';
          filterButtons.forEach((b) => {
            const isAll = b.getAttribute('data-filter') === 'all';
            b.classList.toggle('is-active', isAll);
            b.setAttribute('aria-pressed', String(isAll));
          });
          this.audio.playCue('tap');
          this.filterCatalog(true);
          if (searchInput) searchInput.focus();
        });
      }

      // Keyboard shortcut '/' focuses search only when not typing in a form control
      document.addEventListener('keydown', (event) => {
        if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
        const active = document.activeElement;
        if (active) {
          const tag = active.tagName;
          if (
            tag === 'INPUT' ||
            tag === 'TEXTAREA' ||
            tag === 'SELECT' ||
            active.isContentEditable
          ) {
            return;
          }
        }
        if (searchInput) {
          event.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
      });
    }

    _normalizeText(value) {
      return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim();
    }

    filterCatalog(announceChange = false) {
      const cards = Array.from(document.querySelectorAll('#catalog-grid .game-card'));
      const emptyState = document.getElementById('catalog-empty');
      const query = this._normalizeText(this.searchQuery);
      let visibleCount = 0;

      cards.forEach((card) => {
        const category = card.getAttribute('data-category') || '';
        const keywords = card.getAttribute('data-keywords') || '';
        const title = card.querySelector('.game-card__title')?.textContent || '';
        const desc = card.querySelector('.game-card__desc')?.textContent || '';
        const searchable = this._normalizeText(`${title} ${desc} ${keywords} ${category}`);

        const matchesCategory = this.activeFilter === 'all' || category === this.activeFilter;
        const matchesQuery = !query || searchable.includes(query);
        const show = matchesCategory && matchesQuery;

        card.hidden = !show;
        if (show) visibleCount += 1;
      });

      if (emptyState) {
        emptyState.hidden = visibleCount > 0;
      }

      const summary = this._updateCatalogCount(visibleCount, cards.length);
      if (announceChange && summary) {
        this.announce(summary);
      }
    }

    _updateCatalogCount(visible, total) {
      const countEl = document.getElementById('catalog-count');
      const cards = document.querySelectorAll('#catalog-grid .game-card');
      const totalCount = typeof total === 'number' ? total : cards.length;
      const visibleCount =
        typeof visible === 'number'
          ? visible
          : Array.from(cards).filter((c) => !c.hidden).length;

      const text = this.t('msg.catalogCount', { visible: visibleCount, total: totalCount });
      if (countEl) countEl.textContent = text;
      return text;
    }

    /* ---------------- Accessible Native <dialog> Modals ---------------- */

    _bindDialogs() {
      document.querySelectorAll('[data-open-dialog]').forEach((trigger) => {
        trigger.addEventListener('click', () => {
          const dialogId = trigger.getAttribute('data-open-dialog');
          const dialog = dialogId ? document.getElementById(dialogId) : null;
          if (!dialog || typeof dialog.showModal !== 'function') return;

          this.lastDialogTrigger = trigger;
          this.audio.playCue('modal');
          dialog.showModal();
        });
      });

      document.querySelectorAll('dialog.legal-dialog').forEach((dialog) => {
        dialog.querySelectorAll('[data-close-dialog]').forEach((closeBtn) => {
          closeBtn.addEventListener('click', () => {
            this.audio.playCue('tap');
            dialog.close();
          });
        });

        // Close on backdrop click
        dialog.addEventListener('click', (event) => {
          if (event.target === dialog) {
            dialog.close();
          }
        });

        // Restore focus to the button that opened the modal
        dialog.addEventListener('close', () => {
          if (this.lastDialogTrigger && typeof this.lastDialogTrigger.focus === 'function') {
            this.lastDialogTrigger.focus();
            this.lastDialogTrigger = null;
          }
        });
      });
    }

    /* ---------------- Wallet, Daily UTC Bonus & Share ---------------- */

    _bindWalletActions() {
      const dailyBtn = document.getElementById('daily-reward-btn');
      const shareBtn = document.getElementById('share-lounge-btn');

      if (dailyBtn) {
        dailyBtn.addEventListener('click', async () => {
          if (dailyBtn.disabled) return;
          dailyBtn.disabled = true;

          try {
            const response = await fetch('/api/daily-reward', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
            });
            const data = await response.json().catch(() => ({}));

            if (response.ok && typeof data.balance === 'number') {
              this.updateBalanceDisplay(data.balance, true);
              this.state.dailyClaimed = true;
              this._updateDailyButtonText();
              this.audio.playCue('reward');
              this.announce(this.t('msg.dailySuccess'));
            } else if (response.status === 409 || data.alreadyClaimed) {
              this.state.dailyClaimed = true;
              this._updateDailyButtonText();
              this.announce(this.t('msg.dailyAlready'));
            } else {
              dailyBtn.disabled = false;
              this.announce(data.error || this.t('msg.dailyOffline'));
            }
          } catch (_) {
            dailyBtn.disabled = false;
            this.announce(this.t('msg.dailyOffline'));
          }
        });
      }

      if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
          this.audio.playCue('tap');
          const shareUrl = window.location.origin + '/';

          if (navigator.share) {
            try {
              await navigator.share({
                title: this.t('msg.shareTitle'),
                text: this.t('msg.shareText'),
                url: shareUrl,
              });
              return;
            } catch (err) {
              if (err && err.name === 'AbortError') return;
            }
          }

          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(shareUrl);
            } else {
              const temp = document.createElement('input');
              temp.value = shareUrl;
              document.body.appendChild(temp);
              temp.select();
              document.execCommand('copy');
              document.body.removeChild(temp);
            }
            this.announce(this.t('msg.shareCopied'));
          } catch (_) {
            this.announce(shareUrl);
          }
        });
      }
    }

    _updateDailyButtonText() {
      const dailyBtn = document.getElementById('daily-reward-btn');
      if (!dailyBtn) return;
      dailyBtn.disabled = this.state.dailyClaimed;
      dailyBtn.textContent = this.state.dailyClaimed
        ? this.t('wallet.dailyClaimed')
        : this.t('wallet.daily');
    }

    updateBalanceDisplay(nextBalance, animate = false) {
      if (!Number.isFinite(nextBalance)) return;
      const previous = this.state.balance;
      this.state.balance = nextBalance;

      const balanceEl = document.getElementById('lobby-balance');
      if (!balanceEl) return;

      balanceEl.textContent = new Intl.NumberFormat(
        this.locale === 'en' ? 'en-US' : 'es-MX'
      ).format(nextBalance);

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (animate && nextBalance > previous && !reducedMotion) {
        balanceEl.classList.remove('is-pulsing');
        void balanceEl.offsetWidth;
        balanceEl.classList.add('is-pulsing');
      }
    }

    /* ---------------- Session Hydration, Accounts & Leaderboard ---------------- */

    async hydrateSession() {
      try {
        const res = await fetch('/api/session', { credentials: 'same-origin' });
        if (!res.ok) return;
        const data = await res.json();

        if (typeof data.balance === 'number') {
          this.updateBalanceDisplay(data.balance, false);
        }
        if (typeof data.dailyRewardClaimed === 'boolean') {
          this.state.dailyClaimed = data.dailyRewardClaimed;
          this._updateDailyButtonText();
        }
        this._renderResumeBanner(data.activeHand || null);
        this._renderUserSession(data.user || null);
      } catch (_) {
        // Keep default 1,000 guest state gracefully if offline
      }
    }

    _renderResumeBanner(activeHand) {
      const banner = document.getElementById('resume-hand-banner');
      const link = document.getElementById('resume-hand-link');
      if (!banner || !link) return;

      if (!activeHand || !activeHand.game) {
        banner.hidden = true;
        return;
      }

      const routeGame =
        activeHand.game === 'video_poker' || activeHand.game === 'video-poker'
          ? 'video-poker'
          : 'blackjack';
      link.setAttribute('href', `/client?game=${encodeURIComponent(routeGame)}`);
      banner.hidden = false;
    }

    _bindAuthAndProfile() {
      const form = document.getElementById('auth-form');
      const logoutBtn = document.getElementById('logout-btn');
      const optInCheckbox = document.getElementById('leaderboard-opt-in');

      if (form) {
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const submitter = event.submitter;
          const intent = submitter && submitter.value === 'register' ? 'register' : 'login';

          const emailInput = document.getElementById('auth-email');
          const passwordInput = document.getElementById('auth-password');
          const nameInput = document.getElementById('auth-display-name');
          const feedback = document.getElementById('auth-feedback');

          const email = (emailInput?.value || '').trim();
          const password = passwordInput?.value || '';
          const displayName = (nameInput?.value || '').trim();

          if (!email || !email.includes('@')) {
            if (feedback) feedback.textContent = this.t('msg.authInvalidEmail');
            emailInput?.focus();
            return;
          }
          if (password.length < 8) {
            if (feedback) feedback.textContent = this.t('msg.authInvalidPassword');
            passwordInput?.focus();
            return;
          }

          if (feedback) feedback.textContent = this.t('msg.authSubmitting');
          const endpoint = intent === 'register' ? '/api/auth/register' : '/api/auth/login';

          try {
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ email, password, displayName }),
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
              if (feedback) feedback.textContent = data.error || this.t('msg.authError');
              return;
            }

            if (passwordInput) passwordInput.value = '';
            if (typeof data.balance === 'number') {
              this.updateBalanceDisplay(data.balance, true);
            }
            this._renderResumeBanner(data.activeHand || null);
            this._renderUserSession(data.user || { email, displayName: displayName || email.split('@')[0] });
            this.audio.playCue('tap');

            const successMsg =
              intent === 'register' ? this.t('msg.authRegisterOk') : this.t('msg.authLoginOk');
            if (feedback) feedback.textContent = successMsg;
            this.announce(successMsg);
            this.loadLeaderboard();
          } catch (_) {
            if (feedback) feedback.textContent = this.t('msg.authError');
          }
        });
      }

      if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
          try {
            const res = await fetch('/api/auth/logout', {
              method: 'POST',
              credentials: 'same-origin',
            });
            const data = await res.json().catch(() => ({}));
            this._renderUserSession(null);
            this._renderResumeBanner(null);
            if (typeof data.balance === 'number') {
              this.updateBalanceDisplay(data.balance, false);
            }
            const feedback = document.getElementById('auth-feedback');
            if (feedback) feedback.textContent = this.t('msg.authLogoutOk');
            this.announce(this.t('msg.authLogoutOk'));
          } catch (_) {
            // Ignore transient network errors
          }
        });
      }

      if (optInCheckbox) {
        optInCheckbox.addEventListener('change', async () => {
          try {
            const res = await fetch('/api/profile/leaderboard', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ optIn: optInCheckbox.checked }),
            });
            if (res.ok) {
              this.audio.playCue('tap');
              this.announce(this.t('msg.optInUpdated'));
              this.loadLeaderboard();
            }
          } catch (_) {
            // Ignore transient network errors
          }
        });
      }
    }

    _renderUserSession(user) {
      this.state.user = user;
      const form = document.getElementById('auth-form');
      const profileCard = document.getElementById('profile-card');
      if (!form || !profileCard) return;

      if (!user) {
        form.hidden = false;
        profileCard.hidden = true;
        return;
      }

      form.hidden = true;
      profileCard.hidden = false;

      const nameEl = document.getElementById('profile-name');
      const emailEl = document.getElementById('profile-email');
      const roundsEl = document.getElementById('stat-rounds');
      const achievementsEl = document.getElementById('stat-achievements');
      const optInEl = document.getElementById('leaderboard-opt-in');

      if (nameEl) nameEl.textContent = user.displayName || user.email || 'Jugador';
      if (emailEl) emailEl.textContent = user.email || '';
      if (roundsEl) roundsEl.textContent = String(user.roundsPlayed ?? 0);
      if (achievementsEl) {
        const achCount = Array.isArray(user.achievements)
          ? user.achievements.length
          : Number(user.achievementsCount ?? 0);
        achievementsEl.textContent = String(achCount);
      }
      if (optInEl) optInEl.checked = Boolean(user.leaderboardOptIn);
    }

    async loadLeaderboard() {
      const list = document.getElementById('leaderboard-list');
      if (!list) return;

      try {
        const res = await fetch('/api/leaderboard', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('leaderboard_unavailable');
        const data = await res.json();
        const entries = Array.isArray(data.entries) ? data.entries : Array.isArray(data) ? data : [];

        list.textContent = '';
        if (entries.length === 0) {
          const emptyLi = document.createElement('li');
          emptyLi.className = 'leaderboard-list__empty';
          emptyLi.textContent = this.t('lb.empty');
          list.appendChild(emptyLi);
          return;
        }

        const formatter = new Intl.NumberFormat(this.locale === 'en' ? 'en-US' : 'es-MX');
        entries.slice(0, 10).forEach((entry, index) => {
          const li = document.createElement('li');
          li.className = 'leaderboard-list__item';

          const rankSpan = document.createElement('span');
          rankSpan.className = 'leaderboard-list__rank tabular-nums';
          rankSpan.textContent = `#${index + 1}`;

          const nameSpan = document.createElement('span');
          nameSpan.className = 'leaderboard-list__name';
          nameSpan.textContent = entry.displayName || 'Player';

          const scoreSpan = document.createElement('strong');
          scoreSpan.className = 'leaderboard-list__score tabular-nums';
          const scoreVal = Number(entry.bestBalance ?? entry.balance ?? 0);
          scoreSpan.textContent = `${formatter.format(scoreVal)} ${this.t('msg.creditsLabel')}`;

          li.append(rankSpan, nameSpan, scoreSpan);
          list.appendChild(li);
        });
      } catch (_) {
        list.textContent = '';
        const emptyLi = document.createElement('li');
        emptyLi.className = 'leaderboard-list__empty';
        emptyLi.textContent = this.t('lb.empty');
        list.appendChild(emptyLi);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const app = new BajaCasinoLobby();
    app.init();
  });
})();
