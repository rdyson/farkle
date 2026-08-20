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
  await page.getByLabel("Points this turn").fill(String(score));
  await page.getByRole("button", { name: "Bank it!" }).click();
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
  await page.getByLabel("Points this turn").fill("1.5");
  await page.getByRole("button", { name: "Bank it!" }).click();
  await expect(page.getByText("Enter a whole number of zero or more.")).toBeVisible();
  await bank(page, 600);
  await expect(page.getByRole("heading", { name: /Lin.*turn/ })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Ada" }).getByText("600")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: /Lin.*turn/ })).toBeVisible();
  await page.getByRole("button", { name: "Undo last score" }).click();
  await expect(page.getByRole("heading", { name: /Ada.*turn/ })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Ada" }).getByText("0")).toBeVisible();
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
  await expect(page.getByLabel("Points this turn")).toBeHidden();
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

  await page.getByLabel("Points this turn").fill("0");
  await page.keyboard.press("Enter");
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

test("shows the table guide and explains the selected turn rules", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Roll bold. Bank bigger. Farkle." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Table guide" })).toBeVisible();

  await page.getByText("Adjust rules", { exact: true }).click();
  await page.getByLabel("Opening score").selectOption("500");
  await page.getByLabel("Hot dice").selectOption("must-roll");
  await page.getByLabel("Winning score").selectOption("15000");
  await page.getByRole("button", { name: "Table guide" }).click();

  const guide = page.getByRole("dialog", { name: "Table guide" });
  await expect(guide).toBeVisible();
  await expect(guide).toContainText("Start every turn with six dice");
  await expect(guide).toContainText("must roll all six");
  await expect(guide).toContainText("500 before the first bank");
  await expect(guide).toContainText("15,000");
  await expect(guide).toContainText("does not check the dice");
  await expect(page.getByText("How to Play", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Close guide" }).click();
  await expect(guide).toBeHidden();
  await expect(page.getByRole("button", { name: "Table guide" })).toBeFocused();
});

for (const viewport of [{ name: "phone", width: 360, height: 740 }, { name: "desktop", width: 1280, height: 900 }]) {
  test(`core flow fits ${viewport.name} width`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await startGame(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByLabel("Points this turn")).toBeInViewport();
  });
}
