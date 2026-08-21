import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  bankTurn,
  farkleTurn,
  migrateGame,
  parseThrowScore,
  tryAddThrow,
  unbankedSubtotal,
  undoLastThrow,
  undoLastTurn,
  validateNames,
} from "../src/game.js";

test("validates player count, non-empty names, and distinct names", () => {
  assert.equal(validateNames(["Ada"]), "Add between 2 and 8 players.");
  assert.equal(validateNames(["Ada", " "]), "Every player needs a name.");
  assert.equal(validateNames(["Ada", "ada"]), "Player names must be different.");
  assert.equal(validateNames(["Ada", "Lin"]), null);
});

function add(state, ...values) {
  return values.reduce((game, points) => tryAddThrow(game, points).game, state);
}

test("rejects unsafe ledger and resulting-total arithmetic without mutation", () => {
  const subtotalRisk = add(createGame(["Ada", "Lin"]), Number.MAX_SAFE_INTEGER - 100);
  const subtotalResult = tryAddThrow(subtotalRisk, 101);
  assert.equal(subtotalResult.game, subtotalRisk);
  assert.ok(subtotalResult.error);

  const totalRisk = add(createGame(["Ada", "Lin"]), 300);
  totalRisk.players[0].total = Number.MAX_SAFE_INTEGER - 500;
  const totalResult = tryAddThrow(totalRisk, 250);
  assert.equal(totalResult.game, totalRisk);
  assert.ok(totalResult.error);
});

test("undoes only the newest pending throw and clears completed-turn undo", () => {
  const beforeBank = add(createGame(["Ada", "Lin"]), 100);
  const afterBank = bankTurn(beforeBank);
  let state = undoLastTurn(afterBank);
  state = bankTurn(state);
  state = tryAddThrow(state, 300).game;
  assert.equal(state.lastTurnSnapshot, null);
  state = tryAddThrow(state, 250).game;
  state = undoLastThrow(state);
  assert.deepEqual(state.pendingThrows, [300]);
  assert.equal(state.currentIndex, 1);
  assert.deepEqual(state.players.map(({ total }) => total), [100, 0]);
});

test("banks a derived subtotal once and restores the complete pre-bank state", () => {
  const before = add(createGame(["Ada", "Lin"]), 300, 250);
  const after = bankTurn(before);
  assert.deepEqual(after.players.map(({ total }) => total), [550, 0]);
  assert.deepEqual(after.pendingThrows, []);
  assert.equal(after.currentIndex, 1);
  assert.deepEqual(undoLastTurn(after), before);
});

test("farkles with an empty or populated ledger and restores a mistaken Farkle", () => {
  const empty = createGame(["Ada", "Lin"]);
  assert.equal(farkleTurn(empty).currentIndex, 1);
  const before = add(empty, 300, 250);
  const after = farkleTurn(before);
  assert.deepEqual(after.players.map(({ total }) => total), [0, 0]);
  assert.deepEqual(after.pendingThrows, []);
  assert.equal(after.currentIndex, 1);
  assert.deepEqual(undoLastTurn(after), before);
});

test("migrates schema version 1 without changing established game state", () => {
  const legacy = { ...createGame(["Ada", "Lin"]), schemaVersion: 1, undoState: { ignored: true } };
  delete legacy.pendingThrows;
  delete legacy.lastTurnSnapshot;
  legacy.currentIndex = 1;
  legacy.players[0].total = 700;
  const migrated = migrateGame(legacy);
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(migrated.pendingThrows, []);
  assert.equal(migrated.lastTurnSnapshot, null);
  assert.equal(migrated.currentIndex, 1);
  assert.equal(migrated.players[0].total, 700);
  assert.equal("undoState" in migrated, false);
});

test("rejects malformed version-2 ledgers and completed-turn snapshots", () => {
  const unsafeLedger = createGame(["Ada", "Lin"]);
  unsafeLedger.pendingThrows = [Number.MAX_SAFE_INTEGER, 1];
  assert.throws(() => migrateGame(unsafeLedger), /unknown format/);

  const malformedSnapshot = createGame(["Ada", "Lin"]);
  malformedSnapshot.lastTurnSnapshot = { ...createGame(["Ada", "Lin"]), lastTurnSnapshot: { nested: true } };
  assert.throws(() => migrateGame(malformedSnapshot), /unknown format/);
});

test("runs the final round through Bank and Farkle and preserves strict-higher ties", () => {
  let state = add(createGame(["Ada", "Lin", "Bea"]), 10000);
  state = bankTurn(state);
  assert.equal(state.phase, "final");
  assert.equal(state.finalTurnsRemaining, 2);

  state = add(state, 10000);
  state = bankTurn(state);
  assert.equal(state.leaderId, "player-1");
  assert.equal(state.finalTurnsRemaining, 1);

  const preFinish = add(state, 10001);
  state = bankTurn(preFinish);
  assert.equal(state.phase, "finished");
  assert.equal(state.winnerId, "player-3");
  assert.deepEqual(undoLastTurn(state), preFinish);

  state = farkleTurn(preFinish);
  assert.equal(state.phase, "finished");
  assert.equal(state.winnerId, "player-1");
});

test("finished games accept only undo last turn", () => {
  let state = add(createGame(["Ada", "Lin"], { winningScore: 100 }), 100);
  state = bankTurn(state);
  state = farkleTurn(state);
  assert.equal(state.phase, "finished");
  assert.equal(tryAddThrow(state, 50).game, state);
  assert.equal(bankTurn(state), state);
  assert.equal(farkleTurn(state), state);
  assert.equal(undoLastThrow(state), state);
  assert.equal(undoLastTurn(state).phase, "final");
});

test("adds positive safe whole-number throws without ending the turn", () => {
  assert.deepEqual(parseThrowScore("450"), { points: 450 });
  for (const value of ["", "0", "-1", "1.5", "hello", " 20 ", String(Number.MAX_SAFE_INTEGER + 1)]) {
    assert.ok(parseThrowScore(value).error);
  }
  const original = createGame(["Ada", "Lin"]);
  const first = tryAddThrow(original, 300);
  const second = tryAddThrow(first.game, 250);
  assert.deepEqual(second.game.pendingThrows, [300, 250]);
  assert.equal(unbankedSubtotal(second.game), 550);
  assert.equal(second.game.players[0].total, 0);
  assert.equal(second.game.currentIndex, 0);
  assert.deepEqual(original.pendingThrows, []);
});
