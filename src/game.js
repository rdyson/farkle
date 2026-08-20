export const defaultRules = Object.freeze({
  winningScore: 10000,
  openingScore: 500,
  singleFive: true,
  tripleOnes: 1000,
  extendedKinds: "fixed",
  straight: 1500,
  threePairs: 1500,
  fourAndPair: "1500",
  twoTriplets: "2500",
  hotDice: "choice",
  consecutiveFarkles: 0,
});

export function createGame(names, rules = defaultRules) {
  return {
    schemaVersion: 1,
    phase: "playing",
    players: names.map((name, index) => ({ id: `player-${index + 1}`, name: name.trim(), total: 0 })),
    currentIndex: 0,
    rules: { ...defaultRules, ...rules },
    leaderId: null,
    scoreToBeat: null,
    finalTurnsRemaining: null,
    winnerId: null,
    undoState: null,
    collapsed: { howToPlay: true, rules: true },
  };
}

export function validateNames(names) {
  const clean = names.map((name) => name.trim());
  if (clean.length < 2 || clean.length > 8) return "Add between 2 and 8 players.";
  if (clean.some((name) => !name)) return "Every player needs a name.";
  if (new Set(clean.map((name) => name.toLocaleLowerCase())).size !== clean.length) {
    return "Player names must be different.";
  }
  return null;
}

export function parseTurnScore(value) {
  if (!/^\d+$/.test(value)) return { error: "Enter a whole number of zero or more." };
  const score = Number(value);
  if (!Number.isSafeInteger(score)) return { error: "That score is too large." };
  return { score };
}

function snapshot(state) {
  return structuredClone({ ...state, undoState: null });
}

export function recordScore(state, score) {
  if (state.phase === "finished") return state;
  const next = structuredClone(state);
  next.undoState = snapshot(state);
  const player = next.players[next.currentIndex];
  player.total += score;

  if (next.phase === "playing" && player.total >= next.rules.winningScore) {
    next.phase = "final";
    next.leaderId = player.id;
    next.scoreToBeat = player.total;
    next.finalTurnsRemaining = next.players.length - 1;
    next.currentIndex = (next.currentIndex + 1) % next.players.length;
    return next;
  }

  if (next.phase === "final") {
    if (player.total > next.scoreToBeat) {
      next.leaderId = player.id;
      next.scoreToBeat = player.total;
    }
    next.finalTurnsRemaining -= 1;
    if (next.finalTurnsRemaining === 0) {
      next.phase = "finished";
      next.winnerId = next.leaderId;
      return next;
    }
  }

  next.currentIndex = (next.currentIndex + 1) % next.players.length;
  return next;
}

export function undoScore(state) {
  return state.undoState ? structuredClone(state.undoState) : state;
}
