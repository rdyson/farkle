import { test, expect } from "@playwright/test";

async function startGame(page, names = ["Ada", "Lin"], winningScore = "10000") {
  await page.goto("/");
  const fields = page.getByPlaceholder(/Player \d/);
  for (let index = 0; index < names.length; index += 1) {
    if (index >= 2) await page.getByRole("button", { name: "Add player" }).click();
    await fields.nth(index).fill(names[index]);
  }
  if (winningScore !== "10000") {
    await page.getByText("Adjust rules", { exact: true }).click();
    await page.getByLabel("Winning score").selectOption(winningScore);
  }
  await page.getByRole("button", { name: /Start the game/ }).click();
}

async function bank(page, score) {
  await page.getByLabel("Points this throw").fill(String(score));
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Bank", exact: true }).click();
}

test("starts, validates, scores, restores, and undoes a game", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Player 1").fill("Ada");
  await page.getByPlaceholder("Player 2").fill("Ada");
  await page.getByRole("button", { name: /Start the game/ }).click();
  await expect(page.getByText("Player names must be different.")).toBeVisible();
  await page.getByPlaceholder("Player 2").fill("Lin");
  await page.getByRole("button", { name: /Start the game/ }).click();

  await expect(page.getByRole("heading", { name: /Ada.*turn/ })).toBeVisible();
  await page.getByLabel("Points this throw").fill("1.5");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Enter a positive whole number.")).toBeVisible();
  await page.getByLabel("Points this throw").fill("300");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Points this throw").fill("250");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator("#pending-throws")).toHaveText(/300.*250/);
  await expect(page.locator("#unbanked-subtotal")).toHaveText("550");
  await page.getByRole("button", { name: "Bank", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Lin.*turn/ })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Ada" }).getByText("550")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: /Lin.*turn/ })).toBeVisible();
  await page.getByRole("button", { name: "Undo last turn" }).click();
  await expect(page.getByRole("heading", { name: /Ada.*turn/ })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Ada" }).getByText("0")).toBeVisible();
  await expect(page.locator("#pending-throws")).toHaveText(/300.*250/);
});

test("runs one final turn per challenger and keeps the leader on a tie", async ({ page }) => {
  await startGame(page, ["Ada", "Lin", "Bea"], "5000");
  await bank(page, 5000);
  await expect(page.getByText("Final round · 2 turns left")).toBeVisible();
  await expect(page.getByText("Score to beat: 5,000")).toBeVisible();

  await bank(page, 5000);
  await expect(page.getByText("Final round · 1 turn left")).toBeVisible();
  await expect(page.getByText("Ada leads.")).toBeVisible();
  await bank(page, 5001);

  await expect(page.getByText("We have a winner")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Bea.*takes the glory/ })).toBeVisible();
  await expect(page.getByLabel("Points this throw")).toBeHidden();
  await expect(page.getByRole("button", { name: "Undo last turn" })).toBeVisible();
});

test("persists collapsible state and confirms before clearing a game", async ({ page }) => {
  await startGame(page);
  await page.getByText("How to Play", { exact: true }).click();
  const howToPlay = page.locator("#how-to-play");
  await expect(howToPlay.getByText("Start every turn with six dice", { exact: false })).toBeVisible();
  await page.reload();
  await expect(howToPlay.getByText("Start every turn with six dice", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep playing" }).click();
  await expect(page.getByRole("heading", { name: /Ada.*turn/ })).toBeVisible();
  await page.getByRole("button", { name: "New game" }).click();
  await page.getByRole("button", { name: "Clear game" }).click();
  await expect(page.getByRole("heading", { name: "Roll bold. Bank bigger. Farkle." })).toBeVisible();
});

test("supports the core flow with keyboard input", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Player 1").fill("Ada");
  await page.getByPlaceholder("Player 2").fill("Lin");
  await page.getByRole("button", { name: /Start the game/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /Ada.*turn/ })).toBeVisible();

  await page.getByRole("button", { name: "Farkle", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Lin.*turn/ })).toBeVisible();
  await page.getByText("Rules", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#selected-rules").getByText("Common house rules")).toBeVisible();
});

test("defaults to no opening minimum while retaining 500 as an option", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Adjust rules", { exact: true }).click();
  const openingScore = page.getByLabel("Opening score");
  await expect(openingScore).toHaveValue("0");
  await expect(openingScore.locator("option")).toHaveText([
    "No opening minimum",
    "350 before the first bank",
    "400 before the first bank",
    "500 before the first bank",
    "600 before the first bank",
    "1,000 before the first bank",
  ]);

  await page.getByLabel("Winning score").selectOption("15000");
  await expect(page.locator("#how-to-threshold")).toHaveText("15,000 points");
  await page.getByText("Rules", { exact: true }).click();
  await expect(page.locator("#selected-rules")).toContainText("15,000");
});

test("removes the table guide and keeps selected guidance below setup", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Roll bold. Bank bigger. Farkle." })).toBeVisible();
  await expect(page.getByText("A scorekeeper for Farkle, a six-dice game for 2–8 players.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Table guide" })).toHaveCount(0);
  await expect(page.locator("#table-guide-dialog")).toHaveCount(0);

  await page.getByText("Adjust rules", { exact: true }).click();
  await page.getByLabel("Opening score").selectOption("500");
  await page.getByLabel("Hot dice").selectOption("must-roll");
  await page.getByLabel("Winning score").selectOption("15000");
  await page.getByText("How to Play", { exact: true }).click();
  const howToPlay = page.locator("#how-to-play");
  await expect(howToPlay).toContainText("Start every turn with six dice");
  await expect(howToPlay).toContainText("must roll all six");
  await expect(howToPlay).toContainText("players need 500 before their first bank");
  await expect(howToPlay).toContainText("15,000 points");

  await page.getByText("Rules", { exact: true }).click();
  await expect(page.locator("#selected-rules")).toContainText("15,000");
  await expect(page.locator("#selected-rules")).toContainText("must roll all six");
});

for (const viewport of [{ name: "phone", width: 320, height: 740 }, { name: "desktop", width: 1280, height: 900 }]) {
  test(`core flow fits ${viewport.name} width`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await startGame(page);
    for (const points of [100, 200, 300, 400]) {
      await page.getByLabel("Points this throw").fill(String(points));
      await page.keyboard.press("Enter");
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByRole("heading", { name: /Ada.*turn/ })).toBeVisible();
    await expect(page.locator("#pending-throws")).toHaveText(/100.*200.*300.*400/);
    await expect(page.locator("#unbanked-subtotal")).toHaveText("1,000");
    await expect(page.getByLabel("Points this throw")).toBeInViewport();
    await expect(page.getByRole("button", { name: "Bank", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Farkle", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo last throw" })).toBeEnabled();
  });
}

test("keyboard turn actions and both undo levels restore the required focus", async ({ page }) => {
  await startGame(page);
  const input = page.getByLabel("Points this throw");
  await input.fill("300");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Undo last throw" }).focus();
  await page.keyboard.press("Enter");
  await expect(input).toBeFocused();

  await input.fill("500");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Bank", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(input).toBeFocused();

  await page.getByRole("button", { name: "Undo last turn" }).focus();
  await page.keyboard.press("Enter");
  await expect(input).toBeFocused();

  await page.getByRole("button", { name: "Farkle", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(input).toBeFocused();
});

for (const finishingAction of ["Bank", "Farkle"]) {
  test(`keyboard ${finishingAction} moves focus to the winner heading`, async ({ page }) => {
    await startGame(page, ["Ada", "Lin"], "5000");
    await bank(page, 5000);
    if (finishingAction === "Bank") {
      await page.getByLabel("Points this throw").fill("5001");
      await page.keyboard.press("Enter");
    }
    await page.getByRole("button", { name: finishingAction, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#turn-heading")).toBeFocused();
  });
}

test("persists pending throws and restores a mistaken Farkle", async ({ page }) => {
  await startGame(page);
  await page.getByLabel("Points this throw").fill("300");
  await page.keyboard.press("Enter");
  await page.getByLabel("Points this throw").fill("250");
  await page.keyboard.press("Enter");
  await page.reload();
  await expect(page.locator("#pending-throws")).toHaveText(/300.*250/);
  await expect(page.locator("#unbanked-subtotal")).toHaveText("550");
  await page.getByRole("button", { name: "Farkle", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Undo last turn" }).click();
  await expect(page.getByRole("heading", { name: /Ada.*turn/ })).toBeVisible();
  await expect(page.locator("#pending-throws")).toHaveText(/300.*250/);
});

test("shows exact informational multiplier wording", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Adjust rules", { exact: true }).click();
  await page.getByLabel("Four, five, or six of a kind").selectOption("multipliers");
  await page.getByText("Rules", { exact: true }).click();
  await expect(page.locator("#selected-rules")).toContainText("2× / 4× / 8× the corresponding triple score");
});
