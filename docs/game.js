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
  if (!saved || saved.schemaVersion !== 2 || !hasValidSharedState(saved)
    || !Array.isArray(saved.pendingThrows)
    || saved.pendingThrows.some((points) => !Number.isSafeInteger(points) || points <= 0)) return false;
  const subtotal = saved.pendingThrows.reduce((total, points) => total + points, 0);
  if (!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(saved.players[saved.currentIndex].total + subtotal)) return false;
  if (isSnapshot) return saved.lastTurnSnapshot === null;
  return saved.lastTurnSnapshot === null || isValidVersionTwoState(saved.lastTurnSnapshot, true);
}

const validRuleValues = Object.freeze({
  winningScore: [5000, 10000, 15000, 20000],
  openingScore: [0, 350, 400, 500, 600, 1000],
  singleFive: [true, false],
  tripleOnes: [1000, 300],
  extendedKinds: ["fixed", "multipliers"],
  straight: [1500, 1200, 2000, 2500, 3000, 0],
  threePairs: [1500, 500, 600, 750, 1000, 0],
  fourAndPair: ["1500", "four-only"],
  twoTriplets: ["2500", "separate"],
  hotDice: ["choice", "must-roll"],
  consecutiveFarkles: [0, 500, 1000],
});

function hasValidRules(rules) {
  return rules && typeof rules === "object"
    && Object.entries(validRuleValues).every(([key, values]) => values.includes(rules[key]));
}

function hasValidSharedState(saved) {
  return saved && Array.isArray(saved.players) && saved.players.length >= 2
    && saved.players.every((player) => typeof player?.id === "string" && typeof player.name === "string"
      && Number.isSafeInteger(player.total) && player.total >= 0)
    && Number.isInteger(saved.currentIndex) && saved.currentIndex >= 0 && saved.currentIndex < saved.players.length
    && ["playing", "final", "finished"].includes(saved.phase)
    && hasValidRules(saved.rules)
    && saved.collapsed && typeof saved.collapsed.howToPlay === "boolean" && typeof saved.collapsed.rules === "boolean";
}

function isValidVersionOneState(saved) {
  if (saved?.schemaVersion !== 1 || !hasValidSharedState(saved)
    || "pendingThrows" in saved || "lastTurnSnapshot" in saved
    || !(saved.undoState === null || (saved.undoState && typeof saved.undoState === "object"))) return false;
  const leaderExists = saved.players.some((player) => player.id === saved.leaderId);
  if (saved.phase === "playing") {
    return saved.leaderId === null && saved.scoreToBeat === null && saved.finalTurnsRemaining === null && saved.winnerId === null;
  }
  if (!leaderExists || !Number.isSafeInteger(saved.scoreToBeat) || saved.scoreToBeat < 0
    || !Number.isInteger(saved.finalTurnsRemaining)) return false;
  if (saved.phase === "final") {
    return saved.finalTurnsRemaining > 0 && saved.finalTurnsRemaining < saved.players.length && saved.winnerId === null;
  }
  return saved.finalTurnsRemaining === 0 && saved.players.some((player) => player.id === saved.winnerId);
}

export function migrateGame(saved) {
  if (isValidVersionTwoState(saved)) return structuredClone(saved);
  if (!isValidVersionOneState(saved)) {
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
