(() => {
  function create({ synth, Utterance, playCue, isSoundEnabled, getVolume, onVoiceStatus }) {
    let voiceEnabled = false;
    let activeUtterance;

    function canPlayVoice() {
      return voiceEnabled && synth && Utterance && isSoundEnabled() && getVolume() > 0;
    }

    function stopVoice() {
      if (!activeUtterance) return;
      synth.cancel();
      activeUtterance = undefined;
    }

    function speak(message, { echo, rate = 0.82, pitch = 1.48 } = {}) {
      if (!canPlayVoice()) return;
      try {
        const voice = synth.getVoices().find((item) => item.localService && /^en(?:-|$)/i.test(item.lang));
        if (!voice) {
          console.warn("No on-device English voice is available for bonus announcements.");
          onVoiceStatus("No on-device English voice available.");
          return;
        }
        onVoiceStatus("");
        stopVoice();
        const utterance = new Utterance(message);
        utterance.voice = voice;
        utterance.volume = Math.min(1, Math.max(0, getVolume()));
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.onend = () => {
          if (activeUtterance !== utterance) return;
          activeUtterance = undefined;
          if (echo && canPlayVoice()) {
            try {
              const repeat = new Utterance(echo);
              repeat.voice = voice;
              repeat.volume = Math.min(1, Math.max(0, getVolume())) * 0.35;
              repeat.rate = 0.72;
              repeat.pitch = 0.72;
              repeat.onend = () => { if (activeUtterance === repeat) activeUtterance = undefined; };
              repeat.onerror = (event) => {
                if (activeUtterance === repeat) activeUtterance = undefined;
                if (event.error !== "canceled" && event.error !== "interrupted") {
                  console.warn("Could not repeat the bonus announcement:", event.error);
                  onVoiceStatus("Arcade voice could not play.");
                }
              };
              activeUtterance = repeat;
              synth.speak(repeat);
            } catch (error) {
              activeUtterance = undefined;
              console.warn("Could not repeat the bonus announcement:", error);
              onVoiceStatus("Arcade voice could not play.");
            }
          }
        };
        utterance.onerror = (event) => {
          if (activeUtterance === utterance) activeUtterance = undefined;
          if (event.error !== "canceled" && event.error !== "interrupted") {
            console.warn("Could not announce the bonus:", event.error);
            onVoiceStatus("Arcade voice could not play.");
          }
        };
        activeUtterance = utterance;
        synth.speak(utterance);
      } catch (error) {
        activeUtterance = undefined;
        console.warn("Could not announce the bonus:", error);
        onVoiceStatus("Arcade voice could not play.");
      }
    }

    function announce(result) {
      const puzzle = result.bonusPayout > 0;
      const wheel = result.fortuneWheel?.triggered === true;
      if ((!puzzle && !wheel) || !isSoundEnabled() || getVolume() <= 0) return;
      playCue("bonus");
      speak(puzzle && wheel ? "Puzzle bonus and fortune wheel bonus!"
        : puzzle ? "Puzzle bonus!" : "Fortune wheel bonus!");
    }

    function announceAward(wheel) {
      if (!wheel?.triggered || !isSoundEnabled() || getVolume() <= 0) return;
      playCue("bonus");
      if (wheel.multiplier === 2) {
        speak("Dooouble! Two times the line bet!", { echo: "Double!", rate: 0.72, pitch: 1.72 });
      } else {
        speak(`${wheel.multiplier} times the line bet!`, {
          rate: wheel.multiplier >= 8 ? 0.74 : 0.82,
          pitch: wheel.multiplier >= 8 ? 1.68 : 1.45,
        });
      }
    }

    function announceOutcome({ game, outcome, net, payout }) {
      if (!canPlayVoice()) return;
      const won = Number(net) > 0;
      const amount = Number.isFinite(Number(payout)) ? Number(payout).toLocaleString("en-US") : "";
      let message;
      let delivery;

      if (game === "blackjack") {
        if (outcome === "blackjack") {
          message = "Blaaackjack! Dealer defeated!";
          delivery = { rate: 0.72, pitch: 1.75 };
        } else if (outcome === "win") {
          message = "Viiictory! You beat the dealer!";
          delivery = { rate: 0.78, pitch: 1.58 };
        } else if (outcome === "bust") {
          message = "Buuust! Round over!";
          delivery = { rate: 0.68, pitch: 0.82 };
        } else if (outcome === "push") {
          message = "Push! The battle is even!";
          delivery = { rate: 0.9, pitch: 1.3 };
        } else {
          message = "Dealer takes the round!";
          delivery = { rate: 0.78, pitch: 0.95 };
        }
      } else if (game === "poker") {
        message = won
          ? `${outcome}! Power hand! ${amount} credits!`
          : "No match! Round complete!";
        delivery = won ? { rate: 0.75, pitch: 1.62 } : { rate: 0.86, pitch: 1.02 };
      } else if (game === "roulette") {
        message = won ? `Direct hit! ${amount} credits!` : "Wheel result locked! Try the next spin!";
        delivery = won ? { rate: 0.72, pitch: 1.7 } : { rate: 0.88, pitch: 1.08 };
      } else if (game === "dice") {
        message = won ? `Exact hit! ${amount} credits!` : "The die has spoken! Round over!";
        delivery = won ? { rate: 0.7, pitch: 1.72 } : { rate: 0.82, pitch: 1.05 };
      } else if (game === "coin") {
        message = won ? `Coin flip victory! ${amount} credits!` : "Other side wins the round!";
        delivery = won ? { rate: 0.72, pitch: 1.68 } : { rate: 0.82, pitch: 1.02 };
      } else if (game === "slots" && won) {
        message = `Biiig reel win! ${amount} credit payout!`;
        delivery = { rate: 0.76, pitch: 1.62 };
      } else {
        return;
      }

      speak(message, delivery);
    }

    return {
      announce,
      announceAward,
      announceOutcome,
      stopVoice,
      setVoiceEnabled(enabled) {
        voiceEnabled = enabled;
        if (!enabled) {
          stopVoice();
          onVoiceStatus("");
        }
      },
    };
  }

  window.LuckyBonusAudio = { create };
})();
