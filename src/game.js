export const defaultRules = Object.freeze({
  winningScore: 10000,
  openingScore: 0,
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
    schemaVersion: 2,
    phase: "playing",
    players: names.map((name, index) => ({ id: `player-${index + 1}`, name: name.trim(), total: 0 })),
    currentIndex: 0,
    rules: { ...defaultRules, ...rules },
    leaderId: null,
    scoreToBeat: null,
    finalTurnsRemaining: null,
    winnerId: null,
    pendingThrows: [],
    lastTurnSnapshot: null,
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

export function parseThrowScore(value) {
  if (!/^\d+$/.test(value) || Number(value) <= 0) return { error: "Enter a positive whole number." };
  const points = Number(value);
  if (!Number.isSafeInteger(points)) return { error: "That score is too large." };
  return { points };
}

export function unbankedSubtotal(state) {
  return state.pendingThrows.reduce((total, points) => total + points, 0);
}

export function tryAddThrow(state, points) {
  if (state.phase === "finished") return { game: state, error: "This game is finished." };
  const subtotal = unbankedSubtotal(state);
  const playerTotal = state.players[state.currentIndex].total;
  if (!Number.isSafeInteger(points) || points <= 0 || !Number.isSafeInteger(subtotal + points) || !Number.isSafeInteger(playerTotal + subtotal + points)) {
    return { game: state, error: "That score would be too large." };
  }
  const next = structuredClone(state);
  next.pendingThrows.push(points);
  next.lastTurnSnapshot = null;
  return { game: next };
}

function isValidVersionTwoState(saved, isSnapshot = false) {
  if (!saved || saved.schemaVersion !== 2 || !Array.isArray(saved.players) || saved.players.length < 2
    || !Number.isInteger(saved.currentIndex) || saved.currentIndex < 0 || saved.currentIndex >= saved.players.length
    || !["playing", "final", "finished"].includes(saved.phase)
    || saved.players.some((player) => !Number.isSafeInteger(player?.total) || player.total < 0)
    || !Array.isArray(saved.pendingThrows)
    || saved.pendingThrows.some((points) => !Number.isSafeInteger(points) || points <= 0)) return false;
  const subtotal = saved.pendingThrows.reduce((total, points) => total + points, 0);
  if (!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(saved.players[saved.currentIndex].total + subtotal)) return false;
  if (isSnapshot) return saved.lastTurnSnapshot === null;
  return saved.lastTurnSnapshot === null || isValidVersionTwoState(saved.lastTurnSnapshot, true);
}

export function migrateGame(saved) {
  if (!saved || !Array.isArray(saved.players) || saved.players.length < 2) {
    throw new Error("The saved game has an unknown format. Start a new game to replace it.");
  }
  if (isValidVersionTwoState(saved)) return structuredClone(saved);
  if (saved.schemaVersion !== 1) {
    throw new Error("The saved game has an unknown format. Start a new game to replace it.");
  }
  const { undoState: _undoState, ...rest } = saved;
  return { ...structuredClone(rest), schemaVersion: 2, pendingThrows: [], lastTurnSnapshot: null };
}

function snapshot(state) {
  return structuredClone({ ...state, lastTurnSnapshot: null });
}

export function undoLastThrow(state) {
  if (state.phase === "finished" || state.pendingThrows.length === 0) return state;
  const next = structuredClone(state);
  next.pendingThrows.pop();
  next.lastTurnSnapshot = null;
  return next;
}

function completeTurn(state, points, mayStartFinalRound) {
  const next = structuredClone(state);
  next.lastTurnSnapshot = snapshot(state);
  next.pendingThrows = [];
  const player = next.players[next.currentIndex];
  player.total += points;

  if (mayStartFinalRound && next.phase === "playing" && player.total >= next.rules.winningScore) {
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

export function bankTurn(state) {
  const subtotal = unbankedSubtotal(state);
  if (state.phase === "finished" || subtotal === 0) return state;
  return completeTurn(state, subtotal, true);
}

export function farkleTurn(state) {
  if (state.phase === "finished") return state;
  return completeTurn(state, 0, false);
}

export function undoLastTurn(state) {
  if (!state.lastTurnSnapshot) return state;
  return structuredClone({ ...state.lastTurnSnapshot, lastTurnSnapshot: null });
}
