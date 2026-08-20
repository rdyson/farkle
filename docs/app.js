import { createGame, defaultRules, parseTurnScore, recordScore, undoScore, validateNames } from "./game.js";

const storageKey = "farkle-scorekeeper-v1";
const options = {
  winningScore: [
    [10000, "10,000 — reach or exceed"], [5000, "5,000"], [15000, "15,000"], [20000, "20,000"],
  ],
  openingScore: [[0, "No opening minimum"], [350, "350 before the first bank"], [400, "400 before the first bank"], [500, "500 before the first bank"], [600, "600 before the first bank"], [1000, "1,000 before the first bank"]],
  singleFive: [[true, "Single 1 = 100; single 5 = 50"], [false, "No single 5"]],
  tripleOnes: [[1000, "Three 1s = 1,000"], [300, "Three 1s = 300"]],
  extendedKinds: [["fixed", "Four / five / six = 1,000 / 2,000 / 3,000"], ["multipliers", "Multiply the triple score"]],
  straight: [[1500, "Straight = 1,500"], [1200, "1,200"], [2000, "2,000"], [2500, "2,500"], [3000, "3,000"], [0, "No special score"]],
  threePairs: [[1500, "Three pairs = 1,500"], [500, "500"], [600, "600"], [750, "750"], [1000, "1,000"], [0, "No special score"]],
  fourAndPair: [["1500", "Four of a kind + pair = 1,500"], ["four-only", "Score only the four of a kind"]],
  twoTriplets: [["2500", "Two triplets = 2,500"], ["separate", "Score each triplet separately"]],
  hotDice: [["choice", "Hot dice: bank or roll all six"], ["must-roll", "Hot dice: must roll all six"]],
  consecutiveFarkles: [[0, "Three Farkles: no extra penalty"], [500, "Lose 500"], [1000, "Lose 1,000"]],
};
const labels = {
  winningScore: "Winning score", openingScore: "Opening score", singleFive: "Single 1 / single 5",
  tripleOnes: "Three of a kind", extendedKinds: "Four, five, or six of a kind", straight: "Straight, 1–6",
  threePairs: "Three pairs", fourAndPair: "Four of a kind plus a pair", twoTriplets: "Two triplets",
  hotDice: "Hot dice", consecutiveFarkles: "Three consecutive Farkles",
};

let storageError = null;
let game = loadGame();
let setupNames = ["", ""];
const elements = Object.fromEntries([...document.querySelectorAll("[id]")].map((node) => [node.id, node]));

function loadGame() {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) return null;
  try {
    const saved = JSON.parse(raw);
    if (saved?.schemaVersion !== 1 || !Array.isArray(saved.players) || saved.players.length < 2) {
      throw new Error("The saved game has an unknown format. Start a new game to replace it.");
    }
    return saved;
  } catch (error) {
    storageError = error instanceof SyntaxError
      ? "The saved game is unreadable. Start a new game to replace it."
      : error.message;
    return null;
  }
}

function saveGame() {
  if (game) localStorage.setItem(storageKey, JSON.stringify(game));
  else localStorage.removeItem(storageKey);
}

function renderPlayerFields() {
  elements["player-fields"].replaceChildren(...setupNames.map((name, index) => {
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML = `<span aria-hidden="true">${index + 1}</span><label><span class="sr-only">Player ${index + 1} name</span><input maxlength="30" autocomplete="off" value="${escapeHtml(name)}" placeholder="Player ${index + 1}"></label>${setupNames.length > 2 ? '<button type="button" aria-label="Remove player">×</button>' : ""}`;
    row.querySelector("input").addEventListener("input", (event) => { setupNames[index] = event.target.value; });
    row.querySelector("button")?.addEventListener("click", () => { setupNames.splice(index, 1); renderPlayerFields(); });
    return row;
  }));
  elements["player-count"].textContent = `${setupNames.length} / 8`;
  elements["add-player"].hidden = setupNames.length >= 8;
}

function renderRuleFields() {
  elements["rule-fields"].replaceChildren(...Object.entries(options).map(([key, choices]) => {
    const label = document.createElement("label");
    label.textContent = labels[key];
    const select = document.createElement("select");
    select.name = key;
    for (const [value, text] of choices) {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = text;
      option.selected = String(defaultRules[key]) === String(value);
      select.append(option);
    }
    label.append(select);
    return label;
  }));
}

function readRules() {
  return Object.fromEntries(Object.entries(options).map(([key, choices]) => {
    const raw = new FormData(elements["setup-form"]).get(key);
    const match = choices.find(([value]) => String(value) === raw);
    return [key, match[0]];
  }));
}

function ruleText(key, value) {
  return options[key].find(([candidate]) => String(candidate) === String(value))?.[1] ?? String(value);
}

function renderSelectedRules() {
  const rules = game?.rules ?? readRules();
  elements["selected-rules"].innerHTML = `<p class="preset-name">Common house rules</p><dl>${Object.entries(rules).map(([key, value]) => `<div><dt>${labels[key]}</dt><dd>${ruleText(key, value)}</dd></div>`).join("")}</dl><p class="muted">These choices are informational. Enter the score agreed at the table.</p>`;
}

function renderGame() {
  const active = Boolean(game);
  elements["setup-screen"].hidden = active;
  elements["game-screen"].hidden = !active;
  elements["new-game"].hidden = !active;
  if (!active) {
    elements["storage-error"].textContent = storageError ?? "";
    renderSelectedRules();
    return;
  }

  const current = game.players[game.currentIndex];
  const leader = game.players.find((player) => player.id === game.leaderId);
  const winner = game.players.find((player) => player.id === game.winnerId);
  elements["game-banner"].className = `game-banner ${game.phase}`;
  if (game.phase === "playing") {
    elements["phase-label"].textContent = `First to ${game.rules.winningScore.toLocaleString()}`;
    elements["turn-heading"].innerHTML = `${escapeHtml(current.name)}<span>’s turn</span>`;
    elements["score-to-beat"].textContent = "Roll brave. Bank smart.";
  } else if (game.phase === "final") {
    elements["phase-label"].textContent = `Final round · ${game.finalTurnsRemaining} ${game.finalTurnsRemaining === 1 ? "turn" : "turns"} left`;
    elements["turn-heading"].innerHTML = `${escapeHtml(current.name)}<span>can steal it</span>`;
    elements["score-to-beat"].textContent = `${leader.name} leads. Score to beat: ${game.scoreToBeat.toLocaleString()}`;
  } else {
    elements["phase-label"].textContent = "We have a winner";
    elements["turn-heading"].innerHTML = `${escapeHtml(winner.name)}<span>takes the glory!</span>`;
    elements["score-to-beat"].textContent = `Winning score: ${winner.total.toLocaleString()}`;
  }

  elements.scoreboard.replaceChildren(...game.players.map((player, index) => {
    const item = document.createElement("li");
    const isCurrent = game.phase !== "finished" && index === game.currentIndex;
    const isLeader = game.phase !== "playing" && player.id === game.leaderId;
    const isWinner = player.id === game.winnerId;
    item.className = [isCurrent && "current", isLeader && "leader", isWinner && "winner"].filter(Boolean).join(" ");
    item.innerHTML = `<span class="place">${index + 1}</span><span class="player-name">${escapeHtml(player.name)}${isLeader ? '<small>Leader</small>' : ""}</span><strong>${player.total.toLocaleString()}</strong>`;
    return item;
  }));
  elements["score-form"].hidden = game.phase === "finished";
  elements.undo.hidden = !game.undoState;
  elements["how-to-play"].open = !game.collapsed.howToPlay;
  elements["rules-summary"].open = !game.collapsed.rules;
  renderSelectedRules();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

elements["add-player"].addEventListener("click", () => { if (setupNames.length < 8) { setupNames.push(""); renderPlayerFields(); } });
elements["setup-form"].addEventListener("submit", (event) => {
  event.preventDefault();
  const error = validateNames(setupNames);
  elements["setup-error"].textContent = error ?? "";
  if (error) return;
  game = createGame(setupNames, readRules());
  saveGame();
  renderGame();
  elements["turn-score"].focus();
});
elements["score-form"].addEventListener("submit", (event) => {
  event.preventDefault();
  const result = parseTurnScore(elements["turn-score"].value);
  elements["score-error"].textContent = result.error ?? "";
  if (result.error) return;
  game = recordScore(game, result.score);
  elements["turn-score"].value = "";
  saveGame();
  renderGame();
  if (game.phase !== "finished") elements["turn-score"].focus();
});
elements.undo.addEventListener("click", () => { game = undoScore(game); saveGame(); renderGame(); elements["turn-score"].focus(); });
elements["new-game"].addEventListener("click", () => elements["new-game-dialog"].showModal());
elements["confirm-new-game"].addEventListener("click", () => { game = null; storageError = null; saveGame(); setupNames = ["", ""]; renderPlayerFields(); renderGame(); });
for (const [id, key] of [["how-to-play", "howToPlay"], ["rules-summary", "rules"]]) {
  elements[id].querySelector("summary").addEventListener("click", () => {
    if (!game) return;
    game.collapsed[key] = elements[id].open;
    saveGame();
  });
}

renderPlayerFields();
renderRuleFields();
renderGame();
