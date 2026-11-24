// Simple Elo for the in-app puzzle rating.
export function expected(a, b) {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

export function updateRating(rating, puzzleRating, solved, gamesPlayed) {
  const k = gamesPlayed < 20 ? 40 : gamesPlayed < 100 ? 24 : 16;
  const delta = Math.round(k * ((solved ? 1 : 0) - expected(rating, puzzleRating)));
  return { rating: Math.max(100, rating + delta), delta };
}
