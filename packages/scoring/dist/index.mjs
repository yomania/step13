// src/shanten.ts
function calculateShanten(hand) {
  if (hand.length < 13) return Infinity;
  const counts = {};
  hand.forEach((t) => {
    const key = `${t.suit}${t.rank}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  return 0;
}
function isTenpai(hand) {
  return calculateShanten(hand) <= 0;
}
export {
  calculateShanten,
  isTenpai
};
