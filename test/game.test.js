import test from "node:test";
import assert from "node:assert/strict";
import { createGame, parseTurnScore, recordScore, undoScore, validateNames } from "../src/game.js";

test("validates player count, non-empty names, and distinct names", () => {
  assert.equal(validateNames(["Ada"]), "Add between 2 and 8 players.");
  assert.equal(validateNames(["Ada", " "]), "Every player needs a name.");
  assert.equal(validateNames(["Ada", "ada"]), "Player names must be different.");
  assert.equal(validateNames(["Ada", "Lin"]), null);
});

test("accepts only non-negative whole-number turn scores", () => {
  assert.deepEqual(parseTurnScore("0"), { score: 0 });
  assert.deepEqual(parseTurnScore("450"), { score: 450 });
  for (const value of ["", "-1", "1.5", "hello", " 20 "]) {
    assert.ok(parseTurnScore(value).error);
  }
});

test("records zero as a completed turn and advances", () => {
  const state = recordScore(createGame(["Ada", "Lin"]), 0);
  assert.equal(state.schemaVersion, 1);
  assert.deepEqual(state.players.map((player) => player.total), [0, 0]);
  assert.equal(state.currentIndex, 1);
  assert.ok(state.undoState);
});

test("adds a score once and undo restores the complete previous state", () => {
  const before = createGame(["Ada", "Lin", "Bea"]);
  const after = recordScore(before, 650);
  assert.equal(after.players[0].total, 650);
  assert.equal(after.currentIndex, 1);
  assert.deepEqual(undoScore(after), before);
});

test("gives every other player one final turn without returning to the trigger", () => {
  let state = createGame(["Ada", "Lin", "Bea"]);
  state = recordScore(state, 10000);
  assert.equal(state.phase, "final");
  assert.equal(state.scoreToBeat, 10000);
  assert.equal(state.players[state.currentIndex].name, "Lin");
  assert.equal(state.finalTurnsRemaining, 2);

  state = recordScore(state, 11000);
  assert.equal(state.leaderId, "player-2");
  assert.equal(state.scoreToBeat, 11000);
  assert.equal(state.players[state.currentIndex].name, "Bea");

  state = recordScore(state, 12000);
  assert.equal(state.phase, "finished");
  assert.equal(state.winnerId, "player-3");
  assert.equal(state.currentIndex, 2);
});

test("a tie does not displace the existing final-round leader", () => {
  let state = createGame(["Ada", "Lin"]);
  state = recordScore(state, 10000);
  state = recordScore(state, 10000);
  assert.equal(state.phase, "finished");
  assert.equal(state.winnerId, "player-1");
  assert.equal(state.scoreToBeat, 10000);
});

test("undo reverses the final-round trigger and final score", () => {
  const playing = createGame(["Ada", "Lin"]);
  const final = recordScore(playing, 10000);
  assert.deepEqual(undoScore(final), playing);

  const finished = recordScore(final, 11000);
  const restored = undoScore(finished);
  assert.equal(restored.phase, "final");
  assert.equal(restored.leaderId, "player-1");
  assert.equal(restored.finalTurnsRemaining, 1);
});
