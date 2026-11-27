(() => {
  const getSlotPresentationForBet = (bet) =>
    Number(bet) >= 8
      ? "slots-3d"
      : Number(bet) >= 4
        ? "mechanical-slots"
        : "slots";

  window.LuckySlotPresentation = { getSlotPresentationForBet };
})();
