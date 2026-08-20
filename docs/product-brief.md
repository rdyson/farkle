# Farkle scorekeeper — v1.2 product brief

## Spirit

Make an in-person Farkle game easier to run without replacing the dice, table talk, or house rules. The scorekeeper must stay simple enough that one shared device can replace pencil and paper. It should feel loud, playful, and celebratory rather than like an accounting tool.

Success means players can start a game quickly, enter each turn's score, see the score to beat, and finish the final round without doing arithmetic or debating the configured rules.

V1 deliberately excludes accounts, a server, remote or live multiplayer, automated dice scoring, roll entry, player statistics, and game history across multiple named games.

## Product brief

- Ship a static web app at `farkle.rdyson.dev`.
- Ask for player names when a game starts. Require at least two players.
- Keep players in a visible turn order and maintain a running total for each player.
- Let the operator enter a non-negative score for the current turn. Add it to that player's running total.
- Treat a Farkle as a turn score of zero. Do not model dice or validate how the score was earned.
- Let the operator correct the most recent score entry through an undo action.
- Persist the active game, player order, totals, current player, final-round state, selected rules, and collapsed-section state in browser-local storage.
- Restore that state after a refresh or browser restart on the same device.
- Provide a clear New Game action. Require confirmation when it would erase an active game.
- Show separate collapsible `How to Play` and `Rules` sections.
- Do not show a `Table guide` control or focused guide modal/dialog. Keep all help in the separate below-setup `How to Play` and `Rules` sections.
- Show the active house-rule choices in `Rules`. Let players change them before a game starts.
- Use the hero tagline `Roll bold. Bank bigger. Farkle.`
- Use the hero subtitle `A scorekeeper for Farkle, a six-dice game for 2–8 players.`
- Use an over-the-top visual style with strong contrast, large scores, dramatic turn and winner states, and restrained motion that does not block score entry.
- Use the static GitHub Pages deployment in `~/Code/personal/howbigisit` as the deployment reference.

## Game end

The winning threshold defaults to 10,000. If players select 5,000, 15,000, or 20,000, that selected threshold replaces the default. A player who first reaches or exceeds the selected threshold becomes the leader and starts the final round. Record that player's total as the score to beat.

Every other player gets exactly one final turn. The triggering player does not get another turn. A challenger takes the lead only by exceeding the current score to beat. If a challenger does so, update the score to beat, but do not grant new turns or restart the final round. After all eligible players finish their final turn, the player with the highest score wins. A tie does not displace the existing leader.

## Recommended rule choices

The app does not validate manually entered scores against scoring-combination or opening-score choices. It records those choices and explains them. The selected winning threshold does control when the final round begins.

| Rule | Recommended default | Selectable alternatives |
| --- | --- | --- |
| Winning score | 10,000; reach or exceed | 5,000; 15,000; 20,000 |
| Opening score | None; players may bank any first-turn score | 350; 400; 500; 600; 1,000 |
| Single 1 / single 5 | 100 / 50 | No single 5 |
| Three of a kind | Three 1s = 1,000; other triples = face value × 100 | Three 1s = 300 |
| Four, five, or six of a kind | 1,000 / 2,000 / 3,000 | Multipliers based on the triple score |
| Straight, 1–6 | 1,500 | 1,200; 2,000; 2,500; 3,000; no special score |
| Three pairs | 1,500 | 500; 600; 750; 1,000; no special score |
| Four of a kind plus a pair | 1,500 | Score only the four of a kind |
| Two triplets | 2,500 | Score each triplet separately |
| Hot dice | Player may bank or roll all six again | Player must roll all six again |
| Three consecutive Farkles | No penalty beyond each lost turn | Lose 500; lose 1,000 |

These defaults use the widely recognized 1,000-point score for three 1s while otherwise staying close to PlayMonster's published combination table. PlayMonster's sheet unusually assigns three 1s only 300 points, while other common summaries use 1,000. The app should label its preset `Common house rules`, not `Official rules`.

Do not include Toxic Twos, High Stakes/Greed, Welfare/exact finish, instant-win six 1s, teams, timers, or five-dice play in v1. These variants add explanation and configuration without helping the core scorekeeping job.

## Acceptance criteria

1. A new visitor can enter at least two non-empty, distinct player names and start a game.
2. The game screen always identifies the current player and shows every player's running total.
3. Entering a valid non-negative integer adds that value once to the current player's total and advances the turn.
4. Empty, negative, decimal, and non-numeric entries do not change game state and produce a clear inline message.
5. Entering zero records a completed turn, leaves the total unchanged, and advances the turn.
6. Undo restores the complete state before the most recent score entry, including totals, current player, and final-round state.
7. Refreshing or reopening the site on the same browser restores the active game exactly.
8. New Game warns before replacing an active game and clears it only after confirmation.
9. The released header `Table guide` control and its focused modal/dialog do not exist in the interface or application behavior. They are removed, not hidden.
10. `How to Play` and `Rules` remain separate, keyboard-operable collapsible sections.
11. `How to Play` explains the six-dice turn loop: the first listed player starts; play follows entered order; each roll must set aside at least one scoring die or combination; the player may bank or reroll the remaining dice; a Farkle loses only that turn's unbanked points; and combinations cannot be built across rolls.
12. `How to Play` explains the selected hot-dice and opening-score behavior, the selected winning-threshold trigger, and the strict-higher final-round process.
13. `Rules` shows the active selected scoring and play variants with plain explanations and refreshes when pre-game rule selections change.
14. Rule selections persist locally and are fixed once play starts unless the operator starts a new game.
15. When a player first reaches or exceeds the selected winning threshold, the interface marks the final round and identifies the score to beat.
16. Each other player receives exactly one final score entry, following the existing turn order.
17. A tied score does not take the lead. Only a strictly higher score updates the leader and score to beat.
18. The game declares the highest-scoring player after the last eligible final turn and accepts no further scores.
19. The app remains a manual scorekeeper. It does not validate dice, add a first-player selector, or add a start randomizer.
20. The hero tagline is exactly `Roll bold. Bank bigger. Farkle.`
21. The core flow works at narrow phone width and desktop width using pointer and keyboard input.
22. Text and controls meet WCAG AA contrast, visible-focus, and reduced-motion expectations.
23. A production build deploys as static files through the GitHub Pages pattern used by `howbigisit` and loads at `farkle.rdyson.dev` without a server dependency.
24. The hero subtitle is exactly `A scorekeeper for Farkle, a six-dice game for 2–8 players.`

## Confirmed v1 decisions

Confirmed by the operator on 20 August 2026:

1. Players enter the points earned each turn. The app adds them to the running total automatically.
2. The app provides one `Common house rules` preset and an `Adjust rules` panel limited to the options above. It does not provide a free-form rules editor.
3. A game supports 2–8 players.
4. Rule selections remain informational. The app does not validate manually entered scores against them.
5. The `Common house rules` preset has no opening-score minimum. Players may bank any score from their first turn. The existing opening-score alternatives remain selectable.
6. The `Common house rules` preset lets a player bank after scoring all six dice or roll all six again. A forced reroll remains selectable as the hot-dice alternative.
7. The selected winning threshold controls when the final round begins. The default is 10,000; 5,000, 15,000, and 20,000 remain selectable reach-or-exceed triggers.
8. The hero tagline is `Roll bold. Bank bigger. Farkle.`
9. The released header `Table guide` control and its focused modal/dialog are removed completely, not hidden. The released implementation at commit `5b084673581120fa48a24df6e241373f075a5434` is superseded only for this header/dialog slice.
10. The separate below-setup `How to Play` and `Rules` sections remain keyboard-operable. They retain the expanded six-dice turn loop and active selected-rules scoring reference. The app still accepts manual turn scores and does not validate dice.
11. The first listed player starts, and play follows entered order. V1 does not include a first-player selector or randomizer.
12. The hero subtitle is `A scorekeeper for Farkle, a six-dice game for 2–8 players.`

## Lean Tightbeam operating plan

Use the existing Farkle work item as the durable product thread. Do not create a work item for every task. Create a second item only if deployment becomes independent from the app build.

1. **Product decision.** The product owner records the confirmed brief and the three remaining choices. The human confirms or changes those choices. The product owner then freezes a versioned brief and judges later work against its Spirit section.
2. **Build coordination.** After confirmation, the product owner hires one Farkle orchestrator and gives it the whole brief. The orchestrator owns implementation order, staffing, and review. The product owner does not assign coding work directly.
3. **Technical specification.** The orchestrator gives one bounded card to a spec writer. That card must resolve the app structure, local-storage state, final-round state transitions, accessibility behavior, and the GitHub Pages deployment path. It must not reopen confirmed product choices.
4. **Specification gate.** A fresh reviewer checks the technical specification against this brief before coding starts. The orchestrator returns only material gaps for correction. One clean verdict opens implementation.
5. **Implementation.** The orchestrator gives the approved specification to one coder in one isolated worktree. The coder builds the static app, tests the scoring and final-round transitions, and proves local restoration with a real browser.
6. **Code gate.** A fresh reviewer checks the completed change against both the approved specification and repository standards. The reviewer must inspect the running app, not only tests or source code.
7. **Human acceptance.** The product owner presents the deployed preview and a short test script. The human checks the visual tone, score-entry feel, rule wording, phone layout, and final-round flow. These are the only planned human gates after the three choices above.
8. **Release.** After product-owner acceptance, the orchestrator ships through the `howbigisit` GitHub Pages pattern and verifies `farkle.rdyson.dev` in a real browser.

Every assignment must belong to the Farkle work item. Record product choices as durable decision requests and answers. Record the frozen brief and technical specification as versioned artifacts. Record specification review, code review, browser verification, product acceptance, and release as verdicts or completion facts on their assignments.

This plan intentionally avoids a separate project manager, designer, QA session, deployment specialist, or standing team. Add a recon specialist only if an uncertain external fact blocks the orchestrator. Retire each temporary specialist after its final card closes.

## Research basis

- [PlayMonster Farkle rules](https://playmonster.com/wp-content/uploads/2018/06/Farkle-Rules.pdf): commercial rules for turn flow, 500-point opening, hot dice, final turns, and combination scores.
- [Dice Game Depot rules and variants](https://www.dicegamedepot.com/farkle-rules/): common alternative scores and play variants.
- [Dice Game Depot printable variant summary](https://www.dicegamedepot.com/content/pdf/farkle-scoring-rules-dicegamedepot.pdf): compact comparison of conventional options.
